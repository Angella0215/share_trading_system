const db = require('../config/db');

// Records who did what. Never throws, so a logging problem can't break an order.
exports.logAudit = async function (user, action, entityType, entityId, companyId, details) {
    try {
        let name = null;
        if (user && user.user_id) {
            const [rows] = await db.query('SELECT fullname FROM users WHERE user_id = ?', [user.user_id]);
            name = rows.length ? rows[0].fullname : null;
        }
        await db.query(
            `INSERT INTO audit_log (user_id, user_name, role, action, entity_type, entity_id, company_id, details)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [user ? user.user_id : null, name, user ? user.role : null, action,
             entityType || null, entityId || null, companyId || null, details || null]
        );
    } catch (error) {
        console.error('Audit log failed:', error.message);
    }
};