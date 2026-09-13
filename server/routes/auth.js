const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { queryGet } = require('../db/init');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', (req, res) => {
    try {
        const username = String(req.body.username || '').trim();
        const { password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        const user = queryGet('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [username]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        if (user.status !== 'active') {
            return res.status(401).json({ error: 'Account is deactivated. Contact admin.' });
        }

        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, is_api_enabled: user.is_api_enabled },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
                is_api_enabled: user.is_api_enabled,
                avatar_path: user.avatar_path
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get('/me', verifyToken, (req, res) => {
    res.json(req.user);
});

module.exports = router;
