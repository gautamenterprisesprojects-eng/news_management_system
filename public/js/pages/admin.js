/* ============================================================
   ADMIN PAGE — Dashboard, User Management, Settings
   ============================================================ */

let adminTab = 'dashboard';
let adminUserFilter = 'all';
let adminSubEditors = [];

function renderAdmin() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('admin.title', '👑')}
        <main class="page-content" id="adminContent">
        </main>
        ${renderBottomNav('admin', adminTab)}
    `;
    applyLanguage();
    switchTab(adminTab);
}

// ============ DASHBOARD TAB ============

async function renderAdminDashboard() {
    const content = document.getElementById('adminContent');
    content.innerHTML = `
        <div class="page-header">
            <h2 data-i18n="admin.dashboard">${t('admin.dashboard')}</h2>
        </div>
        <div class="stats-grid" id="statsGrid">
            <div class="stat-card blue"><div class="loading-spinner" style="margin:0 auto;width:20px;height:20px;"></div></div>
            <div class="stat-card green"><div class="loading-spinner" style="margin:0 auto;width:20px;height:20px;"></div></div>
            <div class="stat-card amber"><div class="loading-spinner" style="margin:0 auto;width:20px;height:20px;"></div></div>
            <div class="stat-card purple"><div class="loading-spinner" style="margin:0 auto;width:20px;height:20px;"></div></div>
            <div class="stat-card blue"><div class="loading-spinner" style="margin:0 auto;width:20px;height:20px;"></div></div>
            <div class="stat-card purple"><div class="loading-spinner" style="margin:0 auto;width:20px;height:20px;"></div></div>
        </div>
    `;
    applyLanguage();

    try {
        const stats = await api('/admin/stats');
        document.getElementById('statsGrid').innerHTML = `
            <div class="stat-card blue">
                <div class="stat-icon">📱</div>
                <div class="stat-value">${stats.total_reporters}</div>
                <div class="stat-label" data-i18n="admin.total_reporters">${t('admin.total_reporters')}</div>
            </div>
            <div class="stat-card purple">
                <div class="stat-icon">✏️</div>
                <div class="stat-value">${stats.total_editors}</div>
                <div class="stat-label" data-i18n="admin.total_editors">${t('admin.total_editors')}</div>
            </div>
            <div class="stat-card green">
                <div class="stat-icon">📋</div>
                <div class="stat-value">${stats.total_operators}</div>
                <div class="stat-label" data-i18n="admin.total_operators">${t('admin.total_operators')}</div>
            </div>
            <div class="stat-card amber">
                <div class="stat-icon">📰</div>
                <div class="stat-value">${stats.total_news}</div>
                <div class="stat-label" data-i18n="admin.total_news">${t('admin.total_news')}</div>
            </div>
            <div class="stat-card blue">
                <div class="stat-icon">📝</div>
                <div class="stat-value">${stats.news_raw}</div>
                <div class="stat-label" data-i18n="admin.news_raw">${t('admin.news_raw')}</div>
            </div>
            <div class="stat-card purple">
                <div class="stat-icon">✅</div>
                <div class="stat-value">${stats.news_processed}</div>
                <div class="stat-label" data-i18n="admin.news_processed">${t('admin.news_processed')}</div>
            </div>
            <div class="stat-card green">
                <div class="stat-icon">📤</div>
                <div class="stat-value">${stats.news_forwarded}</div>
                <div class="stat-label" data-i18n="admin.news_forwarded">${t('admin.news_forwarded')}</div>
            </div>
            <div class="stat-card amber">
                <div class="stat-icon">👥</div>
                <div class="stat-value">${stats.total_sub_editors}</div>
                <div class="stat-label">Sub-Editors</div>
            </div>
            <div class="stat-card blue">
                <div class="stat-icon">📢</div>
                <div class="stat-value">${stats.total_ad_managers}</div>
                <div class="stat-label">Ad Managers</div>
            </div>
        `;
        applyLanguage();
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

// ============ USERS TAB ============

async function renderAdminUsers() {
    const content = document.getElementById('adminContent');
    content.innerHTML = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h2 data-i18n="admin.user_management">${t('admin.user_management')}</h2>
            </div>
            <button class="btn btn-primary btn-sm" onclick="showCreateUserForm()">
                + <span data-i18n="admin.create_user">${t('admin.create_user')}</span>
            </button>
        </div>

        <div id="createUserSection" class="hidden">
            <div class="card" style="border-color: var(--accent-blue);">
                <h3 style="margin-bottom:var(--space-md);font-size:var(--font-size-md);" data-i18n="admin.create_user">${t('admin.create_user')}</h3>
                <div class="form-group">
                    <label class="form-label" data-i18n="admin.full_name">${t('admin.full_name')}</label>
                    <input type="text" class="form-input" id="newUserFullName"
                           data-i18n-placeholder="admin.full_name_placeholder" placeholder="${t('admin.full_name_placeholder')}">
                </div>
                <div class="form-group">
                    <label class="form-label" data-i18n="admin.username">${t('admin.username')}</label>
                    <input type="text" class="form-input" id="newUserUsername"
                           data-i18n-placeholder="admin.username_placeholder" placeholder="${t('admin.username_placeholder')}" autocapitalize="none">
                </div>
                <div class="form-group">
                    <label class="form-label" data-i18n="admin.password">${t('admin.password')}</label>
                    <input type="password" class="form-input" id="newUserPassword"
                           data-i18n-placeholder="admin.password_placeholder" placeholder="${t('admin.password_placeholder')}">
                </div>
                <div class="form-group">
                    <label class="form-label" data-i18n="admin.role">${t('admin.role')}</label>
                    <select class="form-input form-select" id="newUserRole" onchange="handleNewUserRoleChange()">
                        <option value="" data-i18n="admin.select_role">${t('admin.select_role')}</option>
                        <option value="reporter" data-i18n="admin.role_reporter">${t('admin.role_reporter')}</option>
                        <option value="editor" data-i18n="admin.role_editor">${t('admin.role_editor')}</option>
                        <option value="operator" data-i18n="admin.role_operator">${t('admin.role_operator')}</option>
                        <option value="sub_editor">Sub-Editor</option>
                        <option value="ad_manager">Ad Manager</option>
                    </select>
                </div>
                
                <!-- Dynamic fields container -->
                <div id="newUserDynamicFields"></div>

                <div class="form-group">
                    <label class="form-label">Designation / Post</label>
                    <input type="text" class="form-input" id="newUserPost" placeholder="e.g. Senior Reporter">
                </div>
                <div class="form-group">
                    <label class="form-label">Hindi Name</label>
                    <input type="text" class="form-input" id="newUserNameHi" placeholder="e.g. राकेश सिंह">
                </div>
                <div class="flex gap-sm mt-4">
                    <button class="btn btn-primary" id="createUserBtn" onclick="createUser()" data-i18n="admin.create_btn">${t('admin.create_btn')}</button>
                    <button class="btn btn-secondary" onclick="hideCreateUserForm()" data-i18n="common.cancel">${t('common.cancel')}</button>
                </div>
            </div>
        </div>

        <div class="role-tabs">
            <div class="role-tab ${adminUserFilter === 'all' ? 'active' : ''}" onclick="filterUsers('all')" data-i18n="admin.all_roles">${t('admin.all_roles')}</div>
            <div class="role-tab ${adminUserFilter === 'reporter' ? 'active' : ''}" onclick="filterUsers('reporter')" data-i18n="admin.reporters">${t('admin.reporters')}</div>
            <div class="role-tab ${adminUserFilter === 'editor' ? 'active' : ''}" onclick="filterUsers('editor')" data-i18n="admin.editors">${t('admin.editors')}</div>
            <div class="role-tab ${adminUserFilter === 'operator' ? 'active' : ''}" onclick="filterUsers('operator')" data-i18n="admin.operators">${t('admin.operators')}</div>
            <div class="role-tab ${adminUserFilter === 'sub_editor' ? 'active' : ''}" onclick="filterUsers('sub_editor')">Sub-Editors</div>
            <div class="role-tab ${adminUserFilter === 'ad_manager' ? 'active' : ''}" onclick="filterUsers('ad_manager')">Ad Managers</div>
        </div>

        <div id="usersList">
            <div class="loading-spinner" style="margin:40px auto;"></div>
        </div>
    `;
    applyLanguage();
    loadUsers();
}

function showCreateUserForm() {
    document.getElementById('createUserSection').classList.remove('hidden');
}

function hideCreateUserForm() {
    document.getElementById('createUserSection').classList.add('hidden');
}

let _adminEditorsCache = [];
let _adminTargetsCache = [];

async function handleNewUserRoleChange() {
    const role = document.getElementById('newUserRole').value;
    const dynamicFields = document.getElementById('newUserDynamicFields');
    dynamicFields.innerHTML = '';

    if (!role) return;

    if (role === 'sub_editor' || role === 'ad_manager') {
        if (_adminEditorsCache.length === 0) {
            const res = await api('/admin/editors');
            if (!res.error) _adminEditorsCache = res.editors;
        }

        let html = '';
        if (role === 'sub_editor') {
            html += `
                <div class="form-group">
                    <label class="form-label">District / City</label>
                    <input type="text" class="form-input" id="newUserDistrict" placeholder="e.g. Indore">
                </div>
                <div class="form-group">
                    <label class="form-label">English Name</label>
                    <input type="text" class="form-input" id="newUserNameEn" placeholder="e.g. Rakesh Singh">
                </div>
            `;
        }

        html += `
            <div class="form-group">
                <label class="form-label">Assign to Main Editor</label>
                <select class="form-input form-select" id="newUserAssignedEditor">
                    <option value="">-- Select Main Editor --</option>
                    ${_adminEditorsCache.map(e => `<option value="${e.id}">${escapeHtml(e.full_name)} (${escapeHtml(e.city || 'No City')})</option>`).join('')}
                </select>
            </div>
        `;
        dynamicFields.innerHTML = html;
    } else if (role === 'reporter' || role === 'operator') {
        if (_adminTargetsCache.length === 0) {
            const res = await api('/admin/assignable-targets');
            if (!res.error) _adminTargetsCache = res.targets;
        }

        dynamicFields.innerHTML = `
            <div class="form-group">
                <label class="form-label">Assign to Editor / Sub-Editor</label>
                <select class="form-input form-select" id="newUserAssignedTarget">
                    <option value="">-- Direct (No Assignment) --</option>
                    ${_adminTargetsCache.map(t => {
                        const roleLabel = t.role === 'editor' ? 'एडिटर' : 'सब-एडिटर';
                        const place = t.district || t.city || 'No Place';
                        return `<option value="${t.id}" data-role="${t.role}">${escapeHtml(t.full_name)} (${roleLabel} · ${escapeHtml(place)})</option>`;
                    }).join('')}
                </select>
            </div>
        `;
    }

    if (role === 'reporter' || role === 'sub_editor') {
        dynamicFields.innerHTML += `
            <div class="form-group" style="margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 15px;">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" id="newUserIsApiEnabled" style="width:16px; height:16px;">
                    <strong>Enable API Newspaper Generation</strong>
                </label>
                <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">If enabled, this user will appear in the Main Editor's API tab.</p>
            </div>
            <div class="form-group">
                <label class="form-label">Print Designation (For Newspaper API)</label>
                <input type="text" class="form-input" id="newUserPrintDesignation" placeholder="e.g. Special Correspondent">
            </div>
        `;
    }
}

async function createUser() {
    const btn = document.getElementById('createUserBtn');
    const full_name = document.getElementById('newUserFullName').value.trim();
    const username = document.getElementById('newUserUsername').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    const post = document.getElementById('newUserPost').value.trim();
    const name_hi = document.getElementById('newUserNameHi').value.trim();
    
    // Dynamic fields
    const districtEl = document.getElementById('newUserDistrict');
    const nameEnEl = document.getElementById('newUserNameEn');
    const assignedEditorEl = document.getElementById('newUserAssignedEditor');
    const assignedTargetEl = document.getElementById('newUserAssignedTarget');
    const isApiEnabledEl = document.getElementById('newUserIsApiEnabled');
    const printDesignationEl = document.getElementById('newUserPrintDesignation');

    const district = districtEl ? districtEl.value.trim() : '';
    const name_en = nameEnEl ? nameEnEl.value.trim() : '';
    const assigned_editor_id = assignedEditorEl ? assignedEditorEl.value : null;
    const is_api_enabled = isApiEnabledEl ? (isApiEnabledEl.checked ? 1 : 0) : 0;
    const print_designation = printDesignationEl ? printDesignationEl.value.trim() : '';
    
    let assigned_sub_editor_id = null;
    let final_assigned_editor_id = assigned_editor_id;

    if (assignedTargetEl && assignedTargetEl.value) {
        const option = assignedTargetEl.options[assignedTargetEl.selectedIndex];
        if (option.dataset.role === 'sub_editor') {
            assigned_sub_editor_id = assignedTargetEl.value;
        } else if (option.dataset.role === 'editor') {
            final_assigned_editor_id = assignedTargetEl.value;
        }
    }

    if (!full_name || !username || !password || !role) {
        showToast(t('common.required'), 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = t('admin.creating');

    try {
        const data = await api('/admin/users', {
            method: 'POST',
            body: JSON.stringify({ 
                username, password, full_name, role, post, name_hi, name_en, district,
                assigned_editor_id: final_assigned_editor_id,
                assigned_sub_editor_id,
                is_api_enabled,
                print_designation
            })
        });

        if (data.error) {
            showToast(data.error, 'error');
        } else {
            showToast(t('admin.create_success'), 'success');
            hideCreateUserForm();
            document.getElementById('newUserFullName').value = '';
            document.getElementById('newUserUsername').value = '';
            document.getElementById('newUserPassword').value = '';
            document.getElementById('newUserRole').value = '';
            document.getElementById('newUserPost').value = '';
            document.getElementById('newUserNameHi').value = '';
            document.getElementById('newUserDynamicFields').innerHTML = '';
            loadUsers();
        }
    } catch (err) {
        showToast(t('common.error'), 'error');
    }

    btn.disabled = false;
    btn.textContent = t('admin.create_btn');
    applyLanguage();
}

function filterUsers(role) {
    adminUserFilter = role;
    document.querySelectorAll('.role-tab').forEach(tab => {
        tab.classList.toggle('active', false);
    });
    event.target.classList.add('active');
    loadUsers();
}

async function loadUsers() {
    const container = document.getElementById('usersList');
    try {
        const query = adminUserFilter === 'all' ? '' : `?role=${adminUserFilter}`;
        const data = await api(`/admin/users${query}`);
        const users = (data.users || []).filter(u => u.role !== 'admin');

        if (users.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👤</div>
                    <div class="empty-text" data-i18n="admin.no_users">${t('admin.no_users')}</div>
                </div>
            `;
            applyLanguage();
            return;
        }

        container.innerHTML = users.map(u => `
            <div class="user-list-item">
                <div class="user-avatar ${u.role}">${u.full_name.charAt(0).toUpperCase()}</div>
                <div class="user-info">
                    <div class="name">${escapeHtml(u.full_name)}${u.name_hi ? ` <span style="font-size:0.85em; color:var(--text-secondary); font-weight:normal;">(${escapeHtml(u.name_hi)})</span>` : ''}</div>
                    <div class="username">@${u.username} · ${u.role}${u.post ? ` · ${escapeHtml(u.post)}` : ''}</div>
                </div>
                <div class="user-status ${u.status}" title="${u.status}"></div>
                <div class="flex gap-sm mt-2">
                    <button class="btn btn-ghost btn-sm" onclick="editUserModal(${u.id}, '${escapeHtml(u.full_name)}', '${u.status}', '${escapeHtml(u.post || '')}', '${escapeHtml(u.name_hi || '')}', '${escapeHtml(u.name_en || '')}', '${escapeHtml(u.district || '')}', '${u.role}', ${u.is_api_enabled || 0}, '${escapeHtml(u.print_designation || '')}')">
                        ✏️
                    </button>
                    ${u.status === 'active'
                        ? `<button class="btn btn-ghost btn-sm" onclick="toggleUserStatus(${u.id}, 'inactive')" style="color:var(--accent-red);">🚫</button>`
                        : `<button class="btn btn-ghost btn-sm" onclick="toggleUserStatus(${u.id}, 'active')" style="color:var(--accent-green);">✅</button>`
                    }
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

function editUserModal(id, name, status, post = '', name_hi = '', name_en = '', district = '', role = '', is_api_enabled = 0, print_designation = '') {
    const html = `
        <div class="modal-overlay" id="articleModal" onclick="closeModalOutside(event)">
            <div class="modal-content" onclick="event.stopPropagation()" style="max-height:90vh; overflow-y:auto;">
                <div class="modal-handle"></div>
                <button class="modal-close" onclick="closeArticleModal()">✕</button>
                <div class="modal-body">
                    <h2 class="modal-headline" data-i18n="admin.edit_user">${t('admin.edit_user')}</h2>
                    <div class="form-group">
                        <label class="form-label" data-i18n="admin.full_name">${t('admin.full_name')}</label>
                        <input type="text" class="form-input" id="editUserName" value="${name}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Designation / Post</label>
                        <input type="text" class="form-input" id="editUserPost" value="${post}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Hindi Name</label>
                        <input type="text" class="form-input" id="editUserNameHi" value="${name_hi}">
                    </div>
                    ${role === 'sub_editor' ? `
                        <div class="form-group">
                            <label class="form-label">English Name</label>
                            <input type="text" class="form-input" id="editUserNameEn" value="${name_en}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">District / City</label>
                            <input type="text" class="form-input" id="editUserDistrict" value="${district}">
                        </div>
                    ` : ''}
                    ${(role === 'reporter' || role === 'sub_editor') ? `
                        <div class="form-group" style="margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 15px;">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                                <input type="checkbox" id="editUserIsApiEnabled" ${is_api_enabled ? 'checked' : ''} style="width:16px; height:16px;">
                                <strong>Enable API Newspaper Generation</strong>
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Print Designation (For Newspaper API)</label>
                            <input type="text" class="form-input" id="editUserPrintDesignation" value="${print_designation}">
                        </div>
                    ` : ''}
                    <div class="form-group">
                        <label class="form-label" data-i18n="admin.new_password">${t('admin.new_password')}</label>
                        <input type="password" class="form-input" id="editUserPassword" placeholder="****">
                    </div>
                    <div class="form-group" style="margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 15px;">
                        <label class="form-label">Profile Photo (Admin Upload)</label>
                        <input type="file" class="form-input" id="editUserAvatar" accept="image/*">
                        <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">Upload an image to set or update this user's profile photo.</p>
                    </div>
                    <button class="btn btn-primary btn-full mt-4" onclick="updateUser(${id}, '${role}')" data-i18n="admin.update_btn">${t('admin.update_btn')}</button>
                </div>
            </div>
        </div>
    `;
    closeArticleModal();
    document.body.insertAdjacentHTML('beforeend', html);
    document.body.style.overflow = ''; // Let modal scroll
    applyLanguage();
}

async function updateUser(id, role) {
    const full_name = document.getElementById('editUserName').value.trim();
    const password = document.getElementById('editUserPassword').value;
    const post = document.getElementById('editUserPost').value.trim();
    const name_hi = document.getElementById('editUserNameHi').value.trim();
    
    const nameEnEl = document.getElementById('editUserNameEn');
    const districtEl = document.getElementById('editUserDistrict');
    const isApiEnabledEl = document.getElementById('editUserIsApiEnabled');
    const printDesignationEl = document.getElementById('editUserPrintDesignation');

    const body = {};
    if (full_name) body.full_name = full_name;
    if (password) body.password = password;
    if (post !== undefined) body.post = post;
    if (name_hi !== undefined) body.name_hi = name_hi;
    if (nameEnEl) body.name_en = nameEnEl.value.trim();
    if (districtEl) body.district = districtEl.value.trim();
    if (isApiEnabledEl) body.is_api_enabled = isApiEnabledEl.checked ? 1 : 0;
    if (printDesignationEl) body.print_designation = printDesignationEl.value.trim();

    try {
        const data = await api(`/admin/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });

        if (data.error) {
            showToast(data.error, 'error');
            return;
        }

        const avatarInput = document.getElementById('editUserAvatar');
        if (avatarInput && avatarInput.files.length > 0) {
            const formData = new FormData();
            formData.append('avatar', avatarInput.files[0]);
            
            const avatarRes = await fetch(`/api/admin/users/${id}/avatar`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('nms_token') },
                body: formData
            });
            const avatarData = await avatarRes.json();
            if (avatarData.error) {
                showToast(avatarData.error, 'error');
            }
        }

        showToast(t('admin.update_success'), 'success');
        closeArticleModal();
        loadUsers();
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

async function toggleUserStatus(id, newStatus) {
    try {
        const data = await api(`/admin/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });

        if (data.error) {
            showToast(data.error, 'error');
        } else {
            showToast(t('admin.update_success'), 'success');
            loadUsers();
        }
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

// ============ SETTINGS TAB ============

async function renderAdminSettings() {
    const content = document.getElementById('adminContent');
    content.innerHTML = `
        <div class="page-header">
            <h2 data-i18n="admin.settings_title">${t('admin.settings_title')}</h2>
        </div>

        <div class="settings-section">
            <div class="settings-section-title" data-i18n="admin.ai_provider">${t('admin.ai_provider')}</div>
            <div class="form-group">
                <select class="form-input form-select" id="settingAiProvider">
                    <option value="gemini">Google Gemini</option>
                    <option value="deepseek">DeepSeek</option>
                </select>
            </div>
        </div>

        <div class="settings-section">
            <div class="settings-section-title" data-i18n="admin.gemini_key">${t('admin.gemini_key')}</div>
            <div class="form-group">
                <input type="password" class="form-input" id="settingGeminiKey"
                       data-i18n-placeholder="admin.gemini_key_placeholder" placeholder="${t('admin.gemini_key_placeholder')}">
            </div>
        </div>

        <div class="settings-section">
            <div class="settings-section-title">Gemini Model</div>
            <div class="form-group">
                <input type="text" class="form-input" id="settingGeminiModel"
                       placeholder="gemini-3.1-flash-lite">
            </div>
        </div>

        <div class="settings-section">
            <div class="settings-section-title" data-i18n="admin.deepseek_key">${t('admin.deepseek_key')}</div>
            <div class="form-group">
                <input type="password" class="form-input" id="settingDeepSeekKey"
                       data-i18n-placeholder="admin.deepseek_key_placeholder" placeholder="${t('admin.deepseek_key_placeholder')}">
            </div>
        </div>

        <div class="settings-section">
            <div class="settings-section-title" data-i18n="admin.ai_prompt">${t('admin.ai_prompt')}</div>
            <div class="form-group">
                <textarea class="form-input" id="settingAiPrompt" rows="5"></textarea>
            </div>
        </div>

        <button class="btn btn-primary btn-full" id="saveSettingsBtn" onclick="saveSettings()" data-i18n="admin.save_settings">${t('admin.save_settings')}</button>
    `;
    applyLanguage();
    loadSettings();
}

async function loadSettings() {
    try {
        const settings = await api('/admin/settings');
        if (settings.ai_provider) document.getElementById('settingAiProvider').value = settings.ai_provider;
        if (settings.gemini_api_key) document.getElementById('settingGeminiKey').placeholder = settings.gemini_api_key;
        if (settings.gemini_model) document.getElementById('settingGeminiModel').value = settings.gemini_model;
        if (settings.deepseek_api_key) document.getElementById('settingDeepSeekKey').placeholder = settings.deepseek_api_key;
        if (settings.ai_rewrite_prompt) document.getElementById('settingAiPrompt').value = settings.ai_rewrite_prompt;
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

async function saveSettings() {
    const btn = document.getElementById('saveSettingsBtn');
    btn.disabled = true;

    const body = {
        ai_provider: document.getElementById('settingAiProvider').value
    };

    const geminiKey = document.getElementById('settingGeminiKey').value;
    const geminiModel = document.getElementById('settingGeminiModel').value.trim();
    const deepseekKey = document.getElementById('settingDeepSeekKey').value;
    const prompt = document.getElementById('settingAiPrompt').value;

    if (geminiKey) body.gemini_api_key = geminiKey;
    if (geminiModel) body.gemini_model = geminiModel;
    if (deepseekKey) body.deepseek_api_key = deepseekKey;
    if (prompt) body.ai_rewrite_prompt = prompt;

    try {
        const data = await api('/admin/settings', {
            method: 'PUT',
            body: JSON.stringify(body)
        });

        if (data.error) {
            showToast(data.error, 'error');
        } else {
            showToast(t('admin.settings_saved'), 'success');
        }
    } catch (err) {
        showToast(t('common.error'), 'error');
    }

    btn.disabled = false;
}
