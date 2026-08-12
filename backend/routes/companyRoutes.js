const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', companyController.getAllCompanies);
router.get('/:company_id/history', companyController.getPriceHistory);
router.put('/:company_id/update-price', verifyToken, requireRole('admin'), companyController.updatePrice);

module.exports = router;