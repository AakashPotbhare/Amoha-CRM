import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEmployeeAccess } from '@/hooks/useEmployeeAccess';

// ─── Mock AuthContext ─────────────────────────────────────────────────────────
// We mock the entire AuthContext module so we can control what `useAuth` returns
// without mounting a real AuthProvider (which would attempt API calls).

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/contexts/AuthContext';
import type { Employee } from '@/contexts/AuthContext';

const mockUseAuth = vi.mocked(useAuth);

// ─── Employee factory ─────────────────────────────────────────────────────────

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-001',
    employee_code: 'EMP001',
    full_name: 'Test User',
    email: 'test@example.com',
    phone: '5551234567',
    role: 'recruiter',
    department_id: 'dept-001',
    team_id: 'team-001',
    is_active: true,
    joining_date: '2023-01-01',
    salary: null,
    departments: { name: 'Sales', slug: 'sales' },
    teams: { name: 'Alpha' },
    dept_name: 'Sales',
    dept_slug: 'sales',
    team_name: 'Alpha',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useEmployeeAccess', () => {
  describe('when employee is null (unauthenticated)', () => {
    it('returns null', () => {
      mockUseAuth.mockReturnValue({
        employee: null,
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current).toBeNull();
    });
  });

  // ─── director ──────────────────────────────────────────────────────────────

  describe('director role', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        employee: makeEmployee({ role: 'director', departments: { name: 'HQ', slug: 'sales' } }),
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });
    });

    it('returns correct identity fields', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.employeeId).toBe('emp-001');
      expect(result.current?.role).toBe('director');
      expect(result.current?.departmentSlug).toBe('sales');
    });

    it('sets isDirector = true', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.isDirector).toBe(true);
    });

    it('sets isLeadership = true', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.isLeadership).toBe(true);
    });

    it('sets isSeniorLeadership = true', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.isSeniorLeadership).toBe(true);
    });

    it('sets isDeptHead = false', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.isDeptHead).toBe(false);
    });

    it('has permission for any permission (wildcard)', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.hasPermission('candidates.read')).toBe(true);
      expect(result.current?.hasPermission('salary.manage')).toBe(true);
      expect(result.current?.hasPermission('shift_management.manage')).toBe(true);
    });

    it('canViewAllDepartments = true', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.canViewAllDepartments).toBe(true);
    });

    it('canViewDepartment returns true for any slug', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.canViewDepartment('sales')).toBe(true);
      expect(result.current?.canViewDepartment('technical')).toBe(true);
      expect(result.current?.canViewDepartment('compliance')).toBe(true);
    });

    it('getDashboardRoute returns "/dashboard"', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.getDashboardRoute()).toBe('/dashboard');
    });
  });

  // ─── ops_head ──────────────────────────────────────────────────────────────

  describe('ops_head role', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        employee: makeEmployee({ role: 'ops_head' }),
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });
    });

    it('sets isOpsHead = true and isLeadership = true', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.isOpsHead).toBe(true);
      expect(result.current?.isLeadership).toBe(true);
      expect(result.current?.isDirector).toBe(false);
    });

    it('getDashboardRoute returns "/dashboard"', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.getDashboardRoute()).toBe('/dashboard');
    });
  });

  // ─── hr_head ───────────────────────────────────────────────────────────────

  describe('hr_head role', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        employee: makeEmployee({ role: 'hr_head' }),
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });
    });

    it('sets isHrHead = true', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.isHrHead).toBe(true);
    });

    it('sets isLeadership = false (not director/ops_head)', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.isLeadership).toBe(false);
    });

    it('sets isSeniorLeadership = true', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.isSeniorLeadership).toBe(true);
    });

    it('canViewAllDepartments = true', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.canViewAllDepartments).toBe(true);
    });

    it('getDashboardRoute returns "/dashboard"', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.getDashboardRoute()).toBe('/dashboard');
    });

    it('has salary.manage permission', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.hasPermission('salary.manage')).toBe(true);
    });

    it('does NOT have candidates.write permission', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.hasPermission('candidates.write')).toBe(false);
    });
  });

  // ─── sales_head ────────────────────────────────────────────────────────────

  describe('sales_head role', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        employee: makeEmployee({
          role: 'sales_head',
          departments: { name: 'Sales', slug: 'sales' },
        }),
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });
    });

    it('sets isSalesHead = true and isDeptHead = true', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.isSalesHead).toBe(true);
      expect(result.current?.isDeptHead).toBe(true);
    });

    it('sets isSeniorLeadership = false', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.isSeniorLeadership).toBe(false);
    });

    it('canViewAllDepartments = false', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.canViewAllDepartments).toBe(false);
    });

    it('canViewDepartment("sales") = true (own department)', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.canViewDepartment('sales')).toBe(true);
    });

    it('canViewDepartment("technical") = false (other department)', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.canViewDepartment('technical')).toBe(false);
    });

    it('getDashboardRoute returns "/departments/sales"', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.getDashboardRoute()).toBe('/departments/sales');
    });

    it('has leaves.approve_tl permission', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.hasPermission('leaves.approve_tl')).toBe(true);
    });

    it('does NOT have leaves.approve_manager permission', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.hasPermission('leaves.approve_manager')).toBe(false);
    });
  });

  // ─── technical_head ────────────────────────────────────────────────────────

  describe('technical_head role', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        employee: makeEmployee({
          role: 'technical_head',
          departments: { name: 'Technical', slug: 'technical' },
        }),
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });
    });

    it('sets isTechnicalHead = true and isDeptHead = true', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.isTechnicalHead).toBe(true);
      expect(result.current?.isDeptHead).toBe(true);
    });

    it('getDashboardRoute returns "/departments/technical"', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.getDashboardRoute()).toBe('/departments/technical');
    });
  });

  // ─── marketing_tl ──────────────────────────────────────────────────────────

  describe('marketing_tl role', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        employee: makeEmployee({
          role: 'marketing_tl',
          departments: { name: 'Marketing', slug: 'marketing' },
        }),
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });
    });

    it('sets isMarketingTL = true and isDeptHead = true', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.isMarketingTL).toBe(true);
      expect(result.current?.isDeptHead).toBe(true);
    });

    it('getDashboardRoute returns "/departments/marketing"', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.getDashboardRoute()).toBe('/departments/marketing');
    });
  });

  // ─── resume_head ───────────────────────────────────────────────────────────

  describe('resume_head role', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        employee: makeEmployee({
          role: 'resume_head',
          departments: { name: 'Resume', slug: 'resume' },
        }),
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });
    });

    it('sets isResumeHead = true and isDeptHead = true', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.isResumeHead).toBe(true);
      expect(result.current?.isDeptHead).toBe(true);
    });

    it('getDashboardRoute returns "/departments/resume"', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.getDashboardRoute()).toBe('/departments/resume');
    });
  });

  // ─── recruiter (IC) ────────────────────────────────────────────────────────

  describe('recruiter role (individual contributor)', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        employee: makeEmployee({
          role: 'recruiter',
          departments: { name: 'Sales', slug: 'sales' },
        }),
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });
    });

    it('sets all leadership flags to false', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.isDirector).toBe(false);
      expect(result.current?.isOpsHead).toBe(false);
      expect(result.current?.isHrHead).toBe(false);
      expect(result.current?.isLeadership).toBe(false);
      expect(result.current?.isSeniorLeadership).toBe(false);
      expect(result.current?.isDeptHead).toBe(false);
    });

    it('canViewAllDepartments = false', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.canViewAllDepartments).toBe(false);
    });

    it('canViewDepartment returns true only for own department slug', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.canViewDepartment('sales')).toBe(true);
      expect(result.current?.canViewDepartment('technical')).toBe(false);
    });

    it('has support_tasks.read_own and leaves.submit permissions', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.hasPermission('support_tasks.read_own')).toBe(true);
      expect(result.current?.hasPermission('leaves.submit')).toBe(true);
    });

    it('does NOT have candidates.read or support_tasks.read', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.hasPermission('candidates.read')).toBe(false);
      expect(result.current?.hasPermission('support_tasks.read')).toBe(false);
    });

    it('getDashboardRoute returns "/departments/sales" (department route)', () => {
      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.getDashboardRoute()).toBe('/departments/sales');
    });
  });

  // ─── Unknown / missing department slug ────────────────────────────────────

  describe('employee with no matching department route', () => {
    it('getDashboardRoute returns "/" for unrecognised slug', () => {
      mockUseAuth.mockReturnValue({
        employee: makeEmployee({
          role: 'recruiter',
          departments: { name: 'Unknown', slug: '' },
          dept_slug: '',
        }),
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.getDashboardRoute()).toBe('/');
    });
  });

  // ─── Identity fields passthrough ──────────────────────────────────────────

  describe('identity fields', () => {
    it('exposes departmentId, teamId, and employeeId from the employee object', () => {
      mockUseAuth.mockReturnValue({
        employee: makeEmployee({
          id: 'emp-xyz',
          department_id: 'dept-abc',
          team_id: 'team-def',
        }),
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      const { result } = renderHook(() => useEmployeeAccess());
      expect(result.current?.employeeId).toBe('emp-xyz');
      expect(result.current?.departmentId).toBe('dept-abc');
      expect(result.current?.teamId).toBe('team-def');
    });
  });
});
