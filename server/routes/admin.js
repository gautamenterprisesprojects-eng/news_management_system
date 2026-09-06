const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { queryAll, queryGet, queryRun } = require('../db/init');
const { verifyToken, requireRole } = require('../middleware/auth');

// All admin routes require admin role
router.use(verifyToken, requireRole('admin'));

/**
 * GET /api/admin/users?role=reporter|editor|operator
 */
router.get('/users', (req, res) => {
    try {
        const { role } = req.query;
        let users;
        if (role) {
            users = queryAll('SELECT id, username, full_name, role, status, created_at, post, name_hi FROM users WHERE role = ? ORDER BY created_at DESC', [role]);
        } else {
            users = queryAll('SELECT id, username, full_name, role, status, created_at, post, name_hi FROM users ORDER BY created_at DESC');
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
        const { username, password, full_name, role, post, name_hi } = req.body;

        if (!username || !password || !full_name || !role) {
            return res.status(400).json({ error: 'All fields are required: username, password, full_name, role.' });
        }

        if (!['reporter', 'editor', 'operator'].includes(role)) {
            return res.status(400).json({ error: 'Role must be reporter, editor, or operator.' });
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

        const hash = bcrypt.hashSync(password, 10);
        const result = queryRun(
            'INSERT INTO users (username, password_hash, full_name, role, created_by, post, name_hi) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, hash, full_name, role, req.user.id, post || '', name_hi || '']
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
        const { full_name, password, status, post, name_hi } = req.body;

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

        res.json({ message: 'User updated successfully.' });
    } catch (err) {
        console.error('Admin update user error:', err);
        res.status(500).json({ error: 'Failed to update user.' });
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
