const express = require('express');
const router = express.Router();
const { uploadsDir, resolveUpload } = require('../storage');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryRun, queryGet } = require('../db/init');
const { verifyToken, requireRole } = require('../middleware/auth');

// Multer config for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const extByMime = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'image/gif': '.gif',
            'image/avif': '.avif',
            'image/heic': '.heic',
            'image/heif': '.heif'
        };
        const ext = path.extname(file.originalname) || extByMime[file.mimetype] || '';
        cb(null, `${uuidv4()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif', '.avif', '.heic', '.heif'];
        const ext = path.extname(file.originalname).toLowerCase();
        if ((file.mimetype && file.mimetype.startsWith('image/')) || allowed.includes(ext)) {
            cb(null, true);
        } else {
            const err = new Error('Only image files are allowed. Use JPG, PNG, WebP, GIF, AVIF, HEIC, or HEIF.');
            err.statusCode = 400;
            cb(err);
        }
    }
});

// Reporter workflow is available only to reporter accounts.
router.use(verifyToken, requireRole('reporter'));

/**
 * POST /api/reporter/news
 * Accepts up to 10 images via 'images' field
 */
router.post('/news', upload.array('images', 10), (req, res) => {
    try {
        const { headline, body, category, tags, city } = req.body;

        if (!headline || !body || !category) {
            return res.status(400).json({ error: 'Headline, body, and category are required.' });
        }

        // Use first uploaded image as primary (backward compat)
        const firstImage = req.files && req.files.length > 0 ? req.files[0] : null;
        const imagePath = firstImage ? `/uploads/${firstImage.filename}` : null;

        const result = queryRun(
            'INSERT INTO news (headline, body, image_path, selected_image_path, category, tags, city, reporter_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [headline, body, imagePath, imagePath, category, tags || null, city || null, req.user.id]
        );

        const newsId = result.lastInsertRowid;

        // Insert each image into news_images table
        if (req.files && req.files.length > 0) {
            req.files.forEach((file, idx) => {
                const fp = `/uploads/${file.filename}`;
                queryRun(
                    'INSERT INTO news_images (news_id, image_path, is_selected) VALUES (?, ?, ?)',
                    [newsId, fp, idx === 0 ? 1 : 0]
                );
            });
        }

        res.json({ id: newsId, message: 'News submitted successfully.' });
    } catch (err) {
        console.error('Reporter submit news error:', err);
        res.status(500).json({ error: 'Failed to submit news.' });
    }
});

/**
 * GET /api/reporter/news
 */
router.get('/news', (req, res) => {
    try {
        const news = queryAll(
            'SELECT id, headline, status, category, city, created_at FROM news WHERE reporter_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );

        res.json({ news });
    } catch (err) {
        console.error('Reporter get news error:', err);
        res.status(500).json({ error: 'Failed to fetch news.' });
    }
});

/**
 * GET /api/reporter/news/approved
 */
router.get('/news/approved', (req, res) => {
    try {
        const news = queryAll(`
            SELECT n.id, n.headline, n.headline_rewritten, n.status, n.category, n.city,
                   n.processed_at, n.forwarded_at, n.published_at,
                   COALESCE(n.selected_image_path, n.image_path) as image_path
            FROM news n
            WHERE n.reporter_id = ? AND n.status IN ('processed','forwarded','published')
            ORDER BY COALESCE(n.published_at, n.forwarded_at, n.processed_at) DESC
        `, [req.user.id]);

        res.json({ news });
    } catch (err) {
        console.error('Reporter get approved news error:', err);
        res.status(500).json({ error: 'Failed to fetch approved news.' });
    }
});

/**
 * GET /api/reporter/news/rejected
 */
router.get('/news/rejected', (req, res) => {
    try {
        const news = queryAll(`
            SELECT n.id, n.headline, n.status, n.category, n.city,
                   n.rejected_at, n.reject_reason,
                   COALESCE(u.full_name, 'Editor') as rejected_by_name
            FROM news n
            LEFT JOIN users u ON n.rejected_by = u.id
            WHERE n.reporter_id = ? AND n.status = 'rejected'
            ORDER BY n.rejected_at DESC
        `, [req.user.id]);

        res.json({ news });
    } catch (err) {
        console.error('Reporter get rejected news error:', err);
        res.status(500).json({ error: 'Failed to fetch rejected news.' });
    }
});

/**
 * POST /api/reporter/photo
 */
router.post('/photo', upload.single('photo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No photo uploaded.' });
        }

        const photoPath = `/uploads/${req.file.filename}`;

        const oldUser = queryGet('SELECT avatar_path FROM users WHERE id = ?', [req.user.id]);
        if (oldUser && oldUser.avatar_path) {
            const fs = require('fs');
            const oldFullPath = resolveUpload(oldUser.avatar_path);
            if (fs.existsSync(oldFullPath)) {
                try { fs.unlinkSync(oldFullPath); } catch (e) { /* ignore */ }
            }
        }

        queryRun('UPDATE users SET avatar_path = ? WHERE id = ?', [photoPath, req.user.id]);

        const updatedUser = queryGet('SELECT id, username, full_name, role, avatar_path FROM users WHERE id = ?', [req.user.id]);

        res.json({ success: true, avatar_path: photoPath, user: updatedUser });
    } catch (err) {
        console.error('Reporter photo upload error:', err);
        res.status(500).json({ error: 'Failed to upload photo.' });
    }
});

module.exports = router;
