const bcrypt = require('bcrypt');
const db = require('../config/db');

exports.register = async (req, res) => {
    const { fullname, email, phone, password, role } = req.body;

    if (!fullname || !email || !password || !role) {
        return res.status(400).json({ message: 'Please fill in all required fields.' });
    }

    try {
        const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Email already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            'INSERT INTO users (fullname, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
            [fullname, email, phone, hashedPassword, role]
        );

        res.status(201).json({
            message: 'Registration successful.',
            user_id: result.insertId
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};