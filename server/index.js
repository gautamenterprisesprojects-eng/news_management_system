require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '30d' }));

// Serve uploaded images
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

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

app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/editor', editorRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/reporter', reporterRoutes);
app.use('/api/transliterate', require('./routes/transliterate'));
app.use('/api/profile', profileRoutes);
app.use('/api/public', publicRoutes);

// Background cron job: every hour, delete news older than 48 hours
setInterval(() => {
    try {
        const { getDb, queryAll, queryRun } = require('./db/init');
        console.log('Running 48h data cleanup job...');
        // Find news older than 48 hours
        const oldNews = queryAll("SELECT id, image_path FROM news WHERE datetime(created_at) < datetime('now', '-48 hours')");
        for (const article of oldNews) {
            // Delete associated image file
            if (article.image_path) {
                const fs = require('fs');
                const fullPath = path.join(__dirname, '..', 'public', article.image_path);
                if (fs.existsSync(fullPath)) {
                    try { fs.unlinkSync(fullPath); } catch (e) { console.error('Error deleting image:', e); }
                }
            }
            // Delete from database
            queryRun("DELETE FROM news WHERE id = ?", [article.id]);
            queryRun("DELETE FROM news_copies WHERE news_id = ?", [article.id]);
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
    }
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    res.status(500).json({ error: 'Internal server error.' });
});

// ============================================================
// START SERVER (after DB init)
// ============================================================
async function start() {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`🚀 News Management System running at http://localhost:${PORT}`);
            console.log(`   Default admin login: admin / admin123`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
