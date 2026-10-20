const db = require('../config/db');
const { logAudit } = require('../utils/audit');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function money(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
}

// ---------------------------------------------------------------------------
// ADMIN: declare a dividend
// ---------------------------------------------------------------------------
exports.declareDividend = async (req, res) => {
    const { company_id, amount_per_share, tax_rate, record_date, payment_date } = req.body;

    const amount = parseFloat(amount_per_share);
    const tax = parseFloat(tax_rate === undefined || tax_rate === '' ? 0 : tax_rate);

    if (!company_id || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Please choose a company and enter a dividend per share above 0.' });
    }
    if (isNaN(tax) || tax < 0 || tax > 100) {
        return res.status(400).json({ message: 'Tax rate must be between 0 and 100.' });
    }
    if (!DATE_RE.test(record_date || '') || !DATE_RE.test(payment_date || '')) {
        return res.status(400).json({ message: 'Please enter a valid record date and payment date.' });
    }
    if (payment_date < record_date) {
        return res.status(400).json({ message: 'The payment date cannot be before the record date.' });
    }

    try {
        const [companyRows] = await db.query('SELECT company_name FROM companies WHERE company_id = ?', [company_id]);
        if (companyRows.length === 0) {
            return res.status(404).json({ message: 'Company not found.' });
        }

        const [result] = await db.query(
            `INSERT INTO dividends (company_id, amount_per_share, tax_rate, record_date, payment_date, status, declared_by)
             VALUES (?, ?, ?, ?, ?, 'declared', ?)`,
            [company_id, amount.toFixed(4), tax.toFixed(2), record_date, payment_date, req.user.user_id]
        );

        await logAudit(req.user, 'dividend_declared', 'dividend', result.insertId, company_id,
            'Declared dividend of MWK ' + amount.toFixed(4) + ' per share for ' + companyRows[0].company_name +
            ' (tax ' + tax.toFixed(2) + '%, record date ' + record_date + ', payment date ' + payment_date + ')');

        res.status(201).json({ message: 'Dividend declared.', dividend_id: result.insertId });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// ---------------------------------------------------------------------------
// ADMIN + BROKER: list dividends (brokers only see ones that reached them)
// ---------------------------------------------------------------------------
exports.listDividends = async (req, res) => {
    try {
        const brokerFilter = req.user.role === 'broker'
            ? "WHERE d.status IN ('calculated', 'first_approved', 'approved', 'paid')"
            : '';

        const [rows] = await db.query(
            `SELECT d.dividend_id, d.company_id, d.amount_per_share, d.tax_rate, d.status,
                    DATE_FORMAT(d.record_date, '%Y-%m-%d') AS record_date,
                    DATE_FORMAT(d.payment_date, '%Y-%m-%d') AS payment_date,
                    (d.record_date <= CURDATE()) AS record_date_reached,
                    d.first_approver_id, d.payment_reference, d.created_at,
                    c.company_name, c.ticker,
                    u.fullname AS declared_by_name,
                    f.fullname AS first_approver_name,
                    fa.fullname AS final_approver_name,
                    (SELECT COUNT(*) FROM dividend_payouts p WHERE p.dividend_id = d.dividend_id) AS payout_count,
                    (SELECT COALESCE(SUM(p.gross_amount), 0) FROM dividend_payouts p WHERE p.dividend_id = d.dividend_id) AS total_gross,
                    (SELECT COALESCE(SUM(p.tax_amount), 0) FROM dividend_payouts p WHERE p.dividend_id = d.dividend_id) AS total_tax,
                    (SELECT COALESCE(SUM(p.net_amount), 0) FROM dividend_payouts p WHERE p.dividend_id = d.dividend_id) AS total_net
             FROM dividends d
             JOIN companies c ON d.company_id = c.company_id
             LEFT JOIN users u ON d.declared_by = u.user_id
             LEFT JOIN users f ON d.first_approver_id = f.user_id
             LEFT JOIN users fa ON d.final_approver_id = fa.user_id
             ${brokerFilter}
             ORDER BY d.created_at DESC, d.dividend_id DESC`
        );
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// ---------------------------------------------------------------------------
// ADMIN: work out each investor's payout from holdings AS AT the record date
// ---------------------------------------------------------------------------
exports.calculatePayouts = async (req, res) => {
    const { dividend_id } = req.params;

    let conn;
    try {
        const [divRows] = await db.query(
            `SELECT d.*, DATE_FORMAT(d.record_date, '%Y-%m-%d') AS record_date_str, c.company_name, (d.record_date <= CURDATE()) AS reached
             FROM dividends d JOIN companies c ON d.company_id = c.company_id
             WHERE d.dividend_id = ?`, [dividend_id]
        );
        if (divRows.length === 0) {
            return res.status(404).json({ message: 'Dividend not found.' });
        }
        const dividend = divRows[0];

        if (dividend.status !== 'declared') {
            return res.status(400).json({ message: 'Payouts were already calculated for this dividend, or it was cancelled.' });
        }
        if (!dividend.reached) {
            return res.status(400).json({ message: 'The record date has not been reached yet. Calculate on or after the record date.' });
        }

        // Shares held on the record date = shares owned now, with anything
        // traded after the record date reversed (sells added back, buys removed).
        const [holders] = await db.query(
            `SELECT p.investor_id,
                    p.shares_owned + COALESCE(SUM(CASE WHEN t.type = 'sell' THEN t.quantity
                                                       WHEN t.type = 'buy' THEN -t.quantity END), 0) AS shares_held
             FROM portfolio p
             LEFT JOIN transactions t
               ON t.investor_id = p.investor_id AND t.company_id = p.company_id
              AND t.transaction_date >= DATE_ADD(?, INTERVAL 1 DAY)
             WHERE p.company_id = ?
             GROUP BY p.investor_id, p.shares_owned
             HAVING shares_held > 0`,
            [dividend.record_date_str, dividend.company_id]
        );

        if (holders.length === 0) {
            return res.status(400).json({ message: 'No investor held shares in this company on the record date.' });
        }

        const perShare = parseFloat(dividend.amount_per_share);
        const taxRate = parseFloat(dividend.tax_rate);

        const rows = holders.map(function (h) {
            const shares = Number(h.shares_held);
            const gross = shares * perShare;
            const tax = gross * taxRate / 100;
            const net = gross - tax;
            return [dividend.dividend_id, h.investor_id, shares, money(gross), money(tax), money(net), 'pending'];
        });

        conn = await db.getConnection();
        await conn.beginTransaction();

        const [statusUpdate] = await conn.query(
            "UPDATE dividends SET status = 'calculated' WHERE dividend_id = ? AND status = 'declared'",
            [dividend.dividend_id]
        );
        if (statusUpdate.affectedRows === 0) {
            await conn.rollback();
            return res.status(409).json({ message: 'This dividend was just updated by someone else.' });
        }

        await conn.query(
            `INSERT INTO dividend_payouts
             (dividend_id, investor_id, shares_held, gross_amount, tax_amount, net_amount, status)
             VALUES ?`,
            [rows]
        );

        await conn.commit();

        await logAudit(req.user, 'dividend_calculated', 'dividend', dividend.dividend_id, dividend.company_id,
            'Calculated payouts for ' + rows.length + ' investor(s) as at record date ' +
            dividend.record_date_str);

        res.status(200).json({ message: 'Payouts calculated for ' + rows.length + ' investor(s). Brokers can now review them.' });

    } catch (error) {
        if (conn) {
            try { await conn.rollback(); } catch (e) { /* ignore */ }
        }
        res.status(500).json({ message: 'Server error: ' + error.message });
    } finally {
        if (conn) conn.release();
    }
};

// ---------------------------------------------------------------------------
// ADMIN: cancel a dividend before it is approved
// ---------------------------------------------------------------------------
exports.cancelDividend = async (req, res) => {
    const { dividend_id } = req.params;

    try {
        const [divRows] = await db.query('SELECT * FROM dividends WHERE dividend_id = ?', [dividend_id]);
        if (divRows.length === 0) {
            return res.status(404).json({ message: 'Dividend not found.' });
        }
        const dividend = divRows[0];

        if (dividend.status !== 'declared' && dividend.status !== 'calculated') {
            return res.status(400).json({ message: 'Only a dividend that has not been approved yet can be cancelled.' });
        }

        await db.query(
            "UPDATE dividends SET status = 'cancelled' WHERE dividend_id = ? AND status IN ('declared', 'calculated')",
            [dividend_id]
        );

        await logAudit(req.user, 'dividend_cancelled', 'dividend', dividend.dividend_id, dividend.company_id,
            'Cancelled dividend #' + dividend.dividend_id);

        res.status(200).json({ message: 'Dividend cancelled.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// ---------------------------------------------------------------------------
// BROKER: first approval
// ---------------------------------------------------------------------------
exports.firstApproveDividend = async (req, res) => {
    const { dividend_id } = req.params;

    try {
        const [divRows] = await db.query('SELECT * FROM dividends WHERE dividend_id = ?', [dividend_id]);
        if (divRows.length === 0) {
            return res.status(404).json({ message: 'Dividend not found.' });
        }
        const dividend = divRows[0];

        if (dividend.status !== 'calculated') {
            return res.status(400).json({ message: 'This dividend is not waiting for first approval.' });
        }

        await db.query(
            "UPDATE dividends SET status = 'first_approved', first_approver_id = ?, first_approved_at = NOW() WHERE dividend_id = ? AND status = 'calculated'",
            [req.user.user_id, dividend_id]
        );

        await logAudit(req.user, 'dividend_first_approved', 'dividend', dividend.dividend_id, dividend.company_id,
            'First approval of dividend #' + dividend.dividend_id);

        res.status(200).json({ message: 'First approval recorded. A different broker must give final approval.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// ---------------------------------------------------------------------------
// BROKER: final approval (must be a different broker)
// ---------------------------------------------------------------------------
exports.finalApproveDividend = async (req, res) => {
    const { dividend_id } = req.params;

    try {
        const [divRows] = await db.query('SELECT * FROM dividends WHERE dividend_id = ?', [dividend_id]);
        if (divRows.length === 0) {
            return res.status(404).json({ message: 'Dividend not found.' });
        }
        const dividend = divRows[0];

        if (dividend.status !== 'first_approved') {
            return res.status(400).json({ message: 'This dividend needs first approval before it can be finalized.' });
        }
        if (dividend.first_approver_id === req.user.user_id) {
            return res.status(403).json({ message: 'The final approver must be different from the first approver (maker-checker control).' });
        }

        await db.query(
            "UPDATE dividends SET status = 'approved', final_approver_id = ?, final_approved_at = NOW() WHERE dividend_id = ? AND status = 'first_approved'",
            [req.user.user_id, dividend_id]
        );

        await logAudit(req.user, 'dividend_final_approved', 'dividend', dividend.dividend_id, dividend.company_id,
            'Final approval of dividend #' + dividend.dividend_id);

        res.status(200).json({ message: 'Dividend approved. Pay the investors, then mark it as paid with the bank reference.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// ---------------------------------------------------------------------------
// BROKER: record that the money was paid out, and tell every investor
// ---------------------------------------------------------------------------
exports.markDividendPaid = async (req, res) => {
    const { dividend_id } = req.params;
    const reference = String(req.body.payment_reference || '').trim();

    if (reference.length < 3) {
        return res.status(400).json({ message: 'Please enter the payment reference (at least 3 characters).' });
    }

    let conn;
    try {
        const [divRows] = await db.query('SELECT * FROM dividends WHERE dividend_id = ?', [dividend_id]);
        if (divRows.length === 0) {
            return res.status(404).json({ message: 'Dividend not found.' });
        }
        const dividend = divRows[0];

        if (dividend.status !== 'approved') {
            return res.status(400).json({ message: 'Only an approved dividend can be marked as paid.' });
        }

        conn = await db.getConnection();
        await conn.beginTransaction();

        const [upd] = await conn.query(
            "UPDATE dividends SET status = 'paid', paid_by = ?, paid_at = NOW(), payment_reference = ? WHERE dividend_id = ? AND status = 'approved'",
            [req.user.user_id, reference, dividend_id]
        );
        if (upd.affectedRows === 0) {
            await conn.rollback();
            return res.status(409).json({ message: 'This dividend was just updated by someone else.' });
        }

        await conn.query("UPDATE dividend_payouts SET status = 'paid' WHERE dividend_id = ?", [dividend_id]);

        // One message per investor, shown in their Messages page (and unread badge).
        await conn.query(
            `INSERT INTO messages (sender, receiver, message)
             SELECT ?, i.user_id,
                    CONCAT('Dividend paid: ', c.company_name, '. ', dp.shares_held, ' shares x MWK ',
                           d.amount_per_share, ' = MWK ', FORMAT(dp.gross_amount, 2), ' gross, tax MWK ',
                           FORMAT(dp.tax_amount, 2), ', net MWK ', FORMAT(dp.net_amount, 2),
                           '. Payment reference: ', ?)
             FROM dividend_payouts dp
             JOIN dividends d ON dp.dividend_id = d.dividend_id
             JOIN companies c ON d.company_id = c.company_id
             JOIN investors i ON dp.investor_id = i.investor_id
             WHERE dp.dividend_id = ?`,
            [req.user.user_id, reference, dividend_id]
        );

        await conn.commit();

        await logAudit(req.user, 'dividend_paid', 'dividend', dividend.dividend_id, dividend.company_id,
            'Marked dividend #' + dividend.dividend_id + ' as paid. Reference: ' + reference);

        res.status(200).json({ message: 'Dividend marked as paid and investors have been notified.' });

    } catch (error) {
        if (conn) {
            try { await conn.rollback(); } catch (e) { /* ignore */ }
        }
        res.status(500).json({ message: 'Server error: ' + error.message });
    } finally {
        if (conn) conn.release();
    }
};

// ---------------------------------------------------------------------------
// ADMIN + BROKER: payouts inside one dividend
// ---------------------------------------------------------------------------
exports.getDividendPayouts = async (req, res) => {
    const { dividend_id } = req.params;

    try {
        const [rows] = await db.query(
            `SELECT dp.payout_id, dp.shares_held, dp.gross_amount, dp.tax_amount, dp.net_amount, dp.status,
                    CONCAT(i.firstname, ' ', i.surname) AS investor_name,
                    i.bank_name, i.bank_account_number
             FROM dividend_payouts dp
             JOIN investors i ON dp.investor_id = i.investor_id
             WHERE dp.dividend_id = ?
             ORDER BY investor_name`,
            [dividend_id]
        );
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// ---------------------------------------------------------------------------
// INVESTOR: my dividends
// ---------------------------------------------------------------------------
exports.getMyDividends = async (req, res) => {
    try {
        const [investorRows] = await db.query('SELECT investor_id FROM investors WHERE user_id = ?', [req.user.user_id]);
        if (investorRows.length === 0) {
            return res.status(200).json([]);
        }

        const [rows] = await db.query(
            `SELECT dp.payout_id, dp.shares_held, dp.gross_amount, dp.tax_amount, dp.net_amount,
                    d.status AS dividend_status, d.amount_per_share, d.tax_rate, d.payment_reference,
                    DATE_FORMAT(d.record_date, '%Y-%m-%d') AS record_date,
                    DATE_FORMAT(d.payment_date, '%Y-%m-%d') AS payment_date,
                    c.company_name, c.ticker
             FROM dividend_payouts dp
             JOIN dividends d ON dp.dividend_id = d.dividend_id
             JOIN companies c ON d.company_id = c.company_id
             WHERE dp.investor_id = ? AND d.status IN ('approved', 'paid')
             ORDER BY d.record_date DESC, dp.payout_id DESC`,
            [investorRows[0].investor_id]
        );
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};