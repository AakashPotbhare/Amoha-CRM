import { test, expect } from '@playwright/test';

/**
 * Navigation E2E tests
 *
 * Verifies that authenticated users can navigate between all key sections
 * via the AppSidebar. Tests use mocked auth so they run without a live DB.
 *
 * Sidebar link labels (from AppSidebar.tsx):
 *   Core:    Home, Task Inbox, Create Task
 *   Actions: Enroll Candidate, Candidates, My Queue, Attendance, Leaves,
 *            My Profile, Attendance Report, Shift Settings, HR Management,
 *            My Performance, Placement Offers
 */

// ── Shared auth + layout mock setup ─────────────────────────────────────────

async function mockAuthAndLayout(page: import('@playwright/test').Page) {
  const employee = {
    id: 'emp-001',
    employee_code: 'DIR001',
    full_name: 'Test Director',
    role: 'director',
    departments: { name: 'Operations' },
  };

  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ employee }),
    }),
  );

  // Intercept any API calls from the pages themselves so they don't fail
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], total: 0 }),
    }),
  );
}

// ── Helper: navigate to Home (authenticated) ─────────────────────────────────

async function gotoHome(page: import('@playwright/test').Page) {
  await mockAuthAndLayout(page);
  await page.goto('/');
  // Wait for the sidebar to render
  await page.locator('aside').waitFor({ state: 'visible', timeout: 10_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test('sidebar is visible after authentication', async ({ page }) => {
    await gotoHome(page);
    await expect(page.locator('aside')).toBeVisible();
  });

  test('sidebar contains the RecruitHub brand logo/text', async ({ page }) => {
    await gotoHome(page);
    const sidebar = page.locator('aside');
    // AppSidebar renders "RecruitHub" text and/or the Amoha logo image
    const hasBrand =
      (await sidebar.locator('text=RecruitHub').isVisible()) ||
      (await sidebar.locator('img[alt*="Amoha" i]').isVisible());
    expect(hasBrand).toBe(true);
  });

  test('sidebar shows authenticated employee name', async ({ page }) => {
    await gotoHome(page);
    await expect(page.locator('aside')).toContainText('Test Director');
  });

  test('sidebar contains Attendance link', async ({ page }) => {
    await gotoHome(page);
    await expect(
      page.locator('aside a[href*="attendance"], aside a:has-text("Attendance")').first(),
    ).toBeVisible();
  });

  test('sidebar contains Leaves link', async ({ page }) => {
    await gotoHome(page);
    await expect(
      page.locator('aside a[href*="leaves"], aside a:has-text("Leaves")').first(),
    ).toBeVisible();
  });

  test('sidebar contains My Profile link', async ({ page }) => {
    await gotoHome(page);
    await expect(
      page.locator('aside a[href*="profile"], aside a:has-text("My Profile")').first(),
    ).toBeVisible();
  });

  test('clicking Attendance navigates to /attendance', async ({ page }) => {
    await gotoHome(page);

    await page
      .locator('aside a[href="/attendance"], aside a:has-text("Attendance")')
      .first()
      .click();

    await expect(page).toHaveURL(/\/attendance/, { timeout: 8_000 });
  });

  test('clicking Leaves navigates to /leaves', async ({ page }) => {
    await gotoHome(page);

    await page
      .locator('aside a[href="/leaves"], aside a:has-text("Leaves")')
      .first()
      .click();

    await expect(page).toHaveURL(/\/leaves/, { timeout: 8_000 });
  });

  test('clicking My Profile navigates to /profile', async ({ page }) => {
    await gotoHome(page);

    await page
      .locator('aside a[href="/profile"], aside a:has-text("My Profile")')
      .first()
      .click();

    await expect(page).toHaveURL(/\/profile/, { timeout: 8_000 });
  });

  test('clicking Home navigates to /', async ({ page }) => {
    // Start on another page then navigate home
    await mockAuthAndLayout(page);
    await page.goto('/attendance');
    await page.locator('aside').waitFor({ state: 'visible', timeout: 10_000 });

    await page
      .locator('aside a[href="/"], aside a:has-text("Home")')
      .first()
      .click();

    await expect(page).toHaveURL(/^\/$|\/\?/, { timeout: 8_000 });
  });

  test('director sees Candidates link in sidebar', async ({ page }) => {
    await gotoHome(page);
    // Director has candidates.read permission — AppSidebar renders the link
    await expect(
      page.locator('aside a[href="/candidates"], aside a:has-text("Candidates")').first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('404 / not-found page renders for unknown routes', async ({ page }) => {
    await mockAuthAndLayout(page);
    await page.goto('/this-route-does-not-exist-xyz');

    // NotFound.tsx should render; check for common indicators
    const notFoundIndicator = page.locator(
      'text=404, text=Not Found, text=Page not found, [data-testid="not-found"]',
    ).first();

    await expect(notFoundIndicator).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar collapse button toggles sidebar width', async ({ page }) => {
    await gotoHome(page);

    const sidebar = page.locator('aside');
    const collapseBtn = page.locator('button:has-text("Collapse")').first();

    // Sidebar should start expanded (~w-60 = 240px)
    const initialWidth = (await sidebar.boundingBox())?.width ?? 0;
    expect(initialWidth).toBeGreaterThan(100);

    await collapseBtn.click();

    // After collapse sidebar should be ~w-16 = 64px
    const collapsedWidth = (await sidebar.boundingBox())?.width ?? 0;
    expect(collapsedWidth).toBeLessThan(initialWidth);
  });

  // ── Live server tests (skip in mocked mode) ──────────────────────────────

  test.skip('live: My Queue navigates to /my-queue', async ({ page }) => {
    // Requires real auth + director account with support_tasks.read_own permission
    await page.goto('/');
    await page.locator('aside a:has-text("My Queue")').first().click();
    await expect(page).toHaveURL(/\/my-queue/);
  });
});
