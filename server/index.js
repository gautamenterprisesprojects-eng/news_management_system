require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./db/init');
const { uploadsDir, avatarsDir, resolveUpload } = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/sw.js', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, '..', 'public', 'sw.js'));
});
app.get('/manifest.webmanifest', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, '..', 'public', 'manifest.webmanifest'));
});

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '30d' }));

// Serve uploaded images
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
fs.mkdirSync(avatarsDir, { recursive: true });
app.use('/uploads/avatars', express.static(avatarsDir));
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
const profileRoutes = require('./routes/profile');
const publicRoutes = require('./routes/public');
const externalNewsRoutes = require('./routes/externalNews');
const pushRoutes = require('./routes/push');

app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/editor', editorRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/reporter', reporterRoutes);
app.use('/api/transliterate', require('./routes/transliterate'));
app.use('/api/profile', profileRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/external-news', externalNewsRoutes);
app.use('/api/push', pushRoutes);

// Background cron job: every hour, delete news older than 48 hours
if (process.env.ENABLE_NEWS_CLEANUP === 'true') setInterval(() => {
    try {
        const { getDb, queryAll, queryRun } = require('./db/init');
        console.log('Running 48h data cleanup job...');
        // Find news older than 48 hours
        const oldNews = queryAll("SELECT id, image_path FROM news WHERE datetime(created_at) < datetime('now', 'localtime', '-48 hours')");
        for (const article of oldNews) {
            // Delete associated image file
            const imagePaths = new Set(queryAll('SELECT image_path FROM news_images WHERE news_id = ?', [article.id]).map(row => row.image_path));
            if (article.image_path) imagePaths.add(article.image_path);
            for (const imagePath of imagePaths) {
                const fullPath = resolveUpload(imagePath);
                if (fs.existsSync(fullPath)) {
                    try { fs.unlinkSync(fullPath); } catch (e) { console.error('Error deleting image:', e); }
                }
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
    } catch (e) {
        console.error('Error in cleanup job:', e);
    }
}, 60 * 60 * 1000); // 1 hour

// ============================================================
// SPA FALLBACK — serve index.html for all non-API routes
// ============================================================
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
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
