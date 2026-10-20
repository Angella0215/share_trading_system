const rateLimit = require('express-rate-limit');

// TESTING ONLY: login attempts are unlimited while skip returns true.
// Before going live, delete the skip line (or set it to () => false)
// to bring back the 5 attempts per 15 minutes limit.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    skip: () => true,
    message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = loginLimiter;