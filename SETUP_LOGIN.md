# Candidate Login System - Setup Guide

## Prerequisites

Before running the application, you need to:

1. **Set up PostgreSQL Database**
2. **Configure Environment Variables**
3. **Install Dependencies**

---

## Step 1: PostgreSQL Setup

### Option A: Local PostgreSQL

1. Install PostgreSQL on your machine
2. Create a database:
   ```sql
   CREATE DATABASE hr_evaluation;
   ```
3. Your connection string will be:
   ```
   postgresql://username:password@localhost:5432/hr_evaluation
   ```

### Option B: Cloud PostgreSQL (Recommended for Production)

Use services like:

- **Render** (https://render.com) - Free tier available
- **Supabase** (https://supabase.com) - Free tier available
- **Neon** (https://neon.tech) - Free tier available

They will provide you with a connection string.

---

## Step 2: Backend Configuration

1. **Navigate to backend directory:**

   ```bash
   cd backend
   ```

2. **Create `.env` file** (copy from `.env.example`):

   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file** with your actual values:

   ```env
   # Database Configuration
   DATABASE_URL=postgresql://username:password@localhost:5432/hr_evaluation

   # Security Keys (generate random strings for production)
   SECRET_KEY=your-secret-key-here
   JWT_SECRET=your-jwt-secret-here

   # JWT Configuration
   JWT_EXP_MINUTES=1440

   # Supabase Configuration (for resume uploads)
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your_supabase_anon_key
   ```

   **Note:** For resume upload feature to work, you need to set up Supabase storage. See [RESUME_UPLOAD_GUIDE.md](RESUME_UPLOAD_GUIDE.md) for details.

4. **Install Python dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

5. **Run the backend:**

   ```bash
   python run.py
   ```

   The backend will:
   - Connect to PostgreSQL
   - Create tables automatically (`candidate_auth` and `recruiter_auth`)
   - Start on `http://localhost:5000`

---

## Step 3: Frontend Configuration

1. **Navigate to frontend directory:**

   ```bash
   cd frontend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Run the frontend:**

   ```bash
   npm run dev
   ```

   The frontend will start on `http://localhost:5173` (or similar)

---

## Step 4: Create Test Candidate

Since there's no signup, you need to manually create a test candidate in the database.

### Option 1: Using Python Script

Create a file `create_candidate.py` in the backend directory:

```python
from app import create_app
from app.models import CandidateAuth
from app.extensions import db

app = create_app()

with app.app_context():
    # Create a test candidate
    candidate = CandidateAuth(email='test@example.com')
    candidate.set_password('password123')  # This will hash the password

    db.session.add(candidate)
    db.session.commit()

    print(f'Created candidate: {candidate.email}')
```

Run it:

```bash
python create_candidate.py
```

### Option 2: Using PostgreSQL Client

```sql
-- Note: You need to hash the password using bcrypt
-- This is just an example, use the Python script above for proper hashing
INSERT INTO candidate_auth (email, password)
VALUES ('test@example.com', 'hashed_password_here');
```

---

## Step 5: Test the Login

1. Open your browser to `http://localhost:5173`
2. Click "I'm a Candidate"
3. Login with:
   - Email: `test@example.com`
   - Password: `password123`

---

## API Endpoints

### Candidate Authentication

#### Login

- **URL:** `POST /api/candidate/login`
- **Body:**
  ```json
  {
    "email": "test@example.com",
    "password": "password123"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "user": {
      "id": 1,
      "email": "test@example.com"
    }
  }
  ```

#### Verify Token

- **URL:** `GET /api/candidate/verify`
- **Headers:**
  ```
  Authorization: Bearer <token>
  ```
- **Response:**
  ```json
  {
    "valid": true,
    "user": {
      "id": 1,
      "email": "test@example.com"
    }
  }
  ```

---

## Troubleshooting

### Database Connection Error

- Verify your `DATABASE_URL` in `.env`
- Make sure PostgreSQL is running
- Check username/password are correct

### CORS Error

- Backend should have CORS enabled for `http://localhost:5173`
- Check `__init__.py` has CORS configured

### Token Not Working

- Check JWT_SECRET is the same in `.env`
- Verify token is being stored in localStorage
- Check browser console for errors

---

## Next Steps

- Add more candidates via the Python script
- Implement recruiter login (similar structure)
- Add password reset functionality
- Add email verification
