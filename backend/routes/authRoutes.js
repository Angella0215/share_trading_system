const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const loginLimiter = require('../middleware/rateLimiter');

router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.get('/brokers', verifyToken, authController.getBrokers);
router.get('/investors-list', verifyToken, authController.getInvestors);
router.get('/users', verifyToken, requireRole('admin'), authController.getAllUsers);
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/confirm-password-reset', authController.confirmPasswordReset);
router.post('/google-login', authController.googleLogin);

module.exports = router;