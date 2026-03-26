const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/notifications.controller');

router.use(authenticate);

router.get('/',               ctrl.list);
router.patch('/read-all',     ctrl.markAllRead);   // must come before /:id/read
router.patch('/:id/read',     ctrl.markRead);

module.exports = router;
