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
        if (/\.(html|js|css|webmanifest)$/i.test(filePath)) {
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
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
app.use('/uploads/pdfs', express.static(pdfsDir));
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
const pushRoutes = require('./routes/push');
const webhookRoutes = require('./routes/webhook');

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
app.use('/api/push', pushRoutes);
app.use('/api/webhook', webhookRoutes);

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
const API_PDF_RETENTION_HOURS = 30;

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

// ============================================================
// SPA FALLBACK — serve index.html for all non-API routes
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
