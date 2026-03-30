const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { ok, created, notFound, badRequest, serverError } = require('../utils/response');
const { createNotification } = require('../services/notification.service');

const PIPELINE_STAGES = ['enrolled', 'resume_building', 'marketing_active', 'interview_stage', 'placed', 'rejected'];
const SALES_ENROLL_ROLES = ['director', 'hr_head', 'sales_head', 'assistant_tl', 'sales_executive', 'lead_generator'];
const GENERAL_EDIT_ROLES = ['director', 'hr_head', 'sales_head', 'assistant_tl', 'sales_executive'];
const CREDENTIAL_EDIT_ROLES = ['director', 'hr_head', 'marketing_tl', 'recruiter', 'senior_recruiter'];
const RESUME_UPLOAD_ROLES = ['director', 'hr_head', 'marketing_tl', 'recruiter', 'senior_recruiter', 'resume_head', 'resume_builder'];
const CREDENTIAL_VIEW_ROLES = ['director', 'hr_head', 'marketing_tl', 'recruiter', 'senior_recruiter'];
const RESUME_UPLOAD_DIR = path.join(__dirname, '../../uploads/candidate-resumes');
let ensureResumeTablePromise = null;

function buildBaseUrl() {
  return process.env.BASE_URL || process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`;
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

async function ensureResumeInfrastructure() {
  if (!ensureResumeTablePromise) {
    ensureResumeTablePromise = db.query(`
      CREATE TABLE IF NOT EXISTS candidate_resume_versions (
        id                     CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
        candidate_enrollment_id CHAR(36)     NOT NULL,
        uploaded_by_employee_id CHAR(36)     NOT NULL,
        support_task_id        CHAR(36)      NULL,
        file_url               VARCHAR(500)  NOT NULL,
        file_name              VARCHAR(255)  NOT NULL,
        notes                  TEXT          NULL,
        is_current             BOOLEAN       NOT NULL DEFAULT TRUE,
        created_at             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (candidate_enrollment_id) REFERENCES candidate_enrollments(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by_employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (support_task_id)        REFERENCES support_tasks(id) ON DELETE SET NULL,
        INDEX idx_resume_candidate (candidate_enrollment_id, created_at),
        INDEX idx_resume_current (candidate_enrollment_id, is_current)
      )
    `);
  }

  await ensureResumeTablePromise;
}

const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(RESUME_UPLOAD_DIR, { recursive: true });
    cb(null, RESUME_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uuidv4()}-${safeName}`);
  },
});

const resumeUpload = multer({
  storage: resumeStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

function mapCandidateRow(c) {
  return {
    ...c,
    interview_count: Number(c.interview_count || 0),
    completed_interview_count: Number(c.completed_interview_count || 0),
    resume_update_count: Number(c.resume_update_count || 0),
  };
}

function roleIncludes(roleList, role) {
  return roleList.includes(role);
}

function sanitizeCandidate(candidate, role) {
  if (!candidate) return candidate;
  const mapped = mapCandidateRow(candidate);
  if (roleIncludes(CREDENTIAL_VIEW_ROLES, role)) return mapped;

  const {
    linkedin_email,
    linkedin_passcode,
    marketing_email,
    marketing_email_password,
    ssn_last4,
    ...rest
  } = mapped;

  return rest;
}

async function fetchCandidateById(id) {
  await ensureResumeInfrastructure();

  const [[candidate]] = await db.query(
    `SELECT ce.*,
            e.full_name  AS enrolled_by_name,
            sp.full_name AS salesperson_name,
            COALESCE(interview_stats.interview_count, 0)         AS interview_count,
            COALESCE(interview_stats.completed_interview_count, 0) AS completed_interview_count,
            COALESCE(resume_stats.resume_update_count, 0)        AS resume_update_count,
            resume_stats.current_resume_url,
            resume_stats.current_resume_name,
            resume_stats.current_resume_uploaded_at
     FROM candidate_enrollments ce
     LEFT JOIN employees e  ON ce.enrolled_by_employee_id = e.id
     LEFT JOIN employees sp ON ce.salesperson_employee_id = sp.id
     LEFT JOIN (
       SELECT candidate_enrollment_id,
              COUNT(*) AS interview_count,
              SUM(CASE
                    WHEN status = 'completed' OR call_status = 'completed' THEN 1
                    ELSE 0
                  END) AS completed_interview_count
       FROM support_tasks
       WHERE candidate_enrollment_id IS NOT NULL
         AND task_type IN ('interview_support','assessment_support','mock_call','preparation_call')
       GROUP BY candidate_enrollment_id
     ) interview_stats ON interview_stats.candidate_enrollment_id = ce.id
     LEFT JOIN (
       SELECT candidate_enrollment_id,
              COUNT(*) AS resume_update_count,
              SUBSTRING_INDEX(
                GROUP_CONCAT(CASE WHEN is_current = TRUE THEN file_url END ORDER BY created_at DESC SEPARATOR '||'),
                '||',
                1
              ) AS current_resume_url,
              SUBSTRING_INDEX(
                GROUP_CONCAT(CASE WHEN is_current = TRUE THEN file_name END ORDER BY created_at DESC SEPARATOR '||'),
                '||',
                1
              ) AS current_resume_name,
              MAX(CASE WHEN is_current = TRUE THEN created_at END) AS current_resume_uploaded_at
       FROM candidate_resume_versions
       GROUP BY candidate_enrollment_id
     ) resume_stats ON resume_stats.candidate_enrollment_id = ce.id
     WHERE ce.id = ?`,
    [id]
  );

  return candidate ? mapCandidateRow(candidate) : null;
}

// GET /api/candidates
async function list(req, res) {
  try {
    await ensureResumeInfrastructure();

    const { stage, search, enrolled_by, page = 1, limit = 200 } = req.query;
    const offset = (toInt(page, 1) - 1) * toInt(limit, 200);
    const params = [];
    const conditions = [];

    if (stage) {
      conditions.push('ce.pipeline_stage = ?');
      params.push(stage);
    }
    if (enrolled_by) {
      conditions.push('ce.enrolled_by_employee_id = ?');
      params.push(enrolled_by);
    }
    if (search) {
      conditions.push('(ce.full_name LIKE ? OR ce.phone LIKE ? OR ce.email LIKE ? OR ce.current_domain LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM candidate_enrollments ce ${where}`,
      params
    );

    const [rows] = await db.query(
      `SELECT ce.*,
              e.full_name  AS enrolled_by_name,
              sp.full_name AS salesperson_name,
              COALESCE(interview_stats.interview_count, 0)           AS interview_count,
              COALESCE(interview_stats.completed_interview_count, 0) AS completed_interview_count,
              COALESCE(resume_stats.resume_update_count, 0)          AS resume_update_count,
              resume_stats.current_resume_url,
              resume_stats.current_resume_name,
              resume_stats.current_resume_uploaded_at
       FROM candidate_enrollments ce
       LEFT JOIN employees e  ON ce.enrolled_by_employee_id = e.id
       LEFT JOIN employees sp ON ce.salesperson_employee_id = sp.id
       LEFT JOIN (
         SELECT candidate_enrollment_id,
                COUNT(*) AS interview_count,
                SUM(CASE
                      WHEN status = 'completed' OR call_status = 'completed' THEN 1
                      ELSE 0
                    END) AS completed_interview_count
         FROM support_tasks
         WHERE candidate_enrollment_id IS NOT NULL
           AND task_type IN ('interview_support','assessment_support','mock_call','preparation_call')
         GROUP BY candidate_enrollment_id
       ) interview_stats ON interview_stats.candidate_enrollment_id = ce.id
       LEFT JOIN (
         SELECT candidate_enrollment_id,
                COUNT(*) AS resume_update_count,
                SUBSTRING_INDEX(
                  GROUP_CONCAT(CASE WHEN is_current = TRUE THEN file_url END ORDER BY created_at DESC SEPARATOR '||'),
                  '||',
                  1
                ) AS current_resume_url,
                SUBSTRING_INDEX(
                  GROUP_CONCAT(CASE WHEN is_current = TRUE THEN file_name END ORDER BY created_at DESC SEPARATOR '||'),
                  '||',
                  1
                ) AS current_resume_name,
                MAX(CASE WHEN is_current = TRUE THEN created_at END) AS current_resume_uploaded_at
         FROM candidate_resume_versions
         GROUP BY candidate_enrollment_id
       ) resume_stats ON resume_stats.candidate_enrollment_id = ce.id
       ${where}
       ORDER BY ce.updated_at DESC, ce.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, toInt(limit, 200), offset]
    );

    return ok(res, rows.map(row => sanitizeCandidate(row, req.employee.role)), { total, page: toInt(page, 1), limit: toInt(limit, 200) });
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
    const map = Object.fromEntries(PIPELINE_STAGES.map(stage => [stage, 0]));
    rows.forEach(row => { map[row.stage] = Number(row.count); });
    return ok(res, map);
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/candidates/:id
async function getOne(req, res) {
  try {
    const candidate = await fetchCandidateById(req.params.id);
    if (!candidate) return notFound(res, 'Candidate not found');
    return ok(res, sanitizeCandidate(candidate, req.employee.role));
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/candidates/:id/resumes
async function listResumes(req, res) {
  try {
    await ensureResumeInfrastructure();

    const [rows] = await db.query(
      `SELECT crv.*,
              e.full_name AS uploaded_by_name,
              e.employee_code AS uploaded_by_code
       FROM candidate_resume_versions crv
       LEFT JOIN employees e ON crv.uploaded_by_employee_id = e.id
       WHERE crv.candidate_enrollment_id = ?
       ORDER BY crv.created_at DESC`,
      [req.params.id]
    );

    return ok(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/candidates/:id/resumes
async function uploadResume(req, res) {
  await ensureResumeInfrastructure();

  resumeUpload.single('resume')(req, res, async (err) => {
    if (err) return badRequest(res, err.message);

    try {
      if (!roleIncludes(RESUME_UPLOAD_ROLES, req.employee.role)) {
        return res.status(403).json({ success: false, error: 'Only marketing, resume, HR, or director roles can upload candidate resumes' });
      }
      const { id } = req.params;
      const { notes, support_task_id } = req.body;

      const [[candidate]] = await db.query(
        'SELECT id FROM candidate_enrollments WHERE id = ?',
        [id]
      );
      if (!candidate) return notFound(res, 'Candidate not found');
      if (!req.file) return badRequest(res, 'Resume file is required');

      const versionId = uuidv4();
      const fileUrl = `${buildBaseUrl()}/uploads/candidate-resumes/${req.file.filename}`;

      await db.query(
        'UPDATE candidate_resume_versions SET is_current = FALSE WHERE candidate_enrollment_id = ?',
        [id]
      );

      await db.query(
        `INSERT INTO candidate_resume_versions
           (id, candidate_enrollment_id, uploaded_by_employee_id, support_task_id, file_url, file_name, notes, is_current)
         VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [versionId, id, req.employee.id, support_task_id || null, fileUrl, req.file.originalname, notes || null]
      );

      if (support_task_id) {
        const uploadMessage = [
          `${req.employee.full_name} uploaded a new resume version`,
          req.file.originalname ? `(${req.file.originalname})` : '',
          notes ? `- ${notes}` : '',
        ].filter(Boolean).join(' ');

        await db.query(
          `UPDATE support_tasks
           SET status = 'completed'
           WHERE id = ?`,
          [support_task_id]
        );

        await db.query(
          'INSERT INTO task_comments (id, support_task_id, employee_id, content) VALUES (?, ?, ?, ?)',
          [uuidv4(), support_task_id, req.employee.id, uploadMessage]
        );

        const [[task]] = await db.query(
          `SELECT st.id,
                  st.assigned_to_employee_id,
                  st.created_by_employee_id,
                  COALESCE(ce.full_name, st.candidate_name) AS candidate_name
           FROM support_tasks st
           LEFT JOIN candidate_enrollments ce ON ce.id = st.candidate_enrollment_id
           WHERE st.id = ?`,
          [support_task_id]
        );

        const recipients = Array.from(new Set(
          [task?.created_by_employee_id, task?.assigned_to_employee_id].filter(
            (recipientId) => recipientId && recipientId !== req.employee.id
          )
        ));

        await Promise.all(recipients.map((recipientId) => createNotification(db, {
          recipient_id: recipientId,
          title: 'Resume task completed',
          body: task?.candidate_name
            ? `Updated resume uploaded for ${task.candidate_name}`
            : 'An updated candidate resume was uploaded',
          type: 'success',
          entity_type: 'support_task',
          entity_id: support_task_id,
        })));
      }

      const [[version]] = await db.query(
        `SELECT crv.*,
                e.full_name AS uploaded_by_name,
                e.employee_code AS uploaded_by_code
         FROM candidate_resume_versions crv
         LEFT JOIN employees e ON crv.uploaded_by_employee_id = e.id
         WHERE crv.id = ?`,
        [versionId]
      );

      return created(res, version);
    } catch (e) {
      return serverError(res, e);
    }
  });
}

// DELETE /api/candidates/:id/resumes/:resumeId
async function deleteResume(req, res) {
  try {
    const { id, resumeId } = req.params;

    if (!roleIncludes(RESUME_UPLOAD_ROLES, req.employee.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions to delete resume versions' });
    }

    const [[version]] = await db.query(
      'SELECT id, is_current, file_url FROM candidate_resume_versions WHERE id = ? AND candidate_enrollment_id = ?',
      [resumeId, id]
    );
    if (!version) return notFound(res, 'Resume version not found');

    // Delete the record
    await db.query('DELETE FROM candidate_resume_versions WHERE id = ?', [resumeId]);

    // If it was the current version, promote the most recent remaining version
    if (version.is_current) {
      await db.query(
        `UPDATE candidate_resume_versions
         SET is_current = TRUE
         WHERE candidate_enrollment_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [id]
      );
    }

    return ok(res, { deleted: true });
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/candidates
async function enroll(req, res) {
  try {
    if (!roleIncludes(SALES_ENROLL_ROLES, req.employee.role)) {
      return res.status(403).json({ success: false, error: 'Only sales roles, HR, or director can enroll candidates' });
    }

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
      plan_type,
      plan_price,
      discount_amount,
      installment_1_amount,
      installment_1_paid_date,
      installment_2_amount,
      installment_2_paid_date,
      next_payment_date,
      next_payment_amount,
      referred_by_name,
      referral_bonus_amount,
      salesperson_employee_id,
      lead_person_name,
      payment_methods,
    } = req.body;

    if (!full_name || !phone) {
      return badRequest(res, 'full_name and phone are required');
    }

    const resolvedDob = dob || date_of_birth || null;
    const resolvedVisaStatus = visa_status || visa_type || null;
    const resolvedVisaExpire = visa_expire_date || visa_expiry || null;
    const resolvedLocationZip = current_location_zip || current_location || null;
    const resolvedDomain = current_domain || technology || profession || null;
    const resolvedYrsExp = years_experience || experience_years || null;
    const resolvedStage = pipeline_stage || 'enrolled';

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

    if (salesperson_employee_id) {
      try {
        const { createNotification } = require('../services/notification.service');
        await createNotification(db, {
          recipient_id: salesperson_employee_id,
          title: `New Candidate Enrolled: ${full_name}`,
          body: 'A new candidate has been enrolled under your account.',
          type: 'success',
          entity_type: 'candidate_enrollment',
          entity_id: id,
        });
      } catch (_) {
        // non-blocking
      }
    }

    const candidate = await fetchCandidateById(id);
    return created(res, sanitizeCandidate(candidate, req.employee.role));
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/candidates/:id
async function update(req, res) {
  try {
    const generalAllowed = [
      'full_name', 'phone', 'email', 'dob',
      'gender', 'visa_status', 'visa_expire_date', 'ead_start_date', 'ead_end_date',
      'current_location_zip', 'nearest_metro_area', 'open_for_relocation', 'native_country',
      'current_domain', 'years_experience',
      'veteran_status', 'security_clearance', 'race_ethnicity', 'total_certifications',
      'highest_qualification',
      'bachelors_field', 'bachelors_university', 'bachelors_start_date', 'bachelors_end_date',
      'masters_field', 'masters_university', 'masters_start_date', 'masters_end_date',
      'availability_for_calls', 'availability_to_start', 'arrived_in_usa',
      'salary_expectations', 'notes',
      'plan_type', 'plan_price', 'discount_amount',
      'installment_1_amount', 'installment_1_paid_date',
      'installment_2_amount', 'installment_2_paid_date',
      'next_payment_date', 'next_payment_amount',
      'referred_by_name', 'referral_bonus_amount',
      'salesperson_employee_id', 'lead_person_name',
      'payment_methods', 'pipeline_stage',
    ];
    const credentialAllowed = ['linkedin_email', 'linkedin_passcode', 'ssn_last4', 'marketing_email', 'marketing_email_password'];
    const allowed = [
      ...(roleIncludes(GENERAL_EDIT_ROLES, req.employee.role) ? generalAllowed : []),
      ...(roleIncludes(CREDENTIAL_EDIT_ROLES, req.employee.role) ? credentialAllowed : []),
    ];

    if (!allowed.length) {
      return res.status(403).json({ success: false, error: 'You do not have permission to update this candidate' });
    }

    const fields = Object.keys(req.body).filter(key => allowed.includes(key));
    if (!fields.length) return badRequest(res, 'No valid fields to update');

    const values = fields.map(field => {
      if (field === 'payment_methods') {
        const value = req.body[field];
        return value ? JSON.stringify(Array.isArray(value) ? value : [value]) : null;
      }
      return req.body[field];
    });

    await db.query(
      `UPDATE candidate_enrollments SET ${fields.map(field => `\`${field}\` = ?`).join(', ')} WHERE id = ?`,
      [...values, req.params.id]
    );

    const candidate = await fetchCandidateById(req.params.id);
    if (!candidate) return notFound(res, 'Candidate not found');
    return ok(res, sanitizeCandidate(candidate, req.employee.role));
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/candidates/:id/stage
async function updateStage(req, res) {
  try {
    const { stage } = req.body;
    if (!PIPELINE_STAGES.includes(stage)) {
      return badRequest(res, `Invalid stage. Must be one of: ${PIPELINE_STAGES.join(', ')}`);
    }

    await db.query(
      'UPDATE candidate_enrollments SET pipeline_stage = ? WHERE id = ?',
      [stage, req.params.id]
    );

    const candidate = await fetchCandidateById(req.params.id);
    if (!candidate) return notFound(res, 'Candidate not found');
    return ok(res, sanitizeCandidate(candidate, req.employee.role));
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/candidates/:id/credentials
async function updateCredentials(req, res) {
  try {
    if (!roleIncludes(CREDENTIAL_EDIT_ROLES, req.employee.role)) {
      return res.status(403).json({ success: false, error: 'Only marketing roles, HR, or director can update candidate credentials' });
    }
    const allowed = ['linkedin_email', 'linkedin_passcode', 'ssn_last4', 'marketing_email', 'marketing_email_password'];
    const fields = Object.keys(req.body).filter(key => allowed.includes(key));
    if (!fields.length) return badRequest(res, 'No credential fields provided');

    await db.query(
      `UPDATE candidate_enrollments SET ${fields.map(field => `\`${field}\` = ?`).join(', ')} WHERE id = ?`,
      [...fields.map(field => req.body[field]), req.params.id]
    );

    const [[candidate]] = await db.query(
      'SELECT id, full_name, linkedin_email, linkedin_passcode, ssn_last4, marketing_email, marketing_email_password FROM candidate_enrollments WHERE id = ?',
      [req.params.id]
    );
    if (!candidate) return notFound(res, 'Candidate not found');
    return ok(res, sanitizeCandidate(candidate, req.employee.role));
  } catch (err) {
    return serverError(res, err);
  }
}

// DELETE /api/candidates/:id
async function remove(req, res) {
  try {
    const isAdmin = ['director', 'hr_head'].includes(req.employee.role);
    if (!isAdmin) return badRequest(res, 'Only directors or HR Head can delete candidates');

    const [rows] = await db.query('SELECT id FROM candidate_enrollments WHERE id = ?', [req.params.id]);
    if (!rows.length) return notFound(res, 'Candidate not found');

    await db.query('DELETE FROM candidate_enrollments WHERE id = ?', [req.params.id]);
    return ok(res, { message: 'Candidate deleted' });
  } catch (err) {
    console.error('candidates.remove error:', err);
    return serverError(res, err);
  }
}

module.exports = {
  list,
  pipelineStats,
  getOne,
  listResumes,
  uploadResume,
  deleteResume,
  enroll,
  update,
  updateStage,
  updateCredentials,
  remove,
};
