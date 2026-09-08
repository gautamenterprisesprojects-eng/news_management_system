const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { uploadsDir, resolveUpload } = require('../storage');
const { queryAll, queryGet, queryRun } = require('../db/init');
const { verifyToken, requireRole } = require('../middleware/auth');
const fs = require('fs');

// Multer config for ad file uploads (PDF + image)
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.bin';
        cb(null, `ad-${uuidv4()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg', 'image/png', 'image/webp', 'image/gif',
            'application/pdf'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            const err = new Error('Only image files (JPG, PNG, WebP) and PDFs are allowed.');
            err.statusCode = 400;
            cb(err);
        }
    }
});

// ============================================================
// SUB-EDITOR: Upload & view own ads
// ============================================================

router.post('/upload', verifyToken, requireRole('sub_editor'), upload.single('ad_file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Ad file is required.' });
        }
        const { ad_type, note, size, price } = req.body;
        if (!ad_type || !['website', 'print_edition'].includes(ad_type)) {
            return res.status(400).json({ error: 'ad_type must be website or print_edition.' });
        }

        const filePath = `/uploads/${req.file.filename}`;
        const fileType = req.file.mimetype === 'application/pdf' ? 'pdf' : 'image';

        const result = queryRun(
            `INSERT INTO advertisements
             (sub_editor_id, file_path, file_type, ad_type, note_sub_editor, size, price)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, filePath, fileType, ad_type, note || '', size || '', price || '']
        );

        res.json({ success: true, id: result.lastInsertRowid, message: 'विज्ञापन अपलोड हो गया।' });
    } catch (err) {
        console.error('Ad upload error:', err);
        res.status(500).json({ error: 'Failed to upload advertisement.' });
    }
});

router.get('/my', verifyToken, requireRole('sub_editor'), (req, res) => {
    try {
        const ads = queryAll(`
            SELECT id, file_path, file_type, ad_type, note_sub_editor, size, price,
                   status, created_at, approved_at, rejected_at, reject_reason
            FROM advertisements
            WHERE sub_editor_id = ?
            ORDER BY created_at DESC
        `, [req.user.id]);
        res.json({ ads });
    } catch (err) {
        console.error('Ad my list error:', err);
        res.status(500).json({ error: 'Failed to fetch advertisements.' });
    }
});

// ============================================================
// EDITOR: Review, approve, reject, send to operator
// ============================================================

router.get('/pending', verifyToken, requireRole('editor'), (req, res) => {
    try {
        // Show ads from sub-editors assigned to this editor
        const ads = queryAll(`
            SELECT a.id, a.file_path, a.file_type, a.ad_type, a.note_sub_editor,
                   a.size, a.price, a.status, a.created_at,
                   u.full_name as sub_editor_name, u.name_hi as sub_editor_name_hi,
                   COALESCE(u.district, u.city) as sub_editor_district
            FROM advertisements a
            JOIN users u ON u.id = a.sub_editor_id
            WHERE a.status = 'pending'
              AND u.assigned_editor_id = ?
            ORDER BY a.created_at DESC
        `, [req.user.id]);
        res.json({ ads });
    } catch (err) {
        console.error('Editor pending ads error:', err);
        res.status(500).json({ error: 'Failed to fetch pending ads.' });
    }
});

router.get('/approved-list', verifyToken, requireRole('editor'), (req, res) => {
    try {
        const ads = queryAll(`
            SELECT a.id, a.file_path, a.file_type, a.ad_type, a.note_sub_editor,
                   a.note_editor, a.size, a.price, a.status, a.created_at, a.approved_at,
                   u.full_name as sub_editor_name, u.name_hi as sub_editor_name_hi,
                   COALESCE(u.district, u.city) as sub_editor_district
            FROM advertisements a
            JOIN users u ON u.id = a.sub_editor_id
            WHERE a.status IN ('approved', 'sent_to_operator')
              AND a.editor_id = ?
            ORDER BY a.approved_at DESC
        `, [req.user.id]);
        res.json({ ads });
    } catch (err) {
        console.error('Editor approved ads error:', err);
        res.status(500).json({ error: 'Failed to fetch approved ads.' });
    }
});

router.get('/detail/:id', verifyToken, (req, res) => {
    try {
        const role = req.user.role;
        const ad = queryGet(`
            SELECT a.*, u.full_name as sub_editor_name, u.name_hi as sub_editor_name_hi,
                   COALESCE(u.district, u.city) as sub_editor_district
            FROM advertisements a
            JOIN users u ON u.id = a.sub_editor_id
            WHERE a.id = ?
        `, [req.params.id]);

        if (!ad) return res.status(404).json({ error: 'Advertisement not found.' });

        // Ad manager should NOT see sub-editor note
        if (role === 'ad_manager') {
            delete ad.note_sub_editor;
        }

        res.json(ad);
    } catch (err) {
        console.error('Ad detail error:', err);
        res.status(500).json({ error: 'Failed to fetch advertisement.' });
    }
});

router.post('/:id/approve', verifyToken, requireRole('editor'), (req, res) => {
    try {
        const ad = queryGet(`
            SELECT a.id FROM advertisements a
            JOIN users u ON u.id = a.sub_editor_id
            WHERE a.id = ? AND a.status = 'pending' AND u.assigned_editor_id = ?
        `, [req.params.id, req.user.id]);
        if (!ad) return res.status(404).json({ error: 'Pending ad not found.' });

        const noteEditor = String(req.body.note_editor || '').trim();
        queryRun(
            `UPDATE advertisements
             SET status = 'approved', editor_id = ?, note_editor = ?,
                 approved_at = datetime('now','localtime')
             WHERE id = ?`,
            [req.user.id, noteEditor, ad.id]
        );
        res.json({ success: true, message: 'विज्ञापन अप्रूव हो गया।' });
    } catch (err) {
        console.error('Ad approve error:', err);
        res.status(500).json({ error: 'Failed to approve advertisement.' });
    }
});

router.post('/:id/reject', verifyToken, requireRole('editor'), (req, res) => {
    try {
        const ad = queryGet(`
            SELECT a.id FROM advertisements a
            JOIN users u ON u.id = a.sub_editor_id
            WHERE a.id = ? AND a.status = 'pending' AND u.assigned_editor_id = ?
        `, [req.params.id, req.user.id]);
        if (!ad) return res.status(404).json({ error: 'Pending ad not found.' });

        const reason = String(req.body.reason || '').trim();
        queryRun(
            `UPDATE advertisements
             SET status = 'rejected', rejected_at = datetime('now','localtime'), reject_reason = ?
             WHERE id = ?`,
            [reason, ad.id]
        );
        res.json({ success: true, message: 'विज्ञापन रिजेक्ट हो गया।' });
    } catch (err) {
        console.error('Ad reject error:', err);
        res.status(500).json({ error: 'Failed to reject advertisement.' });
    }
});

router.post('/:id/send-to-operator', verifyToken, requireRole('editor'), (req, res) => {
    try {
        const ad = queryGet(`
            SELECT a.id FROM advertisements a
            WHERE a.id = ? AND a.status = 'approved' AND a.editor_id = ?
        `, [req.params.id, req.user.id]);
        if (!ad) return res.status(404).json({ error: 'Approved ad not found.' });

        queryRun("UPDATE advertisements SET status = 'sent_to_operator' WHERE id = ?", [ad.id]);
        res.json({ success: true, message: 'विज्ञापन ऑपरेटर को भेज दिया।' });
    } catch (err) {
        console.error('Ad send-to-operator error:', err);
        res.status(500).json({ error: 'Failed to send ad to operator.' });
    }
});

// ============================================================
// AD MANAGER: View only approved ads (no sub-editor note)
// ============================================================

router.get('/manager/list', verifyToken, requireRole('ad_manager'), (req, res) => {
    try {
        // Ad manager sees ads approved by their assigned editor
        const ads = queryAll(`
            SELECT a.id, a.file_path, a.file_type, a.ad_type,
                   a.note_editor, a.size, a.price, a.status,
                   a.created_at, a.approved_at,
                   u.full_name as sub_editor_name, u.name_hi as sub_editor_name_hi,
                   COALESCE(u.district, u.city) as sub_editor_district
            FROM advertisements a
            JOIN users u ON u.id = a.sub_editor_id
            WHERE a.status IN ('approved', 'sent_to_operator')
              AND a.editor_id = (SELECT assigned_editor_id FROM users WHERE id = ?)
            ORDER BY a.approved_at DESC
        `, [req.user.id]);
        res.json({ ads });
    } catch (err) {
        console.error('Ad manager list error:', err);
        res.status(500).json({ error: 'Failed to fetch advertisements.' });
    }
});

// ============================================================
// OPERATOR: View ads sent to operator
// ============================================================

router.get('/operator/list', verifyToken, requireRole('operator'), (req, res) => {
    try {
        const ads = queryAll(`
            SELECT a.id, a.file_path, a.file_type, a.ad_type,
                   a.note_editor, a.size, a.price, a.status,
                   a.created_at, a.approved_at,
                   u.full_name as sub_editor_name, u.name_hi as sub_editor_name_hi,
                   COALESCE(u.district, u.city) as sub_editor_district
            FROM advertisements a
            JOIN users u ON u.id = a.sub_editor_id
            WHERE a.status = 'sent_to_operator'
            ORDER BY a.approved_at DESC
        `);
        res.json({ ads });
    } catch (err) {
        console.error('Operator ads list error:', err);
        res.status(500).json({ error: 'Failed to fetch advertisements.' });
    }
});

module.exports = router;
