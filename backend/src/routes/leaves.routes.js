const router = require('express').Router();
const c = require('../controllers/leaves.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const TL_ROLES  = ['marketing_tl','sales_head','technical_head','resume_head','assistant_tl'];
const MGR_ROLES = ['ops_head'];
const LEAVE_APPROVER_ROLES = [...TL_ROLES, ...MGR_ROLES];

router.use(authenticate);

router.get('/',                   c.list);
router.post('/',                  c.submit);
router.get('/pending-tl',         requireRole(LEAVE_APPROVER_ROLES), c.pendingForTL);
router.get('/pending-manager',    requireRole(MGR_ROLES), c.pendingForManager);
router.patch('/:id/approve-tl',   requireRole(LEAVE_APPROVER_ROLES), c.approveByTL);
router.patch('/:id/approve-manager', requireRole(MGR_ROLES), c.approveByManager);
router.patch('/:id/reject',       requireRole(LEAVE_APPROVER_ROLES), c.reject);
router.patch('/:id',              c.update);
router.delete('/:id',             c.remove);

module.exports = router;
