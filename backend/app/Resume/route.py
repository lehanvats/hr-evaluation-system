"""
Resume Routes
Handles resume upload and management operations
"""

from flask import request, jsonify
from . import Resume
from ..models import CandidateAuth as CandidateAuthModel
from ..extensions import db
from ..config import Config
import jwt
from datetime import datetime
from supabase import create_client, Client
import os


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


@Resume.route('/upload', methods=['POST'])
def upload_resume():
    """
    RESUME UPLOAD ENDPOINT
    
    Uploads candidate resume to Supabase storage and saves reference in database.
    
    Authentication: Required (JWT Bearer token - candidate only)
    
    Request:
        - Method: POST
        - Content-Type: multipart/form-data
        - Field: 'resume' (PDF file)
        - Headers: Authorization: Bearer <token>
        
    File constraints:
        - File type: PDF only
        - Maximum size: 5MB
        
    Response:
        Success (200):
        {
            "success": true,
            "message": "Resume uploaded successfully",
            "resume_url": "https://supabase-url/...",
            "filename": "resume.pdf"
        }
        
        Error (400/401/500):
        {
            "success": false,
            "message": "Error message"
        }
        
    Status Codes:
        - 200: Upload successful
        - 400: Bad request (no file, invalid file type, file too large)
        - 401: Unauthorized (missing or invalid token)
        - 404: Candidate not found
        - 500: Server error (Supabase or database error)
        
    Processing Logic:
        1. Verify candidate authentication
        2. Validate file presence and type
        3. Upload to Supabase storage
        4. Save URL and metadata in database
        5. Return success with file URL
    """
    try:
        # Verify candidate authentication
        candidate_id, error_response = verify_candidate_token()
        if error_response:
            return error_response
        
        # Check if file is present
        if 'resume' not in request.files:
            return jsonify({
                'success': False,
                'message': 'No file provided'
            }), 400
        
        file = request.files['resume']
        
        if file.filename == '':
            return jsonify({
                'success': False,
                'message': 'No file selected'
            }), 400
        
        # Validate file type (PDF only)
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({
                'success': False,
                'message': 'Only PDF files are allowed'
            }), 400
        
        # Check file size (5MB max)
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > 5 * 1024 * 1024:  # 5MB
            return jsonify({
                'success': False,
                'message': 'File size must be less than 5MB'
            }), 400
        
        # Initialize Supabase client
        supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
        
        # Generate unique filename
        original_filename = file.filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_filename = f"resume_{candidate_id}_{timestamp}.pdf"
        
        # Upload to Supabase storage
        try:
            file_data = file.read()
            
            response = supabase.storage.from_(Config.SUPABASE_BUCKET).upload(
                path=unique_filename,
                file=file_data,
                file_options={"content-type": "application/pdf"}
            )
            
            # Get public URL
            public_url = supabase.storage.from_(Config.SUPABASE_BUCKET).get_public_url(unique_filename)
            
        except Exception as e:
            print(f"\n❌ SUPABASE UPLOAD ERROR: {str(e)}")
            return jsonify({
                'success': False,
                'message': f'Failed to upload to storage: {str(e)}'
            }), 500
        
        # Update candidate record in database
        try:
            candidate = CandidateAuthModel.query.get(candidate_id)
            
            if not candidate:
                return jsonify({
                    'success': False,
                    'message': 'Candidate not found'
                }), 404
            
            candidate.resume_url = public_url
            candidate.resume_filename = original_filename
            candidate.resume_uploaded_at = datetime.now()
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Resume uploaded successfully',
                'resume_url': public_url,
                'filename': original_filename
            }), 200
            
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ DATABASE ERROR: {str(e)}")
            return jsonify({
                'success': False,
                'message': f'Database error: {str(e)}'
            }), 500
            
    except Exception as e:
        import traceback
        print(f"\n❌ RESUME UPLOAD ERROR: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500


@Resume.route('/delete', methods=['DELETE'])
def delete_resume():
    """
    DELETE RESUME ENDPOINT
    
    Deletes candidate resume from database (keeps file in Supabase for history).
    
    Authentication: Required (JWT Bearer token - candidate only)
    
    Request:
        - Method: DELETE
        - Headers: Authorization: Bearer <token>
        
    Response:
        Success (200):
        {
            "success": true,
            "message": "Resume deleted successfully"
        }
        
        Error (401/404/500):
        {
            "success": false,
            "message": "Error message"
        }
        
    Status Codes:
        - 200: Deletion successful
        - 401: Unauthorized (missing or invalid token)
        - 404: Candidate not found or no resume uploaded
        - 500: Server error (database error)
        
    Processing Logic:
        1. Verify candidate authentication
        2. Find candidate record
        3. Clear resume fields in database
        4. Return success (file remains in Supabase for audit)
    """
    try:
        # Verify candidate authentication
        candidate_id, error_response = verify_candidate_token()
        if error_response:
            return error_response
        
        # Get candidate record
        candidate = CandidateAuthModel.query.get(candidate_id)
        
        if not candidate:
            return jsonify({
                'success': False,
                'message': 'Candidate not found'
            }), 404
        
        if not candidate.resume_url:
            return jsonify({
                'success': False,
                'message': 'No resume found to delete'
            }), 404
        
        # Clear resume fields (keep file in Supabase for history/audit)
        candidate.resume_url = None
        candidate.resume_filename = None
        candidate.resume_uploaded_at = None
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Resume deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"\n❌ RESUME DELETE ERROR: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500
