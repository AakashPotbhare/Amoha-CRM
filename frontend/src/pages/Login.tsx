import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api.client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import amohaLogo from '@/assets/amoha_logo.png';

export default function Login() {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetValue, setResetValue] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeCode.trim() || !password.trim()) return;

    setLoading(true);
    const { error } = await signIn(employeeCode.trim(), password);
    setLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Login Failed', description: error });
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = resetValue.trim();
    if (!val) return;

    setLoading(true);
    try {
      const payload = val.includes('@') ? { email: val } : { employee_code: val };
      await api.post('/api/auth/forgot-password', payload);
      setResetSent(true);
    } catch {
      // Still show success to avoid leaking account existence
      setResetSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo & Company */}
        <div className="text-center space-y-3 mb-6">
          <img src={amohaLogo} alt="Amoha Recruitment Services" className="mx-auto h-16 w-auto" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
              RecruitHub
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              by Amoha Recruitment Services
            </p>
          </div>
        </div>

        <Card className="border-border shadow-xl card-elevated">
          {!showReset ? (
            <>
              <CardHeader className="pb-4">
                <h2 className="text-lg font-semibold text-foreground">Sign In</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your employee code and password
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Employee Code</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="code"
                        placeholder="ARS202301"
                        value={employeeCode}
                        onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                        className="pl-10 uppercase w-full"
                        autoComplete="username"
                        maxLength={20}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full"
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Sign In
                  </Button>

                  <button
                    type="button"
                    onClick={() => setShowReset(true)}
                    className="w-full text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="pb-4">
                <button
                  onClick={() => { setShowReset(false); setResetSent(false); setResetValue(''); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to login
                </button>
                <h2 className="text-lg font-semibold text-foreground">Forgot Password</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your employee code or registered email
                </p>
              </CardHeader>
              <CardContent>
                {resetSent ? (
                  <div className="space-y-4 text-center py-2">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                    <p className="font-medium">Reset link sent!</p>
                    <p className="text-sm text-muted-foreground">
                      If that account exists, a password reset link has been sent to the registered email. It expires in 1 hour.
                    </p>
                    <Button variant="outline" className="w-full" onClick={() => { setShowReset(false); setResetSent(false); setResetValue(''); }}>
                      Back to Sign In
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-val">Employee Code or Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="reset-val"
                          placeholder="ARS20240001 or you@example.com"
                          value={resetValue}
                          onChange={(e) => setResetValue(e.target.value)}
                          className="pl-10 w-full"
                          autoComplete="email"
                          maxLength={255}
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading || !resetValue.trim()}>
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Send Reset Link
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Amoha Recruitment Services. All rights reserved.
        </p>
      </div>
    </div>
  );
}
