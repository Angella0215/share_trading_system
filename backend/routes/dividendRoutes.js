const express = require('express');
const router = express.Router();
const dividendController = require('../controllers/dividendController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Investor
router.get('/my', verifyToken, requireRole('investor'), dividendController.getMyDividends);

// Admin
router.post('/', verifyToken, requireRole('admin'), dividendController.declareDividend);
router.post('/:dividend_id/calculate', verifyToken, requireRole('admin'), dividendController.calculatePayouts);
router.put('/:dividend_id/cancel', verifyToken, requireRole('admin'), dividendController.cancelDividend);

// Admin and broker (read)
router.get('/', verifyToken, requireRole('admin', 'broker'), dividendController.listDividends);
router.get('/:dividend_id/payouts', verifyToken, requireRole('admin', 'broker'), dividendController.getDividendPayouts);

// Broker (maker-checker + payment record)
router.put('/:dividend_id/first-approve', verifyToken, requireRole('broker'), dividendController.firstApproveDividend);
router.put('/:dividend_id/final-approve', verifyToken, requireRole('broker'), dividendController.finalApproveDividend);
router.put('/:dividend_id/mark-paid', verifyToken, requireRole('broker'), dividendController.markDividendPaid);

module.exports = router;