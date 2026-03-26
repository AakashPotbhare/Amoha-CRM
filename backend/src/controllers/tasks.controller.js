const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { ok, created, notFound, badRequest, serverError } = require('../utils/response');
const { createNotification } = require('../services/notification.service');

const VALID_PRIORITY = ['low','medium','high'];
const VALID_STATUS   = ['pending','in_progress','completed','cancelled'];

// GET /api/tasks
async function list(req, res) {
  try {
    const { assigned_to, status, priority, page = 1, limit = 20 } = req.query;
    const emp = req.employee;

    const conditions = [];
    const params = [];

    // Leadership sees all; others see own tasks only
    const leadership = ['director','ops_head','hr_head'];
    if (!leadership.includes(emp.role)) {
      conditions.push('(t.assigned_to_employee_id = ? OR t.created_by_employee_id = ?)');
      params.push(emp.id, emp.id);
    }

    if (assigned_to) { conditions.push('t.assigned_to_employee_id = ?'); params.push(assigned_to); }
    if (status)      { conditions.push('t.status = ?');                  params.push(status); }
    if (priority)    { conditions.push('t.priority = ?');                params.push(priority); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM tasks t ${where}`, params
    );

    const [rows] = await db.query(
      `SELECT t.*,
              a.full_name AS assigned_to_name,
              c.full_name AS created_by_name
       FROM tasks t
       LEFT JOIN employees a ON t.assigned_to_employee_id = a.id
       LEFT JOIN employees c ON t.created_by_employee_id  = c.id
       ${where}
       ORDER BY t.due_date ASC, t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    return ok(res, rows, { total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/tasks/:id
async function getOne(req, res) {
  try {
    const [[task]] = await db.query(
      `SELECT t.*,
              a.full_name AS assigned_to_name,
              c.full_name AS created_by_name
       FROM tasks t
       LEFT JOIN employees a ON t.assigned_to_employee_id = a.id
       LEFT JOIN employees c ON t.created_by_employee_id  = c.id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!task) return notFound(res, 'Task not found');
    return ok(res, task);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/tasks
async function create(req, res) {
  try {
    const { title, description, assigned_to_employee_id, due_date, priority = 'medium' } = req.body;

    if (!title) return badRequest(res, 'title is required');
    if (!VALID_PRIORITY.includes(priority)) {
      return badRequest(res, `Invalid priority. Must be one of: ${VALID_PRIORITY.join(', ')}`);
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO tasks (id, title, description, assigned_to_employee_id, created_by_employee_id, due_date, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, title, description || null, assigned_to_employee_id || null, req.employee.id, due_date || null, priority]
    );

    const [[task]] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);

    // In-app notification — non-blocking
    if (assigned_to_employee_id) {
      createNotification(db, {
        recipient_id: assigned_to_employee_id,
        title: `New task assigned: ${title}`,
        body: description || null,
        type: 'info',
        entity_type: 'task',
        entity_id: id,
      });
    }

    return created(res, task);
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/tasks/:id/status
async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    if (!VALID_STATUS.includes(status)) {
      return badRequest(res, `Invalid status. Must be one of: ${VALID_STATUS.join(', ')}`);
    }
    await db.query('UPDATE tasks SET status = ? WHERE id = ?', [status, req.params.id]);
    return ok(res, { id: req.params.id, status });
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/tasks/:id
async function update(req, res) {
  try {
    const allowed = ['title','description','assigned_to_employee_id','due_date','priority'];
    const fields = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!fields.length) return badRequest(res, 'No valid fields to update');

    await db.query(
      `UPDATE tasks SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`,
      [...fields.map(f => req.body[f]), req.params.id]
    );

    const [[task]] = await db.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) return notFound(res, 'Task not found');
    return ok(res, task);
  } catch (err) {
    return serverError(res, err);
  }
}

module.exports = { list, getOne, create, updateStatus, update };
