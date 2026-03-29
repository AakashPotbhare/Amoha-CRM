const router = require('express').Router();
const c = require('../controllers/attendance.controller');
const { authenticate, requireRole, SENIOR_LEADERSHIP } = require('../middleware/auth');

router.use(authenticate);

router.post('/check-in',       c.checkIn);
router.post('/check-out',      c.checkOut);
router.post('/undo-checkout',  c.undoCheckout);
router.post('/break/start',    c.startBreak);
router.post('/break/end',      c.endBreak);
router.get('/today',           c.today);
router.get('/monthly',         c.monthly);
router.get('/report',          requireRole(SENIOR_LEADERSHIP), c.report);

// Admin override routes (director / hr_head only)
router.post('/manual',         requireRole(['director','hr_head']), c.manualEntry);
router.patch('/:id',           requireRole(['director','hr_head']), c.adminUpdate);

module.exports = router;
