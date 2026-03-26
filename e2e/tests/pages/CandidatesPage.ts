import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Candidates list page (/candidates) and the
 * Candidate Enrollment form (/candidates/enroll).
 *
 * The Candidates page renders a full HTML table with a search input.
 * The Enrollment page uses react-hook-form + zod validation.
 */
export class CandidatesPage {
  readonly page: Page;

  // ── List page ────────────────────────────────────────────────────────────────
  readonly searchInput: Locator;
  readonly candidateTable: Locator;
  readonly candidateRows: Locator;
  readonly enrollButton: Locator;
  readonly loadingIndicator: Locator;
  readonly errorMessage: Locator;

  // ── Enrollment form ───────────────────────────────────────────────────────────
  readonly fullNameInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly submitEnrollButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // List page elements
    this.searchInput = page.locator(
      'input[placeholder*="search" i], input[placeholder*="filter" i], input[type="search"]',
    ).first();
    this.candidateTable = page.locator('table').first();
    this.candidateRows = page.locator('table tbody tr');
    this.enrollButton = page.locator(
      'a[href*="enroll"], button:has-text("Enroll")',
    ).first();
    this.loadingIndicator = page.locator('.animate-spin, [aria-busy="true"]').first();
    this.errorMessage = page.locator('[role="alert"], .text-destructive').first();

    // Enrollment form elements — selectors from CandidateEnrollment.tsx field ids
    this.fullNameInput = page.locator('input[id*="full_name"], input[name*="full_name"], input[placeholder*="full name" i]').first();
    this.emailInput = page.locator('input[id*="email"][type="email"], input[name*="email"]').first();
    this.phoneInput = page.locator('input[id*="phone"], input[name*="phone"], input[placeholder*="phone" i]').first();
    this.submitEnrollButton = page.locator('button[type="submit"]').first();
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  async gotoList(): Promise<void> {
    await this.page.goto('/candidates');
  }

  async gotoEnroll(): Promise<void> {
    await this.page.goto('/candidates/enroll');
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    // Give the client-side filter a moment to update
    await this.page.waitForTimeout(300);
  }

  async clickEnrollButton(): Promise<void> {
    await this.enrollButton.click();
    await this.page.waitForURL('**/candidates/enroll', { timeout: 8_000 });
  }

  // ── Assertions ───────────────────────────────────────────────────────────────

  async expectTableVisible(): Promise<void> {
    await expect(this.candidateTable).toBeVisible({ timeout: 15_000 });
  }

  async expectSearchVisible(): Promise<void> {
    await expect(this.searchInput).toBeVisible({ timeout: 10_000 });
  }

  async expectEnrollFormVisible(): Promise<void> {
    // The enrollment page title starts with "Enroll" or has a prominent heading
    await expect(
      this.page.locator('h1, h2, h3').filter({ hasText: /enroll/i }),
    ).toBeVisible({ timeout: 10_000 });
  }
}
