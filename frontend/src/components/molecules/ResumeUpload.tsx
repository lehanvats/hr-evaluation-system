import { useState } from 'react';
import { Upload, FileText, CheckCircle, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';

interface ResumeUploadProps {
  currentResume?: {
    filename: string;
    url: string;
    uploadedAt: string;
  };
  onUploadSuccess?: () => void;
}

export default function ResumeUpload({ currentResume, onUploadSuccess }: ResumeUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    setSuccess(false);

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are allowed');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem('candidate_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const formData = new FormData();
      formData.append('resume', selectedFile);

      const response = await fetch('http://localhost:5000/api/resume/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        setSelectedFile(null);
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } else {
        setError(data.message || 'Upload failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload resume');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
    setSuccess(false);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-4">Resume Upload</h3>

        {/* Current Resume Info */}
        {currentResume && !selectedFile && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-800">
                    <strong>Current Resume:</strong> {currentResume.filename}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Uploaded: {new Date(currentResume.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                <a
                  href={currentResume.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  View
                </a>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {!selectedFile ? (
            <>
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 mb-2">
                Drag and drop your resume here, or click to browse
              </p>
              <p className="text-xs text-gray-500 mb-4">
                PDF only, max 5MB
              </p>
              <Button
                variant="outline"
                onClick={() => document.getElementById('resume-input')?.click()}
              >
                Select File
              </Button>
              <input
                id="resume-input"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </>
          ) : (
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div className="text-left">
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFile}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <Alert className="mt-4 bg-red-50 border-red-200">
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {success && (
          <Alert className="mt-4 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Resume uploaded successfully!
            </AlertDescription>
          </Alert>
        )}

        {/* Upload Button */}
        {selectedFile && (
          <Button
            className="w-full mt-4"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload Resume'}
          </Button>
        )}

        {currentResume && (
          <p className="text-xs text-gray-500 mt-4 text-center">
            Uploading a new resume will replace your current one
          </p>
        )}
      </CardContent>
    </Card>
  );
}
