const express = require('express');
const router = express.Router();
const fs = require('fs');
const { queryAll, queryGet, queryRun } = require('../db/init');
const { verifyToken, requireRole } = require('../middleware/auth');
const { rewriteArticle } = require('../services/aiRewriter');
const { resolveUpload } = require('../storage');
const { deliverForwardedNews, parseExternalNewsId } = require('../services/externalNews');

// All editor routes require editor role
router.use(verifyToken, requireRole('editor'));

/**
 * GET /api/editor/reporters
 */
router.get('/reporters', (req, res) => {
    try {
        const reporters = queryAll("SELECT id, full_name as name FROM users WHERE role = 'reporter' AND status = 'active' ORDER BY full_name ASC");
        res.json({ reporters });
    } catch (err) {
        console.error('Editor get reporters error:', err);
        res.status(500).json({ error: 'Failed to fetch reporters.' });
    }
});

/**
 * GET /api/editor/news/raw
 */
router.get('/news/raw', (req, res) => {
    try {
        // This is the raw-submission history. Keep processed entries in this
        // response so they remain visible (greyed out) after approval.
        const news = queryAll(`
            SELECT n.id, n.headline, SUBSTR(n.body, 1, 200) as body, n.status,
                   n.category, n.city, n.image_path, n.selected_image_path, n.created_at,
                   n.headline_rewritten, n.body_rewritten,
                   u.full_name as reporter_name
            FROM news n
            JOIN users u ON n.reporter_id = u.id
            WHERE n.status IN ('raw', 'processed')
            ORDER BY n.created_at DESC
        `);

        res.json({ news });
    } catch (err) {
        console.error('Editor get raw news error:', err);
        res.status(500).json({ error: 'Failed to fetch raw news.' });
    }
});

/**
 * GET /api/editor/news/processed
 */
router.get('/news/processed', (req, res) => {
    try {
        const news = queryAll(`
            SELECT n.id, n.headline, n.headline_rewritten,
                   SUBSTR(COALESCE(n.body_rewritten, n.body), 1, 200) as body_rewritten,
                   n.category, n.city, n.image_path, n.selected_image_path, n.ai_provider,
                   n.processed_at, u.full_name as reporter_name
            FROM news n
            JOIN users u ON n.reporter_id = u.id
            WHERE n.status = 'processed'
            ORDER BY n.processed_at DESC
        `);

        res.json({ news });
    } catch (err) {
        console.error('Editor get processed news error:', err);
        res.status(500).json({ error: 'Failed to fetch processed news.' });
    }
});

// GET /api/editor/news/forwarded — includes articles later marked published.
router.get('/news/forwarded', (req, res) => {
    try {
        const news = queryAll(`
            SELECT n.id, n.headline, n.headline_rewritten,
                   SUBSTR(COALESCE(n.body_rewritten, n.body), 1, 200) as body,
                   n.category, n.city, n.status, n.image_path, n.selected_image_path,
                   n.forwarded_at, n.published_at, n.external_hindi_url, n.external_english_url,
                   u.full_name as reporter_name
            FROM news n JOIN users u ON n.reporter_id = u.id
            WHERE n.forwarded_at IS NOT NULL
            ORDER BY n.forwarded_at DESC
        `);
        res.json({ news });
    } catch (err) {
        console.error('Editor get forwarded news error:', err);
        res.status(500).json({ error: 'Failed to fetch forwarded news.' });
    }
});

/**
 * GET /api/editor/news/rejected
 * IMPORTANT: Must be before /news/:id
 */
router.get('/news/rejected', (req, res) => {
    try {
        const news = queryAll(`
            SELECT n.id, n.headline, n.category, n.city, n.rejected_at, n.reject_reason,
                   u.full_name as reporter_name
            FROM news n
            JOIN users u ON n.reporter_id = u.id
            WHERE n.status = 'rejected'
            ORDER BY n.rejected_at DESC
        `);
        res.json({ news });
    } catch (err) {
        console.error('Editor get rejected news error:', err);
        res.status(500).json({ error: 'Failed to fetch rejected news.' });
    }
});

/**
 * GET /api/editor/news/published
 * IMPORTANT: Must be before /news/:id
 */
router.get('/news/published', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        const news = queryAll(`
            SELECT n.id, n.headline_rewritten as headline, n.category, n.city, n.published_at, n.status,
                   COALESCE(n.selected_image_path, n.image_path) as image_path,
                   u.full_name as reporter_name
            FROM news n
            JOIN users u ON n.reporter_id = u.id
            WHERE n.status = 'published' OR EXISTS (SELECT 1 FROM news_copies nc WHERE nc.news_id = n.id)
            ORDER BY COALESCE(n.published_at, n.created_at) DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        // Fetch copies for each news item
        const newsWithMeta = news.map(n => ({
            ...n,
            copies: queryAll(
                'SELECT u.full_name as operator_name, nc.copied_at FROM news_copies nc JOIN users u ON nc.operator_id = u.id WHERE nc.news_id = ? ORDER BY nc.copied_at DESC',
                [n.id]
            )
        }));

        res.json({ news: newsWithMeta });
    } catch (err) {
        console.error('Editor get published news error:', err);
        res.status(500).json({ error: 'Failed to fetch published news.' });
    }
});

/**
 * GET /api/editor/news/:id
 * IMPORTANT: This wildcard route must stay AFTER all named /news/* routes
 */
router.get('/news/:id', (req, res) => {
    try {
        const news = queryGet(`
            SELECT n.*, u.full_name as reporter_name
            FROM news n
            JOIN users u ON n.reporter_id = u.id
            WHERE n.id = ?
        `, [req.params.id]);

        if (!news) {
            return res.status(404).json({ error: 'News not found.' });
        }

        // Attach all images
        const images = queryAll('SELECT id, image_path, is_selected, sort_order FROM news_images WHERE news_id = ? ORDER BY sort_order ASC, id ASC', [news.id]);
        news.images = images;

        res.json(news);
    } catch (err) {
        console.error('Editor get news detail error:', err);
        res.status(500).json({ error: 'Failed to fetch news.' });
    }
});

/**
 * GET /api/editor/news/:id/images
 * Returns all images for a news article
 */
router.get('/news/:id/images', (req, res) => {
    try {
        const images = queryAll(
            'SELECT id, image_path, is_selected, sort_order FROM news_images WHERE news_id = ? ORDER BY sort_order ASC, id ASC',
            [req.params.id]
        );
        res.json({ images });
    } catch (err) {
        console.error('Editor get images error:', err);
        res.status(500).json({ error: 'Failed to fetch images.' });
    }
});

/**
 * POST /api/editor/news/:id/images/reorder
 * Body: { image_ids: [] } - persist editor-defined image sequence.
 */
router.post('/news/:id/images/reorder', (req, res) => {
    try {
        const newsId = req.params.id;
        const imageIds = Array.isArray(req.body.image_ids)
            ? req.body.image_ids.map(Number).filter(Number.isInteger)
            : [];
        const currentImages = queryAll(
            'SELECT id FROM news_images WHERE news_id = ? ORDER BY sort_order ASC, id ASC',
            [newsId]
        );
        const currentIds = currentImages.map(img => img.id);

        if (imageIds.length !== currentIds.length) {
            return res.status(400).json({ error: 'All article images must be included in the new order.' });
        }

        const currentSet = new Set(currentIds);
        const newSet = new Set(imageIds);
        if (newSet.size !== imageIds.length || imageIds.some(id => !currentSet.has(id))) {
            return res.status(400).json({ error: 'Invalid image order for this article.' });
        }

        imageIds.forEach((imageId, idx) => {
            queryRun('UPDATE news_images SET sort_order = ? WHERE id = ? AND news_id = ?', [idx, imageId, newsId]);
        });

        res.json({ success: true, image_ids: imageIds });
    } catch (err) {
        console.error('Editor reorder images error:', err);
        res.status(500).json({ error: 'Failed to reorder images.' });
    }
});

/**
 * POST /api/editor/news/:id/images/select
 * Body: { image_id } — mark an image as selected for publication
 */
router.post('/news/:id/images/select', (req, res) => {
    try {
        const { image_id } = req.body;
        const newsId = req.params.id;

        if (!image_id) {
            return res.status(400).json({ error: 'image_id is required.' });
        }

        // Get the image to verify it belongs to this news
        const img = queryGet('SELECT * FROM news_images WHERE id = ? AND news_id = ?', [image_id, newsId]);
        if (!img) {
            return res.status(404).json({ error: 'Image not found for this article.' });
        }

        // Deselect all images for this news, then select the chosen one
        queryRun('UPDATE news_images SET is_selected = 0 WHERE news_id = ?', [newsId]);
        queryRun('UPDATE news_images SET is_selected = 1 WHERE id = ?', [image_id]);

        // Update selected_image_path on the news row
        queryRun('UPDATE news SET selected_image_path = ? WHERE id = ?', [img.image_path, newsId]);

        res.json({ success: true, selected_image_path: img.image_path });
    } catch (err) {
        console.error('Editor select image error:', err);
        res.status(500).json({ error: 'Failed to select image.' });
    }
});

/**
 * POST /api/editor/news/:id/images/:imageId/delete
 * Delete one uploaded image from an article and repair cover/order metadata.
 */
router.post('/news/:id/images/:imageId/delete', (req, res) => {
    try {
        const newsId = req.params.id;
        const imageId = Number(req.params.imageId);
        if (!Number.isInteger(imageId)) {
            return res.status(400).json({ error: 'Invalid image id.' });
        }

        const news = queryGet('SELECT id, image_path, selected_image_path FROM news WHERE id = ?', [newsId]);
        if (!news) return res.status(404).json({ error: 'News not found.' });

        const image = queryGet('SELECT id, image_path, is_selected FROM news_images WHERE id = ? AND news_id = ?', [imageId, newsId]);
        if (!image) return res.status(404).json({ error: 'Image not found for this article.' });

        queryRun('DELETE FROM news_images WHERE id = ? AND news_id = ?', [imageId, newsId]);

        const remainingImages = queryAll(
            'SELECT id, image_path, is_selected FROM news_images WHERE news_id = ? ORDER BY sort_order ASC, id ASC',
            [newsId]
        );

        remainingImages.forEach((img, idx) => {
            queryRun('UPDATE news_images SET sort_order = ? WHERE id = ?', [idx, img.id]);
        });

        let selectedImagePath = null;
        if (remainingImages.length > 0) {
            let selected = remainingImages.find(img => img.is_selected);
            if (!selected || image.is_selected || news.selected_image_path === image.image_path) {
                selected = remainingImages[0];
                queryRun('UPDATE news_images SET is_selected = 0 WHERE news_id = ?', [newsId]);
                queryRun('UPDATE news_images SET is_selected = 1 WHERE id = ?', [selected.id]);
            }
            selectedImagePath = selected.image_path;
        }

        const primaryImagePath = remainingImages[0]?.image_path || null;
        queryRun(
            'UPDATE news SET image_path = ?, selected_image_path = ? WHERE id = ?',
            [primaryImagePath, selectedImagePath, newsId]
        );

        try {
            const fullPath = resolveUpload(image.image_path);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        } catch (fileError) {
            console.error('Editor delete single image cleanup error:', fileError);
        }

        res.json({
            success: true,
            deleted_image_id: imageId,
            image_path: primaryImagePath,
            selected_image_path: selectedImagePath,
            images: remainingImages.map((img, idx) => ({
                ...img,
                sort_order: idx,
                is_selected: img.image_path === selectedImagePath ? 1 : 0
            }))
        });
    } catch (err) {
        console.error('Editor delete single image error:', err);
        res.status(500).json({ error: 'Failed to delete image.' });
    }
});

/**
 * POST /api/editor/news/:id/rewrite
 * Fetches reporter's name_hi/name_en/post and city, passes them to AI rewriter
 */
router.post('/news/:id/rewrite', async (req, res) => {
    try {
        const news = queryGet('SELECT * FROM news WHERE id = ? AND status = ?', [req.params.id, 'raw']);
        if (!news) {
            return res.status(404).json({ error: 'News not found or not in raw status.' });
        }

        const {
            provider = null,
            targetWords = 400,
            numSubheadings = 3,
            captionWords = 30,
            language = 'hi'
        } = req.body;

        // Fetch reporter's profile for byline
        const reporter = queryGet(
            'SELECT full_name, name_hi, name_en, post FROM users WHERE id = ?',
            [news.reporter_id]
        );

        // Choose name based on language (Hindi article → name_hi, English → name_en)
        const reporterName = language === 'hi'
            ? (reporter?.name_hi || reporter?.full_name || '')
            : (reporter?.name_en || reporter?.full_name || '');
        const reporterPost = reporter?.post || '';
        const city = news.city || '';

        // Update status to processing
        queryRun('UPDATE news SET status = ? WHERE id = ?', ['processing', news.id]);

        try {
            const result = await rewriteArticle(news.headline, news.body, {
                provider,
                targetWords,
                numSubheadings,
                captionWords,
                language,
                reporterName,
                reporterPost,
                city
            });

            const usedProvider = provider || queryGet("SELECT value FROM settings WHERE key = 'ai_provider'")?.value || 'gemini';

            // Save rewritten content and move it to processed review.
            queryRun(
                "UPDATE news SET headline_rewritten = ?, body_rewritten = ?, ai_provider = ?, status = 'processed', editor_id = ?, processed_at = datetime('now', 'localtime') WHERE id = ?",
                [result.headline, result.body, usedProvider, req.user.id, news.id]
            );

            res.json({
                id: news.id,
                headline_rewritten: result.headline,
                body_rewritten: result.body,
                ai_provider: usedProvider
            });
        } catch (aiError) {
            // Revert status on AI failure
            queryRun('UPDATE news SET status = ? WHERE id = ?', ['raw', news.id]);
            throw aiError;
        }
    } catch (err) {
        console.error('Editor rewrite error:', err);
        res.status(500).json({ error: `AI rewrite failed: ${err.message}`, retryAllowed: true });
    }
});

/**
 * PUT /api/editor/news/:id/content
 * Save manual edits to rewritten text while reviewing raw rewrites or processed news.
 */
router.put('/news/:id/content', (req, res) => {
    try {
        const news = queryGet('SELECT * FROM news WHERE id = ?', [req.params.id]);
        if (!news) {
            return res.status(404).json({ error: 'News not found.' });
        }
        if (!['raw', 'processed'].includes(news.status)) {
            return res.status(400).json({ error: 'News can only be edited during rewrite review or processed review.' });
        }

        const headline = String(req.body.headline_rewritten || '').trim();
        const body = String(req.body.body_rewritten || '').trim();
        if (!headline || !body) {
            return res.status(400).json({ error: 'Headline and body are required.' });
        }

        queryRun(
            'UPDATE news SET headline_rewritten = ?, body_rewritten = ? WHERE id = ?',
            [headline, body, news.id]
        );

        res.json({
            success: true,
            headline_rewritten: headline,
            body_rewritten: body
        });
    } catch (err) {
        console.error('Editor update content error:', err);
        res.status(500).json({ error: 'Failed to save edited news.' });
    }
});

/**
 * PUT /api/editor/news/:id/approve
 */
router.put('/news/:id/approve', (req, res) => {
    try {
        const news = queryGet('SELECT * FROM news WHERE id = ?', [req.params.id]);
        if (!news) {
            return res.status(404).json({ error: 'News not found.' });
        }
        if (!['raw', 'processed'].includes(news.status)) {
            return res.status(400).json({ error: 'Only raw or processed news can be approved.' });
        }

        const { headline_rewritten, body_rewritten } = req.body;

        if (headline_rewritten) {
            queryRun('UPDATE news SET headline_rewritten = ? WHERE id = ?', [headline_rewritten, news.id]);
        }
        if (body_rewritten) {
            queryRun('UPDATE news SET body_rewritten = ? WHERE id = ?', [body_rewritten, news.id]);
        }

        queryRun(
            "UPDATE news SET status = 'processed', editor_id = ?, processed_at = datetime('now', 'localtime') WHERE id = ?",
            [req.user.id, news.id]
        );

        res.json({ message: 'News approved and processed.' });
    } catch (err) {
        console.error('Editor approve error:', err);
        res.status(500).json({ error: 'Failed to approve news.' });
    }
});

/**
 * POST /api/editor/news/:id/forward
 */
router.post('/news/:id/forward', async (req, res) => {
    try {
        const news = queryGet('SELECT * FROM news WHERE id = ? AND status = ?', [req.params.id, 'processed']);
        if (!news) {
            return res.status(400).json({ error: 'News must be processed before forwarding.' });
        }

        queryRun(
            "UPDATE news SET status = 'forwarded', forwarded_at = datetime('now', 'localtime') WHERE id = ?",
            [news.id]
        );

        const externalNews = queryGet(`
            SELECT n.*, u.full_name AS reporter_name, u.name_hi, u.name_en
            FROM news n JOIN users u ON u.id = n.reporter_id WHERE n.id = ?
        `, [news.id]);
        let externalDelivery;
        try {
            externalDelivery = await deliverForwardedNews(externalNews);
            if (externalDelivery.postedLinks?.hindiUrl || externalDelivery.postedLinks?.englishUrl) {
                const linkedNewsId = parseExternalNewsId(externalDelivery.responseExternalId || externalDelivery.externalId) || news.id;
                if (linkedNewsId !== news.id) {
                    throw new Error(`External API returned mismatched externalId ${externalDelivery.responseExternalId}`);
                }
                queryRun(
                    `UPDATE news
                     SET external_hindi_url = COALESCE(?, external_hindi_url),
                         external_english_url = COALESCE(?, external_english_url),
                         external_posted_at = datetime('now', 'localtime')
                     WHERE id = ?`,
                    [externalDelivery.postedLinks.hindiUrl, externalDelivery.postedLinks.englishUrl, linkedNewsId]
                );
            }
        } catch (deliveryError) {
            // Do not lose the operator handoff when the remote service is temporarily down.
            console.error('External news delivery error:', deliveryError.message);
            externalDelivery = { enabled: true, delivered: false, error: deliveryError.message };
        }

        res.json({
            message: externalDelivery?.delivered ? 'News forwarded to operators and external news API.' : 'News forwarded to operators.',
            externalDelivery
        });
    } catch (err) {
        console.error('Editor forward error:', err);
        res.status(500).json({ error: 'Failed to forward news.' });
    }
});

/**
 * POST /api/editor/news/:id/reject
 */
router.post('/news/:id/reject', (req, res) => {
    try {
        const { reason } = req.body;
        const news = queryGet("SELECT * FROM news WHERE id = ? AND status IN ('raw', 'processed')", [req.params.id]);
        if (!news) return res.status(404).json({ error: 'News not found.' });

        queryRun(
            "UPDATE news SET status = 'rejected', rejected_at = datetime('now', 'localtime'), rejected_by = ?, reject_reason = ? WHERE id = ?",
            [req.user.id, reason || '', news.id]
        );
        res.json({ success: true, message: 'News rejected.' });
    } catch (err) {
        console.error('Editor reject error:', err);
        res.status(500).json({ error: 'Failed to reject news.' });
    }
});

/**
 * POST /api/editor/news/:id/restore
 */
router.post('/news/:id/restore', (req, res) => {
    try {
        const news = queryGet("SELECT * FROM news WHERE id = ? AND status = 'rejected'", [req.params.id]);
        if (!news) return res.status(404).json({ error: 'News not found or not rejected.' });

        queryRun(
            "UPDATE news SET status = 'raw' WHERE id = ?",
            [news.id]
        );
        res.json({ success: true, message: 'News restored to raw.' });
    } catch (err) {
        console.error('Editor restore error:', err);
        res.status(500).json({ error: 'Failed to restore news.' });
    }
});

/**
 * POST /api/editor/news/:id/delete
 */
router.post('/news/:id/delete', (req, res) => {
    try {
        const news = queryGet("SELECT * FROM news WHERE id = ?", [req.params.id]);
        if (!news) return res.status(404).json({ error: 'News not found.' });

        const imagePaths = new Set(queryAll('SELECT image_path FROM news_images WHERE news_id = ?', [news.id]).map(row => row.image_path));
        if (news.image_path) imagePaths.add(news.image_path);
        if (news.selected_image_path) imagePaths.add(news.selected_image_path);

        queryRun('DELETE FROM news_copies WHERE news_id = ?', [news.id]);
        queryRun('DELETE FROM news_images WHERE news_id = ?', [news.id]);
        queryRun('DELETE FROM news WHERE id = ?', [news.id]);

        for (const imagePath of imagePaths) {
            try {
                const fullPath = resolveUpload(imagePath);
                if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            } catch (fileError) {
                console.error('Editor delete image cleanup error:', fileError);
            }
        }

        res.json({ success: true, message: 'News deleted.' });
    } catch (err) {
        console.error('Editor delete error:', err);
        res.status(500).json({ error: 'Failed to delete news.' });
    }
});

module.exports = router;
