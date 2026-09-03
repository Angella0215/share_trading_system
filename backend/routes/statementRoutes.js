const express = require('express');
const router = express.Router();
const statementController = require('../controllers/statementController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/shareholding', verifyToken, requireRole('investor'), statementController.getShareholdingStatement);
router.get('/transactions', verifyToken, requireRole('investor'), statementController.getTransactionStatement);

module.exports = router;