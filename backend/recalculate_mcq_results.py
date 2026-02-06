"""
Recalculate MCQ Results from Stored Answers
Fixes mismatch between mcq_answers and mcq_results tables
"""

import sys
from app import create_app
from app.models import MCQAnswer, MCQResult, CandidateAuth
from app.extensions import db

def recalculate_mcq_results(email):
    app = create_app()
    
    with app.app_context():
        # Find candidate
        candidate = CandidateAuth.query.filter_by(email=email).first()
        
        if not candidate:
            print(f"❌ Candidate not found: {email}")
            return
        
        print(f"\n🔄 Recalculating MCQ Results for: {email} (ID: {candidate.id})")
        print("=" * 80)
        
        # Get all stored answers
        answers = MCQAnswer.query.filter_by(candidate_id=candidate.id).all()
        
        if not answers:
            print("❌ No answers found to calculate from")
            return
        
        # Count correct and wrong answers from stored data
        correct_count = sum(1 for a in answers if a.is_correct)
        wrong_count = sum(1 for a in answers if not a.is_correct)
        total_count = len(answers)
        percentage = (correct_count / total_count * 100) if total_count > 0 else 0.0
        
        print(f"\n📊 Calculated from stored answers:")
        print(f"  Total Answers: {total_count}")
        print(f"  Correct: {correct_count}")
        print(f"  Wrong: {wrong_count}")
        print(f"  Percentage: {percentage:.2f}%")
        
        # Get or create result record
        result = MCQResult.query.filter_by(student_id=candidate.id).first()
        
        if not result:
            print(f"\n✨ Creating new MCQResult record...")
            result = MCQResult(
                student_id=candidate.id,
                correct_answers=correct_count,
                wrong_answers=wrong_count,
                percentage_correct=percentage
            )
            db.session.add(result)
        else:
            print(f"\n📝 Old MCQResult values:")
            print(f"  Correct: {result.correct_answers}")
            print(f"  Wrong: {result.wrong_answers}")
            print(f"  Total: {result.correct_answers + result.wrong_answers}")
            print(f"  Percentage: {result.percentage_correct}%")
            
            print(f"\n✅ Updating MCQResult with calculated values...")
            result.correct_answers = correct_count
            result.wrong_answers = wrong_count
            result.percentage_correct = percentage
        
        db.session.commit()
        
        print(f"\n✅ MCQResult updated successfully!")
        print("=" * 80)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python recalculate_mcq_results.py <candidate_email>")
        sys.exit(1)
    
    recalculate_mcq_results(sys.argv[1])
