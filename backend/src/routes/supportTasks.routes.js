const router = require('express').Router();
const c = require('../controllers/supportTasks.controller');
const { authenticate, requireRole, APPROVERS, SUPPORT_TASK_CREATORS } = require('../middleware/auth');

router.use(authenticate);

router.get('/',                         c.list);
router.get('/:id',                      c.getOne);
router.post('/',                        requireRole(SUPPORT_TASK_CREATORS), c.create);
router.patch('/:id/status',             c.updateStatus);
router.patch('/:id/call-status',        c.updateCallStatus);
router.patch('/:id/reassign',           requireRole(APPROVERS), c.reassign);
router.post('/:id/comments',            c.addComment);
router.patch('/:id',                    c.update);
router.delete('/:id',                   requireRole(['director','hr_head','technical_head']), c.remove);

module.exports = router;
