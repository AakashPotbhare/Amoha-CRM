const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db     = require('../config/db');
const { ok, badRequest, serverError } = require('../utils/response');
const { sendPasswordResetEmail } = require('../services/email.service');

// Ensure password_reset_tokens table exists
async function ensureResetTokenTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          CHAR(36)     PRIMARY KEY,
      employee_id CHAR(36)     NOT NULL,
      token_hash  CHAR(64)     NOT NULL,
      expires_at  DATETIME     NOT NULL,
      used        TINYINT(1)   DEFAULT 0,
      created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_token_hash (token_hash),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )
  `);
}

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

// POST /api/auth/forgot-password  (public)
async function forgotPassword(req, res) {
  try {
    await ensureResetTokenTable();
    const { employee_code, email } = req.body;
    if (!employee_code && !email) {
      return badRequest(res, 'employee_code or email is required');
    }

    // Find employee — don't leak info if not found
    const condition = email ? 'LOWER(email) = LOWER(?)' : 'employee_code = ?';
    const value     = email ? email : employee_code.toUpperCase();
    const [[emp]]   = await db.query(
      `SELECT id, full_name, email, employee_code FROM employees WHERE ${condition} AND is_active = 1`,
      [value]
    );

    if (emp && emp.email) {
      // Generate token
      const rawToken  = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Invalidate any existing unused tokens for this employee
      await db.query(
        "UPDATE password_reset_tokens SET used = 1 WHERE employee_id = ? AND used = 0",
        [emp.id]
      );

      await db.query(
        `INSERT INTO password_reset_tokens (id, employee_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
        [uuidv4(), emp.id, tokenHash, expiresAt]
      );

      await sendPasswordResetEmail(emp, rawToken);
    }

    // Always return success — never reveal if account exists
    return ok(res, { message: "If that account exists, a reset link has been sent to the registered email." });
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/auth/verify-reset-token?token=  (public)
async function verifyResetToken(req, res) {
  try {
    await ensureResetTokenTable();
    const { token } = req.query;
    if (!token) return badRequest(res, 'Token is required');

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [[row]]   = await db.query(
      `SELECT prt.id, e.employee_code, e.full_name
       FROM password_reset_tokens prt
       JOIN employees e ON prt.employee_id = e.id
       WHERE prt.token_hash = ? AND prt.used = 0 AND prt.expires_at > NOW()`,
      [tokenHash]
    );

    if (!row) return ok(res, { valid: false });
    return ok(res, { valid: true, employee_code: row.employee_code, full_name: row.full_name });
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/auth/reset-password  (public)
async function resetPassword(req, res) {
  try {
    await ensureResetTokenTable();
    const { token, new_password } = req.body;
    if (!token || !new_password) return badRequest(res, 'token and new_password are required');
    if (new_password.length < 8)  return badRequest(res, 'Password must be at least 8 characters');

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [[row]]   = await db.query(
      `SELECT prt.id, prt.employee_id
       FROM password_reset_tokens prt
       WHERE prt.token_hash = ? AND prt.used = 0 AND prt.expires_at > NOW()`,
      [tokenHash]
    );

    if (!row) return badRequest(res, 'Invalid or expired reset token. Please request a new one.');

    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE employees SET password_hash = ? WHERE id = ?', [hash, row.employee_id]);
    await db.query('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [row.id]);

    return ok(res, { message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    return serverError(res, err);
  }
}

module.exports = { login, changePassword, me, forgotPassword, verifyResetToken, resetPassword };
