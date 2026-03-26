/**
 * Integration tests — Support Tasks (/api/support-tasks)
 *
 * Auth middleware makes one db.query per request to hydrate req.employee.
 * Each test that passes authentication must call seedAuth() first, which
 * enqueues the mockEmployee row that authenticate() will consume.
 *
 * Role restrictions:
 *   POST   /api/support-tasks         → requireRole(SUPPORT_TASK_CREATORS)
 *   PATCH  /api/support-tasks/:id/reassign → requireRole(APPROVERS)
 *
 * APPROVERS = director, ops_head, hr_head, sales_head, technical_head,
 *             marketing_tl, resume_head, assistant_tl
 * A plain 'recruiter' IS in SUPPORT_TASK_CREATORS (can create) but is NOT
 * in APPROVERS (cannot reassign).
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

const mockTask = {
  id: 'st-001',
  candidate_enrollment_id: 'cand-001',
  candidate_name: 'Jane Doe',
  task_type: 'mock_call',
  status: 'pending',
  call_status: 'not_started',
  priority: 'medium',
  department_id: 'dept-001',
  department_name: 'Sales',
  assigned_to_employee_id: null,
  assigned_to_name: null,
  created_by_employee_id: mockEmployee.id,
  scheduled_at: null,
  due_date: null,
  created_at: '2026-02-01T09:00:00.000Z',
};

const mockTask2 = {
  ...mockTask,
  id: 'st-002',
  task_type: 'resume_building',
  status: 'in_progress',
};

// ─── Seed auth middleware ─────────────────────────────────────────────────────

function seedAuth(emp = mockEmployee) {
  mockDb.query.mockResolvedValueOnce([[emp]]);
}

// ─── GET /api/support-tasks ───────────────────────────────────────────────────

describe('GET /api/support-tasks', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/api/support-tasks');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 200 with an array of tasks and total for director', async () => {
    seedAuth();
    // COUNT(*) query
    mockDb.query.mockResolvedValueOnce([[{ total: 2 }]]);
    // SELECT rows query
    mockDb.query.mockResolvedValueOnce([[mockTask, mockTask2]]);

    const res = await request(app)
      .get('/api/support-tasks')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.data[0].id).toBe('st-001');
    expect(res.body.data[1].id).toBe('st-002');
  });
});

// ─── GET /api/support-tasks/:id ──────────────────────────────────────────────

describe('GET /api/support-tasks/:id', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/api/support-tasks/st-001');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for an unknown task id', async () => {
    seedAuth();
    // getOne main query — empty
    mockDb.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .get('/api/support-tasks/unknown-id')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 200 with the task and its comments for a known id', async () => {
    seedAuth();
    // getOne main query
    mockDb.query.mockResolvedValueOnce([[mockTask]]);
    // comments query
    mockDb.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .get('/api/support-tasks/st-001')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('st-001');
    expect(res.body.data.task_type).toBe('mock_call');
    expect(Array.isArray(res.body.data.comments)).toBe(true);
  });
});

// ─── POST /api/support-tasks ─────────────────────────────────────────────────

describe('POST /api/support-tasks', () => {
  beforeEach(() => resetMockDb());

  const validBody = {
    task_type: 'mock_call',
    candidate_id: 'cand-001',
  };

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).post('/api/support-tasks').send(validBody);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when task_type is missing', async () => {
    seedAuth();

    const res = await request(app)
      .post('/api/support-tasks')
      .set(makeAuthHeader(mockEmployee))
      .send({ candidate_id: 'cand-001' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/task_type/i);
  });

  it('returns 400 when task_type is not a valid value', async () => {
    seedAuth();

    const res = await request(app)
      .post('/api/support-tasks')
      .set(makeAuthHeader(mockEmployee))
      .send({ task_type: 'invalid_task_type' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid task_type/i);
  });

  it('returns 201 with the created task on valid body for director', async () => {
    seedAuth();
    // candidate name lookup (candidate_id provided)
    mockDb.query.mockResolvedValueOnce([[{ full_name: 'Jane Doe' }]]);
    // INSERT query
    mockDb.query.mockResolvedValueOnce([{ insertId: 0 }]);
    // SELECT after insert
    mockDb.query.mockResolvedValueOnce([[mockTask]]);

    const res = await request(app)
      .post('/api/support-tasks')
      .set(makeAuthHeader(mockEmployee))
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('st-001');
    expect(res.body.data.task_type).toBe('mock_call');
    expect(res.body.data.status).toBe('pending');
  });
});

// ─── PATCH /api/support-tasks/:id/status ─────────────────────────────────────

describe('PATCH /api/support-tasks/:id/status', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app)
      .patch('/api/support-tasks/st-001/status')
      .send({ status: 'completed' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 for an invalid status value', async () => {
    seedAuth();

    const res = await request(app)
      .patch('/api/support-tasks/st-001/status')
      .set(makeAuthHeader(mockEmployee))
      .send({ status: 'done_and_dusted' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid status/i);
  });

  it('returns 200 and updated status on valid input', async () => {
    seedAuth();
    // UPDATE query
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .patch('/api/support-tasks/st-001/status')
      .set(makeAuthHeader(mockEmployee))
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('st-001');
    expect(res.body.data.status).toBe('completed');
  });
});

// ─── PATCH /api/support-tasks/:id/call-status ────────────────────────────────

describe('PATCH /api/support-tasks/:id/call-status', () => {
  beforeEach(() => resetMockDb());

  it('returns 400 for an invalid call_status value', async () => {
    seedAuth();

    const res = await request(app)
      .patch('/api/support-tasks/st-001/call-status')
      .set(makeAuthHeader(mockEmployee))
      .send({ call_status: 'invalid_call_status' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid call_status/i);
  });

  it('returns 200 and updates call_status on valid input', async () => {
    seedAuth();
    // UPDATE query
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .patch('/api/support-tasks/st-001/call-status')
      .set(makeAuthHeader(mockEmployee))
      .send({ call_status: 'scheduled' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('st-001');
    expect(res.body.data.call_status).toBe('scheduled');
  });
});

// ─── PATCH /api/support-tasks/:id/reassign ───────────────────────────────────

describe('PATCH /api/support-tasks/:id/reassign', () => {
  beforeEach(() => resetMockDb());

  it('returns 403 for a recruiter (not in APPROVERS)', async () => {
    // recruiter is in SUPPORT_TASK_CREATORS but NOT in APPROVERS
    const recruiterEmployee = {
      ...mockEmployee,
      role: 'recruiter',
      id: 'emp-recruiter-099',
    };
    seedAuth(recruiterEmployee);

    const res = await request(app)
      .patch('/api/support-tasks/st-001/reassign')
      .set(makeAuthHeader(recruiterEmployee))
      .send({ assigned_to_employee_id: 'emp-other-001' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/insufficient permissions/i);
  });

  it('returns 200 for director reassigning a task', async () => {
    seedAuth();
    // UPDATE query
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    // createNotification INSERT (non-blocking, absorbed by default mockResolvedValue)

    const res = await request(app)
      .patch('/api/support-tasks/st-001/reassign')
      .set(makeAuthHeader(mockEmployee))
      .send({ assigned_to_employee_id: 'emp-other-001' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('st-001');
    expect(res.body.data.assigned_to_employee_id).toBe('emp-other-001');
  });
});
