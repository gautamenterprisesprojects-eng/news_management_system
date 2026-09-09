const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pdfsDir } = require('../storage');
const { queryRun, queryGet, queryAll } = require('../db/init');
const { verifyToken, requireRole } = require('../middleware/auth');

if (!fs.existsSync(pdfsDir)) {
    fs.mkdirSync(pdfsDir, { recursive: true });
}

// Configure multer for PDF uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, pdfsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.pdf';
        // Include job_id in filename when available for traceability
        const jobPart = req.body.job_id ? `-${req.body.job_id}` : '';
        cb(null, `newspaper-${req.body.target_user_id}${jobPart}-${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max limit for PDFs
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'));
        }
    }
});

function verifyWebhookKey(req, res, next) {
    const expected = process.env.NEWSPAPER_GENERATOR_WEBHOOK_KEY;
    if (!expected) return next();

    const provided = req.get('x-webhook-key') || req.get('x-api-key') || '';
    if (provided !== expected) {
        return res.status(401).json({ error: 'Invalid webhook key.' });
    }
    next();
}

/**
 * POST /api/webhook/newspaper-pdf
 * Webhook endpoint for receiving generated PDFs from the Newspaper Generator API
 * and from the Page Maker (which includes job_id, bundle_id, edition_id identifiers).
 */
router.post('/newspaper-pdf', verifyWebhookKey, upload.single('pdf'), (req, res) => {
    try {
        const targetUserId = Number(req.body.target_user_id);

        if (!targetUserId || !req.file) {
            return res.status(400).json({ error: 'target_user_id and pdf file are required.' });
        }

        // Verify target user exists
        const user = queryGet('SELECT id FROM users WHERE id = ?', [targetUserId]);
        if (!user) {
            // Cleanup the file if user not found
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Target user not found.' });
        }

        // Optional Page Maker tracking identifiers — stored when provided
        const jobId     = req.body.job_id     || null;
        const bundleId  = req.body.bundle_id  || null;
        const editionId = req.body.edition_id || null;
        const status    = req.body.status     || null;

        const pdfUrl = `/uploads/pdfs/${req.file.filename}`;

        queryRun(
            `INSERT INTO api_pdfs (target_user_id, pdf_url, filename, job_id, bundle_id, edition_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [targetUserId, pdfUrl, req.file.originalname, jobId, bundleId, editionId, status]
        );

        res.json({ success: true, message: 'PDF received and stored successfully.', pdfUrl });
    } catch (error) {
        console.error('Webhook PDF upload error:', error);
        res.status(500).json({ error: 'Failed to process PDF webhook.' });
    }
});

/**
 * POST /api/webhook/manual-upload
 * Manual upload endpoint for Editor to manually upload PDFs for specific users
 */
router.post('/manual-upload', verifyToken, requireRole('editor', 'admin'), upload.single('pdf'), (req, res) => {
    try {
        const targetUserId = Number(req.body.target_user_id);

        if (!targetUserId || !req.file) {
            return res.status(400).json({ error: 'target_user_id and pdf file are required.' });
        }

        const pdfUrl = `/uploads/pdfs/${req.file.filename}`;
        
        queryRun(
            'INSERT INTO api_pdfs (target_user_id, pdf_url, filename) VALUES (?, ?, ?)',
            [targetUserId, pdfUrl, req.file.originalname]
        );

        res.json({ success: true, message: 'PDF uploaded successfully.', pdfUrl });
    } catch (error) {
        console.error('Manual PDF upload error:', error);
        res.status(500).json({ error: 'Failed to upload PDF.' });
    }
});


/**
 * GET /api/webhook/my-pdfs
 * Fetch generated PDFs for the currently logged in Sub-Editor or Reporter
 */
router.get('/my-pdfs', verifyToken, (req, res) => {
    try {
        const targetUserId = req.user.id;
        const pdfs = queryAll('SELECT id, pdf_url, filename, created_at FROM api_pdfs WHERE target_user_id = ? ORDER BY created_at DESC', [targetUserId]);
        res.json({ pdfs });
    } catch (err) {
        console.error('Fetch my-pdfs error:', err);
        res.status(500).json({ error: 'Failed to fetch your PDFs.' });
    }
});

module.exports = router;
