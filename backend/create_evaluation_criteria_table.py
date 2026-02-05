"""
Database Migration Script: Add Evaluation Criteria Table

This script creates the evaluation_criteria table for storing
recruiter-specific evaluation weightage configurations.

Usage:
    python create_evaluation_criteria_table.py
"""

from app import create_app, db
from app.models import EvaluationCriteria

def create_evaluation_criteria_table():
    """Create the evaluation_criteria table if it doesn't exist"""
    app = create_app()
    
    with app.app_context():
        try:
            # Check if table already exists
            inspector = db.inspect(db.engine)
            if 'evaluation_criteria' in inspector.get_table_names():
                print("✓ evaluation_criteria table already exists")
                return
            
            # Create the table
            print("Creating evaluation_criteria table...")
            EvaluationCriteria.__table__.create(db.engine)
            print("✓ Successfully created evaluation_criteria table")
            
            # Print table schema
            print("\n📋 Table Schema:")
            print("================")
            print("Table: evaluation_criteria")
            print("Columns:")
            print("  - id (INTEGER, PRIMARY KEY)")
            print("  - recruiter_id (INTEGER, FOREIGN KEY -> recruiter_auth.id, UNIQUE)")
            print("  - technical_skill (FLOAT, DEFAULT 50.0)")
            print("  - psychometric_assessment (FLOAT, DEFAULT 15.0)")
            print("  - soft_skill (FLOAT, DEFAULT 15.0)")
            print("  - fairplay (FLOAT, DEFAULT 20.0)")
            print("  - is_default (BOOLEAN, DEFAULT False)")
            print("  - created_at (DATETIME)")
            print("  - updated_at (DATETIME)")
            print("\n✓ Migration completed successfully!")
            
        except Exception as e:
            print(f"\n❌ Error creating table: {str(e)}")
            raise

if __name__ == '__main__':
    create_evaluation_criteria_table()
