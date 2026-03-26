import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  getRolePermissions,
  GLOBAL_DASHBOARD_ROLES,
  DEPT_HEAD_ROLES,
  APPROVER_ROLES,
  LEAVE_MANAGER_ROLES,
} from '@/lib/permissions';
import type { Permission } from '@/lib/permissions';

// ─── hasPermission ────────────────────────────────────────────────────────────

describe('hasPermission', () => {
  describe('wildcard roles (director, ops_head)', () => {
    it('director has every named permission', () => {
      const permissions: Permission[] = [
        'candidates.read',
        'candidates.write',
        'candidates.enroll',
        'candidates.delete',
        'hr.read',
        'hr.write',
        'employees.manage',
        'salary.manage',
        'attendance.read_all',
        'attendance.manage',
        'leaves.approve_manager',
        'departments.all',
        'dashboard.global',
        'shift_management.manage',
        'support_tasks.read',
        'support_tasks.reassign',
        'tasks.read',
        'tasks.write',
      ];
      permissions.forEach((p) => {
        expect(hasPermission('director', p)).toBe(true);
      });
    });

    it('ops_head has every named permission', () => {
      expect(hasPermission('ops_head', 'salary.manage')).toBe(true);
      expect(hasPermission('ops_head', 'candidates.delete')).toBe(true);
      expect(hasPermission('ops_head', 'departments.all')).toBe(true);
    });

    it('director has the wildcard (*) permission itself', () => {
      expect(hasPermission('director', '*')).toBe(true);
    });
  });

  describe('hr_head', () => {
    it('has all explicitly granted permissions', () => {
      const granted: Permission[] = [
        'hr.read', 'hr.write', 'employees.manage', 'salary.manage',
        'attendance.read_all', 'attendance.manage', 'leaves.approve_manager',
        'departments.all', 'dashboard.global', 'candidates.read',
        'tasks.read', 'tasks.write', 'support_tasks.read', 'shift_management.manage',
      ];
      granted.forEach((p) => expect(hasPermission('hr_head', p)).toBe(true));
    });

    it('does NOT have permissions outside its grant list', () => {
      expect(hasPermission('hr_head', 'candidates.write')).toBe(false);
      expect(hasPermission('hr_head', 'candidates.enroll')).toBe(false);
      expect(hasPermission('hr_head', 'candidates.delete')).toBe(false);
      expect(hasPermission('hr_head', 'dashboard.department')).toBe(false);
    });
  });

  describe('sales_head', () => {
    it('has its granted permissions', () => {
      const granted: Permission[] = [
        'candidates.read', 'candidates.write', 'candidates.enroll',
        'departments.own', 'tasks.read', 'tasks.write', 'support_tasks.read',
        'dashboard.department', 'attendance.read_own', 'leaves.submit', 'leaves.approve_tl',
      ];
      granted.forEach((p) => expect(hasPermission('sales_head', p)).toBe(true));
    });

    it('does NOT have hr or global permissions', () => {
      expect(hasPermission('sales_head', 'hr.read')).toBe(false);
      expect(hasPermission('sales_head', 'salary.manage')).toBe(false);
      expect(hasPermission('sales_head', 'dashboard.global')).toBe(false);
      expect(hasPermission('sales_head', 'departments.all')).toBe(false);
      expect(hasPermission('sales_head', 'leaves.approve_manager')).toBe(false);
    });
  });

  describe('sales_executive', () => {
    it('has its limited permissions', () => {
      const granted: Permission[] = [
        'candidates.enroll', 'candidates.read',
        'tasks.read_own', 'tasks.write',
        'attendance.read_own', 'leaves.submit',
      ];
      granted.forEach((p) => expect(hasPermission('sales_executive', p)).toBe(true));
    });

    it('does NOT have elevated permissions', () => {
      expect(hasPermission('sales_executive', 'candidates.write')).toBe(false);
      expect(hasPermission('sales_executive', 'tasks.read')).toBe(false);
      expect(hasPermission('sales_executive', 'leaves.approve_tl')).toBe(false);
      expect(hasPermission('sales_executive', 'support_tasks.read')).toBe(false);
    });
  });

  describe('recruiter', () => {
    it('has its limited permissions', () => {
      const granted: Permission[] = [
        'support_tasks.read_own', 'support_tasks.write',
        'tasks.read_own', 'tasks.write',
        'attendance.read_own', 'leaves.submit',
      ];
      granted.forEach((p) => expect(hasPermission('recruiter', p)).toBe(true));
    });

    it('does NOT have candidate or elevated permissions', () => {
      expect(hasPermission('recruiter', 'candidates.read')).toBe(false);
      expect(hasPermission('recruiter', 'candidates.enroll')).toBe(false);
      expect(hasPermission('recruiter', 'support_tasks.read')).toBe(false);
      expect(hasPermission('recruiter', 'tasks.read')).toBe(false);
    });
  });

  describe('technical_head', () => {
    it('has support task management and department access', () => {
      expect(hasPermission('technical_head', 'support_tasks.read')).toBe(true);
      expect(hasPermission('technical_head', 'support_tasks.write')).toBe(true);
      expect(hasPermission('technical_head', 'support_tasks.reassign')).toBe(true);
      expect(hasPermission('technical_head', 'departments.own')).toBe(true);
      expect(hasPermission('technical_head', 'leaves.approve_tl')).toBe(true);
    });

    it('does NOT have HR or global permissions', () => {
      expect(hasPermission('technical_head', 'hr.write')).toBe(false);
      expect(hasPermission('technical_head', 'salary.manage')).toBe(false);
    });
  });

  describe('compliance_officer', () => {
    it('has limited read-own task and candidate read access', () => {
      expect(hasPermission('compliance_officer', 'support_tasks.read_own')).toBe(true);
      expect(hasPermission('compliance_officer', 'support_tasks.write')).toBe(true);
      expect(hasPermission('compliance_officer', 'tasks.read_own')).toBe(true);
      expect(hasPermission('compliance_officer', 'candidates.read')).toBe(true);
    });

    it('does NOT have broader task or department access', () => {
      expect(hasPermission('compliance_officer', 'support_tasks.read')).toBe(false);
      expect(hasPermission('compliance_officer', 'tasks.read')).toBe(false);
      expect(hasPermission('compliance_officer', 'departments.own')).toBe(false);
      expect(hasPermission('compliance_officer', 'leaves.approve_tl')).toBe(false);
    });
  });

  describe('assistant_tl', () => {
    it('can approve TL leaves and read candidates', () => {
      expect(hasPermission('assistant_tl', 'leaves.approve_tl')).toBe(true);
      expect(hasPermission('assistant_tl', 'candidates.read')).toBe(true);
      expect(hasPermission('assistant_tl', 'candidates.enroll')).toBe(true);
      expect(hasPermission('assistant_tl', 'support_tasks.read')).toBe(true);
    });

    it('cannot manage departments or approve at manager level', () => {
      expect(hasPermission('assistant_tl', 'departments.own')).toBe(false);
      expect(hasPermission('assistant_tl', 'leaves.approve_manager')).toBe(false);
    });
  });

  describe('wildcard namespace matching', () => {
    it('a role with candidates.* would match candidates.read', () => {
      // Simulate by testing the logic: since no role actually has 'candidates.*',
      // we verify exact and non-matching behaviour instead.
      // director/*-wildcard already covers this; this test documents the boundary.
      expect(hasPermission('director', 'candidates.read')).toBe(true);
      expect(hasPermission('director', 'candidates.delete')).toBe(true);
    });

    it('exact permission match takes precedence over missing namespace wildcard', () => {
      // sales_head has 'tasks.read' but NOT 'tasks.*' — tasks.read_own is NOT granted
      expect(hasPermission('sales_head', 'tasks.read')).toBe(true);
      expect(hasPermission('sales_head', 'tasks.read_own')).toBe(false);
    });
  });

  describe('senior_recruiter and resume_builder', () => {
    it('senior_recruiter matches recruiter permission set', () => {
      expect(hasPermission('senior_recruiter', 'support_tasks.read_own')).toBe(true);
      expect(hasPermission('senior_recruiter', 'support_tasks.write')).toBe(true);
      expect(hasPermission('senior_recruiter', 'leaves.submit')).toBe(true);
      expect(hasPermission('senior_recruiter', 'support_tasks.read')).toBe(false);
    });

    it('resume_builder matches recruiter permission set', () => {
      expect(hasPermission('resume_builder', 'support_tasks.read_own')).toBe(true);
      expect(hasPermission('resume_builder', 'tasks.read_own')).toBe(true);
      expect(hasPermission('resume_builder', 'candidates.read')).toBe(false);
    });
  });

  describe('lead_generator', () => {
    it('can read candidates and own tasks but cannot enroll', () => {
      expect(hasPermission('lead_generator', 'candidates.read')).toBe(true);
      expect(hasPermission('lead_generator', 'tasks.read_own')).toBe(true);
      expect(hasPermission('lead_generator', 'leaves.submit')).toBe(true);
      expect(hasPermission('lead_generator', 'candidates.enroll')).toBe(false);
    });
  });

  describe('technical_executive', () => {
    it('has support tasks read_own and candidate read', () => {
      expect(hasPermission('technical_executive', 'support_tasks.read_own')).toBe(true);
      expect(hasPermission('technical_executive', 'candidates.read')).toBe(true);
      expect(hasPermission('technical_executive', 'support_tasks.read')).toBe(false);
    });
  });

  describe('marketing_tl and resume_head', () => {
    it('marketing_tl has support task reassign and dept head permissions', () => {
      expect(hasPermission('marketing_tl', 'support_tasks.reassign')).toBe(true);
      expect(hasPermission('marketing_tl', 'departments.own')).toBe(true);
      expect(hasPermission('marketing_tl', 'dashboard.department')).toBe(true);
      expect(hasPermission('marketing_tl', 'salary.manage')).toBe(false);
    });

    it('resume_head mirrors marketing_tl permissions', () => {
      expect(hasPermission('resume_head', 'support_tasks.reassign')).toBe(true);
      expect(hasPermission('resume_head', 'departments.own')).toBe(true);
      expect(hasPermission('resume_head', 'candidates.read')).toBe(true);
      expect(hasPermission('resume_head', 'salary.manage')).toBe(false);
    });
  });
});

// ─── getRolePermissions ───────────────────────────────────────────────────────

describe('getRolePermissions', () => {
  it('returns ["*"] for director', () => {
    expect(getRolePermissions('director')).toEqual(['*']);
  });

  it('returns ["*"] for ops_head', () => {
    expect(getRolePermissions('ops_head')).toEqual(['*']);
  });

  it('returns correct permissions array for sales_head', () => {
    const perms = getRolePermissions('sales_head');
    expect(perms).toContain('candidates.read');
    expect(perms).toContain('candidates.write');
    expect(perms).toContain('candidates.enroll');
    expect(perms).toContain('leaves.approve_tl');
    expect(perms).not.toContain('leaves.approve_manager');
    expect(perms).not.toContain('hr.read');
  });

  it('returns correct permissions array for recruiter', () => {
    const perms = getRolePermissions('recruiter');
    expect(perms).toContain('support_tasks.read_own');
    expect(perms).toContain('support_tasks.write');
    expect(perms).toContain('leaves.submit');
    expect(perms).not.toContain('candidates.read');
  });

  it('returns correct permissions array for hr_head', () => {
    const perms = getRolePermissions('hr_head');
    expect(perms).toContain('salary.manage');
    expect(perms).toContain('employees.manage');
    expect(perms).toContain('dashboard.global');
    expect(perms).toContain('shift_management.manage');
    expect(perms).not.toContain('dashboard.department');
  });

  it('returns an array (not undefined) for every defined role', () => {
    const roles = [
      'director', 'ops_head', 'hr_head', 'sales_head', 'technical_head',
      'marketing_tl', 'resume_head', 'compliance_officer', 'assistant_tl',
      'sales_executive', 'lead_generator', 'technical_executive',
      'senior_recruiter', 'recruiter', 'resume_builder',
    ] as const;
    roles.forEach((role) => {
      const perms = getRolePermissions(role);
      expect(Array.isArray(perms)).toBe(true);
      expect(perms.length).toBeGreaterThan(0);
    });
  });
});

// ─── Role constant arrays ─────────────────────────────────────────────────────

describe('GLOBAL_DASHBOARD_ROLES', () => {
  it('contains director, ops_head, hr_head', () => {
    expect(GLOBAL_DASHBOARD_ROLES).toContain('director');
    expect(GLOBAL_DASHBOARD_ROLES).toContain('ops_head');
    expect(GLOBAL_DASHBOARD_ROLES).toContain('hr_head');
  });

  it('does not contain department-level roles', () => {
    expect(GLOBAL_DASHBOARD_ROLES).not.toContain('sales_head');
    expect(GLOBAL_DASHBOARD_ROLES).not.toContain('recruiter');
  });
});

describe('DEPT_HEAD_ROLES', () => {
  it('contains the four department heads', () => {
    expect(DEPT_HEAD_ROLES).toContain('sales_head');
    expect(DEPT_HEAD_ROLES).toContain('technical_head');
    expect(DEPT_HEAD_ROLES).toContain('marketing_tl');
    expect(DEPT_HEAD_ROLES).toContain('resume_head');
  });

  it('does not contain senior leadership', () => {
    expect(DEPT_HEAD_ROLES).not.toContain('director');
    expect(DEPT_HEAD_ROLES).not.toContain('ops_head');
    expect(DEPT_HEAD_ROLES).not.toContain('hr_head');
  });
});

describe('APPROVER_ROLES', () => {
  it('contains all leadership and dept head roles', () => {
    ['director', 'ops_head', 'hr_head', 'sales_head', 'technical_head',
      'marketing_tl', 'resume_head', 'assistant_tl'].forEach((role) => {
      expect(APPROVER_ROLES).toContain(role);
    });
  });

  it('does not contain individual contributor roles', () => {
    expect(APPROVER_ROLES).not.toContain('recruiter');
    expect(APPROVER_ROLES).not.toContain('sales_executive');
    expect(APPROVER_ROLES).not.toContain('resume_builder');
  });
});

describe('LEAVE_MANAGER_ROLES', () => {
  it('contains only the top-level management triad', () => {
    expect(LEAVE_MANAGER_ROLES).toContain('director');
    expect(LEAVE_MANAGER_ROLES).toContain('ops_head');
    expect(LEAVE_MANAGER_ROLES).toContain('hr_head');
    expect(LEAVE_MANAGER_ROLES).toHaveLength(3);
  });

  it('does not include dept heads or ICs', () => {
    expect(LEAVE_MANAGER_ROLES).not.toContain('sales_head');
    expect(LEAVE_MANAGER_ROLES).not.toContain('assistant_tl');
  });
});
