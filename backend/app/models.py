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
    resume_data = db.Column(db.JSON, nullable=True)  # AI parsed resume data
    
    # Assessment round completion tracking
    mcq_completed = db.Column(db.Boolean, default=False, nullable=False)
    mcq_completed_at = db.Column(db.DateTime, nullable=True)
    psychometric_completed = db.Column(db.Boolean, default=False, nullable=False)
    psychometric_completed_at = db.Column(db.DateTime, nullable=True)
    technical_completed = db.Column(db.Boolean, default=False, nullable=False)
    technical_completed_at = db.Column(db.DateTime, nullable=True)
    text_based_completed = db.Column(db.Boolean, default=False, nullable=False)
    text_based_completed_at = db.Column(db.DateTime, nullable=True)
    
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
            'technical_completed_at': self.technical_completed_at.isoformat() if self.technical_completed_at else None,
            'text_based_completed': self.text_based_completed,
            'text_based_completed_at': self.text_based_completed_at.isoformat() if self.text_based_completed_at else None
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

#====================== MCQ Questions ============================
class MCQQuestion(db.Model):
    __tablename__ = 'mcq_questions'
    
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, unique=True, nullable=False)  # Unique question identifier
    question = db.Column(db.Text, nullable=False)  # Question text
    option1 = db.Column(db.String(500), nullable=False)  # Option 1
    option2 = db.Column(db.String(500), nullable=False)  # Option 2
    option3 = db.Column(db.String(500), nullable=False)  # Option 3
    option4 = db.Column(db.String(500), nullable=False)  # Option 4
    correct_answer = db.Column(db.Integer, nullable=False)  # Correct option number (1, 2, 3, or 4)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def to_dict(self, include_answer=False):
        """Convert to dictionary for JSON serialization"""
        data = {
            'id': self.id,
            'question_id': self.question_id,
            'question': self.question,
            'options': [
                {'id': 1, 'text': self.option1},
                {'id': 2, 'text': self.option2},
                {'id': 3, 'text': self.option3},
                {'id': 4, 'text': self.option4}
            ]
        }
        if include_answer:
            data['correct_answer'] = self.correct_answer
        return data

#====================== MCQ Results ============================
class MCQResult(db.Model):
    __tablename__ = 'mcq_results'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('candidate_auth.id'), nullable=False, unique=True)
    correct_answers = db.Column(db.Integer, default=0, nullable=False)
    wrong_answers = db.Column(db.Integer, default=0, nullable=False)
    percentage_correct = db.Column(db.Float, default=0.0, nullable=False)
    grading_json = db.Column(db.JSON, nullable=True)  # AI grading result
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationship to candidate
    candidate = db.relationship('CandidateAuth', backref=db.backref('mcq_result', uselist=False))
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'student_id': self.student_id,
            'correct_answers': self.correct_answers,
            'wrong_answers': self.wrong_answers,
            'percentage_correct': self.percentage_correct,
            'total_answered': self.correct_answers + self.wrong_answers,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None
        }

#====================== Psychometric Questions ============================
class PsychometricQuestion(db.Model):
    __tablename__ = 'psychometric_questions'
    
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, unique=True, nullable=False)  # Unique question identifier
    question = db.Column(db.Text, nullable=False)  # Question text
    trait_type = db.Column(db.Integer, nullable=False)  # 1-5 for Big Five traits
    scoring_direction = db.Column(db.String(1), nullable=False)  # '+' or '-' for scoring
    is_active = db.Column(db.Boolean, default=True, nullable=False)  # Whether question is in current pool
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Trait type mapping: 1=Extraversion, 2=Agreeableness, 3=Conscientiousness, 4=Emotional Stability, 5=Intellect/Imagination
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'question_id': self.question_id,
            'question': self.question,
            'trait_type': self.trait_type,
            'scoring_direction': self.scoring_direction,
            'is_active': self.is_active
        }

#====================== Psychometric Test Configuration ============================
class PsychometricTestConfig(db.Model):
    __tablename__ = 'psychometric_test_config'
    
    id = db.Column(db.Integer, primary_key=True)
    recruiter_id = db.Column(db.Integer, db.ForeignKey('recruiter_auth.id'), nullable=False)
    num_questions = db.Column(db.Integer, nullable=False, default=50)  # Number of questions to show
    selection_mode = db.Column(db.String(20), nullable=False, default='random')  # 'random' or 'manual'
    selected_question_ids = db.Column(db.Text, nullable=True)  # JSON array of selected question IDs
    desired_traits = db.Column(db.Text, nullable=True)  # JSON array of desired personality trait types (1-5)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationship to recruiter
    recruiter = db.relationship('RecruiterAuth', backref=db.backref('psychometric_configs'))
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'recruiter_id': self.recruiter_id,
            'num_questions': self.num_questions,
            'selection_mode': self.selection_mode,
            'selected_question_ids': self.selected_question_ids,
            'desired_traits': self.desired_traits,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

#====================== Psychometric Results ============================
class PsychometricResult(db.Model):
    __tablename__ = 'psychometric_results'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('candidate_auth.id'), nullable=False, unique=True)
    
    # Big Five personality scores (0-50 for each trait)
    extraversion = db.Column(db.Float, default=0.0, nullable=False)
    agreeableness = db.Column(db.Float, default=0.0, nullable=False)
    conscientiousness = db.Column(db.Float, default=0.0, nullable=False)
    emotional_stability = db.Column(db.Float, default=0.0, nullable=False)
    intellect_imagination = db.Column(db.Float, default=0.0, nullable=False)
    
    # Metadata
    questions_answered = db.Column(db.Integer, default=0, nullable=False)
    test_completed = db.Column(db.Boolean, default=False, nullable=False)
    answers_json = db.Column(db.Text, nullable=True)  # JSON array of all answers
    grading_json = db.Column(db.JSON, nullable=True)  # AI grading result
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationship to candidate
    candidate = db.relationship('CandidateAuth', backref=db.backref('psychometric_result', uselist=False))
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'student_id': self.student_id,
            'extraversion': self.extraversion,
            'agreeableness': self.agreeableness,
            'conscientiousness': self.conscientiousness,
            'emotional_stability': self.emotional_stability,
            'intellect_imagination': self.intellect_imagination,
            'questions_answered': self.questions_answered,
            'test_completed': self.test_completed,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None
        }

#====================== Text-Based Questions ============================
class TextBasedQuestion(db.Model):
    __tablename__ = 'text_based_questions'
    
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, unique=True, nullable=False)  # Unique question identifier
    question = db.Column(db.Text, nullable=False)  # Question text
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'question_id': self.question_id,
            'question': self.question,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

#====================== Text-Based Answers ============================
class TextBasedAnswer(db.Model):
    __tablename__ = 'text_based_answers'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('candidate_auth.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('text_based_questions.question_id'), nullable=False)
    answer = db.Column(db.Text, nullable=False)  # The candidate's answer text
    word_count = db.Column(db.Integer, nullable=False)  # Word count of the answer
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    candidate = db.relationship('CandidateAuth', backref=db.backref('text_based_answers'))
    question = db.relationship('TextBasedQuestion', backref=db.backref('answers'))
    
    # Unique constraint: one answer per student per question
    __table_args__ = (db.UniqueConstraint('student_id', 'question_id', name='_student_question_uc'),)
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'student_id': self.student_id,
            'question_id': self.question_id,
            'answer': self.answer,
            'word_count': self.word_count,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

#====================== Proctor Session ============================
class ProctorSession(db.Model):
    __tablename__ = 'proctor_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidate_auth.id'), nullable=False)
    assessment_id = db.Column(db.String(100), nullable=True)  # New field
    session_uuid = db.Column(db.String(100), unique=True, nullable=False)
    violation_counts = db.Column(db.JSON, default=dict) # Kept for DB compatibility
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='active')  # active, completed, terminated
    
    # Relationship to candidate
    candidate = db.relationship('CandidateAuth', backref=db.backref('proctor_sessions'))
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'candidate_id': self.candidate_id,
            'assessment_id': self.assessment_id,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'status': self.status
        }

#====================== Proctor Event ============================
class ProctorEvent(db.Model):
    __tablename__ = 'proctor_events'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('proctor_sessions.id'), nullable=False)
    event_type = db.Column(db.String(50), nullable=False)  # multiple_faces, no_face, looking_away, phone_detected, tab_switch, etc.
    details = db.Column(db.Text, nullable=True)  # JSON or text details about the event
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationship to session
    session = db.relationship('ProctorSession', backref=db.backref('events'))
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'event_type': self.event_type,
            'details': self.details,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }

#====================== Code Playback Recording ============================
class CodePlayback(db.Model):
    __tablename__ = 'code_playback'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, nullable=False)  # Reference to proctor session or assessment session
    question_id = db.Column(db.Integer, nullable=False)  # Question being answered
    events = db.Column(db.Text, nullable=False)  # JSON array of keystroke/code change events
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Unique constraint: one playback log per session per question
    __table_args__ = (db.UniqueConstraint('session_id', 'question_id', name='_session_question_playback_uc'),)
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'question_id': self.question_id,
            'events': self.events,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

#====================== Proctoring Violations ============================
class ProctoringViolation(db.Model):
    __tablename__ = 'proctoring_violations'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(100), nullable=False)
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidate_auth.id'), nullable=False)
    violation_type = db.Column(db.String(50), nullable=False)
    violation_data = db.Column(db.JSON, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    severity = db.Column(db.String(20), default='medium')
    
    candidate = db.relationship('CandidateAuth', backref='proctoring_violations')
    
    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'candidate_id': self.candidate_id,
            'violation_type': self.violation_type,
            'violation_data': self.violation_data,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'severity': self.severity
        }

#====================== Evaluation Criteria ============================
class EvaluationCriteria(db.Model):
    __tablename__ = 'evaluation_criteria'
    
    id = db.Column(db.Integer, primary_key=True)
    recruiter_id = db.Column(db.Integer, db.ForeignKey('recruiter_auth.id'), nullable=False, unique=True)
    
    # Evaluation parameters (stored as percentages, must sum to 100)
    # Ratio: 1.5:1:1:0.5
    technical_skill = db.Column(db.Float, nullable=False, default=37.5)  # Default 37.5% (1.5)
    psychometric_assessment = db.Column(db.Float, nullable=False, default=25.0)  # Default 25% (1)
    soft_skill = db.Column(db.Float, nullable=False, default=25.0)  # Default 25% (1)
    fairplay = db.Column(db.Float, nullable=False, default=12.5)  # Default 12.5% (0.5)
    
    # Metadata
    is_default = db.Column(db.Boolean, default=False, nullable=False)  # Whether using default values
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationship to recruiter
    recruiter = db.relationship('RecruiterAuth', backref=db.backref('evaluation_criteria', uselist=False))
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'recruiter_id': self.recruiter_id,
            'technical_skill': self.technical_skill,
            'psychometric_assessment': self.psychometric_assessment,
            'soft_skill': self.soft_skill,
            'fairplay': self.fairplay,
            'is_default': self.is_default,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def validate_percentages(self):
        """Validate that all percentages sum to 100"""
        total = self.technical_skill + self.psychometric_assessment + self.soft_skill + self.fairplay
        return abs(total - 100.0) < 0.01  # Allow for floating point precision errors

#====================== Text Assessment Result ============================
class TextAssessmentResult(db.Model):
    __tablename__ = 'text_assessment_results'
    
    id = db.Column(db.Integer, primary_key=True)
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidate_auth.id'), nullable=False, unique=True)
    grading_json = db.Column(db.JSON, nullable=True)  # AI grading result
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    candidate = db.relationship('CandidateAuth', backref=db.backref('text_assessment_result', uselist=False))

#====================== Candidate Rationale ============================
class CandidateRationale(db.Model):
    __tablename__ = 'candidate_rationale'
    
    id = db.Column(db.Integer, primary_key=True)
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidate_auth.id'), nullable=False, unique=True)
    rationale_json = db.Column(db.JSON, nullable=True)  # Final AI decision
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    candidate = db.relationship('CandidateAuth', backref=db.backref('rationale', uselist=False))
