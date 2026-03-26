import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { leaveRequestSchema } from '@/lib/validators/leave.schema';

// The schema uses `new Date(new Date().toISOString().split("T")[0])` internally
// to check that from_date is not in the past. We freeze time to a known date so
// tests are fully deterministic regardless of when they run.
const FROZEN_DATE = '2026-06-01'; // a Sunday — well in the future relative to authoring

function futureDate(offsetDays: number): string {
  const d = new Date(`${FROZEN_DATE}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

const TODAY = FROZEN_DATE;
const TOMORROW = futureDate(1);
const NEXT_WEEK = futureDate(7);
const YESTERDAY = futureDate(-1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${FROZEN_DATE}T12:00:00.000Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validPayload(overrides?: object) {
  return {
    leave_type: 'paid',
    from_date: TODAY,
    to_date: TODAY,
    reason: 'Family function next week.',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('leaveRequestSchema', () => {
  describe('valid data', () => {
    it('accepts a same-day leave on today', () => {
      const result = leaveRequestSchema.safeParse(validPayload());
      expect(result.success).toBe(true);
    });

    it('accepts a multi-day leave starting today', () => {
      const result = leaveRequestSchema.safeParse(validPayload({ to_date: NEXT_WEEK }));
      expect(result.success).toBe(true);
    });

    it('accepts a leave starting tomorrow', () => {
      const result = leaveRequestSchema.safeParse(validPayload({ from_date: TOMORROW, to_date: TOMORROW }));
      expect(result.success).toBe(true);
    });

    it('accepts all four leave_type values', () => {
      (['paid', 'unpaid', 'sick', 'casual'] as const).forEach((leave_type) => {
        const result = leaveRequestSchema.safeParse(validPayload({ leave_type }));
        expect(result.success).toBe(true);
      });
    });

    it('accepts a reason of exactly 10 characters', () => {
      const result = leaveRequestSchema.safeParse(validPayload({ reason: '1234567890' }));
      expect(result.success).toBe(true);
    });

    it('accepts a reason much longer than the minimum', () => {
      const result = leaveRequestSchema.safeParse(
        validPayload({ reason: 'I need to attend a family event in another city this week.' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('leave_type validation', () => {
    it('rejects an unrecognised leave type', () => {
      const result = leaveRequestSchema.safeParse(validPayload({ leave_type: 'annual' }));
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('leave_type');
      }
    });

    it('rejects when leave_type is missing', () => {
      const { leave_type: _, ...rest } = validPayload() as Record<string, unknown>;
      const result = leaveRequestSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe('from_date validation', () => {
    it('rejects when from_date is missing', () => {
      const { from_date: _, ...rest } = validPayload() as Record<string, unknown>;
      const result = leaveRequestSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects when from_date is empty string', () => {
      const result = leaveRequestSchema.safeParse(validPayload({ from_date: '' }));
      expect(result.success).toBe(false);
    });

    it('rejects a from_date in the past', () => {
      const result = leaveRequestSchema.safeParse(
        validPayload({ from_date: YESTERDAY, to_date: TODAY })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const pastIssue = result.error.issues.find((i) =>
          i.message.toLowerCase().includes('past')
        );
        expect(pastIssue).toBeDefined();
        expect(pastIssue?.path).toContain('from_date');
      }
    });
  });

  describe('to_date validation', () => {
    it('rejects when to_date is missing', () => {
      const { to_date: _, ...rest } = validPayload() as Record<string, unknown>;
      const result = leaveRequestSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects when to_date is empty string', () => {
      const result = leaveRequestSchema.safeParse(validPayload({ to_date: '' }));
      expect(result.success).toBe(false);
    });

    it('rejects when to_date is before from_date', () => {
      const result = leaveRequestSchema.safeParse(
        validPayload({ from_date: TOMORROW, to_date: TODAY })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const orderIssue = result.error.issues.find((i) =>
          i.message.toLowerCase().includes('end date')
        );
        expect(orderIssue).toBeDefined();
        expect(orderIssue?.path).toContain('to_date');
      }
    });

    it('accepts to_date equal to from_date', () => {
      const result = leaveRequestSchema.safeParse(
        validPayload({ from_date: TOMORROW, to_date: TOMORROW })
      );
      expect(result.success).toBe(true);
    });

    it('accepts to_date strictly after from_date', () => {
      const result = leaveRequestSchema.safeParse(
        validPayload({ from_date: TOMORROW, to_date: NEXT_WEEK })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('reason validation', () => {
    it('rejects a reason shorter than 10 characters', () => {
      const result = leaveRequestSchema.safeParse(validPayload({ reason: 'Too short' }));
      expect(result.success).toBe(false);
      if (!result.success) {
        const reasonIssue = result.error.issues.find((i) => i.path.includes('reason'));
        expect(reasonIssue).toBeDefined();
        expect(reasonIssue?.message).toMatch(/10 characters/i);
      }
    });

    it('rejects an empty reason', () => {
      const result = leaveRequestSchema.safeParse(validPayload({ reason: '' }));
      expect(result.success).toBe(false);
    });

    it('rejects when reason is missing', () => {
      const { reason: _, ...rest } = validPayload() as Record<string, unknown>;
      const result = leaveRequestSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe('multiple validation errors', () => {
    it('reports multiple issues for a completely empty object', () => {
      const result = leaveRequestSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        // At minimum: leave_type, from_date, to_date, reason
        expect(result.error.issues.length).toBeGreaterThanOrEqual(4);
      }
    });

    it('reports both the date-order error and past-date error simultaneously', () => {
      // from_date in the past AND to_date before from_date
      const result = leaveRequestSchema.safeParse(
        validPayload({ from_date: YESTERDAY, to_date: futureDate(-3) })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
