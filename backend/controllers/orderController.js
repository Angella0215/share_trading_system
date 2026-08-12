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
            (investor_id, company_id, quantity, price, commission, vat, total_amount, expiry_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [investor_id, company_id, quantity, price, commission.toFixed(2), vat.toFixed(2), totalAmount.toFixed(2), expiryDate.toISOString().split('T')[0]]
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