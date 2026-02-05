import os
import base64
import json
from groq import Groq

def analyze_frame_with_llama(image_data_base64):
    """
    Analyze a webcam frame for an online exam proctoring system.
    Identify behaviors: face detected, multiple people, looking away, phone detected.
    """
    
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("WARNING: GROQ_API_KEY not found. Using mock response.")
        return {
            "face_detected": True,
            "multiple_faces": False,
            "looking_away": False,
            "phone_detected": False,
            "confidence": 1.0,
            "mock": True
        }

    try:
        client = Groq(api_key=api_key)
        
        # Prompt for the Vision Model
        prompt = """
        Analyze this webcam frame for an online exam proctoring system.
        Identify the following behaviors:
        1. Is there a face present? (yes/no)
        2. Are there multiple people? (yes/no)
        3. Is the person looking away from the screen? (yes/no)
        4. Is there a mobile phone visible? (yes/no)
        
        Respond in JSON format only:
        {
            "face_detected": boolean,
            "multiple_faces": boolean,
            "looking_away": boolean,
            "phone_detected": boolean,
            "confidence": float (0.0 to 1.0)
        }
        """

        # Check if the base64 string needs cleaning
        if "base64," in image_data_base64:
            image_data_base64 = image_data_base64.split("base64,")[1]

        completion = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct", # Updated to Llama 4 Scout (supported multimodal)

            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text", 
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_data_base64}"
                            }
                        }
                    ]
                }
            ],
            temperature=0.1,
            max_tokens=1024,
            top_p=1,
            stream=False,
            response_format={"type": "json_object"},
        )
        
        result_json = completion.choices[0].message.content
        return json.loads(result_json)

    except Exception as e:
        print(f"Vision Engine Error: {str(e)}")
        # Fallback response in case of error
        return {
            "face_detected": True,
            "multiple_faces": False,
            "looking_away": False,
            "phone_detected": False,
            "error": str(e)
        }
