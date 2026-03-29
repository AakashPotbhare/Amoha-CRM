const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { createNotification, notifyMany } = require('../services/notification.service');
const { sendLeaveStatusEmail } = require('../services/email.service');
const { ok, created, notFound, badRequest, serverError } = require('../utils/response');

const LEAVE_TYPES = ['paid', 'unpaid', 'sick', 'casual'];
const TL_ROLES = ['marketing_tl', 'sales_head', 'technical_head', 'resume_head', 'assistant_tl'];
const MGR_ROLES = ['ops_head', 'hr_head', 'director'];
const DEPT_HEAD_ROLE = {
  sales: 'sales_head',
  technical: 'technical_head',
  marketing: 'marketing_tl',
  resume: 'resume_head',
};

function formatLeaveWindow(fromDate, toDate) {
  return fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;
}

async function getLeaveRequestById(id) {
  const [[request]] = await db.query(
    `SELECT lr.*,
            e.employee_code,
            e.full_name AS employee_name,
            e.role AS employee_role,
            e.team_id,
            d.slug AS dept_slug,
            d.name AS department_name
     FROM leave_requests lr
     JOIN employees e ON lr.employee_id = e.id
     LEFT JOIN departments d ON e.department_id = d.id
     WHERE lr.id = ?`,
    [id]
  );

  return request;
}

async function getManagementApprovers(excludeEmployeeId) {
  const [rows] = await db.query(
    `SELECT id, full_name, role
     FROM employees
     WHERE is_active = 1
       AND role IN (?)
       AND id <> ?`,
    [MGR_ROLES, excludeEmployeeId]
  );

  return rows;
}

async function getTlApproversForEmployee(employee) {
  if (!employee || [...TL_ROLES, ...MGR_ROLES].includes(employee.role)) {
    return [];
  }

  const [sameTeamRows] = await db.query(
    `SELECT id, full_name, role
     FROM employees
     WHERE is_active = 1
       AND id <> ?
       AND team_id = ?
       AND role IN (?)`,
    [employee.id, employee.team_id, TL_ROLES]
  );
  if (sameTeamRows.length) {
    return sameTeamRows;
  }

  const preferredRole = DEPT_HEAD_ROLE[employee.dept_slug];
  if (preferredRole) {
    const [preferredRows] = await db.query(
      `SELECT id, full_name, role
       FROM employees
       WHERE is_active = 1
         AND id <> ?
         AND department_id = ?
         AND role = ?`,
      [employee.id, employee.department_id, preferredRole]
    );
    if (preferredRows.length) {
      return preferredRows;
    }
  }

  const [departmentRows] = await db.query(
    `SELECT id, full_name, role
     FROM employees
     WHERE is_active = 1
       AND id <> ?
       AND department_id = ?
       AND role IN (?)`,
    [employee.id, employee.department_id, TL_ROLES]
  );

  return departmentRows;
}

async function getLeaveApprovers(employee) {
  const [tlApprovers, managementApprovers] = await Promise.all([
    getTlApproversForEmployee(employee),
    getManagementApprovers(employee.id),
  ]);

  const uniqueRecipients = [...new Map(
    [...tlApprovers, ...managementApprovers].map(approver => [approver.id, approver])
  ).values()];

  return { tlApprovers, managementApprovers, uniqueRecipients };
}

// GET /api/leaves
async function list(req, res) {
  try {
    const { status, employee_id, page = 1, limit = 20 } = req.query;
    const emp = req.employee;

    const conditions = [];
    const params = [];

    if (MGR_ROLES.includes(emp.role)) {
      // Leadership can see all leave requests.
    } else if (TL_ROLES.includes(emp.role)) {
      conditions.push('lr.department_id = ?');
      params.push(emp.department_id);
    } else {
      conditions.push('lr.employee_id = ?');
      params.push(emp.id);
    }

    if (status) {
      conditions.push('lr.status = ?');
      params.push(status);
    }
    if (employee_id) {
      conditions.push('lr.employee_id = ?');
      params.push(employee_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM leave_requests lr ${where}`,
      params
    );

    const [rows] = await db.query(
      `SELECT lr.*,
              e.full_name AS employee_name,
              e.employee_code,
              tl.full_name AS tl_approved_by_name,
              mgr.full_name AS manager_approved_by_name
       FROM leave_requests lr
       LEFT JOIN employees e ON lr.employee_id = e.id
       LEFT JOIN employees tl ON lr.approved_by_tl = tl.id
       LEFT JOIN employees mgr ON lr.approved_by_manager = mgr.id
       ${where}
       ORDER BY lr.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );

    return ok(res, rows, { total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/leaves
async function submit(req, res) {
  try {
    const { leave_type, from_date, to_date, reason } = req.body;

    if (!leave_type || !from_date || !to_date) {
      return badRequest(res, 'leave_type, from_date, and to_date are required');
    }
    if (!LEAVE_TYPES.includes(leave_type)) {
      return badRequest(res, `Invalid leave_type. Must be one of: ${LEAVE_TYPES.join(', ')}`);
    }
    if (new Date(from_date) > new Date(to_date)) {
      return badRequest(res, 'from_date must be before or equal to to_date');
    }

    const from = new Date(from_date);
    const to = new Date(to_date);
    const total_days = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;

    const id = uuidv4();
    await db.query(
      `INSERT INTO leave_requests
         (id, employee_id, department_id, leave_type, from_date, to_date, total_days, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, req.employee.id, req.employee.department_id, leave_type, from_date, to_date, total_days, reason || null]
    );

    const request = await getLeaveRequestById(id);
    const approvers = await getLeaveApprovers(req.employee);
    const leaveWindow = formatLeaveWindow(from_date, to_date);

    await notifyMany(db, approvers.uniqueRecipients.map(approver => approver.id), {
      title: `Leave request from ${req.employee.full_name}`,
      body: `${leave_type} leave requested for ${leaveWindow}${reason ? ` - ${reason}` : ''}`,
      type: 'warning',
      entity_type: 'leave_request',
      entity_id: id,
    });

    return created(res, request);
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/leaves/pending-tl
async function pendingForTL(req, res) {
  try {
    if (!TL_ROLES.includes(req.employee.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const [rows] = await db.query(
      `SELECT lr.*,
              e.full_name AS employee_name,
              e.employee_code,
              e.role AS employee_role,
              e.team_id,
              d.slug AS dept_slug
       FROM leave_requests lr
       JOIN employees e ON lr.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE lr.department_id = ?
         AND lr.status = 'pending'
         AND lr.approved_by_tl IS NULL
       ORDER BY lr.created_at ASC`,
      [req.employee.department_id]
    );

    const approvableRows = [];
    for (const row of rows) {
      const approvers = await getTlApproversForEmployee({
        id: row.employee_id,
        role: row.employee_role,
        team_id: row.team_id,
        department_id: row.department_id,
        dept_slug: row.dept_slug,
      });

      if (approvers.some(approver => approver.id === req.employee.id)) {
        approvableRows.push(row);
      }
    }

    return ok(res, approvableRows);
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/leaves/pending-manager
async function pendingForManager(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT lr.*,
              e.full_name AS employee_name,
              e.employee_code,
              tl.full_name AS tl_approved_by_name
       FROM leave_requests lr
       LEFT JOIN employees e ON lr.employee_id = e.id
       LEFT JOIN employees tl ON lr.approved_by_tl = tl.id
       WHERE lr.status IN ('pending', 'tl_approved')
       ORDER BY FIELD(lr.status, 'pending', 'tl_approved'), lr.created_at ASC`
    );

    return ok(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/leaves/:id/approve-tl
async function approveByTL(req, res) {
  try {
    const request = await getLeaveRequestById(req.params.id);
    if (!request) return notFound(res, 'Leave request not found');
    if (request.status !== 'pending') {
      return badRequest(res, `Cannot approve: request is already ${request.status}`);
    }

    const approvers = await getTlApproversForEmployee({
      id: request.employee_id,
      role: request.employee_role,
      team_id: request.team_id,
      department_id: request.department_id,
      dept_slug: request.dept_slug,
    });

    if (!approvers.some(approver => approver.id === req.employee.id)) {
      return badRequest(res, 'You are not the mapped TL/manager for this leave request');
    }

    await db.query(
      `UPDATE leave_requests
       SET status = 'tl_approved',
           approved_by_tl = ?,
           tl_approved_at = NOW()
       WHERE id = ?`,
      [req.employee.id, req.params.id]
    );

    const managers = await getManagementApprovers(request.employee_id);
    const leaveWindow = formatLeaveWindow(request.from_date, request.to_date);

    await Promise.all([
      createNotification(db, {
        recipient_id: request.employee_id,
        title: 'Leave approved by TL',
        body: `${req.employee.full_name} approved your ${request.leave_type} leave for ${leaveWindow}`,
        type: 'success',
        entity_type: 'leave_request',
        entity_id: req.params.id,
      }),
      notifyMany(db, managers.map(manager => manager.id), {
        title: `TL approved leave for ${request.employee_name}`,
        body: `${request.leave_type} leave for ${leaveWindow} is ready for final approval`,
        type: 'info',
        entity_type: 'leave_request',
        entity_id: req.params.id,
      }),
    ]);

    return ok(res, { id: req.params.id, status: 'tl_approved' });
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/leaves/:id/approve-manager
async function approveByManager(req, res) {
  try {
    const request = await getLeaveRequestById(req.params.id);
    if (!request) return notFound(res, 'Leave request not found');
    if (!['pending', 'tl_approved'].includes(request.status)) {
      return badRequest(res, `Cannot approve: request is already ${request.status}`);
    }

    await db.query(
      `UPDATE leave_requests
       SET status = 'approved',
           approved_by_manager = ?,
           manager_approved_at = NOW()
       WHERE id = ?`,
      [req.employee.id, req.params.id]
    );

    const leaveWindow = formatLeaveWindow(request.from_date, request.to_date);
    await createNotification(db, {
      recipient_id: request.employee_id,
      title: 'Leave approved',
      body: `${req.employee.full_name} approved your ${request.leave_type} leave for ${leaveWindow}`,
      type: 'success',
      entity_type: 'leave_request',
      entity_id: req.params.id,
    });

    // Send email notification
    const [[requester]] = await db.query('SELECT email, full_name FROM employees WHERE id = ?', [request.employee_id]);
    if (requester) {
      await sendLeaveStatusEmail(requester.email, requester.full_name, request, 'approved');
    }

    return ok(res, { id: req.params.id, status: 'approved' });
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/leaves/:id/reject
async function reject(req, res) {
  try {
    const { reason } = req.body;
    const request = await getLeaveRequestById(req.params.id);
    if (!request) return notFound(res, 'Leave request not found');
    if (['approved', 'rejected'].includes(request.status)) {
      return badRequest(res, `Cannot reject: request is already ${request.status}`);
    }

    await db.query(
      `UPDATE leave_requests
       SET status = 'rejected',
           rejection_reason = ?
       WHERE id = ?`,
      [reason || null, req.params.id]
    );

    const leaveWindow = formatLeaveWindow(request.from_date, request.to_date);
    await createNotification(db, {
      recipient_id: request.employee_id,
      title: 'Leave rejected',
      body: `${req.employee.full_name} rejected your ${request.leave_type} leave for ${leaveWindow}${reason ? ` - ${reason}` : ''}`,
      type: 'error',
      entity_type: 'leave_request',
      entity_id: req.params.id,
    });

    // Send email notification
    const [[requester]] = await db.query('SELECT email, full_name FROM employees WHERE id = ?', [request.employee_id]);
    if (requester) {
      await sendLeaveStatusEmail(requester.email, requester.full_name, request, 'rejected', reason);
    }

    return ok(res, { id: req.params.id, status: 'rejected' });
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/leaves/:id
async function update(req, res) {
  try {
    const { id } = req.params;
    const empId = req.employee.id;
    const [rows] = await db.query(
      'SELECT * FROM leave_requests WHERE id = ? AND employee_id = ? AND status = "pending"',
      [id, empId]
    );
    if (!rows.length) return res.status(403).json({ error: 'Cannot edit this leave request' });

    const allowed = ['leave_type', 'from_date', 'to_date', 'total_days', 'reason'];
    const sets = [];
    const vals = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = ?`);
        vals.push(req.body[key]);
      }
    }

    if (!sets.length) return res.status(400).json({ error: 'No valid fields' });

    vals.push(id);
    await db.query(`UPDATE leave_requests SET ${sets.join(', ')} WHERE id = ?`, vals);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/leaves/:id
async function remove(req, res) {
  try {
    const { id } = req.params;
    const empId = req.employee.id;
    const isAdmin = ['director', 'hr_head', 'hr'].includes(req.employee.role);
    const whereClause = isAdmin
      ? 'id = ?'
      : 'id = ? AND employee_id = ? AND status = "pending"';
    const whereVals = isAdmin ? [id] : [id, empId];

    const [rows] = await db.query(`SELECT id FROM leave_requests WHERE ${whereClause}`, whereVals);
    if (!rows.length) return res.status(403).json({ error: 'Cannot delete this leave request' });

    await db.query('DELETE FROM leave_requests WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Leave request deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  list,
  submit,
  pendingForTL,
  pendingForManager,
  approveByTL,
  approveByManager,
  reject,
  update,
  remove,
};
