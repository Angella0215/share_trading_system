const bcrypt = require('bcrypt');
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const transporter = require('../config/mailer');

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

exports.requestPasswordReset = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Please provide your email address.' });
    }

    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        // Always return success even if the email doesn't exist, so we
        // don't reveal which emails are registered on the platform.
        if (users.length === 0) {
            return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
        }

        const user = users[0];
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await db.query(
            'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE user_id = ?',
            [token, expiry, user.user_id]
        );
        const resetLink = 'http://localhost:5500/frontend/reset-password.html?token=' + token;

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Password Reset - Stockbrokers Malawi Limited',
            html: '<p>Hello ' + user.fullname + ',</p>' +
                  '<p>You requested to reset your password. Click the link below to set a new one. This link expires in 1 hour.</p>' +
                  '<p><a href="' + resetLink + '">' + resetLink + '</a></p>' +
                  '<p>If you did not request this, you can safely ignore this email.</p>'
        });

        res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.confirmPasswordReset = async (req, res) => {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
        return res.status(400).json({ message: 'Please provide the reset token and a new password.' });
    }

    if (new_password.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    try {
        const [users] = await db.query(
            'SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ message: 'This reset link is invalid or has expired. Please request a new one.' });
        }

        const user = users[0];
        const hashedPassword = await bcrypt.hash(new_password, 10);

        await db.query(
            'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE user_id = ?',
            [hashedPassword, user.user_id]
        );

        res.status(200).json({ message: 'Password reset successfully. You can now log in with your new password.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};