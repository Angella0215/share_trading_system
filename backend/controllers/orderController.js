const db = require('../config/db');

const { logAudit } = require('../utils/audit');

// First-come, first-served: one queue for all buy orders and one for all sell orders,
// whatever the company. Returns true (and sends the error) if this order is not
// the oldest one waiting at this stage.
async function blockIfNotQueueHead(req, res, table, idCol, order, status, entityType) {
    const orderId = order[idCol];
    const [rows] = await db.query(
        `SELECT t.${idCol} AS id, c.company_name
         FROM ${table} t
         JOIN companies c ON t.company_id = c.company_id
         WHERE t.status = ?
         ORDER BY t.created_at ASC, t.${idCol} ASC
         LIMIT 1`,
        [status]
    );

    if (rows.length > 0 && Number(rows[0].id) !== Number(orderId)) {
        await logAudit(req.user, 'queue_skip_blocked', entityType, orderId, order.company_id,
            'Tried to process order #' + orderId + ' before earlier order #' + rows[0].id);
        res.status(409).json({
            message: 'Orders are handled first-come, first-served. Earlier order #' + rows[0].id +
                ' (' + rows[0].company_name + ') must be processed first.'
        });
        return true;
    }
    return false;
}

// Sends the investor a message from the broker (shows in their Messages page).
async function notifyInvestor(brokerUserId, investorId, text) {
    try {
        const [rows] = await db.query('SELECT user_id FROM investors WHERE investor_id = ?', [investorId]);
        if (rows.length > 0) {
            await db.query(
                'INSERT INTO messages (sender, receiver, message) VALUES (?, ?, ?)',
                [brokerUserId, rows[0].user_id, text]
            );
        }
    } catch (error) {
        console.error('Could not notify investor:', error.message);
    }
}

function calculateCommission(shareCost) {
    let commission = 0;
    if (shareCost <= 50000) {
        commission = shareCost * 0.02;
    } else if (shareCost <= 100000) {
        commission = (50000 * 0.02) + ((shareCost - 50000) * 0.015);
    } else {
        commission = (50000 * 0.02) + (50000 * 0.015) + ((shareCost - 100000) * 0.01);
    }
    return commission;
}
// Works out how many whole shares a deposit can buy at a given price.
// The deposit covers the shares plus commission, VAT and the flat charge,
// so we step down from the largest possible quantity until the total fits.
function sizeBuyOrder(amount, price) {
    const flatCharge = 50;
    let quantity = Math.floor(amount / price);

    while (quantity > 0) {
        const shareCost = quantity * price;
        const commission = calculateCommission(shareCost);
        const vat = commission * 0.175;
        const total = shareCost + commission + vat + flatCharge;

        if (total <= amount) {
            return { quantity, shareCost, commission, vat, flatCharge, total };
        }
        quantity--;
    }
    return null;
}
function addBusinessDays(startDate, days) {
    const result = new Date(startDate);
    let added = 0;
    while (added < days) {
        result.setDate(result.getDate() + 1);
        const dayOfWeek = result.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            added++;
        }
    }
    return result;
}
function generateDealNoteNumber() {
    const now = new Date();
    const datePart = now.toISOString().split('T')[0].replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return 'SML-DN-' + datePart + '-' + randomPart;
}

exports.createBuyOrder = async (req, res) => {
    const { investor_id, company_id, amount } = req.body;

    if (!investor_id || !company_id || !amount) {
        return res.status(400).json({ message: 'Please provide investor_id, company_id, and amount.' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'Please attach proof of payment.' });
    }

    const proofOfPaymentPath = req.file.path;
    const deposit = parseFloat(amount);

    if (isNaN(deposit) || deposit <= 0) {
        return res.status(400).json({ message: 'Please enter a valid amount.' });
    }

    try {
        const [investorRows] = await db.query('SELECT account_status FROM investors WHERE investor_id = ?', [investor_id]);
        if (investorRows.length === 0) {
            return res.status(404).json({ message: 'Investor not found.' });
        }
        if (investorRows[0].account_status !== 'verified') {
            return res.status(403).json({ message: 'Your account must be verified before you can trade.' });
        }

        const [companyRows] = await db.query('SELECT current_price FROM companies WHERE company_id = ?', [company_id]);
        if (companyRows.length === 0) {
            return res.status(404).json({ message: 'Company not found.' });
        }

        // Quick sanity check against today's price. The real quantity, price and
        // fees are fixed later, at final approval.
        if (!sizeBuyOrder(deposit, parseFloat(companyRows[0].current_price))) {
            return res.status(400).json({ message: 'Amount is too low to buy at least 1 share once fees are included.' });
        }

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 14);

        const [result] = await db.query(
            `INSERT INTO buy_orders
            (investor_id, company_id, amount_deposited, expiry_date, proof_of_payment_path, status)
            VALUES (?, ?, ?, ?, ?, 'pending')`,
            [investor_id, company_id, deposit.toFixed(2), expiryDate.toISOString().split('T')[0], proofOfPaymentPath]
        );

        await logAudit(req.user, 'order_placed', 'buy_order', result.insertId, company_id, 'Investor placed a buy order, deposit MWK ' + deposit.toFixed(2));

        res.status(201).json({
            message: 'Buy order submitted successfully.',
            order_id: result.insertId,
            amount_deposited: deposit.toFixed(2),
            expiry_date: expiryDate.toISOString().split('T')[0]
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.firstApproveBuyOrder = async (req, res) => {
    const { order_id } = req.params;
    const approver_id = req.user.user_id;

    try {
        const [orderRows] = await db.query('SELECT * FROM buy_orders WHERE order_id = ?', [order_id]);
        if (orderRows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const order = orderRows[0];

        if (order.status !== 'pending') {
            return res.status(400).json({ message: `This order is already ${order.status}.` });
        }

        if (await blockIfNotQueueHead(req, res, 'buy_orders', 'order_id', order, 'pending', 'buy_order')) return;

        await db.query(
            'UPDATE buy_orders SET status = ?, first_approver_id = ?, first_approved_at = NOW() WHERE order_id = ?',
            ['first_approved', approver_id, order_id]
        );

await logAudit(req.user, 'first_approved', 'buy_order', order.order_id, order.company_id, 'First approval of buy order #' + order.order_id);

        res.status(200).json({ message: 'Order has first-level approval. A second approver must confirm before it is finalized.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.finalApproveBuyOrder = async (req, res) => {
    const { order_id } = req.params;
    const final_approver_id = req.user.user_id;

    try {
        const [orderRows] = await db.query('SELECT * FROM buy_orders WHERE order_id = ?', [order_id]);
        if (orderRows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const order = orderRows[0];

        if (order.status !== 'first_approved') {
            return res.status(400).json({ message: 'This order needs first-level approval before it can be finalized.' });
        }

        if (await blockIfNotQueueHead(req, res, 'buy_orders', 'order_id', order, 'first_approved', 'buy_order')) return;

        if (order.first_approver_id === final_approver_id) {
            return res.status(403).json({ message: 'The final approver must be different from the first approver (maker-checker control).' });
        }

        // The share count and fees are fixed now, at the approval-day price.
        const [companyRows] = await db.query('SELECT current_price FROM companies WHERE company_id = ?', [order.company_id]);
        if (companyRows.length === 0) {
            return res.status(404).json({ message: 'Company not found.' });
        }

        const price = parseFloat(companyRows[0].current_price);
        const sized = sizeBuyOrder(parseFloat(order.amount_deposited), price);

        if (!sized) {
            return res.status(400).json({ message: 'The deposit is too low to buy at least 1 share at today\'s price.' });
        }

        // Take the shares out of the available pool. The WHERE clause makes
        // this safe: it only succeeds if enough shares are still available.
        const [stockResult] = await db.query(
            'UPDATE companies SET available_shares = available_shares - ? WHERE company_id = ? AND available_shares >= ?',
            [sized.quantity, order.company_id, sized.quantity]
        );
        if (stockResult.affectedRows === 0) {
            return res.status(400).json({ message: 'Not enough shares are available for this company to approve this order.' });
        }

        await db.query(
            `UPDATE buy_orders
             SET status = ?, broker_id = ?, quantity = ?, price = ?, commission = ?, vat = ?, total_amount = ?
             WHERE order_id = ?`,
            ['approved', final_approver_id, sized.quantity, price, sized.commission.toFixed(2), sized.vat.toFixed(2), sized.total.toFixed(2), order_id]
        );

        const [existingPortfolio] = await db.query(
            'SELECT * FROM portfolio WHERE investor_id = ? AND company_id = ?',
            [order.investor_id, order.company_id]
        );

        if (existingPortfolio.length > 0) {
            await db.query(
                'UPDATE portfolio SET shares_owned = shares_owned + ? WHERE investor_id = ? AND company_id = ?',
                [sized.quantity, order.investor_id, order.company_id]
            );
        } else {
            await db.query(
                'INSERT INTO portfolio (investor_id, company_id, shares_owned) VALUES (?, ?, ?)',
                [order.investor_id, order.company_id, sized.quantity]
            );
        }

        const settlementDate = addBusinessDays(new Date(), 3);
        const dealNoteNumber = generateDealNoteNumber();

        await db.query(
            'INSERT INTO transactions (investor_id, company_id, buy_order_id, type, quantity, price, settlement_date, deal_note_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [order.investor_id, order.company_id, order.order_id, 'buy', sized.quantity, price, settlementDate.toISOString().split('T')[0], dealNoteNumber]
        );

        await logAudit(req.user, 'final_approved', 'buy_order', order.order_id, order.company_id, 'Final approval of buy order #' + order.order_id + ': ' + sized.quantity + ' shares at MWK ' + price.toFixed(2));

        res.status(200).json({ message: 'Buy order fully approved. Shares added to investor portfolio.', deal_note_number: dealNoteNumber });
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.createSellOrder = async (req, res) => {
    const { investor_id, company_id, quantity } = req.body;

    if (!investor_id || !company_id || !quantity) {
        return res.status(400).json({ message: 'Please provide investor_id, company_id, and quantity.' });
    }

    try {
        const [investorRows] = await db.query('SELECT account_status FROM investors WHERE investor_id = ?', [investor_id]);
        if (investorRows.length === 0) {
            return res.status(404).json({ message: 'Investor not found.' });
        }
        if (investorRows[0].account_status !== 'verified') {
            return res.status(403).json({ message: 'Your account must be verified before you can trade.' });
        }

        const [portfolioRows] = await db.query(
            'SELECT shares_owned FROM portfolio WHERE investor_id = ? AND company_id = ?',
            [investor_id, company_id]
        );

        if (portfolioRows.length === 0 || portfolioRows[0].shares_owned < quantity) {
            return res.status(400).json({ message: 'You do not own enough shares to place this sell order.' });
        }

        const [companyRows] = await db.query('SELECT current_price FROM companies WHERE company_id = ?', [company_id]);
        if (companyRows.length === 0) {
            return res.status(404).json({ message: 'Company not found.' });
        }

                // Price, commission, VAT and net proceeds are fixed later, at final approval.
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 14);

        const [result] = await db.query(
            `INSERT INTO sell_orders
            (investor_id, company_id, quantity, expiry_date, status)
            VALUES (?, ?, ?, ?, 'pending')`,
            [investor_id, company_id, parseInt(quantity), expiryDate.toISOString().split('T')[0]]
        );
await logAudit(req.user, 'order_placed', 'sell_order', result.insertId, company_id, 'Investor placed a sell order for ' + parseInt(quantity) + ' shares');
        res.status(201).json({
            message: 'Sell order submitted successfully.',
            sell_id: result.insertId,
            quantity: parseInt(quantity),
            expiry_date: expiryDate.toISOString().split('T')[0]
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};
exports.firstApproveSellOrder = async (req, res) => {
    const { sell_id } = req.params;
    const approver_id = req.user.user_id;

    try {
        const [orderRows] = await db.query('SELECT * FROM sell_orders WHERE sell_id = ?', [sell_id]);
        if (orderRows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const order = orderRows[0];

        if (order.status !== 'pending') {
            return res.status(400).json({ message: `This order is already ${order.status}.` });
        }

if (await blockIfNotQueueHead(req, res, 'sell_orders', 'sell_id', order, 'pending', 'sell_order')) return;

        await db.query(
            'UPDATE sell_orders SET status = ?, first_approver_id = ?, first_approved_at = NOW() WHERE sell_id = ?',
            ['first_approved', approver_id, sell_id]
        );
await logAudit(req.user, 'first_approved', 'sell_order', order.sell_id, order.company_id, 'First approval of sell order #' + order.sell_id);
        res.status(200).json({ message: 'Order has first-level approval. A second approver must confirm before it is finalized.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.finalApproveSellOrder = async (req, res) => {
    const { sell_id } = req.params;
    const final_approver_id = req.user.user_id;

    try {
        const [orderRows] = await db.query('SELECT * FROM sell_orders WHERE sell_id = ?', [sell_id]);
        if (orderRows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const order = orderRows[0];

        if (order.status !== 'first_approved') {
            return res.status(400).json({ message: 'This order needs first-level approval before it can be finalized.' });
        }

        if (await blockIfNotQueueHead(req, res, 'sell_orders', 'sell_id', order, 'first_approved', 'sell_order')) return;

        if (order.first_approver_id === final_approver_id) {
            return res.status(403).json({ message: 'The final approver must be different from the first approver (maker-checker control).' });
        }

        const [portfolioRows] = await db.query(
            'SELECT shares_owned FROM portfolio WHERE investor_id = ? AND company_id = ?',
            [order.investor_id, order.company_id]
        );

        if (portfolioRows.length === 0 || portfolioRows[0].shares_owned < order.quantity) {
            return res.status(400).json({ message: 'Investor no longer holds enough shares for this order.' });
        }

        // Price, commission, VAT and net proceeds are fixed now, at the approval-day price.
        const [companyRows] = await db.query('SELECT current_price FROM companies WHERE company_id = ?', [order.company_id]);
        if (companyRows.length === 0) {
            return res.status(404).json({ message: 'Company not found.' });
        }

        const price = parseFloat(companyRows[0].current_price);
        const shareValue = order.quantity * price;
        const commission = calculateCommission(shareValue);
        const vat = commission * 0.175;
        const flatCharge = 50;
        const netProceeds = shareValue - commission - vat - flatCharge;

        await db.query(
            `UPDATE sell_orders
             SET status = ?, broker_id = ?, price = ?, commission = ?, vat = ?, total_amount = ?
             WHERE sell_id = ?`,
            ['approved', final_approver_id, price, commission.toFixed(2), vat.toFixed(2), netProceeds.toFixed(2), sell_id]
        );

        await db.query(
            'UPDATE portfolio SET shares_owned = shares_owned - ? WHERE investor_id = ? AND company_id = ?',
            [order.quantity, order.investor_id, order.company_id]
        );

        // Sold shares go back into the pool available for other investors to buy.
        await db.query(
            'UPDATE companies SET available_shares = available_shares + ? WHERE company_id = ?',
            [order.quantity, order.company_id]
        );

        const settlementDate = addBusinessDays(new Date(), 3);
        const dealNoteNumber = generateDealNoteNumber();

        await db.query(
            'INSERT INTO transactions (investor_id, company_id, sell_order_id, type, quantity, price, settlement_date, deal_note_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [order.investor_id, order.company_id, order.sell_id, 'sell', order.quantity, price, settlementDate.toISOString().split('T')[0], dealNoteNumber]
        );

        await logAudit(req.user, 'final_approved', 'sell_order', order.sell_id, order.company_id, 'Final approval of sell order #' + order.sell_id + ': ' + order.quantity + ' shares at MWK ' + price.toFixed(2));

        res.status(200).json({ message: 'Sell order fully approved. Shares deducted from investor portfolio.', deal_note_number: dealNoteNumber });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.getMyOrders = async (req, res) => {
    const user_id = req.user.user_id;

    try {
        const [investorRows] = await db.query('SELECT investor_id FROM investors WHERE user_id = ?', [user_id]);
        if (investorRows.length === 0) {
            return res.status(404).json({ message: 'No account application found.' });
        }
        const investor_id = investorRows[0].investor_id;

        const [buyOrders] = await db.query(
            `SELECT order_id AS id, 'buy' AS type, company_id, amount_deposited, quantity, price, commission, vat, total_amount, status, created_at, expiry_date
             FROM buy_orders WHERE investor_id = ?`,
            [investor_id]
        );

        const [sellOrders] = await db.query(
            `SELECT sell_id AS id, 'sell' AS type, company_id, NULL AS amount_deposited, quantity, price, commission, vat, total_amount, status, created_at, expiry_date
             FROM sell_orders WHERE investor_id = ?`,
            [investor_id]
        );

        const allOrders = buyOrders.concat(sellOrders);

        const [companies] = await db.query('SELECT company_id, company_name, ticker FROM companies');
        const companyMap = {};
        companies.forEach(function (c) { companyMap[c.company_id] = c; });

        const enriched = allOrders.map(function (o) {
            const company = companyMap[o.company_id] || {};
            return Object.assign({}, o, {
                company_name: company.company_name || 'Unknown',
                ticker: company.ticker || '-'
            });
        });

        enriched.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });

        res.status(200).json(enriched);

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.getPendingBuyOrders = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT bo.*, c.company_name, c.ticker, i.firstname, i.surname, u.email
             FROM buy_orders bo
             JOIN companies c ON bo.company_id = c.company_id
             JOIN investors i ON bo.investor_id = i.investor_id
             JOIN users u ON i.user_id = u.user_id
             WHERE bo.status IN ('pending', 'first_approved')
             ORDER BY bo.created_at ASC`
        );
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.getPendingSellOrders = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT so.*, c.company_name, c.ticker, i.firstname, i.surname, u.email
             FROM sell_orders so
             JOIN companies c ON so.company_id = c.company_id
             JOIN investors i ON so.investor_id = i.investor_id
             JOIN users u ON i.user_id = u.user_id
             WHERE so.status IN ('pending', 'first_approved')
             ORDER BY so.created_at ASC`
        );
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.getMyTransactions = async (req, res) => {
    const user_id = req.user.user_id;

    try {
        const [investorRows] = await db.query('SELECT investor_id FROM investors WHERE user_id = ?', [user_id]);
        if (investorRows.length === 0) {
            return res.status(404).json({ message: 'No account application found.' });
        }
        const investor_id = investorRows[0].investor_id;

        const [rows] = await db.query(
            `SELECT t.transaction_id, t.type, t.buy_order_id, t.sell_order_id, t.quantity, t.price, t.transaction_date, t.settlement_date, c.company_name, c.ticker
             FROM transactions t
             JOIN companies c ON t.company_id = c.company_id
             WHERE t.investor_id = ?
             ORDER BY t.transaction_date DESC`,
            [investor_id]
        );
        res.status(200).json(rows);

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.cancelBuyOrder = async (req, res) => {
    const { order_id } = req.params;
    const user_id = req.user.user_id;

    try {
        const [investorRows] = await db.query('SELECT investor_id FROM investors WHERE user_id = ?', [user_id]);
        if (investorRows.length === 0) {
            return res.status(404).json({ message: 'No account application found.' });
        }
        const investor_id = investorRows[0].investor_id;

        const [orderRows] = await db.query('SELECT * FROM buy_orders WHERE order_id = ?', [order_id]);
        if (orderRows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const order = orderRows[0];

        if (order.investor_id !== investor_id) {
            return res.status(403).json({ message: 'You can only cancel your own orders.' });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({ message: `This order is already ${order.status} and cannot be cancelled.` });
        }

        await db.query('UPDATE buy_orders SET status = ? WHERE order_id = ?', ['rejected', order_id]);
        await logAudit(req.user, 'order_cancelled', 'buy_order', order.order_id, order.company_id, 'Investor cancelled buy order #' + order.order_id);
        res.status(200).json({ message: 'Buy order cancelled. Please contact your broker regarding your deposited funds.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.cancelSellOrder = async (req, res) => {
    const { sell_id } = req.params;
    const user_id = req.user.user_id;

    try {
        const [investorRows] = await db.query('SELECT investor_id FROM investors WHERE user_id = ?', [user_id]);
        if (investorRows.length === 0) {
            return res.status(404).json({ message: 'No account application found.' });
        }
        const investor_id = investorRows[0].investor_id;

        const [orderRows] = await db.query('SELECT * FROM sell_orders WHERE sell_id = ?', [sell_id]);
        if (orderRows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const order = orderRows[0];

        if (order.investor_id !== investor_id) {
            return res.status(403).json({ message: 'You can only cancel your own orders.' });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({ message: `This order is already ${order.status} and cannot be cancelled.` });
        }

        await db.query('UPDATE sell_orders SET status = ? WHERE sell_id = ?', ['rejected', sell_id]);
        await logAudit(req.user, 'order_cancelled', 'sell_order', order.sell_id, order.company_id, 'Investor cancelled sell order #' + order.sell_id);
        res.status(200).json({ message: 'Sell order cancelled.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.getDealNote = async (req, res) => {
    const { transaction_id } = req.params;
    const user_id = req.user.user_id;

    try {
        const [investorRows] = await db.query('SELECT investor_id, firstname, surname FROM investors WHERE user_id = ?', [user_id]);
        if (investorRows.length === 0) {
            return res.status(404).json({ message: 'No account application found.' });
        }
        const investor = investorRows[0];

        const [rows] = await db.query(
            `SELECT t.*, c.company_name, c.ticker
             FROM transactions t
             JOIN companies c ON t.company_id = c.company_id
             WHERE t.transaction_id = ? AND t.investor_id = ?`,
            [transaction_id, investor.investor_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Deal note not found.' });
        }

        const t = rows[0];
        const grossValue = t.quantity * parseFloat(t.price);

        res.status(200).json({
            deal_note_number: t.deal_note_number,
            investor_name: investor.firstname + ' ' + investor.surname,
            type: t.type,
            company_name: t.company_name,
            ticker: t.ticker,
            quantity: t.quantity,
            price: t.price,
            gross_value: grossValue.toFixed(2),
            transaction_date: t.transaction_date,
            settlement_date: t.settlement_date,
            broker: 'Stockbrokers Malawi Limited'
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.rejectBuyOrder = async (req, res) => {
    const { order_id } = req.params;
    const reason = String(req.body.reason || '').trim();

    if (reason.length < 5) {
        return res.status(400).json({ message: 'Please give a reason (at least 5 characters).' });
    }

    try {
        const [orderRows] = await db.query(
            `SELECT bo.*, c.company_name FROM buy_orders bo
             JOIN companies c ON bo.company_id = c.company_id
             WHERE bo.order_id = ?`, [order_id]
        );
        if (orderRows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const order = orderRows[0];

        if (order.status !== 'pending' && order.status !== 'first_approved') {
            return res.status(400).json({ message: `This order is already ${order.status} and cannot be cancelled.` });
        }

        const [result] = await db.query(
            "UPDATE buy_orders SET status = 'rejected' WHERE order_id = ? AND status IN ('pending', 'first_approved')",
            [order_id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: 'This order was just updated by someone else.' });
        }

        await logAudit(req.user, 'order_rejected', 'buy_order', order.order_id, order.company_id,
            'Cancelled buy order #' + order.order_id + '. Reason: ' + reason);

        await notifyInvestor(req.user.user_id, order.investor_id,
            'Your buy order #' + order.order_id + ' for ' + order.company_name + ' was cancelled by Stockbrokers Malawi. ' +
            'Reason: ' + reason + '. Please contact your broker regarding your deposit of MWK ' +
            parseFloat(order.amount_deposited).toFixed(2) + '.');

        res.status(200).json({ message: 'Buy order cancelled and the investor has been notified.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.rejectSellOrder = async (req, res) => {
    const { sell_id } = req.params;
    const reason = String(req.body.reason || '').trim();

    if (reason.length < 5) {
        return res.status(400).json({ message: 'Please give a reason (at least 5 characters).' });
    }

    try {
        const [orderRows] = await db.query(
            `SELECT so.*, c.company_name FROM sell_orders so
             JOIN companies c ON so.company_id = c.company_id
             WHERE so.sell_id = ?`, [sell_id]
        );
        if (orderRows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const order = orderRows[0];

        if (order.status !== 'pending' && order.status !== 'first_approved') {
            return res.status(400).json({ message: `This order is already ${order.status} and cannot be cancelled.` });
        }

        const [result] = await db.query(
            "UPDATE sell_orders SET status = 'rejected' WHERE sell_id = ? AND status IN ('pending', 'first_approved')",
            [sell_id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: 'This order was just updated by someone else.' });
        }

        await logAudit(req.user, 'order_rejected', 'sell_order', order.sell_id, order.company_id,
            'Cancelled sell order #' + order.sell_id + '. Reason: ' + reason);

        await notifyInvestor(req.user.user_id, order.investor_id,
            'Your sell order #' + order.sell_id + ' for ' + order.quantity + ' ' + order.company_name +
            ' shares was cancelled by Stockbrokers Malawi. Reason: ' + reason + '.');

        res.status(200).json({ message: 'Sell order cancelled and the investor has been notified.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.getOrderHistory = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM (
                SELECT 'buy' AS type, bo.order_id AS id, bo.status, bo.created_at,
                       bo.amount_deposited, bo.quantity, bo.price, bo.total_amount,
                       c.company_name, c.ticker,
                       CONCAT(i.firstname, ' ', i.surname) AS investor_name,
                       u1.fullname AS first_approver, bo.first_approved_at,
                       u2.fullname AS final_approver,
                       (SELECT a.created_at FROM audit_log a WHERE a.entity_type = 'buy_order' AND a.entity_id = bo.order_id
                         AND a.action IN ('final_approved', 'order_rejected', 'order_cancelled') ORDER BY a.log_id DESC LIMIT 1) AS closed_at,
                       (SELECT a.user_name FROM audit_log a WHERE a.entity_type = 'buy_order' AND a.entity_id = bo.order_id
                         AND a.action IN ('final_approved', 'order_rejected', 'order_cancelled') ORDER BY a.log_id DESC LIMIT 1) AS closed_by,
                       (SELECT a.details FROM audit_log a WHERE a.entity_type = 'buy_order' AND a.entity_id = bo.order_id
                         AND a.action IN ('order_rejected', 'order_cancelled') ORDER BY a.log_id DESC LIMIT 1) AS close_note
                FROM buy_orders bo
                JOIN companies c ON bo.company_id = c.company_id
                JOIN investors i ON bo.investor_id = i.investor_id
                LEFT JOIN users u1 ON bo.first_approver_id = u1.user_id
                LEFT JOIN users u2 ON bo.broker_id = u2.user_id
                WHERE bo.status IN ('approved', 'rejected')

                UNION ALL

                SELECT 'sell' AS type, so.sell_id AS id, so.status, so.created_at,
                       NULL AS amount_deposited, so.quantity, so.price, so.total_amount,
                       c.company_name, c.ticker,
                       CONCAT(i.firstname, ' ', i.surname) AS investor_name,
                       u1.fullname AS first_approver, so.first_approved_at,
                       u2.fullname AS final_approver,
                       (SELECT a.created_at FROM audit_log a WHERE a.entity_type = 'sell_order' AND a.entity_id = so.sell_id
                         AND a.action IN ('final_approved', 'order_rejected', 'order_cancelled') ORDER BY a.log_id DESC LIMIT 1) AS closed_at,
                       (SELECT a.user_name FROM audit_log a WHERE a.entity_type = 'sell_order' AND a.entity_id = so.sell_id
                         AND a.action IN ('final_approved', 'order_rejected', 'order_cancelled') ORDER BY a.log_id DESC LIMIT 1) AS closed_by,
                       (SELECT a.details FROM audit_log a WHERE a.entity_type = 'sell_order' AND a.entity_id = so.sell_id
                         AND a.action IN ('order_rejected', 'order_cancelled') ORDER BY a.log_id DESC LIMIT 1) AS close_note
                FROM sell_orders so
                JOIN companies c ON so.company_id = c.company_id
                JOIN investors i ON so.investor_id = i.investor_id
                LEFT JOIN users u1 ON so.first_approver_id = u1.user_id
                LEFT JOIN users u2 ON so.broker_id = u2.user_id
                WHERE so.status IN ('approved', 'rejected')
             ) history
             ORDER BY created_at DESC
             LIMIT 1000`
        );
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};