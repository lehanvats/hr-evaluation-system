import json
import os

def evaluate_mcq_performance(correct_answers, total_questions):
    """
    Calculates percentage and returns as a JSON string.
    """
    if total_questions == 0:
        percentage = 0.0
    else:
        percentage = (correct_answers / total_questions) * 100
        
    result = {
        "percentage": round(percentage, 2)
    }
    return json.dumps(result)

def save_to_example_file(json_data):
    """
    Takes the JSON string and saves it to example.txt.
    """
    file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'example.txt')
    with open(file_path, 'w') as f:
        f.write(json_data)

if __name__ == "__main__":
    # Example values for testing
    total = 20
    correct = 18
    
    json_output = evaluate_mcq_performance(correct, total)
    print(json_output)
    save_to_example_file(json_output)


