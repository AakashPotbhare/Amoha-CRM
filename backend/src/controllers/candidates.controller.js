const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { ok, created, notFound, badRequest, serverError } = require('../utils/response');

// GET /api/candidates
async function list(req, res) {
  try {
    const { stage, search, enrolled_by, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (stage)       { conditions.push('ce.pipeline_stage = ?');         params.push(stage); }
    if (enrolled_by) { conditions.push('ce.enrolled_by_employee_id = ?'); params.push(enrolled_by); }
    if (search) {
      conditions.push('(ce.full_name LIKE ? OR ce.phone LIKE ? OR ce.email LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM candidate_enrollments ce ${where}`, params
    );

    const [rows] = await db.query(
      `SELECT ce.*,
              e.full_name  AS enrolled_by_name,
              sp.full_name AS salesperson_name
       FROM candidate_enrollments ce
       LEFT JOIN employees e  ON ce.enrolled_by_employee_id = e.id
       LEFT JOIN employees sp ON ce.salesperson_employee_id  = sp.id
       ${where}
       ORDER BY ce.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    return ok(res, rows, { total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/candidates/pipeline-stats
async function pipelineStats(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT pipeline_stage AS stage, COUNT(*) AS count
       FROM candidate_enrollments GROUP BY pipeline_stage`
    );
    const stages = ['enrolled','resume_building','marketing_active','interview_stage','placed','rejected'];
    const map = Object.fromEntries(stages.map(s => [s, 0]));
    rows.forEach(r => { map[r.stage] = Number(r.count); });
    return ok(res, map);
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/candidates/:id
async function getOne(req, res) {
  try {
    const [[candidate]] = await db.query(
      `SELECT ce.*,
              e.full_name  AS enrolled_by_name,
              sp.full_name AS salesperson_name
       FROM candidate_enrollments ce
       LEFT JOIN employees e  ON ce.enrolled_by_employee_id = e.id
       LEFT JOIN employees sp ON ce.salesperson_employee_id  = sp.id
       WHERE ce.id = ?`,
      [req.params.id]
    );
    if (!candidate) return notFound(res, 'Candidate not found');
    return ok(res, candidate);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/candidates
async function enroll(req, res) {
  try {
    const {
      full_name, phone, email,
      dob, date_of_birth,
      gender,
      visa_status, visa_type,
      visa_expire_date, visa_expiry,
      ead_start_date, ead_end_date,
      current_location_zip, current_location,
      nearest_metro_area,
      open_for_relocation,
      native_country,
      current_domain, technology, profession,
      years_experience, experience_years,
      veteran_status,
      security_clearance,
      race_ethnicity,
      total_certifications,
      highest_qualification,
      bachelors_field, bachelors_university, bachelors_start_date, bachelors_end_date,
      masters_field, masters_university, masters_start_date, masters_end_date,
      linkedin_email, linkedin_passcode,
      ssn_last4,
      marketing_email, marketing_email_password,
      availability_for_calls,
      availability_to_start,
      arrived_in_usa,
      salary_expectations,
      notes,
      pipeline_stage,
      // Plan & Payment
      plan_type,
      plan_price,
      discount_amount,
      installment_1_amount,
      installment_1_paid_date,
      installment_2_amount,
      installment_2_paid_date,
      next_payment_date,
      next_payment_amount,
      // Referral & Sales
      referred_by_name,
      referral_bonus_amount,
      salesperson_employee_id,
      lead_person_name,
      // Payment methods (array: ['stripe','zelle','account_transfer'])
      payment_methods,
    } = req.body;

    if (!full_name || !phone) {
      return badRequest(res, 'full_name and phone are required');
    }

    const resolvedDob         = dob || date_of_birth || null;
    const resolvedVisaStatus  = visa_status || visa_type || null;
    const resolvedVisaExpire  = visa_expire_date || visa_expiry || null;
    const resolvedLocationZip = current_location_zip || current_location || null;
    const resolvedDomain      = current_domain || technology || profession || null;
    const resolvedYrsExp      = years_experience || experience_years || null;
    const resolvedStage       = pipeline_stage || 'enrolled';

    // Serialize payment_methods array → JSON
    const resolvedPaymentMethods = payment_methods
      ? JSON.stringify(Array.isArray(payment_methods) ? payment_methods : [payment_methods])
      : null;

    const id = uuidv4();
    await db.query(
      `INSERT INTO candidate_enrollments (
         id, full_name, phone, email, dob, gender,
         visa_status, visa_expire_date, ead_start_date, ead_end_date,
         current_location_zip, nearest_metro_area, open_for_relocation, native_country,
         current_domain, years_experience,
         veteran_status, security_clearance, race_ethnicity, total_certifications,
         highest_qualification,
         bachelors_field, bachelors_university, bachelors_start_date, bachelors_end_date,
         masters_field, masters_university, masters_start_date, masters_end_date,
         linkedin_email, linkedin_passcode, ssn_last4,
         marketing_email, marketing_email_password,
         availability_for_calls, availability_to_start, arrived_in_usa,
         salary_expectations, notes,
         plan_type, plan_price, discount_amount,
         installment_1_amount, installment_1_paid_date,
         installment_2_amount, installment_2_paid_date,
         next_payment_date, next_payment_amount,
         referred_by_name, referral_bonus_amount,
         salesperson_employee_id, lead_person_name,
         payment_methods,
         pipeline_stage, enrolled_by_employee_id
       ) VALUES (
         ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
       )`,
      [
        id, full_name, phone, email || null, resolvedDob, gender || null,
        resolvedVisaStatus, resolvedVisaExpire, ead_start_date || null, ead_end_date || null,
        resolvedLocationZip, nearest_metro_area || null, open_for_relocation || null, native_country || null,
        resolvedDomain, resolvedYrsExp,
        veteran_status || null, security_clearance || null, race_ethnicity || null, total_certifications || null,
        highest_qualification || null,
        bachelors_field || null, bachelors_university || null, bachelors_start_date || null, bachelors_end_date || null,
        masters_field || null, masters_university || null, masters_start_date || null, masters_end_date || null,
        linkedin_email || null, linkedin_passcode || null, ssn_last4 || null,
        marketing_email || null, marketing_email_password || null,
        availability_for_calls || null, availability_to_start || null, arrived_in_usa || null,
        salary_expectations || null, notes || null,
        plan_type || null, plan_price || null, discount_amount || 0,
        installment_1_amount || null, installment_1_paid_date || null,
        installment_2_amount || null, installment_2_paid_date || null,
        next_payment_date || null, next_payment_amount || null,
        referred_by_name || null, referral_bonus_amount || null,
        salesperson_employee_id || null, lead_person_name || null,
        resolvedPaymentMethods,
        resolvedStage, req.employee.id,
      ]
    );

    // Notify salesperson of successful enrollment
    if (salesperson_employee_id) {
      try {
        const { createNotification } = require('../services/notification.service');
        await createNotification(db, {
          recipient_id: salesperson_employee_id,
          title: `New Candidate Enrolled: ${full_name}`,
          body: `A new candidate has been enrolled under your account.`,
          type: 'success',
          entity_type: 'candidate_enrollment',
          entity_id: id,
        });
      } catch (_) { /* non-blocking */ }
    }

    const [[candidate]] = await db.query(
      `SELECT ce.*, e.full_name AS enrolled_by_name, sp.full_name AS salesperson_name
       FROM candidate_enrollments ce
       LEFT JOIN employees e  ON ce.enrolled_by_employee_id = e.id
       LEFT JOIN employees sp ON ce.salesperson_employee_id  = sp.id
       WHERE ce.id = ?`,
      [id]
    );
    return created(res, candidate);
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/candidates/:id
async function update(req, res) {
  try {
    const allowed = [
      'full_name','phone','email','dob',
      'gender','visa_status','visa_expire_date','ead_start_date','ead_end_date',
      'current_location_zip','nearest_metro_area','open_for_relocation','native_country',
      'current_domain','years_experience',
      'veteran_status','security_clearance','race_ethnicity','total_certifications',
      'highest_qualification',
      'bachelors_field','bachelors_university','bachelors_start_date','bachelors_end_date',
      'masters_field','masters_university','masters_start_date','masters_end_date',
      'linkedin_email','linkedin_passcode','ssn_last4',
      'marketing_email','marketing_email_password',
      'availability_for_calls','availability_to_start','arrived_in_usa',
      'salary_expectations','notes',
      // Plan & Payment
      'plan_type','plan_price','discount_amount',
      'installment_1_amount','installment_1_paid_date',
      'installment_2_amount','installment_2_paid_date',
      'next_payment_date','next_payment_amount',
      // Referral & Sales
      'referred_by_name','referral_bonus_amount',
      'salesperson_employee_id','lead_person_name',
      'payment_methods',
    ];

    const fields = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!fields.length) return badRequest(res, 'No valid fields to update');

    const values = fields.map(f => {
      if (f === 'payment_methods') {
        const v = req.body[f];
        return v ? JSON.stringify(Array.isArray(v) ? v : [v]) : null;
      }
      return req.body[f];
    });

    await db.query(
      `UPDATE candidate_enrollments SET ${fields.map(f => `\`${f}\` = ?`).join(', ')} WHERE id = ?`,
      [...values, req.params.id]
    );

    const [[candidate]] = await db.query(
      `SELECT ce.*, e.full_name AS enrolled_by_name, sp.full_name AS salesperson_name
       FROM candidate_enrollments ce
       LEFT JOIN employees e  ON ce.enrolled_by_employee_id = e.id
       LEFT JOIN employees sp ON ce.salesperson_employee_id  = sp.id
       WHERE ce.id = ?`,
      [req.params.id]
    );
    if (!candidate) return notFound(res, 'Candidate not found');
    return ok(res, candidate);
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/candidates/:id/stage
async function updateStage(req, res) {
  try {
    const validStages = ['enrolled','resume_building','marketing_active','interview_stage','placed','rejected'];
    const { stage } = req.body;

    if (!validStages.includes(stage)) {
      return badRequest(res, `Invalid stage. Must be one of: ${validStages.join(', ')}`);
    }

    await db.query(
      'UPDATE candidate_enrollments SET pipeline_stage = ? WHERE id = ?',
      [stage, req.params.id]
    );

    const [[candidate]] = await db.query(
      'SELECT id, full_name, pipeline_stage FROM candidate_enrollments WHERE id = ?',
      [req.params.id]
    );
    if (!candidate) return notFound(res, 'Candidate not found');
    return ok(res, candidate);
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/candidates/:id/credentials  — TL/marketing fills LinkedIn & marketing creds
async function updateCredentials(req, res) {
  try {
    const allowed = ['linkedin_email','linkedin_passcode','ssn_last4','marketing_email','marketing_email_password'];
    const fields  = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!fields.length) return badRequest(res, 'No credential fields provided');

    await db.query(
      `UPDATE candidate_enrollments SET ${fields.map(f => `\`${f}\` = ?`).join(', ')} WHERE id = ?`,
      [...fields.map(f => req.body[f]), req.params.id]
    );

    const [[candidate]] = await db.query(
      'SELECT id, full_name, linkedin_email, ssn_last4, marketing_email FROM candidate_enrollments WHERE id = ?',
      [req.params.id]
    );
    if (!candidate) return notFound(res, 'Candidate not found');
    return ok(res, candidate);
  } catch (err) {
    return serverError(res, err);
  }
}

module.exports = { list, pipelineStats, getOne, enroll, update, updateStage, updateCredentials };
