"""
Database migration script to add proctoring_violations table
Run this after adding the ProctoringViolation model to create the table
"""
from app.extensions import db
from app import create_app

# Create app context
app = create_app()

with app.app_context():
    print("Creating proctoring_violations table...")
    
    # Create all tables (will only create missing ones)
    db.create_all()
    
    print("✅ Migration complete! proctoring_violations table created.")
    print("\nTable structure:")
    print("- id (primary key)")
    print("- session_id")
    print("- candidate_id (foreign key to candidate_auth)")
    print("- violation_type (no_face, multiple_faces, looking_away, tab_switch)")
    print("- violation_data (JSON)")
    print("- timestamp")
    print("- severity (low, medium, high)")
