import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for RecruitHUB E2E tests.
 *
 * Prerequisites before running:
 *   - Frontend dev server running on http://localhost:8080
 *   - Backend API running on http://localhost:4000
 *
 * Run:
 *   npx playwright install chromium
 *   npm test
 */
export default defineConfig({
  testDir: './tests',

  // Per-test timeout (ms). Auth redirects + API calls need some headroom.
  timeout: 30_000,

  // Retry once on CI to absorb transient network/timing flakiness.
  retries: process.env.CI ? 2 : 1,

  // Run test files in parallel; keep workers low on CI to avoid port contention.
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ...(process.env.CI ? [['github'] as ['github']] : []),
  ],

  use: {
    baseURL: 'http://localhost:8080',

    // Capture screenshot only when a test fails — avoids cluttering the report.
    screenshot: 'only-on-failure',

    // Record video on the first retry so failures are always reproducible.
    video: 'on-first-retry',

    // Retain browser traces on failure for deep inspection.
    trace: 'on-first-retry',

    // How long to wait for navigation / network requests.
    navigationTimeout: 15_000,
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment additional browsers when needed:
    // { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',   use: { ...devices['Desktop Safari']  } },
  ],

  // Output artefacts land here; kept out of version control.
  outputDir: 'test-results',

  // No webServer block — tests assume the apps are already running.
  // In CI the workflow starts the servers before invoking Playwright.
});
