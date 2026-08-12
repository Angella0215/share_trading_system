const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/', verifyToken, messageController.sendMessage);
router.get('/:other_user_id', verifyToken, messageController.getConversation);

module.exports = router;