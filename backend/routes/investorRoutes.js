const express = require('express');
const router = express.Router();
const investorController = require('../controllers/investorController');
const upload = require('../config/upload');

router.post(
    '/open-account',
    upload.fields([
        { name: 'utility_receipt', maxCount: 1 },
        { name: 'bank_statement', maxCount: 1 },
        { name: 'id_document', maxCount: 1 }
    ]),
    investorController.openAccount
);

module.exports = router;