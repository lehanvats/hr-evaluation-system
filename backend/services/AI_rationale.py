import json
import os
import sys

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models import CandidateAuth, MCQResult, PsychometricResult, TextAssessmentResult, CandidateRationale
from services.placeholder_functions import client, clean_json_output

def generate_final_rationale(resume_data, mcq_score, text_remark, psychometric_analysis):
    """
    Inputs: Data objects/dicts from previous steps.
    Output: JSON object with final verdict.
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
            model="llama-3.3-70b-versatile", # Using the larger model for reasoning
        )
        return json.loads(clean_json_output(response.choices[0].message.content))
    except Exception as e:
        print(f"Error generating rationale: {e}")
        return {"error": str(e)}

def process_ai_rationale(candidate_id, app_instance=None):
    """
    Fetches all candidate data, generates rationale, and saves to DB.
    """
    # Use provided app instance or create new one
    app = app_instance if app_instance else create_app()
    context = app.app_context() if not app_instance else None
    
    # Enter context if we created it
    if context:
        context.push()

    try:
        print(f"🔄 Fetching data for Candidate {candidate_id}...")
        
        # 1. Resume Data
        candidate = CandidateAuth.query.get(candidate_id)
        if not candidate:
             print(f"❌ Candidate {candidate_id} not found.")
             return None
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
        rationale_data = generate_final_rationale(resume_data, mcq_data, text_data, psycho_data)
        
        # Save to DB
        rationale_record = CandidateRationale.query.filter_by(candidate_id=candidate_id).first()
        if not rationale_record:
            rationale_record = CandidateRationale(candidate_id=candidate_id)
            db.session.add(rationale_record)
            
        rationale_record.rationale_json = rationale_data
        db.session.commit()
        print(f"✅ Final Rationale saved for Candidate {candidate_id}")
        return rationale_data
        
    except Exception as e:
        print(f"Error in process_ai_rationale: {e}")
        return None
    finally:
        if context:
            context.pop()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 AI_rationale.py <candidate_id>")
        sys.exit(1)
        
    candidate_id = int(sys.argv[1])
    
    result = process_ai_rationale(candidate_id)
    
    if result:
        # Save to AI_rationale.txt as requested in original requirements/logic
        file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'AI_rationale.txt')
        with open(file_path, 'w') as f:
            f.write(json.dumps(result, indent=4))
        print(f"✅ Output also saved to {file_path}")
