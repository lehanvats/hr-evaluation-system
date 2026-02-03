# Resume Upload Feature Guide

## Overview
The resume upload feature allows candidates to upload their PDF resumes to Supabase cloud storage. The system stores the file URL and metadata in the database and prevents candidates from starting assessments without an uploaded resume.

## Architecture

### Backend Components

#### 1. Database Schema (models.py)
```python
class CandidateAuth:
    resume_url = db.Column(db.String(500), nullable=True)
    resume_filename = db.Column(db.String(255), nullable=True)
    resume_uploaded_at = db.Column(db.DateTime, nullable=True)
```

#### 2. Configuration (config.py)
```python
class Config:
    SUPABASE_URL = os.environ.get('SUPABASE_URL')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
    SUPABASE_BUCKET = 'uploads'  # Bucket name in Supabase
```

#### 3. API Endpoint
**Route:** `POST /api/resume/upload`

**Authentication:** Required (JWT Bearer token - candidate only)

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Field: 'resume' (PDF file)
- Headers: Authorization: Bearer <token>

**File Constraints:**
- File type: PDF only
- Maximum size: 5MB

**Response Success (200):**
```json
{
    "success": true,
    "message": "Resume uploaded successfully",
    "resume_url": "https://supabase-url/...",
    "filename": "resume.pdf"
}
```

**Response Error (400/401/500):**
```json
{
    "success": false,
    "message": "Error message"
}
```

**Status Codes:**
- 200: Upload successful
- 400: Bad request (no file, invalid file type, file too large)
- 401: Unauthorized (missing or invalid token)
- 404: Candidate not found
- 500: Server error (Supabase or database error)

**Processing Logic:**
1. Verify candidate authentication via JWT token
2. Validate file presence and type
3. Check file size (max 5MB)
4. Generate unique filename: `resume_{candidate_id}_{timestamp}.pdf`
5. Upload to Supabase storage bucket
6. Get public URL from Supabase
7. Update candidate record in database
8. Return success with file URL

### Frontend Components

#### 1. ResumeUpload Component
**Location:** `frontend/src/components/molecules/ResumeUpload.tsx`

**Features:**
- Drag and drop file upload
- File validation (PDF only, max 5MB)
- Upload progress indication
- Display current resume status
- View existing resume
- Replace existing resume

**Props:**
```typescript
interface ResumeUploadProps {
  currentResume?: {
    filename: string;
    url: string;
    uploadedAt: string;
  };
  onUploadSuccess?: () => void;
}
```

**Usage:**
```tsx
<ResumeUpload
  currentResume={candidateData?.resume_url ? {
    filename: candidateData.resume_filename,
    url: candidateData.resume_url,
    uploadedAt: candidateData.resume_uploaded_at
  } : undefined}
  onUploadSuccess={handleUploadSuccess}
/>
```

#### 2. CandidateHome Integration
**Location:** `frontend/src/pages/CandidateHome.tsx`

**Features:**
- Displays resume upload component
- Shows current resume status
- Enforces resume upload before assessment
- Refreshes data after successful upload

## Setup Instructions

### 1. Backend Setup

#### Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

Requirements include:
- `supabase` - Supabase Python client

#### Configure Environment Variables
Add to your `.env` file:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
```

#### Database Migration
Run migration to add resume fields:
```bash
python run.py
```

The application will automatically create the new columns if they don't exist.

### 2. Supabase Setup

#### Create Storage Bucket
1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `uploads`
3. Configure bucket settings:
   - Public: Yes (for public URL access)
   - File size limit: 5MB
   - Allowed MIME types: `application/pdf`

#### Set Bucket Policies
Create policy to allow authenticated uploads:
```sql
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Allow public access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'uploads');
```

### 3. Frontend Setup

No additional setup required. The component is ready to use.

## Usage Flow

### Candidate Flow
1. **Login:** Candidate logs in with credentials
2. **Dashboard:** Redirected to candidate home page
3. **Upload Resume:**
   - Drag and drop PDF file or click to browse
   - File is validated (PDF only, max 5MB)
   - Click "Upload Resume" button
   - File uploads to Supabase
   - Success message displayed
4. **View Resume:** Can view uploaded resume via "View" link
5. **Start Assessment:** Button enabled only after resume upload

### Technical Flow
1. **File Selection:** User selects PDF file via drag-and-drop or file picker
2. **Validation:** Client-side validation checks file type and size
3. **Upload:** File sent to backend via FormData
4. **Authentication:** Backend verifies candidate JWT token
5. **Storage:** File uploaded to Supabase with unique filename
6. **Database:** URL and metadata saved to candidate record
7. **Response:** Success message with URL returned to client
8. **Refresh:** Client refreshes candidate data to show updated resume

## Security Considerations

### Authentication
- All upload requests require valid JWT token
- Token verified before file processing
- Only candidates can upload to their own record

### File Validation
- Server-side validation of file type (PDF only)
- File size limit enforced (5MB max)
- Unique filename prevents conflicts

### Storage Security
- Files stored in isolated Supabase bucket
- Public URLs generated for easy access
- Bucket policies restrict upload to authenticated users

## Error Handling

### Client-Side Errors
- "No file provided" - No file selected
- "Only PDF files are allowed" - Invalid file type
- "File size must be less than 5MB" - File too large
- "Authentication required" - Missing or invalid token

### Server-Side Errors
- 401: Invalid or expired token
- 400: File validation failed
- 404: Candidate not found
- 500: Supabase upload error or database error

## Testing

### Manual Testing
1. Login as candidate
2. Try uploading non-PDF file (should fail)
3. Try uploading >5MB file (should fail)
4. Upload valid PDF file (should succeed)
5. Verify file appears in Supabase bucket
6. Verify resume status updates on page
7. Try starting assessment (should be enabled)
8. Upload another resume (should replace first)

### API Testing with curl
```bash
# Upload resume
curl -X POST http://localhost:5000/api/resume/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "resume=@/path/to/resume.pdf"

# Verify candidate data
curl -X GET http://localhost:5000/api/candidate/verify \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### "Failed to upload to storage" Error
- Check SUPABASE_URL and SUPABASE_KEY in .env
- Verify bucket exists and is named "uploads"
- Check bucket policies allow uploads

### "Database error" After Upload
- Verify database migration ran successfully
- Check resume_url, resume_filename, resume_uploaded_at columns exist
- Review backend console logs for SQL errors

### Resume Not Showing After Upload
- Check browser console for errors
- Verify candidate token is valid
- Refresh page to reload candidate data
- Check verify endpoint returns resume fields

## Future Enhancements

### Planned Features
- Resume preview/viewer
- Multiple resume versions
- Resume parsing with AI
- Automatic skill extraction
- Resume templates
- Download resume as candidate or recruiter

### Possible Improvements
- Support additional file formats (DOCX)
- Increase file size limit
- Add progress bar during upload
- Compress large files
- Generate resume thumbnails
