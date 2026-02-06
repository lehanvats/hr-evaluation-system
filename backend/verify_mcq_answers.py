"""
Verify MCQ Answers
Shows all MCQ answers for a specific candidate
"""

import sys
from app import create_app
from app.models import MCQAnswer, MCQResult, CandidateAuth

def verify_mcq_answers(email):
    app = create_app()
    
    with app.app_context():
        # Find candidate
        candidate = CandidateAuth.query.filter_by(email=email).first()
        
        if not candidate:
            print(f"❌ Candidate not found: {email}")
            return
        
        print(f"\n📊 MCQ Answers for: {email} (ID: {candidate.id})")
        print("=" * 80)
        
        # Get individual answers
        answers = MCQAnswer.query.filter_by(candidate_id=candidate.id).order_by(MCQAnswer.submitted_at).all()
        
        if not answers:
            print("❌ No individual answers found")
        else:
            print(f"\n✅ Found {len(answers)} individual answers:\n")
            correct_count = 0
            for answer in answers:
                status = "✅ CORRECT" if answer.is_correct else "❌ WRONG"
                if answer.is_correct:
                    correct_count += 1
                print(f"  Q{answer.question_id}: Option {answer.selected_option} - {status} - {answer.submitted_at}")
            
            print(f"\n📈 Individual Answers Summary: {correct_count}/{len(answers)} correct")
        
        # Get aggregate result
        result = MCQResult.query.filter_by(student_id=candidate.id).first()
        
        if not result:
            print("\n❌ No MCQResult record found")
        else:
            print(f"\n📊 MCQResult Record:")
            print(f"  Correct: {result.correct_answers}")
            print(f"  Wrong: {result.wrong_answers}")
            print(f"  Total: {result.correct_answers + result.wrong_answers}")
            print(f"  Percentage: {result.percentage_correct}%")
        
        print("\n" + "=" * 80)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python verify_mcq_answers.py <candidate_email>")
        sys.exit(1)
    
    verify_mcq_answers(sys.argv[1])
