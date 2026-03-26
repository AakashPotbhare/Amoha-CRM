const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/placementOffers.controller');

router.use(authenticate);

// Director-only delete guard
function directorOnly(req, res, next) {
  if (req.employee.role !== 'director') {
    return res.status(403).json({ success: false, error: 'Director access required' });
  }
  next();
}

router.get('/stats',    ctrl.stats);        // GET  /api/placement-orders/stats
router.get('/',         ctrl.list);         // GET  /api/placement-orders
router.get('/:id',      ctrl.getOne);       // GET  /api/placement-orders/:id
router.post('/',        ctrl.create);       // POST /api/placement-orders
router.patch('/:id',    ctrl.update);       // PATCH /api/placement-orders/:id
router.delete('/:id',   directorOnly, ctrl.remove); // DELETE /api/placement-orders/:id

module.exports = router;
