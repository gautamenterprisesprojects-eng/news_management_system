const crypto = require('crypto');
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

/**
 * Generate a unique job ID for tracking this bundle through Page Maker.
 */
function generateJobId() {
    return `JOB-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

/**
 * Generate a unique bundle ID for this specific article bundle.
 */
function generateBundleId() {
    return `BUNDLE-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

/**
 * Generate an edition ID based on today's local date (EDITION-YYYY-MM-DD).
 */
function generateEditionId() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `EDITION-${yyyy}-${mm}-${dd}`;
}

function getPageMintTargetId() {
    return process.env.NEWSPAPER_GENERATOR_PAGEMINT_USER_ID || 'cliffdemo3';
}

function safeString(value) {
    return value == null ? '' : String(value).trim();
}

function toAbsoluteUrlOrNull(path, baseUrl) {
    const value = safeString(path);
    return value ? toAbsoluteUrl(value, baseUrl) : null;
}

function extractPageMintSubheadings(bodyRewritten) {
    const lines = safeString(bodyRewritten).split(/\r?\n/);
    const subheadings = [];
    const labelPattern = /^(?:सबहेडिंग|subheading)\s*\d+\s*:\s*(.*)$/i;
    const sectionPattern = /^(?:इमेज कैप्शन|हेडलाइन|image caption|headline)\s*:/i;

    for (let index = 0; index < lines.length; index += 1) {
        const labelMatch = lines[index].trim().match(labelPattern);
        if (!labelMatch) continue;

        const valueLines = [];
        if (labelMatch[1].trim()) valueLines.push(labelMatch[1].trim());
        for (let next = index + 1; next < lines.length; next += 1) {
            const line = lines[next].trim();
            if (labelPattern.test(line) || sectionPattern.test(line)) break;
            if (!line) break;
            valueLines.push(line);
        }

        const value = valueLines.join(' ').replace(/\s+/g, ' ').trim();
        if (value && !subheadings.includes(value)) subheadings.push(value);
    }

    return subheadings;
}

function extractPageMintLabeledValue(bodyRewritten, labelPattern) {
    const lines = safeString(bodyRewritten).split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
        const match = lines[index].trim().match(labelPattern);
        if (!match) continue;

        const valueLines = [];
        if (match[1].trim()) valueLines.push(match[1].trim());
        for (let next = index + 1; next < lines.length; next += 1) {
            const line = lines[next].trim();
            if (!line) break;
            valueLines.push(line);
        }

        return valueLines.join(' ').replace(/\s+/g, ' ').trim();
    }

    return '';
}

function getReporterValue(article, language, suffix) {
    const languageSuffix = language === 'hi' ? `${suffix}_hi` : `${suffix}_en`;
    return safeString(article[`reporter_${languageSuffix}`]) || safeString(article[`reporter_${suffix}`]);
}

function buildPageMintByline({ name, designation, place, language, photoUrl }) {
    const organization = language === 'hi' ? 'द क्लिफ न्यूज़' : 'The Cliff News';
    const values = [name];
    if (designation) values.push(designation);
    if (name || designation) {
        if (![name, designation].some(value => value.toLowerCase().includes(organization.toLowerCase()))) {
            values.push(organization);
        }
    }
    if (place) values.push(place);
    const text = values.filter(Boolean).join(', ').replace(`${designation}, ${organization}`, `${designation} ${organization}`);

    return {
        name: name || '',
        designation: designation || '',
        organization,
        place: place || '',
        photoUrl: photoUrl || null,
        text
    };
}

function buildPageMintArticle({ article, imagesByNewsId, baseUrl, bundleIndex }) {
    const title = safeString(article.headline_rewritten || article.headline);
    const formattedBody = article.body_rewritten == null ? safeString(article.body) : String(article.body_rewritten);
    const mainBody = safeString(article.body);
    const language = detectLanguage(`${title}\n${formattedBody}`);
    const subheadings = extractPageMintSubheadings(article.body_rewritten);
    const place = safeString(article.city || article.reporter_city || article.reporter_district);
    const reporterName = getReporterValue(article, language, 'name') || safeString(article.reporter_name);
    const reporterDesignation = safeString(article.reporter_print_designation || article.reporter_designation);
    const reporterPlace = safeString(article.reporter_city || article.reporter_district || place);
    const reporterPhotoUrl = toAbsoluteUrlOrNull(article.reporter_photo_url, baseUrl);
    const byline = buildPageMintByline({
        name: reporterName,
        designation: reporterDesignation,
        place: reporterPlace,
        language,
        photoUrl: reporterPhotoUrl
    });
    const images = (imagesByNewsId.get(article.id) || []).map((image, index) => ({
        id: image.id,
        order: index + 1,
        sortOrder: image.sort_order || 0,
        isCover: Boolean(image.is_selected),
        url: toAbsoluteUrlOrNull(image.image_path, baseUrl),
        path: image.image_path
    }));
    const coverImage = images.find(image => image.isCover) || images[0] || null;
    const imageUrl = coverImage?.url || null;
    const imageCaption = safeString(article.image_caption || article.imageCaption) || extractPageMintLabeledValue(
        article.body_rewritten,
        /^(?:इमेज कैप्शन|image caption)\s*:\s*(.*)$/i
    );
    const shortBody = safeString(article.shortBody || article.short_body);
    const mediumBody = safeString(article.mediumBody || article.medium_body);
    const longBody = safeString(article.longBody || article.long_body);
    const reporter = {
        id: article.reporter_id ?? null,
        name: reporterName,
        nameHi: safeString(article.reporter_name_hi || article.reporter_name),
        nameEn: safeString(article.reporter_name_en || article.reporter_name),
        designation: reporterDesignation,
        photoUrl: reporterPhotoUrl,
        place: reporterPlace,
        city: safeString(article.reporter_city),
        district: safeString(article.reporter_district)
    };
    const languageObject = {
        title,
        secondary_headline: subheadings[0] || '',
        category: safeString(article.category),
        short_250: shortBody,
        medium_500: mediumBody,
        long_1000: longBody,
        image_caption: imageCaption,
        image_url: imageUrl,
        place,
        subheadings: [...subheadings],
        reporter: { ...reporter },
        byline: byline.text
    };
    const emptyLanguageObject = {};
    const locationAliases = {
        place,
        place_name: place,
        location: place,
        location_name: place,
        city: place,
        city_name: place,
        dateline: place
    };

    return {
        newsId: article.id,
        id: article.id,
        bundleIndex,
        bundleOrder: bundleIndex + 1,
        language,
        category: safeString(article.category),
        headline: title,
        title,
        kicker: '',
        subheadings: [...subheadings],
        subheadline: subheadings[0] || '',
        body: formattedBody,
        pageMintBody: formattedBody,
        formattedBody,
        articleText: formattedBody,
        mainBody,
        rawBody: mainBody,
        shortBody,
        mediumBody,
        longBody,
        short_100: shortBody,
        medium_300: mediumBody,
        long_500: longBody,
        caption: imageCaption,
        imageCaption,
        image_caption: imageCaption,
        imageUrl,
        image_url: imageUrl,
        image_link: imageUrl,
        media: {
            image_url: imageUrl,
            image_link: imageUrl,
            image_caption: imageCaption
        },
        ...locationAliases,
        reporterName,
        reporterDesignation,
        reporterPhotoUrl,
        reporterPlace,
        reporter,
        bylineText: byline.text,
        byline,
        ui_hindi: language === 'hi' ? languageObject : emptyLanguageObject,
        ui_english: language === 'en' ? languageObject : emptyLanguageObject,
        article: {
            headline: title,
            secondary_headline: subheadings[0] || '',
            category: safeString(article.category),
            image_caption: imageCaption,
            image_url: imageUrl,
            place,
            subheadings: [...subheadings],
            body: formattedBody,
            reporter: { ...reporter },
            byline: byline.text
        },
        originalHeadline: safeString(article.headline),
        originalBody: mainBody,
        images,
        coverImage,
        websiteLinks: {
            hindi: article.external_hindi_url || null,
            english: article.external_english_url || null
        },
        sourceUrl: article.external_hindi_url || article.external_english_url || null,
        source_url: article.external_hindi_url || article.external_english_url || null,
        link: article.external_hindi_url || article.external_english_url || null,
        tags: safeString(article.tags),
        createdAt: article.created_at,
        processedAt: article.processed_at,
        forwardedAt: article.forwarded_at
    };
}

function buildNewspaperPayload({ targetUser, articles, imagesByNewsId, baseUrl }) {
    const sentAt = new Date().toISOString();

    // Unique identifiers so Page Maker can track and return the PDF
    // against the correct job, bundle, and edition.
    const jobId = generateJobId();
    const bundleId = generateBundleId();
    const editionId = generateEditionId();
    const pageMintTargetId = getPageMintTargetId();

    return {
        source: 'NMS',
        sentAt,

        // --- Tracking identifiers (required by Page Maker) ---
        job_id: jobId,
        bundle_id: bundleId,
        edition_id: editionId,
        target_user_id: targetUser.id,
        pagemint_user_id: pageMintTargetId,
        pagemint_target_id: pageMintTargetId,

        // --- Target user info for page layout/masthead ---
        targetUser: {
            id: targetUser.id,
            pagemintId: pageMintTargetId,
            externalId: pageMintTargetId,
            role: targetUser.role,
            nameHi: targetUser.name_hi || targetUser.full_name || '',
            nameEn: targetUser.name_en || targetUser.full_name || '',
            fullName: targetUser.full_name || '',
            post: targetUser.print_designation || targetUser.post || '',
            district: targetUser.district || targetUser.city || '',
            place: targetUser.district || targetUser.city || '',
            avatarUrl: toAbsoluteUrl(targetUser.avatar_path, baseUrl)
        },

        // --- Callback: Page Maker posts generated PDF back here ---
        callback: {
            url: `${baseUrl}/api/webhook/newspaper-pdf`,
            method: 'POST',
            targetUserId: targetUser.id,
            pagemintTargetId: pageMintTargetId,
            fileField: 'pdf',
            targetField: 'target_user_id',
            authHeader: process.env.NEWSPAPER_GENERATOR_WEBHOOK_KEY ? 'x-webhook-key' : null
        },

        // --- Legacy pdfCallback kept for backward-compatibility ---
        pdfCallback: {
            url: `${baseUrl}/api/webhook/newspaper-pdf`,
            method: 'POST',
            targetUserId: targetUser.id,
            pagemintTargetId: pageMintTargetId,
            fileField: 'pdf',
            targetField: 'target_user_id',
            authHeader: process.env.NEWSPAPER_GENERATOR_WEBHOOK_KEY ? 'x-webhook-key' : null
        },

        count: articles.length,
        articles: articles.map((article, index) => buildPageMintArticle({ article, imagesByNewsId, baseUrl, bundleIndex: index })),
        meta: {
            schemaVersion: 'nms-pagemint-v2',
            count: articles.length,
            articleIds: articles.map(article => article.id),
            mixedCategories: new Set(articles.map(article => safeString(article.category))).size > 1,
            mixedLanguages: new Set(articles.map(article => detectLanguage(`${article.headline_rewritten || article.headline || ''}\n${article.body_rewritten || article.body || ''}`))).size > 1
        }
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
    extractPageMintSubheadings,
    sendNewspaperBundle,
    getBaseUrl
};
