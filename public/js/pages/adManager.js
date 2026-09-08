/* ============================================================
   AD MANAGER PAGE
   ============================================================ */

function renderAdManager() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('navbar.role_ad_manager', 'dollar-sign')}
        <main class="page-content">
            <div class="split-pane-header" style="padding: 12px 16px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <h3 style="margin: 0;">स्वीकृत विज्ञापन (Approved Ads)</h3>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="loadAdManagerAds()">
                    ${icon('refresh', 14)} ताज़ा करें
                </button>
            </div>
            <div id="adManagerList" style="padding: 0 8px;">
                <div class="loading-spinner" style="margin:40px auto;"></div>
            </div>
        </main>
        ${renderBottomNav('ad_manager', 'ads')}
    `;
    applyLanguage();
    loadAdManagerAds();
}

function switchAdManagerPane(pane) {
    // Only one pane right now
    if (pane === 'ads') {
        renderAdManager();
    }
}

async function loadAdManagerAds() {
    const container = document.getElementById('adManagerList');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner" style="margin:40px auto;"></div>';
    
    try {
        const data = await api('/advertisements/manager/list');
        const ads = data.ads || [];

        if (ads.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-svg">${icon('dollar-sign', 40)}</div>
                    <div class="empty-text">कोई स्वीकृत विज्ञापन नहीं</div>
                </div>
            `;
            return;
        }

        container.innerHTML = ads.map(a => `
            <div class="card ad-card">
                <div class="news-card-header">
                    <div class="news-card-info">
                        <div class="news-card-headline">
                            <span style="color:var(--accent-orange);margin-right:6px;">#${a.id}</span>
                            ${a.ad_type === 'website' ? 'Website Ad' : 'Print Edition Ad'}
                        </div>
                        <div class="news-card-body">
                            <strong>Size:</strong> ${escapeHtml(a.size || 'N/A')} | 
                            <strong>Price:</strong> ${escapeHtml(a.price || 'N/A')}
                        </div>
                    </div>
                </div>
                <div class="news-card-meta">
                    <span class="status-badge approved">Approved</span>
                    <span class="news-card-meta-item">${icon('clock',12)} ${formatDate(a.created_at)}</span>
                </div>
                <div class="news-card-actions-row">
                    <a href="${a.file_path}" target="_blank" class="btn btn-primary btn-sm">
                        ${icon('eye', 14)} फाइल देखें (View File)
                    </a>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}
