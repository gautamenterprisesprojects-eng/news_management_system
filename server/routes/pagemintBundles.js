const express = require('express');
const crypto = require('crypto');
const { queryAll, queryGet } = require('../db/init');

const router = express.Router();
const RETENTION_HOURS = 26;

function getConfiguredKey() {
    return process.env.PAGEMINT_BUNDLE_READ_API_KEY
        || process.env.NEWSPAPER_GENERATOR_API_KEY
        || process.env.NEWSPAPER_GENERATOR_WEBHOOK_KEY
        || process.env.EXTERNAL_NEWS_API_KEY
        || '';
}

function safeEqual(a, b) {
    if (!a || !b) return false;
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isAuthorized(req) {
    const configuredKey = getConfiguredKey();
    if (!configuredKey) return false;

    const authorization = req.headers.authorization || '';
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const direct = req.get('x-api-key') || '';
    return safeEqual(bearer, configuredKey) || safeEqual(direct, configuredKey);
}

function parsePositiveInt(value, fallback, max) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) return fallback;
    return typeof max === 'number' ? Math.min(parsed, max) : parsed;
}

function authorize(req, res) {
    if (!getConfiguredKey()) {
        res.status(503).json({ success: false, error: 'PageMint bundle read API key is not configured.' });
        return false;
    }
    if (!isAuthorized(req)) {
        res.status(401).json({ success: false, error: 'Invalid or missing PageMint bundle read API key.' });
        return false;
    }
    return true;
}

function articleId(article) {
    return String(article?.newsId ?? article?.id ?? '').trim();
}

function parseRequestedIds(req) {
    const raw = req.query.news_id || req.query.news_ids || req.query.article_id || req.query.article_ids;
    if (!raw) return null;
    const values = Array.isArray(raw) ? raw : String(raw).split(',');
    const ids = values.map(value => String(value).trim()).filter(Boolean);
    return ids.length ? new Set(ids) : null;
}

function parseExcludedIds(req) {
    const raw = req.query.exclude_news_ids
        || req.query.exclude_article_ids
        || req.query.used_news_ids
        || req.query.used_article_ids
        || req.query.exclude_ids;
    if (!raw) return new Set();
    const values = Array.isArray(raw) ? raw : String(raw).split(',');
    return new Set(values.map(value => String(value).trim()).filter(Boolean));
}

function uniqueRowsByNewsId(rows, excludeIds = new Set()) {
    const seen = new Set(excludeIds);
    const unique = [];
    for (const row of rows) {
        const key = String(row.news_id || '').trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(row);
    }
    return unique;
}

function findBundle(identifier) {
    if (identifier === 'latest') {
        return queryGet(`
            SELECT *
            FROM pagemint_bundles
            WHERE rewritten_payload_json IS NOT NULL
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        `);
    }

    return queryGet(
        'SELECT * FROM pagemint_bundles WHERE job_id = ? OR bundle_id = ? LIMIT 1',
        [identifier, identifier]
    );
}

function filteredPayload(payload, articles) {
    const next = {
        ...payload,
        count: articles.length,
        articles
    };

    if (payload.meta && typeof payload.meta === 'object') {
        next.meta = {
            ...payload.meta,
            count: articles.length,
            articleIds: articles.map(article => article.newsId ?? article.id).filter(value => value != null)
        };
    }

    return next;
}

function readFilteredArticleFeed(req, res) {
    if (!authorize(req, res)) return;

    try {
        const targetUserId = Number(req.params.targetUserId || req.query.target_user_id || req.query.targetUserId);
        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({ success: false, error: 'target_user_id is required.' });
        }

        const category = String(req.query.category || '').trim();
        const excludedIds = parseExcludedIds(req);
        const offset = parsePositiveInt(req.query.offset, 0);
        const limit = req.query.limit == null ? 20 : parsePositiveInt(req.query.limit, 20, 100);
        const params = [targetUserId, `-${RETENTION_HOURS} hours`];

        const rows = queryAll(`
            SELECT news_id, category, rewritten_article_json, rewritten_at, created_at
            FROM pagemint_rewritten_articles
            WHERE target_user_id = ?
              AND rewrite_status IN ('rewritten','skipped')
              AND rewritten_article_json IS NOT NULL
              AND datetime(created_at) >= datetime('now', 'localtime', ?)
            ORDER BY datetime(created_at) DESC, id DESC
        `, params);
        const uniqueRows = uniqueRowsByNewsId(rows, excludedIds);
        const categoryRows = category
            ? uniqueRows.filter(row => String(row.category || '').trim().toLowerCase() === category.toLowerCase())
            : uniqueRows;
        const fallbackRows = category
            ? uniqueRows.filter(row => String(row.category || '').trim().toLowerCase() !== category.toLowerCase())
            : [];
        const articles = [...categoryRows, ...fallbackRows].map(row => JSON.parse(row.rewritten_article_json));
        const selected = articles.slice(offset, offset + limit);

        res.json({
            success: true,
            data: selected,
            articles: selected,
            meta: {
                target_user_id: targetUserId,
                category: category || null,
                payload_source: 'pagemint_rewritten_articles',
                total: articles.length,
                category_matches: categoryRows.length,
                fallback_matches: fallbackRows.length,
                excluded_count: excludedIds.size,
                offset,
                limit,
                count: selected.length,
                retention_hours: RETENTION_HOURS
            }
        });
    } catch (err) {
        console.error('PageMint rewritten article feed API error:', err);
        res.status(500).json({ success: false, error: 'Failed to read PageMint rewritten articles.' });
    }
}

router.get('/articles', readFilteredArticleFeed);
router.get('/targets/:targetUserId/articles', readFilteredArticleFeed);

router.get('/:identifier/articles', (req, res) => {
    if (!authorize(req, res)) return;

    try {
        const identifier = String(req.params.identifier || '').trim();
        if (!identifier) {
            return res.status(400).json({ success: false, error: 'Bundle identifier is required.' });
        }

        const bundle = findBundle(identifier);
        if (!bundle) {
            return res.status(404).json({ success: false, error: 'PageMint bundle not found.' });
        }
        if (!bundle.rewritten_payload_json) {
            return res.status(409).json({ success: false, error: 'PageMint rewritten bundle is not ready yet.' });
        }

        const payload = JSON.parse(bundle.rewritten_payload_json);
        const allArticles = Array.isArray(payload.articles) ? payload.articles : [];
        const requestedIds = parseRequestedIds(req);
        const matchingArticles = requestedIds
            ? allArticles.filter(article => requestedIds.has(articleId(article)))
            : allArticles;
        const offset = parsePositiveInt(req.query.offset, 0);
        const limit = req.query.limit == null
            ? matchingArticles.length
            : parsePositiveInt(req.query.limit, matchingArticles.length, 100);
        const articles = matchingArticles.slice(offset, offset + limit);

        res.json({
            success: true,
            job_id: bundle.job_id,
            bundle_id: bundle.bundle_id,
            edition_id: bundle.edition_id,
            target_user_id: bundle.target_user_id,
            payload_source: 'rewritten',
            total_articles: allArticles.length,
            matched_articles: matchingArticles.length,
            offset,
            limit,
            count: articles.length,
            articles,
            payload: filteredPayload(payload, articles)
        });
    } catch (err) {
        console.error('PageMint filtered bundle API error:', err);
        res.status(500).json({ success: false, error: 'Failed to read PageMint bundle articles.' });
    }
});

module.exports = router;
