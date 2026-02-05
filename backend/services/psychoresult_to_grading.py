import json
import os
import sys

# Add parent directory to path to allow importing from sibling modules if needed, 
# though we try to keep this standalone or use relative imports in package context.
# For running as script:
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.placeholder_functions import client, clean_json_output

def evaluate_psychometric_match(psychometric_scores, target_trait):
    """
    Input: 
        psychometric_scores: Dict { "Extraversion": float, "Agreeableness": float, ... }
        target_trait: String (e.g., "Conscientiousness") or None
    Output: JSON object { "match_grade": "High"|"Medium"|"Low", "analysis": str }
    """
    if not target_trait:
        return {
            "match_grade": "N/A",
            "analysis": "No target trait specified. Psychometric profile is neutral."
        }

    prompt = f"""
    Evaluate the candidate's psychometric fit for a role requiring high {target_trait}.
    
    Candidate Scores (0-5 scale):
    {json.dumps(psychometric_scores, indent=2)}
    
    Target Trait: {target_trait}
    
    1. Determine if the candidate's score for the Target Trait (and related traits) makes them a good fit.
    2. Assign a Grade: "High Match", "Medium Match", or "Low Match".
    3. Write a 1-sentence analysis.
    
    Return ONLY valid JSON: {{ "match_grade": "<string>", "analysis": "<string>" }}
    """
    
    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
        )
        return json.loads(clean_json_output(response.choices[0].message.content))
    except Exception as e:
        print(f"Error in evaluate_psychometric_match: {e}")
        return {"match_grade": "Error", "analysis": "Failed to evaluate due to AI error."}

if __name__ == "__main__":
    # Test run
    test_scores = {
        "Extraversion": 80,
        "Agreeableness": 75,
        "Conscientiousness": 90,
        "Emotional Stability": 70,
        "Intellect/Imagination": 85
    }
    target = "Conscientiousness"
    print(json.dumps(evaluate_psychometric_match(test_scores, target), indent=2))
