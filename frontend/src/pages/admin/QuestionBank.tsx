import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import MCQUploadDialog from '@/components/molecules/MCQUploadDialog';
import TextBasedUploadDialog from '@/components/molecules/TextBasedUploadDialog';
import { Upload, FileQuestion, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function QuestionBank() {
  const [mcqDialogOpen, setMcqDialogOpen] = useState(false);
  const [textBasedDialogOpen, setTextBasedDialogOpen] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Question Bank</h1>
        <p className="text-muted-foreground mt-2">
          Upload and manage assessment questions for MCQ and text-based evaluations.
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertTitle>Bulk Upload Support</AlertTitle>
        <AlertDescription>
          Upload questions in bulk using CSV or Excel files. The system supports scenario-based MCQs 
          for workplace problem-solving and open-ended text-based questions.
        </AlertDescription>
      </Alert>

      {/* MCQ Management */}
      <Card className="p-6 space-y-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <FileQuestion className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">MCQ Question Bank</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload scenario-based multiple choice questions highlighting workplace problem-solving situations.
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-sm">Question Format</h3>
            <ul className="text-sm text-muted-foreground space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Each question must include a workplace scenario followed by a problem-solving question</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>4 options per question with one correct answer</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Required columns: question_id, question, option1-4, correct_answer</span>
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5">
              <Label className="text-base">Upload MCQ Questions</Label>
              <p className="text-sm text-muted-foreground">
                CSV or Excel file (replaces all existing questions)
              </p>
            </div>
            <Button onClick={() => setMcqDialogOpen(true)} size="lg">
              <Upload className="mr-2 h-4 w-4" />
              Upload MCQs
            </Button>
          </div>
        </div>
      </Card>

      {/* Text-Based Question Management */}
      <Card className="p-6 space-y-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10">
            <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">Text-Based Question Bank</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload open-ended questions for comprehensive text-based assessments with AI-powered evaluation.
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-sm">Question Format</h3>
            <ul className="text-sm text-muted-foreground space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                <span>Open-ended questions requiring detailed written responses</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                <span>Maximum 200 words per answer</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                <span>Required columns: question_id, question</span>
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5">
              <Label className="text-base">Upload Text-Based Questions</Label>
              <p className="text-sm text-muted-foreground">
                CSV or Excel file (replaces all existing questions)
              </p>
            </div>
            <Button onClick={() => setTextBasedDialogOpen(true)} size="lg" variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Upload Questions
            </Button>
          </div>
        </div>
      </Card>

      {/* Important Notes */}
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Important: Data Replacement</AlertTitle>
        <AlertDescription>
          Uploading new questions will replace all existing questions and delete associated candidate responses. 
          This action cannot be undone. Make sure to backup your data before proceeding.
        </AlertDescription>
      </Alert>

      {/* MCQ Upload Dialog */}
      <MCQUploadDialog
        open={mcqDialogOpen}
        onOpenChange={setMcqDialogOpen}
        onUploadComplete={() => {
          console.log('MCQ questions upload completed');
        }}
      />

      {/* Text-Based Upload Dialog */}
      <TextBasedUploadDialog
        open={textBasedDialogOpen}
        onOpenChange={setTextBasedDialogOpen}
        onUploadComplete={() => {
          console.log('Text-based questions upload completed');
        }}
      />
    </div>
  );
}
