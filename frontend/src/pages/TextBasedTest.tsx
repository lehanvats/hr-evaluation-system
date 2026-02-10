import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertCircle, FileText, Send, Save, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useNavigate } from 'react-router-dom';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

interface TextBasedQuestion {
  id: number;
  question_id: number;
  question: string;
  created_at: string;
  updated_at: string;
}

interface TextBasedAnswer {
  id: number;
  student_id: number;
  question_id: number;
  answer: string;
  word_count: number;
  submitted_at: string;
  updated_at: string;
}

const MAX_WORDS = 200;

export default function TextBasedTest() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<TextBasedQuestion[]>([]);
  const [answers, setAnswers] = useState<Map<number, string>>(new Map());
  const [submittedAnswers, setSubmittedAnswers] = useState<Map<number, TextBasedAnswer>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [loading, setLoading] = useState(() => {
    // Check if data is preloaded - if so, start without loading screen
    const hasPreloaded = localStorage.getItem('preloaded_text_based_questions');
    return !hasPreloaded;
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showUnansweredWarning, setShowUnansweredWarning] = useState(false);
  const [unansweredQuestionsList, setUnansweredQuestionsList] = useState<number[]>([]);

  useEffect(() => {
    loadQuestions();
    loadExistingAnswers();
  }, []);

  useEffect(() => {
    // Load answer for current question
    const currentQuestion = questions[currentIndex];
    if (currentQuestion) {
      const existingAnswer = answers.get(currentQuestion.question_id) || '';
      setCurrentAnswer(existingAnswer);
    }
  }, [currentIndex, questions, answers]);

  const loadQuestions = async () => {
    try {
      // Check if questions were preloaded
      const preloadedQuestions = localStorage.getItem('preloaded_text_based_questions');
      
      if (preloadedQuestions) {
        console.log('⚡ Using preloaded text-based questions');
        const parsedQuestions = JSON.parse(preloadedQuestions);
        setQuestions(parsedQuestions);
        // Clear preloaded data after use
        localStorage.removeItem('preloaded_text_based_questions');
        // No need to set loading to false - initial state is already false when preloaded
        return;
      }

      // Fallback to normal loading if not preloaded
      console.log('📥 Fetching text-based questions...');
      setLoading(true);
      const token = localStorage.getItem('candidate_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/text-based/questions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success && data.questions) {
        setQuestions(data.questions);
      } else {
        setError(data.message || 'Failed to load questions');
      }
    } catch (err) {
      console.error('Error loading questions:', err);
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingAnswers = async () => {
    try {
      // Check if answers were preloaded
      const preloadedAnswers = localStorage.getItem('preloaded_text_based_answers');
      
      if (preloadedAnswers) {
        console.log('⚡ Using preloaded text-based answers');
        const parsedAnswers = JSON.parse(preloadedAnswers);
        
        const answerMap = new Map<number, string>();
        const submittedMap = new Map<number, TextBasedAnswer>();
        
        parsedAnswers.forEach((ans: TextBasedAnswer) => {
          answerMap.set(ans.question_id, ans.answer);
          submittedMap.set(ans.question_id, ans);
        });
        
        setAnswers(answerMap);
        setSubmittedAnswers(submittedMap);
        // Clear preloaded data after use
        localStorage.removeItem('preloaded_text_based_answers');
        return;
      }

      // Fallback to normal loading if not preloaded
      console.log('📥 Fetching text-based answers...');
      const token = localStorage.getItem('candidate_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/text-based/answers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success && data.answers) {
        const answerMap = new Map<number, string>();
        const submittedMap = new Map<number, TextBasedAnswer>();
        
        data.answers.forEach((answer: TextBasedAnswer) => {
          answerMap.set(answer.question_id, answer.answer);
          submittedMap.set(answer.question_id, answer);
        });
        
        setAnswers(answerMap);
        setSubmittedAnswers(submittedMap);
      }
    } catch (err) {
      console.error('Error loading existing answers:', err);
    }
  };

  const getWordCount = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const handleAnswerChange = (value: string) => {
    setCurrentAnswer(value);
    setSaveMessage(null);
  };

  const handleSaveAnswer = async (autoSave = false) => {
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion || !currentAnswer.trim()) {
      if (!autoSave) {
        setError('Please provide an answer before saving');
      }
      return false;
    }

    const wordCount = getWordCount(currentAnswer);
    if (wordCount > MAX_WORDS) {
      setError(`Answer exceeds ${MAX_WORDS} word limit (current: ${wordCount} words)`);
      return false;
    }

    setSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('candidate_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/text-based/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question_id: currentQuestion.question_id,
          answer: currentAnswer.trim()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Update local state
        const newAnswers = new Map(answers);
        newAnswers.set(currentQuestion.question_id, currentAnswer.trim());
        setAnswers(newAnswers);
        
        const newSubmitted = new Map(submittedAnswers);
        newSubmitted.set(currentQuestion.question_id, data.answer);
        setSubmittedAnswers(newSubmitted);
        
        if (!autoSave) {
          setSaveMessage('Answer saved successfully!');
          setTimeout(() => setSaveMessage(null), 3000);
        }
        return true;
      } else {
        setError(data.message || 'Failed to save answer');
        return false;
      }
    } catch (err) {
      console.error('Error saving answer:', err);
      setError('Failed to save answer');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleNextQuestion = async () => {
    // Auto-save current answer if it has content
    if (currentAnswer.trim()) {
      await handleSaveAnswer(true);
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSaveMessage(null);
      setError(null);
    }
  };

  const handlePreviousQuestion = async () => {
    // Auto-save current answer if it has content
    if (currentAnswer.trim()) {
      await handleSaveAnswer(true);
    }

    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setSaveMessage(null);
      setError(null);
    }
  };

  const handleCompleteTest = async () => {
    // Check if all questions are answered
    const unansweredQuestions = questions.filter(q => !submittedAnswers.has(q.question_id));
    
    if (unansweredQuestions.length > 0) {
      setUnansweredQuestionsList(unansweredQuestions.map(q => q.question_id));
      setShowUnansweredWarning(true);
      return;
    }

    await submitTest();
  };

  const submitTest = async () => {
    // Save current answer if it has changes
    if (currentAnswer.trim()) {
      const saved = await handleSaveAnswer(true);
      if (!saved) return;
    }

    setIsCompleting(true);
    try {
      const token = localStorage.getItem('candidate_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/text-based/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        // Redirect to coding round (next in workflow)
        navigate('/candidate/coding-test');
      } else {
        setError(data.message || 'Failed to complete test');
      }
    } catch (err) {
      console.error('Error completing test:', err);
      setError('Failed to complete test');
    } finally {
      setIsCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const answeredCount = submittedAnswers.size;
  const wordCount = getWordCount(currentAnswer);
  const isOverLimit = wordCount > MAX_WORDS;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-7rem)] animate-fade-in">
      {/* Assessment Header */}
      <div className="border-b border-border/50 bg-muted/20 flex-shrink-0">
        {/* Round Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-primary text-primary-foreground border-primary">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">Text-Based Assessment</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1">
              {answeredCount} / {questions.length} Answered
            </Badge>
            <Progress value={progress} className="w-32 h-2" />
            <span className="text-sm text-muted-foreground font-medium">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Current Question Info */}
        <div className="h-12 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-medium">Text-Based Questions</h1>
            {submittedAnswers.has(currentQuestion?.question_id) && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3" />
                Saved
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-6">
            {/* Timer Placeholder */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background border border-border">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm font-medium tabular-nums">30:00</span>
            </div>

            {/* Current Question Progress */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <Progress
                value={((currentIndex + 1) / questions.length) * 100}
                className="w-24 h-2"
              />
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handlePreviousQuestion}
                disabled={currentIndex === 0 || saving}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleNextQuestion}
                disabled={currentIndex === questions.length - 1 || saving}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split View */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel - Question */}
          <ResizablePanel defaultSize={40} minSize={30}>
            <div className="h-full flex flex-col bg-background">
              {/* Question Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="prose prose-sm max-w-none">
                  <div className="mb-4">
                    <Badge variant="outline" className="mb-2">
                      Question {currentIndex + 1}
                    </Badge>
                  </div>
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    {currentQuestion?.question}
                  </h2>
                  
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
                    <h3 className="text-sm font-semibold mb-2">Instructions:</h3>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Answer in your own words</li>
                      <li>Maximum {MAX_WORDS} words per answer</li>
                      <li>Be clear and concise</li>
                      <li>Your answer will be auto-saved when you navigate</li>
                    </ul>
                  </div>

                  {/* Question Navigator */}
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold mb-3">All Questions:</h3>
                    <div className="grid grid-cols-5 gap-2">
                      {questions.map((q, idx) => (
                        <Button
                          key={q.id}
                          variant={idx === currentIndex ? 'default' : 'outline'}
                          size="sm"
                          onClick={async () => {
                            if (currentAnswer.trim()) {
                              await handleSaveAnswer(true);
                            }
                            setCurrentIndex(idx);
                            setSaveMessage(null);
                            setError(null);
                          }}
                          className={`relative ${submittedAnswers.has(q.question_id) ? 'border-green-500' : ''}`}
                        >
                          {idx + 1}
                          {submittedAnswers.has(q.question_id) && (
                            <CheckCircle2 className="h-3 w-3 absolute -top-1 -right-1 text-green-600" />
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Answer Input */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="h-full flex flex-col bg-muted/5">
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Your Answer:</label>
                    <div className={`text-sm ${isOverLimit ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                      {wordCount} / {MAX_WORDS} words
                    </div>
                  </div>
                  
                  <Textarea
                    value={currentAnswer}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    placeholder="Type your answer here..."
                    className="min-h-[400px] text-base resize-none font-sans"
                    disabled={saving}
                  />

                  {isOverLimit && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Answer exceeds {MAX_WORDS} word limit. Please reduce your answer to save.
                      </AlertDescription>
                    </Alert>
                  )}

                  {error && !isOverLimit && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {saveMessage && (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>{saveMessage}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-border p-4 bg-background">
                <div className="flex items-center justify-between">
                  <Button
                    onClick={() => handleSaveAnswer(false)}
                    disabled={saving || !currentAnswer.trim() || isOverLimit}
                    variant="outline"
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Answer'}
                  </Button>

                  <div className="flex gap-2">
                    {currentIndex < questions.length - 1 ? (
                      <Button
                        onClick={handleNextQuestion}
                        disabled={saving}
                        className="gap-2"
                      >
                        Next Question
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        onClick={handleCompleteTest}
                        disabled={saving || isCompleting}
                        className="gap-2"
                      >
                        <Send className="h-4 w-4" />
                        {isCompleting ? 'Completing...' : 'Complete Test'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Footer Notice */}
      <div className="h-8 flex items-center justify-center gap-2 text-xs text-muted-foreground border-t border-border/50 bg-muted/20 flex-shrink-0">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>
          Your answers are being auto-saved. Complete all {questions.length} questions to finish the assessment.
        </span>
      </div>

      {/* Unanswered Questions Warning Dialog */}
      <AlertDialog open={showUnansweredWarning} onOpenChange={setShowUnansweredWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              There might be some questions unattended.
              <br /><br />
              After submission, this round will be <strong>locked</strong> and any unattended questions will be marked as <strong>null/not attempted</strong>.
              <br /><br />
              Are you sure you want to submit?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowUnansweredWarning(false); submitTest(); }}>
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}