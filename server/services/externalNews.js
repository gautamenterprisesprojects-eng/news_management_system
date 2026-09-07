function detectLanguage(text) {
    return /[\u0900-\u097F]/.test(text || '') ? 'HINDI' : 'ENGLISH';
}

function getBaseUrl(req) {
    return (process.env.NMS_PUBLIC_BASE_URL || (req ? `${req.protocol}://${req.get('host')}` : `http://localhost:${process.env.PORT || 3000}`)).replace(/\/$/, '');
}

function toAbsoluteImageUrl(imagePath, baseUrl) {
    if (!imagePath) return null;
    if (/^https?:\/\//i.test(imagePath)) return imagePath;
    return `${baseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
}

function toExternalPayload(news, baseUrl) {
    const title = news.headline_rewritten || news.headline;
    const body = news.body_rewritten || news.body;
    const language = detectLanguage(`${title}\n${body}`);
    const reporterName = language === 'HINDI'
        ? (news.name_hi || news.reporter_name || news.name_en || '')
        : (news.name_en || news.reporter_name || news.name_hi || '');
    const imageUrl = toAbsoluteImageUrl(news.selected_image_path || news.image_path, baseUrl);

    return {
        externalId: `nms-${news.id}`,
        source: process.env.NMS_EXTERNAL_SOURCE || 'The Cliff News NMS',
        language,
        title,
        body,
        reporterName,
        place: news.city || '',
        category: news.category || 'National',
        image: imageUrl ? { url: imageUrl, caption: '', altText: title } : null,
        publishMode: 'QUEUE_FOR_REWRITE',
        flags: { isBreaking: false, isTopStory: false, isHeroArticle: false, sendNotification: false }
    };
}

function firstString(...values) {
    return values.find(value => typeof value === 'string' && value.trim())?.trim() || null;
}

function extractPostedLinks(data) {
    if (!data || typeof data !== 'object') {
        return { hindiUrl: null, englishUrl: null };
    }

    const article = data.article && typeof data.article === 'object' ? data.article : {};
    const urls = data.urls && typeof data.urls === 'object' ? data.urls : {};
    const links = data.links && typeof data.links === 'object' ? data.links : {};

    return {
        hindiUrl: firstString(
            data.hindiUrl, data.hindi_url, data.hindiArticleUrl, data.hindi_article_url,
            urls.hindi, urls.hi, links.hindi, links.hi,
            article.hindiUrl, article.hindi_url
        ),
        englishUrl: firstString(
            data.englishUrl, data.english_url, data.englishArticleUrl, data.english_article_url,
            data.enUrl, data.en_url,
            urls.english, urls.en, links.english, links.en,
            article.englishUrl, article.english_url
        )
    };
}

async function deliverForwardedNews(news) {
    const endpoint = process.env.EXTERNAL_NEWS_INGEST_URL;
    if (!endpoint) return { enabled: false, delivered: false };

    const headers = { 'Content-Type': 'application/json' };
    if (process.env.EXTERNAL_NEWS_INGEST_API_KEY) {
        headers.Authorization = `Bearer ${process.env.EXTERNAL_NEWS_INGEST_API_KEY}`;
    }
    const response = await fetch(endpoint, {
        method: 'POST', headers,
        body: JSON.stringify(toExternalPayload(news, getBaseUrl()))
    });
    if (!response.ok) throw new Error(`External API returned ${response.status}`);

    let responseBody = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        responseBody = await response.json();
    }

    return {
        enabled: true,
        delivered: true,
        status: response.status,
        postedLinks: extractPostedLinks(responseBody)
    };
}

module.exports = { getBaseUrl, toExternalPayload, deliverForwardedNews, extractPostedLinks };
