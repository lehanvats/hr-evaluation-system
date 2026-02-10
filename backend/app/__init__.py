from flask import Flask, blueprints, send_from_directory, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from .extensions import db
from .config import Config
import os
import re


def create_app():
    app = Flask(__name__)
    
    # Load configuration from Config class
    app.config.from_object(Config)
    
    # Enable CORS for all routes (allow frontend to communicate)
    # Allow all Vercel deployments (production, preview, and branch deployments)
    allowed_origins = [
        r"https://.*-kpranats-projects\.vercel\.app",  # All Vercel preview/branch deployments
        r"http://localhost:\d+",  # Local development on any port
    ]
    CORS(app, 
         origins=allowed_origins, 
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization"], 
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         expose_headers=["Content-Type", "Authorization"])
    
    # PostgreSQL config (override if needed for SSL)
    if app.config["SQLALCHEMY_DATABASE_URI"]:
        # Only add SSL if using a cloud database
        if "localhost" not in app.config["SQLALCHEMY_DATABASE_URI"]:
            app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
                "connect_args": {"sslmode": "require"}
            }

    # Initialize extensions
    db.init_app(app)

    # Register blueprints
    # Candidate authentication routes
    from .CandidateAuth import CandidateAuth
    app.register_blueprint(CandidateAuth, url_prefix='/api/candidate')
    
    # Recruiter authentication routes
    from .RecruiterAuth import RecruiterAuth
    app.register_blueprint(RecruiterAuth, url_prefix='/api/recruiter')
    
    # Recruiter dashboard routes (separate from auth)
    from .RecruiterDashboard import RecruiterDashboard
    app.register_blueprint(RecruiterDashboard, url_prefix='/api/recruiter')
    
    # Resume management routes
    from .Resume import Resume
    app.register_blueprint(Resume, url_prefix='/api/resume')
    
    # MCQ management routes
    from .MCQ import MCQ
    app.register_blueprint(MCQ, url_prefix='/api/mcq')
    
    # Psychometric assessment routes
    from .Psychometric import psychometric_bp
    app.register_blueprint(psychometric_bp, url_prefix='/api/psychometric')
    
    # Text-based assessment routes
    from .TextBased import TextBased
    app.register_blueprint(TextBased, url_prefix='/api/text-based')
    
    # Code execution routes (Coding Assessment)
    from .CodeExecution import CodeExecution
    app.register_blueprint(CodeExecution, url_prefix='/api/code')
    
    # Proctor monitoring routes
    from .ProctorService import ProctorService
    app.register_blueprint(ProctorService, url_prefix='/api/proctor')
    
    # Playback service routes
    from .PlaybackService import PlaybackService
    app.register_blueprint(PlaybackService, url_prefix='/api/playback')

    # Assessment routes (finish/rationale)
    from .Assessment import Assessment
    app.register_blueprint(Assessment, url_prefix='/api/assessment')

    # Health check endpoint
    @app.route('/health', methods=['GET'])
    @app.route('/api/health', methods=['GET'])
    def health_check():
        """Health check endpoint for monitoring"""
        try:
            # Check database connection
            from sqlalchemy import text
            db.session.execute(text('SELECT 1'))
            db_status = 'healthy'
        except Exception as e:
            db_status = f'unhealthy: {str(e)}'
        
        return jsonify({
            'status': 'ok',
            'database': db_status,
            'service': 'HR Evaluation System Backend'
        }), 200

    # Import models before creating tables
    from . import models
    
    # Initialize database tables (with error handling)
    # This allows the app to start even if database is temporarily unavailable
    with app.app_context():
        try:
            # Check if DATABASE_URL is configured
            if not app.config.get("SQLALCHEMY_DATABASE_URI"):
                print("⚠️  WARNING: DATABASE_URL not configured. Database operations will fail.")
                print("    Please set DATABASE_URL in your .env file.")
                return app
            
            print("🔄 Initializing database...")
            # Create all tables
            db.create_all()
            print("✅ Database tables created/verified")
            
            # Add columns to existing candidate_auth table if they don't exist
            from sqlalchemy import text, inspect
            inspector = inspect(db.engine)
            
            # Check if candidate_auth table exists
            if 'candidate_auth' in inspector.get_table_names():
                existing_columns = [col['name'] for col in inspector.get_columns('candidate_auth')]
                
                # Add missing resume columns
                if 'resume_url' not in existing_columns:
                    db.session.execute(text("ALTER TABLE candidate_auth ADD COLUMN resume_url VARCHAR(500)"))
                    print("✅ Added resume_url column to candidate_auth")
                
                if 'resume_filename' not in existing_columns:
                    db.session.execute(text("ALTER TABLE candidate_auth ADD COLUMN resume_filename VARCHAR(255)"))
                    print("✅ Added resume_filename column to candidate_auth")
                
                if 'resume_uploaded_at' not in existing_columns:
                    db.session.execute(text("ALTER TABLE candidate_auth ADD COLUMN resume_uploaded_at TIMESTAMP"))
                    print("✅ Added resume_uploaded_at column to candidate_auth")
                
                # Add missing round completion columns
                if 'mcq_completed' not in existing_columns:
                    db.session.execute(text("ALTER TABLE candidate_auth ADD COLUMN mcq_completed BOOLEAN DEFAULT FALSE NOT NULL"))
                    print("✅ Added mcq_completed column to candidate_auth")
                
                if 'mcq_completed_at' not in existing_columns:
                    db.session.execute(text("ALTER TABLE candidate_auth ADD COLUMN mcq_completed_at TIMESTAMP"))
                    print("✅ Added mcq_completed_at column to candidate_auth")
                
                if 'psychometric_completed' not in existing_columns:
                    db.session.execute(text("ALTER TABLE candidate_auth ADD COLUMN psychometric_completed BOOLEAN DEFAULT FALSE NOT NULL"))
                    print("✅ Added psychometric_completed column to candidate_auth")
                
                if 'psychometric_completed_at' not in existing_columns:
                    db.session.execute(text("ALTER TABLE candidate_auth ADD COLUMN psychometric_completed_at TIMESTAMP"))
                    print("✅ Added psychometric_completed_at column to candidate_auth")
                
                if 'technical_completed' not in existing_columns:
                    db.session.execute(text("ALTER TABLE candidate_auth ADD COLUMN technical_completed BOOLEAN DEFAULT FALSE NOT NULL"))
                    print("✅ Added technical_completed column to candidate_auth")
                
                if 'technical_completed_at' not in existing_columns:
                    db.session.execute(text("ALTER TABLE candidate_auth ADD COLUMN technical_completed_at TIMESTAMP"))
                    print("✅ Added technical_completed_at column to candidate_auth")
                
                if 'text_based_completed' not in existing_columns:
                    db.session.execute(text("ALTER TABLE candidate_auth ADD COLUMN text_based_completed BOOLEAN DEFAULT FALSE NOT NULL"))
                    print("✅ Added text_based_completed column to candidate_auth")
                
                if 'text_based_completed_at' not in existing_columns:
                    db.session.execute(text("ALTER TABLE candidate_auth ADD COLUMN text_based_completed_at TIMESTAMP"))
                    print("✅ Added text_based_completed_at column to candidate_auth")
                
                if 'coding_completed' not in existing_columns:
                    db.session.execute(text("ALTER TABLE candidate_auth ADD COLUMN coding_completed BOOLEAN DEFAULT FALSE NOT NULL"))
                    print("✅ Added coding_completed column to candidate_auth")
                
                if 'coding_completed_at' not in existing_columns:
                    db.session.execute(text("ALTER TABLE candidate_auth ADD COLUMN coding_completed_at TIMESTAMP"))
                    print("✅ Added coding_completed_at column to candidate_auth")
                
                db.session.commit()
                print("✅ Database schema updated successfully")
        
        except Exception as e:
            print(f"⚠️  WARNING: Database initialization failed: {str(e)}")
            print("    The application will start, but database operations will not work.")
            print("    Please check your DATABASE_URL and network connection.")
            # Don't return here - let the app continue to start
            # This allows health checks to respond even if DB is down

    return app