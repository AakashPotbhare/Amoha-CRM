const router = require('express').Router();
const c = require('../controllers/candidates.controller');
const { authenticate, requireRole, APPROVERS } = require('../middleware/auth');

// All candidate routes require auth
router.use(authenticate);

router.get('/',              c.list);
router.get('/pipeline-stats', c.pipelineStats);
router.get('/:id/resumes',   c.listResumes);
router.post('/:id/resumes',  c.uploadResume);
router.get('/:id',           c.getOne);
router.post('/',             c.enroll);
router.patch('/:id',         c.update);
router.patch('/:id/stage',       requireRole([...APPROVERS, 'sales_executive', 'lead_generator']), c.updateStage);
router.patch('/:id/credentials', c.updateCredentials);   // TL/marketing fills LinkedIn & marketing creds
router.delete('/:id',            requireRole(['director','hr_head']), c.remove);

module.exports = router;
