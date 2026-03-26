const router = require('express').Router();
const c = require('../controllers/employees.controller');
const hrCtrl = require('../controllers/hr.controller');
const { authenticate, requireRole, SENIOR_LEADERSHIP } = require('../middleware/auth');

router.use(authenticate);

// Lookup routes (accessible to all authenticated)
router.get('/departments', c.departments);
router.get('/teams',       c.teams);

// Employee CRUD
router.get('/',                                    c.list);
router.get('/:id',                                 c.getOne);
router.post('/',                                   requireRole(SENIOR_LEADERSHIP), c.create);
router.patch('/:id',                               c.update);

// Salary management
router.patch('/:id/salary',                        requireRole(SENIOR_LEADERSHIP), c.updateSalary);
router.get('/:id/salary-history',                  requireRole(SENIOR_LEADERSHIP), c.getSalaryHistory);
router.post('/:id/salary-history',                 requireRole(SENIOR_LEADERSHIP), c.addSalaryHistory);

// Auth management
router.post('/:id/reset-password',                 requireRole(SENIOR_LEADERSHIP), c.resetPassword);

// Avatar upload
router.post('/:id/avatar',                         hrCtrl.uploadAvatar);

module.exports = router;
