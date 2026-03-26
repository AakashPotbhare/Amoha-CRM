const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { ok, created, notFound, badRequest, serverError } = require('../utils/response');

// POST /api/attendance/check-in
async function checkIn(req, res) {
  try {
    const { latitude, longitude, notes, is_wfh } = req.body;
    const empId = req.employee.id;

    // Check if already checked in today without checkout
    const today = new Date().toISOString().slice(0, 10);
    const [[open]] = await db.query(
      `SELECT id FROM attendance_records
       WHERE employee_id = ? AND date = ? AND check_out_time IS NULL`,
      [empId, today]
    );
    if (open) return badRequest(res, 'Already checked in. Please check out first.');

    const id = uuidv4();
    await db.query(
      `INSERT INTO attendance_records (id, employee_id, date, check_in_time, check_in_lat, check_in_lng, is_wfh)
       VALUES (?, ?, ?, NOW(), ?, ?, ?)`,
      [id, empId, today, latitude || null, longitude || null, is_wfh ? 1 : 0]
    );

    const [[record]] = await db.query('SELECT * FROM attendance_records WHERE id = ?', [id]);
    return created(res, record);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/attendance/check-out
async function checkOut(req, res) {
  try {
    const { latitude, longitude, total_hours, attendance_status, is_late, is_wfh } = req.body;
    const empId = req.employee.id;

    const today = new Date().toISOString().slice(0, 10);
    const [[record]] = await db.query(
      `SELECT id FROM attendance_records
       WHERE employee_id = ? AND date = ? AND check_out_time IS NULL`,
      [empId, today]
    );
    if (!record) return badRequest(res, 'No active check-in found for today.');

    const fields = ['check_out_time = NOW()', 'check_out_lat = ?', 'check_out_lng = ?'];
    const params = [latitude || null, longitude || null];

    if (total_hours != null)     { fields.push('total_hours = ?');       params.push(total_hours); }
    if (attendance_status)       { fields.push('attendance_status = ?'); params.push(attendance_status); }
    if (is_late != null)         { fields.push('is_late = ?');           params.push(is_late ? 1 : 0); }
    if (is_wfh != null)          { fields.push('is_wfh = ?');            params.push(is_wfh ? 1 : 0); }

    params.push(record.id);
    await db.query(`UPDATE attendance_records SET ${fields.join(', ')} WHERE id = ?`, params);

    const [[updated]] = await db.query('SELECT * FROM attendance_records WHERE id = ?', [record.id]);
    return ok(res, updated);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/attendance/undo-checkout
async function undoCheckout(req, res) {
  try {
    const empId = req.employee.id;
    const today = new Date().toISOString().slice(0, 10);

    const [[record]] = await db.query(
      `SELECT id FROM attendance_records
       WHERE employee_id = ? AND date = ?`,
      [empId, today]
    );
    if (!record) return badRequest(res, 'No attendance record found for today.');

    await db.query(
      `UPDATE attendance_records
       SET check_out_time = NULL, check_out_lat = NULL, check_out_lng = NULL,
           total_hours = NULL, attendance_status = 'present'
       WHERE id = ?`,
      [record.id]
    );

    const [[updated]] = await db.query('SELECT * FROM attendance_records WHERE id = ?', [record.id]);
    return ok(res, updated);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/attendance/break/start
async function startBreak(req, res) {
  try {
    const { break_type = 'short_break' } = req.body;
    if (!['short_break','lunch'].includes(break_type)) {
      return badRequest(res, "Invalid break_type. Must be 'short_break' or 'lunch'");
    }
    const empId = req.employee.id;

    const today = new Date().toISOString().slice(0, 10);
    const [[record]] = await db.query(
      `SELECT id FROM attendance_records
       WHERE employee_id = ? AND date = ? AND check_out_time IS NULL`,
      [empId, today]
    );
    if (!record) return badRequest(res, 'No active check-in found.');

    // Check no open break
    const [[openBreak]] = await db.query(
      'SELECT id FROM attendance_breaks WHERE attendance_record_id = ? AND break_end IS NULL',
      [record.id]
    );
    if (openBreak) return badRequest(res, 'Already on a break. End it first.');

    // Get next break number
    const [[{ maxNum }]] = await db.query(
      'SELECT COALESCE(MAX(break_number), 0) AS maxNum FROM attendance_breaks WHERE attendance_record_id = ?',
      [record.id]
    );

    const id = uuidv4();
    await db.query(
      'INSERT INTO attendance_breaks (id, attendance_record_id, break_number, break_type, break_start) VALUES (?, ?, ?, ?, NOW())',
      [id, record.id, maxNum + 1, break_type]
    );

    const [[brk]] = await db.query(
      'SELECT *, break_start AS start_time, break_end AS end_time FROM attendance_breaks WHERE id = ?',
      [id]
    );
    return created(res, brk);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/attendance/break/end
async function endBreak(req, res) {
  try {
    const empId = req.employee.id;
    const today = new Date().toISOString().slice(0, 10);

    const [[record]] = await db.query(
      `SELECT id FROM attendance_records
       WHERE employee_id = ? AND date = ? AND check_out_time IS NULL`,
      [empId, today]
    );
    if (!record) return badRequest(res, 'No active check-in found.');

    const [[openBreak]] = await db.query(
      'SELECT id FROM attendance_breaks WHERE attendance_record_id = ? AND break_end IS NULL',
      [record.id]
    );
    if (!openBreak) return badRequest(res, 'No active break found.');

    await db.query(
      'UPDATE attendance_breaks SET break_end = NOW(), duration_minutes = TIMESTAMPDIFF(MINUTE, break_start, NOW()) WHERE id = ?',
      [openBreak.id]
    );

    const [[brk]] = await db.query(
      'SELECT *, break_start AS start_time, break_end AS end_time FROM attendance_breaks WHERE id = ?',
      [openBreak.id]
    );
    return ok(res, brk);
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/attendance/today
async function today(req, res) {
  try {
    const empId = req.employee.id;
    const todayDate = new Date().toISOString().slice(0, 10);

    const [[record]] = await db.query(
      'SELECT * FROM attendance_records WHERE employee_id = ? AND date = ?',
      [empId, todayDate]
    );

    if (!record) return ok(res, { record: null, breaks: [] });

    const [breaks] = await db.query(
      'SELECT *, break_start AS start_time, break_end AS end_time FROM attendance_breaks WHERE attendance_record_id = ? ORDER BY break_start ASC',
      [record.id]
    );

    return ok(res, { record, breaks });
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/attendance/monthly?employee_id=&month=&year=
async function monthly(req, res) {
  try {
    const { employee_id, month, year } = req.query;
    const empId = employee_id || req.employee.id;

    // Only leadership/managers can view other employees' attendance
    const leadership = ['director','ops_head','hr_head'];
    const managers = ['sales_head','technical_head','marketing_tl','resume_head'];
    if (empId !== req.employee.id &&
        !leadership.includes(req.employee.role) &&
        !managers.includes(req.employee.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const m = month || new Date().getMonth() + 1;
    const y = year  || new Date().getFullYear();

    const [records] = await db.query(
      `SELECT ar.*,
              (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', ab.id,'type',ab.break_type,'start',ab.break_start,'end',ab.break_end))
               FROM attendance_breaks ab WHERE ab.attendance_record_id = ar.id) AS breaks
       FROM attendance_records ar
       WHERE ar.employee_id = ? AND MONTH(ar.date) = ? AND YEAR(ar.date) = ?
       ORDER BY ar.check_in_time ASC`,
      [empId, m, y]
    );

    return ok(res, records);
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/attendance/report
// Supports two modes:
//   1. Monthly payroll aggregate: ?month=3&year=2026&department_id= (returns one row per employee)
//   2. Raw records:              ?date_from=&date_to=&department_id= (returns raw rows)
async function report(req, res) {
  try {
    const { department_id, date_from, date_to, month, year } = req.query;

    // ── Mode 1: Monthly payroll aggregate ────────────────────────────────────
    if (month && year) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);

      const deptCondition = department_id ? 'AND e.department_id = ?' : '';
      const deptParam     = department_id ? [department_id] : [];

      const [rows] = await db.query(
        `SELECT
           e.id             AS employee_id,
           e.employee_code,
           e.full_name,
           e.designation,
           d.name           AS department_name,
           t.name           AS team_name,
           COALESCE(e.base_salary, 0)        AS base_salary,
           COALESCE(e.pf_percentage, 12)     AS pf_percentage,
           COALESCE(e.professional_tax, 200) AS professional_tax,
           COUNT(ar.id)                      AS total_days,
           SUM(CASE WHEN ar.attendance_status = 'present'  THEN 1 ELSE 0 END) AS present,
           SUM(CASE WHEN ar.attendance_status = 'half_day' THEN 1 ELSE 0 END) AS half_day,
           SUM(CASE WHEN ar.attendance_status = 'late'     THEN 1 ELSE 0 END) AS late,
           SUM(CASE WHEN ar.attendance_status = 'absent'   THEN 1 ELSE 0 END) AS absent,
           SUM(CASE WHEN ar.is_wfh = 1                     THEN 1 ELSE 0 END) AS wfh,
           ROUND(COALESCE(SUM(ar.total_hours), 0), 2)      AS total_hours
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         LEFT JOIN teams       t ON e.team_id       = t.id
         LEFT JOIN attendance_records ar
           ON ar.employee_id = e.id
           AND MONTH(ar.date) = ?
           AND YEAR(ar.date)  = ?
         WHERE e.is_active = 1 ${deptCondition}
         GROUP BY e.id
         ORDER BY e.full_name ASC`,
        [m, y, ...deptParam]
      );

      return ok(res, rows);
    }

    // ── Mode 2: Raw attendance records ───────────────────────────────────────
    const conditions = [];
    const params = [];

    if (department_id) { conditions.push('e.department_id = ?'); params.push(department_id); }
    if (date_from)     { conditions.push('ar.date >= ?');        params.push(date_from); }
    if (date_to)       { conditions.push('ar.date <= ?');        params.push(date_to); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await db.query(
      `SELECT ar.*, e.full_name AS employee_name, d.name AS department_name
       FROM attendance_records ar
       LEFT JOIN employees   e ON ar.employee_id  = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       ${where}
       ORDER BY ar.check_in_time DESC`,
      params
    );

    return ok(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

module.exports = { checkIn, checkOut, undoCheckout, startBreak, endBreak, today, monthly, report };
