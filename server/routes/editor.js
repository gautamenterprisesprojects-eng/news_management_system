const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryGet, queryRun } = require('../db/init');
const { verifyToken, requireRole } = require('../middleware/auth');
const { rewriteArticle } = require('../services/aiRewriter');
const { resolveUpload, uploadsDir, pdfsDir } = require('../storage');
const { deliverForwardedNews, parseExternalNewsId } = require('../services/externalNews');
const {
    buildNewspaperPayload,
    sendNewspaperBundle,
    getBaseUrl
} = require('../services/newspaperGenerator');
const { rewriteAndCachePageMintBundle, queuePageMintRewriteForNews } = require('../services/pageMintRewriteCache');
const { sendPushToEditors } = require('../services/pushNotifications');

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

/**
 * Places `leadId` first in `ids` (if present) so it lands in PageMint's
 * front-page lead box — bundle order IS placement order, PageMint reads no
 * separate "lead" field. Returns a new array; `ids` order is preserved for
 * everything else. No-op when leadId is absent or not part of `ids`.
 */
function reorderWithLeadFirst(ids, leadId) {
    if (leadId == null) return ids;
    const leadKey = String(leadId);
    const rest = ids.filter(id => String(id) !== leadKey);
    if (rest.length === ids.length) return ids; // leadId wasn't in the selection
    const lead = ids.find(id => String(id) === leadKey);
    return [lead, ...rest];
}

// All editor routes require editor role
router.use(verifyToken, requireRole('editor'));

const editorImageStorage = multer.diskStorage({
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

const editorImageUpload = multer({
    storage: editorImageStorage,
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

const MAX_NEWS_IMAGES = 10;

function editorVisibleClause(filterValue, params) {
    if (filterValue === 'direct') return 'AND n.sub_editor_id IS NULL';
    if (filterValue && filterValue !== 'all') {
        params.push(Number(filterValue));
        return "AND n.sub_editor_id = ? AND n.sub_editor_status = 'forwarded'";
    }
    return "AND (n.sub_editor_id IS NULL OR n.sub_editor_status = 'forwarded')";
}

function subEditorSelectFields() {
    return `
        se.id as sub_editor_id,
        se.full_name as sub_editor_name,
        se.name_hi as sub_editor_name_hi,
        se.name_en as sub_editor_name_en,
        se.post as sub_editor_post,
        COALESCE(se.district, se.city) as sub_editor_district
    `;
}

function isVisibleToMainEditor(news) {
    return !news.sub_editor_id || news.sub_editor_status === 'forwarded';
}

function jsonText(value) {
    return JSON.stringify(value ?? null);
}

function insertPageMintBundleRecord({ targetUser, newsIds, payload, leadNewsId = null }) {
    queryRun(
        `INSERT INTO pagemint_bundles
         (target_user_id, target_role, job_id, bundle_id, edition_id, news_ids_json, original_payload_json, lead_news_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            targetUser.id,
            targetUser.role,
            payload.job_id,
            payload.bundle_id,
            payload.edition_id,
            jsonText(newsIds),
            jsonText(payload),
            leadNewsId ?? null
        ]
    );
}

function markPageMintBundleRewriting(jobId) {
    queryRun(
        "UPDATE pagemint_bundles SET rewrite_status = 'rewriting' WHERE job_id = ?",
        [jobId]
    );
}

function markPageMintBundleRewriteResult(jobId, payload, result) {
    const status = result?.rewritten === false ? 'skipped' : 'rewritten';
    queryRun(
        `UPDATE pagemint_bundles
         SET rewrite_status = ?,
             rewritten_payload_json = ?,
             rewritten_at = datetime('now', 'localtime')
         WHERE job_id = ?`,
        [status, jsonText(payload), jobId]
    );
}

function markPageMintBundleDeliverySending(jobId) {
    queryRun(
        "UPDATE pagemint_bundles SET delivery_status = 'sending' WHERE job_id = ?",
        [jobId]
    );
}

function markPageMintBundleDeliveryResult(jobId, delivery) {
    const status = delivery.delivered ? 'delivered' : 'skipped';
    queryRun(
        `UPDATE pagemint_bundles
         SET delivery_status = ?,
             delivery_response_json = ?,
             delivered_at = CASE WHEN ? = 'delivered' THEN datetime('now', 'localtime') ELSE delivered_at END,
             error_message = CASE WHEN ? = 'skipped' THEN ? ELSE error_message END
         WHERE job_id = ?`,
        [status, jsonText(delivery), status, status, delivery.error || delivery.reason || null, jobId]
    );
}

function countUploadPathReferences(imagePath) {
    const imageRows = queryGet('SELECT COUNT(*) as c FROM news_images WHERE image_path = ?', [imagePath])?.c || 0;
    const newsRows = queryGet(
        'SELECT COUNT(*) as c FROM news WHERE image_path = ? OR selected_image_path = ?',
        [imagePath, imagePath]
    )?.c || 0;
    return imageRows + newsRows;
}

function deleteUploadFileIfUnused(imagePath) {
    if (!imagePath || !imagePath.startsWith('/uploads/')) return;
    if (countUploadPathReferences(imagePath) > 0) return;
    try {
        fs.unlinkSync(resolveUpload(imagePath));
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.warn('Could not delete unused upload:', imagePath, err.message);
        }
    }
}

function markPageMintBundleFailed(jobId, stage, err) {
    if (stage === 'rewrite') {
        queryRun(
            `UPDATE pagemint_bundles
             SET rewrite_status = 'failed',
                 delivery_status = 'failed',
                 error_message = ?
             WHERE job_id = ?`,
            [err.message || String(err), jobId]
        );
        return;
    }

    queryRun(
        `UPDATE pagemint_bundles
         SET delivery_status = 'failed',
             error_message = ?
         WHERE job_id = ?`,
        [err.message || String(err), jobId]
    );
}

const PAGE_MINT_TARGET_USER_SQL = `
    SELECT id, full_name, name_hi, name_en, post, district, city, role, is_api_enabled, print_designation, print_place_name, avatar_path
    FROM users
    WHERE id = ? AND status = 'active'
`;

const PAGE_MINT_ARTICLE_REPORTER_SQL = `
    u.full_name as reporter_name, u.name_hi as reporter_name_hi, u.name_en as reporter_name_en,
    u.post as reporter_designation, u.print_designation as reporter_print_designation,
    u.print_place_name as reporter_print_place_name,
    u.avatar_path as reporter_photo_url, u.city as reporter_city,
    u.district as reporter_district
`;

function resolveRawNewsPageMintTarget(news) {
    if (news.sub_editor_id && news.sub_editor_status === 'forwarded') {
        const subEditor = queryGet(`${PAGE_MINT_TARGET_USER_SQL}`, [news.sub_editor_id]);
        if (subEditor?.role === 'sub_editor') {
            return subEditor;
        }
    }
    const reporter = queryGet(`${PAGE_MINT_TARGET_USER_SQL}`, [news.reporter_id]);
    if (reporter?.role === 'reporter' && reporter.is_api_enabled) {
        return reporter;
    }
    if (news.sub_editor_id) {
        const subEditor = queryGet(`${PAGE_MINT_TARGET_USER_SQL}`, [news.sub_editor_id]);
        if (subEditor?.role === 'sub_editor') {
            return subEditor;
        }
    }
    return null;
}

function fetchRawNewsRowForPageMintTarget(newsId, targetUser) {
    const base = `
        SELECT n.*, ${PAGE_MINT_ARTICLE_REPORTER_SQL}
        FROM news n
        LEFT JOIN users u ON u.id = n.reporter_id
        WHERE n.id = ?
          AND n.status = 'raw'
          AND TRIM(COALESCE(n.headline, '')) != ''
          AND TRIM(COALESCE(n.body, '')) != ''
    `;
    if (targetUser.role === 'sub_editor') {
        return queryGet(`${base} AND n.sub_editor_id = ?`, [newsId, targetUser.id]);
    }
    return queryGet(`${base} AND n.reporter_id = ?`, [newsId, targetUser.id]);
}

function isValidPageMintApiTargetUser(user) {
    if (!user) return false;
    if (user.role === 'sub_editor') return true;
    return user.role === 'reporter' && user.is_api_enabled;
}

function queryApiTargetRawNews(target, orderDirection) {
    const orderBy = `ORDER BY datetime(n.created_at) ${orderDirection}, n.id ${orderDirection}`;
    const bodyFilter = `
          AND TRIM(COALESCE(n.headline, '')) != ''
          AND TRIM(COALESCE(n.body, '')) != ''
    `;
    if (target.role === 'sub_editor') {
        return queryAll(`
            SELECT n.*, u.full_name as reporter_name
            FROM news n
            JOIN users u ON u.id = n.reporter_id
            WHERE n.sub_editor_id = ?
              AND n.status = 'raw'
              ${bodyFilter}
            ${orderBy}
        `, [target.id]);
    }
    return queryAll(`
        SELECT n.*, u.full_name as reporter_name
        FROM news n
        JOIN users u ON u.id = n.reporter_id
        WHERE n.reporter_id = ?
          AND n.status = 'raw'
          ${bodyFilter}
          AND NOT (n.sub_editor_id IS NOT NULL AND n.sub_editor_status = 'forwarded')
        ${orderBy}
    `, [target.id]);
}

function countApiTargetRawNews(target) {
    if (target.role === 'sub_editor') {
        return queryGet(`
            SELECT COUNT(*) as c
            FROM news n
            WHERE n.sub_editor_id = ?
              AND n.status = 'raw'
              AND TRIM(COALESCE(n.headline, '')) != ''
              AND TRIM(COALESCE(n.body, '')) != ''
        `, [target.id])?.c || 0;
    }
    return queryGet(`
        SELECT COUNT(*) as c
        FROM news n
        WHERE n.reporter_id = ?
          AND n.status = 'raw'
          AND TRIM(COALESCE(n.headline, '')) != ''
          AND TRIM(COALESCE(n.body, '')) != ''
          AND NOT (n.sub_editor_id IS NOT NULL AND n.sub_editor_status = 'forwarded')
    `, [target.id])?.c || 0;
}

function countApiTargetRecentRawNews(target) {
    if (target.role === 'sub_editor') {
        return queryGet(`
            SELECT COUNT(*) as c
            FROM news n
            WHERE n.sub_editor_id = ?
              AND n.status = 'raw'
              AND ${recentNewsSql('n.created_at')}
              AND TRIM(COALESCE(n.headline, '')) != ''
              AND TRIM(COALESCE(n.body, '')) != ''
        `, [target.id])?.c || 0;
    }
    return queryGet(`
        SELECT COUNT(*) as c
        FROM news n
        WHERE n.reporter_id = ?
          AND n.status = 'raw'
          AND ${recentNewsSql('n.created_at')}
          AND TRIM(COALESCE(n.headline, '')) != ''
          AND TRIM(COALESCE(n.body, '')) != ''
          AND NOT (n.sub_editor_id IS NOT NULL AND n.sub_editor_status = 'forwarded')
    `, [target.id])?.c || 0;
}

function countApiTargetRecentAiNews(target) {
    const baseWhere = `
          AND n.status = 'processed'
          AND ${recentNewsSql('COALESCE(n.processed_at, n.created_at)')}
          AND n.headline_rewritten IS NOT NULL
          AND TRIM(n.headline_rewritten) != ''
          AND n.body_rewritten IS NOT NULL
          AND TRIM(n.body_rewritten) != ''
    `;
    if (target.role === 'sub_editor') {
        return queryGet(`
            SELECT COUNT(*) as c
            FROM news n
            WHERE n.sub_editor_id = ?
              AND n.sub_editor_status = 'forwarded'
              ${baseWhere}
        `, [target.id])?.c || 0;
    }
    return queryGet(`
        SELECT COUNT(*) as c
        FROM news n
        WHERE n.reporter_id = ?
          ${baseWhere}
    `, [target.id])?.c || 0;
}

/**
 * Push notification to all active editors -- same channel/shape as a new
 * reporter submission ("नई खबर आई") -- confirming a bundle actually reached
 * PageMint. Fire-and-forget: never blocks or fails the background job.
 */
function notifyEditorsBundleSent({ targetUser, payload }) {
    const targetName = targetUser?.name_hi || targetUser?.full_name || 'PageMint';
    const sentAt = formatHindiNotificationTime();
    sendPushToEditors({
        title: '📰 बंडल PageMint को भेजा गया',
        body: `${targetName} के लिए ${payload.count} खबरों का बंडल PageMint को भेज दिया गया।\nJob: ${payload.job_id}\nसमय: ${sentAt}`,
        url: '/#/editor',
        jobId: payload.job_id,
        bundleId: payload.bundle_id,
        tag: `pagemint-sent-${payload.job_id}`
    }).catch(err => console.error('Editor push notification (bundle sent) error:', err));
}


function runPageMintBundleJob({ targetUser, payload, newsIds, placeholders }) {
    setImmediate(async () => {
        let stage = 'rewrite';
        try {
            markPageMintBundleRewriting(payload.job_id);
            const rewriteResult = await rewriteAndCachePageMintBundle({ targetUser, payload });
            markPageMintBundleRewriteResult(payload.job_id, rewriteResult.payload, rewriteResult.result);

            stage = 'delivery';
            markPageMintBundleDeliverySending(payload.job_id);
            const delivery = await sendNewspaperBundle(rewriteResult.payload);
            markPageMintBundleDeliveryResult(payload.job_id, delivery);
            if (!delivery.delivered) {
                console.error('Newspaper generator background delivery skipped:', delivery.error || 'not delivered');
                return;
            }

            queryRun(
                `UPDATE news SET newspaper_sent_at = datetime('now', 'localtime') WHERE id IN (${placeholders})`,
                newsIds
            );

            notifyEditorsBundleSent({ targetUser, payload: rewriteResult.payload });

            console.log('Newspaper generator background bundle sent:', {
                job_id: rewriteResult.payload.job_id,
                bundle_id: rewriteResult.payload.bundle_id,
                article_count: rewriteResult.payload.count,
                rewritten: Boolean(rewriteResult.result?.rewritten)
            });
        } catch (err) {
            markPageMintBundleFailed(payload.job_id, stage, err);
            console.error('Newspaper generator background bundle error:', err);
        }
    });
}

const BULK_PDF_WINDOW_HOURS = 23;
const BULK_PDF_WAIT_TIMEOUT_MS = 60 * 60 * 1000;
const BULK_PDF_POLL_MS = 10000;
const bulkPdfQueues = new Map();
let activeBulkPdfQueueId = null;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function recentNewsSql(column) {
    return `datetime(${column}) >= datetime('now', 'localtime', '-${BULK_PDF_WINDOW_HOURS} hours')`;
}

function getApiTargetOrThrow(targetId) {
    const targetUser = queryGet(`${PAGE_MINT_TARGET_USER_SQL}`, [targetId]);
    if (!isValidPageMintApiTargetUser(targetUser)) {
        const err = new Error('Invalid PageMint API target user.');
        err.statusCode = 400;
        throw err;
    }
    return targetUser;
}

function fetchRecentRawRowsForTarget(targetUser) {
    const baseSelect = `
        SELECT n.*, ${PAGE_MINT_ARTICLE_REPORTER_SQL}
        FROM news n
        LEFT JOIN users u ON u.id = n.reporter_id
        WHERE n.status = 'raw'
          AND TRIM(COALESCE(n.headline, '')) != ''
          AND TRIM(COALESCE(n.body, '')) != ''
    `;
    if (targetUser.role === 'sub_editor') {
        return queryAll(`
            ${baseSelect}
              AND n.sub_editor_id = ?
            ORDER BY datetime(n.created_at) DESC, n.id DESC
        `, [targetUser.id]);
    }
    return queryAll(`
        ${baseSelect}
          AND n.reporter_id = ?
          AND NOT (n.sub_editor_id IS NOT NULL AND n.sub_editor_status = 'forwarded')
        ORDER BY datetime(n.created_at) DESC, n.id DESC
    `, [targetUser.id]);
}

function fetchRecentAiRowsForTarget(targetUser) {
    const baseSelect = `
        SELECT n.*, ${PAGE_MINT_ARTICLE_REPORTER_SQL}
        FROM news n
        LEFT JOIN users u ON u.id = n.reporter_id
        WHERE n.status = 'processed'
          AND n.headline_rewritten IS NOT NULL
          AND TRIM(n.headline_rewritten) != ''
          AND n.body_rewritten IS NOT NULL
          AND TRIM(n.body_rewritten) != ''
    `;
    if (targetUser.role === 'sub_editor') {
        return queryAll(`
            ${baseSelect}
              AND n.sub_editor_id = ?
              AND n.sub_editor_status = 'forwarded'
            ORDER BY datetime(COALESCE(n.processed_at, n.created_at)) DESC, n.id DESC
        `, [targetUser.id]);
    }
    return queryAll(`
        ${baseSelect}
          AND n.reporter_id = ?
        ORDER BY datetime(COALESCE(n.processed_at, n.created_at)) DESC, n.id DESC
    `, [targetUser.id]);
}

function getArticleSortTime(article) {
    const raw = article.processed_at || article.created_at || '';
    const parsed = Date.parse(String(raw).replace(' ', 'T'));
    return Number.isNaN(parsed) ? 0 : parsed;
}

async function startRecentMixedPageMintBundle({ targetUser, editorUserId, baseUrl }) {
    const rawRows = fetchRecentRawRowsForTarget(targetUser);
    const aiRows = fetchRecentAiRowsForTarget(targetUser);

    if (rawRows.length === 0 && aiRows.length === 0) {
        return {
            skipped: true,
            raw_count: 0,
            ai_count: 0,
            message: 'No RAW or AI rewritten news found for this target.'
        };
    }

    for (const article of rawRows) {
        if (article.body_rewritten && article.body_rewritten.trim()) continue;
        try {
            const rewritten = await rewriteAndSaveNews(article, {
                editorUserId,
                baseUrl
            });
            article.headline_rewritten = rewritten.headline_rewritten;
            article.body_rewritten = rewritten.body_rewritten;
            article.ai_provider = rewritten.ai_provider;
            article.status = 'processed';
            article.processed_at = article.processed_at || queryGet('SELECT datetime(\'now\', \'localtime\') as ts')?.ts || article.created_at;
        } catch (rewriteError) {
            console.error(`Bulk auto-rewrite failed for news ${article.id}, sending original raw content:`, rewriteError.message);
        }
    }

    let articles = [...rawRows, ...aiRows].sort((a, b) => {
        const timeDiff = getArticleSortTime(b) - getArticleSortTime(a);
        if (timeDiff !== 0) return timeDiff;
        return Number(b.id) - Number(a.id);
    });
    const seen = new Set();
    articles = articles.filter(article => {
        const key = String(article.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const newsIds = articles.map(article => article.id);
    const placeholders = newsIds.map(() => '?').join(',');
    const imageRows = queryAll(`
        SELECT news_id, id, image_path, is_selected, sort_order
        FROM news_images
        WHERE news_id IN (${placeholders})
        ORDER BY news_id ASC, sort_order ASC, id ASC
    `, newsIds);
    const imagesByNewsId = new Map();
    for (const image of imageRows) {
        if (!imagesByNewsId.has(image.news_id)) imagesByNewsId.set(image.news_id, []);
        imagesByNewsId.get(image.news_id).push(image);
    }

    const payload = buildNewspaperPayload({
        targetUser,
        articles,
        imagesByNewsId,
        baseUrl,
        leadNewsId: null
    });
    payload.meta = {
        ...(payload.meta || {}),
        source: 'NMS_BULK_RECENT_MIXED',
        selection: 'all_available',
        raw_count: rawRows.length,
        ai_count: aiRows.length
    };

    insertPageMintBundleRecord({ targetUser, newsIds, payload, leadNewsId: null });
    runPageMintBundleJob({ targetUser, payload, newsIds, placeholders });

    return {
        skipped: false,
        raw_count: rawRows.length,
        ai_count: aiRows.length,
        total_count: newsIds.length,
        job_id: payload.job_id,
        bundle_id: payload.bundle_id
    };
}

async function waitForPageMintPdf(jobId, startedAtMs) {
    while (Date.now() - startedAtMs < BULK_PDF_WAIT_TIMEOUT_MS) {
        const bundle = queryGet(
            `SELECT delivery_status, pdf_received_at, error_message
             FROM pagemint_bundles
             WHERE job_id = ?`,
            [jobId]
        );
        if (bundle?.pdf_received_at) return { received: true };
        if (bundle?.delivery_status === 'failed') {
            return { received: false, error: bundle.error_message || 'PageMint delivery failed.' };
        }
        await sleep(BULK_PDF_POLL_MS);
    }
    return { received: false, error: 'Timed out waiting for PageMint PDF.' };
}

function summarizeBulkQueue(queue) {
    const now = Date.now();
    const completedItems = queue.items.filter(item => ['received', 'skipped', 'failed'].includes(item.status)).length;
    return {
        id: queue.id,
        status: queue.status,
        total: queue.items.length,
        completed: completedItems,
        current_index: queue.currentIndex,
        percent: queue.items.length ? Math.round((completedItems / queue.items.length) * 100) : 0,
        elapsed_seconds: Math.max(0, Math.floor((now - queue.startedAtMs) / 1000)),
        selection: 'all_available',
        items: queue.items,
        error: queue.error || null
    };
}

async function runBulkPdfQueue(queue, { editorUserId, baseUrl }) {
    queue.status = 'running';
    try {
        for (let index = 0; index < queue.items.length; index += 1) {
            const item = queue.items[index];
            queue.currentIndex = index;
            item.status = 'starting';
            item.started_at = new Date().toISOString();

            try {
                const targetUser = getApiTargetOrThrow(item.target_user_id);
                item.target_name = targetUser.full_name;
                const result = await startRecentMixedPageMintBundle({ targetUser, editorUserId, baseUrl });
                item.raw_count = result.raw_count || 0;
                item.ai_count = result.ai_count || 0;
                item.total_count = result.total_count || 0;

                if (result.skipped) {
                    item.status = 'skipped';
                    item.message = result.message;
                    item.finished_at = new Date().toISOString();
                    continue;
                }

                item.job_id = result.job_id;
                item.bundle_id = result.bundle_id;
                item.status = 'waiting_pdf';

                const waitResult = await waitForPageMintPdf(result.job_id, Date.now());
                item.finished_at = new Date().toISOString();
                if (waitResult.received) {
                    item.status = 'received';
                } else {
                    item.status = 'failed';
                    item.error = waitResult.error;
                }
            } catch (err) {
                item.status = 'failed';
                item.error = err.message || String(err);
                item.finished_at = new Date().toISOString();
            }
        }
        queue.status = 'completed';
    } catch (err) {
        queue.status = 'failed';
        queue.error = err.message || String(err);
    } finally {
        queue.finishedAtMs = Date.now();
        if (activeBulkPdfQueueId === queue.id) activeBulkPdfQueueId = null;
    }
}

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

router.get('/sub-editors', (req, res) => {
    try {
        const subEditors = queryAll(`
            SELECT id, full_name, name_hi, name_en, post, district, city
            FROM users
            WHERE role = 'sub_editor' AND status = 'active'
            ORDER BY COALESCE(name_hi, full_name) ASC
        `);
        res.json({ subEditors });
    } catch (err) {
        console.error('Editor get sub-editors error:', err);
        res.status(500).json({ error: 'Failed to fetch sub-editors.' });
    }
});

/**
 * GET /api/editor/news/raw
 */
router.get('/news/raw', (req, res) => {
    try {
        const params = [];
        const visibleClause = editorVisibleClause(req.query.sub_editor_id, params);
        // This is the raw-submission history. Keep processed entries in this
        // response so they remain visible (greyed out) after approval.
        const news = queryAll(`
            SELECT n.id, n.headline, SUBSTR(n.body, 1, 200) as body, n.status,
                   n.category, n.city, n.image_path, n.selected_image_path, n.created_at,
                   n.headline_rewritten, n.body_rewritten,
                   u.full_name as reporter_name,
                   ${subEditorSelectFields()}
            FROM news n
            JOIN users u ON n.reporter_id = u.id
            LEFT JOIN users se ON se.id = n.sub_editor_id
            WHERE n.status IN ('raw', 'processed')
              ${visibleClause}
            ORDER BY n.created_at DESC
        `, params);

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
        const params = [];
        const visibleClause = editorVisibleClause(req.query.sub_editor_id, params);
        const news = queryAll(`
            SELECT n.id, n.headline, n.headline_rewritten,
                   SUBSTR(COALESCE(n.body_rewritten, n.body), 1, 200) as body_rewritten,
                   n.category, n.city, n.image_path, n.selected_image_path, n.ai_provider,
                   n.processed_at, n.newspaper_sent_at, u.full_name as reporter_name,
                   ${subEditorSelectFields()}
            FROM news n
            JOIN users u ON n.reporter_id = u.id
            LEFT JOIN users se ON se.id = n.sub_editor_id
            WHERE n.status = 'processed'
              AND n.editor_processed_hidden_at IS NULL
              ${visibleClause}
            ORDER BY n.processed_at DESC
        `, params);

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
                   u.full_name as reporter_name,
                   ${subEditorSelectFields()}
            FROM news n
            JOIN users u ON n.reporter_id = u.id
            LEFT JOIN users se ON se.id = n.sub_editor_id
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

router.get('/api-targets', (req, res) => {
    try {
        const targets = queryAll(`
            SELECT id, full_name, name_hi, name_en, post, district, city, role, avatar_path, print_designation
            FROM users
            WHERE (role = 'sub_editor' OR (role = 'reporter' AND is_api_enabled = 1))
              AND status = 'active'
            ORDER BY role DESC, COALESCE(name_hi, full_name) ASC
        `);
        const targetsWithCounts = targets.map(target => {
            const params = [target.id];
            const where = target.role === 'sub_editor'
                ? "n.sub_editor_id = ? AND n.sub_editor_status = 'forwarded'"
                : 'n.reporter_id = ?';
            const count = queryGet(`
                SELECT COUNT(*) as c
                FROM news n
                WHERE ${where}
                  AND n.status = 'processed'
                  AND n.headline_rewritten IS NOT NULL
                  AND TRIM(n.headline_rewritten) != ''
                  AND n.body_rewritten IS NOT NULL
                  AND TRIM(n.body_rewritten) != ''
            `, params)?.c || 0;
            const rawCount = countApiTargetRawNews(target);
            const recentRawCount = countApiTargetRecentRawNews(target);
            const recentAiCount = countApiTargetRecentAiNews(target);
            const pdfCount = queryGet('SELECT COUNT(*) as c FROM api_pdfs WHERE target_user_id = ?', [target.id])?.c || 0;
            return {
                ...target,
                processed_rewritten_count: count,
                raw_news_count: rawCount,
                recent_raw_news_count: recentRawCount,
                recent_processed_rewritten_count: recentAiCount,
                bulk_window_hours: BULK_PDF_WINDOW_HOURS,
                pdf_count: pdfCount
            };
        });
        res.json({ targets: targetsWithCounts });
    } catch (err) {
        console.error('Editor get api targets error:', err);
        res.status(500).json({ error: 'Failed to fetch API targets.' });
    }
});

router.get('/api-targets/:id/news', (req, res) => {
    try {
        const targetId = Number(req.params.id);
        const target = queryGet("SELECT id, role FROM users WHERE id = ? AND status = 'active'", [targetId]);
        
        if (!target) return res.status(404).json({ error: 'Target not found.' });
        target.id = target.id ?? targetId;

        let query = '';
        let params = [];
        const orderDirection = req.query.sort === 'oldest' ? 'ASC' : 'DESC';
        const orderBy = `ORDER BY datetime(COALESCE(n.processed_at, n.created_at)) ${orderDirection}, n.id ${orderDirection}`;

        if (target.role === 'sub_editor') {
            query = `
                SELECT n.*, u.full_name as reporter_name
                FROM news n
                JOIN users u ON u.id = n.reporter_id
                WHERE n.sub_editor_id = ?
                  AND n.sub_editor_status = 'forwarded'
                  AND n.status = 'processed'
                  AND n.headline_rewritten IS NOT NULL
                  AND TRIM(n.headline_rewritten) != ''
                  AND n.body_rewritten IS NOT NULL
                  AND TRIM(n.body_rewritten) != ''
                ${orderBy}
            `;
            params = [targetId];
        } else if (target.role === 'reporter') {
            query = `
                SELECT n.*, u.full_name as reporter_name
                FROM news n
                JOIN users u ON u.id = n.reporter_id
                WHERE n.reporter_id = ?
                  AND n.status = 'processed'
                  AND n.headline_rewritten IS NOT NULL
                  AND TRIM(n.headline_rewritten) != ''
                  AND n.body_rewritten IS NOT NULL
                  AND TRIM(n.body_rewritten) != ''
                ${orderBy}
            `;
            params = [targetId];
        }

        const news = queryAll(query, params);
        const rawNews = queryApiTargetRawNews(target, orderDirection);
        res.json({ news, raw_news: rawNews });
    } catch(err) {
        console.error('Editor get api target news error:', err);
        res.status(500).json({ error: 'Failed to fetch news.' });
    }
});

router.post('/newspaper-generator/bulk-recent', (req, res) => {
    try {
        if (activeBulkPdfQueueId) {
            const activeQueue = bulkPdfQueues.get(activeBulkPdfQueueId);
            if (activeQueue && activeQueue.status === 'running') {
                return res.status(409).json({
                    error: 'A bulk PDF queue is already running.',
                    queue: summarizeBulkQueue(activeQueue)
                });
            }
            activeBulkPdfQueueId = null;
        }

        const targetIds = Array.isArray(req.body.target_user_ids)
            ? req.body.target_user_ids.map(Number).filter(id => Number.isInteger(id) && id > 0)
            : [];
        const uniqueTargetIds = [...new Set(targetIds)];
        if (uniqueTargetIds.length < 1) {
            return res.status(400).json({ error: 'Select at least one API target.' });
        }

        const targets = uniqueTargetIds.map(id => getApiTargetOrThrow(id));
        const queue = {
            id: uuidv4(),
            status: 'queued',
            startedAtMs: Date.now(),
            currentIndex: 0,
            items: targets.map(target => ({
                target_user_id: target.id,
                target_name: target.full_name,
                role: target.role,
                status: 'queued',
                raw_count: null,
                ai_count: null,
                total_count: null,
                job_id: null,
                bundle_id: null,
                error: null
            }))
        };

        bulkPdfQueues.set(queue.id, queue);
        activeBulkPdfQueueId = queue.id;
        runBulkPdfQueue(queue, {
            editorUserId: req.user.id,
            baseUrl: getBaseUrl(req)
        });

        res.json({ success: true, queue: summarizeBulkQueue(queue) });
    } catch (err) {
        console.error('Bulk recent PDF queue start error:', err);
        res.status(err.statusCode || 500).json({ error: err.message || 'Failed to start bulk PDF queue.' });
    }
});

router.get('/newspaper-generator/bulk-recent/:id', (req, res) => {
    const queue = bulkPdfQueues.get(req.params.id);
    if (!queue) return res.status(404).json({ error: 'Bulk PDF queue not found.' });
    res.json({ queue: summarizeBulkQueue(queue) });
});

router.get('/api-targets/:id/pdfs', (req, res) => {
    try {
        const targetId = Number(req.params.id);
        if (!Number.isInteger(targetId) || targetId <= 0) {
            return res.status(400).json({ error: 'Invalid target id.' });
        }

        const target = queryGet(`
            SELECT id, role, is_api_enabled
            FROM users
            WHERE id = ? AND status = 'active'
              AND (role = 'sub_editor' OR (role = 'reporter' AND is_api_enabled = 1))
        `, [targetId]);
        if (!target) return res.status(404).json({ error: 'PDF target not found.' });

        // Rejected PDFs are deleted immediately on reject (see /api-pdfs/:id/reject),
        // so they never reach this query. Pending stays visible regardless of age --
        // the editor still needs to act on it -- but approved rolls off after 24h so
        // this list doesn't keep growing with PDFs already delivered days ago.
        const pdfs = queryAll(
            `SELECT id, pdf_url, filename, job_id, bundle_id, edition_id, status, created_at FROM api_pdfs
             WHERE target_user_id = ?
               AND (status = 'pending' OR (status = 'approved' AND datetime(created_at) >= datetime('now', 'localtime', '-24 hours')))
             ORDER BY created_at DESC`,
            [targetId]
        );

        res.json({ pdfs });
    } catch (err) {
        console.error('Editor get target PDFs error:', err);
        res.status(500).json({ error: 'Failed to fetch PDFs.' });
    }
});

/**
 * POST /api/editor/api-pdfs/:id/approve
 * Unlocks a PageMint-delivered PDF for its reporter/sub-editor -- until this,
 * they only see it in a pending/locked state (see GET /webhook/my-pdfs).
 */
router.post('/api-pdfs/:id/approve', (req, res) => {
    try {
        const pdf = queryGet('SELECT id, status FROM api_pdfs WHERE id = ?', [req.params.id]);
        if (!pdf) return res.status(404).json({ error: 'PDF not found.' });

        queryRun(
            `UPDATE api_pdfs SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now', 'localtime') WHERE id = ?`,
            [req.user.id, pdf.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Editor approve PDF error:', err);
        res.status(500).json({ error: 'Failed to approve PDF.' });
    }
});

/**
 * POST /api/editor/api-pdfs/:id/reject
 * Deletes the underlying PDF file and the api_pdfs row immediately -- a
 * rejected PDF is never needed again, by anyone, so there is nothing to
 * retain it for. Reporter/sub-editor and editor PDF lists only ever query
 * for pending/approved, so this also means rejects never need a separate
 * filter to keep them out of those views.
 */
router.post('/api-pdfs/:id/reject', (req, res) => {
    try {
        const pdf = queryGet('SELECT id, pdf_url, status FROM api_pdfs WHERE id = ?', [req.params.id]);
        if (!pdf) return res.status(404).json({ error: 'PDF not found.' });

        if (pdf.pdf_url && pdf.pdf_url.startsWith('/uploads/pdfs/')) {
            const target = path.resolve(pdfsDir, path.basename(pdf.pdf_url));
            if (target.startsWith(pdfsDir + path.sep) && fs.existsSync(target)) {
                fs.unlinkSync(target);
            }
        }

        queryRun('DELETE FROM api_pdfs WHERE id = ?', [pdf.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Editor reject PDF error:', err);
        res.status(500).json({ error: 'Failed to reject PDF.' });
    }
});

/**
 * POST /api/editor/newspaper-generator/raw-bundle
 * Sends raw headline/body + images to PageMint for the reporter or sub-editor tied to the story.
 * Does not run AI rewrite and does not change news status.
 */
router.post('/newspaper-generator/raw-bundle', async (req, res) => {
    try {
        let newsIds = Array.isArray(req.body.news_ids)
            ? req.body.news_ids.map(Number).filter(Number.isInteger)
            : [Number(req.body.news_id)].filter(Number.isInteger);
        if (newsIds.length < 1) {
            return res.status(400).json({ error: 'news_id is required.' });
        }

        // Optional: editor marked one selected story as the lead/hero news.
        // Reorder so it is sent first -- bundle order is what PageMint uses
        // to fill the front page's lead box (see reorderWithLeadFirst above).
        const leadNewsIdRaw = Number(req.body.lead_news_id);
        const leadNewsId = Number.isInteger(leadNewsIdRaw) && leadNewsIdRaw > 0 ? leadNewsIdRaw : null;
        newsIds = reorderWithLeadFirst(newsIds, leadNewsId);

        const newsRows = newsIds.map(id => queryGet('SELECT * FROM news WHERE id = ?', [id]));
        if (newsRows.some(row => !row || row.status !== 'raw')) {
            return res.status(400).json({ error: 'Only raw news can be sent with this action.' });
        }

        const explicitTargetId = Number(req.body.target_user_id);
        let targetUser = null;
        if (Number.isInteger(explicitTargetId) && explicitTargetId > 0) {
            targetUser = queryGet(`${PAGE_MINT_TARGET_USER_SQL}`, [explicitTargetId]);
            if (!isValidPageMintApiTargetUser(targetUser)) {
                return res.status(400).json({ error: 'Invalid PageMint API target user.' });
            }
        } else {
            targetUser = resolveRawNewsPageMintTarget(newsRows[0]);
            if (!targetUser) {
                return res.status(400).json({
                    error: 'No PageMint API target for this story. Enable API on the reporter or assign a sub-editor.'
                });
            }
            const mismatchedTarget = newsRows.some(row => {
                const rowTarget = resolveRawNewsPageMintTarget(row);
                return !rowTarget || rowTarget.id !== targetUser.id;
            });
            if (mismatchedTarget) {
                return res.status(400).json({ error: 'All selected raw news items must use the same PageMint API target.' });
            }
        }

        if (targetUser.role === 'reporter' && !targetUser.is_api_enabled) {
            return res.status(400).json({ error: 'Reporter is not API-enabled.' });
        }

        const articles = newsIds
            .map(id => fetchRawNewsRowForPageMintTarget(id, targetUser))
            .filter(Boolean);
        if (articles.length !== newsIds.length) {
            return res.status(400).json({ error: 'Some selected raw news items do not belong to the API target.' });
        }

        // Auto-rewrite each raw story via AI and persist it to the news row
        // (the same rewrite-and-save path the manual "AI rewrite" review
        // action uses) before handing it to PageMint -- PageMint should
        // never receive un-rewritten copy just because this was sent
        // through the quick "raw" send action. A rewrite failure on one
        // story falls back to sending that story's original raw content
        // rather than aborting the whole bundle.
        const baseUrl = getBaseUrl(req);
        for (const article of articles) {
            if (article.body_rewritten && article.body_rewritten.trim()) continue;
            try {
                const rewritten = await rewriteAndSaveNews(article, {
                    editorUserId: req.user.id,
                    baseUrl
                });
                article.headline_rewritten = rewritten.headline_rewritten;
                article.body_rewritten = rewritten.body_rewritten;
                article.ai_provider = rewritten.ai_provider;
                article.status = 'processed';
            } catch (rewriteError) {
                console.error(`Raw-bundle auto-rewrite failed for news ${article.id}, sending original raw content:`, rewriteError.message);
            }
        }

        const placeholders = newsIds.map(() => '?').join(',');
        const imageRows = queryAll(`
            SELECT news_id, id, image_path, is_selected, sort_order
            FROM news_images
            WHERE news_id IN (${placeholders})
            ORDER BY news_id ASC, sort_order ASC, id ASC
        `, newsIds);
        const imagesByNewsId = new Map();
        for (const image of imageRows) {
            if (!imagesByNewsId.has(image.news_id)) imagesByNewsId.set(image.news_id, []);
            imagesByNewsId.get(image.news_id).push(image);
        }

        const payload = buildNewspaperPayload({
            targetUser,
            articles,
            imagesByNewsId,
            baseUrl,
            leadNewsId
        });
        payload.meta = {
            ...(payload.meta || {}),
            rawDirect: false,
            source: 'NMS_RAW_AUTOREWRITE'
        };

        insertPageMintBundleRecord({ targetUser, newsIds, payload, leadNewsId });
        runPageMintBundleJob({ targetUser, payload, newsIds, placeholders });

        res.json({
            success: true,
            accepted: true,
            message: 'News bundle started. Each story was AI-rewritten and saved before being sent to PageMint.',
            job_id: payload.job_id,
            bundle_id: payload.bundle_id,
            target_user_id: targetUser.id,
            target_name: targetUser.full_name,
            lead_news_id: leadNewsId
        });
    } catch (err) {
        console.error('Raw newspaper generator bundle error:', err);
        res.status(500).json({ error: `Raw PageMint send failed: ${err.message}` });
    }
});

router.post('/newspaper-generator/bundle', async (req, res) => {
    try {
        const targetUserId = Number(req.body.target_user_id || req.body.sub_editor_id);
        let newsIds = Array.isArray(req.body.news_ids)
            ? req.body.news_ids.map(Number).filter(Number.isInteger)
            : [];

        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({ error: 'Target selection is required.' });
        }
        if (newsIds.length < 1) {
            return res.status(400).json({ error: 'Select at least 1 AI rewritten processed news item for the newspaper generator.' });
        }

        // Optional: editor marked one selected story as the lead/hero news.
        // Reorder so it is sent first -- bundle order is what PageMint uses
        // to fill the front page's lead box (see reorderWithLeadFirst above).
        const leadNewsIdRaw = Number(req.body.lead_news_id);
        const leadNewsId = Number.isInteger(leadNewsIdRaw) && leadNewsIdRaw > 0 ? leadNewsIdRaw : null;
        newsIds = reorderWithLeadFirst(newsIds, leadNewsId);

        const targetUser = queryGet(`
            SELECT id, full_name, name_hi, name_en, post, district, city, role, is_api_enabled, print_designation, print_place_name, avatar_path
            FROM users
            WHERE id = ? AND status = 'active'
        `, [targetUserId]);
        
        if (!targetUser) return res.status(404).json({ error: 'Target not found.' });
        if (targetUser.role === 'reporter' && !targetUser.is_api_enabled) {
            return res.status(400).json({ error: 'Reporter is not API-enabled.' });
        }

        const placeholders = newsIds.map(() => '?').join(',');
        
        let articles = [];
        if (targetUser.role === 'sub_editor') {
            articles = queryAll(`
              SELECT n.*, u.full_name as reporter_name, u.name_hi as reporter_name_hi, u.name_en as reporter_name_en,
                  u.post as reporter_designation, u.print_designation as reporter_print_designation,
                  u.print_place_name as reporter_print_place_name,
                  u.avatar_path as reporter_photo_url, u.city as reporter_city,
                  u.district as reporter_district
                FROM news n
              LEFT JOIN users u ON u.id = n.reporter_id
                WHERE n.id IN (${placeholders})
                  AND n.sub_editor_id = ?
                  AND n.sub_editor_status = 'forwarded'
                  AND n.status = 'processed'
                  AND n.headline_rewritten IS NOT NULL
                  AND TRIM(n.headline_rewritten) != ''
                  AND n.body_rewritten IS NOT NULL
                  AND TRIM(n.body_rewritten) != ''
            `, [...newsIds, targetUserId]);
        } else {
            articles = queryAll(`
              SELECT n.*, u.full_name as reporter_name, u.name_hi as reporter_name_hi, u.name_en as reporter_name_en,
                  u.post as reporter_designation, u.print_designation as reporter_print_designation,
                  u.print_place_name as reporter_print_place_name,
                  u.avatar_path as reporter_photo_url, u.city as reporter_city,
                  u.district as reporter_district
                FROM news n
              LEFT JOIN users u ON u.id = n.reporter_id
                WHERE n.id IN (${placeholders})
                  AND n.reporter_id = ?
                  AND n.status = 'processed'
                  AND n.headline_rewritten IS NOT NULL
                  AND TRIM(n.headline_rewritten) != ''
                  AND n.body_rewritten IS NOT NULL
                  AND TRIM(n.body_rewritten) != ''
            `, [...newsIds, targetUserId]);
        }

        if (articles.length !== newsIds.length) {
            return res.status(400).json({ error: 'Some selected news items are invalid or do not belong to the target.' });
        }

        const articleById = new Map(articles.map(article => [String(article.id), article]));
        articles = newsIds
            .map(id => articleById.get(String(id)))
            .filter(Boolean);

        const imageRows = queryAll(`
            SELECT news_id, id, image_path, is_selected, sort_order
            FROM news_images
            WHERE news_id IN (${placeholders})
            ORDER BY news_id ASC, sort_order ASC, id ASC
        `, newsIds);
        const imagesByNewsId = new Map();
        for (const image of imageRows) {
            if (!imagesByNewsId.has(image.news_id)) imagesByNewsId.set(image.news_id, []);
            imagesByNewsId.get(image.news_id).push(image);
        }

        const payload = buildNewspaperPayload({
            targetUser,
            articles,
            imagesByNewsId,
            baseUrl: getBaseUrl(req),
            leadNewsId
        });
        insertPageMintBundleRecord({ targetUser, newsIds, payload, leadNewsId });
        runPageMintBundleJob({ targetUser, payload, newsIds, placeholders });

        res.json({
            success: true,
            accepted: true,
            message: 'Bundle job started. You can close the browser; NMS will rewrite and send it to PageMint in the background.',
            job_id: payload.job_id,
            bundle_id: payload.bundle_id,
            payloadPreview: payload
        });
    } catch (err) {
        console.error('Newspaper generator bundle error:', err);
        res.status(500).json({ error: `Newspaper generator failed: ${err.message}` });
    }
});

/**
 * GET /api/editor/news/:id
 * IMPORTANT: This wildcard route must stay AFTER all named /news/* routes
 */
router.get('/news/:id', (req, res) => {
    try {
        const news = queryGet(`
            SELECT n.*, u.full_name as reporter_name,
                   ${subEditorSelectFields()}
            FROM news n
            JOIN users u ON n.reporter_id = u.id
            LEFT JOIN users se ON se.id = n.sub_editor_id
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
 * POST /api/editor/news/:id/images/upload
 * Append images to an existing article (max 10 total).
 */
router.post('/news/:id/images/upload', editorImageUpload.array('images', MAX_NEWS_IMAGES), (req, res) => {
    try {
        const newsId = req.params.id;
        const news = queryGet('SELECT id, status, image_path, selected_image_path FROM news WHERE id = ?', [newsId]);
        if (!news) {
            return res.status(404).json({ error: 'News not found.' });
        }
        if (!['raw', 'processed', 'forwarded'].includes(news.status)) {
            return res.status(400).json({ error: 'Images can only be added to raw, processed, or forwarded news.' });
        }

        const files = Array.isArray(req.files) ? req.files : [];
        if (files.length < 1) {
            return res.status(400).json({ error: 'Select at least one image to upload.' });
        }

        const existing = queryAll(
            'SELECT id, is_selected FROM news_images WHERE news_id = ? ORDER BY sort_order ASC, id ASC',
            [newsId]
        );
        if (existing.length + files.length > MAX_NEWS_IMAGES) {
            return res.status(400).json({
                error: `Maximum ${MAX_NEWS_IMAGES} photos per article. Currently ${existing.length}, tried to add ${files.length}.`
            });
        }

        const hadCover = existing.some(row => row.is_selected)
            || Boolean(news.selected_image_path || news.image_path);
        let firstNewPath = null;

        files.forEach((file, idx) => {
            const imagePath = `/uploads/${file.filename}`;
            if (!firstNewPath) firstNewPath = imagePath;
            const sortOrder = existing.length + idx;
            const isSelected = !hadCover && idx === 0 ? 1 : 0;
            queryRun(
                'INSERT INTO news_images (news_id, image_path, is_selected, sort_order) VALUES (?, ?, ?, ?)',
                [newsId, imagePath, isSelected, sortOrder]
            );
        });

        if (!hadCover && firstNewPath) {
            queryRun(
                'UPDATE news SET image_path = COALESCE(image_path, ?), selected_image_path = ? WHERE id = ?',
                [firstNewPath, firstNewPath, newsId]
            );
        }

        const images = queryAll(
            'SELECT id, image_path, is_selected, sort_order FROM news_images WHERE news_id = ? ORDER BY sort_order ASC, id ASC',
            [newsId]
        );
        const selected = images.find(img => img.is_selected) || images[0] || null;

        res.json({
            success: true,
            message: `${files.length} photo(s) added.`,
            images,
            selected_image_path: selected?.image_path || news.selected_image_path || news.image_path || null
        });
    } catch (err) {
        console.error('Editor upload images error:', err);
        res.status(err.statusCode || 500).json({ error: err.message || 'Failed to upload images.' });
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
 * POST /api/editor/news/:id/images/:imageId/crop
 * Replace an article image with an editor-cropped upload.
 */
router.post('/news/:id/images/:imageId/crop', editorImageUpload.single('image'), (req, res) => {
    try {
        const newsId = req.params.id;
        const imageId = Number(req.params.imageId);
        if (!Number.isInteger(imageId)) {
            return res.status(400).json({ error: 'Invalid image id.' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'Cropped image file is required.' });
        }

        const news = queryGet('SELECT id, status, image_path, selected_image_path FROM news WHERE id = ?', [newsId]);
        if (!news) return res.status(404).json({ error: 'News not found.' });
        if (!['raw', 'processed', 'forwarded'].includes(news.status)) {
            return res.status(400).json({ error: 'Images can only be cropped on raw, processed, or forwarded news.' });
        }

        const image = queryGet('SELECT id, image_path, is_selected FROM news_images WHERE id = ? AND news_id = ?', [imageId, newsId]);
        if (!image) return res.status(404).json({ error: 'Image not found for this article.' });

        const oldPath = image.image_path;
        const newPath = `/uploads/${req.file.filename}`;

        queryRun('UPDATE news_images SET image_path = ? WHERE id = ? AND news_id = ?', [newPath, imageId, newsId]);
        if (news.image_path === oldPath) {
            queryRun('UPDATE news SET image_path = ? WHERE id = ?', [newPath, newsId]);
        }
        if (news.selected_image_path === oldPath) {
            queryRun('UPDATE news SET selected_image_path = ? WHERE id = ?', [newPath, newsId]);
        }

        deleteUploadFileIfUnused(oldPath);

        const images = queryAll(
            'SELECT id, image_path, is_selected, sort_order FROM news_images WHERE news_id = ? ORDER BY sort_order ASC, id ASC',
            [newsId]
        );
        const selected = images.find(row => row.is_selected) || images[0] || null;

        res.json({
            success: true,
            message: 'Cropped image saved.',
            image_id: imageId,
            image_path: newPath,
            selected_image_path: selected?.image_path || news.selected_image_path || news.image_path || null,
            images
        });
    } catch (err) {
        console.error('Editor crop image error:', err);
        res.status(err.statusCode || 500).json({ error: err.message || 'Failed to save cropped image.' });
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
 * Runs the AI rewrite for one raw news item and persists the result to its
 * existing headline_rewritten/body_rewritten columns (moving it to
 * 'processed'). Shared by the manual /news/:id/rewrite review action and
 * the raw-bundle send path (which auto-rewrites before forwarding to
 * PageMint) so the two stay in sync instead of drifting into separate
 * copies of this logic.
 */
async function rewriteAndSaveNews(news, {
    provider = null,
    targetWords = 400,
    numSubheadings = 3,
    captionWords = 30,
    includeImageCaption = true,
    language = 'hi',
    editorUserId,
    baseUrl
}) {
    // Fetch reporter's profile for byline
    const reporter = queryGet(
        'SELECT full_name, name_hi, name_en, post, print_designation, print_place_name, city FROM users WHERE id = ?',
        [news.reporter_id]
    );

    // Choose name based on language (Hindi article → name_hi, English → name_en)
    const reporterName = language === 'hi'
        ? (reporter?.name_hi || reporter?.full_name || '')
        : (reporter?.name_en || reporter?.full_name || '');
    const reporterPost = reporter?.print_designation || reporter?.post || '';
    const city = news.city || reporter?.print_place_name || reporter?.city || '';

    const result = await rewriteArticle(news.headline, news.body, {
        provider,
        targetWords,
        numSubheadings,
        captionWords,
        includeImageCaption,
        language,
        reporterName,
        reporterPost,
        city
    });

    const usedProvider = provider || queryGet("SELECT value FROM settings WHERE key = 'ai_provider'")?.value || 'gemini';

    // Save rewritten content and move it to processed review.
    queryRun(
        "UPDATE news SET headline_rewritten = ?, body_rewritten = ?, ai_provider = ?, status = 'processed', editor_id = ?, processed_at = datetime('now', 'localtime') WHERE id = ?",
        [result.headline, result.body, usedProvider, editorUserId, news.id]
    );
    queuePageMintRewriteForNews(news.id, baseUrl);

    return { headline_rewritten: result.headline, body_rewritten: result.body, ai_provider: usedProvider };
}

/**
 * POST /api/editor/news/:id/rewrite
 * Fetches reporter's name_hi/name_en/post and city, passes them to AI rewriter
 */
router.post('/news/:id/rewrite', async (req, res) => {
    try {
        const news = queryGet('SELECT * FROM news WHERE id = ?', [req.params.id]);
        if (!news) {
            return res.status(404).json({ error: 'News not found.' });
        }
        if (!['raw', 'processing'].includes(news.status)) {
            return res.status(409).json({ error: 'News is already rewritten or no longer available for AI rewrite.' });
        }
        if (!isVisibleToMainEditor(news)) {
            return res.status(403).json({ error: 'This news is still pending with the sub-editor.' });
        }

        const {
            provider = null,
            targetWords = 400,
            numSubheadings = 3,
            captionWords = 30,
            includeImageCaption = true,
            language = 'hi'
        } = req.body;

        const result = await rewriteAndSaveNews(news, {
            provider,
            targetWords,
            numSubheadings,
            captionWords,
            includeImageCaption,
            language,
            editorUserId: req.user.id,
            baseUrl: getBaseUrl(req)
        });
        res.json({ id: news.id, ...result });
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
        if (!isVisibleToMainEditor(news)) {
            return res.status(403).json({ error: 'This news is still pending with the sub-editor.' });
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
        if (news.status === 'processed') {
            queuePageMintRewriteForNews(news.id, getBaseUrl(req));
        }

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
        if (!isVisibleToMainEditor(news)) {
            return res.status(403).json({ error: 'This news is still pending with the sub-editor.' });
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
        queuePageMintRewriteForNews(news.id, getBaseUrl(req));

        res.json({ message: 'News approved and processed.' });
    } catch (err) {
        console.error('Editor approve error:', err);
        res.status(500).json({ error: 'Failed to approve news.' });
    }
});

/**
 * POST /api/editor/news/:id/forward-operator
 * Forward processed news to operators without sending it to website APIs.
 */
router.post('/news/:id/forward-operator', (req, res) => {
    try {
        const news = queryGet('SELECT * FROM news WHERE id = ? AND status = ?', [req.params.id, 'processed']);
        if (!news) {
            return res.status(400).json({ error: 'News must be processed before forwarding.' });
        }

        queryRun(
            "UPDATE news SET status = 'forwarded', forwarded_at = datetime('now', 'localtime'), editor_processed_hidden_at = NULL WHERE id = ?",
            [news.id]
        );

        res.json({ success: true, message: 'खबर सिर्फ ऑपरेटर को भेज दी गई।' });
    } catch (err) {
        console.error('Editor operator-only forward error:', err);
        res.status(500).json({ error: 'Failed to forward news to operators.' });
    }
});

/**
 * POST /api/editor/news/:id/hide-processed
 * Hide from editor Processed list only; does not delete or change news status.
 */
router.post('/news/:id/hide-processed', (req, res) => {
    try {
        const news = queryGet("SELECT * FROM news WHERE id = ? AND status = 'processed'", [req.params.id]);
        if (!news) {
            return res.status(400).json({ error: 'Only processed news can be hidden from this list.' });
        }

        queryRun(
            "UPDATE news SET editor_processed_hidden_at = datetime('now', 'localtime') WHERE id = ?",
            [news.id]
        );

        res.json({ success: true, message: 'Processed सूची से हटा दिया गया (बाकी जगह वही रहेगा)।' });
    } catch (err) {
        console.error('Editor hide processed error:', err);
        res.status(500).json({ error: 'Failed to hide news from processed list.' });
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
 * POST /api/editor/news/:id/forward-website
 * Send processed news only to the external website API, without forwarding to operators.
 */
router.post('/news/:id/forward-website', async (req, res) => {
    try {
        const news = queryGet("SELECT * FROM news WHERE id = ? AND status IN ('processed','forwarded','published')", [req.params.id]);
        if (!news) {
            return res.status(400).json({ error: 'News must be processed before website forwarding.' });
        }

        const externalNews = queryGet(`
            SELECT n.*, u.full_name AS reporter_name, u.name_hi, u.name_en
            FROM news n JOIN users u ON u.id = n.reporter_id WHERE n.id = ?
        `, [news.id]);

        const externalDelivery = await deliverForwardedNews(externalNews);
        if (!externalDelivery.enabled) {
            return res.status(503).json({ error: 'Website posting API is not configured.' });
        }
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

        res.json({
            success: true,
            message: externalDelivery?.delivered ? 'News forwarded to website.' : 'Website forwarding skipped.',
            externalDelivery
        });
    } catch (err) {
        console.error('Editor website-only forward error:', err);
        res.status(500).json({ error: `Website forward failed: ${err.message}` });
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
        if (!isVisibleToMainEditor(news)) {
            return res.status(403).json({ error: 'This news is still pending with the sub-editor.' });
        }

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
