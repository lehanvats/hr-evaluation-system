"""
Test violation logging endpoint directly
"""
import requests

BASE_URL = "http://localhost:5000"

# Use existing candidate token
print("1. Login as candidate...")
login_response = requests.post(
    f"{BASE_URL}/api/candidate/login",
    json={
        "email": "test@candidate.com",
        "password": "password123"
    }
)

if login_response.status_code != 200:
    print(f"❌ Login failed: {login_response.text}")
    exit(1)

token = login_response.json().get('token')
print(f"✅ Logged in successfully\n")

# Start session
print("2. Starting proctoring session...")
session_response = requests.post(
    f"{BASE_URL}/api/proctor/session/start",
    headers={"Authorization": f"Bearer {token}"},
    json={}
)

if session_response.status_code != 200:
    print(f"❌ Session start failed: {session_response.text}")
    exit(1)

session_id = session_response.json().get('session_id')
print(f"✅ Session started: {session_id}\n")

# Log violation
print("3.Testing violation logging...")
violation_response = requests.post(
    f"{BASE_URL}/api/proctor/log-violation",
    headers={"Authorization": f"Bearer {token}"},
    json={
        "session_id": session_id,
        "violation_type": "no_face",
        "violation_data": {
            "face_detected": False,
            "test": True
        }
    }
)

if violation_response.status_code == 200:
    result = violation_response.json()
    print(f"✅ Violation logged! ID: {result.get('violation_id')}\n")
else:
    print(f"❌ Violation logging failed: {violation_response.text}\n")

# Verify in database
print("4. Checking database...")
from app import create_app
from app.models import ProctoringViolation
from app.extensions import db

app = create_app()
with app.app_context():
    violations = db.session.query(ProctoringViolation).all()
    print(f"✅ Total violations in database: {len(violations)}")
    for v in violations[-5:]:  # Show last 5
        print(f"   {v.id}: {v.violation_type} by candidate {v.candidate_id} at {v.timestamp}")

print("\n✅ Test complete!")
