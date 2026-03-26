const db = require('../config/db');
const { ok, notFound, serverError } = require('../utils/response');

const LEADERSHIP = ['director', 'ops_head', 'hr_head'];
const TL_ROLES   = ['marketing_tl', 'sales_head', 'technical_head', 'resume_head', 'compliance_officer', 'assistant_tl'];

// ─── Period helper ────────────────────────────────────────────────────────────
function periodRange(period = 'month', date_from, date_to) {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);

  switch (period) {
    case 'today':
      return { from: today, to: today };

    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      return { from: d.toISOString().slice(0, 10), to: today };
    }
    case 'month':
      return {
        from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
        to:   today,
      };
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      return {
        from: `${now.getFullYear()}-${String(q * 3 + 1).padStart(2, '0')}-01`,
        to:   today,
      };
    }
    case 'year':
      return { from: `${now.getFullYear()}-01-01`, to: today };

    case 'custom':
      return { from: date_from || '2000-01-01', to: date_to || today };

    default:
      return {
        from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
        to:   today,
      };
  }
}

/* ────────────────────────────────────────────────────────────
   GET /api/analytics/support-tasks
   ──────────────────────────────────────────────────────────── */
exports.supportTaskStats = async (req, res) => {
  try {
    const emp = req.employee;
    const { period, date_from, date_to, department_id, employee_id } = req.query;
    const { from, to } = periodRange(period, date_from, date_to);

    const conditions = ['DATE(st.scheduled_at) BETWEEN ? AND ?'];
    const params     = [from, to];

    // Role-based default scoping
    if (!LEADERSHIP.includes(emp.role)) {
      if (TL_ROLES.includes(emp.role)) {
        conditions.push('st.department_id = ?');
        params.push(emp.department_id);
      } else {
        // Individual: can only see their own tasks unless filtered by leadership
        conditions.push('st.assigned_to_employee_id = ?');
        params.push(emp.id);
      }
    }

    // Caller-supplied filters (leadership only adds these without scoping their own)
    if (department_id) { conditions.push('st.department_id = ?');          params.push(department_id); }
    if (employee_id)   { conditions.push('st.assigned_to_employee_id = ?'); params.push(employee_id); }

    const where = 'WHERE ' + conditions.join(' AND ');

    const [rows] = await db.query(
      `SELECT st.task_type, st.interview_round, st.call_status, st.status,
              st.assigned_to_employee_id, DATE(st.scheduled_at) AS day,
              e.full_name AS employee_name
       FROM support_tasks st
       LEFT JOIN employees e ON st.assigned_to_employee_id = e.id
       ${where}
       ORDER BY day ASC`,
      params
    );

    // Aggregate in JS — single DB round-trip
    const total      = rows.length;
    const completed  = rows.filter(r => r.status === 'completed').length;
    const pending    = rows.filter(r => r.status === 'pending').length;
    const inProgress = rows.filter(r => r.status === 'in_progress').length;
    const noShow     = rows.filter(r => r.call_status === 'no_show').length;

    const by_type  = {};
    const by_round = {};
    const byEmpMap = {};
    const trendMap = {};

    for (const r of rows) {
      by_type[r.task_type] = (by_type[r.task_type] || 0) + 1;

      if (r.interview_round) {
        by_round[r.interview_round] = (by_round[r.interview_round] || 0) + 1;
      }

      if (r.assigned_to_employee_id) {
        if (!byEmpMap[r.assigned_to_employee_id]) {
          byEmpMap[r.assigned_to_employee_id] = {
            employee_id: r.assigned_to_employee_id,
            full_name:   r.employee_name,
            total: 0, completed: 0, no_show: 0,
          };
        }
        byEmpMap[r.assigned_to_employee_id].total += 1;
        if (r.status === 'completed')       byEmpMap[r.assigned_to_employee_id].completed += 1;
        if (r.call_status === 'no_show')    byEmpMap[r.assigned_to_employee_id].no_show   += 1;
      }

      const dayStr = r.day ? String(r.day).slice(0, 10) : null;
      if (dayStr) {
        if (!trendMap[dayStr]) trendMap[dayStr] = { date: dayStr, total: 0, completed: 0 };
        trendMap[dayStr].total += 1;
        if (r.status === 'completed') trendMap[dayStr].completed += 1;
      }
    }

    return ok(res, {
      period: { from, to },
      summary: {
        total, completed, pending,
        in_progress:     inProgress,
        no_show:         noShow,
        completion_rate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
      },
      by_type,
      by_round,
      by_employee: Object.values(byEmpMap),
      trend:       Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (err) {
    return serverError(res, err);
  }
};

/* ────────────────────────────────────────────────────────────
   GET /api/analytics/candidate/:id/history
   ──────────────────────────────────────────────────────────── */
exports.candidateHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const [[enrollment]] = await db.query(
      `SELECT ce.id, ce.full_name, ce.pipeline_stage, ce.current_domain, ce.created_at
       FROM candidate_enrollments ce WHERE ce.id = ?`,
      [id]
    );
    if (!enrollment) return notFound(res, 'Candidate not found');

    const [history] = await db.query(
      `SELECT st.id, st.task_type, st.company_name, st.interview_round,
              st.scheduled_at, st.status, st.call_status,
              st.feedback, st.questions_asked,
              e.full_name   AS assignee_name,
              e.designation AS assignee_designation
       FROM support_tasks st
       LEFT JOIN employees e ON st.assigned_to_employee_id = e.id
       WHERE st.candidate_enrollment_id = ?
       ORDER BY st.scheduled_at ASC`,
      [id]
    );

    return ok(res, { enrollment, history });
  } catch (err) {
    return serverError(res, err);
  }
};

/* ────────────────────────────────────────────────────────────
   GET /api/analytics/employee/:id/performance
   Query: period, date_from, date_to
   ──────────────────────────────────────────────────────────── */
exports.employeePerformance = async (req, res) => {
  try {
    const { id } = req.params;
    const { period, date_from, date_to } = req.query;
    const { from, to } = periodRange(period, date_from, date_to);

    const [[employee]] = await db.query(
      `SELECT e.id, e.full_name, e.designation, e.avatar_url, e.employee_code,
              d.name AS department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.id = ?`,
      [id]
    );
    if (!employee) return notFound(res, 'Employee not found');

    const [tasks] = await db.query(
      `SELECT st.task_type, st.status, st.call_status, st.feedback,
              DATE(st.scheduled_at)        AS day,
              YEARWEEK(st.scheduled_at, 1) AS week_key
       FROM support_tasks st
       WHERE st.assigned_to_employee_id = ?
         AND DATE(st.scheduled_at) BETWEEN ? AND ?
       ORDER BY day ASC`,
      [id, from, to]
    );

    const total     = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const noShow    = tasks.filter(t => t.call_status === 'no_show').length;

    const by_type  = {};
    const weekMap  = {};

    for (const t of tasks) {
      by_type[t.task_type] = (by_type[t.task_type] || 0) + 1;

      const wk = String(t.week_key);
      if (wk && wk !== 'null') {
        if (!weekMap[wk]) weekMap[wk] = { week: wk, total: 0, completed: 0 };
        weekMap[wk].total += 1;
        if (t.status === 'completed') weekMap[wk].completed += 1;
      }
    }

    const withFeedback = tasks.filter(t => t.feedback && t.feedback.trim().length > 10);
    const avgFeedbackWords = withFeedback.length > 0
      ? Math.round(withFeedback.reduce((s, t) => s + t.feedback.trim().split(/\s+/).length, 0) / withFeedback.length)
      : 0;

    return ok(res, {
      employee,
      period: { from, to },
      summary: {
        total, completed,
        completion_rate:  total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
        no_show:          noShow,
        no_show_rate:     total > 0 ? Math.round((noShow / total) * 1000) / 10 : 0,
        avg_feedback_words: avgFeedbackWords,
      },
      by_type,
      weekly_trend: Object.values(weekMap).sort((a, b) => a.week.localeCompare(b.week)),
    });
  } catch (err) {
    return serverError(res, err);
  }
};

/* ────────────────────────────────────────────────────────────
   GET /api/analytics/departments/:slug/summary
   ──────────────────────────────────────────────────────────── */
exports.departmentSummary = async (req, res) => {
  try {
    const { slug } = req.params;
    const { period, date_from, date_to } = req.query;
    const { from, to } = periodRange(period, date_from, date_to);

    const [[dept]] = await db.query(
      'SELECT id, name, slug FROM departments WHERE slug = ?',
      [slug]
    );
    if (!dept) return notFound(res, 'Department not found');

    const [emps] = await db.query(
      `SELECT e.id, e.full_name, e.designation, e.employee_code, t.name AS team_name
       FROM employees e
       LEFT JOIN teams t ON e.team_id = t.id
       WHERE e.department_id = ? AND e.is_active = 1`,
      [dept.id]
    );

    const [tasks] = await db.query(
      `SELECT st.assigned_to_employee_id, st.task_type, st.status, st.call_status
       FROM support_tasks st
       WHERE st.department_id = ?
         AND DATE(st.scheduled_at) BETWEEN ? AND ?`,
      [dept.id, from, to]
    );

    const employees = emps.map(emp => {
      const empTasks  = tasks.filter(t => t.assigned_to_employee_id === emp.id);
      const total     = empTasks.length;
      const completed = empTasks.filter(t => t.status === 'completed').length;
      const noShow    = empTasks.filter(t => t.call_status === 'no_show').length;
      const by_type   = {};
      for (const t of empTasks) by_type[t.task_type] = (by_type[t.task_type] || 0) + 1;
      return {
        ...emp, total, completed, no_show: noShow,
        completion_rate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
        by_type,
      };
    });

    const deptTotal     = tasks.length;
    const deptCompleted = tasks.filter(t => t.status === 'completed').length;

    return ok(res, {
      department: dept,
      period: { from, to },
      summary: {
        total:          deptTotal,
        completed:      deptCompleted,
        completion_rate: deptTotal > 0 ? Math.round((deptCompleted / deptTotal) * 1000) / 10 : 0,
        employee_count: emps.length,
      },
      employees,
    });
  } catch (err) {
    return serverError(res, err);
  }
};

/* ────────────────────────────────────────────────────────────
   GET /api/analytics/placement-orders
   ──────────────────────────────────────────────────────────── */
exports.placementOrderAnalytics = async (req, res) => {
  try {
    const emp = req.employee;
    const { period, date_from, date_to, team_id, department_id } = req.query;
    const { from, to } = periodRange(period, date_from, date_to);

    const conditions = [`DATE(po.offer_date) BETWEEN '${from}' AND '${to}'`];
    const params     = [];

    if (!LEADERSHIP.includes(emp.role)) {
      conditions.push('po.team_id = ?');
      params.push(emp.team_id);
    }
    if (team_id)       { conditions.push('po.team_id = ?');      params.push(team_id); }
    if (department_id) { conditions.push('t.department_id = ?'); params.push(department_id); }

    const where = 'WHERE ' + conditions.join(' AND ');

    const [byTeam] = await db.query(
      `SELECT tm.name AS team_name, po.team_id,
              COUNT(*) AS total_pos,
              COALESCE(SUM(po.annual_package), 0)   AS total_package,
              COALESCE(SUM(po.final_amount_due), 0) AS total_due,
              COALESCE(SUM(po.upfront_paid), 0)     AS total_upfront,
              SUM(po.status = 'completed')           AS completed
       FROM placement_offers po
       LEFT JOIN teams t  ON po.team_id = t.id
       LEFT JOIN teams tm ON po.team_id = tm.id
       ${where}
       GROUP BY po.team_id, tm.name
       ORDER BY total_pos DESC`,
      params
    );

    const [[totals]] = await db.query(
      `SELECT COUNT(*) AS total_pos,
              COALESCE(SUM(po.annual_package), 0)   AS total_package,
              COALESCE(SUM(po.final_amount_due), 0) AS total_due,
              COALESCE(SUM(po.upfront_paid), 0)     AS total_upfront,
              SUM(po.status = 'completed')           AS completed
       FROM placement_offers po
       LEFT JOIN teams t ON po.team_id = t.id
       ${where}`,
      params
    );

    return ok(res, { period: { from, to }, totals, by_team: byTeam });
  } catch (err) {
    return serverError(res, err);
  }
};
