import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Upload, FileText, AlertCircle, Download } from 'lucide-react';

interface TextBasedUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
}

interface UploadResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export default function TextBasedUploadDialog({
  open,
  onOpenChange,
  onUploadComplete,
}: TextBasedUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      
      if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
        setError('Please select a valid CSV or Excel file');
        return;
      }

      setSelectedFile(file);
      setError(null);
      setUploadResult(null);
    }
  };

  const handleUploadClick = () => {
    if (!selectedFile) return;
    setShowConfirmDialog(true);
  };

  const handleConfirmUpload = async () => {
    setShowConfirmDialog(false);
    await handleUpload();
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      const token = localStorage.getItem('recruiter_token');
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('http://localhost:5000/api/text-based/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setUploadResult(data.results);
        onUploadComplete();
      } else {
        setError(data.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setError(null);
    onOpenChange(false);
  };

  const downloadSampleFile = () => {
    // Sample CSV content
    const csvContent = `question_id,question
1,"Describe your experience with team collaboration and how you handle conflicts in a team environment."
2,"Explain a challenging technical problem you solved and the approach you took to resolve it."
3,"What motivates you in your professional life and how do you stay productive?"
4,"Describe a time when you had to learn a new technology or skill quickly. How did you approach it?"
5,"How do you prioritize tasks when working on multiple projects simultaneously?"`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_text_based_upload.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Text-Based Questions</DialogTitle>
          <DialogDescription>
            Upload open-ended questions for candidates from a CSV or Excel file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Format Info */}
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              <strong>Required columns:</strong> question_id, question
              <br />
              <strong>Supported formats:</strong> CSV (.csv), Excel (.xlsx, .xls)
            </AlertDescription>
          </Alert>

          {/* Sample Download Button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={downloadSampleFile}
          >
            <Download className="mr-2 h-4 w-4" />
            Download Sample Template
          </Button>

          {/* File Input */}
          <div className="space-y-2">
            <label
              htmlFor="file-upload"
              className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
            >
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  {selectedFile
                    ? selectedFile.name
                    : 'Click to select a file or drag and drop'}
                </p>
                <p className="text-xs text-gray-500">CSV or Excel (max 10MB)</p>
              </div>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                disabled={uploading}
              />
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Upload Result */}
          {uploadResult && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-semibold">Upload completed successfully!</p>
                  <ul className="text-sm space-y-0.5">
                    <li>✅ Total rows: {uploadResult.total}</li>
                    <li>✅ Created: {uploadResult.created}</li>
                    <li>✅ Updated: {uploadResult.updated}</li>
                    {uploadResult.skipped > 0 && (
                      <li className="text-yellow-600">⚠️ Skipped: {uploadResult.skipped}</li>
                    )}
                  </ul>
                  {uploadResult.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-red-600">
                        View errors ({uploadResult.errors.length})
                      </summary>
                      <ul className="mt-1 text-xs space-y-0.5 max-h-32 overflow-y-auto">
                        {uploadResult.errors.map((err, idx) => (
                          <li key={idx} className="text-red-600">
                            {err}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Upload Button */}
          <div className="flex gap-2">
            <Button
              onClick={handleUploadClick}
              disabled={!selectedFile || uploading}
              className="flex-1"
            >
              {uploading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Questions
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace All Questions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>permanently delete all existing text-based questions</strong> and replace them with the questions from your file.
              <br /><br />
              <strong>⚠️ Warning:</strong> Any candidate answers to deleted questions will remain in the database but won't have corresponding questions.
              <br /><br />
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpload} className="bg-red-600 hover:bg-red-700">
              Delete All & Upload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
