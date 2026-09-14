const ALLOWED_CATEGORIES = new Set([
    'National',
    'International',
    'Sports',
    'Business',
    'Madhya Pradesh',
    'Entertainment',
    'Health',
    'Dharma'
]);

const PROMPT_VERSION = 'hindi-only-v13-1000-1100-words';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_OPENAI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

let nextKeyIndex = 0;

function safeString(value) {
    return value == null ? '' : String(value).trim();
}

function unique(values) {
    return [...new Set(values.map(safeString).filter(Boolean))];
}

function getGeminiKeys() {
    return unique([
        ...(process.env.PAGEMINT_GEMINI_API_KEYS || '').split(','),
        ...(process.env.GEMINI_API_KEYS || '').split(','),
        process.env.PAGEMINT_GEMINI_API_KEY_1,
        process.env.PAGEMINT_GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.PAGEMINT_GEMINI_API_KEY,
        process.env.GEMINI_API_KEY
    ]);
}

function shouldRewritePageMintBundle() {
    return String(process.env.PAGEMINT_BUNDLE_AI_REWRITE_ENABLED || 'true').toLowerCase() !== 'false';
}

function wordCount(text) {
    return safeString(text).split(/\s+/).filter(Boolean).length;
}

function hasHindi(text) {
    return /[\u0900-\u097F]/.test(safeString(text));
}

function stripCodeFence(text) {
    const trimmed = safeString(text);
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    return match ? match[1].trim() : trimmed;
}

function parseJsonObject(text) {
    const candidate = stripCodeFence(text);
    try {
        return JSON.parse(candidate);
    } catch (_) {
        const start = candidate.indexOf('{');
        const end = candidate.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return JSON.parse(candidate.slice(start, end + 1));
        }
        throw new Error('Gemini returned invalid JSON.');
    }
}

function validateRewrite(parsed) {
    if (!parsed || typeof parsed !== 'object') throw new Error('Rewrite JSON is empty.');
    const classification = parsed.classification || {};
    const hindi = parsed.hindi || {};

    if (!ALLOWED_CATEGORIES.has(classification.category)) throw new Error('Rewrite category is invalid.');
    if (!safeString(classification.place_name)) throw new Error('Rewrite place_name is missing.');
    const confidence = Number(classification.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('Rewrite confidence is invalid.');
    if (!Array.isArray(classification.keywords)) throw new Error('Rewrite keywords are missing.');

    if (!hasHindi(hindi.heading)) throw new Error('Rewrite heading is missing Hindi text.');
    if (!hasHindi(hindi.secondary_heading)) throw new Error('Rewrite secondary heading is missing Hindi text.');
    if (!Array.isArray(hindi.subheadings) || hindi.subheadings.length !== 3 || hindi.subheadings.some(item => !hasHindi(item))) {
        throw new Error('Rewrite subheadings are invalid.');
    }
    if (!hasHindi(hindi.photo_caption)) throw new Error('Rewrite photo caption is missing Hindi text.');
    if (!hasHindi(hindi.body)) throw new Error('Rewrite body is missing Hindi text.');
    if (wordCount(hindi.body) < 1000) throw new Error('Rewrite body is under 1000 words.');

    const dateline = `${safeString(classification.place_name)}.`;
    if (!safeString(hindi.body).startsWith(dateline)) throw new Error('Rewrite body dateline does not match place_name.');
}

function escapeRegex(value) {
    return safeString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureMatchingDateline(parsed) {
    const place = safeString(parsed?.classification?.place_name);
    if (!place || !parsed?.hindi) return parsed;

    const body = safeString(parsed.hindi.body);
    const exactDateline = `${place}.`;
    if (body.startsWith(exactDateline)) return parsed;

    const placeDatelinePattern = new RegExp(`^\\s*${escapeRegex(place)}\\s*[।.:：-]+\\s*`);
    if (placeDatelinePattern.test(body)) {
        parsed.hindi.body = body.replace(placeDatelinePattern, `${exactDateline} `).trim();
        return parsed;
    }

    parsed.hindi.body = `${exactDateline} ${body}`.trim();
    return parsed;
}

function removeForbiddenFields(parsed) {
    delete parsed.image_url;
    delete parsed.image_prompt;
    delete parsed.link;
    delete parsed.source;
    if (parsed.hindi) {
        delete parsed.hindi.image_url;
        delete parsed.hindi.image_prompt;
        delete parsed.hindi.link;
        delete parsed.hindi.source;
    }
    if (parsed.classification) {
        delete parsed.classification.image_url;
        delete parsed.classification.image_prompt;
        delete parsed.classification.link;
        delete parsed.classification.source;
    }
    return parsed;
}

function sentenceTrim(text, maxWords) {
    const body = safeString(text);
    if (wordCount(body) <= maxWords) return body;

    const sentences = body.match(/[^।.!?]+[।.!?]+/g) || body.split(/(?<=\s)/);
    const selected = [];
    let total = 0;
    for (const sentence of sentences) {
        const count = wordCount(sentence);
        if (selected.length && total + count > maxWords) break;
        selected.push(sentence.trim());
        total += count;
        if (total >= maxWords * 0.9) break;
    }
    return selected.join(' ').trim() || body.split(/\s+/).slice(0, maxWords).join(' ');
}

function withCaption(text, caption) {
    const value = safeString(text);
    const cleanCaption = safeString(caption);
    return cleanCaption ? `${value}\n\nPhoto Caption: ${cleanCaption}` : value;
}

function buildSystemPrompt() {
    return `You are the GE News Hub Hindi rewrite desk.

Permanent editorial rules:
- Produce one complete Hindi news rewrite from supplied scraped news, in a single response.
- Return only valid JSON.
- Do not mention any publisher, publication, website, reporter, news agency, wire service or portal.
- Remove source publisher names from generated article text, headlines, captions, source labels and keywords.
- Do not invent names, numbers, dates, quotes, deaths, injuries, arrests, FIR details, court orders, government decisions, financial figures, police action, official reactions or ground-level scenes.
- Include official response, claims, allegations and ground reality only when supported by the supplied source.
- Use every verified detail and safe directly supported context needed to build the requested article length.
- Do not return image_url, image_prompt, link or source. The application sets them locally.

Handling a short source:
- A short source is not a reason to write a short article.
- Reach the required length by adding explanatory depth, never invented events.
- You may explain the subject, process, background, practical impact, and likely next procedural steps when implied by the source.
- Every concrete fact about this specific event must come from the supplied source.

Names and proper nouns:
- Carry over every proper noun the source gives.
- Write names in Devanagari as normally written in Indian Hindi newspapers and spell each name consistently.
- Keep every name attached to the correct role, place and action.
- Reproduce every number, date, amount, percentage and place exactly as given.

JSON schema:
{
  "classification": {
    "category": "National",
    "state": "Rashtriya",
    "place_name": "New Delhi",
    "confidence": 0.98,
    "reason": "One short English sentence explaining the category decision.",
    "keywords": ["Hindi keyword 1", "Hindi keyword 2", "Hindi keyword 3"]
  },
  "hindi": {
    "heading": "",
    "secondary_heading": "",
    "subheadings": ["", "", ""],
    "photo_caption": "",
    "body": ""
  }
}

Size and style rules:
- hindi.body is a hard minimum of 1000 Hindi words and should be about 1000 to 1100 words.
- Write body as one continuous, complete, publishable Hindi news article in a single field.
- Keep sentences complete and roughly 15 to 25 words.
- Exactly one main headline, one secondary headline, three subheadings, and one photo caption.
- Begin body with a dateline: classification.place_name followed by a period.
- classification.place_name must be the exact same place used as this dateline.

Category rules:
- category must be exactly one of: National, International, Sports, Business, Madhya Pradesh, Entertainment, Health, Dharma.
- Madhya Pradesh overrides Sports, Business and Entertainment.
- If outside Madhya Pradesh, classify by Sports, Business, Entertainment, Health, International, then National in that priority order.`;
}

function buildUserPrompt(article) {
    const title = safeString(article.originalHeadline || article.headline || article.title);
    const url = safeString(article.sourceUrl || article.source_url || article.link);
    const sourceText = safeString(article.originalBody || article.rawBody || article.mainBody || article.body || article.articleText);

    return `RAW ARTICLE DETAILS
Publisher category to ignore: ${safeString(article.category) || 'Uncategorized'}
Feed source: ${safeString(article.feed_source || article.feedSource) || 'NMS'}
Original title: ${title}
Original URL: ${url || 'Unknown'}
Source name: ${safeString(article.source_name || article.sourceName) || 'NMS'}
Extracted source word count: ${wordCount(sourceText)}

OUTPUT LENGTH REMINDER
- hindi.body must be at least 1000 Hindi words in a single field.
- Do not return only a short summary.

RAW ARTICLE TEXT
${sourceText.slice(0, 14000)}`;
}

function isKeyRetryable(status, bodyText) {
    const text = safeString(bodyText).toLowerCase();
    return status === 429 || status === 403 || text.includes('quota') || text.includes('resource_exhausted') || text.includes('rate limit');
}

async function callGemini(messages) {
    const keys = getGeminiKeys();
    if (!keys.length) {
        throw new Error('PageMint bundle AI rewrite is enabled, but no Gemini API key is configured.');
    }

    const model = process.env.PAGEMINT_GEMINI_MODEL || process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const attempts = keys.length;
    const errors = [];

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const keyIndex = (nextKeyIndex + attempt) % keys.length;
        const apiKey = keys[keyIndex];
        const response = await fetch(GEMINI_OPENAI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.35,
                max_tokens: 8192
            })
        });

        const responseText = await response.text();
        if (response.ok) {
            nextKeyIndex = (keyIndex + 1) % keys.length;
            const data = JSON.parse(responseText);
            const content = data.choices?.[0]?.message?.content;
            if (!content) throw new Error('Gemini returned an empty PageMint rewrite.');
            return content;
        }

        errors.push(`key ${keyIndex + 1}: ${response.status}`);
        if (!isKeyRetryable(response.status, responseText)) {
            throw new Error(`Gemini PageMint rewrite failed (${response.status}).`);
        }
    }

    nextKeyIndex = (nextKeyIndex + 1) % keys.length;
    throw new Error(`All Gemini keys failed for PageMint rewrite (${errors.join(', ')}).`);
}

async function requestRewrite(article) {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(article);
    const baseMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    let parsed;
    let firstResponse = '';
    try {
        firstResponse = await callGemini(baseMessages);
        parsed = parseJsonObject(firstResponse);
        if (!parsed.classification || !parsed.hindi) {
            throw new Error('Gemini JSON did not match the required PageMint rewrite schema.');
        }
    } catch (firstError) {
        parsed = parseJsonObject(await callGemini([
            ...baseMessages,
            {
                role: 'user',
                content: `The previous response was invalid JSON or did not match the required schema. Return exactly one valid JSON object using the required schema. Do not include explanations.\n\nPrevious response:\n${firstResponse || firstError.message}`
            }
        ]));
    }

    parsed = ensureMatchingDateline(removeForbiddenFields(parsed));
    if (!parsed.classification || !parsed.hindi) {
        throw new Error('Gemini PageMint rewrite did not include classification and hindi fields.');
    }
    if (wordCount(parsed?.hindi?.body) < 1000) {
        const repair = parseJsonObject(await callGemini([
            { role: 'system', content: `${systemPrompt}\nReturn only JSON: {"replace": {}, "append": {"hindi.body": "NEW CONTINUATION TEXT ONLY"}}. Append only new continuation words. Do not repeat existing sentences.` },
            { role: 'user', content: `${userPrompt}\n\nCURRENT BODY:\n${safeString(parsed?.hindi?.body)}` }
        ]));
        const continuation = safeString(repair?.append?.['hindi.body']);
        if (continuation) parsed.hindi.body = `${safeString(parsed.hindi.body)} ${continuation}`.trim();
    }

    parsed = ensureMatchingDateline(parsed);
    validateRewrite(parsed);
    return parsed;
}

function applyRewriteToArticle(article, parsed) {
    const rewritten = JSON.parse(JSON.stringify(article));
    const classification = parsed.classification;
    const hindi = parsed.hindi;
    const imageUrl = article.imageUrl || article.image_url || article.media?.image_url || null;
    const caption = safeString(hindi.photo_caption);
    const subheadings = hindi.subheadings.map(safeString);
    const shortBody = withCaption(sentenceTrim(hindi.body, 300), caption);
    const mediumBody = withCaption(sentenceTrim(hindi.body, 600), caption);
    const longBody = withCaption(sentenceTrim(hindi.body, 1000), caption);

    Object.assign(rewritten, {
        language: 'hi',
        category: classification.category,
        headline: hindi.heading,
        title: hindi.heading,
        subheadings,
        subheadline: hindi.secondary_heading,
        body: hindi.body,
        pageMintBody: hindi.body,
        formattedBody: hindi.body,
        articleText: hindi.body,
        shortBody,
        mediumBody,
        longBody,
        short_100: shortBody,
        medium_300: mediumBody,
        long_500: longBody,
        caption,
        imageCaption: caption,
        image_caption: caption,
        place: safeString(classification.place_name),
        place_name: safeString(classification.place_name),
        location: safeString(classification.place_name),
        location_name: safeString(classification.place_name),
        city: safeString(classification.place_name),
        city_name: safeString(classification.place_name),
        dateline: safeString(classification.place_name),
        rewrite: {
            prompt_version: PROMPT_VERSION,
            model_name: process.env.PAGEMINT_GEMINI_MODEL || process.env.GEMINI_MODEL || DEFAULT_MODEL,
            confidence: Number(classification.confidence),
            reason: safeString(classification.reason),
            keywords: classification.keywords.map(safeString).filter(Boolean)
        }
    });

    rewritten.media = {
        ...(article.media || {}),
        image_url: imageUrl,
        image_link: imageUrl,
        image_caption: caption
    };

    const languageObject = {
        title: hindi.heading,
        secondary_headline: hindi.secondary_heading,
        category: classification.category,
        short_250: shortBody,
        medium_500: mediumBody,
        long_1000: longBody,
        image_caption: caption,
        image_url: imageUrl,
        place: safeString(classification.place_name),
        subheadings,
        reporter: { ...(article.reporter || {}) },
        byline: article.bylineText || article.byline?.text || ''
    };

    rewritten.ui_hindi = languageObject;
    rewritten.ui_english = {};
    rewritten.article = {
        ...(article.article || {}),
        headline: hindi.heading,
        secondary_headline: hindi.secondary_heading,
        category: classification.category,
        image_caption: caption,
        image_url: imageUrl,
        place: safeString(classification.place_name),
        subheadings,
        body: hindi.body,
        reporter: { ...(article.reporter || article.article?.reporter || {}) },
        byline: article.bylineText || article.byline?.text || article.article?.byline || ''
    };

    return rewritten;
}

async function rewritePageMintBundle(payload) {
    if (!shouldRewritePageMintBundle()) {
        return { payload, result: { enabled: false, rewritten: false, reason: 'disabled' } };
    }

    const articles = Array.isArray(payload?.articles) ? payload.articles : [];
    if (!articles.length) {
        return { payload, result: { enabled: true, rewritten: false, reason: 'no articles' } };
    }

    const rewrittenArticles = [];
    for (const article of articles) {
        const parsed = await requestRewrite(article);
        rewrittenArticles.push(applyRewriteToArticle(article, parsed));
    }

    const rewrittenPayload = {
        ...payload,
        articles: rewrittenArticles,
        meta: {
            ...(payload.meta || {}),
            schemaVersion: 'nms-pagemint-v3-ai-rewritten',
            pageMintAiRewrite: {
                enabled: true,
                rewritten: true,
                promptVersion: PROMPT_VERSION,
                model: process.env.PAGEMINT_GEMINI_MODEL || process.env.GEMINI_MODEL || DEFAULT_MODEL,
                articleCount: rewrittenArticles.length,
                rewrittenAt: new Date().toISOString()
            }
        }
    };

    return {
        payload: rewrittenPayload,
        result: rewrittenPayload.meta.pageMintAiRewrite
    };
}

module.exports = {
    PROMPT_VERSION,
    buildSystemPrompt,
    buildUserPrompt,
    rewritePageMintBundle
};
