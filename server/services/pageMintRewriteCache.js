const { queryAll, queryGet, queryRun } = require('../db/init');
const { buildNewspaperPayload } = require('./newspaperGenerator');
const { rewritePageMintBundle } = require('./pageMintBundleRewriter');

const RETENTION_HOURS = 26;

function jsonText(value) {
    return JSON.stringify(value ?? null);
}

function parseJson(value) {
    return value ? JSON.parse(value) : null;
}

function articleNewsId(article) {
    const value = Number(article?.newsId ?? article?.id);
    return Number.isInteger(value) && value > 0 ? value : null;
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

function getFreshCachedArticle(targetUserId, newsId) {
    const row = queryGet(`
        SELECT rewritten_article_json
        FROM pagemint_rewritten_articles
        WHERE target_user_id = ?
          AND news_id = ?
          AND rewritten_article_json IS NOT NULL
          AND rewrite_status IN ('rewritten','skipped')
          AND datetime(created_at) >= datetime('now', 'localtime', ?)
        LIMIT 1
    `, [targetUserId, newsId, `-${RETENTION_HOURS} hours`]);
    return parseJson(row?.rewritten_article_json);
}

function markArticleRewriting({ targetUser, article, payload }) {
    const newsId = articleNewsId(article);
    if (!newsId) return;

    queryRun(`
        INSERT INTO pagemint_rewritten_articles
            (target_user_id, target_role, news_id, job_id, bundle_id, edition_id, category, source_article_json, rewrite_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'rewriting', datetime('now', 'localtime'))
        ON CONFLICT(target_user_id, news_id) DO UPDATE SET
            target_role = excluded.target_role,
            job_id = excluded.job_id,
            bundle_id = excluded.bundle_id,
            edition_id = excluded.edition_id,
            category = excluded.category,
            source_article_json = excluded.source_article_json,
            rewrite_status = 'rewriting',
            error_message = NULL,
            created_at = datetime('now', 'localtime')
    `, [
        targetUser.id,
        targetUser.role,
        newsId,
        payload.job_id,
        payload.bundle_id,
        payload.edition_id,
        article.category || null,
        jsonText(article)
    ]);
}

function markArticleRewritten({ targetUser, article, payload, rewrittenArticle, rewriteResult }) {
    const newsId = articleNewsId(article);
    if (!newsId) return;
    const status = rewriteResult?.rewritten === false ? 'skipped' : 'rewritten';

    queryRun(`
        UPDATE pagemint_rewritten_articles
        SET rewritten_article_json = ?,
            category = COALESCE(?, category),
            rewrite_status = ?,
            rewritten_at = datetime('now', 'localtime'),
            error_message = NULL
        WHERE target_user_id = ? AND news_id = ?
    `, [jsonText(rewrittenArticle), rewrittenArticle.category || null, status, targetUser.id, newsId]);
}

function markArticleFailed({ targetUser, article, err }) {
    const newsId = articleNewsId(article);
    if (!newsId) return;
    queryRun(`
        UPDATE pagemint_rewritten_articles
        SET rewrite_status = 'failed',
            error_message = ?
        WHERE target_user_id = ? AND news_id = ?
    `, [err.message || String(err), targetUser.id, newsId]);
}

async function rewriteAndCachePageMintArticle({ targetUser, payload, article }) {
    const newsId = articleNewsId(article);
    if (!newsId) return article;

    const cached = getFreshCachedArticle(targetUser.id, newsId);
    if (cached) return cached;

    markArticleRewriting({ targetUser, article, payload });
    try {
        const singlePayload = filteredPayload(payload, [article]);
        const rewrite = await rewritePageMintBundle(singlePayload);
        const rewrittenArticle = rewrite.payload?.articles?.[0] || article;
        markArticleRewritten({
            targetUser,
            article,
            payload,
            rewrittenArticle,
            rewriteResult: rewrite.result
        });
        return rewrittenArticle;
    } catch (err) {
        markArticleFailed({ targetUser, article, err });
        throw err;
    }
}

async function rewriteAndCachePageMintBundle({ targetUser, payload }) {
    const sourceArticles = Array.isArray(payload.articles) ? payload.articles : [];
    const articles = [];
    let cachedCount = 0;
    const seenNewsIds = new Set();

    for (const article of sourceArticles) {
        const newsId = articleNewsId(article);
        if (newsId && seenNewsIds.has(newsId)) continue;
        if (newsId) seenNewsIds.add(newsId);
        const cached = newsId ? getFreshCachedArticle(targetUser.id, newsId) : null;
        if (cached) {
            cachedCount += 1;
            articles.push(cached);
        } else {
            articles.push(await rewriteAndCachePageMintArticle({ targetUser, payload, article }));
        }
    }

    const rewrittenPayload = {
        ...filteredPayload(payload, articles),
        meta: {
            ...(payload.meta || {}),
            schemaVersion: 'nms-pagemint-v3-ai-rewritten-cache',
            count: articles.length,
            articleIds: articles.map(article => article.newsId ?? article.id).filter(value => value != null),
            pageMintAiRewrite: {
                enabled: true,
                rewritten: true,
                cachedArticleStore: true,
                cachedCount,
                articleCount: articles.length,
                rewrittenAt: new Date().toISOString()
            }
        }
    };

    return {
        payload: rewrittenPayload,
        result: rewrittenPayload.meta.pageMintAiRewrite
    };
}

function getTargetUserForNews(news) {
    if (news.sub_editor_id && news.sub_editor_status === 'forwarded') {
        return queryGet(`
            SELECT id, full_name, name_hi, name_en, post, district, city, role, is_api_enabled, print_designation, print_place_name, avatar_path
            FROM users
            WHERE id = ? AND role = 'sub_editor' AND status = 'active'
        `, [news.sub_editor_id]);
    }

    return queryGet(`
        SELECT id, full_name, name_hi, name_en, post, district, city, role, is_api_enabled, print_designation, print_place_name, avatar_path
        FROM users
        WHERE id = ? AND role = 'reporter' AND is_api_enabled = 1 AND status = 'active'
    `, [news.reporter_id]);
}

function getPageMintArticleSource(newsId) {
    return queryGet(`
        SELECT n.*, u.full_name as reporter_name, u.name_hi as reporter_name_hi, u.name_en as reporter_name_en,
               u.post as reporter_designation, u.print_designation as reporter_print_designation,
               u.print_place_name as reporter_print_place_name,
               u.avatar_path as reporter_photo_url, u.city as reporter_city,
               u.district as reporter_district
        FROM news n
        LEFT JOIN users u ON u.id = n.reporter_id
        WHERE n.id = ?
          AND n.status IN ('processed', 'forwarded')
    `, [newsId]);
}

function getImagesByNewsId(newsId) {
    const images = queryAll(`
        SELECT news_id, id, image_path, is_selected, sort_order
        FROM news_images
        WHERE news_id = ?
        ORDER BY sort_order ASC, id ASC
    `, [newsId]);
    const imagesByNewsId = new Map();
    imagesByNewsId.set(Number(newsId), images);
    return imagesByNewsId;
}

function queuePageMintRewriteForNews(newsId, baseUrl) {
    setImmediate(async () => {
        try {
            const article = getPageMintArticleSource(newsId);
            if (!article) return;

            const targetUser = getTargetUserForNews(article);
            if (!targetUser) return;

            const payload = buildNewspaperPayload({
                targetUser,
                articles: [article],
                imagesByNewsId: getImagesByNewsId(article.id),
                baseUrl
            });
            await rewriteAndCachePageMintBundle({ targetUser, payload });
            console.log('PageMint article rewrite cached:', { target_user_id: targetUser.id, news_id: article.id });
        } catch (err) {
            console.error('PageMint article rewrite cache error:', err.message || err);
        }
    });
}

module.exports = {
    RETENTION_HOURS,
    filteredPayload,
    rewriteAndCachePageMintBundle,
    queuePageMintRewriteForNews
};
