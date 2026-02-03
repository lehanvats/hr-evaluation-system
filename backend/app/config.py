import os
from dotenv import load_dotenv

load_dotenv()  # load .env → environment variables

class Config:
    # Database configuration
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Security
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    
    # JWT token configuration
    JWT_SECRET = os.getenv("JWT_SECRET", "your_jwt_secret")
    JWT_EXP_MINUTES = int(os.getenv("JWT_EXP_MINUTES", 1440))  # 24 hours default
    
    # Supabase configuration
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "uploads")