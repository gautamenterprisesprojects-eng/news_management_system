/* ============================================================
   APP.JS — SPA Router, Auth State, API Helpers
   ============================================================ */

/**
 * API helper — all API calls go through this
 * Automatically adds JWT token and handles auth errors
 */
async function api(endpoint, options = {}) {
    const token = localStorage.getItem('nms_token');
    const headers = { ...(options.headers || {}) };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type for FormData (browser sets it with boundary)
    if (!options.isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    const fetchOptions = {
        ...options,
        headers
    };

    // Remove our custom flag
    delete fetchOptions.isFormData;

    try {
        const res = await fetch(`/api${endpoint}`, fetchOptions);

        if (res.status === 401) {
            logout();
            return { error: 'Session expired' };
        }

        return await res.json();
    } catch (err) {
        console.error('API error:', err);
        return { error: 'Network error' };
    }
}

/**
 * Logout — clear auth data and redirect to login
 */
function logout() {
    localStorage.removeItem('nms_token');
    localStorage.removeItem('nms_user');
    window.location.hash = '#/login';
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    return !!localStorage.getItem('nms_token');
}

/**
 * Get current user info
 */
function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('nms_user') || 'null');
    } catch {
        return null;
    }
}

/**
 * Tab switching — used by bottom nav across all pages
 */
function switchTab(tabId) {
    const hash = window.location.hash || '';

    // Update bottom nav active state
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabId);
    });

    if (hash.startsWith('#/reporter')) {
        reporterTab = tabId;
        if (tabId === 'submit') renderReporterSubmitTab();
        else if (tabId === 'my-news') renderReporterMyNewsTab();
        else if (tabId === 'approved') renderReporterApprovedTab();
        else if (tabId === 'rejected') renderReporterRejectedTab();
    } else if (hash.startsWith('#/editor')) {
        editorTab = tabId;
        switchEditorPane(tabId);
    } else if (hash.startsWith('#/admin')) {
        adminTab = tabId;
        if (tabId === 'dashboard') renderAdminDashboard();
        else if (tabId === 'users') renderAdminUsers();
        else if (tabId === 'settings') renderAdminSettings();
    }
}

/**
 * SPA Router — hash-based routing
 */
const routes = {
    '#/login': renderLogin,
    '#/reporter': renderReporter,
    '#/editor': renderEditor,
    '#/operator': renderOperator,
    '#/admin': renderAdmin,
    '#/profile': renderProfile
};

function router() {
    const hash = window.location.hash || '#/login';

    // Auth guard — redirect to login if not authenticated
    if (hash !== '#/login' && !isAuthenticated()) {
        window.location.hash = '#/login';
        return;
    }

    // If authenticated and on login, redirect to role page
    if (hash === '#/login' && isAuthenticated()) {
        const user = getCurrentUser();
        if (user) {
            const roleRoutes = {
                admin: '#/admin',
                reporter: '#/reporter',
                editor: '#/editor',
                operator: '#/operator'
            };
            window.location.hash = roleRoutes[user.role] || '#/login';
            return;
        }
    }

    // Role guard — ensure user can access permitted panels
    if (isAuthenticated()) {
        const user = getCurrentUser();
        const allowedRoutes = {
            admin: ['#/admin', '#/reporter', '#/editor', '#/operator', '#/profile'],
            editor: ['#/editor', '#/operator', '#/reporter', '#/profile'],
            operator: ['#/operator', '#/reporter', '#/profile'],
            reporter: ['#/reporter', '#/profile']
        };

        if (user && allowedRoutes[user.role] && !allowedRoutes[user.role].includes(hash)) {
            window.location.hash = allowedRoutes[user.role][0];
            return;
        }
    }

    const renderFn = routes[hash];
    if (renderFn) {
        renderFn();
    } else {
        window.location.hash = '#/login';
    }
}

// ============================================================
// INITIALIZATION
// ============================================================
window.addEventListener('hashchange', router);

// Set default language if not set
if (!localStorage.getItem('nms_lang')) {
    localStorage.setItem('nms_lang', 'hi');
}

// Auto-refresh Lucide icons
function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

// Observe DOM updates to automatically render any data-lucide icons
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

// Start router
router();

