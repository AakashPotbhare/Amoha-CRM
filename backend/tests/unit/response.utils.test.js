/**
 * Unit tests for src/utils/response.js
 *
 * Each helper is tested against a mock `res` object that records the
 * status code and JSON body exactly as Express would.  No HTTP server or
 * database is involved.
 *
 * Helpers under test:
 *   ok, created, notFound, badRequest, forbidden, serverError
 *
 * Invariants verified for every helper:
 *   1. Correct HTTP status code.
 *   2. Correct `success` boolean in the response body.
 *   3. Correct `data` or `error` key present in the response body.
 *   4. The helper returns the value of res.json() (allows controller return).
 */

const {
  ok,
  created,
  notFound,
  badRequest,
  forbidden,
  serverError,
} = require('../../src/utils/response');

// ─── Mock res factory ────────────────────────────────────────────────────────

/**
 * Build a mock Express response object.
 * status() stores the code and returns `this` so chaining works.
 * json() stores the body and returns a sentinel value so callers can assert
 * on the return value of each helper.
 *
 * Note: we do NOT use .bind() on the jest.fn() spies because binding wraps
 * the mock in a plain function, losing the jest spy identity (toHaveBeenCalled
 * etc. would throw "received value must be a mock or spy function").  Instead
 * we capture `res` in a closure and reference it directly inside each method.
 */
function buildRes() {
  const sentinel = Symbol('res.json return value');
  const res = {
    _status: 200,       // Express default
    _body:   null,
    _sentinel: sentinel,
  };
  res.status = jest.fn(function (code) {
    res._status = code;
    return res;
  });
  res.json = jest.fn(function (body) {
    res._body = body;
    return sentinel;
  });
  return res;
}

// ─── ok ──────────────────────────────────────────────────────────────────────

describe('ok()', () => {
  let res;
  beforeEach(() => { res = buildRes(); });

  it('uses HTTP 200 (Express default — does not call res.status)', () => {
    ok(res, { id: 1 });
    // ok() calls res.json() directly without setting a status code,
    // relying on Express's default 200.
    expect(res.status).not.toHaveBeenCalled();
  });

  it('sets success: true in the response body', () => {
    ok(res, { id: 1 });
    expect(res._body.success).toBe(true);
  });

  it('places the payload under the data key', () => {
    ok(res, { id: 42, name: 'Alice' });
    expect(res._body.data).toEqual({ id: 42, name: 'Alice' });
  });

  it('accepts an array as data', () => {
    ok(res, [1, 2, 3]);
    expect(res._body.data).toEqual([1, 2, 3]);
  });

  it('accepts null as data', () => {
    ok(res, null);
    expect(res._body.data).toBeNull();
  });

  it('merges extra meta properties into the response body at the top level', () => {
    ok(res, { id: 1 }, { total: 50, page: 2 });
    expect(res._body.total).toBe(50);
    expect(res._body.page).toBe(2);
    // data and success must still be present
    expect(res._body.data).toEqual({ id: 1 });
    expect(res._body.success).toBe(true);
  });

  it('returns the value produced by res.json()', () => {
    const result = ok(res, {});
    expect(result).toBe(res._sentinel);
  });
});

// ─── created ─────────────────────────────────────────────────────────────────

describe('created()', () => {
  let res;
  beforeEach(() => { res = buildRes(); });

  it('sets HTTP status 201', () => {
    created(res, { id: 'new-uuid' });
    expect(res._status).toBe(201);
  });

  it('sets success: true', () => {
    created(res, { id: 'new-uuid' });
    expect(res._body.success).toBe(true);
  });

  it('places the new resource under the data key', () => {
    const newRecord = { id: 'new-uuid', full_name: 'Bob' };
    created(res, newRecord);
    expect(res._body.data).toEqual(newRecord);
  });

  it('returns the value produced by res.json()', () => {
    const result = created(res, {});
    expect(result).toBe(res._sentinel);
  });
});

// ─── notFound ────────────────────────────────────────────────────────────────

describe('notFound()', () => {
  let res;
  beforeEach(() => { res = buildRes(); });

  it('sets HTTP status 404', () => {
    notFound(res);
    expect(res._status).toBe(404);
  });

  it('sets success: false', () => {
    notFound(res);
    expect(res._body.success).toBe(false);
  });

  it('uses the default "Not found" message when none is provided', () => {
    notFound(res);
    expect(res._body.error).toBe('Not found');
  });

  it('uses a custom message when provided', () => {
    notFound(res, 'Employee not found');
    expect(res._body.error).toBe('Employee not found');
  });

  it('does NOT include a data key in the body', () => {
    notFound(res, 'Resource missing');
    expect(res._body).not.toHaveProperty('data');
  });

  it('returns the value produced by res.json()', () => {
    const result = notFound(res);
    expect(result).toBe(res._sentinel);
  });
});

// ─── badRequest ──────────────────────────────────────────────────────────────

describe('badRequest()', () => {
  let res;
  beforeEach(() => { res = buildRes(); });

  it('sets HTTP status 400', () => {
    badRequest(res);
    expect(res._status).toBe(400);
  });

  it('sets success: false', () => {
    badRequest(res);
    expect(res._body.success).toBe(false);
  });

  it('uses the default "Bad request" message when none is provided', () => {
    badRequest(res);
    expect(res._body.error).toBe('Bad request');
  });

  it('uses a custom validation message when provided', () => {
    badRequest(res, 'Employee code and password are required');
    expect(res._body.error).toBe('Employee code and password are required');
  });

  it('does NOT include a data key in the body', () => {
    badRequest(res, 'Invalid input');
    expect(res._body).not.toHaveProperty('data');
  });

  it('returns the value produced by res.json()', () => {
    const result = badRequest(res);
    expect(result).toBe(res._sentinel);
  });
});

// ─── forbidden ───────────────────────────────────────────────────────────────

describe('forbidden()', () => {
  let res;
  beforeEach(() => { res = buildRes(); });

  it('sets HTTP status 403', () => {
    forbidden(res);
    expect(res._status).toBe(403);
  });

  it('sets success: false', () => {
    forbidden(res);
    expect(res._body.success).toBe(false);
  });

  it('uses the default "Forbidden" message when none is provided', () => {
    forbidden(res);
    expect(res._body.error).toBe('Forbidden');
  });

  it('uses a custom message when provided', () => {
    forbidden(res, 'You do not have permission to access this resource');
    expect(res._body.error).toBe('You do not have permission to access this resource');
  });

  it('does NOT include a data key in the body', () => {
    forbidden(res);
    expect(res._body).not.toHaveProperty('data');
  });

  it('returns the value produced by res.json()', () => {
    const result = forbidden(res);
    expect(result).toBe(res._sentinel);
  });
});

// ─── serverError ─────────────────────────────────────────────────────────────

describe('serverError()', () => {
  let res;
  // Suppress console.error output that serverError() emits internally.
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  afterAll(() => consoleSpy.mockRestore());

  beforeEach(() => {
    res = buildRes();
    consoleSpy.mockClear();
  });

  it('sets HTTP status 500', () => {
    serverError(res, new Error('DB timeout'));
    expect(res._status).toBe(500);
  });

  it('sets success: false', () => {
    serverError(res, new Error('DB timeout'));
    expect(res._body.success).toBe(false);
  });

  it('uses the Error message as the error value in the body', () => {
    serverError(res, new Error('Connection refused'));
    expect(res._body.error).toBe('Connection refused');
  });

  it('falls back to "Server error" when the error has no message', () => {
    serverError(res, {});   // plain object, no .message property
    expect(res._body.error).toBe('Server error');
  });

  it('calls console.error with the error object', () => {
    const err = new Error('Unexpected failure');
    serverError(res, err);
    expect(consoleSpy).toHaveBeenCalledWith(err);
  });

  it('does NOT include a data key in the body', () => {
    serverError(res, new Error('Boom'));
    expect(res._body).not.toHaveProperty('data');
  });

  it('returns the value produced by res.json()', () => {
    const result = serverError(res, new Error('x'));
    expect(result).toBe(res._sentinel);
  });
});
