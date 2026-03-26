/**
 * Unit tests for src/middleware/auth.js
 *
 * Tests the authenticate and requireRole middleware functions in isolation —
 * no HTTP server is started.  We construct minimal req/res objects and spy
 * on the relevant methods so assertions remain fast and deterministic.
 *
 * Dependencies:
 *   - src/config/db   → mocked globally in tests/setup.js
 *   - jsonwebtoken    → real library used (process.env.JWT_SECRET is set in setup.js)
 */

const { mockDb, resetMockDb } = require('../helpers/db.mock');
const { makeToken, mockEmployee, mockEmployee_sales } = require('../helpers/auth.helper');

// The module under test — loaded AFTER setup.js has installed the db mock.
const { authenticate, requireRole } = require('../../src/middleware/auth');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock req object.
 * @param {object} overrides - Properties merged onto the base object.
 */
function buildReq(overrides = {}) {
  return {
    headers: {},
    employee: null,
    ...overrides,
  };
}

/**
 * Build a mock res object whose status() chains back to itself so we can write
 * res.status(401).json({...}) just like Express does.
 *
 * Note: we do NOT use .bind() on the jest.fn() spies — binding wraps the mock
 * in a plain function, losing the jest spy identity so toHaveBeenCalled() etc.
 * would throw "received value must be a mock or spy function".  Instead we
 * capture `res` in a closure and reference it directly.
 */
function buildRes() {
  const res = {
    _status: null,
    _body:   null,
  };
  res.status = jest.fn(function (code) {
    res._status = code;
    return res;
  });
  res.json = jest.fn(function (body) {
    res._body = body;
    return res;
  });
  return res;
}

// ─── authenticate ────────────────────────────────────────────────────────────

describe('authenticate middleware', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 when Authorization header is absent', async () => {
    const req  = buildReq();       // no headers.authorization
    const res  = buildRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not start with "Bearer "', async () => {
    const req  = buildReq({ headers: { authorization: 'Token abc123' } });
    const res  = buildRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the JWT is syntactically invalid', async () => {
    const req  = buildReq({ headers: { authorization: 'Bearer this.is.not.a.valid.jwt' } });
    const res  = buildRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the JWT is signed with the wrong secret', async () => {
    const jwt  = require('jsonwebtoken');
    const badToken = jwt.sign({ employeeId: 'emp-001', role: 'director' }, 'wrong-secret');

    const req  = buildReq({ headers: { authorization: `Bearer ${badToken}` } });
    const res  = buildRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is valid but the employee is not found in the DB', async () => {
    // A well-formed token whose employeeId simply doesn't exist in the DB.
    const token = makeToken({ employeeId: 'nonexistent-id', role: 'director' });

    // db.query returns [[]] (no rows) — employee not found.
    mockDb.query.mockResolvedValueOnce([[]]);

    const req  = buildReq({ headers: { authorization: `Bearer ${token}` } });
    const res  = buildRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'Employee not found or inactive' });
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.employee and calls next() when the token is valid and the employee is active', async () => {
    const token = makeToken({ employeeId: mockEmployee.id, role: mockEmployee.role });

    // DB returns the employee row.
    mockDb.query.mockResolvedValueOnce([[mockEmployee]]);

    const req  = buildReq({ headers: { authorization: `Bearer ${token}` } });
    const res  = buildRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.employee).toEqual(mockEmployee);
    // res must NOT have been used.
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('queries the DB using the employeeId from the token payload', async () => {
    const token = makeToken({ employeeId: mockEmployee.id, role: 'director' });
    mockDb.query.mockResolvedValueOnce([[mockEmployee]]);

    const req  = buildReq({ headers: { authorization: `Bearer ${token}` } });
    const res  = buildRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    // Verify the correct parameter was passed to db.query.
    expect(mockDb.query).toHaveBeenCalledTimes(1);
    const [, params] = mockDb.query.mock.calls[0];
    expect(params).toContain(mockEmployee.id);
  });
});

// ─── requireRole ─────────────────────────────────────────────────────────────

describe('requireRole middleware', () => {
  // requireRole is synchronous, so no DB interaction needed.

  it('calls next() when the employee role is in the allowed list', () => {
    const req  = buildReq({ employee: { role: 'director' } });
    const res  = buildRes();
    const next = jest.fn();

    requireRole(['director', 'ops_head'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() when the allowed list has a single matching role', () => {
    const req  = buildReq({ employee: { role: 'hr_head' } });
    const res  = buildRes();
    const next = jest.fn();

    requireRole(['hr_head'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when the employee role is NOT in the allowed list', () => {
    const req  = buildReq({ employee: { role: mockEmployee_sales.role } });
    const res  = buildRes();
    const next = jest.fn();

    requireRole(['director', 'ops_head', 'hr_head'])(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
    expect(res._body).toEqual({ error: 'Insufficient permissions' });
  });

  it('returns 403 when the allowed list is empty', () => {
    const req  = buildReq({ employee: { role: 'director' } });
    const res  = buildRes();
    const next = jest.fn();

    requireRole([])(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });

  it('performs a strict string comparison — role must match exactly', () => {
    const req  = buildReq({ employee: { role: 'DIRECTOR' } }); // wrong case
    const res  = buildRes();
    const next = jest.fn();

    requireRole(['director'])(req, res, next);

    // 'DIRECTOR' !== 'director', so access should be denied.
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });

  it('returns a different middleware function on each call (factory pattern)', () => {
    const mw1 = requireRole(['director']);
    const mw2 = requireRole(['hr_head']);
    expect(mw1).not.toBe(mw2);
    expect(typeof mw1).toBe('function');
    expect(typeof mw2).toBe('function');
  });
});
