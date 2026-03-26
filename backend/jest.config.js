/**
 * Jest configuration for the RecruitHUB backend.
 *
 * - Runs in the Node.js environment (no DOM).
 * - Tests must live under tests/**\/*.test.js
 * - setup.js runs before every test file to populate env vars and
 *   install module-level mocks before any source file is required.
 * - Coverage is collected from the four main source directories;
 *   generated reports land in coverage/ at the project root.
 */

/** @type {import('jest').Config} */
module.exports = {
  // Use the real Node.js runtime — no jsdom overhead.
  testEnvironment: 'node',

  // Where Jest looks for test files.
  testMatch: ['**/tests/**/*.test.js'],

  // Executed once per worker before the test framework is installed.
  // Ideal for setting environment variables that modules read at require-time.
  setupFiles: ['./tests/setup.js'],

  // Give each test file 15 seconds before it times out.
  // Integration tests hit real async middleware chains, so they need headroom.
  testTimeout: 15000,

  // Coverage configuration — only instrument application code, not tests or
  // third-party node_modules.
  collectCoverage: false, // Run with --coverage flag when needed.
  collectCoverageFrom: [
    'src/controllers/**/*.js',
    'src/middleware/**/*.js',
    'src/services/**/*.js',
    'src/utils/**/*.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],

  // Silence the noisy console output from the app during tests.
  // Individual tests can spy on console themselves if needed.
  silent: false,

  // Clear mock state (calls, instances, results) between every test automatically.
  clearMocks: true,

  // Force Jest to exit after all tests complete, even if the Express app's
  // app.listen() or other async handles (timers, sockets) are still open.
  // This prevents the "worker process has failed to exit gracefully" warning.
  forceExit: true,
};
