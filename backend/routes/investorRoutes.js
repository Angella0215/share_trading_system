const express = require('express');
const router = express.Router();
const investorController = require('../controllers/investorController');
const upload = require('../config/upload');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.post(
    '/open-account',
    upload.fields([
        { name: 'utility_receipt', maxCount: 1 },
        { name: 'bank_statement', maxCount: 1 },
        { name: 'id_document', maxCount: 1 }
    ]),
    investorController.openAccount
);

router.get('/pending', verifyToken, requireRole('broker', 'admin'), investorController.getPendingApplications);
router.put('/:investor_id/approve', verifyToken, requireRole('broker', 'admin'), investorController.approveAccount);
router.put('/:investor_id/reject', verifyToken, requireRole('broker', 'admin'), investorController.rejectAccount);
router.get('/me', verifyToken, requireRole('investor'), investorController.getMyAccount);

module.exports = router;