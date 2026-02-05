import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestCase {
    input: string;
    expected_output: string;
}

interface CodingQuestionProps {
    questionId: number;
    title: string;
    description: string;
    testCases?: TestCase[];
    initialCode?: string;
    allowedLanguages?: string[];
    onSubmit?: (code: string, language: string) => void;
    className?: string;
}

const LANGUAGE_MAP: Record<string, { label: string; monacoLang: string; defaultCode: string }> = {
    python: {
        label: 'Python',
        monacoLang: 'python',
        defaultCode: '# Write your code here\ndef solution():\n    pass\n'
    },
    javascript: {
        label: 'JavaScript',
        monacoLang: 'javascript',
        defaultCode: '// Write your code here\nfunction solution() {\n    \n}\n'
    },
    java: {
        label: 'Java',
        monacoLang: 'java',
        defaultCode: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}\n'
    },
    cpp: {
        label: 'C++',
        monacoLang: 'cpp',
        defaultCode: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}\n'
    }
};

export function CodingQuestion({
    questionId,
    title,
    description,
    testCases = [],
    initialCode,
    allowedLanguages = ['python', 'javascript'],
    onSubmit,
    className
}: CodingQuestionProps) {
    const [language, setLanguage] = useState(allowedLanguages[0] || 'python');
    const [code, setCode] = useState(initialCode || LANGUAGE_MAP[language]?.defaultCode || '');
    const [isRunning, setIsRunning] = useState(false);
    const [output, setOutput] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [testResults, setTestResults] = useState<Array<{ passed: boolean; input: string; expected: string; actual: string }>>([]);

    const handleLanguageChange = (newLang: string) => {
        setLanguage(newLang);
        // Optionally reset code when language changes
        if (!initialCode) {
            setCode(LANGUAGE_MAP[newLang]?.defaultCode || '');
        }
    };

    const handleRunCode = async () => {
        setIsRunning(true);
        setOutput('');
        setError('');
        setTestResults([]);

        try {
            // Call backend API to execute code
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/code/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('candidate_token')}`
                },
                body: JSON.stringify({
                    code,
                    language,
                    stdin: '' // For now, empty stdin
                })
            });

            const data = await response.json();

            if (data.success) {
                setOutput(data.stdout || '');
                setError(data.stderr || '');

                // If test cases provided, evaluate results
                if (testCases.length > 0 && data.stdout) {
                    const results = testCases.map(tc => ({
                        passed: data.stdout.trim() === tc.expected_output.trim(),
                        input: tc.input,
                        expected: tc.expected_output,
                        actual: data.stdout
                    }));
                    setTestResults(results);
                }
            } else {
                setError(data.error || 'Execution failed');
            }
        } catch (err) {
            setError(`Failed to execute code: ${err}`);
        } finally {
            setIsRunning(false);
        }
    };

    const handleSubmit = () => {
        onSubmit?.(code, language);
    };

    return (
        <Card className={cn("p-6 space-y-4", className)}>
            {/* Question Title & Description */}
            <div className="space-y-2">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{description}</p>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-3">
                <label className="text-sm font-medium">Language:</label>
                <Select value={language} onValueChange={handleLanguageChange}>
                    <SelectTrigger className="w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {allowedLanguages.map(lang => (
                            <SelectItem key={lang} value={lang}>
                                {LANGUAGE_MAP[lang]?.label || lang}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Code Editor */}
            <div className="border rounded-lg overflow-hidden">
                <Editor
                    height="400px"
                    language={LANGUAGE_MAP[language]?.monacoLang || language}
                    value={code}
                    onChange={(value) => setCode(value || '')}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                    }}
                />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
                <Button onClick={handleRunCode} disabled={isRunning} className="gap-2">
                    {isRunning ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Running...
                        </>
                    ) : (
                        <>
                            <Play className="h-4 w-4" />
                            Run Code
                        </>
                    )}
                </Button>
                <Button onClick={handleSubmit} variant="default" disabled={isRunning}>
                    Submit Solution
                </Button>
            </div>

            {/* Output Section */}
            {(output || error) && (
                <Card className="p-4 bg-muted/50">
                    <h4 className="text-sm font-semibold mb-2">Output:</h4>
                    {output && (
                        <pre className="text-xs font-mono text-green-600 dark:text-green-400 whitespace-pre-wrap">
                            {output}
                        </pre>
                    )}
                    {error && (
                        <pre className="text-xs font-mono text-destructive whitespace-pre-wrap">
                            {error}
                        </pre>
                    )}
                </Card>
            )}

            {/* Test Results */}
            {testResults.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Test Cases:</h4>
                    {testResults.map((result, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "flex items-center gap-2 p-2 rounded text-xs",
                                result.passed ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"
                            )}
                        >
                            {result.passed ? (
                                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                            ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                            )}
                            <span className="font-medium">Test Case {idx + 1}</span>
                            <Badge variant={result.passed ? "default" : "destructive"}>
                                {result.passed ? "Passed" : "Failed"}
                            </Badge>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
