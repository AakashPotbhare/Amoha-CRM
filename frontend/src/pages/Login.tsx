import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Mail, ArrowLeft, Loader2 } from 'lucide-react';
import amohaLogo from '@/assets/amoha_logo.png';

export default function Login() {
  const { signIn, resetPassword } = useAuth();
  const { toast } = useToast();
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

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
    if (!resetEmail.trim()) return;

    setLoading(true);
    const { error } = await resetPassword(resetEmail.trim());
    setLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error });
    } else {
      toast({ title: 'Email Sent', description: 'Check your Gmail for the password reset link.' });
      setShowReset(false);
      setResetEmail('');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo & Company */}
        <div className="text-center space-y-3">
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
                        className="pl-10 uppercase"
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
                  onClick={() => setShowReset(false)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to login
                </button>
                <h2 className="text-lg font-semibold text-foreground">Reset Password</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your registered Gmail to receive a reset link
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Registered Gmail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="yourname@gmail.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="pl-10"
                        maxLength={255}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Send Reset Link
                  </Button>
                </form>
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
