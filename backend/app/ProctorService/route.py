from flask import request, jsonify
from . import ProctorService
from ..models import CandidateAuth, ProctoringViolation, ProctorSession
from ..extensions import db
from ..config import Config
import jwt
from datetime import datetime
import json

# ANSI color codes for console output
class Colors:
    RED = '\033[91m'
    YELLOW = '\033[93m'
    GREEN = '\033[92m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

def log_proctor_event(event_type, session_id, user_id, details=None):
    """Log proctor events to console with color formatting."""
    timestamp = datetime.now().strftime('%H:%M:%S')
    
    # Determine color based on severity
    if event_type in ['multiple_faces', 'no_face', 'phone_detected']:
        color = Colors.RED
        severity = 'CRITICAL'
    elif event_type in ['looking_away', 'tab_switch']:
        color = Colors.YELLOW
        severity = 'WARNING'
    else:
        color = Colors.CYAN
        severity = 'INFO'
    
    print(f"\n{color}{Colors.BOLD}" + "="*60 + f"{Colors.END}")
    print(f"{color}{Colors.BOLD}[PROCTOR {severity}] {timestamp}{Colors.END}")
    print(f"{color}  Session: {session_id} | User: {user_id}{Colors.END}")
    print(f"{color}  Event: {event_type.upper()}{Colors.END}")
    if details:
        print(f"{color}  Details: {details}{Colors.END}")
    print(f"{color}{Colors.BOLD}" + "="*60 + f"{Colors.END}\n")

def verify_candidate_token():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=['HS256'])
        return payload.get('user_id')
    except:
        return None

@ProctorService.route('/session/start', methods=['POST'])
def start_session():
    try:
        user_id = verify_candidate_token()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
            
        data = request.json or {}
        assessment_id = data.get('assessment_id')
        
        # Generate simple session ID (timestamp + user_id)
        import uuid
        session_uuid = str(uuid.uuid4())
        
        # Create new session record
        session = ProctorSession(
            candidate_id=user_id,
            assessment_id=assessment_id,
            session_uuid=session_uuid,
            status='active'
        )
        db.session.add(session)
        db.session.commit()
        
        print(f"[PROCTOR] Session started: {session_uuid} for user {user_id}")
        
        return jsonify({
            'success': True,
            'session_id': session_uuid,
            'message': 'Proctoring session started'
        })
    except Exception as e:
        import traceback
        print(f"[PROCTOR ERROR] Failed to start session: {str(e)}")
        traceback.print_exc()
        db.session.rollback()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@ProctorService.route('/session/end', methods=['POST'])
def end_session():
    try:
        user_id = verify_candidate_token()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
            
        # Find active session for this user
        session = ProctorSession.query.filter_by(
            candidate_id=user_id,
            status='active'
        ).order_by(ProctorSession.start_time.desc()).first()
        
        if not session:
            # If no active session, just return success (idempotent)
            return jsonify({'success': True, 'message': 'No active session found'})
            
        # Get violation events and counts from payload
        violation_events = request.json.get('violation_events', [])
        violation_counts_summary = request.json.get('violation_counts', {})
        
        # Verify it's a list (basic validation)
        if not isinstance(violation_events, list):
            violation_events = []

        # Update session with detailed events and counts
        session.violation_counts = {
            'events': violation_events,
            'summary': violation_counts_summary,
            'total_count': len(violation_events)
        }
        session.end_time = datetime.utcnow()
        session.status = 'completed'
        
        db.session.commit()
        
        print(f"[PROCTOR] Session ended: {session.session_uuid}. Total Events: {len(violation_events)}")
        
        return jsonify({
            'success': True,
            'total_events': len(violation_events),
            'events_stored': True
        })
    except Exception as e:
        import traceback
        print(f"[PROCTOR ERROR] Failed to end session: {str(e)}")
        traceback.print_exc()
        db.session.rollback()
        return jsonify({'error': 'Failed to end session'}), 500

@ProctorService.route('/log-event', methods=['POST'])
def log_event():
    user_id = verify_candidate_token()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json
    session_id = data.get('session_id')
    event_type = data.get('event_type')
    details = data.get('details')
    
    # Log to console for visibility
    log_proctor_event(event_type, session_id, user_id, details)
    
    # Use ProctoringViolation instead of ProctorEvent
    severity_map = {
        'multiple_faces': 'high',
        'no_face': 'high',
        'phone_detected': 'high',
        'looking_away': 'medium',
        'tab_switch': 'medium'
    }
    
    violation = ProctoringViolation(
        session_id=session_id,
        candidate_id=user_id,
        violation_type=event_type,
        violation_data={'details': details},
        severity=severity_map.get(event_type, 'low'),
        timestamp=datetime.utcnow()
    )
    db.session.add(violation)
    db.session.commit()
    
    return jsonify({'success': True})

@ProctorService.route('/log-violation', methods=['POST'])
def log_violation():
    """Log a proctoring violation for the current candidate"""
    user_id = verify_candidate_token()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json
    session_id = data.get('session_id')
    violation_type = data.get('violation_type')
    violation_data = data.get('violation_data', {})
    
    # Determine severity based on violation type
    severity_map = {
        'multiple_faces': 'high',
        'no_face': 'high',
        'phone_detected': 'high',
        'looking_away': 'medium',
        'tab_switch': 'medium'
    }
    severity = severity_map.get(violation_type, 'low')
    
    # Log to console for visibility
    log_proctor_event(violation_type, session_id, user_id, violation_data)
    
    # Save to database
    violation = ProctoringViolation(
        session_id=session_id,
        candidate_id=user_id,
        violation_type=violation_type,
        violation_data=violation_data,
        severity=severity,
        timestamp=datetime.utcnow()
    )
    db.session.add(violation)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'violation_id': violation.id
    })

@ProctorService.route('/analyze-frame', methods=['POST'])
def analyze_frame():
    user_id = verify_candidate_token()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json
    session_id = data.get('session_id')
    image_data = data.get('image')
    
    if not image_data:
        return jsonify({'error': 'No image data provided'}), 400

    # Call AI Service
    from ..services.ai_service import analyze_frame_with_llama
    result = analyze_frame_with_llama(image_data)
    
    # Auto-log if suspicious behavior detected
    if result.get('multiple_faces') or result.get('looking_away') or result.get('phone_detected') or not result.get('face_detected'):
        # Log event internally
        event_type = 'suspicious_behavior'
        if result.get('multiple_faces'): event_type = 'multiple_faces'
        elif not result.get('face_detected'): event_type = 'no_face'
        elif result.get('looking_away'): event_type = 'looking_away'
        
        # Log to console for visibility
        log_proctor_event(event_type, session_id, user_id, result)
        
        # Map severity
        severity_map = {
            'multiple_faces': 'high',
            'no_face': 'high',
            'phone_detected': 'high',
            'looking_away': 'medium'
        }
        
        violation = ProctoringViolation(
            session_id=session_id,
            candidate_id=user_id,
            violation_type=event_type,
            violation_data=result,
            severity=severity_map.get(event_type, 'medium'),
            timestamp=datetime.utcnow()
        )
        db.session.add(violation)
        db.session.commit()
    
    return jsonify({
        'success': True,
        'analysis': result
    })

@ProctorService.route('/session/<string:session_id>/summary', methods=['GET'])
def get_session_summary(session_id):
    """
    Get complete proctoring data for a session.
    This endpoint is designed for the EVALUATION ENGINE to access candidate behavior data.
    """
    # TODO: Add recruiter/admin auth check for production
    
    # Try finding by UUID first
    session = ProctorSession.query.filter_by(session_uuid=session_id).first()
    if not session:
        # Fallback to ID if integer
        if session_id.isdigit():
            session = ProctorSession.query.get(int(session_id))
            
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    
    # Get all violations for this session
    # Use the session_uuid if available, otherwise might need another way to link
    # But ProctoringViolation uses session_id string which should be the UUID
    search_id = session.session_uuid if session.session_uuid else str(session.id)
    events = ProctoringViolation.query.filter_by(session_id=search_id).order_by(ProctoringViolation.timestamp).all()
    
    # Count violations by type
    violation_counts = {}
    for event in events:
        violation_counts[event.violation_type] = violation_counts.get(event.violation_type, 0) + 1
    
    # Calculate risk score (simple algorithm for now)
    risk_score = 0
    risk_score += violation_counts.get('no_face', 0) * 10
    risk_score += violation_counts.get('multiple_faces', 0) * 25
    risk_score += violation_counts.get('looking_away', 0) * 5
    risk_score += violation_counts.get('tab_switch', 0) * 15
    risk_score += violation_counts.get('phone_detected', 0) * 20
    risk_score = min(risk_score, 100)  # Cap at 100
    
    return jsonify({
        'success': True,
        'session': {
            'id': session.id,
            'candidate_id': session.candidate_id,
            'assessment_id': session.assessment_id,
            'start_time': session.start_time.isoformat() if session.start_time else None,
            'end_time': session.end_time.isoformat() if session.end_time else None,
            'status': session.status,
            'duration_minutes': round((session.end_time - session.start_time).total_seconds() / 60, 2) if session.end_time and session.start_time else None
        },
        'violations': {
            'total_count': len(events),
            'by_type': violation_counts
        },
        'risk_score': risk_score,
        'events': [
            {
                'id': e.id,
                'type': e.violation_type,
                'severity': e.severity,
                'timestamp': e.timestamp.isoformat() if e.timestamp else None,
                'details': e.violation_data
            } for e in events
        ]
    })

@ProctorService.route('/candidate/<int:candidate_id>/sessions', methods=['GET'])
def get_candidate_sessions(candidate_id):
    """
    Get all proctoring sessions for a candidate.
    Useful for evaluation engine to aggregate behavior across assessments.
    """
    sessions = ProctorSession.query.filter_by(candidate_id=candidate_id).order_by(ProctorSession.start_time.desc()).all()
    
    result = []
    for session in sessions:
        # Create default count if no uuid
        event_count = 0
        if session.session_uuid:
            event_count = ProctoringViolation.query.filter_by(session_id=session.session_uuid).count()
        result.append({
            'id': session.id,
            'assessment_id': session.assessment_id,
            'start_time': session.start_time.isoformat() if session.start_time else None,
            'end_time': session.end_time.isoformat() if session.end_time else None,
            'status': session.status,
            'total_violations': event_count
        })
    
    return jsonify({
        'success': True,
        'candidate_id': candidate_id,
        'sessions': result
    })
