import json
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.placeholder_functions import client, clean_json_output

def parse_resume_to_json(resume_text):
    """
    Input: Raw string text extracted from PDF.
    Output: JSON object { "name": str, "email": str, "skills": list, "experience_years": int }
    """
    prompt = f"""
    Extract the following details from the resume text below:
    - Name
    - Email
    - List of Technical Skills
    - Total Years of Experience (Integer)
    - List of Projects (short summaries)
    - Education (Degrees, GPA if available)

    Resume Text:
    {resume_text}

    Return ONLY valid JSON. No preamble.
    """
    
    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
        )
        return json.loads(clean_json_output(response.choices[0].message.content))
    except Exception as e:
        print(f"Error in parse_resume_to_json: {e}")
        return {}

if __name__ == "__main__":
    # Test stub
    print("Resume parser service loaded.")
