require('dotenv').config();
const express = require('express');
const cors = require('cors');  // <-- ADD THIS LINE
const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const investorRoutes = require('./routes/investorRoutes');
const companyRoutes = require('./routes/companyRoutes');
const orderRoutes = require('./routes/orderRoutes');
const messageRoutes = require('./routes/messageRoutes');
const statementRoutes = require('./routes/statementRoutes');
const auditRoutes = require('./routes/auditRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());  // <-- ADD THIS LINE
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    next();
});

app.use('/api', authRoutes);
app.use('/api/investors', investorRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/statements', statementRoutes);
app.use('/api/audit', auditRoutes);


// Turns upload errors (wrong file type, file too large) into a readable JSON message.
app.use((err, req, res, next) => {
    if (err) {
        const message = err.code === 'LIMIT_FILE_SIZE'
            ? 'Each file must be 5 MB or smaller.'
            : err.message;
        return res.status(400).json({ message });
    }
    next();
});

app.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1 + 1 AS result');
        res.send(`Database connected! Test query result: ${rows[0].result}`);
    } catch (error) {
        res.status(500).send('Database connection failed: ' + error.message);
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});