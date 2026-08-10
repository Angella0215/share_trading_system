const db = require('../config/db');

exports.openAccount = async (req, res) => {
    const {
        user_id,
        firstname,
        surname,
        other_names,
        gender,
        phone_number,
        physical_address,
        postal_address,
        house_number,
        home_village,
        ta,
        national_id_number,
        nationality,
        meter_number
    } = req.body;

    if (!user_id || !firstname || !surname || !gender || !phone_number ||
        !physical_address || !national_id_number || !meter_number) {
        return res.status(400).json({ message: 'Please fill in all required fields.' });
    }

    if (!req.files || !req.files.utility_receipt || !req.files.bank_statement || !req.files.id_document) {
        return res.status(400).json({ message: 'Please attach all required documents.' });
    }

    const utility_receipt_path = req.files.utility_receipt[0].path;
    const bank_statement_path = req.files.bank_statement[0].path;
    const id_document_path = req.files.id_document[0].path;

    try {
        const [existing] = await db.query('SELECT * FROM investors WHERE user_id = ?', [user_id]);
        if (existing.length > 0) {
            return res.status(409).json({ message: 'An account application already exists for this user.' });
        }

        const [result] = await db.query(
            `INSERT INTO investors 
            (user_id, firstname, surname, other_names, gender, phone_number, physical_address, postal_address, house_number, home_village, ta, national_id_number, nationality, meter_number, utility_receipt_path, bank_statement_path, id_document_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, firstname, surname, other_names, gender, phone_number, physical_address, postal_address, house_number, home_village, ta, national_id_number, nationality || 'Malawian', meter_number, utility_receipt_path, bank_statement_path, id_document_path]
        );

        res.status(201).json({
            message: 'Account opening application submitted. Awaiting verification.',
            investor_id: result.insertId
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.getPendingApplications = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT i.*, u.email, u.fullname 
             FROM investors i 
             JOIN users u ON i.user_id = u.user_id 
             WHERE i.account_status = 'pending'`
        );
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.approveAccount = async (req, res) => {
    const { investor_id } = req.params;
    try {
        await db.query('UPDATE investors SET account_status = ? WHERE investor_id = ?', ['verified', investor_id]);
        res.status(200).json({ message: 'Investor account approved.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.rejectAccount = async (req, res) => {
    const { investor_id } = req.params;
    try {
        await db.query('UPDATE investors SET account_status = ? WHERE investor_id = ?', ['rejected', investor_id]);
        res.status(200).json({ message: 'Investor account rejected.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};