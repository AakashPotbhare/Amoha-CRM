const router = require('express').Router();
const { login, changePassword, me, forgotPassword, verifyResetToken, resetPassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/login',              login);
router.post('/forgot-password',    forgotPassword);
router.get('/verify-reset-token',  verifyResetToken);
router.post('/reset-password',     resetPassword);

// Protected routes
router.post('/change-password', authenticate, changePassword);
router.get('/me',               authenticate, me);

module.exports = router;
