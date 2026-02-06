# HR Evaluation Platform

A comprehensive, AI-enhanced platform for automating candidate assessments, including coding challenges, MCQ tests, psychometric analysis, and resume screening. The system features a robust backend with integrated computer vision proctoring and a modern React-based frontend.

##  Key Features

*   **Assessment Modules**:
    *   **Coding Challenges**: Integrated code execution environment with PostgreSQL-based problem bank.
    *   **MCQ Tests**: Customizable multiple-choice questions.
    *   **Psychometric Analysis**: Evaluate candidate traits and behavioral fit.
    *   **Text-Based Questions**: Essay/short-answer grading.
*   **AI Proctoring**:
    *   **Server-Side Computer Vision**: Uses OpenCV and MediaPipe (Python) to detect fraud.
    *   **Violation Detection**: Tracks multiple faces, no face, looking away, and suspicious objects (phones/hands).
    *   **Session Playback**: Records candidate behavior for review.
*   **Recruiter Dashboard**:
    *   **Bulk Upload**: Import candidates via CSV/Excel.
    *   **Question Bank**: Import coding problems from local file repositories.
    *   **Analytics**: View candidate scores and proctoring logs.
*   **Resume Screening**: Upload and parse resumes to match job descriptions.

## Tech Stack

### Backend
*   **Language**: Python 3.12+
*   **Framework**: Flask (Blueprints architecture)
*   **Database**: PostgreSQL (via SQLAlchemy)
*   **Computer Vision**: OpenCV, MediaPipe
*   **Authentication**: JWT (JSON Web Tokens)

### Frontend
*   **Framework**: React (Vite)
*   **Language**: TypeScript
*   **UI Library**: Tailwind CSS, Shadcn UI
*   **State Management**: React Query, React Context

## Prerequisites

*   **Python**: 3.12 or higher
*   **Node.js**: 18.0 or higher
*   **PostgreSQL**: Local installation or cloud instance (Supabase supported).

## Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd hr-evaluation-platform
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
# Note: 'mediapipe' version is pinned to 0.10.14 for API compatibility
pip install -r requirements.txt

# Configure Environment
# Create a .env file based on example or set variables:
# DATABASE_URL=postgresql://user:password@localhost/dbname
# JWT_SECRET=your_secret_key

# Run Database Migrations/Setup
python run.py  # The app creates tables on first run
```

### 3. Frontend Setup
```bash
cd frontend

# Install Node modules
npm install

# Start Development Server
npm run dev
```

## 🖥️ Usage

### Starting the System
1.  **Backend**: `python run.py` (Runs on port 5000)
2.  **Frontend**: `npm run dev` (Runs on port 5173)

### User Roles
*   **Recruiter**: Login to dashboard, create assessments, upload candidates, review results.
*   **Candidate**: Login with credentials provided via email, take assigned assessments.

### Testing Proctoring
Refer to [PROCTORING_TEST_GUIDE.md](./PROCTORING_TEST_GUIDE.md) for detailed instructions on verifying the AI proctoring system.

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── services/       # Business logic (AI, Coding, etc.)
│   │   ├── ProctorService/ # Proctoring API endpoints
│   │   ├── CandidateAuth/  # Candidate login/auth
│   │   ├── ...             # Other modules
│   │   ├── models.py       # Database Schema
│   │   └── extensions.py   # DB & Config initialization
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks (useFaceDetection)
│   │   ├── pages/          # Application routes/pages
│   │   └── lib/            # Utilities
│   └── package.json
└── CODING SAMPLE QUESTIONS/# Repository of coding problems
```

## Documentation Index

*   **[Technical Architecture](./TECHNICAL_DOCS.md)**: Detailed system design and data flow.
*   **[Proctoring Guide](./PROCTORING_TEST_GUIDE.md)**: How to test the vision system.
*   **[API Documentation](./API_DOCUMENTATION.md)**: Endpoint reference.
*   **[Coding Import Feature](./CODING_IMPORT_FEATURE.md)**: How the coding bank works.

## Contributing

1.  Create a feature branch (`git checkout -b feature/amazing-feature`).
2.  Commit your changes.
3.  Push to the branch.
4.  Open a Pull Request.

**Note**: Do not push directly to the `main` branch.

## License

[MIT License](LICENSE)
