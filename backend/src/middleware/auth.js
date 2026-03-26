const jwt = require('jsonwebtoken');
const db  = require('../config/db');

/**
 * Verifies JWT and attaches employee to req.employee.
 * All protected routes use this middleware.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Optionally refresh employee data from DB on each request
  const [[emp]] = await db.query(
    `SELECT e.*, d.name AS dept_name, d.slug AS dept_slug, t.name AS team_name
     FROM employees e
     LEFT JOIN departments d ON e.department_id = d.id
     LEFT JOIN teams       t ON e.team_id = t.id
     WHERE e.id = ? AND e.is_active = 1`,
    [payload.employeeId]
  );

  if (!emp) {
    return res.status(401).json({ error: 'Employee not found or inactive' });
  }

  req.employee = emp;
  next();
}

/**
 * Returns middleware that checks if the employee has a required role.
 * Usage: router.get('/hr', authenticate, requireRole(['director','ops_head','hr_head']), handler)
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.employee.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

const LEADERSHIP = ['director', 'ops_head'];
const SENIOR_LEADERSHIP = ['director', 'ops_head', 'hr_head'];
const DEPT_HEADS = ['sales_head', 'technical_head', 'marketing_tl', 'resume_head'];
const APPROVERS  = [...LEADERSHIP, 'hr_head', ...DEPT_HEADS, 'assistant_tl'];

// Any role that can create support tasks (request technical/resume/etc. help for a candidate)
const SUPPORT_TASK_CREATORS = [
  ...APPROVERS,
  'recruiter', 'senior_recruiter', 'sales_executive', 'lead_generator',
  'technical_executive', 'resume_builder', 'compliance_officer',
];

module.exports = { authenticate, requireRole, LEADERSHIP, SENIOR_LEADERSHIP, DEPT_HEADS, APPROVERS, SUPPORT_TASK_CREATORS };
