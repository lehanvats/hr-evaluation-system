import { useNavigate } from 'react-router-dom';
import { Users, FileCheck, Clock, TrendingUp, MoreHorizontal, Eye, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from 'react';

interface Candidate {
  id: number;
  email: string;
  name: string;
  role: string;
  technical_score: number | null;
  soft_skill_score: number | null;
  fairplay_score: number | null;
  overall_score: number | null;
  status: 'High Match' | 'Potential' | 'Reject' | 'Not Tested';
  has_taken_test: boolean;
  mcq_completed: boolean;
  psychometric_completed: boolean;
  technical_completed: boolean;
  text_based_completed: boolean;
  last_active: string | null;
}

interface Stats {
  total_candidates: number;
  assessments_completed: number;
  high_match: number;
  potential: number;
  reject: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('recruiterToken');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch('http://localhost:5000/api/recruiter/candidates', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch candidates');
      }

      const data = await response.json();
      if (data.success) {
        setCandidates(data.candidates);
        setStats(data.stats);
      } else {
        throw new Error(data.message || 'Failed to load candidates');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'High Match':
        return 'bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/25 border-green-500/20';
      case 'Potential':
        return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/25 border-yellow-500/20';
      case 'Reject':
        return 'bg-red-500/15 text-red-700 dark:text-red-400 hover:bg-red-500/25 border-red-500/20';
      case 'Not Tested':
        return 'bg-gray-500/15 text-gray-700 dark:text-gray-400 hover:bg-gray-500/25 border-gray-500/20';
      default:
        return 'bg-gray-500/15 text-gray-700 dark:text-gray-400 hover:bg-gray-500/25';
    }
  };

  const statsDisplay = stats ? [
    {
      label: 'Total Candidates',
      value: stats.total_candidates.toString(),
      change: '+12%',
      icon: Users,
    },
    {
      label: 'Assessments Completed',
      value: stats.assessments_completed.toString(),
      change: `${stats.total_candidates > 0 ? Math.round((stats.assessments_completed / stats.total_candidates) * 100) : 0}%`,
      icon: FileCheck,
    },
    {
      label: 'High Match',
      value: stats.high_match.toString(),
      change: `${stats.total_candidates > 0 ? Math.round((stats.high_match / stats.total_candidates) * 100) : 0}%`,
      icon: TrendingUp,
    },
    {
      label: 'Pass Rate',
      value: `${stats.total_candidates > 0 ? Math.round(((stats.high_match + stats.potential) / stats.total_candidates) * 100) : 0}%`,
      change: stats.potential > 0 ? `+${stats.potential} potential` : '0 potential',
      icon: Clock,
    },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your hiring pipeline and candidate analytics.
        </p>
      </div>

      {loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading candidates...</p>
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <>
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statsDisplay.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between space-y-0 pb-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-baseline space-x-3">
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-xs font-medium text-muted-foreground">
                      {stat.change}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Candidates Table */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Candidates</CardTitle>
              <CardDescription>
                A list of candidates and their assessment scores.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {candidates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No candidates found. Upload candidates to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Technical Score</TableHead>
                      <TableHead>Soft Skill Score</TableHead>
                      <TableHead>Overall Score</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((candidate) => (
                      <TableRow key={candidate.id}>
                        <TableCell className="font-medium">{candidate.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{candidate.email}</TableCell>
                        <TableCell>
                          {candidate.technical_score !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${candidate.technical_score}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{candidate.technical_score.toFixed(0)}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not tested</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {candidate.soft_skill_score !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${candidate.soft_skill_score}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{candidate.soft_skill_score.toFixed(0)}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not tested</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {candidate.overall_score !== null ? (
                            <span className="font-semibold">{candidate.overall_score.toFixed(1)}%</span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not tested</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {candidate.last_active ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {new Date(candidate.last_active).toLocaleDateString()}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(candidate.last_active).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(candidate.status)}>
                            {candidate.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => navigate(`/admin/candidate/${candidate.id}`)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
