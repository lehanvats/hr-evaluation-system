import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Mail, Calendar, CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { recruiterApi } from '@/lib/api';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useState } from 'react';

interface MCQResult {
  correct_answers: number;
  wrong_answers: number;
  percentage_correct: number;
}

interface PsychometricResult {
  extraversion: number;
  agreeableness: number;
  conscientiousness: number;
  emotional_stability: number;
  intellect_imagination: number;
}

interface IntegrityLog {
  timestamp: string;
  event: string;
  severity: 'low' | 'medium' | 'high';
}

interface CandidateDetail {
  id: number;
  email: string;
  name: string;
  role: string;
  technical_score: number;
  soft_skill_score: number;
  fairplay_score: number;
  overall_score: number;
  status: string;
  verdict: 'Hire' | 'No-Hire';
  applied_date: string;
  mcq_result: MCQResult;
  psychometric_result: PsychometricResult;
  integrity_logs: IntegrityLog[];
  ai_rationale: string;
}

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchCandidateDetail(id);
    }
  }, [id]);

  const fetchCandidateDetail = async (candidateId: string) => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('recruiterToken');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/recruiter/candidates/${candidateId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch candidate details');
      }

      const data = await response.json();
      if (data.success) {
        setCandidate(data.candidate);
      } else {
        throw new Error(data.message || 'Failed to load candidate details');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching candidate details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRationale = async () => {
    if (!candidate) return;

    try {
      setGenerating(true);
      const result = await recruiterApi.generateRationale(candidate.id);

      if (result.error) {
        throw new Error(result.error);
      }

      // Refresh candidate details to show new rationale
      if (id) await fetchCandidateDetail(id);

    } catch (err) {
      console.error('Error generating rationale:', err);
      // Could show toast here
    } finally {
      setGenerating(false);
    }
  };

  const getVerdictBadge = (verdict: string) => {
    if (verdict === 'Hire') {
      return (
        <Badge className="bg-green-600 hover:bg-green-700 text-white text-lg px-4 py-1.5 h-auto">
          <CheckCircle className="mr-2 h-5 w-5" />
          HIRE
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="text-lg px-4 py-1.5 h-auto">
        <XCircle className="mr-2 h-5 w-5" />
        NO-HIRE
      </Badge>
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-orange-500';
      default: return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading candidate details...</p>
        </div>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="space-y-6 animate-fade-in max-w-7xl mx-auto p-6">
        <Link
          to="/admin/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <p>{error || 'Candidate not found'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto p-6">
      {/* Back Link */}
      <Link
        to="/admin/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Candidate Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-border pb-6">
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
            {candidate.name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {candidate.name}
            </h1>
            <p className="text-lg text-muted-foreground">{candidate.role}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                {candidate.email}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Applied {candidate.applied_date}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end gap-2">
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Verdict</span>
            {getVerdictBadge(candidate.verdict)}
          </div>
          <div className="h-12 w-px bg-border mx-2 hidden md:block" />
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

        {/* Card 1: AI Rationale (Spans 2 columns on large screens) */}
        <Card className="md:col-span-2 lg:col-span-2 h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="bg-primary/10 p-2 rounded-lg">🤖</span>
                AI Decision Rationale
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateRationale}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Generate Analysis
                  </>
                )}
              </Button>
            </CardTitle>
            <CardDescription>
              Analysis generated regarding the hiring decision.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="bg-muted/30 p-6 rounded-xl border border-border/50 text-base leading-relaxed">
              {candidate.ai_rationale}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Scores */}
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Performance Scores</CardTitle>
            <CardDescription>Technical vs. Soft Skills</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 flex-1 flex flex-col justify-center">
            {/* Technical Score */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Technical Skills</span>
                <span className="font-bold">{candidate.technical_score.toFixed(1)}/100</span>
              </div>
              <Progress value={candidate.technical_score} className="h-3" />
              <p className="text-xs text-muted-foreground">
                MCQ Accuracy: {candidate.mcq_result.correct_answers} correct / {candidate.mcq_result.correct_answers + candidate.mcq_result.wrong_answers} total
              </p>
            </div>

            {/* Soft Skills Score */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Soft Skills / Culture</span>
                <span className="font-bold">{candidate.soft_skill_score.toFixed(1)}/100</span>
              </div>
              <Progress value={candidate.soft_skill_score} className="h-3" />
            </div>

            {/* Fairplay Score */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Integrity / Fairplay</span>
                <span className="font-bold">{candidate.fairplay_score.toFixed(1)}/100</span>
              </div>
              <Progress value={candidate.fairplay_score} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {candidate.integrity_logs.length} violation(s) detected
              </p>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Overall Weighted Score</span>
                <span className="text-xl font-bold text-primary">
                  {candidate.overall_score.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Psychometric Breakdown */}
        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle>Psychometric Assessment (Big Five Traits)</CardTitle>
            <CardDescription>
              Personality assessment based on the Five Factor Model
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Extraversion</span>
                  <span className="text-sm font-bold">{candidate.psychometric_result.extraversion.toFixed(1)}/5</span>
                </div>
                <Progress value={candidate.psychometric_result.extraversion * 20} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Agreeableness</span>
                  <span className="text-sm font-bold">{candidate.psychometric_result.agreeableness.toFixed(1)}/5</span>
                </div>
                <Progress value={candidate.psychometric_result.agreeableness * 20} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Conscientiousness</span>
                  <span className="text-sm font-bold">{candidate.psychometric_result.conscientiousness.toFixed(1)}/5</span>
                </div>
                <Progress value={candidate.psychometric_result.conscientiousness * 20} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Emotional Stability</span>
                  <span className="text-sm font-bold">{candidate.psychometric_result.emotional_stability.toFixed(1)}/5</span>
                </div>
                <Progress value={candidate.psychometric_result.emotional_stability * 20} className="h-2" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Intellect/Imagination</span>
                  <span className="text-sm font-bold">{candidate.psychometric_result.intellect_imagination.toFixed(1)}/5</span>
                </div>
                <Progress value={candidate.psychometric_result.intellect_imagination * 20} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Integrity Log */}
        <Card className="md:col-span-2 lg:col-span-1 h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Integrity Monitor
            </CardTitle>
            <CardDescription>
              Proctoring event log
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px] p-0 relative">
            <ScrollArea className="h-[350px] w-full p-6 pt-0">
              <div className="space-y-4">
                {candidate.integrity_logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-4 pb-4 border-b last:border-0 border-border/50 last:pb-0">
                    <span className="text-xs font-mono text-muted-foreground whitespace-nowrap pt-1">
                      {log.timestamp}
                    </span>
                    <div>
                      <p className={`text-sm font-medium ${getSeverityColor(log.severity)}`}>
                        {log.event}
                      </p>
                    </div>
                  </div>
                ))}
                {candidate.integrity_logs.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    No integrity violations detected.
                  </div>
                )}
              </div>
            </ScrollArea>
            {candidate.integrity_logs.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
