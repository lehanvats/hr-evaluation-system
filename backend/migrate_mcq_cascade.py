"""
Migration Script: Add CASCADE DELETE to Foreign Key Constraints

This script updates foreign key constraints to enable cascade deletion 
when questions are deleted.

Affected tables:
- mcq_answers (references mcq_questions)
- text_based_answers (references text_based_questions)

Run this ONCE after updating the models.py file.
"""

from app import create_app
from app.extensions import db
from sqlalchemy import text

def migrate_cascade_deletes():
    app = create_app()
    
    with app.app_context():
        try:
            print("\n🔄 Starting CASCADE DELETE migration...")
            
            # ========== MCQ Tables ==========
            print("\n📝 Processing MCQ tables...")
            
            # Drop old MCQ foreign key constraint
            print("  • Dropping old mcq_answers foreign key...")
            db.session.execute(text("""
                ALTER TABLE mcq_answers 
                DROP CONSTRAINT IF EXISTS mcq_answers_question_id_fkey;
            """))
            
            # Add new MCQ foreign key with CASCADE
            print("  • Adding CASCADE DELETE to mcq_answers...")
            db.session.execute(text("""
                ALTER TABLE mcq_answers 
                ADD CONSTRAINT mcq_answers_question_id_fkey 
                FOREIGN KEY (question_id) 
                REFERENCES mcq_questions(question_id) 
                ON DELETE CASCADE;
            """))
            
            # ========== Text-Based Tables ==========
            print("\n📝 Processing Text-Based tables...")
            
            # Drop old Text-Based foreign key constraint
            print("  • Dropping old text_based_answers foreign key...")
            db.session.execute(text("""
                ALTER TABLE text_based_answers 
                DROP CONSTRAINT IF EXISTS text_based_answers_question_id_fkey;
            """))
            
            # Add new Text-Based foreign key with CASCADE
            print("  • Adding CASCADE DELETE to text_based_answers...")
            db.session.execute(text("""
                ALTER TABLE text_based_answers 
                ADD CONSTRAINT text_based_answers_question_id_fkey 
                FOREIGN KEY (question_id) 
                REFERENCES text_based_questions(question_id) 
                ON DELETE CASCADE;
            """))
            
            db.session.commit()
            
            print("\n✅ Migration completed successfully!")
            print("📌 CASCADE DELETE enabled for:")
            print("   - MCQ answers (when questions deleted)")
            print("   - Text-Based answers (when questions deleted)")
            print("\n")
            
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Migration failed: {str(e)}")
            print("💡 If constraints don't exist, this is normal for new databases.\n")
            raise

if __name__ == '__main__':
    migrate_cascade_deletes()
