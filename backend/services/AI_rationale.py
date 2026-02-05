import json
import os
import sys

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models import CandidateAuth, MCQResult, PsychometricResult, TextAssessmentResult, CandidateRationale
from placeholder_functions import client, clean_json_output

def generate_final_rationale(resume_data, mcq_score, text_remark, psychometric_analysis):
    """
    Inputs:
        resume_data: Dict or JSON string
        mcq_score: Dict or JSON string
        text_remark: Dict or JSON string
        psychometric_analysis: Dict or JSON string
        
    Output: JSON String
    """
    prompt = f"""
    Act as a Senior Technical Recruiter and Assessment Expert.
    Be strict and critical.
    Analyze the following candidate data from multiple assessments to produce a Final Rationale Report.
    
    1. RESUME DATA:
    {json.dumps(resume_data, indent=2) if isinstance(resume_data, dict) else resume_data}
    
    2. MCQ TECHNICAL SCORE:
    {json.dumps(mcq_score, indent=2) if isinstance(mcq_score, dict) else mcq_score}
    
    3. TEXT RESPONSE EVALUATION (Soft Skills & Communication):
    {json.dumps(text_remark, indent=2) if isinstance(text_remark, dict) else text_remark}
    
    4. PSYCHOMETRIC ANALYSIS (Personality Fit):
    {json.dumps(psychometric_analysis, indent=2) if isinstance(psychometric_analysis, dict) else psychometric_analysis}
    
    TASK:
    Grade the candidate objectively on the following 4 criteria. For each, provide a "grade" (Excellent/Good/Average/Poor) and "reasoning" (1-2 sentences explaining the grade).
    
    RETURN ONLY JSON in the following format:
    {{
        "technical_evaluation": {{
            "grade": "<grade>",
            "reasoning": "<reasoning>"
        }},
        "soft_skills_evaluation": {{
            "grade": "<grade>",
            "reasoning": "<reasoning>"
        }},
        "psychometric_evaluation": {{
            "grade": "<grade>",
            "reasoning": "<reasoning>"
        }},
        "resume_fit": {{
            "grade": "<grade>",
            "reasoning": "<reasoning>"
        }},
        "final_decision": {{
             "status": "Hire/No Hire/Strong Hire/Maybe",
             "summary": "Final concluding thought."
        }}
    }}
    """
    
    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
        )
        
        cleaned_text = clean_json_output(response.choices[0].message.content)
        data = json.loads(cleaned_text)
        return json.dumps(data, indent=2)
    except Exception as e:
        print(f"❌ Error in AI Rationale generation: {e}")
        return json.dumps({"error": "Failed to parse AI rationale"}, indent=2)

def process_ai_rationale(candidate_id):
    """
    Fetches all candidate data, generates rationale, and saves to DB.
    """
    app = create_app()
    with app.app_context():
        print(f"🔄 Fetching data for Candidate {candidate_id}...")
        
        # 1. Resume Data
        candidate = CandidateAuth.query.get(candidate_id)
        if not candidate:
             print(f"❌ Candidate {candidate_id} not found.")
             return
        resume_data = candidate.resume_data if candidate.resume_data else {"error": "Resume data not processed yet."}
        
        # 2. MCQ Data
        mcq_result = MCQResult.query.filter_by(student_id=candidate_id).first()
        mcq_data = mcq_result.grading_json if mcq_result and mcq_result.grading_json else {"percentage": "N/A", "error": "MCQ not graded yet."}
        
        # 3. Psychometric Data
        psycho_result = PsychometricResult.query.filter_by(student_id=candidate_id).first()
        psycho_data = psycho_result.grading_json if psycho_result and psycho_result.grading_json else {"match_grade": "N/A", "error": "Psychometric not graded yet."}
        
        # 4. Text Assessment Data
        text_result = TextAssessmentResult.query.filter_by(candidate_id=candidate_id).first()
        text_data = text_result.grading_json if text_result and text_result.grading_json else {"remark": "N/A", "error": "Text responses not graded yet."}
        
        print("🤖 Generating Final Rationale (Llama-70b)...")
        rationale_json_str = generate_final_rationale(resume_data, mcq_data, text_data, psycho_data)
        
        # Save to DB
        rationale_record = CandidateRationale.query.filter_by(candidate_id=candidate_id).first()
        if not rationale_record:
            rationale_record = CandidateRationale(candidate_id=candidate_id)
            db.session.add(rationale_record)
            
        rationale_record.rationale_json = json.loads(rationale_json_str)
        db.session.commit()
        print(f"✅ Final Rationale saved for Candidate {candidate_id}")
        # print(rationale_json_str)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 AI_rationale.py <candidate_id>")
        sys.exit(1)
        
    candidate_id = int(sys.argv[1])
    process_ai_rationale(candidate_id)
