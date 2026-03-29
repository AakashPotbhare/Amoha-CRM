/**
 * GET /api/search?q=searchterm&type=all|candidates|employees&limit=10
 *
 * Global search across candidates and employees.
 * Requires authentication.
 */

const db = require('../config/db');
const { ok, badRequest, serverError } = require('../utils/response');

async function search(req, res) {
  try {
    const { q = '', type = 'all', limit: limitRaw } = req.query;

    const trimmed = q.trim();
    if (trimmed.length < 2) {
      return badRequest(res, 'Search query must be at least 2 characters.');
    }

    const limit = Math.min(parseInt(limitRaw, 10) || 8, 20);
    const like = `%${trimmed}%`;

    const candidates = [];
    const employees  = [];

    if (type === 'all' || type === 'candidates') {
      const [rows] = await db.query(
        `SELECT id, full_name, email, phone, current_domain, visa_status,
                pipeline_stage, marketing_status
         FROM candidate_enrollments
         WHERE (full_name LIKE ? OR email LIKE ? OR phone LIKE ?
                OR current_domain LIKE ? OR marketing_name LIKE ?)
           AND is_active = 1
         LIMIT ?`,
        [like, like, like, like, like, limit],
      );
      candidates.push(...rows);
    }

    if (type === 'all' || type === 'employees') {
      const [rows] = await db.query(
        `SELECT id, employee_code, full_name, email, phone, role, designation, department_id
         FROM employees
         WHERE (full_name LIKE ? OR employee_code LIKE ? OR email LIKE ? OR designation LIKE ?)
           AND is_active = 1
         LIMIT ?`,
        [like, like, like, like, limit],
      );
      employees.push(...rows);
    }

    return ok(res, {
      candidates,
      employees,
      total: candidates.length + employees.length,
    });
  } catch (err) {
    return serverError(res, err);
  }
}

module.exports = { search };
