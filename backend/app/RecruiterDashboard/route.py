"""
RecruiterDashboard Routes
Handles all recruiter dashboard operations
"""

from flask import request, jsonify
from . import RecruiterDashboard
from ..models import CandidateAuth, MCQQuestion, MCQAnswer, EvaluationCriteria, ProctorSession, MCQResult, PsychometricResult, TextAssessmentResult, CandidateRationale, CodingAssessmentResult
from ..extensions import db
from ..config import Config
from ..auth_helpers import verify_recruiter_token
import jwt
import pandas as pd
import io
from services.AI_rationale import process_ai_rationale


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
        
        # Delete all existing MCQ data before inserting new questions
        # Order matters: delete answers first, then results, then questions
        try:
            # Delete all MCQ answers first (they reference questions)
            answers_deleted = MCQAnswer.query.delete()
            print(f"\n✅ Deleted {answers_deleted} existing MCQ answers")
            
            # Delete all MCQ results (they don't reference questions directly, but become meaningless)
            results_deleted = MCQResult.query.delete()
            print(f"✅ Deleted {results_deleted} existing MCQ results")
            
            # Now safe to delete questions
            questions_deleted = MCQQuestion.query.delete()
            print(f"✅ Deleted {questions_deleted} existing MCQ questions")
            
            db.session.commit()
            print(f"✅ Successfully cleared all existing MCQ data")
        except Exception as e:
            db.session.rollback()
            return jsonify({
                'success': False,
                'message': f'Error deleting existing data: {str(e)}'
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


#====================== CANDIDATE LIST AND DETAILS ENDPOINTS ============================

@RecruiterDashboard.route('/candidates', methods=['GET'])
def get_candidates():
    """
    GET ALL CANDIDATES ENDPOINT
    
    Retrieves list of all candidates with calculated scores and status.
    Scores are calculated based on recruiter's evaluation criteria.
    
    Authentication: Required (JWT Bearer token - recruiter only)
    
    Response:
        {
            "success": true,
            "candidates": [
                {
                    "id": <candidate_id>,
                    "email": "<email>",
                    "name": "<name or email>",
                    "role": "Candidate",
                    "technical_score": <0-100>,
                    "soft_skill_score": <0-100>,
                    "fairplay_score": <0-100>,
                    "overall_score": <weighted average>,
                    "status": "High Match|Potential|Reject",
                    "mcq_completed": true/false,
                    "psychometric_completed": true/false,
                    "technical_completed": true/false,
                    "text_based_completed": true/false
                }
            ],
            "stats": {
                "total_candidates": <count>,
                "assessments_completed": <count>,
                "high_match": <count>,
                "potential": <count>,
                "reject": <count>
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
        from ..models import MCQResult, PsychometricResult, ProctoringViolation, TextAssessmentResult, TextBasedAnswer
        
        # Get recruiter's evaluation criteria (or use defaults)
        criteria = EvaluationCriteria.query.filter_by(recruiter_id=recruiter_id).first()
        if not criteria:
            # Use default weights
            tech_weight = 37.5
            psycho_weight = 25.0
            soft_weight = 25.0
            fair_weight = 12.5
        else:
            tech_weight = criteria.technical_skill
            psycho_weight = criteria.psychometric_assessment
            soft_weight = criteria.soft_skill
            fair_weight = criteria.fairplay
        
        # Get all candidates
        candidates = CandidateAuth.query.all()
        
        candidates_data = []
        stats = {
            'total_candidates': len(candidates),
            'assessments_completed': 0,
            'high_match': 0,
            'potential': 0,
            'reject': 0
        }
        
        for candidate in candidates:
            # Calculate technical score (from MCQ + Coding in future)
            mcq_result = MCQResult.query.filter_by(student_id=candidate.id).first()
            technical_score = mcq_result.percentage_correct if mcq_result else 0
            
            # Calculate soft skill score (from Text Assessment)
            # Fetch from TextAssessmentResult instead of Psychometric
            text_result = db.session.query(TextAssessmentResult).filter_by(candidate_id=candidate.id).first()
            if text_result and text_result.grading_json:
                # Expecting 'communication_score' or 'score' in grading_json
                soft_skill_score = text_result.grading_json.get('communication_score', 0)
            else:
                soft_skill_score = 0
                
            # Psychometric is NOT included in overall score anymore
            
            # Calculate fairplay score (from Proctoring Violations)
            # Query for the most recent COMPLETED session that has violation data
            sessions = ProctorSession.query.filter_by(
                candidate_id=candidate.id,
                status='completed'
            ).order_by(ProctorSession.start_time.desc()).all()
            
            session = None
            # Find the most recent session with actual violation data
            for s in sessions:
                if s.violation_counts and isinstance(s.violation_counts, dict):
                    events = s.violation_counts.get('events', [])
                    total_count = s.violation_counts.get('total_count', 0)
                    if events or total_count > 0:
                        session = s
                        break
            
            # If no session with violations found, use the most recent one anyway
            if not session and sessions:
                session = sessions[0]
            
            fairplay_score = 100  # Start with perfect score
            
            if session and session.violation_counts:
                raw_data = session.violation_counts
                if "summary" in raw_data:
                    counts = raw_data["summary"]
                else:
                    counts = raw_data
                    
                # Deduct points based on counts from JSON
                # Weights: Phone/Face (High) = -15, Tab/Look (Medium) = -8
                
                # High Severity
                fairplay_score -= (counts.get('phone_detected', 0) * 15)
                fairplay_score -= (counts.get('multiple_faces', 0) * 15)
                fairplay_score -= (counts.get('no_face', 0) * 15)
                
                # Medium Severity
                fairplay_score -= (counts.get('tab_switch', 0) * 8)
                fairplay_score -= (counts.get('looking_away', 0) * 8)
                
            fairplay_score = max(0, fairplay_score)  # Don't go below 0
            
            # Check if at least one assessment is completed
            has_taken_test = candidate.mcq_completed or candidate.psychometric_completed or candidate.technical_completed or candidate.text_based_completed
            
            if has_taken_test:
                stats['assessments_completed'] += 1
            
            # Calculate overall weighted score only if tests have been taken
            # New weights: Technical 50%, Soft Skills 30%, Fairplay 20% (approx, or use criteria if available but adapted)
            # Ignoring old criteria weights for now to enforce new logic as requested
            
            if has_taken_test:
                # specific user request: "technical skills based on mcq... soft skills based on text answers... psychometric shouldn't be considered"
                # We will use fixed weights for now to ensure consistency with the request
                tech_weight = 50
                soft_weight = 30
                fair_weight = 20
                
                overall_score = (
                    (technical_score * tech_weight / 100) +
                    (soft_skill_score * soft_weight / 100) +
                    (fairplay_score * fair_weight / 100)
                )
                
                # Determine status based on overall score
                if overall_score >= 75:
                    status = 'High Match'
                    stats['high_match'] += 1
                elif overall_score >= 50:
                    status = 'Potential'
                    stats['potential'] += 1
                else:
                    status = 'Reject'
                    stats['reject'] += 1
            else:
                # No test taken yet
                overall_score = 0
                status = 'Not Tested'
            
            # Calculate last activity timestamp for sorting
            timestamps = [
                candidate.resume_uploaded_at,
                candidate.mcq_completed_at,
                candidate.psychometric_completed_at,
                candidate.technical_completed_at,
                candidate.text_based_completed_at,
                candidate.coding_completed_at
            ]
            valid_timestamps = [ts for ts in timestamps if ts is not None]
            last_active = max(valid_timestamps) if valid_timestamps else None

            candidates_data.append({
                'id': candidate.id,
                'email': candidate.email,
                'name': candidate.email.split('@')[0].title(),  # Use email username as name
                'role': 'Candidate',  # Default role
                'technical_score': round(technical_score, 2) if has_taken_test else None,
                'soft_skill_score': round(soft_skill_score, 2) if has_taken_test else None,
                'fairplay_score': round(fairplay_score, 2) if has_taken_test else None,
                'overall_score': round(overall_score, 2) if has_taken_test else None,
                'status': status,
                'has_taken_test': has_taken_test,
                'last_active': last_active.isoformat() if last_active else None,
                'mcq_completed': candidate.mcq_completed,
                'psychometric_completed': candidate.psychometric_completed,
                'technical_completed': candidate.technical_completed,
                'text_based_completed': candidate.text_based_completed
            })
        
        # Sort candidates by last_active descending (most recent first)
        # Handle None values by treating them as oldest
        candidates_data.sort(key=lambda x: x['last_active'] or "1970-01-01", reverse=True)
        
        return jsonify({
            'success': True,
            'candidates': candidates_data,
            'stats': stats
        }), 200
        
    except Exception as e:
        import traceback
        print(f"\n❌ GET CANDIDATES ERROR: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500


@RecruiterDashboard.route('/candidates/<int:candidate_id>', methods=['GET'])
def get_candidate_detail(candidate_id):
    """
    GET CANDIDATE DETAIL ENDPOINT
    
    Retrieves detailed information for a specific candidate including:
    - Basic info and scores
    - MCQ results breakdown
    - Psychometric assessment (Big Five traits)
    - Text-based answers
    - Proctoring violation logs
    - AI rationale (if available)
    
    Authentication: Required (JWT Bearer token - recruiter only)
    
    Response:
        {
            "success": true,
            "candidate": {
                "id": <candidate_id>,
                "email": "<email>",
                "name": "<name>",
                "role": "Candidate",
                "technical_score": <0-100>,
                "soft_skill_score": <0-100>,
                "fairplay_score": <0-100>,
                "overall_score": <weighted average>,
                "status": "High Match|Potential|Reject",
                "verdict": "Hire|No-Hire",
                "applied_date": "<date>",
                "mcq_result": {
                    "correct_answers": <count>,
                    "wrong_answers": <count>,
                    "percentage_correct": <percentage>
                },
                "psychometric_result": {
                    "extraversion": <0-100>,
                    "agreeableness": <0-100>,
                    "conscientiousness": <0-100>,
                    "emotional_stability": <0-100>,
                    "intellect_imagination": <0-100>
                },
                "text_answers": [
                    {"question_id": <id>, "answer": "<text>", "word_count": <count>}
                ],
                "integrity_logs": [
                    {"timestamp": "<time>", "event": "<description>", "severity": "low|medium|high"}
                ],
                "ai_rationale": "<AI generated rationale or default message>"
            }
        }
        
    Status Codes:
        - 200: Success
        - 404: Candidate not found
        - 401: Unauthorized
        - 403: Forbidden (not a recruiter)
        - 500: Server error
    """
    # Verify recruiter authentication
    recruiter_id, error = verify_recruiter_token()
    if error:
        return error
    
    try:
        from ..models import MCQResult, PsychometricResult, TextBasedAnswer, ProctoringViolation, TextAssessmentResult, CandidateRationale, ProctorSession
        
        # Get candidate
        candidate = CandidateAuth.query.get(candidate_id)
        if not candidate:
            return jsonify({
                'success': False,
                'message': 'Candidate not found'
            }), 404
        
        # Get recruiter's evaluation criteria
        criteria = EvaluationCriteria.query.filter_by(recruiter_id=recruiter_id).first()
        if not criteria:
            tech_weight = 37.5
            psycho_weight = 25.0
            soft_weight = 25.0
            fair_weight = 12.5
        else:
            tech_weight = criteria.technical_skill
            psycho_weight = criteria.psychometric_assessment
            soft_weight = criteria.soft_skill
            fair_weight = criteria.fairplay
        
        # Get MCQ results
        mcq_result = MCQResult.query.filter_by(student_id=candidate.id).first()
        technical_score = mcq_result.percentage_correct if mcq_result else 0
        mcq_data = mcq_result.to_dict() if mcq_result else {
            'correct_answers': 0,
            'wrong_answers': 0,
            'percentage_correct': 0
        }
        
        # Get Psychometric results (Do NOT include in overall score, display as /5)
        psycho_result = PsychometricResult.query.filter_by(student_id=candidate.id).first()
        if psycho_result:
            # Big Five traits are in DB as 0-50 (based on models.py comment/usage)
            # User wants display out of 5. So divide by 10.
            psycho_data = {
                'extraversion': round(psycho_result.extraversion / 10, 1),
                'agreeableness': round(psycho_result.agreeableness / 10, 1),
                'conscientiousness': round(psycho_result.conscientiousness / 10, 1),
                'emotional_stability': round(psycho_result.emotional_stability / 10, 1),
                'intellect_imagination': round(psycho_result.intellect_imagination / 10, 1)
            }
        else:
            psycho_data = {
                'extraversion': 0, 'agreeableness': 0, 'conscientiousness': 0,
                'emotional_stability': 0, 'intellect_imagination': 0
            }
        
        # Get Text-based answers
        text_answers = TextBasedAnswer.query.filter_by(student_id=candidate.id).all()
        text_answers_data = [answer.to_dict() for answer in text_answers]
        
        # Calculate Soft Skill Score from Text Assessment Results
        text_result = db.session.query(TextAssessmentResult).filter_by(candidate_id=candidate.id).first()
        if text_result and text_result.grading_json:
            # Try to get communication_score directly (new format)
            soft_skill_score = text_result.grading_json.get('communication_score', None)
            
            # Fallback: if only 'remark' exists (old format), give a base score
            if soft_skill_score is None:
                if 'remark' in text_result.grading_json and text_result.grading_json['remark']:
                    soft_skill_score = 50  # Default mid-score for old data that was graded
                else:
                    soft_skill_score = 0
        else:
            # No grading yet - check if answers exist
            answer_count = TextBasedAnswer.query.filter_by(student_id=candidate.id).count()
            if answer_count > 0:
                # Has answers but not graded yet - give partial credit
                soft_skill_score = 40  # Submitted but not graded
            else:
                soft_skill_score = 0
        
        # Get Proctoring violations from ProctorSession.violation_counts JSON
        # Query for the most recent COMPLETED session that has violation data
        sessions = ProctorSession.query.filter_by(
            candidate_id=candidate.id,
            status='completed'
        ).order_by(ProctorSession.start_time.desc()).all()
        
        session = None
        # Find the most recent session with actual violation data
        for s in sessions:
            if s.violation_counts and isinstance(s.violation_counts, dict):
                events = s.violation_counts.get('events', [])
                total_count = s.violation_counts.get('total_count', 0)
                if events or total_count > 0:
                    session = s
                    break
        
        # If no session with violations found, use the most recent one anyway
        if not session and sessions:
            session = sessions[0]
        
        fairplay_score = 100
        integrity_logs = []
        integrity_status = "Clean"  # Clean, Moderate, Severe
        
        if session and session.violation_counts:
            raw_data = session.violation_counts
            
            # Ensure raw_data is a dict (handle if it's a string)
            if isinstance(raw_data, str):
                import json
                try:
                    raw_data = json.loads(raw_data)
                except:
                    raw_data = {}
            
            # Get summary counts for fairplay score calculation
            if "summary" in raw_data:
                counts = raw_data["summary"]
            else:
                counts = raw_data
            
            # Extract violation counts
            no_face = counts.get('no_face', 0)
            multiple_faces = counts.get('multiple_faces', 0)
            mouse_exit = counts.get('mouse_exit', 0)
            tab_switch = counts.get('tab_switch', 0)
            looking_away = counts.get('looking_away', 0)
            phone_detected = counts.get('phone_detected', 0)
            print_screen = counts.get('print_screen', 0)
            copy_paste = counts.get('copy_paste', 0)
            
            # ==========================================
            # INTEGRITY SCORING FORMULA v1.0
            # ==========================================
            # 
            # SEVERITY THRESHOLDS:
            # - SEVERE (Auto-Flag, Major Deduction):
            #     * Multiple Faces >= 2
            #     * No Face >= 15 (camera not capturing face for extended period)
            #     * Phone Detected >= 1 (any phone = serious cheating attempt)
            #     * Print Screen >= 2 (attempt to capture questions)
            # 
            # - MODERATE (Warning, Medium Deduction):
            #     * No Face 10-14
            #     * Mouse Exit >= 10
            #     * Tab Switch >= 5
            #     * Copy/Paste >= 3
            # 
            # - LIGHT (Minor, Small Deduction):
            #     * Looking Away >= 10
            #     * Mouse Exit 1-9
            #     * Tab Switch 1-4
            #
            # FORMULA:
            # Base Score = 100
            # Deductions:
            #   SEVERE events: -25 per category triggered
            #   MODERATE events: -15 per category triggered  
            #   LIGHT events: -5 per category triggered
            #   + Per-instance penalties for high volume
            # ==========================================
            
            severe_flags = 0
            moderate_flags = 0
            light_flags = 0
            
            # Check SEVERE conditions
            if multiple_faces >= 2:
                severe_flags += 1
            if no_face >= 15:
                severe_flags += 1
            if phone_detected >= 1:
                severe_flags += 1
            if print_screen >= 2:
                severe_flags += 1
            
            # Check MODERATE conditions
            if 10 <= no_face < 15:
                moderate_flags += 1
            if mouse_exit >= 10:
                moderate_flags += 1
            if tab_switch >= 5:
                moderate_flags += 1
            if copy_paste >= 3:
                moderate_flags += 1
            if 1 <= multiple_faces < 2:  # 1 occurrence is moderate
                moderate_flags += 1
            
            # Check LIGHT conditions
            if looking_away >= 10:
                light_flags += 1
            if 1 <= mouse_exit < 10:
                light_flags += 1
            if 1 <= tab_switch < 5:
                light_flags += 1
            if 1 <= no_face < 10:
                light_flags += 1
            
            # Apply deductions
            fairplay_score -= (severe_flags * 25)
            fairplay_score -= (moderate_flags * 15)
            fairplay_score -= (light_flags * 5)
            
            # Additional per-instance penalties for high volumes
            # (to differentiate between barely crossing threshold vs. extreme violation)
            if no_face > 15:
                fairplay_score -= (no_face - 15) * 2  # -2 per extra no_face beyond 15
            if mouse_exit > 10:
                fairplay_score -= (mouse_exit - 10) * 1  # -1 per extra mouse_exit beyond 10
            if tab_switch > 5:
                fairplay_score -= (tab_switch - 5) * 2  # -2 per extra tab_switch beyond 5
            
            # Determine overall status
            if severe_flags > 0:
                integrity_status = "Severe"
            elif moderate_flags > 0:
                integrity_status = "Moderate"
            elif light_flags > 0:
                integrity_status = "Light"
            else:
                integrity_status = "Clean"
            
            # Get events list for integrity logs display
            events = raw_data.get("events", [])
            
            # Dynamic severity based on thresholds (not just event type)
            for evt in events:
                etype = evt.get('type', 'unknown')
                ts_str = evt.get('timestamp', '')
                
                # Format timestamp for display
                try:
                    from datetime import datetime
                    ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                    formatted_ts = ts.strftime('%I:%M %p')
                except:
                    formatted_ts = ts_str[:8] if ts_str else 'N/A'
                
                # Assign severity based on event type and thresholds
                if etype in ['phone_detected', 'print_screen']:
                    evt_severity = 'high'
                elif etype == 'multiple_faces':
                    evt_severity = 'high' if multiple_faces >= 2 else 'medium'
                elif etype == 'no_face':
                    evt_severity = 'high' if no_face >= 15 else ('medium' if no_face >= 10 else 'low')
                elif etype in ['tab_switch', 'copy_paste']:
                    evt_severity = 'medium'
                else:
                    evt_severity = 'low'
                
                integrity_logs.append({
                    'timestamp': formatted_ts,
                    'event': etype.replace('_', ' ').title(),
                    'severity': evt_severity
                })
                
        fairplay_score = max(0, min(100, fairplay_score))  # Clamp between 0-100
        
        # Calculate overall score (Technical 50%, Soft 30%, Fairplay 20%)
        # Psychometric is excluded
        tech_weight = 50
        soft_weight = 30
        fair_weight = 20
        
        overall_score = (
            (technical_score * tech_weight / 100) +
            (soft_skill_score * soft_weight / 100) +
            (fairplay_score * fair_weight / 100)
        )
        
        # Determine status and verdict
        if overall_score >= 75:
            status = 'High Match'
            verdict = 'Hire'
        elif overall_score >= 50:
            status = 'Potential'
            verdict = 'No-Hire'
        else:
            status = 'Reject'
            verdict = 'No-Hire'
        
        # Generate AI rationale (placeholder - can be enhanced with actual AI service)
        # Try to get AI Rationale from DB first
        rationale_record = CandidateRationale.query.filter_by(candidate_id=candidate.id).first()
        ai_rationale = ""
        
        if rationale_record and rationale_record.rationale_json:
            # Format the JSON into a readable string for the frontend
            r_json = rationale_record.rationale_json
            
            # Construct summary
            if 'final_decision' in r_json and 'summary' in r_json['final_decision']:
                 ai_rationale += f"{r_json['final_decision']['summary']}\n\n"
                 
            # Add Psychometric Insight if available (and specifically requested "neat paragraph")
            if 'psychometric_evaluation' in r_json and 'reasoning' in r_json['psychometric_evaluation']:
                ai_rationale += f"Psychometric Analysis: {r_json['psychometric_evaluation']['reasoning']}\n\n"
                
            # Add Technical/Soft Skill quick notes if not covered
            if 'technical_evaluation' in r_json:
                ai_rationale += f"Technical: {r_json['technical_evaluation'].get('grade', 'N/A')}. "
            if 'soft_skills_evaluation' in r_json:
                ai_rationale += f"Soft Skills: {r_json['soft_skills_evaluation'].get('grade', 'N/A')}."
                
        else:
            # Fallback to placeholder if no AI generation exists yet
            if verdict == 'Hire':
                ai_rationale = f"Candidate {candidate.email} demonstrates strong performance across all assessment categories. "
                ai_rationale += f"Technical proficiency score of {round(technical_score, 1)}% indicates solid problem-solving capabilities. "
                if soft_skill_score >= 70:
                    ai_rationale += f"Psychometric assessment reveals excellent interpersonal skills and cultural fit. "
                if fairplay_score >= 90:
                    ai_rationale += "Assessment integrity was maintained throughout, indicating strong ethical standards. "
                ai_rationale += "Recommended for immediate consideration."
            else:
                ai_rationale = f"Candidate {candidate.email} shows areas requiring improvement. "
                if technical_score < 60:
                    ai_rationale += "Technical assessment score suggests need for additional skill development. "
                if soft_skill_score < 60:
                    ai_rationale += "Psychometric evaluation indicates potential challenges with team dynamics or role fit. "
                if fairplay_score < 80:
                    ai_rationale += "Multiple integrity concerns were flagged during assessment. "
                ai_rationale += "Consider for future opportunities after further development."
        
        candidate_data = {
            'id': candidate.id,
            'email': candidate.email,
            'name': candidate.email.split('@')[0].title(),
            'role': 'Candidate',
            'technical_score': round(technical_score, 2),
            'soft_skill_score': round(soft_skill_score, 2),
            'fairplay_score': round(fairplay_score, 2),
            'overall_score': round(overall_score, 2),
            'status': status,
            'verdict': verdict,
            'applied_date': candidate.mcq_completed_at.strftime('%Y-%m-%d') if candidate.mcq_completed_at else 'N/A',
            'mcq_result': mcq_data,
            'psychometric_result': psycho_data,
            'text_answers': text_answers_data,
            'integrity_logs': integrity_logs,
            'ai_rationale': ai_rationale
        }
        
        return jsonify({
            'success': True,
            'candidate': candidate_data
        }), 200
        
    except Exception as e:
        import traceback
        print(f"\n❌ GET CANDIDATE DETAIL ERROR: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500


@RecruiterDashboard.route('/candidates/<int:candidate_id>/analyze', methods=['POST'])
def analyze_candidate(candidate_id):
    """
    TRIGGER AI ANALYSIS ENDPOINT
    
    Manually triggers the AI Rationale generation for a specific candidate.
    Useful for refreshing analysis or generating it if it failed/was skipped.
    
    Authentication: Required (JWT Bearer token - recruiter only)
    
    Response:
        {
            "success": true,
            "message": "AI Analysis generated successfully",
            "rationale": { <JSON object from AI> }
        }
    """
    # Verify recruiter authentication
    recruiter_id, error = verify_recruiter_token()
    if error:
        return error
        
    try:
        from flask import current_app
        
        # Check if candidate exists
        candidate = CandidateAuth.query.get(candidate_id)
        if not candidate:
            return jsonify({
                'success': False,
                'message': 'Candidate not found'
            }), 404
            
        # Trigger analysis
        # We pass the current app context to the service function
        rationale_result = process_ai_rationale(candidate_id, app_instance=current_app._get_current_object())
        
        if not rationale_result:
             return jsonify({
                'success': False,
                'message': 'Failed to generate analysis'
            }), 500
            
        return jsonify({
            'success': True,
            'message': 'AI Analysis generated successfully',
            'rationale': rationale_result
        }), 200
        
    except Exception as e:
        import traceback
        print(f"\n❌ ANALYZE CANDIDATE ERROR: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500
