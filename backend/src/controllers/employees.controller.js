const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { ok, created, notFound, badRequest, serverError } = require('../utils/response');
const { sendWelcomeEmail } = require('../services/email.service');

const VALID_ROLES = [
  'director','ops_head','hr_head',
  'sales_head','technical_head','marketing_tl','resume_head','compliance_officer',
  'assistant_tl','sales_executive','lead_generator',
  'technical_executive','senior_recruiter','recruiter','resume_builder',
];

const ROLE_LABELS = {
  director:            'Director',
  ops_head:            'Operations Head',
  hr_head:             'HR Head',
  sales_head:          'Sales Head',
  technical_head:      'Technical Head',
  marketing_tl:        'Marketing Team Lead',
  resume_head:         'Resume Head',
  compliance_officer:  'Compliance Officer',
  assistant_tl:        'Assistant TL',
  sales_executive:     'Sales Executive',
  lead_generator:      'Lead Generator',
  technical_executive: 'Technical Executive',
  senior_recruiter:    'Senior Recruiter',
  recruiter:           'Recruiter',
  resume_builder:      'Resume Builder',
};

async function getNextEmployeeCode() {
  const [[row]] = await db.query(
    `SELECT MAX(CAST(SUBSTRING(employee_code, 4) AS UNSIGNED)) AS max_seq
     FROM employees
     WHERE employee_code REGEXP '^ARS[0-9]{5}$'`
  );

  const nextSeq = Number(row?.max_seq || 0) + 1;
  if (nextSeq > 99999) {
    throw new Error('Employee code limit reached for ARS99999');
  }

  return `ARS${String(nextSeq).padStart(5, '0')}`;
}

// GET /api/employees
async function list(req, res) {
  try {
    const { department_id, team_id, role, is_active } = req.query;

    const conditions = ['1=1'];
    const params = [];

    if (department_id) { conditions.push('e.department_id = ?'); params.push(department_id); }
    if (team_id)       { conditions.push('e.team_id = ?');       params.push(team_id); }
    if (role)          { conditions.push('e.role = ?');           params.push(role); }

    // Default to active only; pass is_active=all to get everyone
    if (is_active === 'all') {
      // no filter
    } else {
      const activeFilter = (is_active === 'false' || is_active === '0') ? 0 : 1;
      conditions.push('e.is_active = ?');
      params.push(activeFilter);
    }

    const [rows] = await db.query(
      `SELECT e.id, e.employee_code, e.full_name, e.email, e.phone, e.role,
              e.department_id, e.team_id,
              e.dob, e.designation, e.joining_date, e.is_active,
              e.base_salary, e.pf_percentage, e.professional_tax,
              e.avatar_url,
              d.name AS department_name, d.slug AS department_slug,
              t.name AS team_name,
              e.created_at
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN teams       t ON e.team_id       = t.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.full_name ASC`,
      params
    );

    return ok(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/employees/:id
async function getOne(req, res) {
  try {
    const [[emp]] = await db.query(
      `SELECT e.id, e.employee_code, e.full_name, e.email, e.phone, e.role,
              e.dob, e.designation, e.joining_date, e.is_active,
              e.base_salary, e.pf_percentage, e.professional_tax,
              e.avatar_url,
              d.name AS department_name, d.slug AS department_slug,
              t.name AS team_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN teams       t ON e.team_id       = t.id
       WHERE e.id = ?`,
      [req.params.id]
    );
    if (!emp) return notFound(res, 'Employee not found');
    return ok(res, emp);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/employees  — HR Head / Director / Ops Head only
async function create(req, res) {
  try {
    const {
      employee_code: providedCode,
      full_name, email, phone,
      dob, designation,
      role = 'recruiter',
      department_id, team_id,
      joining_date,
      base_salary, pf_percentage, professional_tax,
      password = 'Amoha@2026',
    } = req.body;

    if (!full_name || !role || !department_id) {
      return badRequest(res, 'full_name, role, and department_id are required');
    }
    if (!VALID_ROLES.includes(role)) {
      return badRequest(res, `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    // Auto-generate employee code if not provided
    let employee_code = providedCode ? providedCode.toUpperCase() : '';
    if (!employee_code) {
      employee_code = await getNextEmployeeCode();
    } else if (!/^ARS\d{5}$/.test(employee_code)) {
      return badRequest(res, 'employee_code must follow the ARS00001 format');
    }

    // Default team_id if not provided — use first team in the department
    let resolvedTeamId = team_id;
    if (!resolvedTeamId) {
      const [[firstTeam]] = await db.query('SELECT id FROM teams WHERE department_id = ? LIMIT 1', [department_id]);
      if (firstTeam) resolvedTeamId = firstTeam.id;
    }

    const hash = await bcrypt.hash(password, 12);
    const id   = uuidv4();

    await db.query(
      `INSERT INTO employees
         (id, employee_code, full_name, email, phone, password_hash, role,
          dob, designation, department_id, team_id, joining_date,
          base_salary, pf_percentage, professional_tax)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, employee_code.toUpperCase(), full_name, email || null, phone || null, hash, role,
        dob || null, designation || null, department_id, resolvedTeamId || null,
        joining_date || null,
        base_salary ? Number(base_salary) : null,
        pf_percentage != null ? Number(pf_percentage) : 12,
        professional_tax != null ? Number(professional_tax) : 200,
      ]
    );

    const [[emp]] = await db.query(
      `SELECT e.id, e.employee_code, e.full_name, e.email, e.phone, e.role,
              e.dob, e.designation, e.joining_date, e.is_active,
              e.base_salary, e.pf_percentage, e.professional_tax,
              d.name AS department_name, t.name AS team_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN teams       t ON e.team_id       = t.id
       WHERE e.id = ?`,
      [id]
    );
    // Send welcome email with credentials (fire-and-forget)
    sendWelcomeEmail(emp, password).catch(() => {});

    return created(res, { ...emp, defaultPassword: password });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return badRequest(res, 'Employee code or email already exists');
    }
    return serverError(res, err);
  }
}

// PATCH /api/employees/:id
async function update(req, res) {
  try {
    const allowed = [
      'full_name','email','phone','role',
      'dob','designation',
      'department_id','team_id',
      'joining_date','is_active',
      'base_salary','pf_percentage','professional_tax',
    ];
    const fields = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!fields.length) return badRequest(res, 'No valid fields to update');

    if (req.body.role && !VALID_ROLES.includes(req.body.role)) {
      return badRequest(res, `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    await db.query(
      `UPDATE employees SET ${fields.map(f => `${f} = ?`).join(', ')}, updated_at = NOW() WHERE id = ?`,
      [...fields.map(f => req.body[f]), req.params.id]
    );

    const [[emp]] = await db.query(
      `SELECT e.id, e.employee_code, e.full_name, e.email, e.phone, e.role,
              e.dob, e.designation, e.joining_date, e.is_active,
              e.base_salary, e.pf_percentage, e.professional_tax,
              e.avatar_url,
              d.name AS department_name, d.slug AS department_slug,
              t.name AS team_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN teams       t ON e.team_id       = t.id
       WHERE e.id = ?`,
      [req.params.id]
    );
    if (!emp) return notFound(res, 'Employee not found');
    return ok(res, emp);
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/employees/:id/salary  — log history + update
async function updateSalary(req, res) {
  try {
    const { salary, base_salary, pf_percentage, professional_tax, effective_date, reason } = req.body;
    const newSalary = base_salary || salary;
    if (!newSalary) return badRequest(res, 'base_salary is required');

    const [[emp]] = await db.query('SELECT id, base_salary FROM employees WHERE id = ?', [req.params.id]);
    if (!emp) return notFound(res, 'Employee not found');

    // Log salary history
    await db.query(
      `INSERT INTO salary_history (id, employee_id, previous_salary, new_salary, effective_date, reason, changed_by_employee_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), req.params.id, emp.base_salary || 0, newSalary,
       effective_date || new Date().toISOString().slice(0, 10),
       reason || null, req.employee.id]
    );

    const updates = { base_salary: Number(newSalary) };
    if (pf_percentage != null) updates.pf_percentage = Number(pf_percentage);
    if (professional_tax != null) updates.professional_tax = Number(professional_tax);

    const fields = Object.keys(updates);
    await db.query(
      `UPDATE employees SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`,
      [...fields.map(f => updates[f]), req.params.id]
    );

    return ok(res, { id: req.params.id, ...updates });
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/employees/:id/salary-history
async function getSalaryHistory(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT sh.*, e.full_name AS changed_by_name
       FROM salary_history sh
       LEFT JOIN employees e ON sh.changed_by_employee_id = e.id
       WHERE sh.employee_id = ?
       ORDER BY sh.created_at DESC`,
      [req.params.id]
    );
    return ok(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/employees/:id/salary-history  — manual log entry
async function addSalaryHistory(req, res) {
  try {
    const {
      previous_salary, new_salary,
      effective_date, reason,
    } = req.body;
    if (previous_salary == null || new_salary == null) {
      return badRequest(res, 'previous_salary and new_salary are required');
    }
    const id = uuidv4();
    await db.query(
      `INSERT INTO salary_history (id, employee_id, previous_salary, new_salary, effective_date, reason, changed_by_employee_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.id, previous_salary, new_salary,
       effective_date || new Date().toISOString().slice(0, 10),
       reason || null, req.employee.id]
    );
    const [[row]] = await db.query('SELECT * FROM salary_history WHERE id = ?', [id]);
    return created(res, row);
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/employees/:id/reset-password
async function resetPassword(req, res) {
  try {
    const newPassword = req.body.password || 'Amoha@2026';
    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE employees SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    return ok(res, { message: 'Password reset successfully', temporaryPassword: newPassword });
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/employees/departments
async function departments(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM departments ORDER BY name ASC');
    return ok(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/employees/teams?department_id=
async function teams(req, res) {
  try {
    const { department_id } = req.query;
    const [rows] = await db.query(
      `SELECT t.*, d.name AS department_name FROM teams t
       LEFT JOIN departments d ON t.department_id = d.id
       ${department_id ? 'WHERE t.department_id = ?' : ''}
       ORDER BY t.name ASC`,
      department_id ? [department_id] : []
    );
    return ok(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

module.exports = {
  list, getOne, create, update,
  updateSalary, getSalaryHistory, addSalaryHistory,
  resetPassword, departments, teams,
  ROLE_LABELS,
};
