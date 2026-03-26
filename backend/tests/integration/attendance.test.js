/**
 * Integration tests — Attendance (/api/attendance)
 *
 * All routes require authentication (router.use(authenticate)).
 * Only GET /api/attendance/report is additionally restricted:
 *   requireRole(SENIOR_LEADERSHIP) → director, ops_head, hr_head
 *
 * mockEmployee         → director  (has SENIOR_LEADERSHIP access)
 * mockEmployee_sales   → sales_executive (no SENIOR_LEADERSHIP access)
 *
 * Auth middleware makes one db.query per request to hydrate req.employee.
 * Each authenticated test must call seedAuth() first.
 *
 * Attendance controller logic:
 *   checkIn:   checks for an open record (check_out_time IS NULL), then INSERTs
 *   checkOut:  finds the open record, then UPDATEs
 *   today:     one SELECT for the record, then one for breaks
 *   report:    one SELECT (mode depends on query params)
 */

jest.mock('../../src/config/db', () => {
  const { mockDb } = require('../helpers/db.mock');
  return mockDb;
});
jest.mock('../../src/services/paymentReminder.service', () => ({
  startPaymentReminderScheduler: jest.fn(),
  checkPaymentReminders: jest.fn(),
}));

const request = require('supertest');
const app = require('../../src/app');
const { mockDb, resetMockDb } = require('../helpers/db.mock');
const {
  makeAuthHeader,
  mockEmployee,
  mockEmployee_sales,
} = require('../helpers/auth.helper');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);

const mockAttendanceRecord = {
  id: 'att-001',
  employee_id: mockEmployee.id,
  date: today,
  check_in_time: `${today} 09:00:00`,
  check_out_time: null,
  check_in_lat: null,
  check_in_lng: null,
  check_out_lat: null,
  check_out_lng: null,
  total_hours: null,
  attendance_status: 'present',
  is_wfh: 0,
  is_late: 0,
};

const mockCheckedOutRecord = {
  ...mockAttendanceRecord,
  check_out_time: `${today} 18:00:00`,
  total_hours: 9.0,
};

const mockReportRow = {
  employee_id: mockEmployee.id,
  employee_code: mockEmployee.employee_code,
  full_name: mockEmployee.full_name,
  designation: mockEmployee.designation,
  department_name: mockEmployee.dept_name,
  team_name: mockEmployee.team_name,
  base_salary: mockEmployee.base_salary,
  pf_percentage: mockEmployee.pf_percentage,
  professional_tax: mockEmployee.professional_tax,
  total_days: 22,
  present: 20,
  half_day: 1,
  late: 1,
  absent: 0,
  wfh: 5,
  total_hours: 176.5,
};

// ─── Seed auth middleware ─────────────────────────────────────────────────────

function seedAuth(emp = mockEmployee) {
  mockDb.query.mockResolvedValueOnce([[emp]]);
}

// ─── GET /api/attendance/today ────────────────────────────────────────────────

describe('GET /api/attendance/today', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/api/attendance/today');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 200 with { record: null, breaks: [] } when no record exists today', async () => {
    seedAuth();
    // SELECT attendance_records — no record
    mockDb.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .get('/api/attendance/today')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.record).toBeNull();
    expect(Array.isArray(res.body.data.breaks)).toBe(true);
    expect(res.body.data.breaks).toHaveLength(0);
  });

  it('returns 200 with today\'s attendance record and breaks when checked in', async () => {
    seedAuth();
    // SELECT attendance record — found
    mockDb.query.mockResolvedValueOnce([[mockAttendanceRecord]]);
    // SELECT breaks
    mockDb.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .get('/api/attendance/today')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.record).not.toBeNull();
    expect(res.body.data.record.id).toBe('att-001');
    expect(res.body.data.record.employee_id).toBe(mockEmployee.id);
    expect(res.body.data.record.check_out_time).toBeNull();
    expect(Array.isArray(res.body.data.breaks)).toBe(true);
  });
});

// ─── POST /api/attendance/check-in ───────────────────────────────────────────

describe('POST /api/attendance/check-in', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).post('/api/attendance/check-in').send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when employee is already checked in today', async () => {
    seedAuth();
    // Open record query — returns existing open record
    mockDb.query.mockResolvedValueOnce([[{ id: 'att-001' }]]);

    const res = await request(app)
      .post('/api/attendance/check-in')
      .set(makeAuthHeader(mockEmployee))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/already checked in/i);
  });

  it('returns 201 with the attendance record on successful check-in', async () => {
    seedAuth();
    // Open record query — no existing record
    mockDb.query.mockResolvedValueOnce([[]]);
    // INSERT
    mockDb.query.mockResolvedValueOnce([{ insertId: 0 }]);
    // SELECT new record
    mockDb.query.mockResolvedValueOnce([[mockAttendanceRecord]]);

    const res = await request(app)
      .post('/api/attendance/check-in')
      .set(makeAuthHeader(mockEmployee))
      .send({ is_wfh: false });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('att-001');
    expect(res.body.data.employee_id).toBe(mockEmployee.id);
    expect(res.body.data.check_out_time).toBeNull();
    expect(res.body.data.date).toBe(today);
  });
});

// ─── POST /api/attendance/check-out ──────────────────────────────────────────

describe('POST /api/attendance/check-out', () => {
  beforeEach(() => resetMockDb());

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).post('/api/attendance/check-out').send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when no active check-in exists for today', async () => {
    seedAuth();
    // Open record query — no active check-in
    mockDb.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/attendance/check-out')
      .set(makeAuthHeader(mockEmployee))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/no active check-in/i);
  });

  it('returns 200 with the updated record on successful check-out', async () => {
    seedAuth();
    // Open record query — active check-in found
    mockDb.query.mockResolvedValueOnce([[{ id: 'att-001' }]]);
    // UPDATE
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    // SELECT updated record
    mockDb.query.mockResolvedValueOnce([[mockCheckedOutRecord]]);

    const res = await request(app)
      .post('/api/attendance/check-out')
      .set(makeAuthHeader(mockEmployee))
      .send({ total_hours: 9.0, attendance_status: 'present' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('att-001');
    expect(res.body.data.check_out_time).toBe(`${today} 18:00:00`);
    expect(res.body.data.total_hours).toBe(9.0);
  });
});

// ─── GET /api/attendance/report ───────────────────────────────────────────────

describe('GET /api/attendance/report', () => {
  beforeEach(() => resetMockDb());

  it('returns 403 for a sales_executive (not in SENIOR_LEADERSHIP)', async () => {
    seedAuth(mockEmployee_sales);

    const res = await request(app)
      .get('/api/attendance/report?month=3&year=2026')
      .set(makeAuthHeader(mockEmployee_sales));

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/insufficient permissions/i);
  });

  it('returns 200 with a monthly payroll aggregate for director', async () => {
    seedAuth();
    // Monthly aggregate query
    mockDb.query.mockResolvedValueOnce([[mockReportRow]]);

    const res = await request(app)
      .get('/api/attendance/report?month=3&year=2026')
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].employee_id).toBe(mockEmployee.id);
    expect(res.body.data[0].total_days).toBe(22);
    expect(res.body.data[0].present).toBe(20);
    expect(res.body.data[0].total_hours).toBe(176.5);
  });

  it('returns 200 with raw attendance records when date range is provided', async () => {
    seedAuth();
    const rawRecord = {
      ...mockAttendanceRecord,
      employee_name: mockEmployee.full_name,
      department_name: mockEmployee.dept_name,
      check_out_time: `${today} 18:00:00`,
    };
    // Raw records query
    mockDb.query.mockResolvedValueOnce([[rawRecord]]);

    const res = await request(app)
      .get(`/api/attendance/report?date_from=${today}&date_to=${today}`)
      .set(makeAuthHeader(mockEmployee));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].employee_id).toBe(mockEmployee.id);
    expect(res.body.data[0].employee_name).toBe(mockEmployee.full_name);
  });
});
