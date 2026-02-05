
import requests
import json
import sys
import os

BASE_URL = "http://localhost:5000"

def test_proctor_flow():
    # 1. Login (assuming we have a test candidate, or we might need to register one)
    # For simplicity, let's try to register a temporary user or just use a known one.
    # If registration is complex, I might need to look at auth routes.
    # Let's try to use a mock token or assume auth is disabled/bypassed for testing if possible?
    # No, the code checks `verify_candidate_token`.
    # I'll create a token manually using the secret from config if I can access it, or just use the login endpoint.
    
    # Check if we can import app context to generate token
    try:
        # Add backend to sys.path to import modules
        current_dir = os.getcwd()
        if os.path.exists(os.path.join(current_dir, 'backend')):
            sys.path.append(os.path.join(current_dir, 'backend'))
        
        # Try importing from app (assuming run.py or create_app exists)
        try:
            from run import app
        except ImportError:
            try:
                from backend.run import app
            except ImportError:
                print("Could not import 'app' from 'run' or 'backend.run'")
                raise

        from app.config import Config
        from app.models import CandidateAuth
        from app import db
        import jwt
        import datetime
        
        with app.app_context():
            # Get a valid candidate or create one
            candidate = CandidateAuth.query.first()
            if not candidate:
                candidate = CandidateAuth(
                    email='test_proctor@example.com',
                    password='hashed_password' # In real usage use set_password
                )
                candidate.set_password('password')
                db.session.add(candidate)
                db.session.commit()
                print(f"Created test candidate: {candidate.id}")
            else:
                print(f"Using existing candidate: {candidate.id}")
            
            user_id = candidate.id
            payload = {
                'user_id': user_id,
                'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
            }
            token = jwt.encode(payload, Config.JWT_SECRET, algorithm='HS256')
            if isinstance(token, bytes):
                token = token.decode('utf-8')
            
            headers = {'Authorization': f'Bearer {token}'}
            print(f"Generated test token for user {user_id}")
            
            # 2. Start Session
            print("\nStarting Session...")
            resp = requests.post(f"{BASE_URL}/api/proctor/session/start", headers=headers)
            print("Status:", resp.status_code)
            print("Response:", resp.text)
            
            if resp.status_code != 200:
                print("Failed to start session")
                return
                
            session_id = resp.json().get('session_id')
            print(f"Session ID: {session_id}")
            
            # 3. Log Violation
            print("\nLogging Violation...")
            data = {
                'session_id': session_id,
                'violation_type': 'looking_away',
                'violation_data': {'confidence': 0.95}
            }
            resp = requests.post(f"{BASE_URL}/api/proctor/log-violation", json=data, headers=headers)
            print("Status:", resp.status_code)
            print("Response:", resp.text)
            
            # 4. Get Summary
            print("\nGetting Summary...")
            resp = requests.get(f"{BASE_URL}/api/proctor/session/{session_id}/summary", headers=headers)
            print("Status:", resp.status_code)
            print("Response:", resp.text)
            
            if resp.status_code == 200:
                summary = resp.json()
                if summary['violations']['total_count'] > 0:
                    print("✅ Verification Successful: Violations recorded and retrieved.")
                else:
                    print("❌ Verification Failed: No violations found in summary.")
            else:
                print("❌ Verification Failed: Could not get summary.")

    except ImportError:
        print("Could not import app to generate token. Please run this script from the project root.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_proctor_flow()
