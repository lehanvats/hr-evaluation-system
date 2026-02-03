"""
CandidateAuth Routes
Handles candidate authentication operations
"""

from flask import request, jsonify
from . import CandidateAuth
from ..models import CandidateAuth as CandidateAuthModel
from ..extensions import db
from ..config import Config
import jwt
from datetime import datetime, timedelta


@CandidateAuth.route('/login', methods=['POST'])
def login():
    """
    CANDIDATE LOGIN ENDPOINT
    
    Authenticates candidate credentials and returns JWT token for assessment access.
    
    Authentication: Not required (public endpoint)
    
    Request:
        - Method: POST
        - Content-Type: application/json
        - Body: {
            "email": "candidate@example.com",
            "password": "plain_text_password"
        }
        
    Response:
        Success (200):
        {
            "success": true,
            "message": "Login successful",
            "token": "JWT_TOKEN_STRING",
            "user": {
                "id": 1,
                "email": "candidate@example.com"
            }
        }
        
        Failure (400/401):
        {
            "success": false,
            "message": "Error message"
        }
        
    Status Codes:
        - 200: Login successful
        - 400: Missing email or password
        - 401: Invalid credentials
        - 500: Server error
        
    Processing Logic:
        1. Validate request contains email and password
        2. Query database for candidate by email
        3. Verify password using check_password() method
        4. Generate JWT token with candidate details
        5. Return token and user info
        
    Token Details:
        - Algorithm: HS256
        - Expiration: Configured in Config.JWT_EXP_MINUTES
        - Payload includes: user_id, email, type='candidate', exp
        
    Use Cases:
        - Initial candidate login to access assessment
        - Session establishment for assessment taking
    """
    try:
        data = request.get_json()
        
        # Validate that email and password are provided
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({
                'success': False,
                'message': 'Email and password are required'
            }), 400
        
        email = data.get('email')
        password = data.get('password')
        
        # Query database for candidate by email
        candidate = CandidateAuthModel.query.filter_by(email=email).first()
        
        # Return error if candidate not found
        if not candidate:
            return jsonify({
                'success': False,
                'message': 'Invalid email or password'
            }), 401
        
        # Verify password using werkzeug's check_password_hash
        if not candidate.check_password(password):
            return jsonify({
                'success': False,
                'message': 'Invalid email or password'
            }), 401
        
        # Generate JWT token with candidate information
        token_payload = {
            'user_id': candidate.id,
            'email': candidate.email,
            'type': 'candidate',
            'exp': datetime.utcnow() + timedelta(minutes=Config.JWT_EXP_MINUTES)
        }
        
        token = jwt.encode(token_payload, Config.JWT_SECRET, algorithm='HS256')
        
        # Return success response with token and user details
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'token': token,
            'user': candidate.to_dict()
        }), 200
        
    except Exception as e:
        import traceback
        print(f"\n❌ CANDIDATE LOGIN ERROR: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500


@CandidateAuth.route('/verify', methods=['GET'])
def verify_token():
    """
    TOKEN VERIFICATION ENDPOINT
    
    Verifies the validity of a candidate JWT token and returns user information.
    Used to check if a candidate session is still valid during assessment.
    
    Authentication: Required (JWT Bearer token)
    
    Request:
        - Method: GET
        - Headers: {
            "Authorization": "Bearer JWT_TOKEN_STRING"
        }
        
    Response:
        Success (200):
        {
            "valid": true,
            "user": {
                "id": 1,
                "email": "candidate@example.com"
            }
        }
        
        Failure (401):
        {
            "valid": false,
            "message": "Error message"
        }
        
    Status Codes:
        - 200: Token is valid
        - 401: Missing token, invalid token, expired token, or wrong token type
        - 500: Server error
        
    Processing Logic:
        1. Extract token from Authorization header
        2. Decode and verify token using JWT_SECRET
        3. Verify token type is 'candidate'
        4. Return user information from token payload
        
    Token Validation:
        - Checks token signature
        - Checks token expiration
        - Verifies token type matches 'candidate'
        
    Use Cases:
        - Session validation during assessment
        - Protected route authentication
        - Assessment continuation after refresh
    """
    try:
        # Extract Authorization header
        auth_header = request.headers.get('Authorization')
        
        # Validate that token is present and properly formatted
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({
                'valid': False,
                'message': 'No token provided'
            }), 401
        
        # Extract token from "Bearer TOKEN" format
        token = auth_header.split(' ')[1]
        
        try:
            # Decode and verify token
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=['HS256'])
            
            # Verify it's a candidate token (not recruiter or other type)
            if payload.get('type') != 'candidate':
                return jsonify({
                    'valid': False,
                    'message': 'Invalid token type'
                }), 401
            
            # Get user from database to include resume info
            candidate = CandidateAuthModel.query.get(payload.get('user_id'))
            
            if not candidate:
                return jsonify({
                    'valid': False,
                    'message': 'User not found'
                }), 404
            
            # Return success with user information including resume
            return jsonify({
                'valid': True,
                'user': {
                    'id': candidate.id,
                    'email': candidate.email,
                    'resume_url': candidate.resume_url,
                    'resume_filename': candidate.resume_filename,
                    'resume_uploaded_at': candidate.resume_uploaded_at.isoformat() if candidate.resume_uploaded_at else None
                }
            }), 200
            
        except jwt.ExpiredSignatureError:
            return jsonify({
                'valid': False,
                'message': 'Token has expired'
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                'valid': False,
                'message': 'Invalid token'
            }), 401
            
    except Exception as e:
        import traceback
        print(f"\n❌ TOKEN VERIFICATION ERROR: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'valid': False,
            'message': f'An error occurred: {str(e)}'
        }), 500
