const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { avatarsDir, resolveUpload } = require('../storage');
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
               u.is_api_enabled, u.print_designation,
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

        const hash = bcrypt.hashSync(password, 10);
        const result = queryRun(
            `INSERT INTO users
             (username, password_hash, full_name, role, created_by, post, name_hi, name_en, city, district, assigned_sub_editor_id, assigned_editor_id, is_api_enabled, print_designation)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                printDesignation
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
        const { full_name, password, status, post, name_hi, name_en, city, district, assigned_sub_editor_id } = req.body;

        const user = queryGet('SELECT id FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
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

        res.json({ message: 'User updated successfully.' });
    } catch (err) {
        console.error('Admin update user error:', err);
        res.status(500).json({ error: 'Failed to update user.' });
    }
});

/**
 * POST /api/admin/users/:id/avatar
 */
router.post('/users/:id/avatar', upload.single('avatar'), (req, res) => {
    try {
        const { id } = req.params;
        const user = queryGet('SELECT id, avatar_path FROM users WHERE id = ?', [id]);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        if (!req.file) return res.status(400).json({ error: 'No image file uploaded.' });

        const avatar_path = '/uploads/avatars/' + req.file.filename;

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
 */
router.delete('/users/:id', (req, res) => {
    try {
        const { id } = req.params;
        const user = queryGet('SELECT id, role FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        if (user.role === 'admin') {
            return res.status(400).json({ error: 'Cannot deactivate admin account.' });
        }
        queryRun('UPDATE users SET status = ? WHERE id = ?', ['inactive', id]);
        res.json({ message: 'User deactivated.' });
    } catch (err) {
        console.error('Admin delete user error:', err);
        res.status(500).json({ error: 'Failed to deactivate user.' });
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
