import json
import os
import sys

# For running as script:
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import client if we ever want to do AI based analysis, 
# but currently the logic is simple math. 
# However, to be consistent with "AI Grading" appearing in routes, maybe we want to keep the JSON return structure.
# authentic existing code in ai_functions.py was just math but returned JSON string.

def evaluate_mcq_performance(correct_answers, total_questions):
    """
    Calculates percentage and returns as a JSON string (or dict/object in this new implementation).
    The original returned a string "json.dumps(result)". 
    Routes expect a string result from this function or handle it?
    Checking route: `grading_str = evaluate_mcq_performance(...)` then `json.loads(grading_str)`.
    So the original function returned a STRING.
    
    However, for cleaner service architecture, let's return a DICT, 
    and let the route handle serialization if needed, or update route to expect dict.
    
    WAIT: The route does: `result.grading_json = json.loads(grading_str)`
    So if I return a DICT, I should update route to just use it directly.
    I will return a DICT here for better python practice.
    """
    if total_questions == 0:
        percentage = 0.0
    else:
        percentage = (correct_answers / total_questions) * 100
        
    result = {
        "percentage": round(percentage, 2)
    }
    # Return dict, will update route to not json.loads a dict.
    # OR: Keep it as string to minimize route changes? 
    # Logic in plan said "Update Routes". I prefer returning Dict.
    return result

if __name__ == "__main__":
    print(evaluate_mcq_performance(8, 10))
