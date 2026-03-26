/**
 * Integration tests for the employees routes.
 *
 *   GET    /api/employees
 *   GET    /api/employees/:id
 *   POST   /api/employees
 *   PATCH  /api/employees/:id/salary
 *   POST   /api/employees/:id/reset-password
 *
 * All routes require the `authenticate` middleware.  Routes that modify data or
 * access salary information are additionally guarded by requireRole(SENIOR_LEADERSHIP)
 * where SENIOR_LEADERSHIP = ['director', 'ops_head', 'hr_head'].
 *
 * Approach
 * ────────
 * - mockDb controls every DB response so tests never touch a real database.
 * - Every authenticated request needs two DB interactions:
 *     1. authenticate → SELECT employee by id (returns mockEmployee).
 *     2. The controller's own query/queries.
 * - We queue mockResolvedValueOnce() calls in order for each test.
 */

jest.mock('../../src/config/db', () => {
  const { mockDb } = require('../helpers/db.mock');
  return mockDb;
});
jest.mock('../../src/services/paymentReminder.service', () => ({
  startPaymentReminderScheduler: jest.fn(),
  checkPaymentReminders:         jest.fn(),
}));

const request  = require('supertest');
const app      = require('../../src/app');
const { mockDb, resetMockDb } = require('../helpers/db.mock');
const {
  makeToken,
  mockEmployee,
  mockEmployee_sales,
  mockEmployee_hr,
} = require('../helpers/auth.helper');

// ─── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Build an Authorization header string for any employee fixture.
 */
function authHeader(emp) {
  return `Bearer ${makeToken({ employeeId: emp.id, role: emp.role })}`;
}

/**
 * Queue the authenticate DB call.  Must be called before any test-specific
 * mockResolvedValueOnce() calls because authenticate runs first in the
 * middleware chain.
 */
function mockAuth(emp) {
  mockDb.query.mockResolvedValueOnce([[emp]]);
}

// ─── Minimal DB row shapes ────────────────────────────────────────────────────

const employeeListRow = {
  id:               'emp-001',
  employee_code:    'ARS20240010',
  full_name:        'Test Employee',
  email:            'test@amoha.com',
  phone:            '9000000001',
  role:             'recruiter',
  department_id:    'dept-001',
  team_id:          'team-001',
  dob:              null,
  designation:      'Recruiter',
  joining_date:     '2024-01-01',
  is_active:        1,
  base_salary:      30000,
  pf_percentage:    12,
  professional_tax: 200,
  avatar_url:       null,
  department_name:  'Recruitment',
  department_slug:  'recruitment',
  team_name:        'Team Alpha',
  created_at:       '2024-01-01T00:00:00.000Z',
};

// ─── GET /api/employees ───────────────────────────────────────────────────────

describe('GET /api/employees', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 when no Authorization header is supplied', async () => {
    const res = await request(app).get('/api/employees');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 when the token is malformed', async () => {
    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', 'Bearer bad.token.here');

    expect(res.status).toBe(401);
  });

  it('returns 200 with an array of employees for a director', async () => {
    mockAuth(mockEmployee);                                          // authenticate
    mockDb.query.mockResolvedValueOnce([[employeeListRow]]);         // list SELECT

    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', authHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(employeeListRow.id);
  });

  it('returns 200 with an empty array when no employees match the query', async () => {
    mockAuth(mockEmployee);
    mockDb.query.mockResolvedValueOnce([[]]); // zero rows

    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', authHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('passes the department_id filter to the DB query when supplied', async () => {
    mockAuth(mockEmployee);
    mockDb.query.mockResolvedValueOnce([[employeeListRow]]);

    await request(app)
      .get('/api/employees?department_id=dept-001')
      .set('Authorization', authHeader(mockEmployee));

    // The second DB call is the list SELECT; its params should include 'dept-001'.
    const listCall = mockDb.query.mock.calls[1];
    expect(listCall[1]).toContain('dept-001');
  });

  it('passes the role filter to the DB query when supplied', async () => {
    mockAuth(mockEmployee);
    mockDb.query.mockResolvedValueOnce([[employeeListRow]]);

    await request(app)
      .get('/api/employees?role=recruiter')
      .set('Authorization', authHeader(mockEmployee));

    const listCall = mockDb.query.mock.calls[1];
    expect(listCall[1]).toContain('recruiter');
  });

  it('allows a sales_executive to list employees (no role restriction on GET /)', async () => {
    mockAuth(mockEmployee_sales);
    mockDb.query.mockResolvedValueOnce([[employeeListRow]]);

    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', authHeader(mockEmployee_sales));

    expect(res.status).toBe(200);
  });
});

// ─── GET /api/employees/:id ───────────────────────────────────────────────────

describe('GET /api/employees/:id', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/employees/emp-001');
    expect(res.status).toBe(401);
  });

  it('returns 404 when the employee id does not exist', async () => {
    mockAuth(mockEmployee);
    mockDb.query.mockResolvedValueOnce([[]]); // no row found

    const res = await request(app)
      .get('/api/employees/nonexistent-id')
      .set('Authorization', authHeader(mockEmployee));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/employee not found/i);
  });

  it('returns 200 with the employee object for a known id', async () => {
    mockAuth(mockEmployee);
    mockDb.query.mockResolvedValueOnce([[employeeListRow]]);

    const res = await request(app)
      .get(`/api/employees/${employeeListRow.id}`)
      .set('Authorization', authHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(employeeListRow.id);
    expect(res.body.data.full_name).toBe(employeeListRow.full_name);
  });

  it('does not expose password_hash in the response', async () => {
    // The SELECT in getOne explicitly names its columns and does NOT include
    // password_hash — the mock row mirrors that real query shape.
    mockAuth(mockEmployee);
    mockDb.query.mockResolvedValueOnce([[employeeListRow]]);

    const res = await request(app)
      .get(`/api/employees/${employeeListRow.id}`)
      .set('Authorization', authHeader(mockEmployee));

    expect(res.status).toBe(200);
    // Confirm the field is absent from the returned data object.
    expect(res.body.data).not.toHaveProperty('password_hash');
  });
});

// ─── POST /api/employees ──────────────────────────────────────────────────────

describe('POST /api/employees', () => {
  beforeEach(() => resetMockDb());

  const validBody = {
    full_name:     'New Hire',
    role:          'recruiter',
    department_id: 'dept-001',
    email:         'newhire@amoha.com',
    phone:         '9000000002',
    joining_date:  '2024-03-01',
    base_salary:   32000,
  };

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app)
      .post('/api/employees')
      .send(validBody);

    expect(res.status).toBe(401);
  });

  it('returns 403 for a sales_executive (not in SENIOR_LEADERSHIP)', async () => {
    mockAuth(mockEmployee_sales);

    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', authHeader(mockEmployee_sales))
      .send(validBody);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when required fields are missing (no full_name)', async () => {
    mockAuth(mockEmployee);

    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', authHeader(mockEmployee))
      .send({ role: 'recruiter', department_id: 'dept-001' }); // missing full_name

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for an invalid role value', async () => {
    mockAuth(mockEmployee);

    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', authHeader(mockEmployee))
      .send({ ...validBody, role: 'space_pirate' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid role/i);
  });

  it('returns 201 for a director with a valid request body', async () => {
    mockAuth(mockEmployee);

    // create() makes these DB calls in order:
    //   1. COUNT(*) for auto-generating employee_code
    //   2. SELECT first team in dept (resolvedTeamId)
    //   3. INSERT INTO employees
    //   4. SELECT newly created employee

    mockDb.query.mockResolvedValueOnce([[{ cnt: 5 }]]);            // COUNT
    mockDb.query.mockResolvedValueOnce([[{ id: 'team-001' }]]);    // first team
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);     // INSERT
    mockDb.query.mockResolvedValueOnce([[{                         // SELECT new emp
      id:               'new-emp-uuid',
      employee_code:    'ARS20240006',
      full_name:        'New Hire',
      email:            'newhire@amoha.com',
      phone:            '9000000002',
      role:             'recruiter',
      dob:              null,
      designation:      null,
      joining_date:     '2024-03-01',
      is_active:        1,
      base_salary:      32000,
      pf_percentage:    12,
      professional_tax: 200,
      department_name:  'Recruitment',
      team_name:        'Team Alpha',
    }]]);

    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', authHeader(mockEmployee))
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id', 'new-emp-uuid');
    expect(res.body.data).toHaveProperty('full_name', 'New Hire');
  });

  it('returns 201 for an hr_head (SENIOR_LEADERSHIP) with a valid body', async () => {
    mockAuth(mockEmployee_hr);

    mockDb.query.mockResolvedValueOnce([[{ cnt: 3 }]]);
    mockDb.query.mockResolvedValueOnce([[{ id: 'team-001' }]]);
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    mockDb.query.mockResolvedValueOnce([[{
      id: 'hr-created-emp', full_name: 'New Hire',
      employee_code: 'ARS20240004', role: 'recruiter',
      department_name: 'Recruitment', team_name: 'Team Alpha',
      base_salary: 32000, pf_percentage: 12, professional_tax: 200,
    }]]);

    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', authHeader(mockEmployee_hr))
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('includes the defaultPassword in the 201 response', async () => {
    mockAuth(mockEmployee);

    mockDb.query.mockResolvedValueOnce([[{ cnt: 0 }]]);
    mockDb.query.mockResolvedValueOnce([[{ id: 'team-001' }]]);
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    mockDb.query.mockResolvedValueOnce([[{
      id: 'new-emp-uuid', full_name: 'New Hire',
      employee_code: 'ARS20240001', role: 'recruiter',
      department_name: 'Recruitment', team_name: 'Team Alpha',
      base_salary: 32000, pf_percentage: 12, professional_tax: 200,
    }]]);

    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', authHeader(mockEmployee))
      .send(validBody);

    expect(res.status).toBe(201);
    // Controller sets defaultPassword to 'Amoha@2026' when none is provided.
    expect(res.body.data).toHaveProperty('defaultPassword', 'Amoha@2026');
  });
});

// ─── PATCH /api/employees/:id/salary ─────────────────────────────────────────

describe('PATCH /api/employees/:id/salary', () => {
  beforeEach(() => resetMockDb());

  const salaryBody = { base_salary: 45000, effective_date: '2024-04-01', reason: 'Annual review' };

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch('/api/employees/emp-001/salary')
      .send(salaryBody);

    expect(res.status).toBe(401);
  });

  it('returns 403 for a sales_executive (not in SENIOR_LEADERSHIP)', async () => {
    mockAuth(mockEmployee_sales);

    const res = await request(app)
      .patch('/api/employees/emp-001/salary')
      .set('Authorization', authHeader(mockEmployee_sales))
      .send(salaryBody);

    expect(res.status).toBe(403);
  });

  it('returns 400 when base_salary is missing from the request body', async () => {
    mockAuth(mockEmployee);

    // updateSalary SELECT
    mockDb.query.mockResolvedValueOnce([[{ id: 'emp-001', base_salary: 35000 }]]);

    const res = await request(app)
      .patch('/api/employees/emp-001/salary')
      .set('Authorization', authHeader(mockEmployee))
      .send({ effective_date: '2024-04-01' }); // no base_salary or salary

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/base_salary is required/i);
  });

  it('returns 404 when the target employee does not exist', async () => {
    mockAuth(mockEmployee);
    mockDb.query.mockResolvedValueOnce([[]]); // employee not found

    const res = await request(app)
      .patch('/api/employees/nonexistent-id/salary')
      .set('Authorization', authHeader(mockEmployee))
      .send(salaryBody);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/employee not found/i);
  });

  it('returns 200 with updated salary data for a director', async () => {
    mockAuth(mockEmployee);

    // updateSalary: SELECT existing employee
    mockDb.query.mockResolvedValueOnce([[{ id: 'emp-001', base_salary: 35000 }]]);
    // INSERT INTO salary_history
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    // UPDATE employees
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .patch('/api/employees/emp-001/salary')
      .set('Authorization', authHeader(mockEmployee))
      .send(salaryBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('base_salary', 45000);
    expect(res.body.data).toHaveProperty('id', 'emp-001');
  });

  it('logs salary history to the salary_history table', async () => {
    mockAuth(mockEmployee);
    mockDb.query.mockResolvedValueOnce([[{ id: 'emp-001', base_salary: 35000 }]]);
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await request(app)
      .patch('/api/employees/emp-001/salary')
      .set('Authorization', authHeader(mockEmployee))
      .send(salaryBody);

    // Query index 2 is INSERT INTO salary_history (after authenticate=0, SELECT=1)
    const insertCall = mockDb.query.mock.calls[2];
    expect(insertCall[0]).toMatch(/INSERT INTO salary_history/i);
  });
});

// ─── POST /api/employees/:id/reset-password ───────────────────────────────────

describe('POST /api/employees/:id/reset-password', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/employees/emp-001/reset-password')
      .send({});

    expect(res.status).toBe(401);
  });

  it('returns 403 for a sales_executive (not in SENIOR_LEADERSHIP)', async () => {
    mockAuth(mockEmployee_sales);

    const res = await request(app)
      .post('/api/employees/emp-001/reset-password')
      .set('Authorization', authHeader(mockEmployee_sales))
      .send({});

    expect(res.status).toBe(403);
  });

  it('returns 200 with temporaryPassword for a director using the default password', async () => {
    mockAuth(mockEmployee);
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE employees

    const res = await request(app)
      .post('/api/employees/emp-001/reset-password')
      .set('Authorization', authHeader(mockEmployee))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('message');
    expect(res.body.data.message).toMatch(/password reset successfully/i);
    expect(res.body.data).toHaveProperty('temporaryPassword', 'Amoha@2026');
  });

  it('returns 200 with the custom password when one is supplied in the body', async () => {
    mockAuth(mockEmployee);
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .post('/api/employees/emp-001/reset-password')
      .set('Authorization', authHeader(mockEmployee))
      .send({ password: 'Custom@Pass99' });

    expect(res.status).toBe(200);
    expect(res.body.data.temporaryPassword).toBe('Custom@Pass99');
  });

  it('updates the password_hash column in the DB', async () => {
    mockAuth(mockEmployee);
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await request(app)
      .post('/api/employees/emp-001/reset-password')
      .set('Authorization', authHeader(mockEmployee))
      .send({});

    // Index 1: the UPDATE call (index 0 is authenticate's SELECT)
    const updateCall = mockDb.query.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE employees SET password_hash/i);
    expect(updateCall[1]).toContain('emp-001');
  });

  it('returns 200 for an hr_head (SENIOR_LEADERSHIP)', async () => {
    mockAuth(mockEmployee_hr);
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .post('/api/employees/emp-001/reset-password')
      .set('Authorization', authHeader(mockEmployee_hr))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
