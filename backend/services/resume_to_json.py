import os
import sys
import io
import json
from dotenv import load_dotenv

# Add the parent directory into sys.path to import app/services
# Current file: backend/services/resume_to_json.py
# Parent (backend): backend/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import local modules
from app import create_app
from app.models import CandidateAuth
from services.placeholder_functions import parse_resume_to_json  # Using placeholder for now as requested
from supabase import create_client, Client
from pypdf import PdfReader

# Load .env from backend root
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(dotenv_path=env_path)

# Supabase Config
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "uploads")

def get_latest_resume_filename():
    """
    Connects to the database and fetches the filename of the most recently uploaded resume.
    """
    app = create_app()
    with app.app_context():
        # Query for candidate with the latest resume_uploaded_at
        candidate = CandidateAuth.query.filter(
            CandidateAuth.resume_filename.isnot(None)
        ).order_by(CandidateAuth.resume_uploaded_at.desc()).first()
        
        if candidate and candidate.resume_filename:
            return candidate.resume_filename
            
        return None

def get_latest_file_from_bucket():
    """
    Fallback: Get the most recently modified file from the Supabase bucket.
    """
    try:
        if not SUPABASE_URL or not SUPABASE_KEY:
            return None
            
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        files = supabase.storage.from_(SUPABASE_BUCKET).list()
        
        if not files:
            return None
            
        # Sort by created_at or updated_atdescending
        # The list method returns objects with 'created_at' or 'metadata'
        # We'll try to parse the iso timestamp.
        # Simple approach: sort by name if it contains timestamp, or rely on metadata
        
        # files is a list of dicts. Let's sort by 'created_at' desc
        files.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        if files:
            return files[0]['name']
            
    except Exception as e:
        print(f"❌ Error listing bucket: {e}", file=sys.stderr)
        return None

def extract_text_from_supabase(filename):
    """
    Downloads the file from Supabase and extracts text using pypdf.
    """
    if not filename:
        return None

    if not SUPABASE_URL or not SUPABASE_KEY:
        # Print error to stderr so it doesn't pollute stdout JSON
        print("❌ Supabase credentials missing.", file=sys.stderr)
        return None

    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Download file
        response = supabase.storage.from_(SUPABASE_BUCKET).download(filename)
        
        # Read PDF
        pdf_file = io.BytesIO(response)
        reader = PdfReader(pdf_file)
        
        text = ""
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
        
        return text.strip()
    except Exception as e:
        print(f"❌ Error extracting text: {e}", file=sys.stderr)
        return None

def main():
    # 1. Get latest resume filename from DB
    filename = get_latest_resume_filename()
    
    # 2. Extract text from Supabase
    resume_text = None
    
    # Try with DB filename first
    if filename:
        resume_text = extract_text_from_supabase(filename)
        
    # If failed or no filename, try fallback to latest bucket file
    if not resume_text:
        fallback_filename = get_latest_file_from_bucket()
        if fallback_filename and fallback_filename != filename:
            # print(f"⚠️ Fallback to latest bucket file: {fallback_filename}", file=sys.stderr)
            resume_text = extract_text_from_supabase(fallback_filename)
    
    if not resume_text:
        print(json.dumps({"error": "Failed to extract text from resume (checked DB and latest bucket file)"}), file=sys.stdout)
        return

    # 3. Parse with AI
    try:
        parsed_json = parse_resume_to_json(resume_text)
        # 4. Print ONLY the JSON to stdout
        print(json.dumps(parsed_json, indent=4))
    except Exception as e:
        # If possible, print the raw text if available, but it's hidden inside the function
        # For now, just print the error
        print(json.dumps({"error": f"AI parsing failed: {str(e)}"}), file=sys.stdout)

if __name__ == "__main__":
    main()
