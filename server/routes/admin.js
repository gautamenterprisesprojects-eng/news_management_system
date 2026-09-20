const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { avatarsDir, uploadsDir, resolveUpload } = require('../storage');
const { removeBackgroundInPlace } = require('../services/backgroundRemoval');
const {
    getAdminPublisherProfile,
    updateAdminPublisherProfile
} = require('../services/publisherProfile');
const { queryAll, queryGet, queryRun } = require('../db/init');
const { verifyToken, requireRole } = require('../middleware/auth');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = avatarsDir;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const userId = req.params.id || 'new';
        cb(null, 'avatar-' + userId + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const editorialDir = path.join(uploadsDir, 'editorial');
const editorialStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(editorialDir)) fs.mkdirSync(editorialDir, { recursive: true });
        cb(null, editorialDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.png';
        cb(null, `editor-rail-${Date.now()}${ext}`);
    }
});
const editorialUpload = multer({
    storage: editorialStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Not an image! Please upload an image.'), false);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload an image.'), false);
        }
    }
});

// All admin routes require admin role
router.use(verifyToken, requireRole('admin'));

const USER_ROLES = ['reporter', 'editor', 'operator', 'sub_editor', 'ad_manager'];

function userSelectSql() {
    return `
        SELECT u.id, u.username, u.full_name, u.role, u.status, u.created_at,
               u.post, u.name_hi, u.name_en, u.city, u.district, u.assigned_sub_editor_id,
               u.is_api_enabled, u.print_designation, u.print_place_name, u.avatar_path,
               u.email, u.phone,
               se.full_name as assigned_sub_editor_name,
               se.name_hi as assigned_sub_editor_name_hi
        FROM users u
        LEFT JOIN users se ON se.id = u.assigned_sub_editor_id
    `;
}

router.get('/sub-editors', (req, res) => {
    try {
        const subEditors = queryAll(`
            SELECT id, full_name, name_hi, name_en, post, district, city
            FROM users
            WHERE role = 'sub_editor' AND status = 'active'
            ORDER BY COALESCE(name_hi, full_name) ASC
        `);
        res.json({ subEditors });
    } catch (err) {
        console.error('Admin get sub-editors error:', err);
        res.status(500).json({ error: 'Failed to fetch sub-editors.' });
    }
});

router.get('/editors', (req, res) => {
    try {
        const editors = queryAll(`
            SELECT id, full_name, name_hi, name_en, post, city
            FROM users
            WHERE role = 'editor' AND status = 'active'
            ORDER BY COALESCE(name_hi, full_name) ASC
        `);
        res.json({ editors });
    } catch (err) {
        console.error('Admin get editors error:', err);
        res.status(500).json({ error: 'Failed to fetch editors.' });
    }
});

router.get('/assignable-targets', (req, res) => {
    try {
        const targets = queryAll(`
            SELECT id, full_name, name_hi, name_en, post, city, district, role
            FROM users
            WHERE role IN ('editor', 'sub_editor') AND status = 'active'
            ORDER BY role ASC, COALESCE(name_hi, full_name) ASC
        `);
        res.json({ targets });
    } catch (err) {
        console.error('Admin get assignable targets error:', err);
        res.status(500).json({ error: 'Failed to fetch assignable targets.' });
    }
});

/**
 * GET /api/admin/users?role=reporter|editor|operator
 */
router.get('/users', (req, res) => {
    try {
        const { role } = req.query;
        let users;
        if (role) {
            users = queryAll(`${userSelectSql()} WHERE u.role = ? ORDER BY u.created_at DESC`, [role]);
        } else {
            users = queryAll(`${userSelectSql()} ORDER BY u.created_at DESC`);
        }
        res.json({ users });
    } catch (err) {
        console.error('Admin get users error:', err);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

/**
 * POST /api/admin/users
 */
router.post('/users', (req, res) => {
    try {
        const { username, password, full_name, role, post, name_hi, name_en, city, district, assigned_sub_editor_id } = req.body;

        if (!username || !password || !full_name || !role) {
            return res.status(400).json({ error: 'All fields are required: username, password, full_name, role.' });
        }

        if (!USER_ROLES.includes(role)) {
            return res.status(400).json({ error: 'Role must be reporter, editor, operator, sub_editor, or ad_manager.' });
        }

        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters.' });
        }

        if (password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters.' });
        }

        const existing = queryGet('SELECT id FROM users WHERE username = ?', [username]);
        if (existing) {
            return res.status(400).json({ error: 'Username already exists.' });
        }

        let assignedSubEditorId = assigned_sub_editor_id ? Number(assigned_sub_editor_id) : null;
        if (assignedSubEditorId) {
            const subEditor = queryGet("SELECT id FROM users WHERE id = ? AND role = 'sub_editor' AND status = 'active'", [assignedSubEditorId]);
            if (!subEditor) return res.status(400).json({ error: 'Assigned sub-editor not found.' });
        }
        if (!['reporter', 'operator'].includes(role)) assignedSubEditorId = null;

        let assignedEditorId = req.body.assigned_editor_id ? Number(req.body.assigned_editor_id) : null;
        if (assignedEditorId) {
            const editor = queryGet("SELECT id FROM users WHERE id = ? AND role = 'editor' AND status = 'active'", [assignedEditorId]);
            if (!editor) return res.status(400).json({ error: 'Assigned editor not found.' });
        }
        if (!['sub_editor', 'ad_manager'].includes(role)) assignedEditorId = null;

        let isApiEnabled = 0;
        if (req.body.is_api_enabled === '1' || req.body.is_api_enabled === true || req.body.is_api_enabled === 1) {
            isApiEnabled = 1;
        }

        const printDesignation = req.body.print_designation || '';
        const printPlaceName = req.body.print_place_name || '';

        const hash = bcrypt.hashSync(password, 10);
        const result = queryRun(
            `INSERT INTO users
             (username, password_hash, full_name, role, created_by, post, name_hi, name_en, city, district, assigned_sub_editor_id, assigned_editor_id, is_api_enabled, print_designation, print_place_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                username,
                hash,
                full_name,
                role,
                req.user.id,
                post || '',
                name_hi || '',
                name_en || '',
                city || '',
                district || '',
                assignedSubEditorId,
                assignedEditorId,
                isApiEnabled,
                printDesignation,
                printPlaceName
            ]
        );

        res.json({ id: result.lastInsertRowid, message: 'User created successfully.' });
    } catch (err) {
        console.error('Admin create user error:', err);
        res.status(500).json({ error: 'Failed to create user.' });
    }
});

/**
 * PUT /api/admin/users/:id
 */
router.put('/users/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, password, status, post, name_hi, name_en, city, district, assigned_sub_editor_id, role, email, phone } = req.body;

        const user = queryGet('SELECT id, role, is_api_enabled FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (role !== undefined && role !== '' && role !== user.role) {
            const allowedSwap =
                (user.role === 'reporter' && role === 'sub_editor') ||
                (user.role === 'sub_editor' && role === 'reporter');
            if (!allowedSwap) {
                return res.status(400).json({ error: 'भूमिका केवल reporter ↔ sub_editor के बीच ही बदली जा सकती है।' });
            }
            if (user.role === 'reporter' && role === 'sub_editor' && !user.is_api_enabled) {
                return res.status(400).json({ error: 'केवल API-enabled reporter को ही sub_editor बनाया जा सकता है।' });
            }
            queryRun('UPDATE users SET role = ? WHERE id = ?', [role, id]);
        }
        if (email !== undefined) {
            queryRun('UPDATE users SET email = ? WHERE id = ?', [email, id]);
        }
        if (phone !== undefined) {
            queryRun('UPDATE users SET phone = ? WHERE id = ?', [phone, id]);
        }

        if (full_name) {
            queryRun('UPDATE users SET full_name = ? WHERE id = ?', [full_name, id]);
        }
        if (password) {
            const hash = bcrypt.hashSync(password, 10);
            queryRun('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
        }
        if (status && ['active', 'inactive'].includes(status)) {
            queryRun('UPDATE users SET status = ? WHERE id = ?', [status, id]);
        }
        if (post !== undefined) {
            queryRun('UPDATE users SET post = ? WHERE id = ?', [post, id]);
        }
        if (name_hi !== undefined) {
            queryRun('UPDATE users SET name_hi = ? WHERE id = ?', [name_hi, id]);
        }
        if (name_en !== undefined) {
            queryRun('UPDATE users SET name_en = ? WHERE id = ?', [name_en, id]);
        }
        if (city !== undefined) {
            queryRun('UPDATE users SET city = ? WHERE id = ?', [city, id]);
        }
        if (district !== undefined) {
            queryRun('UPDATE users SET district = ? WHERE id = ?', [district, id]);
        }
        if (assigned_sub_editor_id !== undefined) {
            const val = assigned_sub_editor_id ? Number(assigned_sub_editor_id) : null;
            if (val) {
                const subEditor = queryGet("SELECT id FROM users WHERE id = ? AND role = 'sub_editor' AND status = 'active'", [val]);
                if (!subEditor) return res.status(400).json({ error: 'Assigned sub-editor not found.' });
            }
            queryRun('UPDATE users SET assigned_sub_editor_id = ? WHERE id = ?', [val, id]);
        }
        if (req.body.assigned_editor_id !== undefined) {
            const val = req.body.assigned_editor_id ? Number(req.body.assigned_editor_id) : null;
            if (val) {
                const editor = queryGet("SELECT id FROM users WHERE id = ? AND role = 'editor' AND status = 'active'", [val]);
                if (!editor) return res.status(400).json({ error: 'Assigned editor not found.' });
            }
            queryRun('UPDATE users SET assigned_editor_id = ? WHERE id = ?', [val, id]);
        }
        if (req.body.is_api_enabled !== undefined) {
            const val = (req.body.is_api_enabled === '1' || req.body.is_api_enabled === true || req.body.is_api_enabled === 1) ? 1 : 0;
            queryRun('UPDATE users SET is_api_enabled = ? WHERE id = ?', [val, id]);
        }
        if (req.body.print_designation !== undefined) {
            queryRun('UPDATE users SET print_designation = ? WHERE id = ?', [req.body.print_designation, id]);
        }
        if (req.body.print_place_name !== undefined) {
            queryRun('UPDATE users SET print_place_name = ? WHERE id = ?', [req.body.print_place_name, id]);
        }

        res.json({ message: 'User updated successfully.' });
    } catch (err) {
        console.error('Admin update user error:', err);
        res.status(500).json({ error: 'Failed to update user.' });
    }
});

/**
 * POST /api/admin/users/:id/avatar
 */
router.post('/users/:id/avatar', upload.single('avatar'), async (req, res) => {
    try {
        const { id } = req.params;
        const user = queryGet('SELECT id, avatar_path FROM users WHERE id = ?', [id]);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        if (!req.file) return res.status(400).json({ error: 'No image file uploaded.' });

        const { path: processedPath } = await removeBackgroundInPlace(req.file.path);
        const avatar_path = '/uploads/avatars/' + path.basename(processedPath);

        if (user.avatar_path) {
            const oldPath = resolveUpload(user.avatar_path);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        queryRun('UPDATE users SET avatar_path = ? WHERE id = ?', [avatar_path, id]);

        res.json({ message: 'User avatar updated successfully.', avatar_path });
    } catch (err) {
        console.error('Admin update user avatar error:', err);
        res.status(500).json({ error: err.message || 'Failed to update user avatar.' });
    }
});

/**
 * DELETE /api/admin/users/:id
 * Permanently removes a user. If the account has no associated content
 * anywhere (never submitted news, no PDFs, no bundles, etc.), the row is
 * fully deleted and the username is immediately free for reuse. If it has
 * real content, the row is kept (so that content stays attributable and
 * intact) but archived: status becomes 'deleted' and the username is
 * renamed, which frees the ORIGINAL username for a brand-new account right
 * away -- the specific thing this route exists for. Either way this cannot
 * be undone from the UI.
 */
router.delete('/users/:id', (req, res) => {
    try {
        const { id } = req.params;
        const user = queryGet('SELECT id, username, role, status FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        if (user.role === 'admin') {
            return res.status(400).json({ error: 'Admin account को डिलीट नहीं किया जा सकता।' });
        }
        if (user.status === 'active') {
            return res.status(400).json({ error: 'डिलीट करने से पहले प्रोफ़ाइल को पहले बैन (🚫) करें।' });
        }

        const contentCount =
            queryGet('SELECT COUNT(*) c FROM news WHERE reporter_id = ? OR editor_id = ? OR sub_editor_id = ? OR rejected_by = ?', [id, id, id, id]).c +
            queryGet('SELECT COUNT(*) c FROM api_pdfs WHERE target_user_id = ? OR reviewed_by = ?', [id, id]).c +
            queryGet('SELECT COUNT(*) c FROM pagemint_bundles WHERE target_user_id = ?', [id]).c +
            queryGet('SELECT COUNT(*) c FROM pagemint_rewritten_articles WHERE target_user_id = ?', [id]).c +
            queryGet('SELECT COUNT(*) c FROM news_copies WHERE operator_id = ?', [id]).c +
            queryGet('SELECT COUNT(*) c FROM advertisements WHERE sub_editor_id = ? OR editor_id = ?', [id, id]).c;

        // Either way, other users' stale references to this id are safe to
        // clear -- every read that matters (findAssignedSubEditor,
        // requireRole, the api-targets queries) already re-validates
        // role/status live, so this is cleanup, not a correctness fix.
        queryRun('UPDATE users SET assigned_sub_editor_id = NULL WHERE assigned_sub_editor_id = ?', [id]);
        queryRun('UPDATE users SET assigned_editor_id = NULL WHERE assigned_editor_id = ?', [id]);
        queryRun('UPDATE users SET created_by = NULL WHERE created_by = ?', [id]);
        queryRun('DELETE FROM push_subscriptions WHERE user_id = ?', [id]);

        if (contentCount === 0) {
            queryRun('DELETE FROM users WHERE id = ?', [id]);
            return res.json({
                message: `यूज़र @${user.username} पूरी तरह डिलीट कर दिया गया। यह यूज़रनेम अब तुरंत उपलब्ध है।`,
                mode: 'deleted'
            });
        }

        const archivedUsername = `deleted_${id}_${Date.now()}`;
        queryRun("UPDATE users SET status = 'deleted', username = ? WHERE id = ?", [archivedUsername, id]);
        res.json({
            message: `इस यूज़र की ${contentCount} जुड़ी हुई एंट्रीज़ (खबरें/PDF/आदि) हैं, इसलिए इतिहास सुरक्षित रखने के लिए प्रोफ़ाइल आर्काइव कर दी गई। यूज़रनेम @${user.username} अब तुरंत एक नए अकाउंट के लिए उपलब्ध है।`,
            mode: 'archived'
        });
    } catch (err) {
        console.error('Admin delete user error:', err);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});

/**
 * GET /api/admin/settings
 */
router.get('/settings', (req, res) => {
    try {
        const rows = queryAll('SELECT key, value FROM settings');
        const settings = {};
        for (const row of rows) {
            if (row.key.includes('api_key') && row.value && row.value.length > 4) {
                settings[row.key] = row.value.substring(0, 4) + '***';
            } else {
                settings[row.key] = row.value;
            }
        }
        res.json(settings);
    } catch (err) {
        console.error('Admin get settings error:', err);
        res.status(500).json({ error: 'Failed to fetch settings.' });
    }
});

/**
 * PUT /api/admin/settings
 */
router.put('/settings', (req, res) => {
    try {
        const allowedKeys = ['ai_provider', 'gemini_api_key', 'gemini_model', 'deepseek_api_key', 'ai_rewrite_prompt'];
        const updates = req.body;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedKeys.includes(key)) {
                // Upsert: try update first, insert if not exists
                const existing = queryGet('SELECT key FROM settings WHERE key = ?', [key]);
                if (existing) {
                    queryRun('UPDATE settings SET value = ? WHERE key = ?', [value, key]);
                } else {
                    queryRun('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
                }
            }
        }

        res.json({ message: 'Settings updated successfully.' });
    } catch (err) {
        console.error('Admin update settings error:', err);
        res.status(500).json({ error: 'Failed to update settings.' });
    }
});

/**
 * GET /api/admin/publisher-profile
 * CliffFrontEditorRail8A — editor rail fields for PageMint NMS bundle layout.
 */
router.get('/publisher-profile', (req, res) => {
    try {
        res.json(getAdminPublisherProfile());
    } catch (err) {
        console.error('Admin get publisher profile error:', err);
        res.status(500).json({ error: 'Failed to fetch publisher profile.' });
    }
});

/**
 * PUT /api/admin/publisher-profile
 */
router.put('/publisher-profile', (req, res) => {
    try {
        const profile = updateAdminPublisherProfile(req.body || {});
        res.json({ success: true, profile });
    } catch (err) {
        console.error('Admin update publisher profile error:', err);
        res.status(500).json({ error: 'Failed to update publisher profile.' });
    }
});

/**
 * POST /api/admin/publisher-profile/editor-image
 */
router.post('/publisher-profile/editor-image', editorialUpload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Image file is required.' });
        }
        const image_url = `/uploads/editorial/${req.file.filename}`;
        res.json({ success: true, image_url });
    } catch (err) {
        console.error('Admin publisher editor image upload error:', err);
        res.status(500).json({ error: err.message || 'Failed to upload editor image.' });
    }
});

/**
 * GET /api/admin/stats
 */
router.get('/stats', (req, res) => {
    try {
        const stats = {
            total_reporters: queryGet("SELECT COUNT(*) as c FROM users WHERE role = 'reporter'").c,
            total_editors: queryGet("SELECT COUNT(*) as c FROM users WHERE role = 'editor'").c,
            total_operators: queryGet("SELECT COUNT(*) as c FROM users WHERE role = 'operator'").c,
            total_sub_editors: queryGet("SELECT COUNT(*) as c FROM users WHERE role = 'sub_editor'").c,
            total_ad_managers: queryGet("SELECT COUNT(*) as c FROM users WHERE role = 'ad_manager'").c,
            total_news: queryGet("SELECT COUNT(*) as c FROM news").c,
            news_raw: queryGet("SELECT COUNT(*) as c FROM news WHERE status = 'raw'").c,
            news_processed: queryGet("SELECT COUNT(*) as c FROM news WHERE status = 'processed'").c,
            news_forwarded: queryGet("SELECT COUNT(*) as c FROM news WHERE status = 'forwarded'").c,
        };
        res.json(stats);
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: 'Failed to fetch stats.' });
    }
});

module.exports = router;
