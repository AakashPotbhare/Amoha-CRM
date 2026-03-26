const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');
const { ok, badRequest, serverError } = require('../utils/response');

function signToken(employee) {
  return jwt.sign(
    { employeeId: employee.id, role: employee.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function safeEmployee(emp) {
  const { password_hash, ...safe } = emp;
  return {
    ...safe,
    departments: { name: emp.dept_name, slug: emp.dept_slug },
    teams:       { name: emp.team_name },
  };
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { employeeCode, password } = req.body;
    if (!employeeCode || !password) {
      return badRequest(res, 'Employee code and password are required');
    }

    const [[emp]] = await db.query(
      `SELECT e.*, d.name AS dept_name, d.slug AS dept_slug, t.name AS team_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN teams       t ON e.team_id = t.id
       WHERE e.employee_code = ? AND e.is_active = 1`,
      [employeeCode.toUpperCase()]
    );

    if (!emp) {
      return badRequest(res, 'Invalid employee code. Please check and try again.');
    }

    const match = await bcrypt.compare(password, emp.password_hash);
    if (!match) {
      return badRequest(res, 'Invalid credentials. Please check your password.');
    }

    const token    = signToken(emp);
    const employee = safeEmployee(emp);

    return ok(res, { token, employee });
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/auth/change-password
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const empId = req.employee.id;

    const [[emp]] = await db.query(
      'SELECT password_hash FROM employees WHERE id = ?', [empId]
    );
    const match = await bcrypt.compare(currentPassword, emp.password_hash);
    if (!match) {
      return badRequest(res, 'Current password is incorrect');
    }

    if (newPassword.length < 8) {
      return badRequest(res, 'New password must be at least 8 characters');
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE employees SET password_hash = ? WHERE id = ?', [hash, empId]);

    return ok(res, { message: 'Password changed successfully' });
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/auth/me
async function me(req, res) {
  try {
    return ok(res, safeEmployee(req.employee));
  } catch (err) {
    return serverError(res, err);
  }
}

module.exports = { login, changePassword, me };
