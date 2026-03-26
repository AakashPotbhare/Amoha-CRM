/**
 * Integration tests — Leaves (/api/leaves)
 *
 * Role restrictions enforced by routes:
 *   PATCH /:id/approve-tl    → requireRole([...TL_ROLES, ...MGR_ROLES])
 *   PATCH /:id/reject        → requireRole(APPROVERS)
 *
 * TL_ROLES  = marketing_tl, sales_head, technical_head, resume_head, assistant_tl
 * MGR_ROLES = ops_head, hr_head, director
 * APPROVERS = director, ops_head, hr_head, sales_head, technical_head,
 *             marketing_tl, resume_head, assistant_tl
 *
 * mockEmployee_sales (role: 'sales_executive') is NOT in any of these groups,
 * so it is used to verify 403 responses on restricted endpoints.
 *
 * Leave submission (POST) requires: leave_type, from_date, to_date, reason
 * Valid leave_types: paid, unpaid, sick, casual
 */

jest.mock('../../src/config/db', () => {
  const { mockDb } = require('../helpers/db.mock');
  return mockDb;
});
jest.mock('../../src/services/paymentReminder.service', () => ({
  startPaymentReminderScheduler: jest.fn(),
  checkPaymentReminders: jest.fn(),
}));

const request = require('supertest');
const app = require('../../src/app');
const { mockDb, resetMockDb } = require('../helpers/db.mock');
const {
  makeAuthHeader,
  mockEmployee,
  mockEmployee_sales,
} = require('../helpers/auth.helper');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockLeave = {
  id: 'leave-001',
  employee_id: mockEmployee_sales.id,
  employee_name: mockEmployee_sales.full_name,
  department_id: mockEmployee_sales.department_id,
  leave_type: 'sick',
  from_date: '2026-04-07',
  to_date: '2026-04-08',
  total_days: 2,
  reason: 'Fever and rest required',
  status: 'pending',
  approved_by_tl: null,
  tl_approved_by_name: null,
  approved_by_manager: null,
  manager_approved_by_name: null,
  created_at: '2026-04-06T08:00:00.000Z',
};

const mockLeave2 = {
  ...mockLeave,
  id: 'leave-002',
  leave_type: 'casual',
  status: 'tl_approved',
};

// ─── Seed auth middleware ─────────────────────────────────────────────────────

function seedAuth(emp = mockEmployee) {
  mockDb.query.mockResolvedValueOnce([[emp]]);
}

// ─── GET /api/leaves ──────────────────────────────────────────────────────────

describe('GET /api/leaves', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/api/leaves');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 200 with own leaves only for a sales_executive', async () => {
    seedAuth(mockEmployee_sales);
    // COUNT(*) — scoped to employee_id by controller
    mockDb.query.mockResolvedValueOnce([[{ total: 1 }]]);
    // SELECT rows
    mockDb.query.mockResolvedValueOnce([[mockLeave]]);

    const res = await request(app)
      .get('/api/leaves')
      .set(makeAuthHeader(mockEmployee_sales));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].employee_id).toBe(mockEmployee_sales.id);
    expect(res.body.total).toBe(1);
  });

  it('returns 200 with all leaves for director', async () => {
    seedAuth();
    mockDb.query.mockResolvedValueOnce([[{ total: 2 }]]);
    mockDb.query.mockResolvedValueOnce([[mockLeave, mockLeave2]]);

    const res = await request(app)
      .get('/api/leaves')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });
});

// ─── POST /api/leaves ─────────────────────────────────────────────────────────

describe('POST /api/leaves', () => {
  beforeEach(() => resetMockDb());

  const validBody = {
    leave_type: 'sick',
    from_date: '2026-04-10',
    to_date: '2026-04-11',
    reason: 'Medical appointment',
  };

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).post('/api/leaves').send(validBody);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when leave_type is missing', async () => {
    seedAuth(mockEmployee_sales);

    const res = await request(app)
      .post('/api/leaves')
      .set(makeAuthHeader(mockEmployee_sales))
      .send({ from_date: '2026-04-10', to_date: '2026-04-11', reason: 'Need rest' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/leave_type/i);
  });

  it('returns 400 when start_date (from_date) is missing', async () => {
    seedAuth(mockEmployee_sales);

    const res = await request(app)
      .post('/api/leaves')
      .set(makeAuthHeader(mockEmployee_sales))
      .send({ leave_type: 'sick', to_date: '2026-04-11', reason: 'Sick' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/from_date/i);
  });

  it('returns 400 when to_date is missing', async () => {
    seedAuth(mockEmployee_sales);

    const res = await request(app)
      .post('/api/leaves')
      .set(makeAuthHeader(mockEmployee_sales))
      .send({ leave_type: 'sick', from_date: '2026-04-10', reason: 'Sick' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/to_date/i);
  });

  it('returns 400 when reason is missing', async () => {
    seedAuth(mockEmployee_sales);

    const res = await request(app)
      .post('/api/leaves')
      .set(makeAuthHeader(mockEmployee_sales))
      .send({ leave_type: 'sick', from_date: '2026-04-10', to_date: '2026-04-11' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/reason/i);
  });

  it('returns 400 when leave_type is not a valid value', async () => {
    seedAuth(mockEmployee_sales);

    const res = await request(app)
      .post('/api/leaves')
      .set(makeAuthHeader(mockEmployee_sales))
      .send({ ...validBody, leave_type: 'maternity' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid leave_type/i);
  });

  it('returns 201 with the created leave request on valid body', async () => {
    seedAuth(mockEmployee_sales);
    // INSERT query
    mockDb.query.mockResolvedValueOnce([{ insertId: 0 }]);
    // SELECT after insert
    mockDb.query.mockResolvedValueOnce([[mockLeave]]);

    const res = await request(app)
      .post('/api/leaves')
      .set(makeAuthHeader(mockEmployee_sales))
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.leave_type).toBe('sick');
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.id).toBe('leave-001');
  });
});

// ─── PATCH /api/leaves/:id/approve-tl ────────────────────────────────────────

describe('PATCH /api/leaves/:id/approve-tl', () => {
  beforeEach(() => resetMockDb());

  it('returns 403 for a sales_executive (not TL or MGR role)', async () => {
    seedAuth(mockEmployee_sales);

    const res = await request(app)
      .patch('/api/leaves/leave-001/approve-tl')
      .set(makeAuthHeader(mockEmployee_sales))
      .send();

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/insufficient permissions/i);
  });

  it('returns 200 and transitions status to tl_approved for director', async () => {
    seedAuth();
    // SELECT leave request
    mockDb.query.mockResolvedValueOnce([[{ ...mockLeave, status: 'pending' }]]);
    // UPDATE
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .patch('/api/leaves/leave-001/approve-tl')
      .set(makeAuthHeader(mockEmployee))
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('leave-001');
    expect(res.body.data.status).toBe('tl_approved');
  });
});

// ─── PATCH /api/leaves/:id/reject ────────────────────────────────────────────

describe('PATCH /api/leaves/:id/reject', () => {
  beforeEach(() => resetMockDb());

  it('returns 403 for a sales_executive (not in APPROVERS)', async () => {
    seedAuth(mockEmployee_sales);

    const res = await request(app)
      .patch('/api/leaves/leave-001/reject')
      .set(makeAuthHeader(mockEmployee_sales))
      .send({ reason: 'Not approved' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/insufficient permissions/i);
  });

  it('returns 200 and transitions status to rejected for director', async () => {
    seedAuth();
    // SELECT leave request
    mockDb.query.mockResolvedValueOnce([[{ ...mockLeave, status: 'pending' }]]);
    // UPDATE
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .patch('/api/leaves/leave-001/reject')
      .set(makeAuthHeader(mockEmployee))
      .send({ reason: 'Staffing constraints' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('leave-001');
    expect(res.body.data.status).toBe('rejected');
  });

  it('returns 404 when the leave request does not exist', async () => {
    seedAuth();
    mockDb.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .patch('/api/leaves/nonexistent-id/reject')
      .set(makeAuthHeader(mockEmployee))
      .send({ reason: 'N/A' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });
});
