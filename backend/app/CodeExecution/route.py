from flask import Blueprint, request, jsonify
import requests

CodeExecution = Blueprint('CodeExecution', __name__)

# Piston API endpoint (free code execution service)
PISTON_API = "https://emkc.org/api/v2/piston"

# Language mapping for Piston
LANGUAGE_MAP = {
    'python': 'python',
    'javascript': 'javascript',
    'java': 'java',
    'cpp': 'c++',
    'c++': 'c++',
    'go': 'go',
    'rust': 'rust'
}

def verify_candidate_token():
    """Extract candidate ID from JWT token"""
    from ..config import Config
    import jwt
    
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=['HS256'])
        return payload.get('user_id')
    except:
        return None

@CodeExecution.route('/execute', methods=['POST'])
def execute_code():
    """Execute code using Piston API"""
    user_id = verify_candidate_token()
    if not user_id:
        return jsonify({'error': 'Unauthorized', 'success': False}), 401
    
    data = request.json
    code = data.get('code')
    language = data.get('language', 'python')
    stdin = data.get('stdin', '')
    
    if not code:
        return jsonify({'error': 'No code provided', 'success': False}), 400
    
    # Map language to Piston format
    piston_language = LANGUAGE_MAP.get(language.lower(), 'python')
    
    try:
        # Call Piston API
        piston_response = requests.post(
            f"{PISTON_API}/execute",
            json={
                "language": piston_language,
                "version": "*",  # Use latest version
                "files": [
                    {
                        "content": code
                    }
                ],
                "stdin": stdin
            },
            timeout=10
        )
        
        piston_data = piston_response.json()
        
        # Extract output
        run_data = piston_data.get('run', {})
        stdout = run_data.get('stdout', '')
        stderr = run_data.get('stderr', '')
        exit_code = run_data.get('code', 0)
        
        return jsonify({
            'success': True,
            'stdout': stdout,
            'stderr': stderr,
            'exit_code': exit_code,
            'language': piston_language
        })
        
    except requests.exceptions.Timeout:
        return jsonify({
            'error': 'Code execution timed out (10s limit)',
            'success': False
        }), 408
    except Exception as e:
        return jsonify({
            'error': f'Execution failed: {str(e)}',
            'success': False
        }), 500
