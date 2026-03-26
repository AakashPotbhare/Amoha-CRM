const router = require('express').Router();
const c = require('../controllers/tasks.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/',              c.list);
router.get('/:id',           c.getOne);
router.post('/',             c.create);
router.patch('/:id',         c.update);
router.patch('/:id/status',  c.updateStatus);

module.exports = router;
