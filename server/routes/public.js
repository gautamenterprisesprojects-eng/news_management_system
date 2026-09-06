const express = require('express');
const router = express.Router();
const { queryAll } = require('../db/init');

// GET /api/public/news
// Public API to fetch finalized news articles (forwarded or published)
// Can be used to inject into external websites
router.get('/news', (req, res) => {
    try {
        const news = queryAll(`
            SELECT 
                n.id, 
                n.headline_rewritten as headline, 
                n.body_rewritten as body, 
                n.image_path, 
                n.category, 
                n.city, 
                n.status,
                n.created_at,
                n.published_at,
                u.name_hi as reporter_name_hi,
                u.name_en as reporter_name_en,
                u.post as reporter_post
            FROM news n
            LEFT JOIN users u ON n.reporter_id = u.id
            WHERE n.status IN ('forwarded', 'published')
            ORDER BY n.created_at DESC
        `);

        // Convert relative image paths to absolute URLs based on request host
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const formattedNews = news.map(article => ({
            ...article,
            image_url: article.image_path ? `${baseUrl}${article.image_path}` : null
        }));

        res.json({
            success: true,
            count: formattedNews.length,
            data: formattedNews
        });
    } catch (err) {
        console.error('Error fetching public news:', err);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

module.exports = router;
