const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { logAudit } = require('../utils/audit');

exports.getFile = async (req, res) => {
    // Only the bare file name is accepted: no folders, no "..".
    const name = path.basename(String(req.params.filename || ''));
    if (!/^[\w.\-]+$/.test(name)) {
        return res.status(400).json({ message: 'Invalid file name.' });
    }

    const fullPath = path.resolve('uploads', name);
    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ message: 'Document not found.' });
    }

    try {
        let allowed = false;

        if (req.user.role === 'broker') {
            allowed = true;
        } else if (req.user.role === 'investor') {
            // Investors may only open their own KYC documents and payment proofs.
            const like = '%' + name;
            const [rows] = await db.query(
                `SELECT 1 FROM investors i
                 WHERE i.user_id = ?
                   AND (i.utility_receipt_path LIKE ? OR i.bank_statement_path LIKE ? OR i.id_document_path LIKE ?
                        OR EXISTS (SELECT 1 FROM buy_orders bo
                                   WHERE bo.investor_id = i.investor_id AND bo.proof_of_payment_path LIKE ?))
                 LIMIT 1`,
                [req.user.user_id, like, like, like, like]
            );
            allowed = rows.length > 0;
        }

        if (!allowed) {
            return res.status(403).json({ message: 'You do not have permission to open this document.' });
        }

        await logAudit(req.user, 'document_viewed', null, null, null, 'Opened document ' + name);

        res.set({
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff'
        });
        res.sendFile(fullPath);

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};