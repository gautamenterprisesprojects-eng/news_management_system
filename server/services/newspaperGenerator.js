const { getBaseUrl } = require('./externalNews');

function detectLanguage(text) {
    return /[\u0900-\u097F]/.test(text || '') ? 'hi' : 'en';
}

function toAbsoluteUrl(path, baseUrl) {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}

async function readResponse(response) {
    const text = await response.text();
    if (!text) return { text: '', json: null };
    try {
        return { text, json: JSON.parse(text) };
    } catch {
        return { text, json: null };
    }
}

function buildNewspaperPayload({ targetUser, articles, imagesByNewsId, baseUrl }) {
    const sentAt = new Date().toISOString();

    return {
        source: 'NMS THE CLIFF NEWS',
        sentAt,
        targetUser: {
            id: targetUser.id,
            role: targetUser.role,
            nameHi: targetUser.name_hi || targetUser.full_name || '',
            nameEn: targetUser.name_en || targetUser.full_name || '',
            fullName: targetUser.full_name || '',
            post: targetUser.print_designation || targetUser.post || '',
            district: targetUser.district || targetUser.city || '',
            place: targetUser.district || targetUser.city || '',
            avatarUrl: toAbsoluteUrl(targetUser.avatar_path, baseUrl)
        },
        pdfCallback: {
            url: `${baseUrl}/api/webhook/newspaper-pdf`,
            method: 'POST',
            targetUserId: targetUser.id,
            fileField: 'pdf',
            targetField: 'target_user_id',
            authHeader: process.env.NEWSPAPER_GENERATOR_WEBHOOK_KEY ? 'x-webhook-key' : null
        },
        count: articles.length,
        articles: articles.map(article => {
            const title = article.headline_rewritten || article.headline || '';
            const body = article.body_rewritten || article.body || '';
            const images = (imagesByNewsId.get(article.id) || []).map((image, idx) => ({
                id: image.id,
                order: idx + 1,
                sortOrder: image.sort_order || 0,
                isCover: Boolean(image.is_selected),
                url: toAbsoluteUrl(image.image_path, baseUrl),
                path: image.image_path
            }));
            const coverImage = images.find(image => image.isCover) || images[0] || null;

            return {
                newsId: article.id,
                language: detectLanguage(`${title}\n${body}`),
                headline: title,
                originalHeadline: article.headline || '',
                body,
                originalBody: article.body || '',
                reporter: {
                    id: article.reporter_id,
                    name: article.reporter_name || '',
                    nameHi: article.reporter_name_hi || article.reporter_name || '',
                    nameEn: article.reporter_name_en || article.reporter_name || ''
                },
                place: article.city || '',
                category: article.category || '',
                tags: article.tags || '',
                images,
                coverImage,
                websiteLinks: {
                    hindi: article.external_hindi_url || null,
                    english: article.external_english_url || null
                },
                createdAt: article.created_at,
                processedAt: article.processed_at,
                forwardedAt: article.forwarded_at
            };
        })
    };
}

async function sendNewspaperBundle(payload) {
    const endpoint = process.env.NEWSPAPER_GENERATOR_URL;
    if (!endpoint) {
        return { enabled: false, delivered: false, error: 'NEWSPAPER_GENERATOR_URL is not configured.' };
    }

    const headers = { 'Content-Type': 'application/json' };
    if (process.env.NEWSPAPER_GENERATOR_API_KEY) {
        headers.Authorization = `Bearer ${process.env.NEWSPAPER_GENERATOR_API_KEY}`;
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });
    const responseBody = await readResponse(response);

    if (!response.ok || responseBody.json?.success === false) {
        throw new Error(`Newspaper generator API returned ${response.status}`);
    }

    return {
        enabled: true,
        delivered: true,
        status: response.status,
        response: responseBody.json || responseBody.text
    };
}

module.exports = {
    buildNewspaperPayload,
    sendNewspaperBundle,
    getBaseUrl
};
