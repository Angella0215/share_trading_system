const rateLimit = require('express-rate-limit');

// Limits login attempts to prevent brute-force password guessing.
// Allows 5 attempts per 15 minutes per IP address, then blocks
// further attempts until the window resets.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = loginLimiter;