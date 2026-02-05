"""
RecruiterDashboard Routes
Handles all recruiter dashboard operations
"""

from flask import request, jsonify
from . import RecruiterDashboard
from ..models import CandidateAuth, MCQQuestion, EvaluationCriteria
from ..extensions import db
from ..config import Config
from ..auth_helpers import verify_recruiter_token
import jwt
import pandas as pd
import io


@RecruiterDashboard.route('/candidates/upload', methods=['POST'])
def upload_candidates():
    """
    BULK CANDIDATE UPLOAD ENDPOINT
    
    Handles bulk upload of candidates from CSV or Excel files.
    Automatically hashes passwords before storing in database.
    
    Authentication: Required (JWT Bearer token - recruiter only)
    
    Request:
        - Method: POST
        - Content-Type: multipart/form-data
        - Field: 'file' (CSV/Excel file)
        - File must contain columns: 'email', 'password'
        
    Supported file formats:
        - CSV (.csv)
        - Excel (.xlsx, .xls)
        
    File constraints:
        - Maximum size: 10MB
        - Required columns: email, password
        
    Response:
        {
            "success": true/false,
            "message": "Status message",
            "results": {
                "total": <number of rows processed>,
                "created": <number of new candidates created>,
                "updated": <number of existing candidates updated>,
                "skipped": <number of rows skipped due to errors>,
                "errors": [<list of error messages>]
            }
        }
        
    Status Codes:
        - 200: Upload successful (even with partial errors)
        - 400: Bad request (missing file, invalid format, missing columns)
        - 401: Unauthorized (missing or invalid token)
        - 403: Forbidden (not a recruiter token)
        - 500: Server error (database error)
        
    Processing Logic:
        - For each row in the file:
            - If email exists: Update password (hashed)
            - If email doesn't exist: Create new candidate (password hashed)
            - If email/password missing: Skip row and log error
            
    Security:
        - Passwords are hashed using werkzeug.security.generate_password_hash()
        - Uses pbkdf2:sha256 algorithm
        - No plain text passwords are stored
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
        
        # Read file into pandas dataframe
        try:
            if file_ext == '.csv':
                df = pd.read_csv(io.BytesIO(file.read()))
            else:  # .xlsx or .xls
                df = pd.read_excel(io.BytesIO(file.read()))
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'Error reading file: {str(e)}'
            }), 400
        
        # Validate that required columns exist
        required_columns = ['email', 'password']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            return jsonify({
                'success': False,
                'message': f'Missing required columns: {", ".join(missing_columns)}'
            }), 400
        
        # Initialize results tracking
        results = {
            'total': len(df),
            'created': 0,
            'updated': 0,
            'skipped': 0,
            'errors': []
        }
        
        # Process each candidate row
        for index, row in df.iterrows():
            try:
                email = str(row['email']).strip()
                password = str(row['password']).strip()
                
                # Validate email is present
                if not email or email == 'nan':
                    results['skipped'] += 1
                    results['errors'].append(f"Row {index + 2}: Missing email")
                    continue
                
                # Validate password is present
                if not password or password == 'nan':
                    results['skipped'] += 1
                    results['errors'].append(f"Row {index + 2}: Missing password")
                    continue
                
                # Check if candidate already exists
                existing_candidate = CandidateAuth.query.filter_by(email=email).first()
                
                if existing_candidate:
                    # Update existing candidate's password (will be hashed)
                    existing_candidate.set_password(password)
                    results['updated'] += 1
                else:
                    # Create new candidate with hashed password
                    new_candidate = CandidateAuth(email=email)
                    new_candidate.set_password(password)  # Automatically hashes the password
                    db.session.add(new_candidate)
                    results['created'] += 1
                
            except Exception as e:
                results['skipped'] += 1
                results['errors'].append(f"Row {index + 2}: {str(e)}")
        
        # Commit all changes to database
        try:
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': f'Successfully processed {results["total"]} candidates',
                'results': results
            }), 200
            
        except Exception as e:
            db.session.rollback()
            return jsonify({
                'success': False,
                'message': f'Database error: {str(e)}',
                'results': results
            }), 500
            
    except Exception as e:
        import traceback
        print(f"\n❌ BULK UPLOAD ERROR: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500


@RecruiterDashboard.route('/mcq/upload', methods=['POST'])
def upload_mcq_questions():
    """
    MCQ QUESTIONS BULK UPLOAD ENDPOINT
    
    Uploads MCQ questions from CSV or Excel file.
    Required columns: question_id, question, option1, option2, option3, option4, correct_answer
    
    Authentication: Required (JWT Bearer token - recruiter only)
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
                'message': f'Invalid file type. Allowed: {", ".join(allowed_extensions)}'
            }), 400
        
        # Read file
        try:
            if file_ext == '.csv':
                df = pd.read_csv(io.BytesIO(file.read()))
            else:
                df = pd.read_excel(io.BytesIO(file.read()))
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'Error reading file: {str(e)}'
            }), 400
        
        # Validate required columns
        required_columns = ['question_id', 'question', 'option1', 'option2', 'option3', 'option4', 'correct_answer']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            return jsonify({
                'success': False,
                'message': f'Missing columns: {", ".join(missing_columns)}'
            }), 400
                # Delete all existing MCQ questions before inserting new ones
        # Note: MCQ doesn't have an answers table, candidate selections are stored in CandidateAuth.mcq_score
        try:
            deleted_count = MCQQuestion.query.delete()
            db.session.commit()
            print(f"\n✅ Deleted {deleted_count} existing MCQ questions")
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
                question_id = row.get('question_id')
                question = str(row.get('question', '')).strip()
                option1 = str(row.get('option1', '')).strip()
                option2 = str(row.get('option2', '')).strip()
                option3 = str(row.get('option3', '')).strip()
                option4 = str(row.get('option4', '')).strip()
                correct_answer = row.get('correct_answer')
                
                # Validate question_id
                if pd.isna(question_id):
                    results['skipped'] += 1
                    results['errors'].append(f"Row {index + 2}: Missing question_id")
                    continue
                
                try:
                    question_id = int(question_id)
                except (ValueError, TypeError):
                    results['skipped'] += 1
                    results['errors'].append(f"Row {index + 2}: Invalid question_id")
                    continue
                
                # Validate required fields
                if not question or question == 'nan':
                    results['skipped'] += 1
                    results['errors'].append(f"Row {index + 2}: Missing question")
                    continue
                
                for opt_num in range(1, 5):
                    opt = locals()[f'option{opt_num}']
                    if not opt or opt == 'nan':
                        results['skipped'] += 1
                        results['errors'].append(f"Row {index + 2}: Missing option{opt_num}")
                        continue
                
                # Validate correct_answer
                if pd.isna(correct_answer):
                    results['skipped'] += 1
                    results['errors'].append(f"Row {index + 2}: Missing correct_answer")
                    continue
                
                try:
                    correct_answer = int(correct_answer)
                    if correct_answer not in [1, 2, 3, 4]:
                        results['skipped'] += 1
                        results['errors'].append(f"Row {index + 2}: correct_answer must be 1, 2, 3, or 4")
                        continue
                except (ValueError, TypeError):
                    results['skipped'] += 1
                    results['errors'].append(f"Row {index + 2}: correct_answer must be a number")
                    continue
                
                # Check if question exists
                existing = MCQQuestion.query.filter_by(question_id=question_id).first()
                
                if existing:
                    # Update existing (shouldn't happen since we deleted all, but keep for safety)
                    existing.question = question
                    existing.option1 = option1
                    existing.option2 = option2
                    existing.option3 = option3
                    existing.option4 = option4
                    existing.correct_answer = correct_answer
                    results['updated'] += 1
                else:
                    # Create new
                    new_question = MCQQuestion(
                        question_id=question_id,
                        question=question,
                        option1=option1,
                        option2=option2,
                        option3=option3,
                        option4=option4,
                        correct_answer=correct_answer
                    )
                    db.session.add(new_question)
                    results['created'] += 1
                    
            except Exception as e:
                results['skipped'] += 1
                results['errors'].append(f"Row {index + 2}: {str(e)}")
        
        # Commit changes
        try:
            db.session.commit()
            return jsonify({
                'success': True,
                'message': f'Processed {results["total"]} questions',
                'results': results
            }), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({
                'success': False,
                'message': f'Database error: {str(e)}',
                'results': results
            }), 500
            
    except Exception as e:
        import traceback
        print(f"\n❌ MCQ UPLOAD ERROR: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500


#====================== EVALUATION CRITERIA ENDPOINTS ============================

@RecruiterDashboard.route('/evaluation-criteria', methods=['GET'])
def get_evaluation_criteria():
    """
    GET EVALUATION CRITERIA ENDPOINT
    
    Retrieves the evaluation criteria for the authenticated recruiter.
    If no custom criteria exists, returns default values.
    
    Authentication: Required (JWT Bearer token - recruiter only)
    
    Response:
        {
            "success": true,
            "criteria": {
                "id": <criteria_id>,
                "recruiter_id": <recruiter_id>,
                "technical_skill": 50.0,
                "psychometric_assessment": 15.0,
                "soft_skill": 15.0,
                "fairplay": 20.0,
                "is_default": true/false,
                "created_at": "ISO timestamp",
                "updated_at": "ISO timestamp"
            }
        }
        
    Status Codes:
        - 200: Success
        - 401: Unauthorized
        - 403: Forbidden (not a recruiter)
        - 500: Server error
    """
    # Verify recruiter authentication
    recruiter_id, error = verify_recruiter_token()
    if error:
        return error
    
    try:
        # Check if criteria exists for this recruiter
        criteria = EvaluationCriteria.query.filter_by(recruiter_id=recruiter_id).first()
        
        if not criteria:
            # Return default values if no custom criteria exists
            default_criteria = {
                'id': None,
                'recruiter_id': recruiter_id,
                'technical_skill': 37.5,
                'psychometric_assessment': 25.0,
                'soft_skill': 25.0,
                'fairplay': 12.5,
                'is_default': True,
                'created_at': None,
                'updated_at': None
            }
            return jsonify({
                'success': True,
                'criteria': default_criteria
            }), 200
        
        return jsonify({
            'success': True,
            'criteria': criteria.to_dict()
        }), 200
        
    except Exception as e:
        import traceback
        print(f"\n❌ GET EVALUATION CRITERIA ERROR: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500


@RecruiterDashboard.route('/evaluation-criteria', methods=['POST', 'PUT'])
def update_evaluation_criteria():
    """
    UPDATE EVALUATION CRITERIA ENDPOINT
    
    Creates or updates evaluation criteria for the authenticated recruiter.
    Validates that all percentages sum to 100%.
    
    Authentication: Required (JWT Bearer token - recruiter only)
    
    Request Body:
        {
            "technical_skill": 50.0,          // Required, percentage (0-100)
            "psychometric_assessment": 15.0,  // Required, percentage (0-100)
            "soft_skill": 15.0,               // Required, percentage (0-100)
            "fairplay": 20.0                  // Required, percentage (0-100)
        }
        
    Validation:
        - All percentages must be between 0 and 100
        - Sum of all percentages must equal 100
        
    Response:
        {
            "success": true,
            "message": "Evaluation criteria updated successfully",
            "criteria": {<criteria_object>}
        }
        
    Status Codes:
        - 200: Success
        - 400: Bad request (invalid data or percentages don't sum to 100)
        - 401: Unauthorized
        - 403: Forbidden (not a recruiter)
        - 500: Server error
    """
    # Verify recruiter authentication
    recruiter_id, error = verify_recruiter_token()
    if error:
        return error
    
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['technical_skill', 'psychometric_assessment', 'soft_skill', 'fairplay']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'message': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Extract and validate percentages
        technical_skill = float(data['technical_skill'])
        psychometric_assessment = float(data['psychometric_assessment'])
        soft_skill = float(data['soft_skill'])
        fairplay = float(data['fairplay'])
        
        # Validate ranges
        percentages = {
            'technical_skill': technical_skill,
            'psychometric_assessment': psychometric_assessment,
            'soft_skill': soft_skill,
            'fairplay': fairplay
        }
        
        for field, value in percentages.items():
            if value < 0 or value > 100:
                return jsonify({
                    'success': False,
                    'message': f'{field} must be between 0 and 100'
                }), 400
        
        # Validate that percentages sum to 100
        total = technical_skill + psychometric_assessment + soft_skill + fairplay
        if abs(total - 100.0) > 0.01:  # Allow for floating point precision
            return jsonify({
                'success': False,
                'message': f'Percentages must sum to 100. Current sum: {total}'
            }), 400
        
        # Check if criteria already exists
        criteria = EvaluationCriteria.query.filter_by(recruiter_id=recruiter_id).first()
        
        if criteria:
            # Update existing criteria
            criteria.technical_skill = technical_skill
            criteria.psychometric_assessment = psychometric_assessment
            criteria.soft_skill = soft_skill
            criteria.fairplay = fairplay
            criteria.is_default = False
            message = 'Evaluation criteria updated successfully'
        else:
            # Create new criteria
            criteria = EvaluationCriteria(
                recruiter_id=recruiter_id,
                technical_skill=technical_skill,
                psychometric_assessment=psychometric_assessment,
                soft_skill=soft_skill,
                fairplay=fairplay,
                is_default=False
            )
            db.session.add(criteria)
            message = 'Evaluation criteria created successfully'
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': message,
            'criteria': criteria.to_dict()
        }), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': 'Invalid number format'
        }), 400
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"\n❌ UPDATE EVALUATION CRITERIA ERROR: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500


@RecruiterDashboard.route('/evaluation-criteria/reset', methods=['POST'])
def reset_evaluation_criteria():
    """
    RESET EVALUATION CRITERIA ENDPOINT
    
    Resets evaluation criteria to default recommended values (Ratio 1.5:1:1:0.5):
    - Technical Skill: 37.5%
    - Psychometric Assessment: 25%
    - Soft Skill: 25%
    - Fairplay: 12.5%
    
    Authentication: Required (JWT Bearer token - recruiter only)
    
    Response:
        {
            "success": true,
            "message": "Evaluation criteria reset to defaults",
            "criteria": {<criteria_object>}
        }
        
    Status Codes:
        - 200: Success
        - 401: Unauthorized
        - 403: Forbidden (not a recruiter)
        - 500: Server error
    """
    # Verify recruiter authentication
    recruiter_id, error = verify_recruiter_token()
    if error:
        return error
    
    try:
        # Check if criteria exists
        criteria = EvaluationCriteria.query.filter_by(recruiter_id=recruiter_id).first()
        
        if criteria:
            # Update to default values
            criteria.technical_skill = 37.5
            criteria.psychometric_assessment = 25.0
            criteria.soft_skill = 25.0
            criteria.fairplay = 12.5
            criteria.is_default = True
        else:
            # Create with default values
            criteria = EvaluationCriteria(
                recruiter_id=recruiter_id,
                technical_skill=37.5,
                psychometric_assessment=25.0,
                soft_skill=25.0,
                fairplay=12.5,
                is_default=True
            )
            db.session.add(criteria)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Evaluation criteria reset to defaults',
            'criteria': criteria.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"\n❌ RESET EVALUATION CRITERIA ERROR: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500
