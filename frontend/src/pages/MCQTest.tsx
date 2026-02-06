import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { mcqApi } from '@/lib/api';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MCQQuestion {
  id: number;
  question_id: number;
  question: string;
  options: Array<{ id: number; text: string }>;
}

interface MCQResult {
  correct_answers: number;
  wrong_answers: number;
  percentage_correct: number;
  total_answered: number;
}

export default function MCQTest() {
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    show: boolean;
    isCorrect: boolean;
    correctAnswer: number;
  } | null>(null);
  const [result, setResult] = useState<MCQResult>({
    correct_answers: 0,
    wrong_answers: 0,
    percentage_correct: 0,
    total_answered: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadQuestions();
    loadResult();
    preloadTextBasedQuestions();
  }, []);

  const preloadTextBasedQuestions = async () => {
    try {
      console.log('🔄 Preloading text-based questions in background...');
      const token = localStorage.getItem('candidate_token');
      
      // Preload questions
      const questionsResponse = await fetch('http://localhost:5000/api/text-based/questions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (questionsResponse.ok) {
        const questionsData = await questionsResponse.json();
        if (questionsData.success && questionsData.questions) {
          // Store in localStorage for quick access
          localStorage.setItem('preloaded_text_based_questions', JSON.stringify(questionsData.questions));
          console.log(`✅ Preloaded ${questionsData.questions.length} text-based questions`);
        }
      }

      // Preload existing answers
      const answersResponse = await fetch('http://localhost:5000/api/text-based/answers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (answersResponse.ok) {
        const answersData = await answersResponse.json();
        if (answersData.success && answersData.answers) {
          localStorage.setItem('preloaded_text_based_answers', JSON.stringify(answersData.answers));
          console.log(`✅ Preloaded ${answersData.answers.length} text-based answers`);
        }
      }
    } catch (err) {
      console.error('⚠️ Failed to preload text-based questions (non-critical):', err);
      // Don't show error to user, this is background preloading
    }
  };

  const loadQuestions = async () => {
    try {
      console.log('📥 Fetching MCQ questions...');
      const response = await mcqApi.getQuestions();
      console.log('📦 API Response:', response);
      
      if (response.error) {
        console.error('❌ API Error:', response.error);
        setError(response.error);
        return;
      }
      if (response.data?.questions) {
        console.log(`✅ Loaded ${response.data.questions.length} questions`);
        setQuestions(response.data.questions);
      } else {
        console.warn('⚠️ No questions in response data');
      }
    } catch (err) {
      console.error('❌ Exception loading questions:', err);
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const loadResult = async () => {
    try {
      const response = await mcqApi.getResult();
      if (response.data?.result) {
        setResult(response.data.result);
      }
    } catch (err) {
      console.error('Failed to load result:', err);
    }
  };

  const handleSubmitAnswer = async () => {
    if (selectedOption === null) return;

    setIsSubmitting(true);
    try {
      const currentQuestion = questions[currentIndex];
      const response = await mcqApi.submitAnswer(
        currentQuestion.question_id,
        selectedOption
      );

      if (response.error) {
        setError(response.error);
        return;
      }

      if (response.data) {
        setFeedback({
          show: true,
          isCorrect: response.data.is_correct,
          correctAnswer: response.data.correct_answer,
        });
        setResult(response.data.result);
      }
    } catch (err) {
      setError('Failed to submit answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setFeedback(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <h2 className="text-xl font-semibold mb-2">No Questions Available</h2>
          <p className="text-muted-foreground">
            There are no MCQ questions uploaded yet. Please contact your administrator.
          </p>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  // Helper function to parse scenario and question
  const parseQuestion = (questionText: string) => {
    const scenarioMatch = questionText.match(/SCENARIO:(.+?)(?=QUESTION:)/s);
    const questionMatch = questionText.match(/QUESTION:(.+)/s);
    
    return {
      scenario: scenarioMatch ? scenarioMatch[1].trim() : null,
      question: questionMatch ? questionMatch[1].trim() : questionText
    };
  };

  const { scenario, question: questionPart } = parseQuestion(currentQuestion.question);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header with Score */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">MCQ Assessment</h1>
              <p className="text-sm text-muted-foreground">
                Question {currentIndex + 1} of {questions.length}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">
                {result.percentage_correct.toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground">
                {result.correct_answers} correct • {result.wrong_answers} wrong
              </p>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </Card>

        {/* Question Card */}
        <Card className="p-8">
          <div className="mb-6">
            <Badge variant="outline" className="mb-4">
              Question {currentQuestion.question_id}
            </Badge>
            
            {/* Scenario Section */}
            {scenario && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                <div className="flex items-start gap-2 mb-2">
                  <Badge className="bg-blue-500">SCENARIO</Badge>
                </div>
                <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">
                  {scenario}
                </p>
              </div>
            )}
            
            {/* Question Section */}
            <div className="flex items-start gap-2 mb-3">
              <Badge className="bg-primary">QUESTION</Badge>
            </div>
            <h2 className="text-xl font-semibold leading-relaxed mb-4">
              {questionPart}
            </h2>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {currentQuestion.options.map((option) => {
              const isSelected = selectedOption === option.id;
              const isCorrectAnswer = feedback && option.id === feedback.correctAnswer;
              const isWrongSelection =
                feedback && isSelected && !feedback.isCorrect;

              let optionClass = 'border-2 hover:border-primary/50 cursor-pointer';
              
              if (feedback) {
                if (isCorrectAnswer) {
                  optionClass = 'border-2 border-green-500 bg-green-50 dark:bg-green-950';
                } else if (isWrongSelection) {
                  optionClass = 'border-2 border-red-500 bg-red-50 dark:bg-red-950';
                } else {
                  optionClass = 'border-2 border-gray-200 opacity-50';
                }
              } else if (isSelected) {
                optionClass = 'border-2 border-primary bg-primary/5';
              }

              return (
                <button
                  key={option.id}
                  onClick={() => !feedback && setSelectedOption(option.id)}
                  disabled={!!feedback}
                  className={`w-full p-4 rounded-lg text-left transition-all ${optionClass}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-gray-300'
                        }`}
                      >
                        {option.id}
                      </div>
                      <span className="font-medium">{option.text}</span>
                    </div>
                    {feedback && isCorrectAnswer && (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    )}
                    {isWrongSelection && (
                      <XCircle className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {feedback && (
            <Alert
              className={`mt-6 ${
                feedback.isCorrect
                  ? 'border-green-500 bg-green-50 dark:bg-green-950'
                  : 'border-red-500 bg-red-50 dark:bg-red-950'
              }`}
            >
              <AlertDescription className="flex items-center gap-2">
                {feedback.isCorrect ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-800 dark:text-green-200">
                      Correct! Well done.
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="font-semibold text-red-800 dark:text-red-200">
                      Incorrect. The correct answer is option {feedback.correctAnswer}.
                    </span>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Button */}
          <div className="mt-8 flex justify-end">
            {!feedback ? (
              <Button
                size="lg"
                onClick={handleSubmitAnswer}
                disabled={selectedOption === null || isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Answer'}
              </Button>
            ) : currentIndex < questions.length - 1 ? (
              <Button size="lg" onClick={handleNextQuestion}>
                Next Question
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            ) : (
              <Card className="w-full p-6 bg-primary/5 border-primary">
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-2">Assessment Complete!</h3>
                  <p className="text-muted-foreground mb-4">
                    You've completed all questions.
                  </p>
                  <div className="text-3xl font-bold text-primary mb-2">
                    Final Score: {result.percentage_correct.toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {result.correct_answers} correct out of {result.total_answered} questions
                  </p>
                </div>
              </Card>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
