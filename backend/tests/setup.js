/**
 * Global test setup — executed by Jest via `setupFiles` before every test
 * file is loaded.
 *
 * Because setupFiles run BEFORE the test framework installs jest.mock() at
 * module scope, we use jest.mock() here only for side-effect-laden modules
 * that would otherwise connect to external services at require-time.
 *
 * Load order guarantee:
 *   1. This file runs first (process.env is populated).
 *   2. jest.mock() calls here apply to the entire test file that follows.
 *   3. The test file's own jest.mock() calls are hoisted to the top of that
 *      file, so they win over anything defined here if there is a conflict.
 */

// ─── Environment variables ─────────────────────────────────────────────────
// These must be set before any source module is require()'d because several
// modules read from process.env at the top level (e.g. jwt.sign, mysql pool).

process.env.JWT_SECRET     = 'test-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV       = 'test';

// Provide dummy DB credentials so mysql2 does not throw during pool creation.
// The pool itself is replaced by a jest mock (see below), so these values are
// never actually used to open a TCP connection.
process.env.DB_HOST     = '127.0.0.1';
process.env.DB_PORT     = '3306';
process.env.DB_USER     = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.DB_NAME     = 'recruithub_test';

// Prevent the app from trying to bind to a real port.
process.env.PORT = '0';

// ─── Mock: database pool ───────────────────────────────────────────────────
// src/config/db.js creates a mysql2 connection pool at require-time AND calls
// pool.getConnection() immediately, which would fail without a real MySQL
// server. Replacing the entire module with a lightweight jest mock prevents
// that connection attempt across ALL test files.
//
// Individual test files can further customise the mock's return values via
// the helpers/db.mock.js helper.

jest.mock('../src/config/db', () => {
  const { mockDb } = require('./helpers/db.mock');
  return mockDb;
});

// ─── Mock: payment reminder scheduler ─────────────────────────────────────
// src/app.js calls startPaymentReminderScheduler() inside app.listen(), which
// sets up a setInterval and makes an immediate DB query.  Mocking this service
// prevents the interval from running during tests and stops the spurious DB
// call on startup.

jest.mock('../src/services/paymentReminder.service', () => ({
  startPaymentReminderScheduler: jest.fn(),
  checkPaymentReminders:         jest.fn(),
}));
