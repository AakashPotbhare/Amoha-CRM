const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { ok, created, notFound, badRequest, serverError } = require('../utils/response');
const { createNotification } = require('../services/notification.service');

const VALID_TYPES = [
  'interview_support','assessment_support','ruc',
  'mock_call','preparation_call','resume_building','resume_rebuilding',
];
const VALID_STATUS = ['pending','in_progress','completed','cancelled'];
const VALID_CALL_STATUS = ['not_started','scheduled','link_sent','done','no_show','rescheduled','completed'];

// GET /api/support-tasks
async function list(req, res) {
  try {
    const { department_id, assigned_to, status, type, page = 1, limit = 20 } = req.query;
    const emp = req.employee;

    const conditions = [];
    const params = [];

    // Scope by role: non-leadership only sees own dept or own tasks
    const leadership = ['director','ops_head','hr_head'];
    if (!leadership.includes(emp.role)) {
      if (['marketing_tl','sales_head','technical_head','resume_head'].includes(emp.role)) {
        conditions.push('st.department_id = ?');
        params.push(emp.department_id);
      } else {
        // Regular staff see tasks assigned to them OR created by them
        conditions.push('(st.assigned_to_employee_id = ? OR st.created_by_employee_id = ?)');
        params.push(emp.id, emp.id);
      }
    }

    if (department_id) { conditions.push('st.department_id = ?');            params.push(department_id); }
    if (assigned_to)   { conditions.push('st.assigned_to_employee_id = ?');  params.push(assigned_to); }
    if (status)        { conditions.push('st.status = ?');                    params.push(status); }
    if (type)          { conditions.push('st.task_type = ?');                 params.push(type); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM support_tasks st ${where}`, params
    );

    const [rows] = await db.query(
      `SELECT st.*,
              COALESCE(ce.full_name, st.candidate_name) AS candidate_name,
              e.full_name   AS assigned_to_name,
              d.name        AS department_name
       FROM support_tasks st
       LEFT JOIN candidate_enrollments ce ON st.candidate_enrollment_id = ce.id
       LEFT JOIN employees e              ON st.assigned_to_employee_id = e.id
       LEFT JOIN departments d            ON st.department_id = d.id
       ${where}
       ORDER BY st.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    return ok(res, rows, { total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/support-tasks/:id
async function getOne(req, res) {
  try {
    const [[task]] = await db.query(
      `SELECT st.*,
              COALESCE(ce.full_name, st.candidate_name) AS candidate_name,
              e.full_name  AS assigned_to_name,
              d.name       AS department_name
       FROM support_tasks st
       LEFT JOIN candidate_enrollments ce ON st.candidate_enrollment_id = ce.id
       LEFT JOIN employees e              ON st.assigned_to_employee_id = e.id
       LEFT JOIN departments d            ON st.department_id = d.id
       WHERE st.id = ?`,
      [req.params.id]
    );
    if (!task) return notFound(res, 'Support task not found');

    const [comments] = await db.query(
      `SELECT tc.*, e.full_name AS author_name
       FROM task_comments tc
       LEFT JOIN employees e ON tc.employee_id = e.id
       WHERE tc.task_id = ?
       ORDER BY tc.created_at ASC`,
      [req.params.id]
    );

    return ok(res, { ...task, comments });
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/support-tasks
async function create(req, res) {
  try {
    const {
      candidate_id, task_type,
      department_id, assigned_to_department_id,
      team_id, assigned_to_team_id,
      assigned_to_employee_id,
      scheduled_at, scheduled_date, start_time,
      due_date, deadline_date,
      company_name, interview_round, priority,
      candidate_name: candidateNameBody,
    } = req.body;

    if (!task_type) return badRequest(res, 'task_type is required');
    if (!VALID_TYPES.includes(task_type)) {
      return badRequest(res, `Invalid task_type. Must be one of: ${VALID_TYPES.join(', ')}`);
    }

    // Resolve field name aliases from frontend
    const deptId = department_id || assigned_to_department_id || null;
    const teamId = team_id || assigned_to_team_id || null;
    const toMysqlDt = (v) => v ? v.replace('T', ' ').replace('Z', '').substring(0, 19) : null;
    const schedAt = toMysqlDt(scheduled_at || (scheduled_date && start_time ? `${scheduled_date}T${start_time}` : scheduled_date) || null);
    const dueAt   = toMysqlDt(due_date || deadline_date || null);

    // Look up candidate name if enrollment id provided
    let resolvedName = candidateNameBody || null;
    if (candidate_id && !resolvedName) {
      const [[ce]] = await db.query('SELECT full_name FROM candidate_enrollments WHERE id = ?', [candidate_id]);
      if (ce) resolvedName = ce.full_name;
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO support_tasks
         (id, candidate_enrollment_id, candidate_name, task_type, department_id, team_id,
          assigned_to_employee_id, created_by_employee_id,
          scheduled_at, due_date, company_name, interview_round, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, candidate_id || null, resolvedName, task_type, deptId, teamId,
       assigned_to_employee_id || null, req.employee.id,
       schedAt, dueAt, company_name || null, interview_round || null,
       priority || 'medium']
    );

    const [[task]] = await db.query('SELECT * FROM support_tasks WHERE id = ?', [id]);

    // In-app notification — non-blocking
    if (assigned_to_employee_id) {
      const typeLabel = task_type.replace(/_/g, ' ');
      createNotification(db, {
        recipient_id: assigned_to_employee_id,
        title: `New support task: ${typeLabel}`,
        body: resolvedName ? `Candidate: ${resolvedName}` : null,
        type: 'info',
        entity_type: 'support_task',
        entity_id: id,
      });
    }

    return created(res, task);
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/support-tasks/:id/status
async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    if (!VALID_STATUS.includes(status)) {
      return badRequest(res, `Invalid status. Must be one of: ${VALID_STATUS.join(', ')}`);
    }
    await db.query('UPDATE support_tasks SET status = ? WHERE id = ?', [status, req.params.id]);
    return ok(res, { id: req.params.id, status });
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/support-tasks/:id/call-status
async function updateCallStatus(req, res) {
  try {
    const { call_status } = req.body;
    if (!VALID_CALL_STATUS.includes(call_status)) {
      return badRequest(res, `Invalid call_status. Must be one of: ${VALID_CALL_STATUS.join(', ')}`);
    }
    await db.query('UPDATE support_tasks SET call_status = ? WHERE id = ?', [call_status, req.params.id]);
    return ok(res, { id: req.params.id, call_status });
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/support-tasks/:id/reassign
async function reassign(req, res) {
  try {
    const { assigned_to_employee_id } = req.body;
    if (!assigned_to_employee_id) return badRequest(res, 'assigned_to_employee_id is required');

    await db.query(
      'UPDATE support_tasks SET assigned_to_employee_id = ? WHERE id = ?',
      [assigned_to_employee_id, req.params.id]
    );

    // In-app notification — non-blocking
    createNotification(db, {
      recipient_id: assigned_to_employee_id,
      title: 'Support task reassigned to you',
      body: null,
      type: 'info',
      entity_type: 'support_task',
      entity_id: req.params.id,
    });

    return ok(res, { id: req.params.id, assigned_to_employee_id });
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/support-tasks/:id/comments
async function addComment(req, res) {
  try {
    const { content } = req.body;
    if (!content) return badRequest(res, 'content is required');

    const id = uuidv4();
    await db.query(
      'INSERT INTO task_comments (id, support_task_id, employee_id, content) VALUES (?, ?, ?, ?)',
      [id, req.params.id, req.employee.id, content]
    );

    const [[comment]] = await db.query(
      `SELECT tc.*, e.full_name AS author_name
       FROM task_comments tc
       LEFT JOIN employees e ON tc.employee_id = e.id
       WHERE tc.id = ?`,
      [id]
    );
    return created(res, comment);
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/support-tasks/:id
async function update(req, res) {
  try {
    const { id } = req.params;
    const allowed = [
      'teams_link','feedback','questions_asked','scheduled_at',
      'due_date','company_name','interview_round','priority','status',
      'call_status','completed_at','notes'
    ];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = ?`);
        vals.push(req.body[key]);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields provided' });
    vals.push(id);
    await db.query(`UPDATE support_tasks SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, vals);
    const [rows] = await db.query('SELECT * FROM support_tasks WHERE id = ?', [id]);
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('supportTasks.update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/support-tasks/:id
async function remove(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT id FROM support_tasks WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Support task not found' });
    await db.query('DELETE FROM support_tasks WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Support task deleted' });
  } catch (err) {
    console.error('supportTasks.remove error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { list, getOne, create, updateStatus, updateCallStatus, reassign, addComment, update, remove };
