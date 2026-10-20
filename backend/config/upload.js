const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per file
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extValid) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG, PNG, and PDF files are allowed.'));
        }
    }
});

const uploadPdf = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per file
    fileFilter: function (req, file, cb) {
        const extValid = path.extname(file.originalname).toLowerCase() === '.pdf';
        const typeValid = file.mimetype === 'application/pdf';
        if (extValid && typeValid) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed for account documents.'));
        }
    }
});

module.exports = upload;
module.exports.pdfOnly = uploadPdf;

module.exports = upload;