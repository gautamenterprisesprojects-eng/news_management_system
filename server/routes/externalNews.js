const express = require('express');
const crypto = require('crypto');
const { queryAll, queryGet, queryRun } = require('../db/init');
const { getBaseUrl, toExternalPayload, extractPostedLinks } = require('../services/externalNews');

const router = express.Router();

function isAuthorized(req) {
    const configuredKey = process.env.EXTERNAL_NEWS_API_KEY;
    const header = req.headers.authorization || '';
    if (!configuredKey || !header.startsWith('Bearer ')) return false;

    const suppliedKey = header.slice(7);
    const expected = Buffer.from(configuredKey);
    const supplied = Buffer.from(suppliedKey);
    return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}

function isCallbackAuthorized(req) {
    const configuredKey = process.env.EXTERNAL_NEWS_CALLBACK_API_KEY || process.env.EXTERNAL_NEWS_INGEST_API_KEY || process.env.EXTERNAL_NEWS_API_KEY;
    const header = req.headers.authorization || '';
    if (!configuredKey || !header.startsWith('Bearer ')) return false;

    const suppliedKey = header.slice(7);
    const expected = Buffer.from(configuredKey);
    const supplied = Buffer.from(suppliedKey);
    return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}

function parseNewsId(value) {
    if (Number.isInteger(value)) return value;
    const match = String(value || '').match(/^nms-(\d+)$/);
    if (match) return Number(match[1]);
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

// GET /api/external-news/forwarded
// Returns only articles currently forwarded to the operator queue.
router.get('/forwarded', (req, res) => {
    if (!isAuthorized(req)) {
        return res.status(401).json({ error: 'Invalid or missing external API key.' });
    }

    try {
        const news = queryAll(`
            SELECT n.id, n.headline, n.body, n.headline_rewritten, n.body_rewritten,
                   n.category, n.city, n.image_path, n.selected_image_path, n.forwarded_at,
                   u.full_name AS reporter_name, u.name_hi, u.name_en, u.post AS reporter_post
            FROM news n
            JOIN users u ON u.id = n.reporter_id
            WHERE n.status = 'forwarded'
            ORDER BY n.forwarded_at DESC
        `);

        const baseUrl = getBaseUrl(req);
        res.json({
            success: true,
            count: news.length,
            data: news.map(item => toExternalPayload(item, baseUrl))
        });
    } catch (err) {
        console.error('External forwarded-news export error:', err);
        res.status(500).json({ error: 'Failed to export forwarded news.' });
    }
});

function savePostedLinks(req, res) {
    if (!isCallbackAuthorized(req)) {
        return res.status(401).json({ error: 'Invalid or missing external callback API key.' });
    }

    try {
        const newsId = parseNewsId(req.body.newsId || req.body.id || req.body.externalId || req.body.external_id);
        if (!newsId) {
            return res.status(400).json({ error: 'newsId or externalId is required.' });
        }

        const postedLinks = extractPostedLinks(req.body);
        if (!postedLinks.hindiUrl && !postedLinks.englishUrl) {
            return res.status(400).json({ error: 'hindiUrl or englishUrl is required.' });
        }

        const news = queryGet('SELECT id FROM news WHERE id = ?', [newsId]);
        if (!news) {
            return res.status(404).json({ error: 'News not found.' });
        }

        queryRun(
            `UPDATE news
             SET external_hindi_url = COALESCE(?, external_hindi_url),
                 external_english_url = COALESCE(?, external_english_url),
                 external_posted_at = datetime('now', 'localtime')
             WHERE id = ?`,
            [postedLinks.hindiUrl, postedLinks.englishUrl, newsId]
        );

        res.json({ success: true, newsId, postedLinks });
    } catch (err) {
        console.error('External post-results callback error:', err);
        res.status(500).json({ error: 'Failed to save external posted links.' });
    }
}

// Lets the external site send back the live Hindi/English URLs after posting.
router.post('/post-results', savePostedLinks);
router.post('/ingest', savePostedLinks);

module.exports = router;
