const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/analytics.controller');

router.use(authenticate);

// Support task aggregates — by period, dept, employee
router.get('/support-tasks',              c.supportTaskStats);

// Full interview history for a candidate (used in Sales/Marketing dashboards)
router.get('/candidate/:id/history',      c.candidateHistory);

// Individual employee performance breakdown
router.get('/employee/:id/performance',   c.employeePerformance);

// Department-level summary with per-employee stats
router.get('/departments/:slug/summary',  c.departmentSummary);

// Placement offer analytics — by team, period
router.get('/placement-orders',           c.placementOrderAnalytics);

module.exports = router;
