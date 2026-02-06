import json
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.placeholder_functions import client, clean_json_output

def evaluate_text_responses(qa_pairs):
    """
    Input: qa_pairs (List[Dict]) - List of { "question": str, "answer": str }
    Output: JSON Object with per-question remarks:
    {
        "remarks": [
            { "question": "...", "answer": "...", "remark": "..." },
            ...
        ],
        "overall_remark": "One sentence summary...",
        "remark": "One sentence summary..."   # backward compat
    }
    """
    prompt = f"""
    Analyze the following Candidate Q&A responses:
    {json.dumps(qa_pairs, indent=2)}
    
    Task:
    1. For EACH question-answer pair, write a brief 1-2 sentence professional remark evaluating the quality, relevance, depth, and articulation of the answer.
    2. Then provide a SINGLE overall sentence summarizing the candidate's communication skills across all responses.
    
    Be very critical and keep the tone professional.
    
    Return ONLY valid JSON in this exact format:
    {{
        "remarks": [
            {{ "question": "<original question>", "answer": "<original answer>", "remark": "<1-2 sentence evaluation>" }},
            ...
        ],
        "overall_remark": "<one sentence overall summary>"
    }}
    """
    
    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
        )
        result = json.loads(clean_json_output(response.choices[0].message.content))
        
        # Ensure backward compatibility: also set top-level 'remark' key
        if 'overall_remark' in result and 'remark' not in result:
            result['remark'] = result['overall_remark']
        
        return result
    except Exception as e:
        print(f"Error in evaluate_text_responses: {e}")
        return {"remark": "Error during AI evaluation.", "remarks": [], "overall_remark": "Error during AI evaluation."}


def grade_text_responses(remarks_data):
    """
    Takes the per-question remarks from evaluate_text_responses and assigns a numerical score (0-100) to each.
    
    Input: remarks_data - the output of evaluate_text_responses, containing 'remarks' list
    Output: JSON Object:
    {
        "grades": [
            { "question": "...", "score": 85, "justification": "..." },
            ...
        ],
        "communication_score": 72.5   <-- average of all scores
    }
    
    Scoring guide:
    - 100: Perfect answer with excellent articulation, depth, and relevance
    - 70-99: Good answer, clear and relevant with minor gaps
    - 40-69: Average answer, partially relevant or lacking depth
    - 1-39: Poor answer, vague, off-topic, or poorly articulated
    - 0: Blank, gibberish, or completely irrelevant
    """
    remarks_list = remarks_data.get('remarks', [])
    
    if not remarks_list:
        return {"grades": [], "communication_score": 0}
    
    prompt = f"""
    You are a strict but fair evaluator grading candidate answers for a hiring assessment.
    
    Below are question-answer pairs along with an AI-generated remark about each answer.
    For EACH entry, assign a numerical score from 0 to 100.
    
    SCORING GUIDE:
    - 90-100: Excellent — thorough, articulate, highly relevant, demonstrates deep understanding.
    - 70-89: Good — clear and relevant, minor gaps in depth or articulation.
    - 50-69: Average — partially relevant, lacks depth or clarity, acceptable but not impressive.
    - 20-49: Poor — vague, off-topic, shallow, or poorly communicated.
    - 0-19: Very Poor — blank, gibberish, completely irrelevant, or single-word non-answer.
    
    DATA:
    {json.dumps(remarks_list, indent=2)}
    
    Return ONLY valid JSON in this exact format:
    {{
        "grades": [
            {{ "question": "<original question>", "score": <0-100>, "justification": "<one sentence why>" }},
            ...
        ]
    }}
    """
    
    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
        )
        result = json.loads(clean_json_output(response.choices[0].message.content))
        
        grades = result.get('grades', [])
        
        # Calculate average score
        if grades:
            scores = [g.get('score', 0) for g in grades]
            avg_score = round(sum(scores) / len(scores), 1)
        else:
            avg_score = 0
        
        result['communication_score'] = avg_score
        return result
    except Exception as e:
        print(f"Error in grade_text_responses: {e}")
        return {"grades": [], "communication_score": 0}


if __name__ == "__main__":
    test_data = [
        {"question": "Tell me about yourself", "answer": "I am a developer."},
        {"question": "What is your greatest strength?", "answer": "I work hard and learn fast."}
    ]
    remarks = evaluate_text_responses(test_data)
    print("=== Remarks ===")
    print(json.dumps(remarks, indent=2))
    
    grades = grade_text_responses(remarks)
    print("\n=== Grades ===")
    print(json.dumps(grades, indent=2))
