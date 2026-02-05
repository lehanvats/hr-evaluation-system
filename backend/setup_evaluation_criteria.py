"""
Quick Setup Script for Evaluation Criteria Feature

This script:
1. Creates the evaluation_criteria table
2. Verifies the table was created successfully
3. Shows example usage

Usage:
    python setup_evaluation_criteria.py
"""

import sys
from app import create_app, db
from app.models import EvaluationCriteria, RecruiterAuth

def setup():
    """Main setup function"""
    app = create_app()
    
    with app.app_context():
        print("=" * 60)
        print("EVALUATION CRITERIA FEATURE SETUP")
        print("=" * 60)
        
        # Step 1: Create table
        print("\n[Step 1/3] Creating evaluation_criteria table...")
        try:
            inspector = db.inspect(db.engine)
            if 'evaluation_criteria' in inspector.get_table_names():
                print("✓ Table already exists")
            else:
                EvaluationCriteria.__table__.create(db.engine)
                print("✓ Table created successfully")
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            return False
        
        # Step 2: Verify table structure
        print("\n[Step 2/3] Verifying table structure...")
        try:
            columns = inspector.get_columns('evaluation_criteria')
            expected_columns = [
                'id', 'recruiter_id', 'technical_skill', 
                'psychometric_assessment', 'soft_skill', 'fairplay',
                'is_default', 'created_at', 'updated_at'
            ]
            
            found_columns = [col['name'] for col in columns]
            
            for col in expected_columns:
                if col in found_columns:
                    print(f"  ✓ {col}")
                else:
                    print(f"  ❌ Missing: {col}")
            
            if set(expected_columns).issubset(set(found_columns)):
                print("✓ All columns present")
            else:
                print("❌ Some columns are missing")
                return False
                
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            return False
        
        # Step 3: Show example
        print("\n[Step 3/3] Example Usage")
        print("-" * 60)
        print("\n📝 API Endpoints:")
        print("  GET    /recruiter-dashboard/evaluation-criteria")
        print("  POST   /recruiter-dashboard/evaluation-criteria")
        print("  PUT    /recruiter-dashboard/evaluation-criteria")
        print("  POST   /recruiter-dashboard/evaluation-criteria/reset")
        
        print("\n📊 Default Values (Ratio 1.5:1:1:0.5):")
        print("  Technical Skill:          37.5%")
        print("  Psychometric Assessment:  25%")
        print("  Soft Skills:              25%")
        print("  Fairplay:                 12.5%")
        print("                           ------")
        print("  Total:                   100%")
        
        print("\n🎨 Frontend:")
        print("  Navigate to: /admin/settings")
        print("  Section: 'Evaluation Criteria'")
        
        print("\n" + "=" * 60)
        print("✅ SETUP COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        
        # Test data creation (optional)
        print("\n💡 Optional: Create test criteria for existing recruiters?")
        print("   This will create default criteria for all recruiters")
        print("   who don't have criteria yet.")
        
        response = input("\n   Create test data? (y/n): ").lower().strip()
        
        if response == 'y':
            create_test_data()
        
        return True

def create_test_data():
    """Create default criteria for existing recruiters"""
    try:
        recruiters = RecruiterAuth.query.all()
        
        if not recruiters:
            print("\n⚠️  No recruiters found in database")
            return
        
        created_count = 0
        skipped_count = 0
        
        for recruiter in recruiters:
            # Check if criteria already exists
            existing = EvaluationCriteria.query.filter_by(
                recruiter_id=recruiter.id
            ).first()
            
            if existing:
                skipped_count += 1
                continue
            
            # Create default criteria
            criteria = EvaluationCriteria(
                recruiter_id=recruiter.id,
                technical_skill=37.5,
                psychometric_assessment=25.0,
                soft_skill=25.0,
                fairplay=12.5,
                is_default=True
            )
            db.session.add(criteria)
            created_count += 1
        
        db.session.commit()
        
        print(f"\n✓ Created criteria for {created_count} recruiter(s)")
        if skipped_count > 0:
            print(f"  ℹ️  Skipped {skipped_count} recruiter(s) (already have criteria)")
        
    except Exception as e:
        db.session.rollback()
        print(f"\n❌ Error creating test data: {str(e)}")

if __name__ == '__main__':
    try:
        success = setup()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Setup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
