import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { loginAs, logout, expectAuthenticated, expectLoginPage } from './helpers/auth';

/**
 * Authentication E2E tests
 *
 * These tests verify the complete authentication cycle: form rendering,
 * validation feedback, successful sign-in, route protection, and sign-out.
 *
 * Tests that require a real running backend are tagged appropriately.
 * Use `test.skip` comment to disable when running against a mocked API.
 */
test.describe('Authentication', () => {
  // ── Login page structure ──────────────────────────────────────────────────

  test('login page loads with all form elements', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Brand / heading
    await expect(
      page.locator('h1:has-text("RecruitHub"), img[alt*="Amoha" i]'),
    ).toBeVisible();

    // Core form elements
    await loginPage.expectFormVisible();

    // Forgot password link
    await expect(loginPage.forgotPasswordLink).toBeVisible();
  });

  test('login page has correct placeholder text on employee code field', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Login.tsx uses placeholder="ARS202301"
    await expect(loginPage.employeeCodeInput).toHaveAttribute('placeholder', /ARS/i);
  });

  test('submit button is disabled or shows spinner while loading', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.fillEmployeeCode('DIR001');
    await loginPage.fillPassword('Admin@123');

    // Intercept so the request hangs long enough to observe loading state
    await page.route('**/auth/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });

    await loginPage.submit();

    // Either the button is disabled OR a spinner appears during the request
    const isDisabled = await loginPage.submitButton.isDisabled();
    const spinnerVisible = await loginPage.loadingSpinner.isVisible();
    expect(isDisabled || spinnerVisible).toBe(true);

    // Unroute to not affect other tests
    await page.unrouteAll();
  });

  test('forgot password panel shows email input when link is clicked', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.forgotPasswordLink.click();

    // The panel should switch to the reset form
    await expect(loginPage.emailInput).toBeVisible({ timeout: 5_000 });
    await expect(loginPage.sendResetButton).toBeVisible();
  });

  test('back to login link returns to sign-in form from reset panel', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.forgotPasswordLink.click();
    await expect(loginPage.emailInput).toBeVisible();

    await loginPage.backToLoginLink.click();

    // Sign-in form should be visible again
    await loginPage.expectFormVisible();
    await expect(loginPage.forgotPasswordLink).toBeVisible();
  });

  // ── Failed login ──────────────────────────────────────────────────────────

  test('shows error toast for wrong credentials', async ({ page }) => {
    // Stub the auth endpoint so we don't need a real server
    await page.route('**/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid employee code or password' }),
      }),
    );

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('WRONG01', 'badpassword');

    await loginPage.expectLoginFailed();
    await loginPage.expectErrorVisible();
  });

  test('stays on /login after submitting empty fields', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Submit without filling any fields — the component guards against empty values
    await loginPage.submit();

    await expect(page).toHaveURL(/\/login/);
  });

  // ── Successful login & sign-out ───────────────────────────────────────────

  test('successful login redirects away from /login', async ({ page }) => {
    // Mock a successful auth response
    await page.route('**/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-jwt-token',
          employee: {
            id: 'emp-001',
            employee_code: 'DIR001',
            full_name: 'Test Director',
            role: 'director',
            departments: { name: 'Operations' },
          },
        }),
      }),
    );

    // Also mock the /auth/me endpoint that AuthContext uses to rehydrate state
    await page.route('**/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          employee: {
            id: 'emp-001',
            employee_code: 'DIR001',
            full_name: 'Test Director',
            role: 'director',
            departments: { name: 'Operations' },
          },
        }),
      }),
    );

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('DIR001', 'Admin@123');
    await loginPage.expectRedirectedToApp();
  });

  test('authenticated user sees their name in the sidebar', async ({ page }) => {
    // Mock auth
    await page.route('**/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-jwt-token',
          employee: {
            id: 'emp-001',
            employee_code: 'DIR001',
            full_name: 'Test Director',
            role: 'director',
            departments: { name: 'Operations' },
          },
        }),
      }),
    );

    await page.route('**/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          employee: {
            id: 'emp-001',
            employee_code: 'DIR001',
            full_name: 'Test Director',
            role: 'director',
            departments: { name: 'Operations' },
          },
        }),
      }),
    );

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('DIR001', 'Admin@123');
    await loginPage.expectRedirectedToApp();

    // Sidebar shows full name (from AppSidebar.tsx: employee.full_name)
    await expect(page.locator('aside')).toContainText('Test Director', {
      timeout: 10_000,
    });
  });

  test('unauthenticated access to protected route redirects to /login', async ({ page }) => {
    // Stub /auth/me to return 401 (no active session)
    await page.route('**/auth/me', (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) }),
    );

    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('unauthenticated access to /attendance redirects to /login', async ({ page }) => {
    await page.route('**/auth/me', (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) }),
    );

    await page.goto('/attendance');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  // ── Live server tests (skip in mocked mode) ────────────────────────────────

  test.skip('live: full login → dashboard → sign out flow', async ({ page }) => {
    // Requires backend running on :4000 with seed data including DIR001
    await loginAs(page, 'DIR001', 'Admin@123');
    await expectAuthenticated(page);
    await logout(page);
    await expectLoginPage(page);
  });
});
