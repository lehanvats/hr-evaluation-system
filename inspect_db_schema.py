import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app import create_app, db
from sqlalchemy import inspect

def inspect_schema():
    app = create_app()
    with app.app_context():
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        print("\n=== Database Schema Inspection ===\n")
        print(f"Found {len(tables)} tables: {', '.join(tables)}")
        
        print("\n--- Proctor Related Tables Scan ---")
        keywords = ['proctor', 'violation', 'event']
        expected_tables = ['proctor_sessions', 'code_playback'] # code_playback is part of proctoring module
        
        found_proctor_tables = [t for t in tables if any(k in t for k in keywords) or t in expected_tables]
        
        extra_tables = []
        for t in found_proctor_tables:
            if t in expected_tables:
                print(f"✅ {t} (Expected)")
            else:
                print(f"❓ {t} (POTENTIALLY EXTRA/UNEXPECTED)")
                extra_tables.append(t)
        
        if not extra_tables:
            print("\nResult: No extra proctoring tables found.")
        else:
            print(f"\nResult: Found {len(extra_tables)} potentially extra tables.")

        print("\n==================================")

if __name__ == "__main__":
    inspect_schema()
