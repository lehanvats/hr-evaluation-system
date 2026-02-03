import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Brain, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { candidateApi } from '@/lib/api';
import ResumeUpload from '@/components/molecules/ResumeUpload';
import { Card, CardContent } from '@/components/ui/card';

interface CandidateData {
  email: string;
  resume_url?: string;
  resume_filename?: string;
  resume_uploaded_at?: string;
}

export default function CandidateHome() {
  const navigate = useNavigate();
  const [candidateData, setCandidateData] = useState<CandidateData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCandidateData = async () => {
    try {
      const result = await candidateApi.verifyToken();
      if (!(result.data as any)?.valid) {
        navigate('/candidate/login');
        return;
      }
      setCandidateData((result.data as any).user);
    } catch (error) {
      console.error('Failed to fetch candidate data:', error);
      navigate('/candidate/login');
    } finally {
      setLoading(false);
    }
  };

  // Check authentication on mount
  useEffect(() => {
    fetchCandidateData();
  }, []);

  const handleStartAssessment = () => {
    if (!candidateData?.resume_url) {
      alert('Please upload your resume before starting the assessment');
      return;
    }
    // TODO: Start assessment with uploaded resume
    navigate('/assessment/demo-123');
  };

  const handleUploadSuccess = () => {
    // Refresh candidate data after successful upload
    fetchCandidateData();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 animate-fade-in">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Welcome back!</h1>
              <p className="text-muted-foreground">{candidateData?.email}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Resume Upload Section */}
          <ResumeUpload
            currentResume={
              candidateData?.resume_url
                ? {
                    filename: candidateData.resume_filename || 'resume.pdf',
                    url: candidateData.resume_url,
                    uploadedAt: candidateData.resume_uploaded_at || new Date().toISOString(),
                  }
                : undefined
            }
            onUploadSuccess={handleUploadSuccess}
          />

          {/* Assessment Section */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Assessment</h3>
              
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <Brain className="h-4 w-4" />
                  AI-Powered Evaluation
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Complete a personalized assessment tailored to your experience and 
                  the role you're applying for. Make sure to upload your resume first.
                </p>

                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium text-sm">Assessment Features:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Personalized coding problems</li>
                    <li>• Real-time code evaluation</li>
                    <li>• Webcam proctoring</li>
                    <li>• Detailed feedback</li>
                  </ul>
                </div>

                <Button
                  size="lg"
                  className="w-full gap-2"
                  disabled={!candidateData?.resume_url}
                  onClick={handleStartAssessment}
                >
                  Start Assessment
                  <ArrowRight className="h-4 w-4" />
                </Button>

                {!candidateData?.resume_url && (
                  <p className="text-xs text-center text-amber-600">
                    ⚠️ Please upload your resume to start the assessment
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Secure & Private
          </div>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI-Powered
          </div>
        </div>
      </div>
    </div>
  );
}
