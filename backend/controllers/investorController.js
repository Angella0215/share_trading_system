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