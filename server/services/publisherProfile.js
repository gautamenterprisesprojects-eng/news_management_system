const { queryGet, queryRun } = require('../db/init');
const { getBaseUrl } = require('./externalNews');

const PROFILE_SETTING_KEY = 'publisher_editorial_profile';
const PUBLISHER_ID_SETTING_KEY = 'publisher_id';

function getConfiguredPublisherId() {
    const fromDb = queryGet('SELECT value FROM settings WHERE key = ?', [PUBLISHER_ID_SETTING_KEY])?.value;
    if (fromDb && String(fromDb).trim()) return String(fromDb).trim();
    return process.env.NEWSPAPER_GENERATOR_PAGEMINT_USER_ID
        || process.env.PAGEMINT_PUBLISHER_ID
        || 'cliffdemo3';
}

function parseProfileJson(raw) {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function loadStoredPublisherProfile() {
    const row = queryGet('SELECT value FROM settings WHERE key = ?', [PROFILE_SETTING_KEY]);
    return parseProfileJson(row?.value);
}

function saveStoredPublisherProfile(profile) {
    const payload = JSON.stringify(profile || {});
    const existing = queryGet('SELECT key FROM settings WHERE key = ?', [PROFILE_SETTING_KEY]);
    if (existing) {
        queryRun('UPDATE settings SET value = ? WHERE key = ?', [payload, PROFILE_SETTING_KEY]);
    } else {
        queryRun('INSERT INTO settings (key, value) VALUES (?, ?)', [PROFILE_SETTING_KEY, payload]);
    }
}

function saveConfiguredPublisherId(publisherId) {
    const value = String(publisherId || '').trim();
    if (!value) return;
    const existing = queryGet('SELECT key FROM settings WHERE key = ?', [PUBLISHER_ID_SETTING_KEY]);
    if (existing) {
        queryRun('UPDATE settings SET value = ? WHERE key = ?', [value, PUBLISHER_ID_SETTING_KEY]);
    } else {
        queryRun('INSERT INTO settings (key, value) VALUES (?, ?)', [PUBLISHER_ID_SETTING_KEY, value]);
    }
}

function toAbsoluteAssetUrl(path, req) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const baseUrl = getBaseUrl(req);
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}

function pickAuthorField(author, keys) {
    for (const key of keys) {
        const value = author?.[key];
        if (value != null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }
    return '';
}

function normalizeEditorialAuthor(author, req) {
    const name = pickAuthorField(author, ['name']);
    const imagePath = pickAuthorField(author, ['image_url', 'imageUrl']);
    const location = pickAuthorField(author, ['location', 'place', 'city']);
    const designation = pickAuthorField(author, ['designation', 'title']) || 'ब्यूरो चीफ';
    const imageUrl = toAbsoluteAssetUrl(imagePath, req);

    return {
        name,
        image_url: imageUrl,
        imageUrl,
        location,
        place: location,
        city: location,
        designation,
        title: designation
    };
}

/**
 * Public shape for PageMint CliffFrontEditorRail8A (NMS bundle layout).
 */
function buildPublisherProfileResponse(publisherId, req) {
    const stored = loadStoredPublisherProfile();
    const city = pickAuthorField(stored, ['city']);

    const rawAuthors = Array.isArray(stored.editorial_authors) ? stored.editorial_authors : [];
    const editorial_authors = rawAuthors
        .map(author => normalizeEditorialAuthor(author, req))
        .filter(author => author.name || author.image_url);

    const response = {
        publisherId: String(publisherId),
        publisher_id: String(publisherId),
        layout: 'CliffFrontEditorRail8A',
        city
    };

    if (editorial_authors.length > 0) {
        response.editorial_authors = editorial_authors;
        return response;
    }

    const fallbackName = pickAuthorField(stored, ['editorial_author_name']);
    const fallbackImage = toAbsoluteAssetUrl(
        pickAuthorField(stored, ['editorial_author_image_url', 'editorial_author_imageUrl']),
        req
    );
    const fallbackDesignation = pickAuthorField(stored, ['editorial_author_designation']) || 'ब्यूरो चीफ';
    const fallbackPlace = city;

    response.editorial_authors = [];
    response.editorial_author_name = fallbackName;
    response.editorial_author_image_url = fallbackImage;
    response.editorial_author_designation = fallbackDesignation;
    if (fallbackPlace) response.city = fallbackPlace;

    return response;
}

function getAdminPublisherProfile() {
    const stored = loadStoredPublisherProfile();
    return {
        publisher_id: getConfiguredPublisherId(),
        city: stored.city || '',
        editorial_authors: Array.isArray(stored.editorial_authors) ? stored.editorial_authors : [],
        editorial_author_name: stored.editorial_author_name || '',
        editorial_author_image_url: stored.editorial_author_image_url || '',
        editorial_author_designation: stored.editorial_author_designation || ''
    };
}

function updateAdminPublisherProfile(body) {
    if (body.publisher_id) {
        saveConfiguredPublisherId(body.publisher_id);
    }

    const stored = loadStoredPublisherProfile();
    const next = {
        ...stored,
        city: body.city != null ? String(body.city).trim() : (stored.city || ''),
        editorial_authors: Array.isArray(body.editorial_authors)
            ? body.editorial_authors.map(author => {
                const row = author && typeof author === 'object' ? author : {};
                return {
                    name: pickAuthorField(row, ['name']),
                    image_url: pickAuthorField(row, ['image_url', 'imageUrl']),
                    location: pickAuthorField(row, ['location', 'place', 'city']),
                    designation: pickAuthorField(row, ['designation', 'title'])
                };
            })
            : (stored.editorial_authors || []),
        editorial_author_name: body.editorial_author_name != null
            ? String(body.editorial_author_name).trim()
            : (stored.editorial_author_name || ''),
        editorial_author_image_url: body.editorial_author_image_url != null
            ? String(body.editorial_author_image_url).trim()
            : (stored.editorial_author_image_url || ''),
        editorial_author_designation: body.editorial_author_designation != null
            ? String(body.editorial_author_designation).trim()
            : (stored.editorial_author_designation || '')
    };

    saveStoredPublisherProfile(next);
    return getAdminPublisherProfile();
}

module.exports = {
    PROFILE_SETTING_KEY,
    PUBLISHER_ID_SETTING_KEY,
    getConfiguredPublisherId,
    loadStoredPublisherProfile,
    saveStoredPublisherProfile,
    buildPublisherProfileResponse,
    getAdminPublisherProfile,
    updateAdminPublisherProfile,
    toAbsoluteAssetUrl
};
