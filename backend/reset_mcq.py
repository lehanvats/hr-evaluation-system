"""
Reset MCQ for Candidate
Clears all MCQ answers and results for a candidate
"""

import sys
from app import create_app
from app.models import MCQAnswer, MCQResult, CandidateAuth
from app.extensions import db

def reset_mcq(email):
    app = create_app()
    
    with app.app_context():
        # Find candidate
        candidate = CandidateAuth.query.filter_by(email=email).first()
        
        if not candidate:
            print(f"❌ Candidate not found: {email}")
            return
        
        print(f"\n🗑️  Resetting MCQ for: {email} (ID: {candidate.id})")
        print("=" * 80)
        
        # Delete individual answers
        answers_deleted = MCQAnswer.query.filter_by(candidate_id=candidate.id).delete()
        print(f"✅ Deleted {answers_deleted} individual answers")
        
        # Delete or reset result
        result = MCQResult.query.filter_by(student_id=candidate.id).first()
        if result:
            result.correct_answers = 0
            result.wrong_answers = 0
            result.percentage_correct = 0.0
            result.grading_json = None
            print(f"✅ Reset MCQResult record")
        else:
            print(f"ℹ️  No MCQResult record to reset")
        
        # Reset mcq_completed flag in CandidateAuth
        candidate.mcq_completed = False
        candidate.mcq_completed_at = None
        print(f"✅ Reset mcq_completed flag")
        
        db.session.commit()
        print("\n✅ MCQ reset complete! Candidate can retake the test.")
        print("=" * 80)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python reset_mcq.py <candidate_email>")
        sys.exit(1)
    
    reset_mcq(sys.argv[1])
