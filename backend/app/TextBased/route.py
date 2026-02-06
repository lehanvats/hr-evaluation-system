"""
Text-Based Assessment Routes
Handles open-ended question management and answer submission
"""

from flask import request, jsonify
from . import TextBased
from ..models import TextBasedQuestion, TextBasedAnswer, CandidateAuth as CandidateAuthModel, TextAssessmentResult
from ..extensions import db
from ..config import Config
from ..auth_helpers import verify_candidate_token, verify_recruiter_token
from services.textresponse_to_grading import evaluate_text_responses, grade_text_responses
import json
import jwt
from datetime import datetime
import pandas as pd
import io


@TextBased.route('/questions', methods=['GET'])
def get_text_based_questions():
    """
    GET TEXT-BASED QUESTIONS ENDPOINT
    
    Fetches all text-based questions for candidate to answer.
    
    Authentication: Required (JWT Bearer token - candidate only)
    
    Response:
        Success (200):
        {
            "success": true,
            "questions": [
                {
                    "id": 1,
                    "question_id": 1,
                    "question": "Describe your experience with...",
                    "created_at": "2026-02-04T10:00:00",
                    "updated_at": "2026-02-04T10:00:00"
                }
            ]
        }
    """
    # Verify authentication
    candidate_id, error_response = verify_candidate_token()
    if error_response:
        print(f"\n❌ Authentication failed for /text-based/questions")
        return error_response
    
    print(f"\n✅ Authenticated candidate {candidate_id} requesting text-based questions")
    
    try:
        # Get all questions
        questions = TextBasedQuestion.query.all()
        
        print(f"📚 Found {len(questions)} text-based questions in database")
        
        questions_data = [q.to_dict() for q in questions]
        print(f"📤 Returning {len(questions_data)} questions to frontend")
        
        return jsonify({
            'success': True,
            'questions': questions_data
        }), 200
        
    except Exception as e:
        print(f"\n❌ GET TEXT-BASED QUESTIONS ERROR: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500


@TextBased.route('/submit', methods=['POST'])
def submit_text_based_answer():
    """
    TEXT-BASED ANSWER SUBMISSION ENDPOINT
    
    Submits or updates an answer to a text-based question.
    Validates word count (max 200 words).
    
    Authentication: Required (JWT Bearer token - candidate only)
    
    Request:
        {
            "question_id": 1,
            "answer": "This is my detailed answer..."
        }
        
    Response:
        {
            "success": true,
            "message": "Answer submitted successfully",
            "answer": {
                "id": 1,
                "student_id": 1,
                "question_id": 1,
                "answer": "This is my detailed answer...",
                "word_count": 25,
                "submitted_at": "2026-02-04T10:00:00",
                "updated_at": "2026-02-04T10:00:00"
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
        answer_text = data.get('answer')
        
        if not question_id:
            return jsonify({
                'success': False,
                'message': 'question_id is required'
            }), 400
        
        if not answer_text:
            return jsonify({
                'success': False,
                'message': 'answer is required'
            }), 400
        
        # Validate answer is a string
        if not isinstance(answer_text, str):
            return jsonify({
                'success': False,
                'message': 'answer must be a string'
            }), 400
        
        # Trim whitespace
        answer_text = answer_text.strip()
        
        if not answer_text:
            return jsonify({
                'success': False,
                'message': 'answer cannot be empty'
            }), 400
        
        # Count words
        word_count = len(answer_text.split())
        
        # Validate word count
        if word_count > 200:
            return jsonify({
                'success': False,
                'message': f'Answer exceeds maximum word limit of 200 words. Current: {word_count} words'
            }), 400
        
        # Check if question exists
        question = TextBasedQuestion.query.filter_by(question_id=question_id).first()
        if not question:
            return jsonify({
                'success': False,
                'message': f'Question with question_id {question_id} not found'
            }), 404
        
        # Check if answer already exists for this student and question
        existing_answer = TextBasedAnswer.query.filter_by(
            student_id=candidate_id,
            question_id=question_id
        ).first()
        
        if existing_answer:
            # Update existing answer
            existing_answer.answer = answer_text
            existing_answer.word_count = word_count
            existing_answer.updated_at = datetime.utcnow()
            
            db.session.commit()
            
            print(f"✅ Updated answer for candidate {candidate_id}, question {question_id}")
            
            # FIX: Update candidate's last active timestamp
            candidate = CandidateAuthModel.query.get(candidate_id)
            if candidate:
                candidate.text_based_completed_at = datetime.now()
                db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Answer updated successfully',
                'answer': existing_answer.to_dict()
            }), 200
        else:
            # Create new answer
            new_answer = TextBasedAnswer(
                student_id=candidate_id,
                question_id=question_id,
                answer=answer_text,
                word_count=word_count
            )
            
            db.session.add(new_answer)
            db.session.commit()
            
            print(f"✅ Created new answer for candidate {candidate_id}, question {question_id}")
            
            # FIX: Update candidate's last active timestamp
            candidate = CandidateAuthModel.query.get(candidate_id)
            if candidate:
                candidate.text_based_completed_at = datetime.now()
                db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Answer submitted successfully',
                'answer': new_answer.to_dict()
            }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"\n❌ SUBMIT TEXT-BASED ANSWER ERROR: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500


@TextBased.route('/answers', methods=['GET'])
def get_candidate_answers():
    """
    GET CANDIDATE'S ANSWERS ENDPOINT
    
    Fetches all answers submitted by the authenticated candidate.
    
    Authentication: Required (JWT Bearer token - candidate only)
    
    Response:
        Success (200):
        {
            "success": true,
            "answers": [
                {
                    "id": 1,
                    "student_id": 1,
                    "question_id": 1,
                    "answer": "This is my answer...",
                    "word_count": 25,
                    "submitted_at": "2026-02-04T10:00:00",
                    "updated_at": "2026-02-04T10:00:00"
                }
            ]
        }
    """
    # Verify authentication
    candidate_id, error_response = verify_candidate_token()
    if error_response:
        return error_response
    
    try:
        # Get all answers for this candidate
        answers = TextBasedAnswer.query.filter_by(student_id=candidate_id).all()
        
        answers_data = [a.to_dict() for a in answers]
        
        return jsonify({
            'success': True,
            'answers': answers_data
        }), 200
        
    except Exception as e:
        print(f"\n❌ GET CANDIDATE ANSWERS ERROR: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500


@TextBased.route('/complete', methods=['POST'])
def complete_text_based_test():
    """
    COMPLETE TEXT-BASED TEST ENDPOINT
    
    Marks the text-based assessment as completed for the candidate.
    
    Authentication: Required (JWT Bearer token - candidate only)
    
    Response:
        {
            "success": true,
            "message": "Text-based assessment completed successfully"
        }
    """
    # Verify authentication
    candidate_id, error_response = verify_candidate_token()
    if error_response:
        return error_response
    
    try:
        # Get candidate
        candidate = CandidateAuthModel.query.get(candidate_id)
        if not candidate:
            return jsonify({
                'success': False,
                'message': 'Candidate not found'
            }), 404
        
        # Mark as completed
        candidate.text_based_completed = True
        candidate.text_based_completed_at = datetime.now()
        
        # AI Grading for Text Responses
        try:
            answers = TextBasedAnswer.query.filter_by(student_id=candidate_id).all()
            qa_pairs = []
            for ans in answers:
                # Need to fetch question text. Join is better but lazy load might work if relationship set
                # TextBasedAnswer has 'question' relationship
                qa_pairs.append({
                    "question": ans.question.question,
                    "answer": ans.answer
                })
            
            if qa_pairs:
                grading_result = evaluate_text_responses(qa_pairs)
                
                # Grade each response 0-100 and compute average communication_score
                grades_result = grade_text_responses(grading_result)
                
                # Merge grades and communication_score into the grading result
                grading_result['grades'] = grades_result.get('grades', [])
                grading_result['communication_score'] = grades_result.get('communication_score', 0)
                
                # Save to TextAssessmentResult
                text_result = TextAssessmentResult.query.filter_by(candidate_id=candidate_id).first()
                if not text_result:
                    text_result = TextAssessmentResult(candidate_id=candidate_id)
                    db.session.add(text_result)
                
                text_result.grading_json = grading_result
                print(f"✅ Text Assessment Graded: communication_score={grading_result.get('communication_score')}, remark={grading_result.get('overall_remark', grading_result.get('remark'))}")
                
        except Exception as e:
            print(f"⚠️ Text Assessment Grading failed: {e}")
        
        db.session.commit()
        
        print(f"✅ Text-based assessment completed for candidate {candidate_id}")
        
        return jsonify({
            'success': True,
            'message': 'Text-based assessment completed successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"\n❌ COMPLETE TEXT-BASED TEST ERROR: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500


@TextBased.route('/upload', methods=['POST'])
def upload_text_based_questions():
    """
    BULK TEXT-BASED QUESTION UPLOAD ENDPOINT
    
    Handles bulk upload of text-based questions from CSV or Excel files.
    
    Authentication: Required (JWT Bearer token - recruiter only)
    
    Request:
        - Method: POST
        - Content-Type: multipart/form-data
        - Field: 'file' (CSV/Excel file)
        - File must contain columns: 'question_id', 'question'
        
    Supported file formats:
        - CSV (.csv)
        - Excel (.xlsx, .xls)
        
    File constraints:
        - Maximum size: 10MB
        - Required columns: question_id, question
        
    Response:
        {
            "success": true/false,
            "message": "Status message",
            "results": {
                "total": <number of rows processed>,
                "created": <number of new questions created>,
                "updated": <number of existing questions updated>,
                "skipped": <number of rows skipped due to errors>,
                "errors": [<list of error messages>]
            }
        }
    """
    # Verify recruiter authentication
    recruiter_id, error = verify_recruiter_token()
    if error:
        return error
    
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'message': 'No file provided'
            }), 400
        
        file = request.files['file']
        
        # Check if a file was actually selected
        if file.filename == '':
            return jsonify({
                'success': False,
                'message': 'No file selected'
            }), 400
        
        # Validate file extension
        allowed_extensions = {'.csv', '.xlsx', '.xls'}
        file_ext = '.' + file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        
        if file_ext not in allowed_extensions:
            return jsonify({
                'success': False,
                'message': f'Invalid file type. Allowed types: {", ".join(allowed_extensions)}'
            }), 400
        
        # Read file into pandas DataFrame
        try:
            file_content = file.read()
            
            if file_ext == '.csv':
                df = pd.read_csv(io.BytesIO(file_content))
            else:  # Excel files
                df = pd.read_excel(io.BytesIO(file_content))
                
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'Error reading file: {str(e)}'
            }), 400
        
        # Validate required columns
        required_columns = ['question_id', 'question']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            return jsonify({
                'success': False,
                'message': f'Missing required columns: {", ".join(missing_columns)}'
            }), 400
        
        # Delete all existing text-based answers and questions before inserting new ones
        try:
            # First delete all answers (foreign key constraint)
            deleted_answers = TextBasedAnswer.query.delete()
            # Then delete all questions
            deleted_questions = TextBasedQuestion.query.delete()
            db.session.commit()
            print(f"\n✅ Deleted {deleted_answers} existing text-based answers and {deleted_questions} questions")
        except Exception as e:
            db.session.rollback()
            return jsonify({
                'success': False,
                'message': f'Error deleting existing questions: {str(e)}'
            }), 500
        
        # Process questions
        results = {
            'total': len(df),
            'created': 0,
            'updated': 0,
            'skipped': 0,
            'errors': []
        }
        
        for index, row in df.iterrows():
            try:
                # Validate required fields
                question_id = row.get('question_id')
                question_text = row.get('question')
                
                # Skip if missing required fields
                if pd.isna(question_id) or pd.isna(question_text):
                    results['skipped'] += 1
                    results['errors'].append(f"Row {index + 2}: Missing question_id or question")
                    continue
                
                # Convert question_id to integer
                try:
                    question_id = int(question_id)
                except (ValueError, TypeError):
                    results['skipped'] += 1
                    results['errors'].append(f"Row {index + 2}: Invalid question_id (must be a number)")
                    continue
                
                # Convert question to string and trim
                question_text = str(question_text).strip()
                
                if not question_text:
                    results['skipped'] += 1
                    results['errors'].append(f"Row {index + 2}: Question text cannot be empty")
                    continue
                
                # Check if question exists
                existing_question = TextBasedQuestion.query.filter_by(question_id=question_id).first()
                
                if existing_question:
                    # Update existing question (shouldn't happen since we deleted all, but keep for safety)
                    existing_question.question = question_text
                    existing_question.updated_at = datetime.utcnow()
                    results['updated'] += 1
                else:
                    # Create new question
                    new_question = TextBasedQuestion(
                        question_id=question_id,
                        question=question_text
                    )
                    db.session.add(new_question)
                    results['created'] += 1
                
            except Exception as e:
                results['skipped'] += 1
                results['errors'].append(f"Row {index + 2}: {str(e)}")
                continue
        
        # Commit all changes
        try:
            db.session.commit()
            
            print(f"✅ Text-based questions upload completed:")
            print(f"   Total: {results['total']}")
            print(f"   Created: {results['created']}")
            print(f"   Updated: {results['updated']}")
            print(f"   Skipped: {results['skipped']}")
            
            return jsonify({
                'success': True,
                'message': 'File processed successfully',
                'results': results
            }), 200
            
        except Exception as e:
            db.session.rollback()
            return jsonify({
                'success': False,
                'message': f'Database error: {str(e)}'
            }), 500
        
    except Exception as e:
        print(f"\n❌ UPLOAD TEXT-BASED QUESTIONS ERROR: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500


@TextBased.route('/all-answers', methods=['GET'])
def get_all_answers():
    """
    GET ALL TEXT-BASED ANSWERS ENDPOINT (RECRUITER)
    
    Fetches all text-based answers from all candidates for recruiter review.
    
    Authentication: Required (JWT Bearer token - recruiter only)
    
    Response:
        Success (200):
        {
            "success": true,
            "answers": [
                {
                    "id": 1,
                    "student_id": 1,
                    "student_email": "candidate@example.com",
                    "question_id": 1,
                    "question": "Describe your experience...",
                    "answer": "This is my answer...",
                    "word_count": 25,
                    "submitted_at": "2026-02-04T10:00:00",
                    "updated_at": "2026-02-04T10:00:00"
                }
            ]
        }
    """
    # Verify recruiter authentication
    recruiter_id, error = verify_recruiter_token()
    if error:
        return error
    
    try:
        # Get all answers with joined data
        answers = db.session.query(
            TextBasedAnswer,
            CandidateAuthModel.email.label('student_email'),
            TextBasedQuestion.question.label('question_text')
        ).join(
            CandidateAuthModel, TextBasedAnswer.student_id == CandidateAuthModel.id
        ).join(
            TextBasedQuestion, TextBasedAnswer.question_id == TextBasedQuestion.question_id
        ).all()
        
        answers_data = []
        for answer, student_email, question_text in answers:
            answer_dict = answer.to_dict()
            answer_dict['student_email'] = student_email
            answer_dict['question'] = question_text
            answers_data.append(answer_dict)
        
        return jsonify({
            'success': True,
            'answers': answers_data
        }), 200
        
    except Exception as e:
        print(f"\n❌ GET ALL ANSWERS ERROR: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500
