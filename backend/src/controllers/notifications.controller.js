const db = require('../config/db');
const { ok, notFound, serverError } = require('../utils/response');

// GET /api/notifications
// Returns last 50 notifications for the logged-in employee (unread first, then by date)
async function list(req, res) {
  try {
    const empId = req.employee.id;
    const [rows] = await db.query(
      `SELECT id, title, body, type, entity_type, entity_id, is_read, created_at
       FROM notifications
       WHERE recipient_employee_id = ?
       ORDER BY is_read ASC, created_at DESC
       LIMIT 50`,
      [empId]
    );

    const unread_count = rows.filter(n => !n.is_read).length;
    return ok(res, rows, { unread_count });
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/notifications/:id/read
async function markRead(req, res) {
  try {
    const empId = req.employee.id;
    const { id } = req.params;

    const [[notif]] = await db.query(
      'SELECT id FROM notifications WHERE id = ? AND recipient_employee_id = ?',
      [id, empId]
    );
    if (!notif) return notFound(res, 'Notification not found');

    await db.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [id]);
    return ok(res, { id, is_read: true });
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/notifications/read-all
async function markAllRead(req, res) {
  try {
    const empId = req.employee.id;
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE recipient_employee_id = ? AND is_read = FALSE',
      [empId]
    );
    return ok(res, { message: 'All notifications marked as read' });
  } catch (err) {
    return serverError(res, err);
  }
}

module.exports = { list, markRead, markAllRead };
