const express = require('express');
const router = express.Router();
const { queryAll, queryGet, queryRun } = require('../db/init');
const { verifyToken, requireRole } = require('../middleware/auth');
const { sendPushToEditors } = require('../services/pushNotifications');

router.use(verifyToken, requireRole('sub_editor'));

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
