
import os
import requests

MODELS_DIR = r"c:\Users\yagye\OneDrive\Desktop\Hackathon\sandbox\hr-evaluation-system\frontend\public\models"
BASE_URL = "https://github.com/justadudewhohacks/face-api.js/raw/master/weights"

FILES_TO_DOWNLOAD = [
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
]

def download_models():
    if not os.path.exists(MODELS_DIR):
        print(f"Creating directory: {MODELS_DIR}")
        os.makedirs(MODELS_DIR)

    for file_name in FILES_TO_DOWNLOAD:
        url = f"{BASE_URL}/{file_name}"
        save_path = os.path.join(MODELS_DIR, file_name)
        
        if os.path.exists(save_path):
            print(f"Skipping {file_name} (already exists)")
            continue

        print(f"Downloading {file_name}...")
        try:
            resp = requests.get(url, stream=True)
            resp.raise_for_status()
            with open(save_path, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"Downloaded {file_name}")
        except Exception as e:
            print(f"Error downloading {file_name}: {e}")

if __name__ == "__main__":
    download_models()
