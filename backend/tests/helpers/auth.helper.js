/**
 * Authentication helpers and employee fixtures for tests.
 *
 * makeToken(payload)     → signed JWT string
 * makeAuthHeader(payload) → { Authorization: 'Bearer <token>' }
 *
 * Fixture objects represent the minimal shape that src/middleware/auth.js
 * attaches to req.employee after a successful DB lookup.  They include all
 * fields that controllers and requireRole() actually read.
 */

const jwt = require('jsonwebtoken');

// ─── Token helpers ─────────────────────────────────────────────────────────

/**
 * Sign a JWT with the test secret.
 * @param {object} payload - Must contain at minimum { employeeId, role }.
 * @returns {string} Signed JWT.
 */
function makeToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
}

/**
 * Build an Authorization header object suitable for supertest's .set().
 * @param {object} payload - Forwarded to makeToken().
 * @returns {{ Authorization: string }}
 */
function makeAuthHeader(payload) {
  return { Authorization: `Bearer ${makeToken(payload)}` };
}

// ─── Employee fixtures ─────────────────────────────────────────────────────
// These match the shape that src/middleware/auth.js returns from its DB query:
//   SELECT e.*, d.name AS dept_name, d.slug AS dept_slug, t.name AS team_name
//   FROM employees e ...

/**
 * Director — has full LEADERSHIP + SENIOR_LEADERSHIP access.
 * Most privileged role; use this when testing endpoints that require leadership.
 */
const mockEmployee = {
  id:            'emp-director-001',
  employee_code: 'ARS20240001',
  full_name:     'Arjun Sharma',
  email:         'arjun.sharma@amoha.com',
  phone:         '9876543210',
  role:          'director',
  department_id: 'dept-001',
  team_id:       'team-001',
  designation:   'Director',
  dob:           '1985-06-15',
  joining_date:  '2020-01-01',
  is_active:     1,
  base_salary:   150000,
  pf_percentage: 12,
  professional_tax: 200,
  avatar_url:    null,
  password_hash: '$2a$12$hashedPasswordDirector',
  dept_name:     'Leadership',
  dept_slug:     'leadership',
  team_name:     'Executive',
  created_at:    '2020-01-01T00:00:00.000Z',
};

/**
 * Sales Executive — lowest-privilege role used to verify 403 guards on routes
 * that require LEADERSHIP or SENIOR_LEADERSHIP.
 */
const mockEmployee_sales = {
  id:            'emp-sales-002',
  employee_code: 'ARS20240002',
  full_name:     'Priya Mehta',
  email:         'priya.mehta@amoha.com',
  phone:         '9876543211',
  role:          'sales_executive',
  department_id: 'dept-002',
  team_id:       'team-002',
  designation:   'Sales Executive',
  dob:           '1995-03-20',
  joining_date:  '2023-06-01',
  is_active:     1,
  base_salary:   35000,
  pf_percentage: 12,
  professional_tax: 200,
  avatar_url:    null,
  password_hash: '$2a$12$hashedPasswordSales',
  dept_name:     'Sales',
  dept_slug:     'sales',
  team_name:     'Sales Team A',
  created_at:    '2023-06-01T00:00:00.000Z',
};

/**
 * HR Head — part of SENIOR_LEADERSHIP; can create employees and manage
 * salaries but is NOT in LEADERSHIP (director, ops_head).
 */
const mockEmployee_hr = {
  id:            'emp-hr-003',
  employee_code: 'ARS20240003',
  full_name:     'Neha Kapoor',
  email:         'neha.kapoor@amoha.com',
  phone:         '9876543212',
  role:          'hr_head',
  department_id: 'dept-003',
  team_id:       'team-003',
  designation:   'HR Head',
  dob:           '1988-11-05',
  joining_date:  '2021-04-01',
  is_active:     1,
  base_salary:   80000,
  pf_percentage: 12,
  professional_tax: 200,
  avatar_url:    null,
  password_hash: '$2a$12$hashedPasswordHR',
  dept_name:     'Human Resources',
  dept_slug:     'hr',
  team_name:     'HR Team',
  created_at:    '2021-04-01T00:00:00.000Z',
};

module.exports = {
  makeToken,
  makeAuthHeader,
  mockEmployee,
  mockEmployee_sales,
  mockEmployee_hr,
};
