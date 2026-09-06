/**
 * Profile Page Module
 */

let currentProfile = {};

async function renderProfile() {
    const app = document.getElementById('app');

    app.innerHTML = `
        ${renderTopBar('profile.settings', '👤')}
        <main class="page-content">
            <div style="padding: 16px 8px;">
                <div class="page-header" style="margin-bottom: 24px;">
                    <h2 data-i18n="profile.title">${t('profile.title')}</h2>
                    <p class="subtitle" data-i18n="profile.subtitle">${t('profile.subtitle')}</p>
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 32px; max-width: 1000px;">
                    <!-- Left Column: Avatar & Basic Info -->
                    <div class="card" style="flex: 1 1 300px; text-align: center; display: flex; flex-direction: column; align-items: center; padding: 32px;">
                        <div style="position: relative; width: 160px; height: 160px; margin-bottom: 16px;">
                            <img id="profileAvatarPreview" src="" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 4px solid var(--accent-blue); background: var(--bg-hover); display: none;">
                            <div id="profileAvatarInitials" style="width: 100%; height: 100%; border-radius: 50%; background: var(--accent-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 4rem; font-weight: bold;">U</div>

                            <button type="button" onclick="document.getElementById('profileAvatarInput').click()" style="position: absolute; bottom: 0; right: 0; background: var(--accent-orange); color: white; border: none; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                📷
                            </button>
                        </div>
                        <input type="file" id="profileAvatarInput" style="display: none;" accept="image/*" onchange="handleProfileAvatarChange(this)">

                        <h3 id="profileDisplayName" style="margin-bottom: 8px;">User Name</h3>
                        <span id="profileRoleBadge" class="status-badge" style="background: rgba(37,99,235,0.1); color: var(--accent-blue); text-transform: uppercase;">ROLE</span>
                    </div>

                    <!-- Right Column: Settings Form -->
                    <div class="card" style="flex: 2 1 500px;">
                        <form id="profileForm" onsubmit="saveProfile(event)" style="display: flex; flex-direction: column; gap: 20px;">

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                                <div class="form-group">
                                    <label data-i18n="profile.full_name">${t('profile.full_name')}</label>
                                    <input type="text" id="prof_full_name" class="form-input">
                                </div>
                                <div class="form-group">
                                    <label data-i18n="profile.post">${t('profile.post')}</label>
                                    <input type="text" id="prof_post" class="form-input" placeholder="e.g. Senior Reporter">
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                                <div class="form-group">
                                    <label data-i18n="profile.name_hi">${t('profile.name_hi')}</label>
                                    <input type="text" id="prof_name_hi" class="form-input">
                                </div>
                                <div class="form-group">
                                    <label data-i18n="profile.name_en">${t('profile.name_en')}</label>
                                    <input type="text" id="prof_name_en" class="form-input">
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                                <div class="form-group">
                                    <label data-i18n="profile.email">${t('profile.email')}</label>
                                    <input type="email" id="prof_email" class="form-input" placeholder="user@example.com">
                                </div>
                                <div class="form-group">
                                    <label data-i18n="profile.phone">${t('profile.phone')}</label>
                                    <input type="tel" id="prof_phone" class="form-input" placeholder="+91 9999999999">
                                </div>
                            </div>

                            <div class="form-group">
                                <label data-i18n="profile.city">${t('profile.city')}</label>
                                <input type="text" id="prof_city" class="form-input" placeholder="City / District">
                            </div>

                            <div style="margin-top: 16px; display: flex; gap: 12px; justify-content: flex-end;">
                                <button type="button" class="btn btn-secondary" onclick="history.back()">← वापस</button>
                                <button type="submit" id="profSaveBtn" class="btn btn-primary" style="min-width: 150px;">
                                    <span data-i18n="profile.save">${t('profile.save')}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </main>
    `;

    applyLanguage();
    await loadProfileData();
    setupTransliteration();
}

async function loadProfileData() {
    try {
        const res = await api('/profile');
        if (res.success && res.profile) {
            currentProfile = res.profile;

            document.getElementById('profileDisplayName').textContent = currentProfile.full_name || currentProfile.username;
            document.getElementById('profileRoleBadge').textContent = currentProfile.role || 'user';

            if (currentProfile.avatar_path) {
                document.getElementById('profileAvatarPreview').src = currentProfile.avatar_path;
                document.getElementById('profileAvatarPreview').style.display = 'block';
                document.getElementById('profileAvatarInitials').style.display = 'none';
            } else {
                document.getElementById('profileAvatarInitials').textContent = (currentProfile.full_name || currentProfile.username || 'U').charAt(0).toUpperCase();
                document.getElementById('profileAvatarInitials').style.display = 'flex';
                document.getElementById('profileAvatarPreview').style.display = 'none';
            }

            document.getElementById('prof_full_name').value = currentProfile.full_name || '';
            document.getElementById('prof_post').value = currentProfile.post || '';
            document.getElementById('prof_name_hi').value = currentProfile.name_hi || '';
            document.getElementById('prof_name_en').value = currentProfile.name_en || '';
            document.getElementById('prof_email').value = currentProfile.email || '';
            document.getElementById('prof_phone').value = currentProfile.phone || '';
            document.getElementById('prof_city').value = currentProfile.city || '';
        }
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

function handleProfileAvatarChange(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profileAvatarPreview').src = e.target.result;
            document.getElementById('profileAvatarPreview').style.display = 'block';
            document.getElementById('profileAvatarInitials').style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

let transliterationTimer = null;
async function setupTransliteration() {
    const inputHi = document.getElementById('prof_name_hi');
    if (!inputHi) return;
    
    inputHi.addEventListener('keyup', async (e) => {
        if (e.key === ' ' || e.code === 'Space') {
            const val = inputHi.value;
            const words = val.split(' ');
            if (words.length > 1) {
                const lastWord = words[words.length - 2];
                // Check if it's english text (a-z)
                if (/^[a-zA-Z]+$/.test(lastWord)) {
                    try {
                        const res = await fetch('/api/transliterate?text=' + encodeURIComponent(lastWord));
                        const data = await res.json();
                        if (data[0] === 'SUCCESS') {
                            const hindiWord = data[1][0][1][0];
                            words[words.length - 2] = hindiWord;
                            inputHi.value = words.join(' ');
                        }
                    } catch (e) {
                        console.error('Transliteration failed', e);
                    }
                }
            }
        }
    });
}

async function saveProfile(e) {
    e.preventDefault();

    const btn = document.getElementById('profSaveBtn');
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span>${t('profile.saving')}</span>`;

    const formData = new FormData();
    formData.append('full_name', document.getElementById('prof_full_name').value.trim());
    formData.append('post', document.getElementById('prof_post').value.trim());
    formData.append('name_hi', document.getElementById('prof_name_hi').value.trim());
    formData.append('name_en', document.getElementById('prof_name_en').value.trim());
    formData.append('email', document.getElementById('prof_email').value.trim());
    formData.append('phone', document.getElementById('prof_phone').value.trim());
    formData.append('city', document.getElementById('prof_city').value.trim());

    const avatarInput = document.getElementById('profileAvatarInput');
    if (avatarInput.files && avatarInput.files[0]) {
        formData.append('avatar', avatarInput.files[0]);
    }

    try {
        const res = await api('/profile', {
            method: 'PUT',
            body: formData,
            isFormData: true
        });

        if (res.error) {
            showToast(res.error, 'error');
        } else {
            showToast(t('profile.success'), 'success');
            if (res.profile) {
                localStorage.setItem('nms_user', JSON.stringify(res.profile));
                setTimeout(() => window.location.reload(), 1000);
            }
        }
    } catch (err) {
        showToast(t('common.error'), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
