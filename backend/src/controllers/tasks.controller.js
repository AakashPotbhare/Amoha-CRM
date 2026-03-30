const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { ok, created, notFound, badRequest, serverError } = require('../utils/response');
const { createNotification } = require('../services/notification.service');

const VALID_PRIORITY = ['low', 'medium', 'high'];
const VALID_STATUS = ['pending', 'in_progress', 'completed', 'cancelled'];
const CHANGE_ACTIONS = ['update', 'delete'];
const CHANGE_STATUSES = ['pending', 'approved', 'rejected'];
const APPROVER_ROLES = ['ops_head', 'hr_head', 'sales_head', 'technical_head', 'marketing_tl', 'resume_head', 'assistant_tl'];
const DEPT_HEAD_ROLE = {
  sales: 'sales_head',
  technical: 'technical_head',
  marketing: 'marketing_tl',
  resume: 'resume_head',
};

let ensureTaskInfrastructurePromise = null;

async function ensureTaskColumn(tableName, columnName, definitionSql) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );

  if (!row?.cnt) {
    await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${definitionSql}`);
  }
}

async function ensureTaskInfrastructure() {
  if (!ensureTaskInfrastructurePromise) {
    ensureTaskInfrastructurePromise = Promise.all([
      db.query(`
        CREATE TABLE IF NOT EXISTS task_change_requests (
          id                        CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
          task_id                   CHAR(36) NOT NULL,
          requested_by_employee_id  CHAR(36) NOT NULL,
          approver_employee_id      CHAR(36) NOT NULL,
          action                    ENUM('update', 'delete') NOT NULL,
          requested_changes         JSON NULL,
          reason                    TEXT NULL,
          status                    ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
          review_note               TEXT NULL,
          reviewed_by_employee_id   CHAR(36) NULL,
          created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          reviewed_at               DATETIME NULL,
          applied_at                DATETIME NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (requested_by_employee_id) REFERENCES employees(id) ON DELETE CASCADE,
          FOREIGN KEY (approver_employee_id) REFERENCES employees(id) ON DELETE CASCADE,
          FOREIGN KEY (reviewed_by_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
          INDEX idx_task_change_approver (approver_employee_id, status, created_at),
          INDEX idx_task_change_requester (requested_by_employee_id, created_at)
        )
      `),
      ensureTaskColumn('tasks', 'is_edited', 'is_edited BOOLEAN NOT NULL DEFAULT FALSE'),
      ensureTaskColumn('tasks', 'edited_at', 'edited_at DATETIME NULL'),
    ]).catch((err) => {
      ensureTaskInfrastructurePromise = null;
      throw err;
    });
  }

  return ensureTaskInfrastructurePromise;
}

async function getTaskById(id) {
  const [[task]] = await db.query(
    `SELECT t.*,
            a.full_name AS assigned_to_name,
            c.full_name AS created_by_name,
            d.name AS assigned_department_name,
            tm.name AS assigned_team_name
     FROM tasks t
     LEFT JOIN employees a ON t.assigned_to_employee_id = a.id
     LEFT JOIN employees c ON t.created_by_employee_id = c.id
     LEFT JOIN departments d ON t.assigned_to_department_id = d.id
     LEFT JOIN teams tm ON t.assigned_to_team_id = tm.id
     WHERE t.id = ?`,
    [id]
  );

  return task;
}

async function getReportingManagerForEmployee(employee) {
  if (!employee || employee.role === 'director') {
    return null;
  }

  if (['ops_head', 'hr_head', 'sales_head', 'technical_head', 'marketing_tl', 'resume_head'].includes(employee.role)) {
    const [[opsHead]] = await db.query(
      `SELECT id, full_name, role
       FROM employees
       WHERE is_active = 1
         AND role = 'ops_head'
         AND id <> ?
       LIMIT 1`,
      [employee.id]
    );
    return opsHead || null;
  }

  if (employee.team_id) {
    const [sameTeamRows] = await db.query(
      `SELECT e.id, e.full_name, e.role
       FROM employees e
       WHERE e.is_active = 1
         AND e.id <> ?
         AND e.team_id = ?
         AND e.role IN (?)`,
      [employee.id, employee.team_id, APPROVER_ROLES]
    );

    if (sameTeamRows.length) {
      return sameTeamRows[0];
    }
  }

  const preferredRole = DEPT_HEAD_ROLE[employee.dept_slug];
  if (preferredRole) {
    const [[deptHead]] = await db.query(
      `SELECT e.id, e.full_name, e.role
       FROM employees e
       WHERE e.is_active = 1
         AND e.id <> ?
         AND e.department_id = ?
         AND e.role = ?
       LIMIT 1`,
      [employee.id, employee.department_id, preferredRole]
    );

    if (deptHead) {
      return deptHead;
    }
  }

  const [departmentRows] = await db.query(
    `SELECT e.id, e.full_name, e.role
     FROM employees e
     WHERE e.is_active = 1
       AND e.id <> ?
       AND e.department_id = ?
       AND e.role IN (?)`,
    [employee.id, employee.department_id, APPROVER_ROLES]
  );

  return departmentRows[0] || null;
}

async function createChangeRequestRecord(task, requester, action, requestedChanges, reason) {
  const approver = await getReportingManagerForEmployee(requester);
  if (!approver) {
    throw new Error('No reporting manager is mapped for this employee');
  }

  const [[existingPending]] = await db.query(
    `SELECT id
     FROM task_change_requests
     WHERE task_id = ?
       AND requested_by_employee_id = ?
       AND status = 'pending'
     LIMIT 1`,
    [task.id, requester.id]
  );

  if (existingPending) {
    throw new Error('A change approval request for this task is already pending');
  }

  const requestId = uuidv4();
  await db.query(
    `INSERT INTO task_change_requests
       (id, task_id, requested_by_employee_id, approver_employee_id, action, requested_changes, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      requestId,
      task.id,
      requester.id,
      approver.id,
      action,
      requestedChanges ? JSON.stringify(requestedChanges) : null,
      reason || null,
    ]
  );

  await createNotification(db, {
    recipient_id: approver.id,
    title: `Task ${action} approval needed`,
    body: `${requester.full_name} requested to ${action} "${task.title}"`,
    type: 'warning',
    entity_type: 'task',
    entity_id: task.id,
  });

  return requestId;
}

function parseRequestedChanges(rawValue) {
  if (!rawValue) return null;
  if (typeof rawValue === 'object') return rawValue;
  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

// GET /api/tasks
async function list(req, res) {
  try {
    await ensureTaskInfrastructure();

    const { assigned_to, created_by, status, priority, page = 1, limit = 20 } = req.query;
    const emp = req.employee;

    const conditions = [];
    const params = [];

    const leadership = ['director', 'ops_head', 'hr_head'];
    if (!leadership.includes(emp.role)) {
      conditions.push('(t.assigned_to_employee_id = ? OR t.created_by_employee_id = ?)');
      params.push(emp.id, emp.id);
    }

    if (assigned_to) {
      conditions.push('t.assigned_to_employee_id = ?');
      params.push(assigned_to);
    }
    if (created_by) {
      conditions.push('t.created_by_employee_id = ?');
      params.push(created_by);
    }
    if (status) {
      conditions.push('t.status = ?');
      params.push(status);
    }
    if (priority) {
      conditions.push('t.priority = ?');
      params.push(priority);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM tasks t ${where}`, params);

    const [rows] = await db.query(
      `SELECT t.*,
              a.full_name AS assigned_to_name,
              c.full_name AS created_by_name,
              d.name AS assigned_department_name,
              tm.name AS assigned_team_name,
              latest_request.id AS latest_change_request_id,
              latest_request.action AS latest_change_request_action,
              latest_request.status AS latest_change_request_status,
              latest_request.created_at AS latest_change_requested_at
       FROM tasks t
       LEFT JOIN employees a ON t.assigned_to_employee_id = a.id
       LEFT JOIN employees c ON t.created_by_employee_id = c.id
       LEFT JOIN departments d ON t.assigned_to_department_id = d.id
       LEFT JOIN teams tm ON t.assigned_to_team_id = tm.id
       LEFT JOIN task_change_requests latest_request
         ON latest_request.id = (
           SELECT tcr.id
           FROM task_change_requests tcr
           WHERE tcr.task_id = t.id
           ORDER BY tcr.created_at DESC
           LIMIT 1
         )
       ${where}
       ORDER BY t.due_date ASC, t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );

    return ok(res, rows, { total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/tasks/:id
async function getOne(req, res) {
  try {
    await ensureTaskInfrastructure();
    const task = await getTaskById(req.params.id);
    if (!task) return notFound(res, 'Task not found');
    return ok(res, task);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/tasks
async function create(req, res) {
  try {
    await ensureTaskInfrastructure();

    const {
      title,
      description,
      assigned_to_employee_id,
      assigned_to_team_id,
      assigned_to_department_id,
      due_date,
      priority = 'medium',
    } = req.body;

    if (!title) return badRequest(res, 'title is required');
    if (!VALID_PRIORITY.includes(priority)) {
      return badRequest(res, `Invalid priority. Must be one of: ${VALID_PRIORITY.join(', ')}`);
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO tasks
         (id, title, description, assigned_to_employee_id, assigned_to_team_id, assigned_to_department_id,
          created_by_employee_id, due_date, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        title,
        description || null,
        assigned_to_employee_id || null,
        assigned_to_team_id || null,
        assigned_to_department_id || null,
        req.employee.id,
        due_date || null,
        priority,
      ]
    );

    const task = await getTaskById(id);

    if (assigned_to_employee_id) {
      await createNotification(db, {
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
    await ensureTaskInfrastructure();
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
    await ensureTaskInfrastructure();
    const allowed = ['title', 'description', 'assigned_to_employee_id', 'assigned_to_team_id', 'assigned_to_department_id', 'due_date', 'priority'];
    const fields = Object.keys(req.body).filter((key) => allowed.includes(key));
    if (!fields.length) return badRequest(res, 'No valid fields to update');

    await db.query(
      `UPDATE tasks SET ${fields.map((field) => `${field} = ?`).join(', ')}, is_edited = TRUE, edited_at = NOW() WHERE id = ?`,
      [...fields.map((field) => req.body[field]), req.params.id]
    );

    const task = await getTaskById(req.params.id);
    if (!task) return notFound(res, 'Task not found');
    return ok(res, task);
  } catch (err) {
    return serverError(res, err);
  }
}

// DELETE /api/tasks/:id
async function remove(req, res) {
  try {
    await ensureTaskInfrastructure();
    const task = await getTaskById(req.params.id);
    if (!task) return notFound(res, 'Task not found');

    const isAdmin = ['director', 'hr_head'].includes(req.employee.role);
    if (!isAdmin && task.created_by_employee_id !== req.employee.id) {
      return res.status(403).json({ error: 'Not authorized to delete this task' });
    }

    await db.query('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    return ok(res, { message: 'Task deleted' });
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/tasks/:id/change-requests
async function requestChange(req, res) {
  try {
    await ensureTaskInfrastructure();

    const { action, changes, reason } = req.body;
    if (!CHANGE_ACTIONS.includes(action)) {
      return badRequest(res, `Invalid action. Must be one of: ${CHANGE_ACTIONS.join(', ')}`);
    }

    const task = await getTaskById(req.params.id);
    if (!task) return notFound(res, 'Task not found');
    if (task.created_by_employee_id !== req.employee.id) {
      return res.status(403).json({ error: 'Only the task creator can request task changes' });
    }

    let requestedChanges = null;
    if (action === 'update') {
      const allowed = ['title', 'description', 'assigned_to_employee_id', 'assigned_to_team_id', 'assigned_to_department_id', 'due_date', 'priority'];
      requestedChanges = Object.fromEntries(
        Object.entries(changes || {}).filter(([key, value]) => allowed.includes(key) && value !== undefined)
      );

      if (!Object.keys(requestedChanges).length) {
        return badRequest(res, 'No valid task changes were provided');
      }
    }

    const requestId = await createChangeRequestRecord(task, req.employee, action, requestedChanges, reason);
    const [[requestRecord]] = await db.query('SELECT * FROM task_change_requests WHERE id = ?', [requestId]);
    return created(res, requestRecord);
  } catch (err) {
    if (err.message) {
      return badRequest(res, err.message);
    }
    return serverError(res, err);
  }
}

// GET /api/tasks/change-requests/mine
async function myChangeRequests(req, res) {
  try {
    await ensureTaskInfrastructure();

    const [rows] = await db.query(
      `SELECT tcr.*,
              t.title AS task_title,
              approver.full_name AS approver_name,
              reviewer.full_name AS reviewed_by_name
       FROM task_change_requests tcr
       JOIN tasks t ON t.id = tcr.task_id
       LEFT JOIN employees approver ON approver.id = tcr.approver_employee_id
       LEFT JOIN employees reviewer ON reviewer.id = tcr.reviewed_by_employee_id
       WHERE tcr.requested_by_employee_id = ?
       ORDER BY tcr.created_at DESC`,
      [req.employee.id]
    );

    return ok(res, rows.map((row) => ({
      ...row,
      requested_changes: parseRequestedChanges(row.requested_changes),
    })));
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/tasks/change-requests/pending
async function pendingChangeRequests(req, res) {
  try {
    await ensureTaskInfrastructure();

    const [rows] = await db.query(
      `SELECT tcr.*,
              t.title AS task_title,
              requester.full_name AS requested_by_name
       FROM task_change_requests tcr
       JOIN tasks t ON t.id = tcr.task_id
       JOIN employees requester ON requester.id = tcr.requested_by_employee_id
       WHERE tcr.approver_employee_id = ?
         AND tcr.status = 'pending'
       ORDER BY tcr.created_at ASC`,
      [req.employee.id]
    );

    return ok(res, rows.map((row) => ({
      ...row,
      requested_changes: parseRequestedChanges(row.requested_changes),
    })));
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/tasks/change-requests/:id/review
async function reviewChangeRequest(req, res) {
  try {
    await ensureTaskInfrastructure();

    const { status, review_note } = req.body;
    if (!CHANGE_STATUSES.includes(status) || status === 'pending') {
      return badRequest(res, 'status must be approved or rejected');
    }

    const [[requestRecord]] = await db.query(
      `SELECT *
       FROM task_change_requests
       WHERE id = ?`,
      [req.params.id]
    );

    if (!requestRecord) return notFound(res, 'Change request not found');
    if (requestRecord.approver_employee_id !== req.employee.id) {
      return res.status(403).json({ error: 'Only the mapped reporting manager can review this request' });
    }
    if (requestRecord.status !== 'pending') {
      return badRequest(res, 'This request has already been reviewed');
    }

    const changes = parseRequestedChanges(requestRecord.requested_changes) || {};
    const taskBeforeReview = await getTaskById(requestRecord.task_id);
    const taskTitle = taskBeforeReview?.title || 'task';

    await db.query(
      `UPDATE task_change_requests
       SET status = ?, review_note = ?, reviewed_by_employee_id = ?, reviewed_at = NOW(), applied_at = ?
       WHERE id = ?`,
      [status, review_note || null, req.employee.id, status === 'approved' ? new Date() : null, req.params.id]
    );

    if (status === 'approved') {
      if (requestRecord.action === 'update') {
        const keys = Object.keys(changes);
        if (!keys.length) {
          return badRequest(res, 'There are no valid changes to apply');
        }

        await db.query(
          `UPDATE tasks
           SET ${keys.map((key) => `${key} = ?`).join(', ')}, is_edited = TRUE, edited_at = NOW()
           WHERE id = ?`,
          [...keys.map((key) => changes[key]), requestRecord.task_id]
        );
      } else if (requestRecord.action === 'delete') {
        await db.query('DELETE FROM tasks WHERE id = ?', [requestRecord.task_id]);
      }
    }
    const responsePayload = {
      ...requestRecord,
      status,
      review_note: review_note || null,
      reviewed_by_employee_id: req.employee.id,
      reviewed_at: new Date().toISOString(),
      applied_at: status === 'approved' ? new Date().toISOString() : null,
    };

    await createNotification(db, {
      recipient_id: requestRecord.requested_by_employee_id,
      title: `Task ${requestRecord.action} request ${status}`,
      body: status === 'approved'
        ? `Your request for "${taskTitle}" was approved`
        : `Your request for "${taskTitle}" was rejected`,
      type: status === 'approved' ? 'success' : 'error',
      entity_type: 'task',
      entity_id: requestRecord.task_id,
    });

    return ok(res, {
      ...responsePayload,
      requested_changes: changes,
    });
  } catch (err) {
    return serverError(res, err);
  }
}

module.exports = {
  list,
  getOne,
  create,
  updateStatus,
  update,
  remove,
  requestChange,
  myChangeRequests,
  pendingChangeRequests,
  reviewChangeRequest,
};
