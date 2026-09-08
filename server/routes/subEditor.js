const express = require('express');
const router = express.Router();
const { uploadsDir } = require('../storage');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryGet, queryRun } = require('../db/init');
const { verifyToken, requireRole } = require('../middleware/auth');
const { sendPushToEditors } = require('../services/pushNotifications');

router.use(verifyToken, requireRole('sub_editor'));

function toHindiDigits(value) {
    const digits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    return String(value).replace(/\d/g, digit => digits[Number(digit)]);
}

function formatHindiNotificationTime(date = new Date()) {
    const parts = new Intl.DateTimeFormat('hi-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).format(date);

    return toHindiDigits(parts.replace('am', 'पूर्वाह्न').replace('pm', 'अपराह्न'));
}

function absoluteUrl(req, assetPath) {
    if (!assetPath) return null;
    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    return new URL(assetPath, baseUrl).href;
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
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
    limits: { fileSize: 10 * 1024 * 1024 },
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

function newsListSql(extraWhere) {
    return `
        SELECT n.id, n.headline, SUBSTR(n.body, 1, 220) as body, n.status,
               n.category, n.city, n.image_path, n.selected_image_path, n.created_at,
               n.sub_editor_status, n.sub_editor_forwarded_at, n.sub_editor_rejected_at,
               u.full_name as reporter_name
        FROM news n
        JOIN users u ON u.id = n.reporter_id
        WHERE n.sub_editor_id = ? ${extraWhere}
        ORDER BY COALESCE(n.sub_editor_forwarded_at, n.sub_editor_rejected_at, n.created_at) DESC
    `;
}

router.post('/submit-news', upload.array('images', 10), async (req, res) => {
    try {
        const { headline, body, category, tags, city } = req.body;

        if (!headline || !body || !category) {
            return res.status(400).json({ error: 'Headline, body, and category are required.' });
        }

        const firstImage = req.files && req.files.length > 0 ? req.files[0] : null;
        const imagePath = firstImage ? `/uploads/${firstImage.filename}` : null;

        const result = queryRun(
            `INSERT INTO news
             (headline, body, image_path, selected_image_path, category, tags, city,
              reporter_id, sub_editor_id, sub_editor_status, sub_editor_forwarded_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'forwarded', datetime('now', 'localtime'))`,
            [headline, body, imagePath, imagePath, category, tags || null, city || null, req.user.id, req.user.id]
        );

        const newsId = result.lastInsertRowid;

        if (req.files && req.files.length > 0) {
            req.files.forEach((file, idx) => {
                const fp = `/uploads/${file.filename}`;
                queryRun(
                    'INSERT INTO news_images (news_id, image_path, is_selected, sort_order) VALUES (?, ?, ?, ?)',
                    [newsId, fp, idx === 0 ? 1 : 0, idx]
                );
            });
        }

        const subEditorName = req.user.name_hi || req.user.full_name || 'सब-एडिटर';
        const submittedAt = formatHindiNotificationTime();
        const preview = body.length > 90 ? `${body.slice(0, 90)}...` : body;

        sendPushToEditors({
            title: 'सब-एडिटर से खबर आई',
            body: `शीर्षक: ${headline}\nसब-एडिटर: ${subEditorName}\nसमय: ${submittedAt}\nझलक: ${preview}`,
            url: '/#/editor',
            image: absoluteUrl(req, imagePath),
            newsId,
            tag: `sub-editor-own-news-${newsId}`
        }).catch(err => console.error('Main editor push notification error:', err));

        res.json({ id: newsId, message: 'News submitted successfully.' });
    } catch (err) {
        console.error('Sub-editor submit news error:', err);
        res.status(500).json({ error: 'Failed to submit news.' });
    }
});

router.get('/news/pending', (req, res) => {
    try {
        const news = queryAll(newsListSql("AND n.sub_editor_status = 'pending' AND n.status = 'raw'"), [req.user.id]);
        res.json({ news });
    } catch (err) {
        console.error('Sub-editor pending news error:', err);
        res.status(500).json({ error: 'Failed to fetch pending news.' });
    }
});

router.get('/news/forwarded', (req, res) => {
    try {
        const news = queryAll(newsListSql("AND n.sub_editor_status = 'forwarded'"), [req.user.id]);
        res.json({ news });
    } catch (err) {
        console.error('Sub-editor forwarded news error:', err);
        res.status(500).json({ error: 'Failed to fetch forwarded news.' });
    }
});

router.get('/news/rejected', (req, res) => {
    try {
        const news = queryAll(newsListSql("AND n.sub_editor_status = 'rejected'"), [req.user.id]);
        res.json({ news });
    } catch (err) {
        console.error('Sub-editor rejected news error:', err);
        res.status(500).json({ error: 'Failed to fetch rejected news.' });
    }
});

router.get('/news/:id', (req, res) => {
    try {
        const news = queryGet(`
            SELECT n.*, u.full_name as reporter_name
            FROM news n
            JOIN users u ON u.id = n.reporter_id
            WHERE n.id = ? AND n.sub_editor_id = ?
        `, [req.params.id, req.user.id]);
        if (!news) return res.status(404).json({ error: 'News not found.' });

        news.images = queryAll(
            'SELECT id, image_path, is_selected, sort_order FROM news_images WHERE news_id = ? ORDER BY sort_order ASC, id ASC',
            [news.id]
        );
        res.json(news);
    } catch (err) {
        console.error('Sub-editor detail error:', err);
        res.status(500).json({ error: 'Failed to fetch news.' });
    }
});

router.post('/news/:id/forward', (req, res) => {
    try {
        const news = queryGet(
            "SELECT id, headline, body, image_path FROM news WHERE id = ? AND sub_editor_id = ? AND sub_editor_status = 'pending' AND status = 'raw'",
            [req.params.id, req.user.id]
        );
        if (!news) return res.status(404).json({ error: 'Pending news not found.' });

        queryRun(
            "UPDATE news SET sub_editor_status = 'forwarded', sub_editor_forwarded_at = datetime('now', 'localtime') WHERE id = ?",
            [news.id]
        );

        sendPushToEditors({
            title: 'सब-एडिटर से खबर आई',
            body: `शीर्षक: ${news.headline}\nसब-एडिटर: ${req.user.full_name}`,
            url: '/#/editor',
            image: news.image_path,
            newsId: news.id,
            tag: `sub-editor-news-${news.id}`
        }).catch(err => console.error('Main editor push notification error:', err));

        res.json({ success: true, message: 'News forwarded to main editor.' });
    } catch (err) {
        console.error('Sub-editor forward error:', err);
        res.status(500).json({ error: 'Failed to forward news.' });
    }
});

router.post('/news/:id/reject', (req, res) => {
    try {
        const reason = String(req.body.reason || '').trim();
        const news = queryGet(
            "SELECT id FROM news WHERE id = ? AND sub_editor_id = ? AND sub_editor_status = 'pending' AND status = 'raw'",
            [req.params.id, req.user.id]
        );
        if (!news) return res.status(404).json({ error: 'Pending news not found.' });

        queryRun(
            `UPDATE news
             SET status = 'rejected',
                 rejected_at = datetime('now', 'localtime'),
                 rejected_by = ?,
                 reject_reason = ?,
                 sub_editor_status = 'rejected',
                 sub_editor_rejected_at = datetime('now', 'localtime'),
                 sub_editor_reject_reason = ?
             WHERE id = ?`,
            [req.user.id, reason, reason, news.id]
        );

        res.json({ success: true, message: 'News rejected.' });
    } catch (err) {
        console.error('Sub-editor reject error:', err);
        res.status(500).json({ error: 'Failed to reject news.' });
    }
});

module.exports = router;
