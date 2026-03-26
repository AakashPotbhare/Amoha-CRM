/**
 * Reusable mock for the mysql2 connection pool (src/config/db.js).
 *
 * The real pool exposes a single relevant method for our application code:
 *   pool.query(sql, params) → Promise<[rows, fields]>
 *
 * By default, mockDb.query resolves with [[]] (an array containing an empty
 * rows array), which is the shape mysql2 returns for SELECT statements that
 * match zero rows.  Individual tests should call mockDb.query.mockResolvedValueOnce()
 * to inject the specific data they need.
 *
 * Usage in a test file:
 *
 *   const { mockDb, resetMockDb } = require('../helpers/db.mock');
 *
 *   beforeEach(() => resetMockDb());
 *
 *   it('handles an empty result', async () => {
 *     // default — mockDb.query already returns [[]]
 *     const res = await request(app).get('/api/employees');
 *     expect(res.status).toBe(200);
 *   });
 *
 *   it('returns an employee', async () => {
 *     mockDb.query.mockResolvedValueOnce([[{ id: '1', full_name: 'Alice' }]]);
 *     const res = await request(app).get('/api/employees/1');
 *     expect(res.body.data.full_name).toBe('Alice');
 *   });
 */

const mockDb = {
  /**
   * Mocked pool.query — returns [[]] by default (empty result set).
   * Tests override this with .mockResolvedValueOnce([[ <rows> ]]).
   */
  query: jest.fn().mockResolvedValue([[]]),

  /**
   * Mocked pool.getConnection — the real pool calls this on startup.
   * Returning a resolved promise with a no-op release() prevents the
   * "MySQL connection failed → process.exit(1)" path in db.js.
   */
  getConnection: jest.fn().mockResolvedValue({
    release: jest.fn(),
  }),
};

/**
 * Resets the mock between tests:
 *   - Clears all recorded calls, instances, and results.
 *   - Restores the default resolved value of [[]] so every test starts clean.
 *
 * Call this in a beforeEach() block inside your describe() suite.
 */
function resetMockDb() {
  mockDb.query.mockReset();
  mockDb.query.mockResolvedValue([[]]);
  mockDb.getConnection.mockReset();
  mockDb.getConnection.mockResolvedValue({ release: jest.fn() });
}

module.exports = { mockDb, resetMockDb };
