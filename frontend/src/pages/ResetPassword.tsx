import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api.client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, XCircle } from 'lucide-react';
import amohaLogo from '@/assets/amoha_logo.png';

type PageState = 'loading' | 'invalid' | 'form' | 'success';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [state, setState]           = useState<PageState>('loading');
  const [employeeCode, setEmployeeCode] = useState('');
  const [fullName, setFullName]     = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  // Verify token on mount
  useEffect(() => {
    if (!token) { setState('invalid'); return; }

    api.get<{ valid: boolean; employee_code?: string; full_name?: string }>(
      `/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`
    )
      .then(res => {
        const d = res.data as unknown as { valid: boolean; employee_code?: string; full_name?: string };
        if (d?.valid) {
          setEmployeeCode(d.employee_code ?? '');
          setFullName(d.full_name ?? '');
          setState('form');
        } else {
          setState('invalid');
        }
      })
      .catch(() => setState('invalid'));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }

    setSaving(true);
    try {
      await api.post('/api/auth/reset-password', { token, new_password: newPassword });
      setState('success');
      // Auto-navigate to login after 3 seconds
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to reset password. The link may have expired.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const passwordStrength = () => {
    if (!newPassword) return null;
    if (newPassword.length < 8) return { label: 'Too short', color: 'bg-red-500', width: '25%' };
    if (newPassword.length < 10) return { label: 'Weak', color: 'bg-orange-400', width: '50%' };
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) return { label: 'Fair', color: 'bg-yellow-400', width: '75%' };
    return { label: 'Strong', color: 'bg-emerald-500', width: '100%' };
  };
  const strength = passwordStrength();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center space-y-3 mb-6">
          <img src={amohaLogo} alt="Amoha Recruitment Services" className="mx-auto h-16 w-auto" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
              RecruitHub
            </h1>
            <p className="text-muted-foreground text-sm mt-1">by Amoha Recruitment Services</p>
          </div>
        </div>

        <Card className="border-border shadow-xl">

          {/* ── Loading ── */}
          {state === 'loading' && (
            <CardContent className="py-12 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Verifying reset link…</p>
            </CardContent>
          )}

          {/* ── Invalid / Expired ── */}
          {state === 'invalid' && (
            <>
              <CardHeader className="pb-2 text-center">
                <XCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
                <h2 className="text-lg font-semibold">Link Invalid or Expired</h2>
              </CardHeader>
              <CardContent className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  This reset link is invalid or has already been used. Reset links expire after 1 hour.
                </p>
                <Button className="w-full" onClick={() => navigate('/login')}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
                </Button>
                <p className="text-xs text-muted-foreground">
                  Need a new link? Click "Forgot password?" on the login page.
                </p>
              </CardContent>
            </>
          )}

          {/* ── Reset Form ── */}
          {state === 'form' && (
            <>
              <CardHeader className="pb-4">
                <KeyRound className="w-8 h-8 text-primary mb-1" />
                <h2 className="text-lg font-semibold">Set New Password</h2>
                {fullName && (
                  <p className="text-sm text-muted-foreground">
                    Hello, <strong>{fullName}</strong> ({employeeCode})
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="new-pw">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-pw"
                        type={showNew ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="pr-10 w-full"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Strength bar */}
                    {strength && (
                      <div className="space-y-1">
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: strength.width }} />
                        </div>
                        <p className="text-xs text-muted-foreground">{strength.label}</p>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirm-pw">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-pw"
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Repeat password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className={`pr-10 w-full ${confirmPassword && confirmPassword !== newPassword ? 'border-destructive' : ''}`}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && confirmPassword !== newPassword && (
                      <p className="text-xs text-destructive">Passwords do not match</p>
                    )}
                  </div>

                  {/* Error */}
                  {error && (
                    <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={saving || !newPassword || !confirmPassword}
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Reset Password
                  </Button>

                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" /> Back to Sign In
                  </button>
                </form>
              </CardContent>
            </>
          )}

          {/* ── Success ── */}
          {state === 'success' && (
            <>
              <CardHeader className="pb-2 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <h2 className="text-lg font-semibold">Password Reset!</h2>
              </CardHeader>
              <CardContent className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Your password has been reset successfully. Redirecting you to sign in…
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redirecting in 3 seconds…
                </div>
                <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
                  Sign In Now
                </Button>
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
