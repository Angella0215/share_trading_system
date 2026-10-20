const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', verifyToken, requireRole('admin'), auditController.getAuditLog);

module.exports = router;