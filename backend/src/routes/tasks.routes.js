const router = require('express').Router();
const c = require('../controllers/tasks.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/change-requests/mine',         c.myChangeRequests);
router.get('/change-requests/pending',      c.pendingChangeRequests);
router.patch('/change-requests/:id/review', c.reviewChangeRequest);
router.get('/',              c.list);
router.get('/:id',           c.getOne);
router.post('/',             c.create);
router.post('/:id/change-requests', c.requestChange);
router.patch('/:id',         c.update);
router.patch('/:id/status',  c.updateStatus);
router.delete('/:id',        c.remove);

module.exports = router;
