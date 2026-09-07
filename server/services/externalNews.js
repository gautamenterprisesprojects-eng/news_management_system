function detectLanguage(text) {
    return /[\u0900-\u097F]/.test(text || '') ? 'HINDI' : 'ENGLISH';
}

const DEFAULT_CATEGORY_SLUGS = [
    'astrology',
    'business',
    'education',
    'entertainment',
    'health',
    'international',
    'lifestyle',
    'national',
    'regional',
    'science',
    'sports',
    'state',
    'technology'
];

const CATEGORY_ALIASES = {
    local: 'regional',
    city: 'regional',
    regionalnews: 'regional',
    region: 'regional',
    politics: 'national',
    political: 'national',
    india: 'national',
    country: 'national',
    world: 'international',
    global: 'international',
    foreign: 'international',
    tech: 'technology',
    medical: 'health',
    economy: 'business',
    finance: 'business',
    market: 'business',
    bollywood: 'entertainment',
    cinema: 'entertainment',
    culture: 'lifestyle',
    horoscope: 'astrology',
    educationnews: 'education'
};

let categorySlugs = new Set(DEFAULT_CATEGORY_SLUGS);
let categorySlugsFetchedAt = 0;

function getBaseUrl(req) {
    return (process.env.NMS_PUBLIC_BASE_URL || (req ? `${req.protocol}://${req.get('host')}` : `http://localhost:${process.env.PORT || 3000}`)).replace(/\/$/, '');
}

function toAbsoluteImageUrl(imagePath, baseUrl) {
    if (!imagePath) return null;
    if (/^https?:\/\//i.test(imagePath)) return imagePath;
    return `${baseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
}

function normalizeCategorySlug(category) {
    const normalized = String(category || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '')
        .trim();

    const slug = String(category || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (categorySlugs.has(slug)) return slug;
    if (categorySlugs.has(normalized)) return normalized;
    if (CATEGORY_ALIASES[normalized] && categorySlugs.has(CATEGORY_ALIASES[normalized])) {
        return CATEGORY_ALIASES[normalized];
    }

    return 'national';
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
        category: normalizeCategorySlug(news.category),
        image: imageUrl ? { url: imageUrl, caption: '', altText: title } : null,
        publishMode: 'QUEUE_FOR_REWRITE',
        flags: { isBreaking: false, isTopStory: false, isHeroArticle: false, sendNotification: false }
    };
}

function getCategoriesUrl(endpoint) {
    if (process.env.EXTERNAL_NEWS_CATEGORIES_URL) return process.env.EXTERNAL_NEWS_CATEGORIES_URL;
    if (!endpoint) return null;

    try {
        const url = new URL(endpoint);
        return `${url.origin}/api/categories`;
    } catch {
        return null;
    }
}

async function refreshCategorySlugs(endpoint) {
    const categoriesUrl = getCategoriesUrl(endpoint);
    if (!categoriesUrl || Date.now() - categorySlugsFetchedAt < 10 * 60 * 1000) return;

    try {
        const response = await fetch(categoriesUrl);
        if (!response.ok) return;
        const data = await response.json();
        const categories = Array.isArray(data.categories) ? data.categories : [];
        const slugs = categories
            .filter(category => category && category.isActive !== false && typeof category.slug === 'string')
            .map(category => category.slug.trim().toLowerCase())
            .filter(Boolean);
        if (slugs.length) {
            categorySlugs = new Set(slugs);
            categorySlugsFetchedAt = Date.now();
        }
    } catch (err) {
        console.error('External categories fetch error:', err.message);
    }
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

    await refreshCategorySlugs(endpoint);

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

module.exports = { getBaseUrl, toExternalPayload, deliverForwardedNews, extractPostedLinks, normalizeCategorySlug };
