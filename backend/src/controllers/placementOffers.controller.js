const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { ok, created, notFound, badRequest, serverError } = require('../utils/response');
const { createNotification, notifyMany } = require('../services/notification.service');

const VALID_STATUS    = ['draft','submitted','processing','completed','cancelled'];
const VALID_EMP_TYPE  = ['full_time','contract','part_time','c2c'];

// ─── Role helpers ──────────────────────────────────────────────────────────────
const LEADERSHIP = ['director','ops_head','hr_head','compliance_officer'];
const TL_ROLES   = ['marketing_tl','sales_head','technical_head','resume_head'];

// GET /api/placement-orders
async function list(req, res) {
  try {
    const emp = req.employee;
    const { status, team_id, department_id, page = 1, limit = 20 } = req.query;

    const conditions = [];
    const params = [];

    // Scope by role
    if (!LEADERSHIP.includes(emp.role)) {
      if (TL_ROLES.includes(emp.role)) {
        conditions.push('po.team_id = ?');
        params.push(emp.team_id);
      } else {
        // Regular employees cannot list POs
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
    }

    if (status)        { conditions.push('po.status = ?');      params.push(status); }
    if (team_id)       { conditions.push('po.team_id = ?');     params.push(team_id); }
    if (department_id) {
      conditions.push('t.department_id = ?');
      params.push(department_id);
    }

    const where  = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM placement_offers po
       LEFT JOIN teams t ON po.team_id = t.id
       ${where}`,
      params
    );

    const [rows] = await db.query(
      `SELECT po.*,
              ce.full_name       AS enrollment_name,
              poc.full_name      AS poc_recruiter_name,
              app.full_name      AS application_recruiter_name,
              tech.full_name     AS technical_support_name,
              creator.full_name  AS created_by_name,
              tm.name            AS team_name
       FROM placement_offers po
       LEFT JOIN candidate_enrollments ce ON po.candidate_enrollment_id = ce.id
       LEFT JOIN employees poc            ON po.poc_recruiter_employee_id = poc.id
       LEFT JOIN employees app            ON po.application_recruiter_employee_id = app.id
       LEFT JOIN employees tech           ON po.technical_support_employee_id = tech.id
       LEFT JOIN employees creator        ON po.created_by_employee_id = creator.id
       LEFT JOIN teams tm                 ON po.team_id = tm.id
       ${where}
       ORDER BY po.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    return ok(res, rows, { total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/placement-orders/stats
async function stats(req, res) {
  try {
    const emp = req.employee;
    const { period = 'month', team_id, department_id } = req.query;

    // Date range from period
    let dateFrom;
    const now = new Date();
    if (period === 'today') {
      dateFrom = now.toISOString().slice(0, 10);
    } else if (period === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      dateFrom = d.toISOString().slice(0, 10);
    } else if (period === 'month') {
      dateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    } else if (period === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      dateFrom = `${now.getFullYear()}-${String(q * 3 + 1).padStart(2, '0')}-01`;
    } else {
      dateFrom = '2000-01-01';
    }

    const conditions = [`DATE(po.offer_date) >= '${dateFrom}'`];
    const params = [];

    if (!LEADERSHIP.includes(emp.role)) {
      conditions.push('po.team_id = ?');
      params.push(emp.team_id);
    }
    if (team_id)       { conditions.push('po.team_id = ?');        params.push(team_id); }
    if (department_id) { conditions.push('t.department_id = ?');   params.push(department_id); }

    const where = 'WHERE ' + conditions.join(' AND ');

    const [byTeam] = await db.query(
      `SELECT tm.name AS team_name, po.team_id,
              COUNT(*) AS total_pos,
              SUM(po.annual_package) AS total_package,
              SUM(po.final_amount_due) AS total_due,
              SUM(po.upfront_paid) AS total_upfront
       FROM placement_offers po
       LEFT JOIN teams t ON po.team_id = t.id
       LEFT JOIN teams tm ON po.team_id = tm.id
       ${where}
       GROUP BY po.team_id, tm.name
       ORDER BY total_pos DESC`,
      params
    );

    const [[totals]] = await db.query(
      `SELECT COUNT(*) AS total_pos,
              SUM(po.annual_package) AS total_package,
              SUM(po.final_amount_due) AS total_due,
              SUM(po.upfront_paid) AS total_upfront,
              SUM(po.status = 'completed') AS completed
       FROM placement_offers po
       LEFT JOIN teams t ON po.team_id = t.id
       ${where}`,
      params
    );

    return ok(res, { totals, by_team: byTeam });
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/placement-orders/:id
async function getOne(req, res) {
  try {
    const [[po]] = await db.query(
      `SELECT po.*,
              ce.full_name       AS enrollment_name,
              poc.full_name      AS poc_recruiter_name,
              app.full_name      AS application_recruiter_name,
              tech.full_name     AS technical_support_name,
              creator.full_name  AS created_by_name,
              tm.name            AS team_name
       FROM placement_offers po
       LEFT JOIN candidate_enrollments ce ON po.candidate_enrollment_id = ce.id
       LEFT JOIN employees poc            ON po.poc_recruiter_employee_id = poc.id
       LEFT JOIN employees app            ON po.application_recruiter_employee_id = app.id
       LEFT JOIN employees tech           ON po.technical_support_employee_id = tech.id
       LEFT JOIN employees creator        ON po.created_by_employee_id = creator.id
       LEFT JOIN teams tm                 ON po.team_id = tm.id
       WHERE po.id = ?`,
      [req.params.id]
    );
    if (!po) return notFound(res, 'Placement offer not found');
    return ok(res, po);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/placement-orders
async function create(req, res) {
  try {
    const {
      candidate_enrollment_id, candidate_name,
      technology, offer_position,
      employer_name, job_location, employment_type = 'full_time',
      offer_date, joining_date,
      annual_package, upfront_paid = 0,
      commission_rate, commission_amount, final_amount_due,
      installment_1_amount, installment_1_condition, installment_1_paid_at,
      installment_2_amount, installment_2_condition, installment_2_paid_at,
      installment_3_amount, installment_3_condition, installment_3_paid_at,
      poc_recruiter_employee_id, application_recruiter_employee_id,
      technical_support_employee_id,
      notes,
    } = req.body;

    // Validate required
    if (!candidate_name)  return badRequest(res, 'candidate_name is required');
    if (!technology)      return badRequest(res, 'technology is required');
    if (!offer_position)  return badRequest(res, 'offer_position is required');
    if (!employer_name)   return badRequest(res, 'employer_name is required');
    if (!offer_date)      return badRequest(res, 'offer_date is required');
    if (annual_package == null) return badRequest(res, 'annual_package is required');
    if (commission_amount == null) return badRequest(res, 'commission_amount is required');
    if (final_amount_due == null) return badRequest(res, 'final_amount_due is required');
    if (!VALID_EMP_TYPE.includes(employment_type)) {
      return badRequest(res, `Invalid employment_type. Must be one of: ${VALID_EMP_TYPE.join(', ')}`);
    }

    // Auto-resolve candidate name from enrollment if not provided
    let resolvedName = candidate_name;
    if (candidate_enrollment_id && !resolvedName) {
      const [[ce]] = await db.query('SELECT full_name FROM candidate_enrollments WHERE id = ?', [candidate_enrollment_id]);
      if (ce) resolvedName = ce.full_name;
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO placement_offers (
         id, candidate_enrollment_id, candidate_name,
         technology, offer_position,
         employer_name, job_location, employment_type,
         offer_date, joining_date,
         annual_package, upfront_paid, commission_rate, commission_amount, final_amount_due,
         installment_1_amount, installment_1_condition, installment_1_paid_at,
         installment_2_amount, installment_2_condition, installment_2_paid_at,
         installment_3_amount, installment_3_condition, installment_3_paid_at,
         poc_recruiter_employee_id, application_recruiter_employee_id,
         technical_support_employee_id,
         created_by_employee_id, team_id, notes
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, candidate_enrollment_id || null, resolvedName,
        technology, offer_position,
        employer_name, job_location || null, employment_type,
        offer_date, joining_date || null,
        annual_package, upfront_paid, commission_rate || null, commission_amount, final_amount_due,
        installment_1_amount || null, installment_1_condition || null, installment_1_paid_at || null,
        installment_2_amount || null, installment_2_condition || null, installment_2_paid_at || null,
        installment_3_amount || null, installment_3_condition || null, installment_3_paid_at || null,
        poc_recruiter_employee_id || null, application_recruiter_employee_id || null,
        technical_support_employee_id || null,
        req.employee.id, req.employee.team_id || null, notes || null,
      ]
    );

    const [[po]] = await db.query('SELECT * FROM placement_offers WHERE id = ?', [id]);

    // Notify all compliance officers — non-blocking
    const [complianceOfficers] = await db.query(
      `SELECT id FROM employees WHERE role = 'compliance_officer' AND is_active = TRUE`
    );
    notifyMany(db, complianceOfficers.map(e => e.id), {
      title: `New Placement Offer — ${resolvedName}`,
      body: `${employer_name} | ${technology} | ${offer_position}`,
      type: 'success',
      entity_type: 'placement_offer',
      entity_id: id,
    });

    return created(res, po);
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/placement-orders/:id
async function update(req, res) {
  try {
    const allowed = [
      'status', 'payment_link_sent', 'joining_date', 'notes',
      'installment_1_paid_at', 'installment_2_paid_at', 'installment_3_paid_at',
      'upfront_paid',
    ];
    const fields = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!fields.length) return badRequest(res, 'No valid fields to update');

    if (req.body.status && !VALID_STATUS.includes(req.body.status)) {
      return badRequest(res, `Invalid status. Must be one of: ${VALID_STATUS.join(', ')}`);
    }

    await db.query(
      `UPDATE placement_offers SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`,
      [...fields.map(f => req.body[f]), req.params.id]
    );

    const [[po]] = await db.query('SELECT * FROM placement_offers WHERE id = ?', [req.params.id]);
    if (!po) return notFound(res, 'Placement offer not found');
    return ok(res, po);
  } catch (err) {
    return serverError(res, err);
  }
}

// DELETE /api/placement-orders/:id (director only — enforced in route middleware)
async function remove(req, res) {
  try {
    const [[po]] = await db.query('SELECT id FROM placement_offers WHERE id = ?', [req.params.id]);
    if (!po) return notFound(res, 'Placement offer not found');
    await db.query('DELETE FROM placement_offers WHERE id = ?', [req.params.id]);
    return ok(res, { message: 'Placement offer deleted' });
  } catch (err) {
    return serverError(res, err);
  }
}

module.exports = { list, stats, getOne, create, update, remove };
