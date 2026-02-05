
import requests
import base64
import json
import os
import sys
import datetime
import jwt

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app import create_app, db
from app.models import CandidateAuth
from app.config import Config

BASE_URL = "http://localhost:5000"

def test_ai_service():
    app = create_app()
    with app.app_context():
        # 1. Get Candidate
        candidate = CandidateAuth.query.first()
        if not candidate:
            print("No candidate found.")
            # Create one if missing
            candidate = CandidateAuth(email='debug@test.com')
            candidate.set_password('password')
            db.session.add(candidate)
            db.session.commit()
            print("Created debug candidate.")

        user_id = candidate.id
        
        # 2. Generate Token
        payload = {
            'user_id': user_id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
        }
        token = jwt.encode(payload, Config.JWT_SECRET, algorithm='HS256')
        if isinstance(token, bytes):
            token = token.decode('utf-8')
        
        headers = {'Authorization': f'Bearer {token}'}
        print(f"Generated token for user {user_id}")

        # 3. Start Session
        try:
            resp = requests.post(f"{BASE_URL}/api/proctor/session/start", headers=headers, timeout=5)
            if resp.status_code != 200:
                print(f"Failed to start session: {resp.text}")
                return
            session_id = resp.json().get('session_id')
            print(f"Started session: {session_id}")

            # 4. Send Analyze Frame Request
            # 100x100 white jpeg image
            pixel_b64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCABkAGQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RCYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//9k="
            
            print("\nSending frame for analysis...")
            resp = requests.post(f"{BASE_URL}/api/proctor/analyze-frame", json={
                'session_id': session_id,
                'image': pixel_b64
            }, headers=headers, timeout=60) # AI might be slow
            
            print(f"Status Code: {resp.status_code}")
            print(f"Response: {resp.text}")
            
        except requests.exceptions.ConnectionError:
            print("❌ Cannot connect to backend. Is python run.py running?")

if __name__ == "__main__":
    test_ai_service()
