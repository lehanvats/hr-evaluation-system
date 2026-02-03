# Resume Upload Setup Checklist

## 📦 Installation Steps

### 1. Install Python Dependencies
```bash
cd backend
pip install supabase
```

Or reinstall all requirements:
```bash
pip install -r requirements.txt
```

### 2. Configure Supabase

#### A. Get Supabase Credentials
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy:
   - Project URL (e.g., `https://xxxxx.supabase.co`)
   - Anon/Public Key (starts with `eyJ...`)

#### B. Create Storage Bucket
1. Go to Storage in Supabase dashboard
2. Click "New bucket"
3. Name: `uploads`
4. Settings:
   - Public bucket: ✅ YES
   - File size limit: 5242880 (5MB)
   - Allowed MIME types: `application/pdf`
5. Click "Create bucket"

#### C. Set Bucket Policies (Optional but Recommended)
In SQL Editor, run:
```sql
-- Allow authenticated uploads
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

-- Allow public access to read files
CREATE POLICY "Allow public access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'uploads');
```

### 3. Update Environment Variables

Edit `backend/.env` and add:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_supabase_anon_key
```

**Example:**
```env
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
JWT_SECRET=your-jwt-secret
SUPABASE_URL=https://xxxyyyzz.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Run Database Migration

The new columns will be added automatically when you start the backend:
```bash
cd backend
python run.py
```

Look for output:
```
 * Running on http://127.0.0.1:5000
```

If you see errors about missing columns, the migration will create them automatically.

### 5. Test the Feature

#### A. Backend Test (Optional)
Test with curl:
```bash
# First login to get token
curl -X POST http://localhost:5000/api/candidate/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Then upload resume (replace YOUR_TOKEN and file path)
curl -X POST http://localhost:5000/api/resume/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "resume=@/path/to/resume.pdf"
```

#### B. Frontend Test
1. Start frontend:
   ```bash
   cd frontend
   npm run dev
   ```

2. Open browser to `http://localhost:5173`

3. Login as candidate

4. You should see:
   - Resume Upload section on left
   - Assessment section on right
   - "Start Assessment" button disabled until resume uploaded

5. Test resume upload:
   - Drag and drop a PDF file OR click to browse
   - File should be validated (PDF only, max 5MB)
   - Click "Upload Resume"
   - You should see success message
   - Resume should appear in "Current Resume" section
   - "Start Assessment" button should become enabled

6. Verify in Supabase:
   - Go to Storage → uploads bucket
   - You should see your file: `resume_1_20240115_103000.pdf`
   - File should be downloadable

## ✅ Verification Checklist

- [ ] Supabase package installed (`pip install supabase`)
- [ ] Supabase URL added to `.env`
- [ ] Supabase KEY added to `.env`
- [ ] Storage bucket "uploads" created in Supabase
- [ ] Bucket set to public
- [ ] File size limit set to 5MB
- [ ] PDF MIME type allowed
- [ ] Backend starts without errors
- [ ] Database has new resume columns (auto-created)
- [ ] Frontend starts without errors
- [ ] Can login as candidate
- [ ] Resume upload section visible
- [ ] Can drag-and-drop PDF file
- [ ] Can browse and select PDF file
- [ ] Upload shows success message
- [ ] Current resume displays after upload
- [ ] Can view uploaded resume (click "View")
- [ ] Start Assessment button enables after upload
- [ ] File appears in Supabase bucket

## 🐛 Troubleshooting

### Error: "ModuleNotFoundError: No module named 'supabase'"
**Fix**: Run `pip install supabase` in backend directory

### Error: "Failed to upload to storage"
**Fix**: 
- Check SUPABASE_URL is correct in .env (should start with https://)
- Check SUPABASE_KEY is correct in .env
- Verify bucket "uploads" exists in Supabase
- Check bucket is set to public

### Error: "Only PDF files are allowed"
**Fix**: Ensure file has .pdf extension and is actually a PDF

### Resume not showing after upload
**Fix**: Refresh the page to reload candidate data

### Database error about missing columns
**Fix**: 
- Stop backend
- Start backend again - it should create columns automatically
- If still failing, check backend console for SQL errors

### Frontend build errors
**Fix**: 
- Run `npm install` in frontend directory
- Clear node_modules and reinstall: `rm -rf node_modules; npm install`

## 📝 Testing Scenarios

### Valid Upload
1. Login as candidate
2. Select valid PDF file (<5MB)
3. Upload should succeed
4. Resume should display
5. Can view resume
6. Assessment button enabled

### Invalid File Type
1. Try to upload .doc or .docx file
2. Should see error: "Only PDF files are allowed"

### Large File
1. Try to upload PDF >5MB
2. Should see error: "File size must be less than 5MB"

### No Token
1. Try to access upload endpoint without login
2. Should see error: "Authentication required"

### Replace Resume
1. Upload first resume
2. Upload second resume
3. Second resume should replace first
4. Old file remains in Supabase (for history)

## 📞 Need Help?

Check these resources:
- [RESUME_UPLOAD_GUIDE.md](RESUME_UPLOAD_GUIDE.md) - Complete feature documentation
- [RESUME_UPLOAD_IMPLEMENTATION.md](RESUME_UPLOAD_IMPLEMENTATION.md) - Implementation details
- Backend console logs for error details
- Browser console for frontend errors
- Supabase dashboard for storage issues

## 🎉 Success!

If all checkboxes are checked, your resume upload feature is ready to use!

Candidates can now:
- Upload their resume to cloud storage
- View their uploaded resume
- Start assessments (only after uploading resume)
- Replace their resume anytime
