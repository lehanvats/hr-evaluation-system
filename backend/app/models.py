from .extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

#======================= candidate login ============================
class CandidateAuth(db.Model):
    __tablename__ = 'candidate_auth'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), nullable=False, unique=True)
    password = db.Column(db.String(255), nullable=False)  # Increased length for hashed password
    resume_url = db.Column(db.String(500), nullable=True)  # Supabase storage URL
    resume_filename = db.Column(db.String(255), nullable=True)  # Original filename
    resume_uploaded_at = db.Column(db.DateTime, nullable=True)  # Upload timestamp
    
    # Assessment round completion tracking
    mcq_completed = db.Column(db.Boolean, default=False, nullable=False)
    mcq_completed_at = db.Column(db.DateTime, nullable=True)
    psychometric_completed = db.Column(db.Boolean, default=False, nullable=False)
    psychometric_completed_at = db.Column(db.DateTime, nullable=True)
    technical_completed = db.Column(db.Boolean, default=False, nullable=False)
    technical_completed_at = db.Column(db.DateTime, nullable=True)
    
    def set_password(self, password):
        """Hash and set the password"""
        self.password = generate_password_hash(password)
    
    def check_password(self, password):
        """Verify password against hash"""
        return check_password_hash(self.password, password)
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'email': self.email,
            'resume_url': self.resume_url,
            'resume_filename': self.resume_filename,
            'resume_uploaded_at': self.resume_uploaded_at.isoformat() if self.resume_uploaded_at else None,
            'mcq_completed': self.mcq_completed,
            'mcq_completed_at': self.mcq_completed_at.isoformat() if self.mcq_completed_at else None,
            'psychometric_completed': self.psychometric_completed,
            'psychometric_completed_at': self.psychometric_completed_at.isoformat() if self.psychometric_completed_at else None,
            'technical_completed': self.technical_completed,
            'technical_completed_at': self.technical_completed_at.isoformat() if self.technical_completed_at else None
        }

#====================== recruiter login ============================
class RecruiterAuth(db.Model):
    __tablename__ = 'recruiter_auth'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), nullable=False, unique=True)
    password = db.Column(db.String(255), nullable=False)
    
    def set_password(self, password):
        """Hash and set the password"""
        self.password = generate_password_hash(password)
    
    def check_password(self, password):
        """Verify password against hash"""
        return check_password_hash(self.password, password)
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'email': self.email
        }

#====================== MCQ Response ============================
class MCQResponse(db.Model):
    __tablename__ = 'mcq_responses'
    
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, nullable=False)  # ID of the MCQ question
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidate_auth.id'), nullable=False)  # Foreign key to candidate
    answer_option = db.Column(db.String(10), nullable=False)  # Selected option (e.g., 'a', 'b', 'c', 'd')
    answered_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)  # Timestamp
    
    # Relationship to candidate
    candidate = db.relationship('CandidateAuth', backref=db.backref('mcq_responses', lazy=True))
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'question_id': self.question_id,
            'candidate_id': self.candidate_id,
            'answer_option': self.answer_option,
            'answered_at': self.answered_at.isoformat() if self.answered_at else None
        }

