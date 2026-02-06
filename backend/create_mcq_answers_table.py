"""
Create MCQ Answers Table
Adds table to store individual MCQ answers for each candidate
"""

from app import create_app
from app.extensions import db
from app.models import MCQAnswer

def create_mcq_answers_table():
    app = create_app()
    
    with app.app_context():
        print("🔨 Creating mcq_answers table...")
        
        # Create the table
        db.create_all()
        
        print("✅ mcq_answers table created successfully!")
        print("\nTable structure:")
        print("- id (Primary Key)")
        print("- candidate_id (Foreign Key)")
        print("- question_id (Foreign Key)")
        print("- selected_option (1-4)")
        print("- is_correct (Boolean)")
        print("- submitted_at (DateTime)")
        print("- Unique constraint: (candidate_id, question_id)")

if __name__ == '__main__':
    create_mcq_answers_table()
