const db = require('../config/db');
const PDFDocument = require('pdfkit');

exports.getShareholdingStatement = async (req, res) => {
    const user_id = req.user.user_id;

    try {
        const [investorRows] = await db.query('SELECT * FROM investors WHERE user_id = ?', [user_id]);
        if (investorRows.length === 0) {
            return res.status(404).json({ message: 'No account application found.' });
        }
        const investor = investorRows[0];

        const [portfolioRows] = await db.query(
            `SELECT p.shares_owned, c.company_name, c.ticker, c.current_price
             FROM portfolio p
             JOIN companies c ON p.company_id = c.company_id
             WHERE p.investor_id = ?`,
            [investor.investor_id]
        );

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=shareholding-statement.pdf');
        doc.pipe(res);

        doc.fontSize(18).text('Stockbrokers Malawi Limited', { align: 'center' });
        doc.fontSize(12).text('Shareholding Statement', { align: 'center' });
        doc.moveDown(1.5);

        doc.fontSize(10);
        doc.text('Investor: ' + investor.firstname + ' ' + investor.surname);
        doc.text('Account status: ' + investor.account_status);
        doc.text('Statement date: ' + new Date().toLocaleDateString('en-GB'));
        doc.moveDown();

        if (portfolioRows.length === 0) {
            doc.text('No shares currently held.');
        } else {
            const tableTop = doc.y;
            doc.font('Helvetica-Bold');
            doc.text('Company', 50, tableTop);
            doc.text('Ticker', 230, tableTop);
            doc.text('Shares', 320, tableTop);
            doc.text('Price', 400, tableTop);
            doc.text('Value', 470, tableTop);
            doc.font('Helvetica');

            let y = tableTop + 20;
            let totalValue = 0;

            portfolioRows.forEach(function (row) {
                const value = row.shares_owned * parseFloat(row.current_price);
                totalValue += value;

                doc.text(row.company_name, 50, y);
                doc.text(row.ticker, 230, y);
                doc.text(row.shares_owned.toLocaleString(), 320, y);
                doc.text(parseFloat(row.current_price).toFixed(2), 400, y);
                doc.text(value.toFixed(2), 470, y);
                y += 20;
            });

            doc.moveDown(2);
            doc.font('Helvetica-Bold').text('Total portfolio value: MWK ' + totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }

        doc.moveDown(2);
        doc.fontSize(8).font('Helvetica').text('This statement is generated electronically and reflects holdings as at the date shown above.', { align: 'center' });

        doc.end();

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.getTransactionStatement = async (req, res) => {
    const user_id = req.user.user_id;

    try {
        const [investorRows] = await db.query('SELECT * FROM investors WHERE user_id = ?', [user_id]);
        if (investorRows.length === 0) {
            return res.status(404).json({ message: 'No account application found.' });
        }
        const investor = investorRows[0];

        const [rows] = await db.query(
            `SELECT t.*, c.company_name, c.ticker
             FROM transactions t
             JOIN companies c ON t.company_id = c.company_id
             WHERE t.investor_id = ?
             ORDER BY t.transaction_date DESC`,
            [investor.investor_id]
        );

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=transaction-statement.pdf');
        doc.pipe(res);

        doc.fontSize(18).text('Stockbrokers Malawi Limited', { align: 'center' });
        doc.fontSize(12).text('Transaction Statement', { align: 'center' });
        doc.moveDown(1.5);

        doc.fontSize(10);
        doc.text('Investor: ' + investor.firstname + ' ' + investor.surname);
        doc.text('Statement date: ' + new Date().toLocaleDateString('en-GB'));
        doc.moveDown();

        if (rows.length === 0) {
            doc.text('No transactions found.');
        } else {
            rows.forEach(function (t, index) {
                if (index > 0) doc.moveDown(0.8);
                doc.font('Helvetica-Bold').text((t.type === 'buy' ? 'BUY' : 'SELL') + ' - ' + t.company_name + ' (' + t.ticker + ')');
                doc.font('Helvetica').fontSize(9);
                doc.text('Deal note: ' + (t.deal_note_number || 'N/A'));
                doc.text('Quantity: ' + t.quantity + '   Price: MWK ' + parseFloat(t.price).toFixed(2));
                doc.text('Trade date: ' + new Date(t.transaction_date).toLocaleDateString('en-GB') +
                    (t.settlement_date ? '   Settlement date: ' + new Date(t.settlement_date).toLocaleDateString('en-GB') : ''));
                doc.fontSize(10);
            });
        }

        doc.moveDown(2);
        doc.fontSize(8).text('This statement is generated electronically and lists all recorded transactions for this account.', { align: 'center' });

        doc.end();

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};