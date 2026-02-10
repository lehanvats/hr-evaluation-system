import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Code, Plus, Trash2, Edit, Eye, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TestCase {
  input: string;
  expected_output: string;
  is_hidden: boolean;
}

interface Problem {
  problem_id: number;
  title: string;
  description: string;
  difficulty: string;
  test_cases_count: number;
  created_at: string;
}

interface SampleProblem {
  file_path: string;
  title: string;
  category: string;
  difficulty: string;
  test_cases_count: number;
  description_preview: string;
}

export default function CodingManagement() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState<number | null>(null);

  // Import state
  const [sampleProblems, setSampleProblems] = useState<SampleProblem[]>([]);
  const [categorizedProblems, setCategorizedProblems] = useState<Record<string, SampleProblem[]>>({});
  const [selectedProblems, setSelectedProblems] = useState<Set<string>>(new Set());
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [importing, setImporting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [starterCodePython, setStarterCodePython] = useState('');
  const [starterCodeJavascript, setStarterCodeJavascript] = useState('');
  const [starterCodeJava, setStarterCodeJava] = useState('');
  const [starterCodeCpp, setStarterCodeCpp] = useState('');
  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: '', expected_output: '', is_hidden: false }
  ]);
  const [timeLimit, setTimeLimit] = useState(5);
  const [memoryLimit, setMemoryLimit] = useState(256);

  useEffect(() => {
    fetchProblems();
  }, []);

  const fetchProblems = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('recruiterToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/code/admin/problems`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setProblems(data.problems);
      }
    } catch (error) {
      console.error('Error fetching problems:', error);
      toast.error('Failed to load problems');
    } finally {
      setLoading(false);
    }
  };

  const addTestCase = () => {
    setTestCases([...testCases, { input: '', expected_output: '', is_hidden: false }]);
  };

  const removeTestCase = (index: number) => {
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  const updateTestCase = (index: number, field: keyof TestCase, value: string | boolean) => {
    const updated = [...testCases];
    updated[index] = { ...updated[index], [field]: value };
    setTestCases(updated);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDifficulty('medium');
    setStarterCodePython('');
    setStarterCodeJavascript('');
    setStarterCodeJava('');
    setStarterCodeCpp('');
    setTestCases([{ input: '', expected_output: '', is_hidden: false }]);
    setTimeLimit(5);
    setMemoryLimit(256);
    setEditingProblem(null);
  };

  const handleSubmit = async () => {
    if (!title || !description || testCases.length === 0) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('recruiterToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/code/admin/problems`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          description,
          difficulty,
          starter_code_python: starterCodePython,
          starter_code_javascript: starterCodeJavascript,
          starter_code_java: starterCodeJava,
          starter_code_cpp: starterCodeCpp,
          test_cases: testCases,
          time_limit_seconds: timeLimit,
          memory_limit_mb: memoryLimit
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Problem created successfully!');
        setIsDialogOpen(false);
        resetForm();
        fetchProblems();
      } else {
        toast.error(data.message || 'Failed to create problem');
      }
    } catch (error) {
      console.error('Error creating problem:', error);
      toast.error('Failed to create problem');
    }
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case 'easy': return 'bg-green-500/15 text-green-700 dark:text-green-400';
      case 'medium': return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400';
      case 'hard': return 'bg-red-500/15 text-red-700 dark:text-red-400';
      default: return 'bg-gray-500/15 text-gray-700 dark:text-gray-400';
    }
  };

  const fetchSampleProblems = async () => {
    setLoadingSamples(true);
    try {
      const token = localStorage.getItem('recruiterToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/code/admin/import/scan`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setSampleProblems(data.problems);
        setCategorizedProblems(data.categories);
        toast.success(`Found ${data.total} sample problems`);
      } else {
        toast.error(data.message || 'Failed to fetch sample problems');
      }
    } catch (error) {
      console.error('Error fetching sample problems:', error);
      toast.error('Failed to fetch sample problems');
    } finally {
      setLoadingSamples(false);
    }
  };

  const handleToggleProblem = (filePath: string) => {
    const newSelected = new Set(selectedProblems);
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath);
    } else {
      newSelected.add(filePath);
    }
    setSelectedProblems(newSelected);
  };

  const handleToggleCategory = (category: string, select: boolean) => {
    const newSelected = new Set(selectedProblems);
    categorizedProblems[category].forEach(problem => {
      if (select) {
        newSelected.add(problem.file_path);
      } else {
        newSelected.delete(problem.file_path);
      }
    });
    setSelectedProblems(newSelected);
  };

  const handleImportSelected = async () => {
    if (selectedProblems.size === 0) {
      toast.error('Please select at least one problem to import');
      return;
    }

    setImporting(true);
    try {
      const token = localStorage.getItem('recruiterToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/code/admin/import/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_paths: Array.from(selectedProblems)
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        if (data.errors && data.errors.length > 0) {
          data.errors.forEach((error: string) => toast.warning(error));
        }
        setIsImportDialogOpen(false);
        setSelectedProblems(new Set());
        fetchProblems();
      } else {
        toast.error(data.message || 'Failed to import problems');
      }
    } catch (error) {
      console.error('Error importing problems:', error);
      toast.error('Failed to import problems');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Coding Problems</h1>
          <p className="text-muted-foreground mt-2">
            Manage coding assessment problems and test cases
          </p>
        </div>
        <div className="flex gap-2">
          {/* Import Dialog */}
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={fetchSampleProblems}>
                <Upload className="h-4 w-4 mr-2" />
                Import from Bank
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Import Problems from Sample Bank</DialogTitle>
                <DialogDescription>
                  Select problems from the coding sample questions folder to import
                </DialogDescription>
              </DialogHeader>

              {loadingSamples ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {selectedProblems.size} problems selected
                    </p>
                    <Button 
                      onClick={handleImportSelected}
                      disabled={selectedProblems.size === 0 || importing}
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>Import Selected</>
                      )}
                    </Button>
                  </div>

                  <Tabs defaultValue={Object.keys(categorizedProblems)[0]} className="w-full">
                    <ScrollArea className="w-full">
                      <TabsList className="w-full justify-start">
                        {Object.keys(categorizedProblems).map(category => (
                          <TabsTrigger key={category} value={category}>
                            {category} ({categorizedProblems[category].length})
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </ScrollArea>

                    {Object.entries(categorizedProblems).map(([category, categoryProblems]) => (
                      <TabsContent key={category} value={category} className="mt-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleCategory(category, true)}
                            >
                              Select All
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleCategory(category, false)}
                            >
                              Deselect All
                            </Button>
                          </div>

                          <ScrollArea className="h-[400px] pr-4">
                            <div className="space-y-2">
                              {categoryProblems.map(problem => (
                                <div
                                  key={problem.file_path}
                                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                                >
                                  <Checkbox
                                    checked={selectedProblems.has(problem.file_path)}
                                    onCheckedChange={() => handleToggleProblem(problem.file_path)}
                                    className="mt-1"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-medium text-sm">{problem.title}</h4>
                                      <Badge className={getDifficultyColor(problem.difficulty)}>
                                        {problem.difficulty}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {problem.description_preview}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {problem.test_cases_count} test cases
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Add Problem Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Problem
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Coding Problem</DialogTitle>
                <DialogDescription>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Basic Info */}
                <div className="space-y-2">
                  <Label htmlFor="title">Problem Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Two Sum"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Problem Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the problem, constraints, and examples..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="difficulty">Difficulty</Label>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeLimit">Time Limit (seconds)</Label>
                    <Input
                      id="timeLimit"
                      type="number"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="memoryLimit">Memory Limit (MB)</Label>
                    <Input
                      id="memoryLimit"
                      type="number"
                      value={memoryLimit}
                      onChange={(e) => setMemoryLimit(parseInt(e.target.value))}
                    />
                  </div>
                </div>

                {/* Starter Code */}
                <div className="space-y-2">
                  <Label>Starter Code - Python</Label>
                  <Textarea
                    placeholder="def functionName(param1, param2):&#10;    # Your code here&#10;    pass"
                    value={starterCodePython}
                    onChange={(e) => setStarterCodePython(e.target.value)}
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Starter Code - JavaScript</Label>
                  <Textarea
                    placeholder="function functionName(param1, param2) {&#10;    // Your code here&#10;}"
                    value={starterCodeJavascript}
                    onChange={(e) => setStarterCodeJavascript(e.target.value)}
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>

                {/* Test Cases */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Test Cases *</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addTestCase}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Test Case
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {testCases.map((tc, index) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Test Case {index + 1}</span>
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={tc.is_hidden}
                                    onChange={(e) => updateTestCase(index, 'is_hidden', e.target.checked)}
                                    className="rounded"
                                  />
                                  Hidden
                                </label>
                                {testCases.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeTestCase(index)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs">Input (JSON format, one value per line)</Label>
                              <Textarea
                                placeholder='[2,7,11,15]&#10;9'
                                value={tc.input}
                                onChange={(e) => updateTestCase(index, 'input', e.target.value)}
                                rows={2}
                                className="font-mono text-xs"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs">Expected Output (JSON format)</Label>
                              <Input
                                placeholder="[0,1]"
                                value={tc.expected_output}
                                onChange={(e) => updateTestCase(index, 'expected_output', e.target.value)}
                                className="font-mono text-xs"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit}>
                    Create Problem
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Problems Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Problems</CardTitle>
          <CardDescription>
            {problems.length} problem{problems.length !== 1 ? 's' : ''} available
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading problems...</div>
          ) : problems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No problems yet. Create your first coding problem!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Test Cases</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {problems.map((problem) => (
                  <TableRow key={problem.problem_id}>
                    <TableCell className="font-mono">{problem.problem_id}</TableCell>
                    <TableCell className="font-medium">{problem.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getDifficultyColor(problem.difficulty)}>
                        {problem.difficulty}
                      </Badge>
                    </TableCell>
                    <TableCell>{problem.test_cases_count || 0} cases</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(problem.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
