/**
 * Integration tests — Candidates (/api/candidates)
 *
 * The MySQL pool is replaced by mockDb (installed globally in tests/setup.js).
 * The jest.mock() calls below are hoisted by Jest and ensure the mocks win
 * even when this file is run in isolation.
 *
 * Auth middleware makes one db.query per request to hydrate req.employee.
 * Therefore every test that passes authentication must provide at least one
 * mockResolvedValueOnce([[mockEmployee]]) BEFORE any controller DB calls.
 */

jest.mock('../../src/config/db', () => {
  const { mockDb } = require('../helpers/db.mock');
  return mockDb;
});
jest.mock('../../src/services/paymentReminder.service', () => ({
  startPaymentReminderScheduler: jest.fn(),
  checkPaymentReminders: jest.fn(),
}));
// notification.service uses db.query — the shared mockDb handles it automatically.
// We do NOT mock notification.service so the real code runs; mockDb.query will
// absorb the INSERT without complaint (mockResolvedValue returns [[]] by default).

const request = require('supertest');
const app = require('../../src/app');
const { mockDb, resetMockDb } = require('../helpers/db.mock');
const {
  makeAuthHeader,
  mockEmployee,
  mockEmployee_sales,
} = require('../helpers/auth.helper');

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockCandidate = {
  id: 'cand-001',
  full_name: 'Jane Doe',
  phone: '5551234567',
  email: 'jane.doe@example.com',
  pipeline_stage: 'enrolled',
  current_domain: 'Java',
  enrolled_by_employee_id: mockEmployee.id,
  enrolled_by_name: mockEmployee.full_name,
  salesperson_name: null,
  created_at: '2026-01-15T10:00:00.000Z',
};

const mockCandidate2 = {
  id: 'cand-002',
  full_name: 'John Smith',
  phone: '5559876543',
  email: 'john.smith@example.com',
  pipeline_stage: 'resume_building',
  current_domain: 'Python',
  enrolled_by_employee_id: mockEmployee.id,
  enrolled_by_name: mockEmployee.full_name,
  salesperson_name: null,
  created_at: '2026-01-16T10:00:00.000Z',
};

// ─── Helper: seed the auth middleware DB call ─────────────────────────────────
// authenticate() calls db.query once to look up the employee by JWT payload.id.
function seedAuth(emp = mockEmployee) {
  mockDb.query.mockResolvedValueOnce([[emp]]);
}

// ─── GET /api/candidates ──────────────────────────────────────────────────────

describe('GET /api/candidates', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/api/candidates');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 200 with an array of candidates and total for director', async () => {
    seedAuth();
    // COUNT(*) query
    mockDb.query.mockResolvedValueOnce([[{ total: 2 }]]);
    // SELECT rows query
    mockDb.query.mockResolvedValueOnce([[mockCandidate, mockCandidate2]]);

    const res = await request(app)
      .get('/api/candidates')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.data[0].id).toBe('cand-001');
    expect(res.body.data[1].id).toBe('cand-002');
  });

  it('accepts query params: page, limit, stage, search', async () => {
    seedAuth();
    mockDb.query.mockResolvedValueOnce([[{ total: 1 }]]);
    mockDb.query.mockResolvedValueOnce([[mockCandidate]]);

    const res = await request(app)
      .get('/api/candidates?page=1&limit=10&stage=enrolled&search=Jane')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(10);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].full_name).toBe('Jane Doe');
  });
});

// ─── GET /api/candidates/pipeline-stats ──────────────────────────────────────

describe('GET /api/candidates/pipeline-stats', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/api/candidates/pipeline-stats');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 200 with a pipeline stats object keyed by stage', async () => {
    seedAuth();
    // pipelineStats controller makes one query
    mockDb.query.mockResolvedValueOnce([
      [
        { stage: 'enrolled', count: 5 },
        { stage: 'placed', count: 2 },
      ],
    ]);

    const res = await request(app)
      .get('/api/candidates/pipeline-stats')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('enrolled', 5);
    expect(res.body.data).toHaveProperty('placed', 2);
    // All expected keys should be present (defaulting to 0)
    expect(res.body.data).toHaveProperty('resume_building', 0);
    expect(res.body.data).toHaveProperty('marketing_active', 0);
    expect(res.body.data).toHaveProperty('interview_stage', 0);
    expect(res.body.data).toHaveProperty('rejected', 0);
  });
});

// ─── GET /api/candidates/:id ──────────────────────────────────────────────────

describe('GET /api/candidates/:id', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/api/candidates/cand-001');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for an unknown candidate id', async () => {
    seedAuth();
    // getOne query returns empty
    mockDb.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .get('/api/candidates/unknown-id')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 200 with the candidate object for a known id', async () => {
    seedAuth();
    mockDb.query.mockResolvedValueOnce([[mockCandidate]]);

    const res = await request(app)
      .get('/api/candidates/cand-001')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('cand-001');
    expect(res.body.data.full_name).toBe('Jane Doe');
    expect(res.body.data.pipeline_stage).toBe('enrolled');
  });
});

// ─── POST /api/candidates (enroll) ───────────────────────────────────────────

describe('POST /api/candidates', () => {
  beforeEach(() => resetMockDb());

  const validBody = {
    full_name: 'New Candidate',
    phone: '5550001111',
    email: 'new@example.com',
    technology: 'Node.js',
  };

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).post('/api/candidates').send(validBody);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when full_name is missing', async () => {
    seedAuth();

    const res = await request(app)
      .post('/api/candidates')
      .set(makeAuthHeader(mockEmployee))
      .send({ phone: '5550001111' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/full_name/i);
  });

  it('returns 400 when phone is missing', async () => {
    seedAuth();

    const res = await request(app)
      .post('/api/candidates')
      .set(makeAuthHeader(mockEmployee))
      .send({ full_name: 'New Candidate' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/phone/i);
  });

  it('returns 201 with the created candidate on valid body', async () => {
    seedAuth();
    // INSERT query
    mockDb.query.mockResolvedValueOnce([{ insertId: 0 }]);
    // SELECT after insert (fetch back created record)
    mockDb.query.mockResolvedValueOnce([
      [{ ...mockCandidate, full_name: 'New Candidate', phone: '5550001111' }],
    ]);

    const res = await request(app)
      .post('/api/candidates')
      .set(makeAuthHeader(mockEmployee))
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.full_name).toBe('New Candidate');
    expect(res.body.data.phone).toBe('5550001111');
  });
});

// ─── PATCH /api/candidates/:id/stage ─────────────────────────────────────────

describe('PATCH /api/candidates/:id/stage', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app)
      .patch('/api/candidates/cand-001/stage')
      .send({ stage: 'placed' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 403 for a role not permitted to update stage (recruiter)', async () => {
    // recruiter is NOT in [...APPROVERS, 'sales_executive', 'lead_generator']
    const recruiterEmployee = { ...mockEmployee, role: 'recruiter', id: 'emp-recruiter-099' };
    seedAuth(recruiterEmployee);

    const res = await request(app)
      .patch('/api/candidates/cand-001/stage')
      .set(makeAuthHeader(recruiterEmployee))
      .send({ stage: 'placed' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/insufficient permissions/i);
  });

  it('returns 200 and updated stage for director', async () => {
    seedAuth();
    // UPDATE query
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    // SELECT after update
    mockDb.query.mockResolvedValueOnce([
      [{ id: 'cand-001', full_name: 'Jane Doe', pipeline_stage: 'placed' }],
    ]);

    const res = await request(app)
      .patch('/api/candidates/cand-001/stage')
      .set(makeAuthHeader(mockEmployee))
      .send({ stage: 'placed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pipeline_stage).toBe('placed');
    expect(res.body.data.id).toBe('cand-001');
  });
});

// ─── PATCH /api/candidates/:id/credentials ───────────────────────────────────

describe('PATCH /api/candidates/:id/credentials', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app)
      .patch('/api/candidates/cand-001/credentials')
      .send({ linkedin_email: 'test@linkedin.com' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when no valid credential fields are provided', async () => {
    seedAuth();

    const res = await request(app)
      .patch('/api/candidates/cand-001/credentials')
      .set(makeAuthHeader(mockEmployee))
      .send({ unknown_field: 'value' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/no credential fields/i);
  });

  it('returns 200 and updated credentials for an authenticated user', async () => {
    seedAuth();
    // UPDATE query
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    // SELECT after update
    mockDb.query.mockResolvedValueOnce([
      [
        {
          id: 'cand-001',
          full_name: 'Jane Doe',
          linkedin_email: 'jane.doe.linkedin@example.com',
          ssn_last4: null,
          marketing_email: null,
        },
      ],
    ]);

    const res = await request(app)
      .patch('/api/candidates/cand-001/credentials')
      .set(makeAuthHeader(mockEmployee))
      .send({ linkedin_email: 'jane.doe.linkedin@example.com', linkedin_passcode: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.linkedin_email).toBe('jane.doe.linkedin@example.com');
    expect(res.body.data.id).toBe('cand-001');
  });
});
