const jwt = require('jsonwebtoken');
const { queryGet } = require('../db/init');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_me';

/**
 * Middleware: Verify JWT token from Authorization header
 * Populates req.user = { id, username, full_name, role }
 */
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    // Also accept ?token= query param (needed for ZIP downloads via <a> links)
    const queryToken = req.query && req.query.token;
    const rawToken = (authHeader && authHeader.startsWith('Bearer '))
        ? authHeader.split(' ')[1]
        : queryToken || null;

    if (!rawToken) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(rawToken, JWT_SECRET);
        const user = queryGet('SELECT id, username, full_name, role, status FROM users WHERE id = ?', [decoded.id]);
        if (!user || user.status !== 'active') {
            return res.status(401).json({ error: 'User account is inactive or deleted.' });
        }
        req.user = { id: user.id, username: user.username, full_name: user.full_name, role: user.role };
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please login again.' });
        }
        return res.status(401).json({ error: 'Invalid token.' });
    }
}

/**
 * Middleware Factory: Restrict access to specific roles
 * Usage: requireRole('admin', 'editor')
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required.' });
        }
        // Admin has superuser access to all routes
        if (req.user.role === 'admin' || roles.includes(req.user.role)) {
            return next();
        }
        return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    };
}

module.exports = { verifyToken, requireRole, JWT_SECRET };
