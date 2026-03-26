const router = require('express').Router();
const c = require('../controllers/hr.controller');
const { authenticate, requireRole, SENIOR_LEADERSHIP } = require('../middleware/auth');

router.use(authenticate);

// Notices — readable by all, writable by leadership/hr
router.get('/notices',                    c.listNotices);
router.post('/notices',                   requireRole(SENIOR_LEADERSHIP), c.createNotice);
router.patch('/notices/:id',              requireRole(SENIOR_LEADERSHIP), c.updateNotice);
router.delete('/notices/:id',             requireRole(SENIOR_LEADERSHIP), c.deleteNotice);

// Salary history — HR / leadership only
router.get('/salary-history/:employee_id', requireRole(SENIOR_LEADERSHIP), c.salaryHistory);

// Documents — employees can upload/delete their own; HR can upload for anyone
router.get('/documents/:employee_id',               c.listDocuments);
router.post('/documents/:employee_id',              c.uploadDocument);
router.delete('/documents/:employee_id/:doc_id',    c.deleteDocument);

// Shifts & office locations
router.get('/shifts',                     c.listShifts);
router.post('/shifts',                    requireRole(SENIOR_LEADERSHIP), c.createShift);
router.get('/office-locations',           c.listOfficeLocations);
router.post('/office-locations',          requireRole(SENIOR_LEADERSHIP), c.createOfficeLocation);

// Leave balance
router.get('/leave-balance/:employee_id', c.leaveBalance);

module.exports = router;
