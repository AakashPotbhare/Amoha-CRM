import type { EmployeeRole } from '@/types/domain.types';

// ─── Permission Definitions ──────────────────────────────────────────────────

export type Permission =
  | '*'
  // Candidates
  | 'candidates.read'
  | 'candidates.write'
  | 'candidates.enroll'
  | 'candidates.delete'
  // Support Tasks
  | 'support_tasks.read'
  | 'support_tasks.read_own'
  | 'support_tasks.write'
  | 'support_tasks.reassign'
  // General Tasks
  | 'tasks.read'
  | 'tasks.write'
  | 'tasks.read_own'
  // HR
  | 'hr.read'
  | 'hr.write'
  | 'employees.manage'
  | 'salary.manage'
  // Attendance
  | 'attendance.read_all'
  | 'attendance.read_own'
  | 'attendance.manage'
  // Leaves
  | 'leaves.submit'
  | 'leaves.approve_tl'
  | 'leaves.approve_manager'
  // Departments
  | 'departments.all'
  | 'departments.own'
  // Dashboard
  | 'dashboard.global'
  | 'dashboard.department'
  // Shift Management
  | 'shift_management.manage';

// ─── Role → Permissions Map ──────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<EmployeeRole, Permission[]> = {
  director: ['*'],
  ops_head:  ['*'],

  hr_head: [
    'hr.read', 'hr.write',
    'employees.manage',
    'salary.manage',
    'attendance.read_all', 'attendance.manage',
    'leaves.approve_manager',
    'departments.all',
    'dashboard.global',
    'candidates.read',
    'tasks.read', 'tasks.write',
    'support_tasks.read',
    'shift_management.manage',
  ],

  sales_head: [
    'candidates.read', 'candidates.write', 'candidates.enroll',
    'departments.own',
    'tasks.read', 'tasks.write',
    'support_tasks.read', 'support_tasks.write',
    'dashboard.department',
    'attendance.read_own',
    'leaves.submit', 'leaves.approve_tl',
  ],

  technical_head: [
    'support_tasks.read', 'support_tasks.write', 'support_tasks.reassign',
    'departments.own',
    'tasks.read', 'tasks.write',
    'dashboard.department',
    'candidates.read',
    'attendance.read_own',
    'leaves.submit', 'leaves.approve_tl',
  ],

  marketing_tl: [
    'support_tasks.read', 'support_tasks.write', 'support_tasks.reassign',
    'departments.own',
    'tasks.read', 'tasks.write',
    'dashboard.department',
    'candidates.read',
    'attendance.read_own',
    'leaves.submit', 'leaves.approve_tl',
  ],

  resume_head: [
    'support_tasks.read', 'support_tasks.write', 'support_tasks.reassign',
    'departments.own',
    'tasks.read', 'tasks.write',
    'dashboard.department',
    'candidates.read',
    'attendance.read_own',
    'leaves.submit', 'leaves.approve_tl',
  ],

  compliance_officer: [
    'support_tasks.read_own', 'support_tasks.write',
    'tasks.read_own', 'tasks.write',
    'attendance.read_own',
    'leaves.submit',
    'candidates.read',
  ],

  assistant_tl: [
    'candidates.read', 'candidates.enroll',
    'tasks.read', 'tasks.write',
    'support_tasks.read', 'support_tasks.write',
    'attendance.read_own',
    'leaves.submit', 'leaves.approve_tl',
  ],

  sales_executive: [
    'candidates.enroll', 'candidates.read',
    'tasks.read_own', 'tasks.write',
    'support_tasks.write',
    'attendance.read_own',
    'leaves.submit',
  ],

  lead_generator: [
    'candidates.read', 'candidates.enroll',
    'tasks.read_own', 'tasks.write',
    'support_tasks.write',
    'attendance.read_own',
    'leaves.submit',
  ],

  technical_executive: [
    'support_tasks.read_own', 'support_tasks.write',
    'tasks.read_own', 'tasks.write',
    'attendance.read_own',
    'leaves.submit',
    'candidates.read',
  ],

  senior_recruiter: [
    'support_tasks.read_own', 'support_tasks.write',
    'tasks.read_own', 'tasks.write',
    'candidates.read',
    'attendance.read_own',
    'leaves.submit',
  ],

  recruiter: [
    'support_tasks.read_own', 'support_tasks.write',
    'tasks.read_own', 'tasks.write',
    'candidates.read',
    'attendance.read_own',
    'leaves.submit',
  ],

  resume_builder: [
    'support_tasks.read_own', 'support_tasks.write',
    'tasks.read_own', 'tasks.write',
    'candidates.read',
    'attendance.read_own',
    'leaves.submit',
  ],
};

// ─── Permission Checker ──────────────────────────────────────────────────────

export function hasPermission(role: EmployeeRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] ?? [];

  // Wildcard grants everything
  if (permissions.includes('*')) return true;

  // Exact match
  if (permissions.includes(permission)) return true;

  // Wildcard namespace: e.g. 'candidates.*' matches 'candidates.read'
  const [namespace] = permission.split('.');
  if (permissions.includes(`${namespace}.*` as Permission)) return true;

  return false;
}

export function getRolePermissions(role: EmployeeRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

// ─── Leadership / Hierarchy Helpers ─────────────────────────────────────────

export const GLOBAL_DASHBOARD_ROLES: EmployeeRole[] = ['director', 'ops_head', 'hr_head'];
export const DEPT_HEAD_ROLES: EmployeeRole[] = ['sales_head', 'technical_head', 'marketing_tl', 'resume_head'];
export const APPROVER_ROLES: EmployeeRole[] = ['director', 'ops_head', 'hr_head', 'sales_head', 'technical_head', 'marketing_tl', 'resume_head', 'assistant_tl'];
export const LEAVE_MANAGER_ROLES: EmployeeRole[] = ['director', 'ops_head', 'hr_head'];
