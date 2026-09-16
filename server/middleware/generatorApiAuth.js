const crypto = require('crypto');

function getGeneratorApiKey() {
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

function isGeneratorApiAuthorized(req) {
    const configuredKey = getGeneratorApiKey();
    if (!configuredKey) return false;

    const authorization = req.headers.authorization || '';
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const direct = req.get('x-api-key') || '';
    return safeEqual(bearer, configuredKey) || safeEqual(direct, configuredKey);
}

function requireGeneratorApiAuth(req, res, next) {
    if (!getGeneratorApiKey()) {
        return res.status(503).json({ error: 'Generator API key is not configured on NMS.' });
    }
    if (!isGeneratorApiAuthorized(req)) {
        return res.status(401).json({ error: 'Invalid or missing Authorization Bearer token.' });
    }
    return next();
}

module.exports = {
    getGeneratorApiKey,
    isGeneratorApiAuthorized,
    requireGeneratorApiAuth
};
