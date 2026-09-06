/* ============================================================
   LOGIN PAGE
   ============================================================ */

function renderLogin() {
    const lang = localStorage.getItem('nms_lang') || 'hi';

    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="login-container">
            <div class="login-logo">
                <img class="login-brand-logo-img" src="/images/logo-wide.png" alt="The Cliff News">
                <h1 style="display:none;">THE CLIFF NEWS</h1>
                <p class="brand-tagline-text" data-i18n="login.subtitle">${t('login.subtitle')}</p>
            </div>

            <div class="login-card">
                <div class="login-lang-toggle">
                    <div class="lang-toggle" onclick="toggleLanguage()">
                        <span class="lang-toggle-option ${lang === 'hi' ? 'active' : ''}" data-lang="hi">हिंदी</span>
                        <span class="lang-toggle-option ${lang === 'en' ? 'active' : ''}" data-lang="en">English</span>
                    </div>
                </div>

                <div class="login-error" id="loginError">
                    <span id="loginErrorText"></span>
                </div>

                <form id="loginForm" onsubmit="handleLogin(event)">
                    <div class="form-group">
                        <label class="form-label" data-i18n="login.username">${t('login.username')}</label>
                        <input type="text" class="form-input" id="loginUsername" required
                               data-i18n-placeholder="login.username_placeholder"
                               placeholder="${t('login.username_placeholder')}"
                               autocomplete="username" autocapitalize="none">
                    </div>

                    <div class="form-group">
                        <label class="form-label" data-i18n="login.password">${t('login.password')}</label>
                        <input type="password" class="form-input" id="loginPassword" required
                               data-i18n-placeholder="login.password_placeholder"
                               placeholder="${t('login.password_placeholder')}"
                               autocomplete="current-password">
                    </div>

                    <button type="submit" class="btn btn-primary btn-full" id="loginBtn" data-i18n="login.btn">
                        ${t('login.btn')}
                    </button>
                </form>
            </div>
        </div>
    `;

    applyLanguage();
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const errorDiv = document.getElementById('loginError');
    const errorText = document.getElementById('loginErrorText');

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) return;

    btn.disabled = true;
    btn.textContent = '...';
    errorDiv.classList.remove('show');

    try {
        const data = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (data.error) {
            errorText.textContent = data.error;
            errorDiv.classList.add('show');
            btn.disabled = false;
            btn.textContent = t('login.btn');
            return;
        }

        // Store auth data
        localStorage.setItem('nms_token', data.token);
        localStorage.setItem('nms_user', JSON.stringify(data.user));

        // Redirect to appropriate panel
        const roleRoutes = {
            admin: '#/admin',
            reporter: '#/reporter',
            editor: '#/editor',
            operator: '#/operator'
        };

        window.location.hash = roleRoutes[data.user.role] || '#/login';
    } catch (err) {
        errorText.textContent = t('common.error');
        errorDiv.classList.add('show');
        btn.disabled = false;
        btn.textContent = t('login.btn');
    }
}
