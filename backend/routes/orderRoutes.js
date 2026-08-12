const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.post('/buy', verifyToken, requireRole('investor'), orderController.createBuyOrder);
router.put('/buy/:order_id/approve', verifyToken, requireRole('broker', 'admin'), orderController.approveBuyOrder);
router.post('/sell', verifyToken, requireRole('investor'), orderController.createSellOrder);
router.put('/sell/:sell_id/approve', verifyToken, requireRole('broker', 'admin'), orderController.approveSellOrder);

module.exports = router;