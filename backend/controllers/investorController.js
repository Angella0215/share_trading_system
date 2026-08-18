const db = require('../config/db');

exports.openAccount = async (req, res) => {
    const {
        user_id,
        firstname,
        surname,
        other_names,
        date_of_birth,
        marital_status,
        spouse_full_name,
        gender,
        phone_number,
        physical_address,
        postal_address,
        house_number,
        home_village,
        ta,
        district,
        directions,
        national_id_number,
        id_expiry_date,
        nationality,
        foreign_local,
        residential_permit_type,
        meter_number,
        next_of_kin_name,
        next_of_kin_phone,
        next_of_kin_email,
        next_of_kin_relationship,
        employment_status,
        employer_name,
        designation,
        employer_address,
        years_self_employed,
        business_type,
        source_of_income,
        expected_monthly_income,
        bank_name,
        bank_branch,
        bank_account_type,
        bank_account_number,
        proof_of_residence_type,
        account_type
    } = req.body;

    if (!user_id || !firstname || !surname || !gender || !phone_number ||
        !physical_address || !national_id_number || !meter_number ||
        !next_of_kin_name || !next_of_kin_phone || !employment_status ||
        !bank_name || !bank_account_number) {
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
            (user_id, firstname, surname, other_names, date_of_birth, marital_status, spouse_full_name, gender, phone_number, 
             physical_address, postal_address, house_number, home_village, ta, district, directions,
             national_id_number, id_expiry_date, nationality, foreign_local, residential_permit_type, meter_number,
             next_of_kin_name, next_of_kin_phone, next_of_kin_email, next_of_kin_relationship,
             employment_status, employer_name, designation, employer_address, years_self_employed, business_type, source_of_income,
             expected_monthly_income, bank_name, bank_branch, bank_account_type, bank_account_number,
             proof_of_residence_type, account_type,
             utility_receipt_path, bank_statement_path, id_document_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, firstname, surname, other_names, date_of_birth, marital_status, spouse_full_name, gender, phone_number,
             physical_address, postal_address, house_number, home_village, ta, district, directions,
             national_id_number, id_expiry_date, nationality || 'Malawian', foreign_local || 'local', residential_permit_type, meter_number,
             next_of_kin_name, next_of_kin_phone, next_of_kin_email, next_of_kin_relationship,
             employment_status, employer_name, designation, employer_address, years_self_employed || null, business_type, source_of_income,
             expected_monthly_income, bank_name, bank_branch, bank_account_type, bank_account_number,
             proof_of_residence_type, account_type || 'equity_trading',
             utility_receipt_path, bank_statement_path, id_document_path]
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