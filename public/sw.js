self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
    // Keep all requests network-driven so newsroom data never goes stale.
});

self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = { title: 'The Cliff NEWS', body: event.data ? event.data.text() : '' };
    }

    const options = {
        body: payload.body || 'New update received.',
        icon: payload.icon || '/images/pwa-icon-192.png',
        badge: '/images/pwa-icon-192.png',
        image: payload.image || undefined,
        lang: 'hi-IN',
        dir: 'auto',
        data: {
            url: payload.url || '/#/editor',
            newsId: payload.newsId || null
        },
        tag: payload.tag || 'the-cliff-news',
        renotify: true
    };

    event.waitUntil(self.registration.showNotification(payload.title || 'The Cliff NEWS', options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = new URL(event.notification.data?.url || '/#/editor', self.location.origin).href;

    event.waitUntil((async () => {
        const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientsList) {
            if ('focus' in client) {
                await client.focus();
                if ('navigate' in client) await client.navigate(targetUrl);
                return;
            }
        }
        await self.clients.openWindow(targetUrl);
    })());
});
