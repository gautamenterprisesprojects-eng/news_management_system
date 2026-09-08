const express = require('express');
const router = express.Router();
const { queryRun } = require('../db/init');
const { verifyToken, requireRole } = require('../middleware/auth');
const { getPushConfig } = require('../services/pushNotifications');

router.get('/vapid-public-key', verifyToken, requireRole('editor'), (req, res) => {
    const config = getPushConfig();
    if (!config.enabled) {
        return res.status(503).json({ error: 'Push notifications are not configured on the server.' });
    }
    res.json({ publicKey: config.publicKey });
});

router.post('/subscribe', verifyToken, requireRole('editor'), (req, res) => {
    const subscription = req.body && req.body.subscription;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ error: 'Invalid push subscription.' });
    }

    queryRun(`
        INSERT INTO push_subscriptions (user_id, endpoint, subscription_json, updated_at)
        VALUES (?, ?, ?, datetime('now', 'localtime'))
        ON CONFLICT(endpoint) DO UPDATE SET
            user_id = excluded.user_id,
            subscription_json = excluded.subscription_json,
            updated_at = excluded.updated_at
    `, [req.user.id, subscription.endpoint, JSON.stringify(subscription)]);

    res.json({ success: true });
});

router.post('/unsubscribe', verifyToken, requireRole('editor'), (req, res) => {
    const endpoint = req.body && req.body.endpoint;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required.' });

    queryRun('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?', [endpoint, req.user.id]);
    res.json({ success: true });
});

module.exports = router;
