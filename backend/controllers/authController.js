const bcrypt = require('bcrypt');
const db = require('../config/db');
const jwt = require('jsonwebtoken');

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


exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password.' });
    }

    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user = users[0];

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { user_id: user.user_id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(200).json({
            message: 'Login successful.',
            token,
            user: {
                user_id: user.user_id,
                fullname: user.fullname,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.getBrokers = async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT user_id, fullname FROM users WHERE role = 'broker'"
        );
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.getInvestors = async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT user_id, fullname FROM users WHERE role = 'investor'"
        );
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT user_id, fullname, email, role, status, created_at FROM users ORDER BY created_at DESC'
        );
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};