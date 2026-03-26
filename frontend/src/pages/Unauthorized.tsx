import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeAccess } from "@/hooks/useEmployeeAccess";

export default function Unauthorized() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const access = useEmployeeAccess();

  const handleGoHome = () => {
    const home = access?.getDashboardRoute() ?? "/";
    navigate(home, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-5 text-center max-w-md">
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10">
          <ShieldOff className="w-10 h-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to view this page. Contact your manager or HR if you think this is a mistake.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleGoHome}>Go to Dashboard</Button>
          <Button variant="outline" onClick={signOut}>Sign Out</Button>
        </div>
      </div>
    </div>
  );
}
