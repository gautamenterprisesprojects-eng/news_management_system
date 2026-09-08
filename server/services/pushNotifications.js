const webpush = require('web-push');
const { queryAll, queryRun } = require('../db/init');

function getPushConfig() {
    const publicKey = process.env.VAPID_PUBLIC_KEY || '';
    const privateKey = process.env.VAPID_PRIVATE_KEY || '';
    const subject = process.env.VAPID_SUBJECT || '';

    return {
        enabled: Boolean(publicKey && privateKey && subject),
        publicKey,
        privateKey,
        subject
    };
}

function configureWebPush() {
    const config = getPushConfig();
    if (config.enabled) {
        webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    }
    return config;
}

async function sendPushToEditors(payload) {
    const config = configureWebPush();
    if (!config.enabled) return { enabled: false, sent: 0, failed: 0 };

    const subscriptions = queryAll(`
        SELECT ps.id, ps.subscription_json
        FROM push_subscriptions ps
        JOIN users u ON u.id = ps.user_id
        WHERE u.role = 'editor' AND u.status = 'active'
    `);

    let sent = 0;
    let failed = 0;

    await Promise.all(subscriptions.map(async (row) => {
        try {
            await webpush.sendNotification(JSON.parse(row.subscription_json), JSON.stringify(payload));
            sent += 1;
        } catch (err) {
            failed += 1;
            if (err.statusCode === 404 || err.statusCode === 410) {
                queryRun('DELETE FROM push_subscriptions WHERE id = ?', [row.id]);
            } else {
                console.error('Push notification failed:', err.message);
            }
        }
    }));

    return { enabled: true, sent, failed };
}

module.exports = { configureWebPush, getPushConfig, sendPushToEditors };
