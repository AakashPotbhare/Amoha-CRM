import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Password Reset</h1>
        </div>

        <Card className="border-border shadow-xl">
          <CardHeader className="pb-4">
            <p className="text-sm text-muted-foreground text-center">
              Password reset is not available through this portal.
            </p>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-foreground">
              Please contact HR to reset your password.
            </p>
            <Button className="w-full" onClick={() => navigate('/')}>
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
