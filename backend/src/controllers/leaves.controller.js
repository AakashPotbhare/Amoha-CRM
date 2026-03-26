const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { ok, created, notFound, badRequest, serverError } = require('../utils/response');

const LEAVE_TYPES = ['paid','unpaid','sick','casual'];
const TL_ROLES    = ['marketing_tl','sales_head','technical_head','resume_head','assistant_tl'];
const MGR_ROLES   = ['ops_head','hr_head','director'];

// GET /api/leaves
async function list(req, res) {
  try {
    const { status, employee_id, page = 1, limit = 20 } = req.query;
    const emp = req.employee;

    const conditions = [];
    const params = [];

    // Scope: regular staff see own; TLs see their department; leadership sees all
    if (MGR_ROLES.includes(emp.role)) {
      // See all
    } else if (TL_ROLES.includes(emp.role)) {
      conditions.push('lr.department_id = ?');
      params.push(emp.department_id);
    } else {
      conditions.push('lr.employee_id = ?');
      params.push(emp.id);
    }

    if (status)      { conditions.push('lr.status = ?');      params.push(status); }
    if (employee_id) { conditions.push('lr.employee_id = ?'); params.push(employee_id); }

    const where  = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM leave_requests lr ${where}`, params
    );

    const [rows] = await db.query(
      `SELECT lr.*,
              e.full_name    AS employee_name,
              tl.full_name   AS tl_approved_by_name,
              mgr.full_name  AS manager_approved_by_name
       FROM leave_requests lr
       LEFT JOIN employees e   ON lr.employee_id         = e.id
       LEFT JOIN employees tl  ON lr.approved_by_tl      = tl.id
       LEFT JOIN employees mgr ON lr.approved_by_manager = mgr.id
       ${where}
       ORDER BY lr.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    return ok(res, rows, { total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/leaves
async function submit(req, res) {
  try {
    const { leave_type, from_date, to_date, reason } = req.body;

    if (!leave_type || !from_date || !to_date || !reason) {
      return badRequest(res, 'leave_type, from_date, to_date, and reason are required');
    }
    if (!LEAVE_TYPES.includes(leave_type)) {
      return badRequest(res, `Invalid leave_type. Must be one of: ${LEAVE_TYPES.join(', ')}`);
    }
    if (new Date(from_date) > new Date(to_date)) {
      return badRequest(res, 'from_date must be before or equal to to_date');
    }

    const from = new Date(from_date);
    const to   = new Date(to_date);
    const total_days = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;

    const id = uuidv4();
    await db.query(
      `INSERT INTO leave_requests
         (id, employee_id, department_id, leave_type, from_date, to_date, total_days, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, req.employee.id, req.employee.department_id, leave_type, from_date, to_date, total_days, reason]
    );

    const [[request]] = await db.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
    return created(res, request);
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/leaves/pending-tl — for TL-level approvers
async function pendingForTL(req, res) {
  try {
    const emp = req.employee;
    if (!TL_ROLES.includes(emp.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const [rows] = await db.query(
      `SELECT lr.*, e.full_name AS employee_name
       FROM leave_requests lr
       LEFT JOIN employees e ON lr.employee_id = e.id
       WHERE lr.department_id = ? AND lr.status = 'pending' AND lr.approved_by_tl IS NULL
       ORDER BY lr.created_at ASC`,
      [emp.department_id]
    );
    return ok(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/leaves/pending-manager — for ops_head / hr_head / director
async function pendingForManager(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT lr.*, e.full_name AS employee_name, tl.full_name AS tl_approved_by_name
       FROM leave_requests lr
       LEFT JOIN employees e  ON lr.employee_id    = e.id
       LEFT JOIN employees tl ON lr.approved_by_tl = tl.id
       WHERE lr.status = 'tl_approved'
       ORDER BY lr.created_at ASC`
    );
    return ok(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/leaves/:id/approve-tl
async function approveByTL(req, res) {
  try {
    const [[request]] = await db.query(
      'SELECT * FROM leave_requests WHERE id = ?', [req.params.id]
    );
    if (!request) return notFound(res, 'Leave request not found');
    if (request.status !== 'pending') {
      return badRequest(res, `Cannot approve: request is already ${request.status}`);
    }

    await db.query(
      `UPDATE leave_requests SET status = 'tl_approved', approved_by_tl = ?, tl_approved_at = NOW() WHERE id = ?`,
      [req.employee.id, req.params.id]
    );
    return ok(res, { id: req.params.id, status: 'tl_approved' });
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/leaves/:id/approve-manager
async function approveByManager(req, res) {
  try {
    const [[request]] = await db.query(
      'SELECT * FROM leave_requests WHERE id = ?', [req.params.id]
    );
    if (!request) return notFound(res, 'Leave request not found');
    if (!['pending','tl_approved'].includes(request.status)) {
      return badRequest(res, `Cannot approve: request is already ${request.status}`);
    }

    await db.query(
      `UPDATE leave_requests SET status = 'approved', approved_by_manager = ?, manager_approved_at = NOW() WHERE id = ?`,
      [req.employee.id, req.params.id]
    );
    return ok(res, { id: req.params.id, status: 'approved' });
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/leaves/:id/reject
async function reject(req, res) {
  try {
    const { reason } = req.body;
    const [[request]] = await db.query(
      'SELECT * FROM leave_requests WHERE id = ?', [req.params.id]
    );
    if (!request) return notFound(res, 'Leave request not found');
    if (['approved','rejected'].includes(request.status)) {
      return badRequest(res, `Cannot reject: request is already ${request.status}`);
    }

    await db.query(
      `UPDATE leave_requests SET status = 'rejected', rejection_reason = ? WHERE id = ?`,
      [reason || null, req.params.id]
    );
    return ok(res, { id: req.params.id, status: 'rejected' });
  } catch (err) {
    return serverError(res, err);
  }
}

module.exports = { list, submit, pendingForTL, pendingForManager, approveByTL, approveByManager, reject };
