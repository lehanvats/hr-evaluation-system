import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Shield, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { recruiterApi } from '@/lib/api';

export default function RecruiterLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await recruiterApi.login(email, password);

      if (result.data && (result.data as any).success) {
        const data = result.data as any;
        // Store token and user data
        localStorage.setItem('recruiterToken', data.token);
        localStorage.setItem('recruiterUser', JSON.stringify(data.user));
        
        // Navigate to dashboard
        navigate('/admin/dashboard');
      } else {
        setError((result.data as any)?.message || result.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-500 text-sm font-medium">
            <Shield className="h-4 w-4" />
            Recruiter Login
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome Back
          </h1>
          <p className="text-muted-foreground">
            Sign in to access your recruiter dashboard
          </p>
        </div>

        {/* Login Form */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="recruiter@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                'Signing in...'
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </Card>

        {/* Back to home */}
        <div className="text-center">
          <Button
            variant="link"
            onClick={() => navigate('/')}
            className="text-muted-foreground"
          >
            ← Back to Home
          </Button>
        </div>

        {/* Demo credentials */}
        <Card className="p-4 bg-muted/50">
          <p className="text-sm font-medium mb-2">Demo Credentials:</p>
          <p className="text-xs text-muted-foreground font-mono">
            Email: admin@hreval.com<br />
            Password: Admin123!
          </p>
        </Card>
      </div>
    </div>
  );
}
