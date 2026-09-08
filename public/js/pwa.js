let pwaRegistration = null;

async function initPwa() {
    if (!('serviceWorker' in navigator)) return;

    try {
        pwaRegistration = await navigator.serviceWorker.register('/sw.js');
    } catch (err) {
        console.error('Service worker registration failed:', err);
    }
}

function isPushSupported() {
    return 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator;
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function enableEditorAlerts(buttonEl) {
    if (!isPushSupported()) {
        showToast('Install this site from Safari Home Screen on iPhone, then enable alerts.', 'info');
        return;
    }

    const user = getCurrentUser();
    if (!user || user.role !== 'editor') {
        showToast('Alerts are available for editor accounts.', 'info');
        return;
    }

    const originalHtml = buttonEl ? buttonEl.innerHTML : '';
    if (buttonEl) {
        buttonEl.disabled = true;
        buttonEl.innerHTML = '<i data-lucide="loader-2" class="spin-icon"></i> Enabling...';
        refreshIcons();
    }

    try {
        const keyData = await api('/push/vapid-public-key');
        if (keyData.error || !keyData.publicKey) {
            showToast(keyData.error || 'Push notifications are not configured on the server.', 'error');
            return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showToast('Notification permission was not allowed.', 'error');
            return;
        }

        const saved = await subscribeEditorToPush(keyData.publicKey);
        if (!saved) return;

        localStorage.setItem('nms_editor_alerts_enabled', 'true');
        showToast('Editor lock-screen alerts enabled.', 'success');
        updateEditorAlertButton();
        renderEditorAlertPrompt();
    } catch (err) {
        console.error('Enable alerts failed:', err);
        showToast('Failed to enable alerts.', 'error');
    } finally {
        if (buttonEl) {
            buttonEl.disabled = false;
            if (!localStorage.getItem('nms_editor_alerts_enabled')) buttonEl.innerHTML = originalHtml;
            refreshIcons();
        }
    }
}

async function subscribeEditorToPush(publicKey) {
    const registration = pwaRegistration || await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
    }

    const saved = await api('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription })
    });

    if (saved.error) {
        showToast(saved.error, 'error');
        return false;
    }
    return true;
}

async function ensureEditorAlertsDefaultOn() {
    const user = getCurrentUser();
    if (!user || user.role !== 'editor') return;

    renderEditorAlertPrompt();

    if (!isPushSupported() || Notification.permission !== 'granted') return;

    try {
        const keyData = await api('/push/vapid-public-key');
        if (!keyData.error && keyData.publicKey) {
            const saved = await subscribeEditorToPush(keyData.publicKey);
            if (saved) {
                localStorage.setItem('nms_editor_alerts_enabled', 'true');
                updateEditorAlertButton();
                renderEditorAlertPrompt();
            }
        }
    } catch (err) {
        console.error('Default editor alert setup failed:', err);
    }
}

function renderEditorAlertPrompt() {
    const user = getCurrentUser();
    const main = document.querySelector('.page-content');
    if (!main || !user || user.role !== 'editor') return;

    let prompt = document.getElementById('editorAlertPrompt');
    const permission = isPushSupported() ? Notification.permission : 'unsupported';
    const enabled = localStorage.getItem('nms_editor_alerts_enabled') === 'true' && permission === 'granted';

    if (enabled) {
        if (prompt) prompt.remove();
        return;
    }

    if (!prompt) {
        prompt = document.createElement('div');
        prompt.id = 'editorAlertPrompt';
        main.insertBefore(prompt, main.firstElementChild);
    }

    if (permission === 'denied') {
        prompt.className = 'editor-alert-prompt blocked';
        prompt.innerHTML = `
            <i data-lucide="bell-off"></i>
            <div class="editor-alert-copy">
                <strong>Editor alerts are blocked</strong>
                <span>Allow notifications in iPhone Settings/Safari, then reopen this Home Screen app.</span>
            </div>
        `;
    } else {
        prompt.className = 'editor-alert-prompt';
        prompt.innerHTML = `
            <i data-lucide="bell-ring"></i>
            <div class="editor-alert-copy">
                <strong>Editor alerts are required</strong>
                <span>Turn on lock-screen alerts for every new reporter submission.</span>
            </div>
            <button class="btn btn-primary btn-sm" onclick="enableEditorAlerts(this)">Enable now</button>
        `;
    }
    refreshIcons();
}

function updateEditorAlertButton() {
    const btn = document.getElementById('editorAlertBtn');
    if (!btn) return;

    const enabled = localStorage.getItem('nms_editor_alerts_enabled') === 'true';
    btn.innerHTML = enabled
        ? '<i data-lucide="bell-check"></i> Alerts enabled'
        : '<i data-lucide="bell"></i> Enable alerts';
    btn.classList.toggle('active', enabled);
    refreshIcons();
}

document.addEventListener('DOMContentLoaded', initPwa);
