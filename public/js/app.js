/* ============================================================
   APP.JS - Multi-page navigation, auth state, and API helpers
   ============================================================ */

const NMS_PAGE_ROUTES = Object.freeze({
    gateway: '/',
    login: '/login/',
    reporter: '/reporter/',
    editor: '/editor/',
    'sub-editor': '/sub-editor/',
    'ad-manager': '/ad-manager/',
    operator: '/operator/',
    admin: '/admin/',
    profile: '/profile/'
});

const NMS_ROLE_PAGES = Object.freeze({
    admin: 'admin',
    editor: 'editor',
    reporter: 'reporter',
    operator: 'operator',
    sub_editor: 'sub-editor',
    ad_manager: 'ad-manager'
});

const NMS_LEGACY_HASH_PAGES = Object.freeze({
    '#/login': 'login',
    '#/reporter': 'reporter',
    '#/editor': 'editor',
    '#/sub-editor': 'sub-editor',
    '#/ad-manager': 'ad-manager',
    '#/operator': 'operator',
    '#/admin': 'admin',
    '#/profile': 'profile'
});

const NMS_PAGE_RENDERERS = Object.freeze({
    login: 'renderLogin',
    reporter: 'renderReporter',
    editor: 'renderEditor',
    'sub-editor': 'renderSubEditor',
    'ad-manager': 'renderAdManager',
    operator: 'renderOperator',
    admin: 'renderAdmin',
    profile: 'renderProfile'
});

function getCurrentPage() {
    return document.body?.dataset.nmsPage || 'gateway';
}

function isCurrentPage(page) {
    return getCurrentPage() === page;
}

function getRoleHomePage(user = getCurrentUser()) {
    return user ? NMS_ROLE_PAGES[user.role] || null : null;
}

function navigateToPage(page, { replace = false } = {}) {
    const target = NMS_PAGE_ROUTES[page] || NMS_PAGE_ROUTES.login;

    if (window.location.pathname === target) {
        if (window.location.hash || window.location.search) {
            window.history.replaceState(null, '', target);
        }
        return;
    }

    if (replace) window.location.replace(target);
    else window.location.assign(target);
}

/**
 * Builds a PDF URL that forces an actual download (Content-Disposition:
 * attachment) instead of an inline preview -- needed because iOS Safari
 * ignores the HTML `download` attribute for PDFs and opens Quick Look
 * instead. See the matching /uploads/pdfs middleware in server/index.js.
 */
function forceDownloadUrl(url, filename) {
    if (!url) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}dl=1&filename=${encodeURIComponent(filename || 'newspaper.pdf')}`;
}

/**
 * API helper - all API calls go through this.
 * Automatically adds the JWT token and handles auth errors.
 */
async function api(endpoint, options = {}) {
    const token = localStorage.getItem('nms_token');
    const headers = { ...(options.headers || {}) };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    // Do not set Content-Type for FormData; the browser adds its boundary.
    if (!options.isFormData) {
        headers['Content-Type'] = 'application/json';
    }
    headers['Cache-Control'] = 'no-cache';
    headers.Pragma = 'no-cache';

    const method = (options.method || 'GET').toUpperCase();
    const apiUrl = new URL(`/api${endpoint}`, window.location.origin);
    if (method === 'GET') {
        apiUrl.searchParams.set('_ts', Date.now().toString());
    }

    // File uploads (e.g. avatar photos run through background removal) can
    // legitimately take longer on slow mobile connections; everything else
    // is a plain DB-backed call that should never take this long. Without a
    // timeout a stalled connection leaves fetch() pending forever, which
    // looks to the user like an infinite loading spinner with no error.
    const timeoutMs = options.isFormData || endpoint.includes('/rewrite') ? 90000 : 20000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const fetchOptions = {
        ...options,
        headers,
        cache: 'no-store',
        signal: controller.signal
    };

    delete fetchOptions.isFormData;

    try {
        const res = await fetch(apiUrl.pathname + apiUrl.search, fetchOptions);
        const data = await res.json().catch(() => ({}));

        if (res.status === 401) {
            const message = data.error || 'Authentication failed.';
            if (endpoint !== '/auth/login') {
                logout();
            }
            return { error: message };
        }

        return data;
    } catch (err) {
        if (err.name === 'AbortError') {
            console.error('API timeout:', endpoint);
            return { error: 'Request timed out. Check your connection and try again.' };
        }
        console.error('API error:', err);
        return { error: 'Network error' };
    } finally {
        clearTimeout(timeoutId);
    }
}

function logout() {
    localStorage.removeItem('nms_token');
    localStorage.removeItem('nms_user');
    navigateToPage('login', { replace: true });
}

function isAuthenticated() {
    return !!localStorage.getItem('nms_token');
}

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('nms_user') || 'null');
    } catch {
        return null;
    }
}

/**
 * Tab switching is intentionally kept inside each role document. This keeps
 * the existing workflows fast without turning every tab into a full reload.
 */
function switchTab(tabId) {
    const page = getCurrentPage();

    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabId);
    });

    if (page === 'reporter') {
        reporterTab = tabId;
        if (tabId === 'submit') renderReporterSubmitTab();
        else if (tabId === 'my-news') renderReporterMyNewsTab();
        else if (tabId === 'approved') renderReporterApprovedTab();
        else if (tabId === 'rejected') renderReporterRejectedTab();
        else if (tabId === 'pdfs') renderReporterPdfsTab();
    } else if (page === 'editor') {
        editorTab = tabId;
        switchEditorPane(tabId);
    } else if (page === 'sub-editor') {
        subEditorTab = tabId;
        if (typeof renderSubEditorTab === 'function') renderSubEditorTab(tabId);
    } else if (page === 'ad-manager') {
        if (typeof switchAdManagerPane === 'function') switchAdManagerPane(tabId);
    } else if (page === 'admin') {
        adminTab = tabId;
        if (tabId === 'dashboard') renderAdminDashboard();
        else if (tabId === 'users') renderAdminUsers();
        else if (tabId === 'settings') renderAdminSettings();
    }
}

function getLegacyHashPage() {
    const hash = window.location.hash || '';
    const route = hash.split('?')[0];
    return NMS_LEGACY_HASH_PAGES[route] || null;
}

function renderCurrentPage(page) {
    const rendererName = NMS_PAGE_RENDERERS[page];
    const renderFn = rendererName ? window[rendererName] : null;
    if (typeof renderFn === 'function') {
        renderFn();
        return;
    }

    console.error(`Missing renderer for NMS page: ${page}`);
    const app = document.getElementById('app');
    if (app) {
        app.innerHTML = '<div class="empty-state"><div class="empty-text">Unable to load this page. Please refresh.</div></div>';
    }
}

/**
 * Multi-page entry guard. Legacy hash routes remain valid and are converted
 * to their equivalent document URL before any role module is rendered.
 */
function router() {
    const page = getCurrentPage();
    const legacyPage = getLegacyHashPage();

    if (legacyPage) {
        if (page !== legacyPage) {
            navigateToPage(legacyPage, { replace: true });
            return;
        }
        window.history.replaceState(null, '', NMS_PAGE_ROUTES[page]);
    }

    if (page === 'gateway') {
        const homePage = isAuthenticated() ? getRoleHomePage() : null;
        navigateToPage(homePage || 'login', { replace: true });
        return;
    }

    if (page === 'login') {
        if (isAuthenticated()) {
            const homePage = getRoleHomePage();
            if (homePage) {
                navigateToPage(homePage, { replace: true });
                return;
            }
            logout();
            renderCurrentPage(page);
            return;
        }
        renderCurrentPage(page);
        return;
    }

    if (!isAuthenticated()) {
        navigateToPage('login', { replace: true });
        return;
    }

    const user = getCurrentUser();
    const homePage = getRoleHomePage(user);
    if (!user || !homePage) {
        logout();
        return;
    }

    if (page !== 'profile' && page !== homePage) {
        navigateToPage(homePage, { replace: true });
        return;
    }

    renderCurrentPage(page);
}

window.addEventListener('hashchange', router);
window.addEventListener('pageshow', event => {
    if (event.persisted) router();
});

if (!localStorage.getItem('nms_lang')) {
    localStorage.setItem('nms_lang', 'hi');
}

function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

let iconTimeout;
const iconObserver = new MutationObserver(() => {
    clearTimeout(iconTimeout);
    iconTimeout = setTimeout(refreshIcons, 30);
});

document.addEventListener('DOMContentLoaded', () => {
    iconObserver.observe(document.body, { childList: true, subtree: true });
    refreshIcons();
});

if (document.body) {
    iconObserver.observe(document.body, { childList: true, subtree: true });
    refreshIcons();
}

router();
