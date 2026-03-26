import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, Permission } from "@/lib/permissions";
import type { EmployeeRole } from "@/types/domain.types";

interface RoleGuardProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Wraps UI sections so they only render for users with the required permission.
 * Use this for inline gating (e.g. hiding a button or section), not for route protection.
 * For route-level protection, see ProtectedRoute in App.tsx.
 */
export function RoleGuard({ permission, children, fallback = null }: RoleGuardProps) {
  const { employee } = useAuth();

  if (!employee) return <>{fallback}</>;

  const allowed = hasPermission(employee.role as EmployeeRole, permission);

  return allowed ? <>{children}</> : <>{fallback}</>;
}
