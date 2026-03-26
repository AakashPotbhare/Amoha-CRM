/**
 * Integration tests — Tasks (/api/tasks)
 *
 * All routes require authentication (router.use(authenticate)).
 * No role-based restrictions on these routes — any authenticated employee
 * can create and update tasks; scoping is done in the controller itself
 * (leadership sees all, others see only their own).
 *
 * Auth middleware makes one db.query per request to hydrate req.employee.
 * Call seedAuth() before every authenticated request.
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
const { makeAuthHeader, mockEmployee } = require('../helpers/auth.helper');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockTask = {
  id: 'task-001',
  title: 'Review candidate resumes',
  description: 'Go through this week submissions',
  priority: 'high',
  status: 'pending',
  assigned_to_employee_id: mockEmployee.id,
  assigned_to_name: mockEmployee.full_name,
  created_by_employee_id: mockEmployee.id,
  created_by_name: mockEmployee.full_name,
  due_date: '2026-04-01',
  created_at: '2026-03-01T10:00:00.000Z',
};

const mockTask2 = {
  ...mockTask,
  id: 'task-002',
  title: 'Follow up with placed candidates',
  priority: 'medium',
  status: 'in_progress',
};

// ─── Seed auth middleware ─────────────────────────────────────────────────────

function seedAuth(emp = mockEmployee) {
  mockDb.query.mockResolvedValueOnce([[emp]]);
}

// ─── GET /api/tasks ───────────────────────────────────────────────────────────

describe('GET /api/tasks', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 200 with an array of tasks and metadata for director', async () => {
    seedAuth();
    // COUNT(*) query
    mockDb.query.mockResolvedValueOnce([[{ total: 2 }]]);
    // SELECT rows query
    mockDb.query.mockResolvedValueOnce([[mockTask, mockTask2]]);

    const res = await request(app)
      .get('/api/tasks')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
    expect(res.body.data[0].id).toBe('task-001');
    expect(res.body.data[1].id).toBe('task-002');
  });

  it('accepts query params: status and priority filters', async () => {
    seedAuth();
    mockDb.query.mockResolvedValueOnce([[{ total: 1 }]]);
    mockDb.query.mockResolvedValueOnce([[mockTask2]]);

    const res = await request(app)
      .get('/api/tasks?status=in_progress&priority=medium&page=1&limit=5')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('in_progress');
    expect(res.body.limit).toBe(5);
  });
});

// ─── GET /api/tasks/:id ───────────────────────────────────────────────────────

describe('GET /api/tasks/:id', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/api/tasks/task-001');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for an unknown task id', async () => {
    seedAuth();
    mockDb.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .get('/api/tasks/unknown-task-id')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 200 with the task object for a known id', async () => {
    seedAuth();
    mockDb.query.mockResolvedValueOnce([[mockTask]]);

    const res = await request(app)
      .get('/api/tasks/task-001')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('task-001');
    expect(res.body.data.title).toBe('Review candidate resumes');
    expect(res.body.data.priority).toBe('high');
  });
});

// ─── POST /api/tasks ──────────────────────────────────────────────────────────

describe('POST /api/tasks', () => {
  beforeEach(() => resetMockDb());

  const validBody = {
    title: 'New task title',
    description: 'Task details here',
    priority: 'medium',
    due_date: '2026-05-01',
  };

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).post('/api/tasks').send(validBody);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when title is missing', async () => {
    seedAuth();

    const res = await request(app)
      .post('/api/tasks')
      .set(makeAuthHeader(mockEmployee))
      .send({ description: 'No title provided', priority: 'low' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/title/i);
  });

  it('returns 400 when priority is invalid', async () => {
    seedAuth();

    const res = await request(app)
      .post('/api/tasks')
      .set(makeAuthHeader(mockEmployee))
      .send({ title: 'Some task', priority: 'urgent' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid priority/i);
  });

  it('returns 201 with the created task on a valid body', async () => {
    seedAuth();
    // INSERT query
    mockDb.query.mockResolvedValueOnce([{ insertId: 0 }]);
    // SELECT after insert
    mockDb.query.mockResolvedValueOnce([[{ ...mockTask, title: 'New task title' }]]);

    const res = await request(app)
      .post('/api/tasks')
      .set(makeAuthHeader(mockEmployee))
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('New task title');
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.priority).toBe('high'); // comes from mock fixture
  });
});

// ─── PATCH /api/tasks/:id/status ─────────────────────────────────────────────

describe('PATCH /api/tasks/:id/status', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app)
      .patch('/api/tasks/task-001/status')
      .send({ status: 'completed' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 for an invalid status value', async () => {
    seedAuth();

    const res = await request(app)
      .patch('/api/tasks/task-001/status')
      .set(makeAuthHeader(mockEmployee))
      .send({ status: 'finished' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid status/i);
  });

  it('returns 200 and echoes the updated status on valid input', async () => {
    seedAuth();
    // UPDATE query
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .patch('/api/tasks/task-001/status')
      .set(makeAuthHeader(mockEmployee))
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('task-001');
    expect(res.body.data.status).toBe('completed');
  });
});
