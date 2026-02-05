import json
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.placeholder_functions import client, clean_json_output

def evaluate_text_responses(qa_pairs):
    """
    Input: qa_pairs (List[Dict]) - List of { "question": str, "answer": str }
    Output: JSON Object { "remark": "One sentence summary..." }
    """
    prompt = f"""
    Analyze the following Candidate Q&A responses:
    {json.dumps(qa_pairs, indent=2)}
    
    Task:
    Read all the answers and provide a SINGLE, comprehensive sentence remarking on the candidate's communication skills, depth of understanding, and clarity. Be very critical and keep the tone professional.
    
    Return ONLY valid JSON: {{ "remark": "<one sentence string>" }}
    """
    
    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
        )
        return json.loads(clean_json_output(response.choices[0].message.content))
    except Exception as e:
        print(f"Error in evaluate_text_responses: {e}")
        return {"remark": "Error during AI evaluation."}

if __name__ == "__main__":
    test_data = [
        {"question": "Tell me about yourself", "answer": "I am a developer."}
    ]
    print(json.dumps(evaluate_text_responses(test_data), indent=2))
