import { describe, it, expect } from 'vitest';
import { createTaskSchema, createSupportTaskSchema } from '@/lib/validators/task.schema';

// Stable UUIDs for use across all tests
const UUID_A = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';
const UUID_C = '33333333-3333-3333-3333-333333333333';

// ─── createTaskSchema ─────────────────────────────────────────────────────────

describe('createTaskSchema', () => {
  function validTask(overrides?: object) {
    return {
      title: 'Write onboarding docs',
      priority: 'medium',
      assigned_to_employee_id: UUID_A,
      ...overrides,
    };
  }

  describe('valid data', () => {
    it('accepts a minimal valid task assigned to an employee', () => {
      const result = createTaskSchema.safeParse(validTask());
      expect(result.success).toBe(true);
    });

    it('accepts a task assigned to a team', () => {
      const result = createTaskSchema.safeParse({
        title: 'Team sprint review',
        priority: 'high',
        assigned_to_team_id: UUID_B,
      });
      expect(result.success).toBe(true);
    });

    it('accepts a task assigned to a department', () => {
      const result = createTaskSchema.safeParse({
        title: 'Department-wide meeting',
        priority: 'low',
        assigned_to_department_id: UUID_C,
      });
      expect(result.success).toBe(true);
    });

    it('accepts all three assignment fields populated', () => {
      const result = createTaskSchema.safeParse({
        title: 'Multi-assign task',
        priority: 'urgent',
        assigned_to_employee_id: UUID_A,
        assigned_to_team_id: UUID_B,
        assigned_to_department_id: UUID_C,
      });
      expect(result.success).toBe(true);
    });

    it('accepts all valid priority values', () => {
      (['low', 'medium', 'high', 'urgent'] as const).forEach((priority) => {
        const result = createTaskSchema.safeParse(validTask({ priority }));
        expect(result.success).toBe(true);
      });
    });

    it('accepts an optional description', () => {
      const result = createTaskSchema.safeParse(
        validTask({ description: 'Detailed description goes here.' })
      );
      expect(result.success).toBe(true);
    });

    it('accepts an optional due_date', () => {
      const result = createTaskSchema.safeParse(
        validTask({ due_date: '2026-07-01' })
      );
      expect(result.success).toBe(true);
    });

    it('accepts empty string for assignment UUID fields (or-literal branch)', () => {
      const result = createTaskSchema.safeParse({
        title: 'Empty string assignment',
        priority: 'low',
        assigned_to_employee_id: UUID_A,
        assigned_to_team_id: '',
        assigned_to_department_id: '',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('title validation', () => {
    it('rejects a title shorter than 3 characters', () => {
      const result = createTaskSchema.safeParse(validTask({ title: 'Hi' }));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('title');
        expect(result.error.issues[0].message).toMatch(/3 characters/i);
      }
    });

    it('rejects an empty title', () => {
      const result = createTaskSchema.safeParse(validTask({ title: '' }));
      expect(result.success).toBe(false);
    });

    it('accepts a title with exactly 3 characters', () => {
      const result = createTaskSchema.safeParse(validTask({ title: 'Fix' }));
      expect(result.success).toBe(true);
    });
  });

  describe('priority validation', () => {
    it('rejects an invalid priority value', () => {
      const result = createTaskSchema.safeParse(validTask({ priority: 'critical' }));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('priority');
      }
    });

    it('rejects when priority is missing', () => {
      const { priority: _, ...rest } = validTask() as Record<string, unknown>;
      const result = createTaskSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe('assignment refinement', () => {
    it('rejects when all three assignment fields are absent', () => {
      const result = createTaskSchema.safeParse({
        title: 'Unassigned task',
        priority: 'low',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const assignIssue = result.error.issues.find((i) =>
          i.message.toLowerCase().includes('assign')
        );
        expect(assignIssue).toBeDefined();
        expect(assignIssue?.path).toContain('assigned_to_employee_id');
      }
    });

    it('rejects when all three assignment fields are empty strings', () => {
      const result = createTaskSchema.safeParse({
        title: 'Empty assign task',
        priority: 'medium',
        assigned_to_employee_id: '',
        assigned_to_team_id: '',
        assigned_to_department_id: '',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const assignIssue = result.error.issues.find((i) =>
          i.message.toLowerCase().includes('assign')
        );
        expect(assignIssue).toBeDefined();
      }
    });

    it('rejects an invalid UUID for assigned_to_employee_id', () => {
      const result = createTaskSchema.safeParse(
        validTask({ assigned_to_employee_id: 'not-a-uuid' })
      );
      expect(result.success).toBe(false);
    });

    it('rejects an invalid UUID for assigned_to_team_id', () => {
      const result = createTaskSchema.safeParse({
        title: 'Team assign test',
        priority: 'low',
        assigned_to_team_id: 'bad-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an invalid UUID for assigned_to_department_id', () => {
      const result = createTaskSchema.safeParse({
        title: 'Dept assign test',
        priority: 'low',
        assigned_to_department_id: 'not-valid',
      });
      expect(result.success).toBe(false);
    });
  });
});

// ─── createSupportTaskSchema ──────────────────────────────────────────────────

describe('createSupportTaskSchema', () => {
  function validSupportTask(overrides?: object) {
    return {
      task_type: 'interview_support',
      priority: 'high',
      candidate_name: 'Alice Smith',
      department_id: UUID_A,
      ...overrides,
    };
  }

  describe('valid data', () => {
    it('accepts a minimal valid support task', () => {
      const result = createSupportTaskSchema.safeParse(validSupportTask());
      expect(result.success).toBe(true);
    });

    it('accepts all valid task_type values', () => {
      const types = [
        'interview_support',
        'assessment_support',
        'ruc',
        'mock_call',
        'preparation_call',
        'resume_building',
        'resume_rebuilding',
      ] as const;
      types.forEach((task_type) => {
        const result = createSupportTaskSchema.safeParse(validSupportTask({ task_type }));
        expect(result.success).toBe(true);
      });
    });

    it('accepts all valid priority values', () => {
      (['low', 'medium', 'high', 'urgent'] as const).forEach((priority) => {
        const result = createSupportTaskSchema.safeParse(validSupportTask({ priority }));
        expect(result.success).toBe(true);
      });
    });

    it('accepts a fully populated support task', () => {
      const result = createSupportTaskSchema.safeParse({
        ...validSupportTask(),
        candidate_enrollment_id: UUID_B,
        company_name: 'TechCorp',
        interview_round: 'Round 2',
        scheduled_at: '2026-06-15T10:00:00Z',
        due_date: '2026-06-15',
        assigned_to_employee_id: UUID_C,
        team_id: UUID_B,
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty string for optional UUID fields (or-literal branch)', () => {
      const result = createSupportTaskSchema.safeParse(
        validSupportTask({
          candidate_enrollment_id: '',
          assigned_to_employee_id: '',
          team_id: '',
        })
      );
      expect(result.success).toBe(true);
    });

    it('accepts candidate_enrollment_id as a valid UUID', () => {
      const result = createSupportTaskSchema.safeParse(
        validSupportTask({ candidate_enrollment_id: UUID_B })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('task_type validation', () => {
    it('rejects an invalid task_type', () => {
      const result = createSupportTaskSchema.safeParse(
        validSupportTask({ task_type: 'coaching_call' })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('task_type');
      }
    });

    it('rejects when task_type is missing', () => {
      const { task_type: _, ...rest } = validSupportTask() as Record<string, unknown>;
      const result = createSupportTaskSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe('priority validation', () => {
    it('rejects an invalid priority', () => {
      const result = createSupportTaskSchema.safeParse(
        validSupportTask({ priority: 'normal' })
      );
      expect(result.success).toBe(false);
    });
  });

  describe('candidate_name validation', () => {
    it('rejects an empty candidate_name', () => {
      const result = createSupportTaskSchema.safeParse(
        validSupportTask({ candidate_name: '' })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('candidate_name'));
        expect(issue).toBeDefined();
        expect(issue?.message).toMatch(/required/i);
      }
    });

    it('rejects when candidate_name is missing', () => {
      const { candidate_name: _, ...rest } = validSupportTask() as Record<string, unknown>;
      const result = createSupportTaskSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('accepts a candidate_name with a single character', () => {
      const result = createSupportTaskSchema.safeParse(
        validSupportTask({ candidate_name: 'A' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('department_id validation', () => {
    it('rejects a non-UUID department_id', () => {
      const result = createSupportTaskSchema.safeParse(
        validSupportTask({ department_id: 'not-a-uuid' })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('department_id'));
        expect(issue).toBeDefined();
      }
    });

    it('rejects when department_id is missing', () => {
      const { department_id: _, ...rest } = validSupportTask() as Record<string, unknown>;
      const result = createSupportTaskSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('accepts a valid UUID for department_id', () => {
      const result = createSupportTaskSchema.safeParse(validSupportTask({ department_id: UUID_C }));
      expect(result.success).toBe(true);
    });
  });

  describe('optional UUID fields', () => {
    it('rejects a non-UUID candidate_enrollment_id (when non-empty)', () => {
      const result = createSupportTaskSchema.safeParse(
        validSupportTask({ candidate_enrollment_id: 'bad-id' })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) =>
          i.path.includes('candidate_enrollment_id')
        );
        expect(issue).toBeDefined();
      }
    });

    it('rejects a non-UUID assigned_to_employee_id (when non-empty)', () => {
      const result = createSupportTaskSchema.safeParse(
        validSupportTask({ assigned_to_employee_id: 'bad-id' })
      );
      expect(result.success).toBe(false);
    });

    it('rejects a non-UUID team_id (when non-empty)', () => {
      const result = createSupportTaskSchema.safeParse(
        validSupportTask({ team_id: 'bad-team' })
      );
      expect(result.success).toBe(false);
    });
  });
});
