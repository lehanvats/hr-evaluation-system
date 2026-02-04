import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { psychometricApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Question {
  id: number;
  question_id: number;
  question: string;
  trait_type: number;
  scoring_direction: string;
  is_active: boolean;
}

interface PsychometricConfigDialogProps {
  recruiterId: number;
  onConfigSaved?: () => void;
}

const TRAIT_NAMES: Record<number, string> = {
  1: 'Extraversion',
  2: 'Agreeableness',
  3: 'Conscientiousness',
  4: 'Emotional Stability',
  5: 'Intellect/Imagination',
};

const TRAIT_COLORS: Record<number, string> = {
  1: 'bg-blue-500',
  2: 'bg-green-500',
  3: 'bg-purple-500',
  4: 'bg-orange-500',
  5: 'bg-pink-500',
};

export function PsychometricConfigDialog({ recruiterId, onConfigSaved }: PsychometricConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [groupedQuestions, setGroupedQuestions] = useState<Record<string, Question[]>>({});
  
  const [numQuestions, setNumQuestions] = useState(50);
  const [selectionMode, setSelectionMode] = useState<'random' | 'manual'>('random');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [questionsLoaded, setQuestionsLoaded] = useState(false);

  useEffect(() => {
    if (open) {
      loadQuestions();
      loadCurrentConfig();
    }
  }, [open]);

  const loadQuestions = async () => {
    setLoading(true);
    const response = await psychometricApi.getAllQuestions();
    
    if (response.data?.success) {
      setQuestions(response.data.questions);
      setGroupedQuestions(response.data.grouped_by_trait);
      setQuestionsLoaded(true);
    } else if (response.data?.success === false && response.data.total_questions === 0) {
      // Questions not loaded yet
      setQuestionsLoaded(false);
    }
    setLoading(false);
  };

  const loadCurrentConfig = async () => {
    const response = await psychometricApi.getCurrentConfig(recruiterId);
    if (response.data?.success) {
      const config = response.data.config;
      setNumQuestions(config.num_questions);
      setSelectionMode(config.selection_mode);
      if (config.selected_question_ids) {
        setSelectedQuestionIds(JSON.parse(config.selected_question_ids));
      }
    }
  };

  const handleLoadQuestions = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    const response = await psychometricApi.loadQuestions();
    
    if (response.data?.success) {
      setSuccess('Successfully loaded 50 psychometric questions!');
      await loadQuestions();
    } else {
      setError(response.data?.message || response.error || 'Failed to load questions');
    }
    setLoading(false);
  };

  const handleQuestionToggle = (questionId: number) => {
    setSelectedQuestionIds(prev => {
      if (prev.includes(questionId)) {
        return prev.filter(id => id !== questionId);
      } else {
        if (prev.length >= numQuestions) {
          setError(`You can only select ${numQuestions} questions`);
          return prev;
        }
        setError('');
        return [...prev, questionId];
      }
    });
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    // Validation
    if (numQuestions < 15) {
      setError('Minimum 15 questions are required for a valid psychometric assessment');
      setLoading(false);
      return;
    }

    if (selectionMode === 'manual' && selectedQuestionIds.length !== numQuestions) {
      setError(`Please select exactly ${numQuestions} questions`);
      setLoading(false);
      return;
    }

    const response = await psychometricApi.setConfig(
      recruiterId,
      numQuestions,
      selectionMode,
      selectionMode === 'manual' ? selectedQuestionIds : undefined
    );

    if (response.data?.success) {
      setSuccess('Configuration saved successfully!');
      setTimeout(() => {
        setOpen(false);
        onConfigSaved?.();
      }, 1500);
    } else {
      setError(response.data?.error || response.error || 'Failed to save configuration');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Brain className="h-4 w-4 mr-2" />
          Configure Psychometric Test
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Psychometric Test Configuration
          </DialogTitle>
          <DialogDescription>
            Configure the IPIP Big Five personality assessment for candidates
          </DialogDescription>
        </DialogHeader>

        {!questionsLoaded ? (
          <div className="space-y-4 py-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Psychometric questions need to be loaded into the database first.
                This is a one-time setup that loads all 50 IPIP Big Five questions.
              </AlertDescription>
            </Alert>
            <Button onClick={handleLoadQuestions} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading Questions...
                </>
              ) : (
                'Load 50 Psychometric Questions'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Number of Questions */}
            <div className="space-y-2">
              <Label htmlFor="numQuestions">Number of Questions</Label>
              <Input
                id="numQuestions"
                type="number"
                min="15"
                max="50"
                value={numQuestions}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= 15 && val <= 50) {
                    setNumQuestions(val);
                    // Reset selection if exceeding new limit
                    if (selectedQuestionIds.length > val) {
                      setSelectedQuestionIds(selectedQuestionIds.slice(0, val));
                    }
                    setError('');
                  } else if (val < 15) {
                    setError('Minimum 15 questions are required for a valid psychometric assessment');
                  }
                }}
              />
              <p className="text-sm text-muted-foreground">
                Choose between 15-50 questions (minimum: 15, default: 50)
              </p>
            </div>

            {/* Selection Mode */}
            <div className="space-y-2">
              <Label>Selection Mode</Label>
              <RadioGroup value={selectionMode} onValueChange={(val: 'random' | 'manual') => setSelectionMode(val)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="random" id="random" />
                  <Label htmlFor="random" className="font-normal cursor-pointer">
                    Random Selection - System picks questions randomly
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual" className="font-normal cursor-pointer">
                    Manual Selection - Choose specific questions
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Manual Selection UI */}
            {selectionMode === 'manual' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Select Questions ({selectedQuestionIds.length}/{numQuestions})</Label>
                  {selectedQuestionIds.length === numQuestions && (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  )}
                </div>
                
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="all">All</TabsTrigger>
                    {Object.entries(TRAIT_NAMES).map(([type, name]) => (
                      <TabsTrigger key={type} value={type}>
                        {name.split('/')[0]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  <TabsContent value="all">
                    <ScrollArea className="h-[300px] border rounded-md p-4">
                      <div className="space-y-2">
                        {questions.map((q) => (
                          <div key={q.question_id} className="flex items-start space-x-2 p-2 hover:bg-accent rounded">
                            <Checkbox
                              id={`q-${q.question_id}`}
                              checked={selectedQuestionIds.includes(q.question_id)}
                              onCheckedChange={() => handleQuestionToggle(q.question_id)}
                            />
                            <Label htmlFor={`q-${q.question_id}`} className="flex-1 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`text-white ${TRAIT_COLORS[q.trait_type]}`}>
                                  {TRAIT_NAMES[q.trait_type]}
                                </Badge>
                                <span className="text-sm">{q.question}</span>
                              </div>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {Object.entries(groupedQuestions).map(([traitName, traitQuestions]) => {
                    const traitType = traitQuestions[0]?.trait_type;
                    return (
                      <TabsContent key={traitName} value={String(traitType)}>
                        <ScrollArea className="h-[300px] border rounded-md p-4">
                          <div className="space-y-2">
                            {traitQuestions.map((q) => (
                              <div key={q.question_id} className="flex items-start space-x-2 p-2 hover:bg-accent rounded">
                                <Checkbox
                                  id={`q-${q.question_id}`}
                                  checked={selectedQuestionIds.includes(q.question_id)}
                                  onCheckedChange={() => handleQuestionToggle(q.question_id)}
                                />
                                <Label htmlFor={`q-${q.question_id}`} className="flex-1 cursor-pointer text-sm">
                                  {q.question}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </div>
            )}

            {/* Alerts */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          {questionsLoaded && (
            <Button onClick={handleSave} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
