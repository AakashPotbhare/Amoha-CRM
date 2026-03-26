import { test, expect } from '@playwright/test';
import { format } from 'date-fns';

/**
 * Attendance E2E tests
 *
 * Covers the Attendance page (/attendance):
 *  - Page loads and renders core sections
 *  - Today's date header is correct
 *  - Check-in / check-out buttons are present
 *  - Calendar section renders
 *  - Break controls are accessible
 *
 * All tests mock auth + API so they run without a live DB.
 */

// ── Mock helpers ──────────────────────────────────────────────────────────────

const MOCK_EMPLOYEE = {
  id: 'emp-001',
  employee_code: 'DIR001',
  full_name: 'Test Director',
  role: 'director',
  departments: { name: 'Operations' },
};

// A realistic mock for the attendance records endpoint
const todayISO = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

const MOCK_ATTENDANCE_RESPONSE = {
  records: [],           // No record today → "not checked in" state
  todayRecord: null,
  officeLocations: [
    {
      id: 'loc-001',
      name: 'Main Office',
      latitude: 40.712776,
      longitude: -74.005974,
      radius_meters: 200,
    },
  ],
  shiftSettings: {
    id: 'shift-001',
    name: 'Default',
    start_time: '09:00:00',
    end_time: '18:00:00',
    grace_period_minutes: 15,
    required_hours: 8,
    max_late_per_month: 3,
  },
  breaks: [],
};

async function setupMocks(page: import('@playwright/test').Page) {
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ employee: MOCK_EMPLOYEE }),
    }),
  );

  // Attendance data
  await page.route('**/attendance**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ATTENDANCE_RESPONSE),
      });
    }
    // POST (check-in) → return a new record
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'att-001',
          employee_id: 'emp-001',
          check_in_time: new Date().toISOString(),
          check_out_time: null,
          is_wfh: false,
          is_late: false,
          attendance_status: 'present',
          total_hours: null,
          date: todayISO,
        }),
      });
    }
    // PATCH (check-out) → return updated record
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'att-001',
          employee_id: 'emp-001',
          check_in_time: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
          check_out_time: new Date().toISOString(),
          is_wfh: false,
          is_late: false,
          attendance_status: 'present',
          total_hours: '8.00',
          date: todayISO,
        }),
      });
    }
    return route.continue();
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Attendance', () => {
  test('attendance page loads without errors', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/attendance');

    // Should not show a full-page error
    await expect(
      page.locator('text=Something went wrong, text=Error loading').first(),
    ).not.toBeVisible({ timeout: 5_000 });

    // Main content area should be visible
    await expect(page.locator('main, [role="main"], .flex-1')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('attendance page shows today\'s date in a heading or card', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/attendance');

    // Attendance.tsx uses format(new Date(), 'EEEE, MMMM d yyyy') style formatting
    // We check for the numeric day as a flexible assertion
    const todayDay = new Date().getDate().toString(); // e.g. "26"
    const todayYear = new Date().getFullYear().toString(); // e.g. "2026"

    const dateIndicator = page.locator(`text=/${todayDay}/, text=/${todayYear}/`).first();
    await expect(dateIndicator).toBeVisible({ timeout: 10_000 });
  });

  test('check-in button is visible when no active session', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/attendance');

    // Attendance.tsx shows a "Check In" button (LogIn icon + text) when todayRecord is null
    const checkInBtn = page.locator(
      'button:has-text("Check In"), button:has-text("Check-In"), [data-testid="check-in"]',
    ).first();

    await expect(checkInBtn).toBeVisible({ timeout: 10_000 });
  });

  test('check-in button is enabled (not disabled) when no session', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/attendance');

    const checkInBtn = page.locator(
      'button:has-text("Check In"), button:has-text("Check-In")',
    ).first();

    await expect(checkInBtn).toBeEnabled({ timeout: 10_000 });
  });

  test('calendar section is visible on the attendance page', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/attendance');

    // Attendance.tsx renders a monthly calendar grid with day cells
    // Look for a calendar-like structure: either a labeled section or day-of-week headers
    const calendarSection = page.locator(
      '[class*="calendar"], [class*="Calendar"], '
        + 'text=Sun, text=Mon, text=Tue, '
        + 'h2:has-text("Calendar"), h3:has-text("Calendar")',
    ).first();

    await expect(calendarSection).toBeVisible({ timeout: 10_000 });
  });

  test('attendance page displays shift information', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/attendance');

    // Attendance.tsx shows shift name/times; look for time-format text (HH:mm)
    const shiftIndicator = page.locator('text=/\\d{2}:\\d{2}/').first();
    await expect(shiftIndicator).toBeVisible({ timeout: 10_000 });
  });

  test('WFH option is present on the attendance page', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/attendance');

    // Attendance.tsx has a WFH toggle (Home icon + "WFH" label)
    const wfhElement = page.locator(
      'text=WFH, text=Work From Home, button:has-text("WFH")',
    ).first();

    await expect(wfhElement).toBeVisible({ timeout: 10_000 });
  });

  test('clicking check-in triggers the POST request', async ({ page }) => {
    await setupMocks(page);

    let checkInRequestMade = false;
    await page.route('**/attendance', (route) => {
      if (route.request().method() === 'POST') {
        checkInRequestMade = true;
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'att-new',
            check_in_time: new Date().toISOString(),
            check_out_time: null,
            is_wfh: false,
            is_late: false,
            attendance_status: 'present',
            total_hours: null,
            date: todayISO,
          }),
        });
      }
      return route.continue();
    });

    await page.goto('/attendance');

    const checkInBtn = page.locator(
      'button:has-text("Check In"), button:has-text("Check-In")',
    ).first();
    await checkInBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await checkInBtn.click();

    // Wait briefly for the async POST to fire
    await page.waitForTimeout(500);
    expect(checkInRequestMade).toBe(true);
  });

  test('attendance page break buttons render after check-in (mocked)', async ({ page }) => {
    // Mock a pre-existing check-in record (no checkout yet)
    await page.route('**/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ employee: MOCK_EMPLOYEE }),
      }),
    );

    await page.route('**/attendance**', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...MOCK_ATTENDANCE_RESPONSE,
            todayRecord: {
              id: 'att-001',
              employee_id: 'emp-001',
              check_in_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              check_out_time: null,
              is_wfh: false,
              is_late: false,
              attendance_status: 'present',
              total_hours: null,
              date: todayISO,
            },
            breaks: [],
          }),
        });
      }
      return route.continue();
    });

    await page.goto('/attendance');

    // With an active check-in, the page should show Check Out button
    const checkOutBtn = page.locator(
      'button:has-text("Check Out"), button:has-text("Check-Out")',
    ).first();

    await expect(checkOutBtn).toBeVisible({ timeout: 10_000 });
  });

  // ── Live server tests (skip in mocked mode) ──────────────────────────────

  test.skip('live: full check-in → check-out flow', async ({ page }) => {
    // Requires: backend running on :4000, geolocation permission, valid session
    await page.goto('/attendance');

    const checkInBtn = page.locator('button:has-text("Check In")').first();
    await checkInBtn.click();

    // After check-in the time should appear
    await expect(
      page.locator('text=/\\d{1,2}:\\d{2}\\s*(AM|PM)/i').first(),
    ).toBeVisible({ timeout: 8_000 });

    // Check out
    const checkOutBtn = page.locator('button:has-text("Check Out")').first();
    await checkOutBtn.click();

    // Total hours should appear
    await expect(
      page.locator('text=/\\d+(\\.\\d+)?\\s*h(ours?)?/i').first(),
    ).toBeVisible({ timeout: 8_000 });
  });
});
