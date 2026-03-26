import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the RecruitHUB login page (/login).
 *
 * Field selectors are derived from Login.tsx:
 *   - Employee code: <Input id="code" …>
 *   - Password:      <Input id="password" type="password" …>
 *   - Submit:        <Button type="submit">Sign In</Button>
 *   - Reset link:    <button type="button">Forgot password?</button>
 *
 * Each locator has a fallback chain so the POM stays resilient to minor
 * markup changes.
 */
export class LoginPage {
  readonly page: Page;

  // ── Locators ────────────────────────────────────────────────────────────────
  readonly employeeCodeInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly forgotPasswordLink: Locator;

  // Reset-password panel
  readonly emailInput: Locator;
  readonly sendResetButton: Locator;
  readonly backToLoginLink: Locator;

  // Feedback
  readonly errorToast: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;

    this.employeeCodeInput = page.locator(
      '#code, [name="employeeCode"], input[placeholder*="ARS" i]',
    ).first();

    this.passwordInput = page.locator(
      '#password, [name="password"], input[type="password"]',
    ).first();

    this.submitButton = page.locator('button[type="submit"]').first();

    this.forgotPasswordLink = page.locator(
      'button:has-text("Forgot password"), a:has-text("Forgot password")',
    ).first();

    this.emailInput = page.locator(
      '#email, input[type="email"], input[placeholder*="gmail" i]',
    ).first();

    this.sendResetButton = page.locator(
      'button[type="submit"]:has-text("Send"), button:has-text("Reset Link")',
    ).first();

    this.backToLoginLink = page.locator(
      'button:has-text("Back to login"), a:has-text("Back to login")',
    ).first();

    // Shadcn/toast renders errors with role="status" or in a destructive variant
    this.errorToast = page.locator(
      '[role="alert"], [data-variant="destructive"], .destructive',
    ).first();

    this.loadingSpinner = page.locator('.animate-spin').first();
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.employeeCodeInput.waitFor({ state: 'visible', timeout: 10_000 });
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async fillEmployeeCode(code: string): Promise<void> {
    await this.employeeCodeInput.fill(code);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /** Fill credentials and click submit. */
  async login(code: string, password: string): Promise<void> {
    await this.fillEmployeeCode(code);
    await this.fillPassword(password);
    await this.submit();
  }

  /** Expect a successful redirect away from /login. */
  async expectRedirectedToApp(): Promise<void> {
    await this.page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 15_000,
    });
  }

  /** Expect to stay on /login after a failed attempt. */
  async expectLoginFailed(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/, { timeout: 8_000 });
  }

  // ── Assertions ───────────────────────────────────────────────────────────────

  async expectFormVisible(): Promise<void> {
    await expect(this.employeeCodeInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async expectErrorVisible(): Promise<void> {
    // The toast may take a moment to appear
    await expect(this.errorToast).toBeVisible({ timeout: 8_000 });
  }

  async expectPageTitle(): Promise<void> {
    await expect(
      this.page.locator('h1:has-text("RecruitHub"), h2:has-text("Sign In")'),
    ).toBeVisible({ timeout: 5_000 });
  }
}
