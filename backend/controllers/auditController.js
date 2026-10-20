const db = require('../config/db');

exports.getAuditLog = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT a.log_id, a.user_name, a.role, a.action, a.entity_type, a.entity_id,
                    a.details, a.created_at, c.company_name
             FROM audit_log a
             LEFT JOIN companies c ON a.company_id = c.company_id
             ORDER BY a.created_at DESC, a.log_id DESC
             LIMIT 500`
        );
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};