import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2, Brain, Code, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ProblemViewer } from '@/components/molecules/ProblemViewer';
import { AssessmentInput } from '@/components/molecules/AssessmentInput';
import { ConsoleOutput } from '@/components/molecules/ConsoleOutput';
import { WebcamMonitor } from '@/components/molecules/WebcamMonitor';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { questionsByRound } from '@/lib/mock-data';
import { AssessmentQuestion } from '@/types/assessment';
import { AssessmentRound, ROUND_CONFIGS, ROUND_ORDER, RoundProgress } from '@/types/rounds';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { mcqApi, candidateApi } from '@/lib/api';

interface ConsoleLog {
  type: 'log' | 'error' | 'info' | 'success';
  message: string;
  timestamp: Date;
}

const ROUND_ICONS = {
  mcq: CheckSquare,
  psychometric: Brain,
  technical: Code
};

export default function Assessment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Round Management State
  const [currentRound, setCurrentRound] = useState<AssessmentRound>('mcq');
  const [roundProgress, setRoundProgress] = useState<Record<AssessmentRound, RoundProgress>>({
    mcq: { round: 'mcq', status: 'in-progress', answers: {}, currentQuestionIndex: 0 },
    psychometric: { round: 'psychometric', status: 'not-started', answers: {} },
    technical: { round: 'technical', status: 'not-started', answers: {} }
  });
  const [loading, setLoading] = useState(true);

  // Question State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [consoleExpanded, setConsoleExpanded] = useState(false);

  // Check candidate status and round completion on mount
  useEffect(() => {
    const checkCandidateStatus = async () => {
      try {
        const result = await candidateApi.verifyToken();
        
        if (result.error || !(result.data as any)?.valid) {
          navigate('/candidate/login');
          return;
        }
        
        const candidateData = (result.data as any).user;
        
        // Determine which round should be active based on completion status
        let activeRound: AssessmentRound = 'mcq';
        const updatedProgress = { ...roundProgress };
        
        if (candidateData.mcq_completed) {
          updatedProgress.mcq.status = 'completed';
          activeRound = 'psychometric';
        }
        
        if (candidateData.psychometric_completed) {
          updatedProgress.psychometric.status = 'completed';
          activeRound = 'technical';
        }
        
        if (candidateData.technical_completed) {
          updatedProgress.technical.status = 'completed';
          // All rounds completed, redirect to home
          navigate('/candidate/home');
          return;
        }
        
        setRoundProgress(updatedProgress);
        setCurrentRound(activeRound);
        setLoading(false);
      } catch (error) {
        console.error('Error checking candidate status:', error);
        navigate('/candidate/login');
      }
    };
    
    checkCandidateStatus();
  }, [navigate]);

  // Derived State
  const currentRoundQuestions = questionsByRound[currentRound];
  const currentQuestion: AssessmentQuestion = currentRoundQuestions[currentQuestionIndex];
  const totalQuestions = currentRoundQuestions.length;
  const currentAnswer = roundProgress[currentRound].answers[currentQuestion.id];
  const currentRoundConfig = ROUND_CONFIGS[currentRound];

  // Get overall progress
  const overallProgress = (() => {
    const completedRounds = ROUND_ORDER.filter(r => roundProgress[r].status === 'completed').length;
    const currentRoundIdx = ROUND_ORDER.indexOf(currentRound);
    const currentRoundProgress = (currentQuestionIndex / totalQuestions);
    return ((completedRounds + currentRoundProgress) / ROUND_ORDER.length) * 100;
  })();

  // Logic
  const addLog = useCallback((type: ConsoleLog['type'], message: string) => {
    setConsoleLogs((prev) => [...prev, { type, message, timestamp: new Date() }]);
  }, []);

  const clearLogs = useCallback(() => {
    setConsoleLogs([]);
  }, []);

  const handleAnswerChange = (value: any) => {
    setRoundProgress(prev => ({
      ...prev,
      [currentRound]: {
        ...prev[currentRound],
        answers: {
          ...prev[currentRound].answers,
          [currentQuestion.id]: value
        },
        currentQuestionIndex
      }
    }));
  };

  const handleRunCode = async () => {
    if (currentQuestion.type !== 'coding') return;

    setIsRunning(true);
    addLog('info', 'Compiling and running code...');

    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 1500));

    addLog('success', 'All test cases passed!');
    setIsRunning(false);
  };

  const completeCurrentRound = async () => {
    // If completing MCQ round, submit all answers to backend
    if (currentRound === 'mcq') {
      try {
        addLog('info', 'Submitting MCQ answers...');
        
        // Prepare answers in the format backend expects
        const answers = Object.entries(roundProgress.mcq.answers).map(([questionId, answer]) => ({
          question_id: parseInt(questionId),
          answer_option: answer
        }));
        
        // Submit and lock the MCQ round
        const result = await mcqApi.completeRound(answers);
        
        if (result.error) {
          addLog('error', `Failed to submit MCQ answers: ${result.error}`);
          console.error('MCQ submission error:', result.error);
        } else {
          addLog('success', `MCQ answers submitted successfully! Total: ${answers.length}`);
          console.log('MCQ submission result:', result.data);
        }
      } catch (error) {
        addLog('error', 'Error submitting MCQ answers');
        console.error('MCQ submission error:', error);
      }
    }
    
    setRoundProgress(prev => ({
      ...prev,
      [currentRound]: {
        ...prev[currentRound],
        status: 'completed',
        completedAt: new Date()
      }
    }));
  };

  const moveToNextRound = () => {
    const currentIdx = ROUND_ORDER.indexOf(currentRound);
    if (currentIdx < ROUND_ORDER.length - 1) {
      const nextRound = ROUND_ORDER[currentIdx + 1];
      setCurrentRound(nextRound);
      setCurrentQuestionIndex(0);
      setRoundProgress(prev => ({
        ...prev,
        [nextRound]: {
          ...prev[nextRound],
          status: 'in-progress',
          startedAt: new Date()
        }
      }));
      addLog('success', `Starting ${ROUND_CONFIGS[nextRound].name}...`);
    } else {
      // All rounds completed
      addLog('success', 'Assessment completed! Submitting your responses...');
      setTimeout(() => {
        navigate('/candidate/home');
      }, 2000);
    }
  };

  const handleSubmitQuestion = async () => {
    if (currentQuestion.type === 'coding') {
      handleRunCode();
    }
    
    // Move to next question or complete round
    if (currentQuestionIndex < totalQuestions - 1) {
      handleNext();
    } else {
      // Round completed
      await completeCurrentRound();
      addLog('success', `${currentRoundConfig.name} completed!`);
      
      // Show transition UI or automatically move to next round
      setTimeout(() => {
        moveToNextRound();
      }, 1500);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  // Helper to map current question props to ProblemViewer
  const getProblemViewerProps = () => {
    const props: any = {
      problemTitle: currentQuestion.title,
      problemDescription: currentQuestion.description,
    };

    if (currentQuestion.type === 'coding') {
      props.examples = currentQuestion.examples;
      props.constraints = currentQuestion.constraints;
    } else if (currentQuestion.type === 'mcq') {
      props.instructions = [
        "Select the best option from the available choices.",
        "Read the scenario carefully."
      ];
    } else if (currentQuestion.type === 'text') {
      props.instructions = [
        "Be concise and clear in your response.",
        `Maximum ${currentQuestion.maxLength} characters allowed.`
      ];
    }

    return props;
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading assessment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-7rem)] animate-fade-in">
      {/* Assessment Header with Round Progress */}
      <div className="border-b border-border/50 bg-muted/20 flex-shrink-0">
        {/* Round Progress Indicators */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border/30">
          <div className="flex items-center gap-2">
            {ROUND_ORDER.map((round, idx) => {
              const RoundIcon = ROUND_ICONS[round];
              const progress = roundProgress[round];
              const isActive = round === currentRound;
              const isCompleted = progress.status === 'completed';
              
              return (
                <div key={round} className="flex items-center gap-2">
                  <div className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all
                    ${isActive ? 'bg-primary text-primary-foreground border-primary' : ''}
                    ${isCompleted ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''}
                    ${!isActive && !isCompleted ? 'bg-muted/50 text-muted-foreground border-border' : ''}
                  `}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <RoundIcon className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">
                      {ROUND_CONFIGS[round].name}
                    </span>
                    {isActive && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {currentQuestionIndex + 1}/{totalQuestions}
                      </Badge>
                    )}
                  </div>
                  {idx < ROUND_ORDER.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <Progress value={overallProgress} className="w-32 h-2" />
            <span className="text-sm text-muted-foreground font-medium">
              {Math.round(overallProgress)}%
            </span>
          </div>
        </div>

        {/* Current Question Info */}
        <div className="h-12 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-medium">{currentRoundConfig.name}</h1>
            <Badge variant="outline" className="text-xs">
              {currentQuestion.type.toUpperCase()}
            </Badge>
          </div>

          <div className="flex items-center gap-6">
            {/* Timer */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background border border-border">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm font-medium tabular-nums">45:00</span>
            </div>

            {/* Current Round Progress */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </span>
              <Progress
                value={((currentQuestionIndex + 1) / totalQuestions) * 100}
                className="w-24 h-2"
              />
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleNext}
                disabled={currentQuestionIndex === totalQuestions - 1}
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
          {/* Left Panel - Context Area */}
          <ResizablePanel defaultSize={40} minSize={30}>
            <ProblemViewer {...getProblemViewerProps()} />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Input Area */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="h-full flex flex-col">
              {/* Input Component Switcher */}
              <div className="flex-1 min-h-0 relative">
                <AssessmentInput
                  question={currentQuestion}
                  answer={currentAnswer}
                  onAnswerChange={handleAnswerChange}
                  onSubmit={handleSubmitQuestion}
                  isRunning={isRunning}
                />
              </div>

              {/* Console - Only for Coding Questions */}
              {currentQuestion.type === 'coding' && (
                <ConsoleOutput
                  logs={consoleLogs}
                  onClear={clearLogs}
                  isExpanded={consoleExpanded}
                  onToggleExpand={() => setConsoleExpanded(!consoleExpanded)}
                />
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Proctoring Notice */}
      <div className="h-8 flex items-center justify-center gap-2 text-xs text-muted-foreground border-t border-border/50 bg-muted/20 flex-shrink-0">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>
          This assessment is monitored. Please do not switch tabs or windows.
        </span>
      </div>

      {/* Webcam Monitor */}
      <WebcamMonitor />
    </div>
  );
}
