import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Brain, Shield, User, CheckSquare, Code, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { candidateApi } from '@/lib/api';
import ResumeUpload from '@/components/molecules/ResumeUpload';
import { Card, CardContent } from '@/components/ui/card';
import { ROUND_CONFIGS, ROUND_ORDER } from '@/types/rounds';

interface CandidateData {
  email: string;
  resume_url?: string;
  resume_filename?: string;
  resume_uploaded_at?: string;
  mcq_completed?: boolean;
  mcq_completed_at?: string;
  psychometric_completed?: boolean;
  psychometric_completed_at?: string;
  technical_completed?: boolean;
  technical_completed_at?: string;
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
    
    // Check if all rounds are completed
    if (candidateData.mcq_completed && candidateData.psychometric_completed && candidateData.technical_completed) {
      alert('You have already completed all assessment rounds!');
      return;
    }
    
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
                  Complete a comprehensive assessment in three rounds. 
                  Make sure to upload your resume first to begin.
                </p>

                {/* Assessment Rounds Preview */}
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h4 className="font-medium text-sm mb-3">Assessment Workflow:</h4>
                  
                  {ROUND_ORDER.map((roundId, idx) => {
                    const config = ROUND_CONFIGS[roundId];
                    const Icon = roundId === 'mcq' ? CheckSquare : roundId === 'psychometric' ? Brain : Code;
                    const isCompleted = roundId === 'mcq' ? candidateData?.mcq_completed : 
                                       roundId === 'psychometric' ? candidateData?.psychometric_completed :
                                       candidateData?.technical_completed;
                    
                    return (
                      <div key={roundId} className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          isCompleted ? 'bg-green-500/20' : 'bg-primary/10'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <span className="text-sm font-semibold text-primary">{idx + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <h5 className={`font-medium text-sm ${isCompleted ? 'text-green-600' : ''}`}>
                              {config.name}
                            </h5>
                            {isCompleted ? (
                              <span className="text-xs text-green-600 font-medium">Completed ✓</span>
                            ) : (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {config.estimatedTime}min
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{config.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {candidateData?.mcq_completed && candidateData?.psychometric_completed && candidateData?.technical_completed ? (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
                    <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                      ✓ All assessment rounds completed! Our team will review your responses and get back to you soon.
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      <strong>Note:</strong> You must complete each round in sequence: 
                      MCQ → Psychometric → Technical. Once completed, a round cannot be retaken.
                    </p>
                  </div>
                )}

                <Button
                  size="lg"
                  className="w-full gap-2"
                  disabled={!candidateData?.resume_url || (candidateData?.mcq_completed && candidateData?.psychometric_completed && candidateData?.technical_completed)}
                  onClick={handleStartAssessment}
                >
                  {candidateData?.mcq_completed && candidateData?.psychometric_completed && candidateData?.technical_completed 
                    ? 'Assessment Completed' 
                    : candidateData?.mcq_completed 
                    ? 'Continue Assessment'
                    : 'Start Assessment'}
                  {!(candidateData?.mcq_completed && candidateData?.psychometric_completed && candidateData?.technical_completed) && (
                    <ArrowRight className="h-4 w-4" />
                  )}
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
