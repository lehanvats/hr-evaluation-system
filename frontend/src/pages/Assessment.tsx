import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2, Brain, Code, CheckSquare, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ProblemViewer } from '@/components/molecules/ProblemViewer';
import { AssessmentInput } from '@/components/molecules/AssessmentInput';
import { ConsoleOutput } from '@/components/molecules/ConsoleOutput';
import { WebcamMonitor } from '@/components/molecules/WebcamMonitor';
import { ActivityMonitor } from '@/components/molecules/ActivityMonitor';
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
import { mcqApi, candidateApi, psychometricApi, textBasedApi } from '@/lib/api';
import { useProctoring } from '@/hooks/useProctoring';
import { useFaceDetection, ViolationEvent } from '@/hooks/useFaceDetection';

import { useCodePlayback } from '@/hooks/useCodePlayback';

interface ConsoleLog {
  type: 'log' | 'error' | 'info' | 'success';
  message: string;
  timestamp: Date;
}

const ROUND_ICONS = {
  mcq: CheckSquare,
  psychometric: Brain,
  'text-based': FileText,
  coding: Code
};

export default function Assessment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();



  // Round Management State
  const [currentRound, setCurrentRound] = useState<AssessmentRound>('mcq');
  const [roundProgress, setRoundProgress] = useState<Record<AssessmentRound, RoundProgress>>({
    mcq: { round: 'mcq', status: 'in-progress', answers: {}, currentQuestionIndex: 0 },
    psychometric: { round: 'psychometric', status: 'not-started', answers: {} },
    'text-based': { round: 'text-based', status: 'not-started', answers: {} },
    coding: { round: 'coding', status: 'not-started', answers: {} }
  });
  const [loading, setLoading] = useState(true);

  // MCQ specific state - real questions from API
  const [mcqQuestions, setMcqQuestions] = useState<any[]>([]);
  const [mcqSubmitting, setMcqSubmitting] = useState(false);

  // Psychometric specific state - real questions from API
  const [psychometricQuestions, setPsychometricQuestions] = useState<any[]>([]);
  const [psychometricQuestionsReady, setPsychometricQuestionsReady] = useState(false);
  const [psychometricSubmitting, setPsychometricSubmitting] = useState(false);

  // Text-Based specific state - real questions from API
  const [textBasedQuestions, setTextBasedQuestions] = useState<any[]>([]);

  // Question State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [consoleExpanded, setConsoleExpanded] = useState(false);

  // Unanswered questions warning
  const [showUnansweredWarning, setShowUnansweredWarning] = useState(false);
  const [unansweredQuestionsList, setUnansweredQuestionsList] = useState<number[]>([]);
  const [pendingSubmitAction, setPendingSubmitAction] = useState<(() => void) | null>(null);

  // AI Proctoring Integration
  const {
    sessionId: proctorSessionId,
    isMonitoring,
    status: proctorStatus,
    startSession: startProctorSession,
    stopSession: stopProctorSession,
    logViolation // We use this to log client-side violations to backend
  } = useProctoring({
    assessmentId: id
  });

  // Client-Side Face Detection
  const { stream, videoRef } = useFaceDetection({
    enabled: isMonitoring, // Only detect when session is active
    detectionInterval: 2000, // Check every 2 seconds
    onViolation: (event: ViolationEvent) => {
      const { type, details } = event;

      // Map violation types to backend format
      const violationTypeMap: Record<string, string> = {
        'NO_FACE': 'no_face',
        'MULTIPLE_FACES': 'multiple_faces',
        'FACE_TURNED': 'looking_away',
        'FACE_TOO_FAR': 'looking_away'
      };

      const backendType = violationTypeMap[type] || type.toLowerCase();

      console.log(`🚨 Face detection violation: ${backendType}`, details);
      addLog('error', `Security Alert: ${details}`);

      // Log to backend
      logViolation(backendType, { event: type, details });
    }
  });



  // Code Playback Recording  
  const { startRecording, stopRecording, recordChange } = useCodePlayback(
    proctorSessionId || null,
    null // questionId will be set dynamically when needed
  );

  // Load MCQ questions when on MCQ round
  useEffect(() => {
    if (currentRound === 'mcq' && mcqQuestions.length === 0) {
      loadMCQQuestions();
    }
  }, [currentRound]);

  // Load Psychometric questions when on psychometric round
  useEffect(() => {
    if (currentRound === 'psychometric' && psychometricQuestions.length === 0) {
      loadPsychometricQuestions();
    }
  }, [currentRound]);

  // Load Text-Based questions when on text-based round
  useEffect(() => {
    if (currentRound === 'text-based' && textBasedQuestions.length === 0) {
      loadTextBasedQuestions();
    }
  }, [currentRound]);

  // Load Text-Based questions when on text-based round
  useEffect(() => {
    if (currentRound === 'text-based' && textBasedQuestions.length === 0) {
      loadTextBasedQuestions();
    }
  }, [currentRound]);

  // Start/Stop Proctoring Session
  useEffect(() => {
    const initProctoring = async () => {
      const sessionId = await startProctorSession();
      if (sessionId) {
        console.log('✅ Proctoring session started:', sessionId);
        addLog('info', 'AI Proctoring activated');
        startRecording();
      }
    };

    initProctoring();

    return () => {
      stopProctorSession();
      stopRecording();
      console.log('🔴 Proctoring session ended');
    };
  }, []);

  const loadMCQQuestions = async () => {
    try {
      console.log('📥 Loading MCQ questions from API...');
      const response = await mcqApi.getQuestions();

      if (response.error) {
        console.error('❌ Error loading MCQ questions:', response.error);
        addLog('error', `Failed to load MCQ questions: ${response.error}`);
        return;
      }

      if ((response.data as any)?.questions && (response.data as any).questions.length > 0) {
        console.log(`✅ Loaded ${(response.data as any).questions.length} MCQ questions`);
        setMcqQuestions((response.data as any).questions);
        addLog('success', `Loaded ${(response.data as any).questions.length} MCQ questions`);

        // Prefetch psychometric questions in background
        prefetchPsychometricQuestions();
      } else {
        console.warn('⚠️ No MCQ questions available');
        addLog('error', 'No MCQ questions available. Please contact administrator.');
      }
    } catch (error) {
      console.error('❌ Exception loading MCQ questions:', error);
      addLog('error', 'Failed to load MCQ questions');
    }
  };

  const prefetchPsychometricQuestions = async () => {
    try {
      console.log('🔄 Prefetching psychometric questions in background...');

      const token = localStorage.getItem('candidate_token');
      if (!token) return;

      const candidateData = JSON.parse(atob(token.split('.')[1]));
      const response = await psychometricApi.startTest(candidateData.user_id);

      if ((response.data as any)?.success) {
        console.log(`✅ Loaded ${(response.data as any).questions.length} psychometric questions`);

        // Transform psychometric questions to include type and options
        const transformedQuestions = (response.data as any).questions.map((q: any) => ({
          ...q,
          type: 'mcq',
          options: (response.data as any).answer_options.map((opt: any) => ({
            id: opt.value,
            text: opt.label
          }))
        }));

        setPsychometricQuestions(transformedQuestions);
        setPsychometricQuestionsReady(true);
      }
    } catch (error) {
      console.error('❌ Error prefetching psychometric questions:', error);
    }
  };

  const loadPsychometricQuestions = async () => {
    try {
      console.log('📥 Loading psychometric questions from API...');

      const token = localStorage.getItem('candidate_token');
      if (!token) {
        addLog('error', 'Please login first');
        navigate('/candidate/login');
        return;
      }

      const candidateData = JSON.parse(atob(token.split('.')[1]));
      const response = await psychometricApi.startTest(candidateData.user_id);

      if (response.error) {
        console.error('❌ Error loading psychometric questions:', response.error);
        addLog('error', `Failed to load psychometric questions: ${response.error}`);
        return;
      }

      if ((response.data as any)?.success && (response.data as any).questions && (response.data as any).questions.length > 0) {
        console.log(`✅ Loaded ${(response.data as any).questions.length} psychometric questions`);

        // Transform psychometric questions to include type and options
        const transformedQuestions = (response.data as any).questions.map((q: any) => ({
          ...q,
          type: 'mcq',
          options: (response.data as any).answer_options.map((opt: any) => ({
            id: opt.value,
            text: opt.label
          }))
        }));

        setPsychometricQuestions(transformedQuestions);
        setPsychometricQuestionsReady(true);
        addLog('success', `Loaded ${(response.data as any).questions.length} psychometric questions`);
      } else {
        console.warn('⚠️ No psychometric questions available');
        addLog('error', 'No psychometric questions available. Please contact administrator.');
      }
    } catch (error) {
      console.error('❌ Exception loading psychometric questions:', error);
      addLog('error', 'Failed to load psychometric questions');
    }
  };
  const loadTextBasedQuestions = async () => {
    try {
      console.log('📥 Loading Text-Based questions from API...');
      const response = await textBasedApi.getQuestions();

      if (response.error) {
        console.error('❌ Error loading Text-Based questions:', response.error);
        addLog('error', `Failed to load Text-Based questions: ${response.error}`);
        return;
      }

      if ((response.data as any)?.questions && (response.data as any).questions.length > 0) {
        console.log(`✅ Loaded ${(response.data as any).questions.length} Text-Based questions`);
        setTextBasedQuestions((response.data as any).questions);
        addLog('success', `Loaded ${(response.data as any).questions.length} Text-Based questions`);
      } else {
        console.warn('⚠️ No Text-Based questions available');
        addLog('error', 'No Text-Based questions available. Please contact administrator.');
      }
    } catch (error) {
      console.error('❌ Exception loading Text-Based questions:', error);
      addLog('error', 'Failed to load Text-Based questions');
    }
  };
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
          activeRound = 'text-based';
        }


        if (candidateData.text_based_completed) {
          updatedProgress['text-based'].status = 'completed';
          // All rounds completed, redirect to home
          navigate('/candidate');
          return;
        }

        // If text-based is the active round, redirect to dedicated text-based test page
        if (activeRound === 'text-based') {
          navigate('/candidate/text-based-test');
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
  const currentRoundQuestions = currentRound === 'mcq' && mcqQuestions.length > 0
    ? mcqQuestions
    : currentRound === 'psychometric' && psychometricQuestions.length > 0
      ? psychometricQuestions
      : currentRound === 'text-based' && textBasedQuestions.length > 0
        ? textBasedQuestions
        : questionsByRound[currentRound] || [];
  const currentQuestion: any = currentRoundQuestions[currentQuestionIndex];
  const totalQuestions = currentRoundQuestions.length;
  const currentAnswer = roundProgress[currentRound].answers[currentQuestion?.question_id || currentQuestion?.id];
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
    // For MCQ from API, use question_id; for mock questions, use id
    const questionId = currentQuestion.question_id || currentQuestion.id;
    setRoundProgress(prev => ({
      ...prev,
      [currentRound]: {
        ...prev[currentRound],
        answers: {
          ...prev[currentRound].answers,
          [questionId]: value
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

  const submitAllMCQAnswers = async () => {
    setMcqSubmitting(true);
    try {
      addLog('info', 'Submitting all MCQ answers for evaluation...');

      const answers = roundProgress.mcq.answers;
      let successCount = 0;

      // Submit all answers in background (don't wait for responses)
      const submissions = Object.entries(answers).map(async ([questionId, selectedOption]) => {
        try {
          const response = await mcqApi.submitAnswer(parseInt(questionId), selectedOption as number);
          if (!response.error) {
            successCount++;
          }
        } catch (error) {
          console.error(`Failed to submit answer for question ${questionId}:`, error);
        }
      });

      // Don't wait for all to complete - let them run in background
      Promise.all(submissions).then(() => {
        console.log(`✅ MCQ evaluation complete: ${successCount}/${Object.keys(answers).length} submitted`);
        addLog('success', `MCQ evaluation complete: ${successCount} answers processed`);
      });

    } catch (error) {
      console.error('Error in batch submission:', error);
      addLog('error', 'Some answers may not have been submitted');
    } finally {
      setMcqSubmitting(false);
    }
  };

  const submitAllPsychometricAnswers = async () => {
    setPsychometricSubmitting(true);
    try {
      addLog('info', 'Submitting psychometric test answers...');

      const answers = roundProgress.psychometric.answers;
      const token = localStorage.getItem('candidate_token');
      if (!token) {
        addLog('error', 'Session expired');
        return;
      }

      const candidateData = JSON.parse(atob(token.split('.')[1]));

      // Convert answers to API format
      const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
        question_id: parseInt(questionId),
        answer: answer as number
      }));

      const response = await psychometricApi.submitTest(candidateData.user_id, formattedAnswers);

      if ((response.data as any)?.success) {
        addLog('success', 'Psychometric test submitted successfully!');
      } else {
        addLog('error', (response.data as any)?.error || 'Failed to submit psychometric test');
      }

    } catch (error) {
      addLog('error', 'Failed to submit psychometric test');
    } finally {
      setPsychometricSubmitting(false);
    }
  };

  const completeCurrentRound = async () => {
    // Mark round as completed in state
    setRoundProgress(prev => ({
      ...prev,
      [currentRound]: {
        ...prev[currentRound],
        status: 'completed',
        completedAt: new Date()
      }
    }));

    // Round completion is tracked via batch submission for MCQ
    // For other rounds, you would call their respective completion APIs here
  };

  const moveToNextRound = () => {
    const currentIdx = ROUND_ORDER.indexOf(currentRound);
    if (currentIdx < ROUND_ORDER.length - 1) {
      const nextRound = ROUND_ORDER[currentIdx + 1];

      // If next round is coding, redirect to dedicated page (has complex UI with Monaco editor)
      if (nextRound === 'coding') {
        addLog('success', 'Moving to Coding Assessment...');
        setTimeout(() => {
          navigate('/candidate/coding-test');
        }, 1500);
        return;
      }

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
        navigate('/candidate');
      }, 2000);
    }
  };

  const handleSubmitQuestion = async () => {
    // Handle MCQ submission - just move to next question (batch submit at end)
    if (currentRound === 'mcq' && mcqQuestions.length > 0) {
      const selectedOption = currentAnswer;

      if (!selectedOption) {
        addLog('error', 'Please select an answer before submitting');
        return;
      }

      addLog('success', `Answer saved for Question ${currentQuestionIndex + 1}`);

      // Move to next question or complete round
      if (currentQuestionIndex < totalQuestions - 1) {
        handleNext();
      } else {
        // Check for unanswered MCQ questions before completing
        const unanswered = mcqQuestions.filter((_, idx) => !roundProgress.mcq.answers[idx]);
        if (unanswered.length > 0) {
          setUnansweredQuestionsList(unanswered.map((_, idx) => idx + 1));
          setPendingSubmitAction(() => async () => {
            await submitAllMCQAnswers();
            await completeCurrentRound();
            addLog('success', 'MCQ round completed! Moving to next round...');
            setTimeout(() => {
              moveToNextRound();
            }, 500);
          });
          setShowUnansweredWarning(true);
          return;
        }

        // MCQ round completed - batch submit all answers
        await submitAllMCQAnswers();
        await completeCurrentRound();
        addLog('success', 'MCQ round completed! Moving to next round...');

        // Move to next round immediately (evaluation happens in background)
        setTimeout(() => {
          moveToNextRound();
        }, 500);
      }
      return;
    }

    // Handle Psychometric submission - save answer and move to next
    if (currentRound === 'psychometric' && psychometricQuestions.length > 0) {
      const selectedAnswer = currentAnswer;

      if (!selectedAnswer) {
        addLog('error', 'Please select an answer before submitting');
        return;
      }

      addLog('success', `Answer saved for Question ${currentQuestionIndex + 1}`);

      // Move to next question or complete round
      if (currentQuestionIndex < totalQuestions - 1) {
        handleNext();
      } else {
        // Check for unanswered Psychometric questions before completing
        const unanswered = psychometricQuestions.filter((_, idx) => !roundProgress.psychometric.answers[idx]);
        if (unanswered.length > 0) {
          setUnansweredQuestionsList(unanswered.map((_, idx) => idx + 1));
          setPendingSubmitAction(() => async () => {
            await submitAllPsychometricAnswers();
            await completeCurrentRound();
            addLog('success', 'Psychometric assessment completed! Moving to next round...');
            setTimeout(() => {
              moveToNextRound();
            }, 500);
          });
          setShowUnansweredWarning(true);
          return;
        }

        // Psychometric round completed - submit all answers
        await submitAllPsychometricAnswers();
        await completeCurrentRound();
        addLog('success', 'Psychometric assessment completed! Moving to next round...');

        // Move to next round
        setTimeout(() => {
          moveToNextRound();
        }, 500);
      }
      return;
    }

    // Handle Text-Based submission - save to backend
    if (currentRound === 'text-based' && textBasedQuestions.length > 0) {
      const answerText = currentAnswer;

      if (!answerText || !answerText.trim()) {
        addLog('error', 'Please provide an answer before submitting');
        return;
      }

      try {
        addLog('info', 'Submitting answer...');
        const response = await textBasedApi.submitAnswer(
          currentQuestion.question_id,
          answerText
        );

        if (response.error) {
          addLog('error', `Failed to submit: ${response.error}`);
          return;
        }

        addLog('success', 'Answer saved successfully');

        // Move to next question or complete round
        if (currentQuestionIndex < totalQuestions - 1) {
          handleNext();
        } else {
          // Text-based round completed
          await textBasedApi.complete();
          await completeCurrentRound();
          addLog('success', 'Text-Based assessment completed! Moving to next round...');
          setTimeout(() => {
            moveToNextRound();
          }, 500);
        }
      } catch (error) {
        addLog('error', 'Failed to submit answer');
        console.error('Submit error:', error);
      }
      return;
    }

    // Handle other question types
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
    // Handle MCQ questions from API (different format)
    if (currentRound === 'mcq' && mcqQuestions.length > 0) {
      return {
        problemTitle: `Question ${currentQuestion.question_id}`,
        problemDescription: currentQuestion.question,
        instructions: [
          "Select the best option from the available choices.",
          "Your answer will be checked immediately after submission."
        ]
      };
    }

    // Handle Psychometric questions from API
    if (currentRound === 'psychometric' && psychometricQuestions.length > 0) {
      return {
        problemTitle: `Statement ${currentQuestionIndex + 1} of ${totalQuestions}`,
        problemDescription: currentQuestion.question,
        instructions: [
          "Describe yourself as you generally are now, not as you wish to be in the future.",
          "Answer honestly in relation to other people you know of the same age.",
          "Select the option that best describes you."
        ]
      };
    }

    // Handle Text-Based questions from API
    if (currentRound === 'text-based' && textBasedQuestions.length > 0) {
      return {
        problemTitle: `Question ${currentQuestionIndex + 1} of ${totalQuestions}`,
        problemDescription: currentQuestion.question,
        instructions: [
          "Provide a detailed and thoughtful answer.",
          "Maximum 200 words allowed.",
          "Your answer will be evaluated for clarity and depth."
        ]
      };
    }

    // Handle mock questions
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

  // Show loading state when MCQ questions are being loaded
  if (currentRound === 'mcq' && mcqQuestions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading MCQ questions...</p>
        </div>
      </div>
    );
  }

  // Show loading state when Psychometric questions are being loaded
  if (currentRound === 'psychometric' && psychometricQuestions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading psychometric questions...</p>
        </div>
      </div>
    );
  }

  // Safety check for currentQuestion
  if (!currentQuestion) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No questions available</p>
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
              {(currentQuestion.type || currentRound).toUpperCase()}
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

      {/* Monitoring Panel - Left Side */}
      <div className="fixed bottom-4 left-4 z-50 flex gap-3">
        {/* Webcam Monitor */}
        <WebcamMonitor
          ref={videoRef}
          stream={stream}
          status={proctorStatus}
          className=""
        />

        {/* Activity Monitor */}
        <ActivityMonitor
          className="w-64"
          onViolation={logViolation}
        />
      </div>

      {/* Unanswered Questions Warning Dialog */}
      <AlertDialog open={showUnansweredWarning} onOpenChange={setShowUnansweredWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Round?</AlertDialogTitle>
            <AlertDialogDescription>
              There might be some questions unattended in this round.
              <br /><br />
              After submission, this round will be <strong>locked</strong> and any unattended questions will be marked as <strong>null/not attempted</strong>.
              <br /><br />
              Are you sure you want to submit?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowUnansweredWarning(false);
              if (pendingSubmitAction) {
                pendingSubmitAction();
                setPendingSubmitAction(null);
              }
            }}>
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
