const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { queryAll, queryGet, queryRun } = require('../db/init');
const { verifyToken, requireRole } = require('../middleware/auth');

// Operator routes accessible by operator, editor, and admin
router.use(verifyToken, requireRole('operator', 'editor'));

/**
 * GET /api/operator/news
 */
router.get('/news', (req, res) => {
    try {
        const news = queryAll(`
            SELECT n.id,
                   COALESCE(n.headline_rewritten, n.headline) as headline,
                   SUBSTR(COALESCE(n.body_rewritten, n.body), 1, 200) as body,
                   n.category, n.city,
                   COALESCE(n.selected_image_path, n.image_path) as image_path,
                   n.forwarded_at
            FROM news n
            WHERE n.status = 'forwarded'
            ORDER BY n.forwarded_at DESC
        `);

        // Get copies and image count for all forwarded news
        const newsWithMeta = news.map(n => ({
            ...n,
            copies: queryAll(
                'SELECT u.full_name as operator_name, nc.copied_at FROM news_copies nc JOIN users u ON nc.operator_id = u.id WHERE nc.news_id = ? ORDER BY nc.copied_at DESC',
                [n.id]
            ),
            image_count: queryGet('SELECT COUNT(*) as cnt FROM news_images WHERE news_id = ?', [n.id])?.cnt || 0
        }));

        res.json({ news: newsWithMeta });
    } catch (err) {
        console.error('Operator get news error:', err);
        res.status(500).json({ error: 'Failed to fetch news.' });
    }
});

/**
 * GET /api/operator/news/published
 * IMPORTANT: Must be BEFORE /news/:id
 */
router.get('/news/published', (req, res) => {
    try {
        const news = queryAll(`
            SELECT n.id,
                   COALESCE(n.headline_rewritten, n.headline) as headline,
                   SUBSTR(COALESCE(n.body_rewritten, n.body), 1, 200) as body,
                   n.category, n.city,
                   COALESCE(n.selected_image_path, n.image_path) as image_path,
                   n.published_at
            FROM news n
            WHERE n.status = 'published'
            ORDER BY n.published_at DESC
        `);

        res.json({ news });
    } catch (err) {
        console.error('Operator get published news error:', err);
        res.status(500).json({ error: 'Failed to fetch published news.' });
    }
});

/**
 * GET /api/operator/news/:id
 */
router.get('/news/:id', (req, res) => {
    try {
        const news = queryGet(`
            SELECT n.id,
                   COALESCE(n.headline_rewritten, n.headline) as headline,
                   COALESCE(n.body_rewritten, n.body) as body,
                   n.headline as original_headline,
                   n.body as original_body,
                   n.category, n.tags, n.city,
                   COALESCE(n.selected_image_path, n.image_path) as image_path,
                   n.selected_image_path,
                   n.ai_provider, n.forwarded_at,
                   u.full_name as reporter_name
            FROM news n
            JOIN users u ON n.reporter_id = u.id
            WHERE n.id = ? AND n.status = 'forwarded'
        `, [req.params.id]);

        if (!news) {
            return res.status(404).json({ error: 'News not found.' });
        }

        const copies = queryAll(
            'SELECT u.full_name as operator_name, nc.copied_at FROM news_copies nc JOIN users u ON nc.operator_id = u.id WHERE nc.news_id = ? ORDER BY nc.copied_at DESC',
            [news.id]
        );

        // Attach all images
        const images = queryAll(
            'SELECT id, image_path, is_selected FROM news_images WHERE news_id = ? ORDER BY id ASC',
            [news.id]
        );

        res.json({ ...news, copies, images });
    } catch (err) {
        console.error('Operator get news detail error:', err);
        res.status(500).json({ error: 'Failed to fetch news.' });
    }
});

/**
 * GET /api/operator/news/:id/images
 * Returns all images for a news article
 */
router.get('/news/:id/images', (req, res) => {
    try {
        const images = queryAll(
            'SELECT id, image_path, is_selected FROM news_images WHERE news_id = ? ORDER BY id ASC',
            [req.params.id]
        );
        res.json({ images });
    } catch (err) {
        console.error('Operator get images error:', err);
        res.status(500).json({ error: 'Failed to fetch images.' });
    }
});

/**
 * GET /api/operator/news/:id/images/zip
 * Streams a ZIP archive of all images for this news article
 */
router.get('/news/:id/images/zip', (req, res) => {
    try {
        const newsId = req.params.id;
        const news = queryGet("SELECT id, headline_rewritten, headline FROM news WHERE id = ?", [newsId]);
        if (!news) {
            return res.status(404).json({ error: 'News not found.' });
        }

        const images = queryAll(
            'SELECT image_path FROM news_images WHERE news_id = ? ORDER BY id ASC',
            [newsId]
        );

        // Also fall back to image_path on the news row for old articles
        if (images.length === 0) {
            const legacyNews = queryGet('SELECT image_path FROM news WHERE id = ?', [newsId]);
            if (legacyNews && legacyNews.image_path) {
                images.push({ image_path: legacyNews.image_path });
            }
        }

        if (images.length === 0) {
            return res.status(404).json({ error: 'No images found for this article.' });
        }

        const archive = new archiver.ZipArchive({ zlib: { level: 6 } });
        const safeHeadline = (news.headline_rewritten || news.headline || `news-${newsId}`)
            .replace(/[^a-zA-Z0-9\u0900-\u097F\s-]/g, '')
            .trim()
            .substring(0, 40);

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="images-${newsId}.zip"`);

        archive.on('error', (err) => {
            console.error('ZIP archive error:', err);
            if (!res.headersSent) res.status(500).json({ error: 'Failed to create ZIP.' });
        });

        archive.pipe(res);

        images.forEach((img, idx) => {
            const filePath = path.join(__dirname, '..', '..', img.image_path.replace(/^\//, ''));
            if (fs.existsSync(filePath)) {
                const ext = path.extname(filePath);
                archive.file(filePath, { name: `image-${idx + 1}${ext}` });
            }
        });

        archive.finalize();
    } catch (err) {
        console.error('Operator ZIP download error:', err);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to create ZIP archive.' });
    }
});

/**
 * POST /api/operator/news/:id/copy
 */
router.post('/news/:id/copy', (req, res) => {
    try {
        const newsId = req.params.id;
        const news = queryGet("SELECT id FROM news WHERE id = ? AND status = 'forwarded'", [newsId]);
        if (!news) {
            return res.status(404).json({ error: 'News not found.' });
        }

        queryRun('INSERT INTO news_copies (news_id, operator_id) VALUES (?, ?)', [newsId, req.user.id]);

        res.json({ message: 'Copy recorded.', operator_name: req.user.full_name });
    } catch (err) {
        console.error('Operator copy error:', err);
        res.status(500).json({ error: 'Failed to record copy.' });
    }
});

/**
 * GET /api/operator/news/:id/image
 * Download the selected image for a news article
 */
router.get('/news/:id/image', (req, res) => {
    try {
        const news = queryGet(
            'SELECT COALESCE(selected_image_path, image_path) as image_path FROM news WHERE id = ?',
            [req.params.id]
        );
        if (!news || !news.image_path) {
            return res.status(404).json({ error: 'Image not found.' });
        }

        const filePath = path.join(__dirname, '..', '..', news.image_path.replace(/^\//, ''));
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Image file not found on disk.' });
        }
        res.download(filePath);
    } catch (err) {
        console.error('Operator download image error:', err);
        res.status(500).json({ error: 'Failed to download image.' });
    }
});

/**
 * POST /api/operator/news/:id/publish
 */
router.post('/news/:id/publish', (req, res) => {
    try {
        const news = queryGet("SELECT id FROM news WHERE id = ? AND status = 'forwarded'", [req.params.id]);
        if (!news) {
            return res.status(404).json({ error: 'News not found or not forwarded.' });
        }

        queryRun(
            "UPDATE news SET status = 'published', published_at = datetime('now', 'localtime') WHERE id = ?",
            [news.id]
        );

        res.json({ success: true, message: 'News marked as published.' });
    } catch (err) {
        console.error('Operator publish error:', err);
        res.status(500).json({ error: 'Failed to mark as published.' });
    }
});

module.exports = router;
