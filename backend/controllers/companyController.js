const db = require('../config/db');

exports.getAllCompanies = async (req, res) => {
    try {
        const [rows] = await db.query(
          `SELECT c.company_id, c.company_name, c.ticker, c.sector, c.current_price, c.market_cap, c.available_shares,
                    (SELECT MAX(sp.date_recorded) FROM share_prices sp WHERE sp.company_id = c.company_id) AS last_updated
             FROM companies c
             ORDER BY c.company_name`
        );
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};
exports.getPriceHistory = async (req, res) => {
    const { company_id } = req.params;
    try {
        const [rows] = await db.query(
            'SELECT price, volume_traded, date_recorded FROM share_prices WHERE company_id = ? ORDER BY date_recorded ASC',
            [company_id]
        );
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.updatePrice = async (req, res) => {
    const { company_id } = req.params;
    const { price, volume_traded } = req.body;

    if (!price) {
        return res.status(400).json({ message: 'Please provide a price.' });
    }

    try {
        const [company] = await db.query('SELECT * FROM companies WHERE company_id = ?', [company_id]);
        if (company.length === 0) {
            return res.status(404).json({ message: 'Company not found.' });
        }

        await db.query(
            'INSERT INTO share_prices (company_id, price, volume_traded, date_recorded) VALUES (?, ?, ?, NOW())',
            [company_id, price, volume_traded || 0]
        );

        await db.query(
            'UPDATE companies SET current_price = ? WHERE company_id = ?',
            [price, company_id]
        );

        res.status(200).json({ message: 'Price updated successfully.', company_id, new_price: price });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.updateAvailableShares = async (req, res) => {
    const { company_id } = req.params;
    const qty = Number(req.body.available_shares);

    if (!Number.isInteger(qty) || qty < 0) {
        return res.status(400).json({ message: 'Available shares must be a whole number of 0 or more.' });
    }

    try {
        const [result] = await db.query(
            'UPDATE companies SET available_shares = ? WHERE company_id = ?',
            [qty, company_id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Company not found.' });
        }
        res.status(200).json({ message: 'Available shares updated.', company_id, available_shares: qty });
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};