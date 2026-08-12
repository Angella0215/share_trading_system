const db = require('../config/db');

exports.sendMessage = async (req, res) => {
    const sender = req.user.user_id;
    const { receiver, message } = req.body;

    if (!receiver || !message) {
        return res.status(400).json({ message: 'Please provide a receiver and a message.' });
    }

    try {
        const [receiverRows] = await db.query('SELECT user_id FROM users WHERE user_id = ?', [receiver]);
        if (receiverRows.length === 0) {
            return res.status(404).json({ message: 'Receiver not found.' });
        }

        const [result] = await db.query(
            'INSERT INTO messages (sender, receiver, message) VALUES (?, ?, ?)',
            [sender, receiver, message]
        );

        res.status(201).json({
            message: 'Message sent.',
            message_id: result.insertId
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.getConversation = async (req, res) => {
    const currentUser = req.user.user_id;
    const { other_user_id } = req.params;

    try {
        const [rows] = await db.query(
            `SELECT m.message_id, m.sender, m.receiver, m.message, m.date, u.fullname AS sender_name
             FROM messages m
             JOIN users u ON m.sender = u.user_id
             WHERE (m.sender = ? AND m.receiver = ?) OR (m.sender = ? AND m.receiver = ?)
             ORDER BY m.date ASC`,
            [currentUser, other_user_id, other_user_id, currentUser]
        );

        res.status(200).json(rows);

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};