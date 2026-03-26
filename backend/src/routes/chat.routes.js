const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const c = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads/chat')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', c.listConversations);
router.post('/start', c.startConversation);
router.get('/:conversationId/messages', c.getMessages);
router.post('/:conversationId/messages', c.sendMessage);
router.post('/upload', upload.single('file'), c.uploadFile);

module.exports = router;
