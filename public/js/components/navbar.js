/* ============================================================
   NAVBAR COMPONENT — Top bar + Bottom navigation
   ============================================================ */

/**
 * Render the top bar with title, language toggle, and user menu
 * @param {string} titleKey - i18n key for the title
 * @param {string} icon - Emoji icon
 */
function renderTopBar(titleKey, icon) {
    const user = JSON.parse(localStorage.getItem('nms_user') || '{}');
    const lang = localStorage.getItem('nms_lang') || 'hi';
    const initials = (user.full_name || 'U').charAt(0).toUpperCase();

    const avatarHtml = user.avatar_path
        ? `<img src="${user.avatar_path}" alt="User" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
        : initials;

    return `
        <header class="top-bar">
            <div class="top-bar-brand">
                <img src="/images/logo.png" alt="The Cliff News" class="brand-logo-img" style="height:44px; width:auto; object-fit:contain; border-radius:6px;">
                <div class="brand-text-group" style="display:flex; flex-direction:column; justify-content:center;">
                    <div class="brand-name">THE CLIFF NEWS</div>
                    <div class="brand-panel-tag" data-i18n="${titleKey}">${t(titleKey)}</div>
                </div>
            </div>
            <div class="top-bar-actions">
                <div class="lang-toggle" onclick="toggleLanguage()">
                    <span class="lang-toggle-option ${lang === 'hi' ? 'active' : ''}" data-lang="hi">हिंदी</span>
                    <span class="lang-toggle-option ${lang === 'en' ? 'active' : ''}" data-lang="en">EN</span>
                </div>
                <button class="user-btn" onclick="toggleUserDropdown()" id="userBtn" style="padding:0; overflow:hidden;">${avatarHtml}</button>
            </div>
            <div class="user-dropdown" id="userDropdown">
                <div class="user-dropdown-header">
                    <div class="name">${user.full_name || 'User'}</div>
                    <div class="role" style="text-transform: capitalize; color: var(--accent-blue);">● ${user.role || ''}</div>
                </div>
                ${user.role === 'admin' ? `
                    <div class="user-dropdown-item" onclick="window.location.hash='#/admin'; toggleUserDropdown();">
                        <i data-lucide="shield-check"></i> <span data-i18n="common.nav_admin_panel">${t('common.nav_admin_panel')}</span>
                    </div>
                ` : user.role === 'editor' ? `
                    <div class="user-dropdown-item" onclick="window.location.hash='#/editor'; toggleUserDropdown();">
                        <i data-lucide="edit-3"></i> <span data-i18n="common.nav_editor_panel">${t('common.nav_editor_panel')}</span>
                    </div>
                ` : user.role === 'operator' ? `
                    <div class="user-dropdown-item" onclick="window.location.hash='#/operator'; toggleUserDropdown();">
                        <i data-lucide="layout-list"></i> <span data-i18n="common.nav_operator_panel">${t('common.nav_operator_panel')}</span>
                    </div>
                ` : user.role === 'reporter' ? `
                    <div class="user-dropdown-item" onclick="window.location.hash='#/reporter'; toggleUserDropdown();">
                        <i data-lucide="file-plus-2"></i> <span data-i18n="common.nav_reporter_panel">${t('common.nav_reporter_panel')}</span>
                    </div>
                ` : ''}
                <div class="user-dropdown-item" onclick="window.location.hash='#/profile'; toggleUserDropdown();">
                    <i data-lucide="user"></i> <span data-i18n="profile.settings">${t('profile.settings')}</span>
                </div>
                ${user.role === 'editor' ? `
                    <div class="user-dropdown-item" id="editorAlertBtn" onclick="enableEditorAlerts(this); event.stopPropagation();">
                        <i data-lucide="bell"></i> Enable alerts
                    </div>
                ` : ''}
                <div class="user-dropdown-item danger" onclick="logout()">
                    <i data-lucide="log-out"></i>
                    <span data-i18n="common.logout">${t('common.logout')}</span>
                </div>
            </div>
        </header>
    `;
}

/**
 * Render bottom navigation bar
 * @param {string} role - User role (determines nav items)
 * @param {string} activeTab - Currently active tab name
 */
function renderBottomNav(role, activeTab) {
    let items = [];

    switch (role) {
        case 'reporter':
            items = [
                { id: 'submit', icon: 'square-pen', label: 'reporter.nav_submit' },
                { id: 'my-news', icon: 'file-text', label: 'reporter.nav_my_news' },
                { id: 'approved', icon: 'check-circle-2', label: 'reporter.nav_approved' },
                { id: 'rejected', icon: 'x-circle', label: 'reporter.nav_rejected' }
            ];
            break;
        case 'editor':
            items = [
                { id: 'raw', icon: 'inbox', label: 'editor.raw_tab' },
                { id: 'processed', icon: 'check-check', label: 'editor.processed_tab' },
                { id: 'forwarded', icon: 'send', label: 'editor.forwarded_tab' },
                { id: 'published', icon: 'globe', label: 'editor.published_tab' },
            ];
            break;
        case 'operator':
            items = [
                { id: 'news', icon: 'newspaper', label: 'operator.nav_news' },
                { id: 'published', icon: 'send', label: 'editor.published_tab' },
            ];
            break;
        case 'admin':
            items = [
                { id: 'dashboard', icon: 'bar-chart-3', label: 'admin.nav_dashboard' },
                { id: 'users', icon: 'users', label: 'admin.nav_users' },
                { id: 'settings', icon: 'settings', label: 'admin.nav_settings' },
            ];
            break;
    }

    const itemsHtml = items.map(item => `
        <div class="bottom-nav-item ${activeTab === item.id ? 'active' : ''}"
             onclick="switchTab('${item.id}')" data-tab="${item.id}">
            <span class="nav-icon"><i data-lucide="${item.icon}"></i></span>
            <span class="nav-label" data-i18n="${item.label}">${t(item.label)}</span>
        </div>
    `).join('');

    return `<nav class="bottom-nav">${itemsHtml}</nav>`;
}

/**
 * Toggle user dropdown menu
 */
function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
        updateEditorAlertButton();
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('userDropdown');
    const btn = document.getElementById('userBtn');
    if (dropdown && btn && !btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('show');
    }
});

/**
 * Upload Avatar
 */
async function uploadAvatar(input) {
    if (!input.files || !input.files[0]) return;
    
    const formData = new FormData();
    formData.append('photo', input.files[0]);
    
    try {
        showToast('Uploading photo...', 'info');
        // We use reporter/photo endpoint as it works for any authenticated user via verifyToken
        const res = await api('/reporter/photo', {
            method: 'POST',
            body: formData,
            isFormData: true
        });
        
        if (res.error) {
            showToast(res.error, 'error');
        } else {
            showToast('Photo uploaded!', 'success');
            // Update local storage user info
            if (res.user) {
                localStorage.setItem('nms_user', JSON.stringify(res.user));
            }
            // Reload page to reflect changes
            window.location.reload();
        }
    } catch (err) {
        showToast('Error uploading photo', 'error');
    }
}
