const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/:filename', verifyToken, fileController.getFile);

module.exports = router;