require('dotenv').config();
const express = require('express');
const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const investorRoutes = require('./routes/investorRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    next();
});
app.use('/api', authRoutes);
app.use('/api/investors', investorRoutes);

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