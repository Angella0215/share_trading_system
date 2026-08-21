const db = require('../config/db');

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

exports.createBuyOrder = async (req, res) => {
    const { investor_id, company_id, amount } = req.body;

   if (!investor_id || !company_id || !amount) {
        return res.status(400).json({ message: 'Please provide investor_id, company_id, and amount.' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'Please attach proof of payment.' });
    }

    const proofOfPaymentPath = req.file.path;


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

        const price = parseFloat(companyRows[0].current_price);
        const quantity = Math.floor(amount / price);

        if (quantity < 1) {
            return res.status(400).json({ message: 'Amount is too low to purchase at least 1 share at the current price.' });
        }

        const shareCost = quantity * price;
        const commission = calculateCommission(shareCost);
        const vat = commission * 0.175;
        const flatCharge = 50;
        const totalAmount = shareCost + commission + vat + flatCharge;

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 14);

       const [result] = await db.query(
            `INSERT INTO buy_orders 
            (investor_id, company_id, quantity, price, commission, vat, total_amount, expiry_date, proof_of_payment_path, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [investor_id, company_id, quantity, price, commission.toFixed(2), vat.toFixed(2), totalAmount.toFixed(2), expiryDate.toISOString().split('T')[0], proofOfPaymentPath]
        ); 



        res.status(201).json({
            message: 'Buy order submitted successfully.',
            order_id: result.insertId,
            quantity,
            price,
            share_cost: shareCost.toFixed(2),
            commission: commission.toFixed(2),
            vat: vat.toFixed(2),
            flat_charge: flatCharge,
            total_amount: totalAmount.toFixed(2),
            expiry_date: expiryDate.toISOString().split('T')[0]
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.approveBuyOrder = async (req, res) => {
    const { order_id } = req.params;
    const broker_id = req.user.user_id;

    try {
        const [orderRows] = await db.query('SELECT * FROM buy_orders WHERE order_id = ?', [order_id]);
        if (orderRows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const order = orderRows[0];

        if (order.status !== 'pending') {
            return res.status(400).json({ message: `This order is already ${order.status}.` });
        }

        await db.query(
            'UPDATE buy_orders SET status = ?, broker_id = ? WHERE order_id = ?',
            ['approved', broker_id, order_id]
        );

        const [existingPortfolio] = await db.query(
            'SELECT * FROM portfolio WHERE investor_id = ? AND company_id = ?',
            [order.investor_id, order.company_id]
        );

        if (existingPortfolio.length > 0) {
            await db.query(
                'UPDATE portfolio SET shares_owned = shares_owned + ? WHERE investor_id = ? AND company_id = ?',
                [order.quantity, order.investor_id, order.company_id]
            );
        } else {
            await db.query(
                'INSERT INTO portfolio (investor_id, company_id, shares_owned) VALUES (?, ?, ?)',
                [order.investor_id, order.company_id, order.quantity]
            );
        }

        await db.query(
            'INSERT INTO transactions (investor_id, company_id, type, quantity, price) VALUES (?, ?, ?, ?, ?)',
            [order.investor_id, order.company_id, 'buy', order.quantity, order.price]
        );

        res.status(200).json({ message: 'Buy order approved. Shares added to investor portfolio.' });

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

        const price = parseFloat(companyRows[0].current_price);
        const shareValue = quantity * price;
        const commission = calculateCommission(shareValue);
        const vat = commission * 0.175;
        const flatCharge = 50;
        const totalAmount = shareValue - commission - vat - flatCharge;

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 14);

        const [result] = await db.query(
            `INSERT INTO sell_orders 
            (investor_id, company_id, quantity, price, commission, vat, total_amount, expiry_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [investor_id, company_id, quantity, price, commission.toFixed(2), vat.toFixed(2), totalAmount.toFixed(2), expiryDate.toISOString().split('T')[0]]
        );

        res.status(201).json({
            message: 'Sell order submitted successfully.',
            sell_id: result.insertId,
            quantity,
            price,
            share_value: shareValue.toFixed(2),
            commission: commission.toFixed(2),
            vat: vat.toFixed(2),
            flat_charge: flatCharge,
            you_will_receive: totalAmount.toFixed(2),
            expiry_date: expiryDate.toISOString().split('T')[0]
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.approveSellOrder = async (req, res) => {
    const { sell_id } = req.params;
    const broker_id = req.user.user_id;

    try {
        const [orderRows] = await db.query('SELECT * FROM sell_orders WHERE sell_id = ?', [sell_id]);
        if (orderRows.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const order = orderRows[0];

        if (order.status !== 'pending') {
            return res.status(400).json({ message: `This order is already ${order.status}.` });
        }

        const [portfolioRows] = await db.query(
            'SELECT shares_owned FROM portfolio WHERE investor_id = ? AND company_id = ?',
            [order.investor_id, order.company_id]
        );

        if (portfolioRows.length === 0 || portfolioRows[0].shares_owned < order.quantity) {
            return res.status(400).json({ message: 'Investor no longer holds enough shares for this order.' });
        }

        await db.query(
            'UPDATE sell_orders SET status = ?, broker_id = ? WHERE sell_id = ?',
            ['approved', broker_id, sell_id]
        );

        await db.query(
            'UPDATE portfolio SET shares_owned = shares_owned - ? WHERE investor_id = ? AND company_id = ?',
            [order.quantity, order.investor_id, order.company_id]
        );

        await db.query(
            'INSERT INTO transactions (investor_id, company_id, type, quantity, price) VALUES (?, ?, ?, ?, ?)',
            [order.investor_id, order.company_id, 'sell', order.quantity, order.price]
        );

        res.status(200).json({ message: 'Sell order approved. Shares deducted from investor portfolio.' });

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
            `SELECT order_id AS id, 'buy' AS type, company_id, quantity, price, commission, vat, total_amount, status, created_at, expiry_date
             FROM buy_orders WHERE investor_id = ?`,
            [investor_id]
        );

        const [sellOrders] = await db.query(
            `SELECT sell_id AS id, 'sell' AS type, company_id, quantity, price, commission, vat, total_amount, status, created_at, expiry_date
             FROM sell_orders WHERE investor_id = ?`,
            [investor_id]
        );

        const allOrders = buyOrders.concat(sellOrders);

        // Attach company names/tickers so the frontend doesn't need a second lookup.
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
             WHERE bo.status = 'pending'
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
             WHERE so.status = 'pending'
             ORDER BY so.created_at ASC`
        );
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};