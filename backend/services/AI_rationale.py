import json
import os
import sys

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models import CandidateAuth, MCQResult, PsychometricResult, TextAssessmentResult, CandidateRationale, CodingAssessmentResult, ProctorSession
from services.placeholder_functions import client, clean_json_output
from services.coding_result_to_grading import process_coding_grading
from services.proctor_result_to_grading import process_proctor_grading

def generate_final_rationale(resume_data, mcq_score, text_remark, psychometric_analysis, coding_data, proctor_data):
    """
    Inputs: Data objects/dicts from previous steps.
    Output: JSON object with final verdict.
    """
    prompt = f"""
    Act as a Senior Technical Recruiter and Assessment Expert writing a polished candidate evaluation report.
    Your goal is to provide a comprehensive, transparent, and balanced evaluation that reads like a professional hiring committee memo.

    DATA PROVIDED:

    1. RESUME DATA:
    {json.dumps(resume_data, indent=2) if isinstance(resume_data, dict) else resume_data}

    2. TECHNICAL SCORE (MCQ Based):
    {json.dumps(mcq_score, indent=2) if isinstance(mcq_score, dict) else mcq_score}

    3. SOFT SKILLS (Text Assessment Based):
    {json.dumps(text_remark, indent=2) if isinstance(text_remark, dict) else text_remark}

    4. PSYCHOMETRIC TRAITS (For Reference Only - Do NOT grade pass/fail):
    {json.dumps(psychometric_analysis, indent=2) if isinstance(psychometric_analysis, dict) else psychometric_analysis}

    5. CODING SKILLS (Sandbox Result):
    {json.dumps(coding_data, indent=2) if isinstance(coding_data, dict) else coding_data}

    6. PROCTORING / INTEGRITY (Malpractice Check):
    {json.dumps(proctor_data, indent=2) if isinstance(proctor_data, dict) else proctor_data}

    INSTRUCTIONS:
    Produce a Final Rationale Report. Each "reasoning" / "summary" field must be a RICH, FLOWING NARRATIVE PARAGRAPH — not bullet points, not a single sentence.

    ── WRITING STYLE (CRITICAL — follow exactly) ──

    Resume Fit:
    • 4-6 sentences. Open by naming the candidate and their strongest skill areas drawn from resume_data (languages, frameworks, tools).
    • Reference specific projects listed in the resume by name and explain what they demonstrate (e.g., "The Lung Disease Classification CNN project showcases their ability to work on complex deep-learning problems").
    • Mention education, GPA, and institution by name.
    • Close with an overall fit statement ("Overall, the candidate's resume demonstrates a strong/average/poor fit for a technical role…").

    Technical Skills:
    • 4-5 sentences. Lead with the exact percentage and fraction (e.g., "The candidate's Technical Score of 50.0%, with 5 correct answers out of 10, indicates…").
    • Contrast the MCQ result with what the resume claims — note if the resume skills are impressive but the score doesn't fully reflect that, or vice-versa.
    • Mention whether additional training might be needed, or if the score confirms strong expertise.

    Coding Skills:
    • 4-5 sentences. State how many problems the candidate solved fully out of the total attempted.
    • Name the specific problems from the coding data and their individual scores (e.g., "a score of 100.0 for the 'Container With Most Water' problem").
    • If there were errors (runtime error, wrong answer, TLE), mention them by problem name and error type.
    • Close with an overall coding ability summary.

    Soft Skills:
    • 4-5 sentences. Reference the text assessment remark/scores directly (e.g., "The remark states that the candidate's communication skills and depth of understanding are lacking…").
    • Explain the impact: how poor or strong soft skills would affect teamwork, communication, and collaboration.
    • If soft skills are weak but technical skills are strong, note that contrast explicitly.

    Psychometric Insight:
    • 2-3 sentences only. Translate raw trait tendencies into behavioral language (e.g., "tends to be introverted", "demonstrates creativity and imaginative thinking").
    • Mention potential strengths and areas of concern in personality. Do NOT pass/fail — this is informational insight only.

    Integrity:
    • 2-3 sentences. If severity/remark mentions issues (multiple faces, tab switches, etc.), describe them factually (e.g., "'Multiple faces detected frequently. Potential collaboration'").
    • Explicitly state: "this observation should not affect the hiring decision" and "the candidate should not be penalized solely based on this score."
    • If score > 50 or severity is low, mark as Acceptable with a brief positive note.

    Final Verdict:
    • 5-7 sentences. Synthesize ALL sections into a cohesive narrative.
    • Name the candidate. Restate their strongest areas and their weakest areas.
    • Explain why the chosen status (Hire / No Hire / Strong Hire / Consider for Future) is appropriate.
    • If "Consider for Future", specify what the candidate should improve.
    • End with a clear recommendation sentence (e.g., "Therefore, it is recommended to consider [Name] for future opportunities, rather than making an immediate hiring decision.").

    ── SCORING / GRADING RULES ──

    Resume Fit Grade:
    - Excellent: Resume clearly aligns with role, strong projects, relevant skills, strong education.
    - Good: Mostly aligned, some gaps.
    - Average: Partial alignment.
    - Poor: Minimal relevance.

    Technical Grade:
    - Excellent: >80%
    - Good: 60-80%
    - Average: 40-60%
    - Poor: <40%

    Coding Grade:
    - Excellent: All problems solved with high scores and clean code.
    - Good: Most problems solved, minor issues.
    - Average: Mixed results, some solved, some errors.
    - Poor: Most problems failed or not attempted.

    Soft Skills Grade:
    - Excellent: Clear, articulate, professional, thoughtful responses.
    - Good: Adequate communication, minor issues.
    - Average: Some clarity issues but passable.
    - Poor: Lacking clarity, coherence, depth.

    ── INTEGRITY RULES (IMPORTANT) ──
    - If Integrity/Fairplay score is ABOVE 50 or severity is "Low"/"None": Mark as "Acceptable". Do NOT penalize.
    - If Integrity/Fairplay score is BELOW 50 or severity is "Moderate"/"Severe": Mark as "Observation". Describe the concern factually but explicitly state it should NOT affect the hiring decision.
    - NEVER reject a candidate solely based on integrity score.

    ── FAIRNESS & CRITICALITY ──
    - If Technical Score > 70%, do NOT rate the candidate "Poor" overall unless Soft Skills are terrible.
    - High Technical + Low Soft Skills → potential Individual Contributor role.
    - Low Technical + High Soft Skills → potential Junior/Support role.

    ── TRANSPARENCY ──
    - Always cite exact scores, percentages, and fractions in the reasoning (e.g., "given the Technical Score of 85%", "5 correct out of 10", "Communication Score of 75/100").
    - Always name the candidate where relevant.
    - Always reference specific project names, problem names, and assessment remarks.

    OUTPUT FORMAT:
    Return ONLY valid JSON in the following format:
    {{
        "resume_fit": {{
            "grade": "Excellent" | "Good" | "Average" | "Poor",
            "reasoning": "4-6 sentences. Rich narrative paragraph analyzing resume fit with specific references to skills, projects, and education."
        }},
        "technical_evaluation": {{
            "grade": "Excellent" | "Good" | "Average" | "Poor",
            "reasoning": "4-5 sentences. Narrative paragraph citing exact Technical Score percentage and fraction, contrasting with resume claims."
        }},
        "coding_evaluation": {{
            "grade": "Excellent" | "Good" | "Average" | "Poor",
            "reasoning": "4-5 sentences. Narrative paragraph naming specific problems, their scores, any errors encountered, and overall coding ability."
        }},
        "soft_skills_evaluation": {{
            "grade": "Excellent" | "Good" | "Average" | "Poor",
            "reasoning": "4-5 sentences. Narrative paragraph referencing text assessment remarks and scores, explaining impact on teamwork and collaboration."
        }},
        "psychometric_evaluation": {{
            "grade": "Insight" | "Neutral",
            "reasoning": "2-3 sentences. Behavioral personality insight — NOT a pass/fail judgment."
        }},
        "integrity_observation": {{
            "status": "Acceptable" | "Observation",
            "reasoning": "2-3 sentences. Factual description of any concerns, with explicit statement that it does not affect hiring decision."
        }},
        "final_decision": {{
             "status": "Hire" | "No Hire" | "Strong Hire" | "Consider for Future",
             "summary": "5-7 sentences. Comprehensive final verdict naming the candidate, synthesizing all evaluations, explaining the decision, and providing a clear recommendation."
        }}
    }}
    """
    
    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
        )
        return json.loads(clean_json_output(response.choices[0].message.content))
    except Exception as e:
        print(f"Error generating rationale: {e}")
        return {"error": str(e)}

def generate_psychometric_narrative(traits_data):
    """
    Uses a smaller, faster model (Llama-3 8b) to convert raw trait scores into a readable paragraph.
    Input: Dict of traits {'extraversion': 3.5, ...}
    Output: String (paragraph)
    """
    prompt = f"""
    Act as an Industrial-Organizational Psychologist.
    Convert the following Big Five personality trait scores (0-5 scale) into a single, professional, easy-to-read paragraph summarizing the candidate's personality profile.
    
    TRAIT SCORES:
    {json.dumps(traits_data, indent=2)}
    
    GUIDELINES:
    - Do NOT list the scores numbers in the text.
    - Focus on behaviors: e.g., "The candidate is highly organized..." instead of "Conscientiousness is 4.5".
    - Be balanced and professional.
    - Keep it under 80 words.
    - Return ONLY the paragraph text. No JSON, no intro.
    """
    
    try:
        # User requested 70b for better quality even for summary if possible, but 8b is fast.
        # User said "use 70b model for generating output instead of 8b" generally.
        # Let's switch this to 70b as well to be safe and high quality.
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile", 
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error generating psychometric narrative: {e}")
        return "Psychometric analysis available but narrative generation failed."

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
        print(f"🔄 Fetching raw score data for Candidate {candidate_id}...")
        
        # 1. Resume Data
        candidate = CandidateAuth.query.get(candidate_id)
        if not candidate:
             print(f"❌ Candidate {candidate_id} not found.")
             return None
        resume_data = candidate.resume_data if candidate.resume_data else {"error": "Resume data not processed yet."}
        
        # 2. MCQ Data (Raw Score)
        mcq_result = MCQResult.query.filter_by(student_id=candidate_id).first()
        if mcq_result:
            mcq_data = {
                "percentage": mcq_result.percentage_correct,
                "correct": mcq_result.correct_answers,
                "total": mcq_result.correct_answers + mcq_result.wrong_answers
            }
        else:
            mcq_data = {"percentage": 0, "error": "MCQ not taken."}
        
        # 3. Psychometric Data (Raw Traits)
        psycho_result = PsychometricResult.query.filter_by(student_id=candidate_id).first()
        if psycho_result:
            # Map 0-50 scores to 0-5 for clarity in prompt
            psycho_data = {
                "extraversion": round(psycho_result.extraversion / 10, 1),
                "agreeableness": round(psycho_result.agreeableness / 10, 1),
                "conscientiousness": round(psycho_result.conscientiousness / 10, 1),
                "emotional_stability": round(psycho_result.emotional_stability / 10, 1),
                "intellect_imagination": round(psycho_result.intellect_imagination / 10, 1)
            }
        else:
            psycho_data = {"error": "Psychometric not taken."}
        
        # 4. Text Assessment Data (Grading JSON directly)
        text_result = TextAssessmentResult.query.filter_by(candidate_id=candidate_id).first()
        text_data = text_result.grading_json if text_result and text_result.grading_json else {"error": "Text responses not graded yet."}

        # 5. Coding Data
        coding_result = CodingAssessmentResult.query.filter_by(candidate_id=candidate_id).first()
        if coding_result and coding_result.grading_json:
             coding_data = coding_result.grading_json
        else:
             # Try grading on the fly if missing
             coding_data = process_coding_grading(candidate_id, app) or {"error": "Coding not submitted."}

        # 6. Proctor Data
        # Fetch latest session to check grading
        last_session = ProctorSession.query.filter_by(candidate_id=candidate_id).order_by(ProctorSession.start_time.desc()).first()
        if last_session and last_session.grading_json:
            proctor_data = last_session.grading_json
        else:
            proctor_data = process_proctor_grading(candidate_id, app) or {"severity": "Unknown", "remark": "No session data."}

        
        print("🤖 Generating Final Rationale (Llama-70b)...")
        rationale_data = generate_final_rationale(resume_data, mcq_data, text_data, psycho_data, coding_data, proctor_data)
        
        # 5. Generate Readable Psychometric Summary (Llama-8b)
        if psycho_result:
            print("🧠 Generating Psychometric Narrative (Llama-8b)...")
            psycho_narrative = generate_psychometric_narrative(psycho_data)
            
            # Inject into the main rationale JSON
            if "psychometric_evaluation" in rationale_data:
                rationale_data["psychometric_evaluation"]["reasoning"] = psycho_narrative
                # Or keep the old reasoning and add this as summary? 
                # User request: "converts it into a neat formal paragraph which is easily readable"
                # Replacing 'reasoning' seems best as that's what is displayed on the frontend.
            else:
                 rationale_data["psychometric_evaluation"] = {
                     "grade": "Insight",
                     "reasoning": psycho_narrative
                 }
        
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
