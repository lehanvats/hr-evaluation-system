import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { WebcamMonitor } from '@/components/molecules/WebcamMonitor';
import { ActivityMonitor } from '@/components/molecules/ActivityMonitor';
import { useProctoring } from '@/hooks/useProctoring';
import { useFaceDetection, ViolationEvent } from '@/hooks/useFaceDetection';
import { useAudioDetection } from '@/hooks/useAudioDetection';

import {
  Code,
  Play,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Trophy
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { toast } from 'sonner';

interface Problem {
  id: number;
  problem_id: number;
  title: string;
  difficulty: string;
  status: 'not_attempted' | 'attempted' | 'accepted';
}

interface ProblemDetail {
  id: number;
  problem_id: number;
  title: string;
  description: string;
  difficulty: string;
  starter_code_python: string;
  starter_code_javascript: string;
  starter_code_java: string;
  starter_code_cpp: string;
  test_cases: Array<{
    input: string;
    expected_output: string;
    is_hidden: boolean;
  }>;
  hidden_test_cases_count: number;
  time_limit: number;
  memory_limit: number;
}

interface TestResult {
  test_case_id: number;
  passed: boolean;
  input: string;
  expected_output: string;
  actual_output: string;
  status: string;
  is_hidden: boolean;
  stderr?: string;
}

interface Submission {
  id: number;
  code: string;
  language: string;
  status: string;
  runtime: number;
  memory_usage: number;
  submitted_at: string;
  passed_test_cases?: number;
  total_test_cases?: number;
  score_percentage?: number;
}

const LANGUAGE_MAP: Record<string, { label: string; monacoLang: string }> = {
  python: { label: 'Python', monacoLang: 'python' },
  javascript: { label: 'JavaScript', monacoLang: 'javascript' },
  java: { label: 'Java', monacoLang: 'java' },
  cpp: { label: 'C++', monacoLang: 'cpp' }
};

export default function CodingTest() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<ProblemDetail | null>(null);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null); // null until config loads
  const [config, setConfig] = useState<any>(null);
  const [timerStarted, setTimerStarted] = useState(false);

  // AI Proctoring Integration
  const {
    sessionId: proctorSessionId,
    isMonitoring,
    status: proctorStatus,
    startSession: startProctorSession,
    stopSession: stopProctorSession,
    logViolation
  } = useProctoring({
    assessmentId: 'coding-round'
  });

  // Client-Side Face Detection
  const { stream, videoRef } = useFaceDetection({
    enabled: isMonitoring,
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
      toast.error(`Security Alert: ${details}`);
      logViolation(backendType, { event: type, details });
    }
  });

  // Client-Side Audio Detection
  useAudioDetection({
    enabled: isMonitoring,
    threshold: 40,
    checkInterval: 2000,
    onViolation: (details) => {
      console.log('Audio Check:', details); // Explicitly requested console log
    }
  });



  // Fetch configuration and problems on mount
  useEffect(() => {
    fetchConfig();
    fetchProblems();
    initProctoring();
  }, []);

  // Initialize proctoring
  const initProctoring = async () => {
    const sessionId = await startProctorSession();
    if (sessionId) {
      console.log('✅ Proctoring session started:', sessionId);
      toast.info('AI Proctoring activated');
    }
  };

  // Cleanup proctoring on unmount
  useEffect(() => {
    return () => {
      stopProctorSession();
      console.log('🔴 Proctoring session ended');
    };
  }, []);

  // Timer
  useEffect(() => {
    // Don't start timer until config is loaded and timer is initialized
    if (timeRemaining === null || !timerStarted) {
      return;
    }

    if (timeRemaining <= 0) {
      handleComplete();
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining(prev => prev !== null ? Math.max(0, prev - 1) : null);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, timerStarted]);

  // Load problem details when selected
  useEffect(() => {
    if (problems.length > 0 && currentProblemIndex < problems.length) {
      const problem = problems[currentProblemIndex];
      fetchProblemDetail(problem.problem_id);
      fetchSubmissions(problem.problem_id);
    }
  }, [currentProblemIndex, problems]);

  // Update code when language or problem changes
  useEffect(() => {
    if (selectedProblem) {
      const starterCode = getStarterCode(selectedProblem, language);
      setCode(starterCode);
    }
  }, [language, selectedProblem]);

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/code/config`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('candidate_token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setConfig(data.config);
        setTimeRemaining(data.config.time_limit_minutes * 60);
        setTimerStarted(true); // Start timer after config is loaded
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const fetchProblems = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/code/problems`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('candidate_token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setProblems(data.problems);
      }
    } catch (error) {
      console.error('Error fetching problems:', error);
      toast.error('Failed to load problems');
    }
  };

  const fetchProblemDetail = async (problemId: number) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/code/problems/${problemId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('candidate_token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setSelectedProblem(data.problem);
        setTestResults([]);
      }
    } catch (error) {
      console.error('Error fetching problem detail:', error);
      toast.error('Failed to load problem details');
    }
  };

  const fetchSubmissions = async (problemId: number) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/code/submissions/${problemId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('candidate_token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setSubmissions(data.submissions);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  };

  const getStarterCode = (problem: ProblemDetail, lang: string): string => {
    switch (lang) {
      case 'python':
        return problem.starter_code_python || '# Write your code here\n';
      case 'javascript':
        return problem.starter_code_javascript || '// Write your code here\n';
      case 'java':
        return problem.starter_code_java || 'public class Solution {\n    // Write your code here\n}\n';
      case 'cpp':
        return problem.starter_code_cpp || '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}\n';
      default:
        return '// Write your code here\n';
    }
  };

  const handleRunCode = async () => {
    if (!selectedProblem || !code.trim()) {
      toast.error('Please write some code first');
      return;
    }

    setIsExecuting(true);
    setTestResults([]);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/code/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('candidate_token')}`
        },
        body: JSON.stringify({
          code,
          language,
          problem_id: selectedProblem.problem_id
        })
      });

      const data = await response.json();

      if (data.success) {
        setTestResults(data.test_results);
        const passedCount = data.passed_count;
        const totalCount = data.total_count;

        if (passedCount === totalCount) {
          toast.success(`All test cases passed! (${passedCount}/${totalCount})`);
        } else {
          toast.warning(`${passedCount}/${totalCount} test cases passed`);
        }
      } else {
        toast.error(data.message || 'Execution failed');
      }
    } catch (error) {
      console.error('Error executing code:', error);
      toast.error('Failed to execute code');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProblem || !code.trim()) {
      toast.error('Please write some code first');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/code/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('candidate_token')}`
        },
        body: JSON.stringify({
          problem_id: selectedProblem.problem_id,
          code,
          language
        })
      });

      const data = await response.json();

      if (data.success) {
        setTestResults(data.test_results);

        if (data.status === 'Accepted') {
          toast.success('Solution accepted! ✅ All test cases passed');
          // Refresh problems to update status
          fetchProblems();
        } else if (data.status && data.status.startsWith('Partial')) {
          toast.warning(`Partial solution: ${data.passed_count}/${data.total_count} test cases passed (${data.score_percentage.toFixed(1)}%)`);
        } else {
          toast.error(`Submission ${data.status} - ${data.passed_count}/${data.total_count} test cases passed`);
        }

        // Refresh submissions
        fetchSubmissions(selectedProblem.problem_id);
      } else {
        toast.error(data.message || 'Submission failed');
      }
    } catch (error) {
      console.error('Error submitting code:', error);
      toast.error('Failed to submit solution');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/code/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('candidate_token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        // Stop proctoring session
        stopProctorSession();

        toast.success('Assessment completed successfully! Thank you.');

        // Clear authentication token
        localStorage.removeItem('candidate_token');

        // Redirect to landing page immediately
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } else {
        toast.error(data.message || 'Failed to complete round');
      }
    } catch (error) {
      console.error('Error completing round:', error);
      toast.error('Failed to complete round');
    }
  };

  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'bg-green-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'hard':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'attempted':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Code className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Code className="h-6 w-6" />
            <h1 className="text-xl font-bold">Coding Assessment</h1>
            {selectedProblem && (
              <>
                <Separator orientation="vertical" className="h-6" />
                <span className="text-sm text-muted-foreground">
                  Problem {currentProblemIndex + 1} of {problems.length}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className={`font-mono text-sm ${timeRemaining !== null && timeRemaining < 300 ? 'text-red-500' : ''}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
            <Button onClick={handleComplete} variant="outline">
              Complete & Submit
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-120px)]">
          {/* Left Panel - Problems List */}
          <Card className="col-span-3 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Problems</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-full">
                <div className="space-y-2 p-4">
                  {problems.map((problem, index) => (
                    <div
                      key={problem.id}
                      onClick={() => setCurrentProblemIndex(index)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${currentProblemIndex === index
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusIcon(problem.status)}
                            <span className="text-sm font-medium truncate">
                              {problem.title}
                            </span>
                          </div>
                          <Badge className={`${getDifficultyColor(problem.difficulty)} text-xs`}>
                            {problem.difficulty}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Middle Panel - Problem Description & Code Editor */}
          <div className="col-span-6 flex flex-col gap-4">
            {/* Problem Description */}
            <Card className="flex-1 flex flex-col max-h-[40%]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle>{selectedProblem?.title || 'Select a problem'}</CardTitle>
                    {selectedProblem && (
                      <Badge className={getDifficultyColor(selectedProblem.difficulty)}>
                        {selectedProblem.difficulty}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentProblemIndex(Math.max(0, currentProblemIndex - 1))}
                      disabled={currentProblemIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentProblemIndex(Math.min(problems.length - 1, currentProblemIndex + 1))}
                      disabled={currentProblemIndex === problems.length - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  {selectedProblem && (
                    <div className="space-y-4 pr-4">
                      <div className="prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap text-sm">
                          {selectedProblem.description}
                        </pre>
                      </div>

                      {/* Test Cases Examples */}
                      {selectedProblem.test_cases && selectedProblem.test_cases.length > 0 && (
                        <div className="space-y-3 mt-4">
                          <h4 className="font-semibold text-sm">Example Test Cases:</h4>
                          {selectedProblem.test_cases.map((testCase, idx) => (
                            <div key={idx} className="border rounded-lg p-3 bg-muted/30">
                              <p className="text-xs font-semibold text-muted-foreground mb-2">
                                Test Case {idx + 1}
                              </p>
                              <div className="space-y-2">
                                <div>
                                  <span className="text-xs font-medium">Input:</span>
                                  <pre className="text-xs mt-1 p-2 bg-background rounded border">
                                    {testCase.input}
                                  </pre>
                                </div>
                                <div>
                                  <span className="text-xs font-medium">Expected Output:</span>
                                  <pre className="text-xs mt-1 p-2 bg-background rounded border">
                                    {testCase.expected_output}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div>
                        <p className="text-sm text-muted-foreground">
                          Visible Test Cases: {selectedProblem.test_cases.length} |
                          Hidden Test Cases: {selectedProblem.hidden_test_cases_count}
                        </p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Code Editor */}
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Code Editor</CardTitle>
                  <div className="flex items-center gap-2">
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="text-sm border rounded-md px-3 py-1.5 bg-background dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:border-primary min-w-[140px]"
                      aria-label="Select programming language"
                    >
                      {config?.allowed_languages?.map((lang: string) => (
                        <option key={lang} value={lang}>
                          {LANGUAGE_MAP[lang]?.label || lang}
                        </option>
                      )) || Object.entries(LANGUAGE_MAP).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    <Button size="sm" onClick={handleRunCode} disabled={isExecuting}>
                      <Play className="h-4 w-4 mr-1" />
                      {isExecuting ? 'Running...' : 'Run'}
                    </Button>
                    <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
                      <Send className="h-4 w-4 mr-1" />
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                <Editor
                  height="100%"
                  language={LANGUAGE_MAP[language]?.monacoLang || 'python'}
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Test Results & Submissions */}
          <Card className="col-span-3 flex flex-col">
            <Tabs defaultValue="results" className="flex-1 flex flex-col">
              <CardHeader className="pb-3">
                <TabsList className="w-full">
                  <TabsTrigger value="results" className="flex-1">Test Results</TabsTrigger>
                  <TabsTrigger value="submissions" className="flex-1">Submissions</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="flex-1 overflow-hidden p-0">
                <TabsContent value="results" className="h-full m-0">
                  <ScrollArea className="h-full">
                    <div className="space-y-2 p-4">
                      {testResults.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Run your code to see test results
                        </p>
                      ) : (
                        testResults.map((result) => (
                          <div
                            key={result.test_case_id}
                            className={`p-4 rounded-lg border-2 ${result.passed
                              ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800'
                              : 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800'
                              }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <span className="text-sm font-semibold">
                                Test Case {result.test_case_id}
                              </span>
                              {result.passed ? (
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className={`font-medium ${result.passed ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                Status: {result.status}
                              </div>
                              {!result.is_hidden && (
                                <>
                                  <div>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">Input:</span>
                                    <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto border border-gray-200 dark:border-gray-700">
                                      {result.input}
                                    </pre>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">Expected:</span>
                                    <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto border border-gray-200 dark:border-gray-700">
                                      {result.expected_output}
                                    </pre>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">Got:</span>
                                    <pre className={`mt-1 p-2 rounded text-xs overflow-x-auto border ${result.passed
                                      ? 'bg-green-100 dark:bg-green-950/30 border-green-300 dark:border-green-800'
                                      : 'bg-red-100 dark:bg-red-950/30 border-red-300 dark:border-red-800'
                                      }`}>
                                      {result.actual_output || '(no output)'}
                                    </pre>
                                  </div>
                                  {result.stderr && (
                                    <div>
                                      <span className="font-semibold text-red-700 dark:text-red-400">Error:</span>
                                      <pre className="mt-1 p-2 bg-red-100 dark:bg-red-950/30 rounded text-xs overflow-x-auto border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300">
                                        {result.stderr}
                                      </pre>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="submissions" className="h-full m-0">
                  <ScrollArea className="h-full">
                    <div className="space-y-2 p-4">
                      {submissions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No submissions yet
                        </p>
                      ) : (
                        submissions.map((submission) => {
                          const isAccepted = submission.status === 'Accepted';
                          const isPartial = submission.status && submission.status.startsWith('Partial');
                          const scorePercentage = submission.score_percentage;

                          return (
                            <div key={submission.id} className="p-3 rounded-lg border">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant={isAccepted ? 'default' : isPartial ? 'secondary' : 'destructive'}>
                                    {submission.status}
                                  </Badge>
                                  {scorePercentage !== undefined && scorePercentage !== null && (
                                    <span className={`text-xs font-semibold ${scorePercentage === 100 ? 'text-green-600 dark:text-green-400' :
                                      scorePercentage >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                                        'text-red-600 dark:text-red-400'
                                      }`}>
                                      {scorePercentage.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(submission.submitted_at).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="space-y-1 text-xs text-muted-foreground">
                                <div>Language: {LANGUAGE_MAP[submission.language]?.label}</div>
                                {submission.passed_test_cases !== undefined && submission.total_test_cases !== undefined && (
                                  <div>Test Cases: {submission.passed_test_cases}/{submission.total_test_cases} passed</div>
                                )}
                                {submission.runtime && (
                                  <div>Runtime: {submission.runtime}ms</div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
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
    </div>
  );
}
