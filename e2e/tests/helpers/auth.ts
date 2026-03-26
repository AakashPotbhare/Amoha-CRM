import { Page, expect } from '@playwright/test';

/**
 * Default test credentials.
 *
 * DIR001 is a director-level account that has access to all features,
 * making it the most useful credential for broad E2E coverage.
 * Override by passing different values to the helper functions below.
 */
export const DEFAULT_EMPLOYEE_CODE = 'DIR001';
export const DEFAULT_PASSWORD = 'Admin@123';

/**
 * Navigate to /login and submit credentials.
 *
 * The login form uses `id="code"` for the employee code field and
 * `id="password"` for the password field (verified from Login.tsx).
 * Selectors are ordered from most specific to broadest fallback.
 *
 * After a successful login the app redirects to "/" (Home).
 */
export async function loginAs(
  page: Page,
  employeeCode: string = DEFAULT_EMPLOYEE_CODE,
  password: string = DEFAULT_PASSWORD,
): Promise<void> {
  await page.goto('/login');

  // Employee code input — tries id="code" first, then common fallbacks
  const codeInput = page.locator(
    '#code, [name="employeeCode"], input[placeholder*="ARS" i], input[placeholder*="employee" i]',
  ).first();
  await codeInput.waitFor({ state: 'visible', timeout: 10_000 });
  await codeInput.fill(employeeCode);

  // Password input
  await page.fill('#password, [name="password"], input[type="password"]', password);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for redirect away from /login; the app lands on "/" (Home)
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  });
}

/**
 * Click the "Sign Out" button in the sidebar and wait for the /login redirect.
 */
export async function logout(page: Page): Promise<void> {
  // The sidebar button has text "Sign Out"
  await page.click('button:has-text("Sign Out"), a:has-text("Sign Out")');
  await page.waitForURL('**/login', { timeout: 10_000 });
}

/**
 * Perform a full login, run the provided callback, then sign out.
 * Useful for tests that want a clean auth session.
 */
export async function withAuth(
  page: Page,
  callback: () => Promise<void>,
  employeeCode: string = DEFAULT_EMPLOYEE_CODE,
  password: string = DEFAULT_PASSWORD,
): Promise<void> {
  await loginAs(page, employeeCode, password);
  await callback();
  await logout(page);
}

/**
 * Assert that the page is currently showing the authenticated layout
 * by confirming the sidebar (AppSidebar) is present.
 */
export async function expectAuthenticated(page: Page): Promise<void> {
  await expect(page.locator('aside')).toBeVisible({ timeout: 10_000 });
}

/**
 * Assert that the page is on the login screen.
 */
export async function expectLoginPage(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  await expect(
    page.locator('h2:has-text("Sign In"), h1:has-text("Sign In")'),
  ).toBeVisible({ timeout: 5_000 });
}
