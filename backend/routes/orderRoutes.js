const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const upload = require('../config/upload');

router.post('/buy', verifyToken, requireRole('investor'), upload.single('proof_of_payment'), orderController.createBuyOrder);
router.put('/buy/:order_id/approve', verifyToken, requireRole('broker', 'admin'), orderController.approveBuyOrder);
router.post('/sell', verifyToken, requireRole('investor'), orderController.createSellOrder);
router.put('/sell/:sell_id/approve', verifyToken, requireRole('broker', 'admin'), orderController.approveSellOrder);
router.get('/my-orders', verifyToken, requireRole('investor'), orderController.getMyOrders);
router.get('/buy/pending', verifyToken, requireRole('broker', 'admin'), orderController.getPendingBuyOrders);
router.get('/sell/pending', verifyToken, requireRole('broker', 'admin'), orderController.getPendingSellOrders);

module.exports = router;