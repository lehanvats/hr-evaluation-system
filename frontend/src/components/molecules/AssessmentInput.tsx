import { AssessmentQuestion } from '@/types/assessment';
import { CodeEditorMock } from './CodeEditorMock';
import { PsychometricSlider } from './PsychometricSlider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface AssessmentInputProps {
    question: AssessmentQuestion;
    answer: any;
    onAnswerChange: (answer: any) => void;
    onSubmit: () => void;
    isRunning?: boolean;
}

export function AssessmentInput({
    question,
    answer,
    onAnswerChange,
    onSubmit,
    isRunning = false
}: AssessmentInputProps) {

    // Render Coding Interface
    if (question.type === 'coding') {
        return (
            <CodeEditorMock
                initialCode={question.template}
                onRunCode={onSubmit}
                isRunning={isRunning}
            />
        );
    }

    // Render MCQ Interface (handles both API format and mock format)
    if (question.type === 'mcq' || question.options) {
        // Check if this is a psychometric question (has trait_type or scoring_direction)
        const isPsychometric = 'trait_type' in question || 'scoring_direction' in question;
        
        // If it's a psychometric question, use the slider
        if (isPsychometric && question.options.length === 5) {
            const labels = question.options.map(opt => opt.text);
            
            return (
                <div className="h-full flex flex-col p-8 max-w-3xl mx-auto w-full justify-center">
                    <PsychometricSlider
                        value={answer}
                        onChange={onAnswerChange}
                        labels={labels}
                    />
                    <div className="mt-8 flex justify-center">
                        <Button onClick={onSubmit} size="lg" disabled={!answer} className="min-w-[200px]">
                            Next Question
                        </Button>
                    </div>
                </div>
            );
        }
        
        // Regular MCQ with radio buttons - optimized for scenario-based questions
        return (
            <div className="h-full flex flex-col p-6 max-w-3xl mx-auto w-full">
                <RadioGroup
                    value={answer?.toString()}
                    onValueChange={(val) => onAnswerChange(question.options[0]?.id ? val : parseInt(val))}
                    className="space-y-3"
                >
                    {question.options.map((option) => {
                        const optionId = option.id.toString();
                        const isSelected = answer?.toString() === optionId;
                        
                        return (
                            <div key={optionId} className="flex items-start space-x-2">
                                <RadioGroupItem value={optionId} id={optionId} className="peer sr-only" />
                                <Label
                                    htmlFor={optionId}
                                    className="flex items-start w-full p-4 rounded-lg border-2 border-muted bg-card hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                                >
                                    <div className="w-5 h-5 rounded-full border border-primary mr-3 mt-0.5 flex-shrink-0 flex items-center justify-center">
                                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                    </div>
                                    <span className="text-base leading-relaxed">{option.text}</span>
                                </Label>
                            </div>
                        );
                    })}
                </RadioGroup>
                <div className="mt-8 flex justify-end">
                    <Button onClick={onSubmit} size="lg" disabled={!answer}>
                        Submit Answer
                    </Button>
                </div>
            </div>
        );
    }

    // Render Rating/Slider Interface
    if (question.type === 'rating') {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
                <Card className="w-full p-8 space-y-8">
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-bold text-primary">{answer || question.min}</h3>
                        <p className="text-muted-foreground">Your Rating</p>
                    </div>

                    <Slider
                        value={[answer || question.min]}
                        min={question.min}
                        max={question.max}
                        step={question.step || 1}
                        onValueChange={(value) => onAnswerChange(value[0])}
                        className="py-4"
                    />

                    <div className="flex justify-between text-sm text-muted-foreground w-full px-1">
                        <span>{question.minLabel}</span>
                        <span>{question.maxLabel}</span>
                    </div>

                    <div className="pt-6 flex justify-center w-full">
                        <Button onClick={onSubmit} size="lg" className="w-full sm:w-auto min-w-[200px]">
                            Confirm Rating
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    // Render Text Interface (for question.type === 'text' or text-based questions from DB without type)
    // Text-based questions from API have question_id and question fields but no type/options
    const isTextBased = question.type === 'text' || (!question.type && !question.options && question.question_id);
    if (isTextBased) {
        const wordCount = (answer as string)?.split(/\s+/).filter(word => word.length > 0).length || 0;
        const maxWords = 200;

        return (
            <div className="h-full flex flex-col p-6 max-w-3xl mx-auto w-full">
                <h3 className="text-lg font-medium mb-4">Your Answer:</h3>
                <Card className="flex-1 p-2 flex flex-col">
                    <Textarea
                        value={answer as string || ''}
                        onChange={(e) => onAnswerChange(e.target.value)}
                        placeholder="Type your answer here..."
                        className="flex-1 resize-none border-0 focus-visible:ring-0 text-base leading-relaxed p-4"
                    />
                    <div className="p-2 text-right text-xs text-muted-foreground border-t">
                        {wordCount} / {maxWords} words
                    </div>
                </Card>
                <div className="mt-6 flex justify-end">
                    <Button onClick={onSubmit} size="lg" disabled={wordCount === 0}>
                        Submit Response
                    </Button>
                </div>
            </div>
        );
    }

    return <div>Unknown question type</div>;
}
