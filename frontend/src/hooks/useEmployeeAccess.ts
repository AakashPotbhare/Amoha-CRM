import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";
import { hasPermission, Permission, GLOBAL_DASHBOARD_ROLES, DEPT_HEAD_ROLES } from "@/lib/permissions";
import type { EmployeeRole, DepartmentSlug } from "@/types/domain.types";

export type { DepartmentSlug };

interface EmployeeAccess {
  role: EmployeeRole;
  departmentSlug: DepartmentSlug | "";
  departmentId: string;
  teamId: string;
  employeeId: string;
  // Role flags
  isDirector: boolean;
  isOpsHead: boolean;
  isHrHead: boolean;
  isLeadership: boolean;         // director | ops_head
  isSeniorLeadership: boolean;   // director | ops_head | hr_head
  isDeptHead: boolean;           // sales_head | technical_head | marketing_tl | resume_head
  isMarketingTL: boolean;
  isSalesHead: boolean;
  isTechnicalHead: boolean;
  isResumeHead: boolean;
  // Permission helper
  hasPermission: (permission: Permission) => boolean;
  // Department access
  canViewAllDepartments: boolean;
  canViewDepartment: (slug: string) => boolean;
  // Navigation
  getDashboardRoute: () => string;
}

const DEPT_ROUTES: Record<string, string> = {
  sales: "/departments/sales",
  resume: "/departments/resume",
  marketing: "/departments/marketing",
  technical: "/departments/technical",
  compliance: "/departments/compliance",
};

export function useEmployeeAccess(): EmployeeAccess | null {
  const { employee } = useAuth();

  return useMemo(() => {
    if (!employee) return null;

    const role = employee.role as EmployeeRole;
    const departmentSlug = (employee.departments?.slug ?? "") as DepartmentSlug | "";

    const isDirector = role === "director";
    const isOpsHead = role === "ops_head";
    const isHrHead = role === "hr_head";
    const isLeadership = isDirector || isOpsHead;
    const isSeniorLeadership = isLeadership || isHrHead;
    const isDeptHead = DEPT_HEAD_ROLES.includes(role);
    const isMarketingTL = role === "marketing_tl";
    const isSalesHead = role === "sales_head";
    const isTechnicalHead = role === "technical_head";
    const isResumeHead = role === "resume_head";

    const canViewAllDepartments = GLOBAL_DASHBOARD_ROLES.includes(role);

    const canViewDepartment = (slug: string): boolean => {
      if (canViewAllDepartments) return true;
      return departmentSlug === slug;
    };

    const getDashboardRoute = (): string => {
      if (isLeadership || isHrHead) return "/dashboard";
      return DEPT_ROUTES[departmentSlug] || "/";
    };

    const checkPermission = (permission: Permission): boolean =>
      hasPermission(role, permission);

    return {
      role,
      departmentSlug,
      departmentId: employee.department_id,
      teamId: employee.team_id,
      employeeId: employee.id,
      isDirector,
      isOpsHead,
      isHrHead,
      isLeadership,
      isSeniorLeadership,
      isDeptHead,
      isMarketingTL,
      isSalesHead,
      isTechnicalHead,
      isResumeHead,
      hasPermission: checkPermission,
      canViewAllDepartments,
      canViewDepartment,
      getDashboardRoute,
    };
  }, [employee]);
}
