"""Test script to call the candidate detail endpoint and see debug logs"""
import requests
import json

# First login as recruiter
print("=== Logging in as recruiter ===")
login_resp = requests.post('http://localhost:5000/api/recruiter/login', json={
    'email': 'admin@hreval.com',
    'password': 'Admin123!'
})

if not login_resp.ok:
    print(f"Login failed: {login_resp.text}")
    exit(1)

if login_resp.ok:
    login_data = login_resp.json()
    if login_data.get('success'):
        token = login_data.get('token')
        print(f"✓ Login successful, token: {token[:20]}...")
        
        # Now fetch candidate 41 detail
        print("\n=== Fetching candidate 41 details ===")
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        detail_resp = requests.get('http://localhost:5000/api/recruiter/candidates/41', headers=headers)
        
        if detail_resp.ok:
            data = detail_resp.json()
            if data.get('success'):
                candidate = data.get('candidate', {})
                print(f"\n✓ Candidate: {candidate.get('email')}")
                print(f"  Fairplay Score: {candidate.get('fairplay_score')}")
                print(f"  Integrity Logs Count: {len(candidate.get('integrity_logs', []))}")
                
                # Print first few integrity logs
                logs = candidate.get('integrity_logs', [])
                if logs:
                    print(f"\n  First 5 integrity logs:")
                    for log in logs[:5]:
                        print(f"    - {log.get('timestamp')} | {log.get('event')} | {log.get('severity')}")
                else:
                    print("  ⚠ No integrity logs found!")
            else:
                print(f"✗ API returned success=false: {data.get('message')}")
        else:
            print(f"✗ Request failed: {detail_resp.status_code} - {detail_resp.text}")
    else:
        print(f"✗ Login returned success=false: {login_data.get('message')}")
else:
    print(f"✗ Login request failed: {login_resp.status_code}")
