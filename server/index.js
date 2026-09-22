require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./db/init');
const { uploadsDir, avatarsDir, pdfsDir, resolveUpload } = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;

// The app only listens on 127.0.0.1 and is reached through the host's nginx
// reverse proxy, so it's safe to trust X-Forwarded-For for the real client IP
// (needed for accurate terms-of-service acceptance records, audit logs, etc).
app.set('trust proxy', true);

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

app.get('/sw.js', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, '..', 'public', 'sw.js'));
});
app.get('/manifest.webmanifest', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, '..', 'public', 'manifest.webmanifest'));
});

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '..', 'public'), {
    maxAge: '30d',
    setHeaders: (res, filePath) => {
        if (/\.html$/i.test(filePath)) {
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
        } else if (/\.(js|css)$/i.test(filePath)) {
            // Every production page references these assets with an explicit
            // version query. Cache them across document navigations; a bumped
            // version remains an immediate cache miss after a deployment.
            res.set('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

// Serve uploaded images
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
fs.mkdirSync(avatarsDir, { recursive: true });
fs.mkdirSync(pdfsDir, { recursive: true });

app.use('/uploads/avatars', express.static(avatarsDir));
// iOS Safari ignores the HTML `download` attribute for PDFs and opens its
// own Quick Look preview instead of downloading -- but it does respect a
// server-set Content-Disposition: attachment header. Only add it when the
// download button asks for it (?dl=1), so the plain "open in new tab"
// preview links elsewhere in the app keep opening inline as before.
app.use('/uploads/pdfs', (req, res, next) => {
    if (req.query.dl) {
        const rawName = typeof req.query.filename === 'string' ? req.query.filename : path.basename(req.path);
        const safeName = rawName.replace(/[^\w\s.\-()]/g, '').slice(0, 150) || 'newspaper.pdf';
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    }
    next();
}, express.static(pdfsDir));
app.use('/uploads', express.static(uploadsDir));
app.get('/api/health', (req, res) => {
    try {
        require('./db/init').queryGet('SELECT 1 AS ok');
        res.json({ status: 'ok' });
    } catch {
        res.status(503).json({ status: 'unavailable' });
    }
});

// ============================================================
// API ROUTES
// ============================================================
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const editorRoutes = require('./routes/editor');
const operatorRoutes = require('./routes/operator');
const reporterRoutes = require('./routes/reporter');
const subEditorRoutes = require('./routes/subEditor');
const advertisementRoutes = require('./routes/advertisement');
const profileRoutes = require('./routes/profile');
const publicRoutes = require('./routes/public');
const externalNewsRoutes = require('./routes/externalNews');
const pagemintBundleRoutes = require('./routes/pagemintBundles');
const pushRoutes = require('./routes/push');
const webhookRoutes = require('./routes/webhook');
const publisherRoutes = require('./routes/publisher');

app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/editor', editorRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/reporter', reporterRoutes);
app.use('/api/sub-editor', subEditorRoutes);
app.use('/api/advertisements', advertisementRoutes);
app.use('/api/transliterate', require('./routes/transliterate'));
app.use('/api/profile', profileRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/external-news', externalNewsRoutes);
app.use('/api/pagemint-bundles', pagemintBundleRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/publisher', publisherRoutes);

function deleteUploadedFile(fileUrl) {
    if (!fileUrl) return;
    try {
        let fullPath;
        if (fileUrl.startsWith('/uploads/pdfs/')) {
            const target = path.resolve(pdfsDir, path.basename(fileUrl));
            if (!target.startsWith(pdfsDir + path.sep)) throw new Error('Invalid PDF path');
            fullPath = target;
        } else {
            fullPath = resolveUpload(fileUrl);
        }

        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (e) {
        console.error('Error deleting uploaded file:', e.message);
    }
}

const CONTENT_RETENTION_HOURS = 48;
const API_PDF_RETENTION_HOURS = 28;
const PAGEMINT_BUNDLE_RETENTION_HOURS = 26;

const PAGEMINT_PDF_TIMEOUT_MINUTES = 10;

/**
 * PageMint acknowledges a bundle the instant it's queued for rendering, well
 * before the PDF actually exists -- NMS stamps delivery success (and
 * news.newspaper_sent_at) right then, with nothing watching for whether the
 * finished PDF ever actually comes back through the webhook. If PageMint's
 * render then fails or crashes, that failure was only ever visible in
 * PageMint's own container logs: the bundle just sits there forever looking
 * "delivered", and the source news items look "sent" even though no PDF was
 * ever produced for them.
 *
 * This closes that gap: any bundle that's been sitting in delivered-but-not-
 * received for more than PAGEMINT_PDF_TIMEOUT_MINUTES is treated as failed --
 * marked so, its news items' sent stamp is cleared so the editor can resend
 * them, and the editor is notified. PageMint's own headless render already
 * self-aborts well inside this window (NMS_HEADLESS_EXPORT_TIMEOUT_MS,
 * 3 minutes by default), so nothing is actually still running on its side by
 * the time this fires -- this is purely about NMS no longer waiting forever
 * for a delivery that isn't coming.
 */
function checkStalePageMintBundles() {
    try {
        const { queryAll, queryGet, queryRun } = require('./db/init');
        const { sendPushToEditors } = require('./services/pushNotifications');

        const staleBundles = queryAll(
            `SELECT id, job_id, bundle_id, target_user_id, news_ids_json
             FROM pagemint_bundles
             WHERE delivery_status = 'delivered'
               AND pdf_received_at IS NULL
               AND datetime(delivered_at) < datetime('now', 'localtime', ?)`,
            [`-${PAGEMINT_PDF_TIMEOUT_MINUTES} minutes`]
        );

        for (const bundle of staleBundles) {
            queryRun(
                `UPDATE pagemint_bundles SET delivery_status = 'failed', error_message = ? WHERE id = ?`,
                [`PDF not received within ${PAGEMINT_PDF_TIMEOUT_MINUTES} minutes of delivery -- treated as failed.`, bundle.id]
            );

            try {
                const newsIds = JSON.parse(bundle.news_ids_json || '[]').filter(Number.isInteger);
                if (newsIds.length > 0) {
                    const placeholders = newsIds.map(() => '?').join(',');
                    queryRun(`UPDATE news SET newspaper_sent_at = NULL WHERE id IN (${placeholders})`, newsIds);
                }
            } catch (e) {
                console.error('Failed to clear newspaper_sent_at for timed-out bundle:', e);
            }

            const targetUser = queryGet('SELECT name_hi, full_name FROM users WHERE id = ?', [bundle.target_user_id]);
            const targetName = targetUser?.name_hi || targetUser?.full_name || 'PageMint';
            sendPushToEditors({
                title: '⚠️ PDF जनरेशन असफल',
                body: `${targetName} का बंडल PageMint से ${PAGEMINT_PDF_TIMEOUT_MINUTES} मिनट में वापस नहीं आया और असफल मान लिया गया। कृपया दोबारा भेजें।\nJob: ${bundle.job_id}`,
                url: '/#/editor',
                jobId: bundle.job_id,
                bundleId: bundle.bundle_id,
                tag: `pagemint-timeout-${bundle.job_id}`
            }).catch(err => console.error('Editor push notification (bundle timeout) error:', err));

            console.log(`PageMint bundle timed out (no PDF within ${PAGEMINT_PDF_TIMEOUT_MINUTES}min):`, bundle.job_id);
        }
    } catch (e) {
        console.error('Error checking stale PageMint bundles:', e);
    }
}

setInterval(checkStalePageMintBundles, 60 * 1000); // every 1 minute

function cleanupOldPageMintBundles() {
    try {
        const { queryAll, queryRun } = require('./db/init');
        const oldBundles = queryAll("SELECT id FROM pagemint_bundles WHERE datetime(created_at) < datetime('now', 'localtime', ?)", [`-${PAGEMINT_BUNDLE_RETENTION_HOURS} hours`]);
        if (oldBundles.length > 0) {
            queryRun("DELETE FROM pagemint_bundles WHERE datetime(created_at) < datetime('now', 'localtime', ?)", [`-${PAGEMINT_BUNDLE_RETENTION_HOURS} hours`]);
            console.log(`Cleaned up ${oldBundles.length} old PageMint bundle records.`);
        }

        const oldArticles = queryAll("SELECT id FROM pagemint_rewritten_articles WHERE datetime(created_at) < datetime('now', 'localtime', ?)", [`-${PAGEMINT_BUNDLE_RETENTION_HOURS} hours`]);
        if (oldArticles.length > 0) {
            queryRun("DELETE FROM pagemint_rewritten_articles WHERE datetime(created_at) < datetime('now', 'localtime', ?)", [`-${PAGEMINT_BUNDLE_RETENTION_HOURS} hours`]);
            console.log(`Cleaned up ${oldArticles.length} old PageMint rewritten article records.`);
        }
    } catch (e) {
        console.error('Error cleaning PageMint bundle records:', e);
    }
}

// Background cron job: every hour, delete old NMS content and generated API PDFs.
if (process.env.ENABLE_NEWS_CLEANUP === 'true') setInterval(() => {
    try {
        const { getDb, queryAll, queryRun } = require('./db/init');
        console.log(`Running cleanup job: content>${CONTENT_RETENTION_HOURS}h, api_pdfs>${API_PDF_RETENTION_HOURS}h...`);
        // Find news older than 48 hours
        const oldNews = queryAll("SELECT id, image_path FROM news WHERE datetime(created_at) < datetime('now', 'localtime', ?)", [`-${CONTENT_RETENTION_HOURS} hours`]);
        for (const article of oldNews) {
            // Delete associated image file
            const imagePaths = new Set(queryAll('SELECT image_path FROM news_images WHERE news_id = ?', [article.id]).map(row => row.image_path));
            if (article.image_path) imagePaths.add(article.image_path);
            for (const imagePath of imagePaths) {
                deleteUploadedFile(imagePath);
            }
            // Delete from database
            getDb().transaction(() => {
                queryRun("DELETE FROM news_images WHERE news_id = ?", [article.id]);
                queryRun("DELETE FROM news_copies WHERE news_id = ?", [article.id]);
                queryRun("DELETE FROM news WHERE id = ?", [article.id]);
            })();
        }
        if (oldNews.length > 0) {
            console.log(`Cleaned up ${oldNews.length} old news records.`);
        }

        const oldPdfs = queryAll("SELECT id, pdf_url FROM api_pdfs WHERE datetime(created_at) < datetime('now', 'localtime', ?)", [`-${API_PDF_RETENTION_HOURS} hours`]);
        for (const pdf of oldPdfs) {
            deleteUploadedFile(pdf.pdf_url);
            queryRun('DELETE FROM api_pdfs WHERE id = ?', [pdf.id]);
        }
        if (oldPdfs.length > 0) {
            console.log(`Cleaned up ${oldPdfs.length} old PDF records.`);
        }

        const oldAds = queryAll("SELECT id, file_path FROM advertisements WHERE datetime(created_at) < datetime('now', 'localtime', ?)", [`-${CONTENT_RETENTION_HOURS} hours`]);
        for (const ad of oldAds) {
            deleteUploadedFile(ad.file_path);
            queryRun('DELETE FROM advertisements WHERE id = ?', [ad.id]);
        }
        if (oldAds.length > 0) {
            console.log(`Cleaned up ${oldAds.length} old advertisement records.`);
        }
    } catch (e) {
        console.error('Error in cleanup job:', e);
    }
}, 60 * 60 * 1000); // 1 hour

setInterval(cleanupOldPageMintBundles, 60 * 60 * 1000); // 1 hour

// ============================================================
// GATEWAY FALLBACK - legacy/unknown browser routes enter through index.html.
// ============================================================
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    } else {
        res.status(404).json({ error: 'Endpoint not found.' });
    }
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    if (err.statusCode) {
        if (err.statusCode >= 500) console.error('Unhandled error:', err);
        return res.status(err.statusCode).json({ error: err.message });
    }
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error.' });
});

// ============================================================
// START SERVER (after DB init)
// ============================================================
async function start() {
    try {
        await initDatabase();
        const server = app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
            console.log(`🚀 News Management System running at http://localhost:${server.address().port}`);
        });
        const shutdown = () => {
            server.close(() => {
                require('./db/init').getDb().close();
                process.exit(0);
            });
            setTimeout(() => process.exit(1), 10000).unref();
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
