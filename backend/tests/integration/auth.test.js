/**
 * Integration tests for the auth routes.
 *
 *   POST /api/auth/login
 *   POST /api/auth/change-password
 *   GET  /api/auth/me
 *
 * Approach
 * ────────
 * supertest spins up the Express app in-process (no port binding needed) and
 * fires real HTTP requests through the full middleware stack — rate limiter,
 * CORS, authenticate, controllers, response helpers.
 *
 * The MySQL pool is replaced by mockDb (installed in tests/setup.js) so every
 * test controls exactly what the "database" returns via mockDb.query.mockResolvedValueOnce().
 *
 * The paymentReminder scheduler is also mocked in setup.js so app.listen()'s
 * side-effects do not bleed into the test process.
 */

// These jest.mock() calls are hoisted to the very top of the module by Babel/
// Jest's transform, so they win over any mocks installed later. They mirror
// what setup.js does, ensuring the mocks are in place even if this file is run
// in isolation.
jest.mock('../../src/config/db', () => {
  const { mockDb } = require('../helpers/db.mock');
  return mockDb;
});
jest.mock('../../src/services/paymentReminder.service', () => ({
  startPaymentReminderScheduler: jest.fn(),
  checkPaymentReminders:         jest.fn(),
}));

const request  = require('supertest');
const bcrypt   = require('bcryptjs');
const app      = require('../../src/app');
const { mockDb, resetMockDb } = require('../helpers/db.mock');
const { makeToken, mockEmployee } = require('../helpers/auth.helper');

// ─── POST /api/auth/login ────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(() => resetMockDb());

  it('returns 400 when employeeCode is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'somepassword' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Employee code and password are required');
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ employeeCode: 'ARS20240001' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Employee code and password are required');
  });

  it('returns 400 when both fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when the employee is not found in the DB', async () => {
    // DB returns no rows — employee does not exist or is inactive.
    mockDb.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ employeeCode: 'ARS99999999', password: 'irrelevant' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid employee code/i);
  });

  it('returns 400 when the password does not match the stored hash', async () => {
    // Create a real hash for 'correct-password' to make bcrypt.compare work.
    const hash = await bcrypt.hash('correct-password', 10);
    const dbRow = { ...mockEmployee, password_hash: hash };

    mockDb.query.mockResolvedValueOnce([[dbRow]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ employeeCode: 'ARS20240001', password: 'wrong-password' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it('returns 200 with token and employee on valid credentials', async () => {
    const plainPassword = 'SecurePass@123';
    const hash = await bcrypt.hash(plainPassword, 10);
    const dbRow = { ...mockEmployee, password_hash: hash };

    mockDb.query.mockResolvedValueOnce([[dbRow]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ employeeCode: mockEmployee.employee_code, password: plainPassword });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data).toHaveProperty('employee');
    expect(res.body.data.employee.id).toBe(mockEmployee.id);
    expect(res.body.data.employee.role).toBe(mockEmployee.role);
  });

  it('does not return password_hash in the login response', async () => {
    const plainPassword = 'SecurePass@123';
    const hash = await bcrypt.hash(plainPassword, 10);
    const dbRow = { ...mockEmployee, password_hash: hash };

    mockDb.query.mockResolvedValueOnce([[dbRow]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ employeeCode: mockEmployee.employee_code, password: plainPassword });

    expect(res.status).toBe(200);
    expect(res.body.data.employee).not.toHaveProperty('password_hash');
  });

  it('upcases the employeeCode before querying the DB', async () => {
    // DB returns no rows regardless — we only care that the query was called
    // with the uppercased code.
    mockDb.query.mockResolvedValueOnce([[]]);

    await request(app)
      .post('/api/auth/login')
      .send({ employeeCode: 'ars20240001', password: 'pass' });

    const [, params] = mockDb.query.mock.calls[0];
    expect(params[0]).toBe('ARS20240001');
  });

  it('returns a JWT that decodes to the correct employeeId and role', async () => {
    const jwt = require('jsonwebtoken');
    const plainPassword = 'SecurePass@123';
    const hash = await bcrypt.hash(plainPassword, 10);
    const dbRow = { ...mockEmployee, password_hash: hash };

    mockDb.query.mockResolvedValueOnce([[dbRow]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ employeeCode: mockEmployee.employee_code, password: plainPassword });

    expect(res.status).toBe(200);
    const decoded = jwt.verify(res.body.data.token, process.env.JWT_SECRET);
    expect(decoded.employeeId).toBe(mockEmployee.id);
    expect(decoded.role).toBe(mockEmployee.role);
  });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────

describe('POST /api/auth/change-password', () => {
  beforeEach(() => resetMockDb());

  /**
   * Helper: return a valid Authorization header for mockEmployee.
   */
  function directorAuthHeader() {
    return `Bearer ${makeToken({ employeeId: mockEmployee.id, role: mockEmployee.role })}`;
  }

  /**
   * Set up the two DB calls that authenticate + changePassword need:
   *   1. authenticate → returns the employee row (to set req.employee).
   *   2. changePassword → returns just { password_hash } for bcrypt.compare.
   */
  function mockAuthAndFetchHash(storedHash) {
    // authenticate's SELECT
    mockDb.query.mockResolvedValueOnce([[mockEmployee]]);
    // changePassword's SELECT password_hash
    mockDb.query.mockResolvedValueOnce([[{ password_hash: storedHash }]]);
  }

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'old', newPassword: 'newpassword123' });

    expect(res.status).toBe(401);
  });

  it('returns 400 when the current password is incorrect', async () => {
    const storedHash = await bcrypt.hash('actual-current-password', 10);
    mockAuthAndFetchHash(storedHash);

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', directorAuthHeader())
      .send({ currentPassword: 'wrong-password', newPassword: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Current password is incorrect');
  });

  it('returns 400 when the new password is fewer than 8 characters', async () => {
    const currentPassword = 'currentPass@1';
    const storedHash = await bcrypt.hash(currentPassword, 10);
    mockAuthAndFetchHash(storedHash);

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', directorAuthHeader())
      .send({ currentPassword, newPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/at least 8 characters/i);
  });

  it('returns 200 and success message on a valid password change', async () => {
    const currentPassword = 'currentPass@1';
    const storedHash = await bcrypt.hash(currentPassword, 10);
    // authenticate
    mockDb.query.mockResolvedValueOnce([[mockEmployee]]);
    // changePassword SELECT
    mockDb.query.mockResolvedValueOnce([[{ password_hash: storedHash }]]);
    // changePassword UPDATE
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', directorAuthHeader())
      .send({ currentPassword, newPassword: 'NewSecure@123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('message');
    expect(res.body.data.message).toMatch(/password changed/i);
  });

  it('issues an UPDATE query that sets the new hashed password', async () => {
    const currentPassword = 'currentPass@1';
    const storedHash = await bcrypt.hash(currentPassword, 10);
    mockDb.query.mockResolvedValueOnce([[mockEmployee]]);
    mockDb.query.mockResolvedValueOnce([[{ password_hash: storedHash }]]);
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', directorAuthHeader())
      .send({ currentPassword, newPassword: 'NewSecure@123' });

    // The UPDATE call is the third query overall.
    const updateCall = mockDb.query.mock.calls[2];
    expect(updateCall[0]).toMatch(/UPDATE employees SET password_hash/i);
    // The employee id should be the last bound parameter.
    expect(updateCall[1]).toContain(mockEmployee.id);
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 when no Authorization token is provided', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 when the token is invalid', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.value');

    expect(res.status).toBe(401);
  });

  it('returns 200 with the authenticated employee data', async () => {
    // authenticate DB call
    mockDb.query.mockResolvedValueOnce([[mockEmployee]]);

    const token = makeToken({ employeeId: mockEmployee.id, role: mockEmployee.role });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id', mockEmployee.id);
    expect(res.body.data).toHaveProperty('full_name', mockEmployee.full_name);
    expect(res.body.data).toHaveProperty('role', mockEmployee.role);
  });

  it('does not return password_hash in the /me response', async () => {
    mockDb.query.mockResolvedValueOnce([[mockEmployee]]);

    const token = makeToken({ employeeId: mockEmployee.id, role: mockEmployee.role });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('password_hash');
  });

  it('returns structured department and team objects in the response', async () => {
    mockDb.query.mockResolvedValueOnce([[mockEmployee]]);

    const token = makeToken({ employeeId: mockEmployee.id, role: mockEmployee.role });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // safeEmployee() shapes these from dept_name/dept_slug/team_name.
    expect(res.body.data).toHaveProperty('departments');
    expect(res.body.data.departments).toHaveProperty('name', mockEmployee.dept_name);
    expect(res.body.data).toHaveProperty('teams');
    expect(res.body.data.teams).toHaveProperty('name', mockEmployee.team_name);
  });
});
