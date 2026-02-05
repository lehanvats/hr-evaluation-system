"""
MCQ Routes
Handles MCQ question retrieval and answer submission with real-time scoring
"""

from flask import request, jsonify
from . import MCQ
from ..models import MCQQuestion, MCQResult, CandidateAuth as CandidateAuthModel
from ..extensions import db
from ..config import Config
from ..auth_helpers import verify_candidate_token, verify_recruiter_token
import jwt
from datetime import datetime
import json
from services.mcqresult_to_grading import evaluate_mcq_performance


@MCQ.route('/questions', methods=['GET'])
def get_mcq_questions():
    """
    GET MCQ QUESTIONS ENDPOINT
    
    Fetches all MCQ questions WITHOUT correct answers for candidate to attempt.
    
    Authentication: Required (JWT Bearer token - candidate only)
    
    Response:
        Success (200):
        {
            "success": true,
            "questions": [
                {
                    "id": 1,
                    "question_id": 101,
                    "question": "What is...?",
                    "options": [
                        {"id": 1, "text": "Option 1"},
                        {"id": 2, "text": "Option 2"},
                        {"id": 3, "text": "Option 3"},
                        {"id": 4, "text": "Option 4"}
                    ]
                }
            ]
        }
    """
    # Verify authentication
    candidate_id, error_response = verify_candidate_token()
    if error_response:
        print(f"\n❌ Authentication failed for /questions")
        return error_response
    
    print(f"\n✅ Authenticated candidate {candidate_id} requesting questions")
    
    try:
        # Get all questions
        questions = MCQQuestion.query.all()
        
        print(f"📚 Found {len(questions)} questions in database")
        
        questions_data = [q.to_dict(include_answer=False) for q in questions]
        print(f"📤 Returning {len(questions_data)} questions to frontend")
        
        return jsonify({
            'success': True,
            'questions': questions_data
        }), 200
        
    except Exception as e:
        print(f"\\n❌ GET QUESTIONS ERROR: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500


@MCQ.route('/submit', methods=['POST'])
def submit_mcq_answer():
    """
    MCQ ANSWER SUBMISSION ENDPOINT
    
    Submits answer, checks if correct, updates tallies in real-time.
    
    Authentication: Required (JWT Bearer token - candidate only)
    
    Request:
        {
            "question_id": 101,
            "selected_option": 2
        }
        
    Response:
        {
            "success": true,
            "is_correct": true,
            "correct_answer": 2,
            "result": {
                "correct_answers": 5,
                "wrong_answers": 2,
                "percentage_correct": 71.43,
                "total_answered": 7
            }
        }
    """
    # Verify authentication
    candidate_id, error_response = verify_candidate_token()
    if error_response:
        return error_response
    
    try:
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'Request body is required'
            }), 400
        
        # Validate required fields
        question_id = data.get('question_id')
        selected_option = data.get('selected_option')
        
        if not question_id:
            return jsonify({
                'success': False,
                'message': 'question_id is required'
            }), 400
        
        if not selected_option:
            return jsonify({
                'success': False,
                'message': 'selected_option is required'
            }), 400
        
        # Validate selected_option is a number
        try:
            selected_option = int(selected_option)
            if selected_option not in [1, 2, 3, 4]:
                return jsonify({
                    'success': False,
                    'message': 'selected_option must be 1, 2, 3, or 4'
                }), 400
        except (ValueError, TypeError):
            return jsonify({
                'success': False,
                'message': 'selected_option must be a number'
            }), 400
        
        # Get the question
        question = MCQQuestion.query.filter_by(question_id=question_id).first()
        if not question:
            return jsonify({
                'success': False,
                'message': 'Question not found'
            }), 404
        
        # Check if answer is correct
        is_correct = (selected_option == question.correct_answer)
        
        print(f"\n🔍 DEBUG - Candidate ID: {candidate_id}")
        print(f"🔍 DEBUG - Question ID: {question_id}")
        print(f"🔍 DEBUG - Selected: {selected_option}, Correct: {question.correct_answer}")
        print(f"🔍 DEBUG - Is Correct: {is_correct}")
        
        # Get or create result record for this student
        result = MCQResult.query.filter_by(student_id=candidate_id).first()
        
        if not result:
            print(f"✨ Creating new MCQResult for student {candidate_id}")
            result = MCQResult(
                student_id=candidate_id,
                correct_answers=0,
                wrong_answers=0,
                percentage_correct=0.0
            )
            db.session.add(result)
        else:
            print(f"📝 Found existing MCQResult: correct={result.correct_answers}, wrong={result.wrong_answers}")
        
        # Update tallies
        if is_correct:
            result.correct_answers += 1
            print(f"✅ Incrementing correct_answers to {result.correct_answers}")
        else:
            result.wrong_answers += 1
            print(f"❌ Incrementing wrong_answers to {result.wrong_answers}")
        
        # Calculate percentage
        total_answered = result.correct_answers + result.wrong_answers
        if total_answered > 0:
            result.percentage_correct = (result.correct_answers / total_answered) * 100
            
            # AI Grading
            try:
                grading_result = evaluate_mcq_performance(result.correct_answers, total_answered)
                result.grading_json = grading_result # Function now returns dict, no json.loads needed
            except Exception as e:
                print(f"⚠️ AI Grading failed: {e}")
        
        print(f"📊 New totals - Correct: {result.correct_answers}, Wrong: {result.wrong_answers}, Percentage: {result.percentage_correct}%")
        
        # Commit changes
        db.session.commit()
        print(f"💾 Database committed successfully")
        
        return jsonify({
            'success': True,
            'is_correct': is_correct,
            'correct_answer': question.correct_answer,
            'result': result.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"\\n❌ SUBMIT ANSWER ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500


@MCQ.route('/result', methods=['GET'])
def get_mcq_result():
    """
    GET MCQ RESULT ENDPOINT
    
    Fetches the current MCQ result for the authenticated candidate.
    
    Authentication: Required (JWT Bearer token - candidate only)
    
    Response:
        {
            "success": true,
            "result": {
                "correct_answers": 5,
                "wrong_answers": 2,
                "percentage_correct": 71.43,
                "total_answered": 7
            }
        }
    """
    # Verify authentication
    candidate_id, error_response = verify_candidate_token()
    if error_response:
        return error_response
    
    try:
        # Get result record
        result = MCQResult.query.filter_by(student_id=candidate_id).first()
        
        if not result:
            # Return empty result if none exists
            return jsonify({
                'success': True,
                'result': {
                    'correct_answers': 0,
                    'wrong_answers': 0,
                    'percentage_correct': 0.0,
                    'total_answered': 0
                }
            }), 200
        
        return jsonify({
            'success': True,
            'result': result.to_dict()
        }), 200
        
    except Exception as e:
        print(f"\\n❌ GET RESULT ERROR: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500
