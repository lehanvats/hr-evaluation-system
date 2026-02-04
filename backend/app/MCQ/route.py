"""
MCQ Routes
Handles MCQ question answer submission and retrieval
"""

from flask import request, jsonify
from . import MCQ
from ..models import MCQResponse, CandidateAuth as CandidateAuthModel
from ..extensions import db
from ..config import Config
import jwt
from datetime import datetime


def verify_candidate_token():
    """
    Helper function to verify candidate JWT token
    
    Returns:
        tuple: (candidate_id, error_response)
        - If valid: (candidate_id, None)
        - If invalid: (None, error_response)
    """
    auth_header = request.headers.get('Authorization')
    
    if not auth_header or not auth_header.startswith('Bearer '):
        return None, jsonify({
            'success': False,
            'message': 'Authentication required'
        }), 401
    
    token = auth_header.split(' ')[1]
    
    try:
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=['HS256'])
        
        # Verify it's a candidate token
        if payload.get('type') != 'candidate':
            return None, jsonify({
                'success': False,
                'message': 'Unauthorized: Candidate access required'
            }), 401
        
        return payload.get('user_id'), None
        
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None, jsonify({
            'success': False,
            'message': 'Invalid or expired token'
        }), 401


@MCQ.route('/submit', methods=['POST'])
def submit_mcq_answer():
    """
    MCQ ANSWER SUBMISSION ENDPOINT
    
    Submits a candidate's answer for an MCQ question.
    
    Authentication: Required (JWT Bearer token - candidate only)
    
    Request:
        - Method: POST
        - Content-Type: application/json
        - Headers: Authorization: Bearer <token>
        - Body:
        {
            "question_id": 101,
            "answer_option": "b"
        }
        
    Response:
        Success (201):
        {
            "success": true,
            "message": "MCQ answer submitted successfully",
            "data": {
                "id": 1,
                "question_id": 101,
                "candidate_id": 5,
                "answer_option": "b",
                "answered_at": "2024-02-04T10:30:00"
            }
        }
        
        Error (400/401/500):
        {
            "success": false,
            "message": "Error message"
        }
        
    Status Codes:
        - 201: Answer submitted successfully
        - 400: Bad request (missing fields, invalid data)
        - 401: Unauthorized (missing or invalid token)
        - 500: Server error
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
        answer_option = data.get('answer_option')
        
        if not question_id:
            return jsonify({
                'success': False,
                'message': 'question_id is required'
            }), 400
        
        if not answer_option:
            return jsonify({
                'success': False,
                'message': 'answer_option is required'
            }), 400
        
        # Validate answer option format (should be a single character like 'a', 'b', 'c', 'd')
        if not isinstance(answer_option, str) or len(answer_option) > 10:
            return jsonify({
                'success': False,
                'message': 'answer_option must be a string (max 10 characters)'
            }), 400
        
        # Check if candidate exists
        candidate = CandidateAuthModel.query.get(candidate_id)
        if not candidate:
            return jsonify({
                'success': False,
                'message': 'Candidate not found'
            }), 404
        
        # Check if answer already exists for this question and candidate
        existing_response = MCQResponse.query.filter_by(
            question_id=question_id,
            candidate_id=candidate_id
        ).first()
        
        if existing_response:
            # Update existing answer
            existing_response.answer_option = answer_option
            existing_response.answered_at = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'MCQ answer updated successfully',
                'data': existing_response.to_dict()
            }), 200
        
        # Create new MCQ response
        mcq_response = MCQResponse(
            question_id=question_id,
            candidate_id=candidate_id,
            answer_option=answer_option
        )
        
        db.session.add(mcq_response)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'MCQ answer submitted successfully',
            'data': mcq_response.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error submitting MCQ answer: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to submit MCQ answer',
            'error': str(e)
        }), 500


@MCQ.route('/responses', methods=['GET'])
def get_mcq_responses():
    """
    GET MCQ RESPONSES ENDPOINT
    
    Retrieves all MCQ responses for the authenticated candidate.
    
    Authentication: Required (JWT Bearer token - candidate only)
    
    Request:
        - Method: GET
        - Headers: Authorization: Bearer <token>
        
    Response:
        Success (200):
        {
            "success": true,
            "data": [
                {
                    "id": 1,
                    "question_id": 101,
                    "candidate_id": 5,
                    "answer_option": "b",
                    "answered_at": "2024-02-04T10:30:00"
                },
                ...
            ]
        }
        
        Error (401/500):
        {
            "success": false,
            "message": "Error message"
        }
        
    Status Codes:
        - 200: Success
        - 401: Unauthorized
        - 500: Server error
    """
    # Verify authentication
    candidate_id, error_response = verify_candidate_token()
    if error_response:
        return error_response
    
    try:
        # Get all responses for this candidate
        responses = MCQResponse.query.filter_by(candidate_id=candidate_id).all()
        
        return jsonify({
            'success': True,
            'data': [response.to_dict() for response in responses]
        }), 200
        
    except Exception as e:
        print(f"Error retrieving MCQ responses: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to retrieve MCQ responses',
            'error': str(e)
        }), 500


@MCQ.route('/responses/<int:question_id>', methods=['GET'])
def get_mcq_response_by_question(question_id):
    """
    GET SPECIFIC MCQ RESPONSE ENDPOINT
    
    Retrieves the MCQ response for a specific question for the authenticated candidate.
    
    Authentication: Required (JWT Bearer token - candidate only)
    
    Request:
        - Method: GET
        - Headers: Authorization: Bearer <token>
        - URL Parameter: question_id
        
    Response:
        Success (200):
        {
            "success": true,
            "data": {
                "id": 1,
                "question_id": 101,
                "candidate_id": 5,
                "answer_option": "b",
                "answered_at": "2024-02-04T10:30:00"
            }
        }
        
        Not Found (404):
        {
            "success": false,
            "message": "No response found for this question"
        }
        
        Error (401/500):
        {
            "success": false,
            "message": "Error message"
        }
        
    Status Codes:
        - 200: Success
        - 401: Unauthorized
        - 404: Response not found
        - 500: Server error
    """
    # Verify authentication
    candidate_id, error_response = verify_candidate_token()
    if error_response:
        return error_response
    
    try:
        # Get response for this specific question and candidate
        response = MCQResponse.query.filter_by(
            question_id=question_id,
            candidate_id=candidate_id
        ).first()
        
        if not response:
            return jsonify({
                'success': False,
                'message': 'No response found for this question'
            }), 404
        
        return jsonify({
            'success': True,
            'data': response.to_dict()
        }), 200
        
    except Exception as e:
        print(f"Error retrieving MCQ response: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to retrieve MCQ response',
            'error': str(e)
        }), 500


@MCQ.route('/batch-submit', methods=['POST'])
def batch_submit_mcq_answers():
    """
    BATCH MCQ ANSWER SUBMISSION ENDPOINT
    
    Submits multiple MCQ answers at once for the authenticated candidate.
    
    Authentication: Required (JWT Bearer token - candidate only)
    
    Request:
        - Method: POST
        - Content-Type: application/json
        - Headers: Authorization: Bearer <token>
        - Body:
        {
            "answers": [
                {
                    "question_id": 101,
                    "answer_option": "b"
                },
                {
                    "question_id": 102,
                    "answer_option": "a"
                }
            ]
        }
        
    Response:
        Success (201):
        {
            "success": true,
            "message": "2 MCQ answers submitted successfully",
            "data": [
                {
                    "id": 1,
                    "question_id": 101,
                    "candidate_id": 5,
                    "answer_option": "b",
                    "answered_at": "2024-02-04T10:30:00"
                },
                ...
            ]
        }
        
        Error (400/401/500):
        {
            "success": false,
            "message": "Error message"
        }
        
    Status Codes:
        - 201: Answers submitted successfully
        - 400: Bad request (invalid data)
        - 401: Unauthorized
        - 500: Server error
    """
    # Verify authentication
    candidate_id, error_response = verify_candidate_token()
    if error_response:
        return error_response
    
    try:
        # Get request data
        data = request.get_json()
        
        if not data or 'answers' not in data:
            return jsonify({
                'success': False,
                'message': 'answers array is required in request body'
            }), 400
        
        answers = data.get('answers', [])
        
        if not isinstance(answers, list) or len(answers) == 0:
            return jsonify({
                'success': False,
                'message': 'answers must be a non-empty array'
            }), 400
        
        # Check if candidate exists
        candidate = CandidateAuthModel.query.get(candidate_id)
        if not candidate:
            return jsonify({
                'success': False,
                'message': 'Candidate not found'
            }), 404
        
        responses = []
        
        for answer in answers:
            question_id = answer.get('question_id')
            answer_option = answer.get('answer_option')
            
            if not question_id or not answer_option:
                continue  # Skip invalid entries
            
            # Check if answer already exists
            existing_response = MCQResponse.query.filter_by(
                question_id=question_id,
                candidate_id=candidate_id
            ).first()
            
            if existing_response:
                # Update existing
                existing_response.answer_option = answer_option
                existing_response.answered_at = datetime.utcnow()
                responses.append(existing_response)
            else:
                # Create new
                mcq_response = MCQResponse(
                    question_id=question_id,
                    candidate_id=candidate_id,
                    answer_option=answer_option
                )
                db.session.add(mcq_response)
                responses.append(mcq_response)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{len(responses)} MCQ answer(s) submitted successfully',
            'data': [response.to_dict() for response in responses]
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error submitting batch MCQ answers: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to submit batch MCQ answers',
            'error': str(e)
        }), 500


@MCQ.route('/complete-round', methods=['POST'])
def complete_mcq_round():
    """
    COMPLETE MCQ ROUND ENDPOINT
    
    Marks the MCQ round as completed for the candidate and submits all answers.
    This locks the MCQ round and prevents further access.
    
    Authentication: Required (JWT Bearer token - candidate only)
    
    Request:
        - Method: POST
        - Content-Type: application/json
        - Headers: Authorization: Bearer <token>
        - Body:
        {
            "answers": [
                {
                    "question_id": 101,
                    "answer_option": "b"
                },
                ...
            ]
        }
        
    Response:
        Success (200):
        {
            "success": true,
            "message": "MCQ round completed successfully",
            "data": {
                "mcq_completed": true,
                "mcq_completed_at": "2024-02-04T10:30:00",
                "total_answers": 5
            }
        }
        
        Error (400/401/500):
        {
            "success": false,
            "message": "Error message"
        }
        
    Status Codes:
        - 200: Round completed successfully
        - 400: Round already completed or invalid data
        - 401: Unauthorized
        - 500: Server error
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
        
        # Check if MCQ round is already completed
        if candidate.mcq_completed:
            return jsonify({
                'success': False,
                'message': 'MCQ round already completed',
                'data': {
                    'mcq_completed': True,
                    'mcq_completed_at': candidate.mcq_completed_at.isoformat() if candidate.mcq_completed_at else None
                }
            }), 400
        
        # Get request data
        data = request.get_json()
        
        if data and 'answers' in data:
            answers = data.get('answers', [])
            
            # Save all answers
            for answer in answers:
                question_id = answer.get('question_id')
                answer_option = answer.get('answer_option')
                
                if not question_id or not answer_option:
                    continue
                
                # Check if answer already exists
                existing_response = MCQResponse.query.filter_by(
                    question_id=question_id,
                    candidate_id=candidate_id
                ).first()
                
                if existing_response:
                    # Update existing
                    existing_response.answer_option = answer_option
                    existing_response.answered_at = datetime.utcnow()
                else:
                    # Create new
                    mcq_response = MCQResponse(
                        question_id=question_id,
                        candidate_id=candidate_id,
                        answer_option=answer_option
                    )
                    db.session.add(mcq_response)
        
        # Mark MCQ round as completed
        candidate.mcq_completed = True
        candidate.mcq_completed_at = datetime.utcnow()
        
        db.session.commit()
        
        # Get total answers count
        total_answers = MCQResponse.query.filter_by(candidate_id=candidate_id).count()
        
        return jsonify({
            'success': True,
            'message': 'MCQ round completed successfully',
            'data': {
                'mcq_completed': True,
                'mcq_completed_at': candidate.mcq_completed_at.isoformat(),
                'total_answers': total_answers
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error completing MCQ round: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to complete MCQ round',
            'error': str(e)
        }), 500

