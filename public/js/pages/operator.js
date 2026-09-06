/* ============================================================
   OPERATOR PAGE — View forwarded news, copy text, download images
   ============================================================ */

function renderOperator() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('operator.title', null, 'clipboard')}
        <main class="page-content">
            <div class="page-header">
                <h2 data-i18n="operator.title">${t('operator.title')}</h2>
                <p data-i18n="operator.subtitle">${t('operator.subtitle')}</p>
            </div>
            <div id="operatorNewsList">
                <div class="loading-spinner" style="margin:40px auto;"></div>
            </div>
        </main>
        ${renderBottomNav('operator', 'news')}
    `;
    applyLanguage();
    loadOperatorNews();
}

async function loadOperatorNews() {
    const container = document.getElementById('operatorNewsList');
    try {
        const data = await api('/operator/news');
        const news = data.news || [];

        if (news.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-svg">${icon('inbox', 40)}</div>
                    <div class="empty-text" data-i18n="operator.no_news">${t('operator.no_news')}</div>
                </div>
            `;
            applyLanguage();
            return;
        }

        container.innerHTML = news.map(n => {
            const hasCopies = n.copies && n.copies.length > 0;
            const lastCopy = hasCopies ? n.copies[0] : null;
            const cardClass = hasCopies ? 'card news-card greyed-out' : 'card news-card';
            const hasImages = n.image_count > 0;

            return `
                <div class="${cardClass}" onclick="openOperatorNewsDetail(${n.id})">
                    <div class="news-card-header">
                        ${n.image_path
                            ? `<img class="news-card-thumb" src="${n.image_path}" alt="" onerror="this.style.display='none'">`
                            : `<div class="news-card-thumb-placeholder">${icon('newspaper', 22)}</div>`
                        }
                        <div class="news-card-info">
                            <div class="news-card-headline"><span style="color:var(--accent-orange);margin-right:6px;">#${n.id}</span>${escapeHtml(n.headline)}</div>
                            <div class="news-card-body">${escapeHtml(n.body)}</div>
                        </div>
                    </div>
                    <div class="news-card-meta">
                        <span class="status-badge forwarded">${t('editor.status_forwarded')}</span>
                        <span class="news-card-meta-item">${icon('folder', 12)} ${n.category}</span>
                        ${n.city ? `<span class="news-card-meta-item">${icon('pin', 12)} ${n.city}</span>` : ''}
                        <span class="news-card-meta-item">${icon('clock', 12)} ${formatDate(n.forwarded_at)}</span>
                        ${hasImages ? `<span class="news-card-meta-item">${icon('photos', 12)} ${n.image_count} photos</span>` : ''}
                    </div>
                    ${hasCopies ? `
                        <div class="copied-badge">
                            ${icon('clipboard', 10)} ${t('operator.copied_by')} ${lastCopy.operator_name}
                        </div>
                    ` : ''}
                    <div class="news-card-actions-row">
                        <button class="btn btn-primary btn-xs" onclick="event.stopPropagation(); quickCopyText(${n.id})">
                            ${icon('clipboard', 12)} ${t('operator.quick_copy_text')}
                        </button>
                        <button class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); quickCopyHeadline(${n.id})">
                            ${icon('pen', 12)} ${t('operator.quick_copy_headline')}
                        </button>
                        ${hasImages ? `
                            <button class="btn btn-amber btn-xs" onclick="event.stopPropagation(); downloadNewsImagesZip(${n.id})">
                                ${icon('archive', 12)} ZIP
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        applyLanguage();
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

async function openOperatorNewsDetail(id) {
    try {
        const news = await api(`/operator/news/${id}`);
        if (news.error) { showToast(news.error, 'error'); return; }

        const hasImages = news.images && news.images.length > 0;

        const actionsHtml = `
            <button class="btn btn-primary" onclick="copyNewsText(${id})">
                ${icon('clipboard', 14)} <span data-i18n="operator.copy_text">${t('operator.copy_text')}</span>
            </button>
            <button class="btn btn-secondary" onclick="copyHeadline(${id})">
                ${icon('pen', 14)} <span data-i18n="operator.copy_headline">${t('operator.copy_headline')}</span>
            </button>
            ${news.image_path ? `
                <button class="btn btn-amber" onclick="downloadSelectedImage(${id})">
                    ${icon('download', 14)} <span data-i18n="operator.download_image">${t('operator.download_image')}</span>
                </button>
            ` : ''}
            ${hasImages && news.images.length > 1 ? `
                <button class="btn btn-secondary" onclick="downloadNewsImagesZip(${id})">
                    ${icon('archive', 14)} Download All (ZIP)
                </button>
            ` : ''}
        `;

        // Store news data for copy operations
        window._currentOperatorNews = news;

        let copiesHtml = '';
        if (news.copies && news.copies.length > 0) {
            copiesHtml = news.copies.map(c =>
                `<div class="copied-badge">${icon('clipboard', 10)} ${t('operator.copied_by')} ${c.operator_name} · ${formatDate(c.copied_at)}</div>`
            ).join('');
        }

        // Image gallery for operator
        let galleryHtml = '';
        if (hasImages) {
            galleryHtml = `
                <div class="operator-image-gallery">
                    <div class="operator-gallery-label">${icon('photos', 14)} Images (${news.images.length})</div>
                    <div class="operator-gallery-grid">
                        ${news.images.map((img, idx) => `
                            <div class="operator-gallery-tile ${img.is_selected ? 'selected' : ''}">
                                <img src="${img.image_path}" alt="Image ${idx + 1}" onclick="openImageFullscreen('${img.image_path}')">
                                ${img.is_selected ? `<div class="operator-img-badge">${icon('star', 9)} Cover</div>` : ''}
                                <button class="operator-img-download-btn" onclick="downloadSingleImage('${img.image_path}', ${idx + 1})" title="Download">
                                    ${icon('download', 12)}
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    ${news.images.length > 1 ? `
                        <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:10px;" onclick="downloadNewsImagesZip(${id})">
                            ${icon('archive', 14)} Download All Images (ZIP)
                        </button>
                    ` : ''}
                </div>
            `;
        }

        showArticleModal({
            headline: news.headline,
            body: news.body,
            extraHtml: copiesHtml + galleryHtml,
            image_path: news.image_path,
            category: news.category,
            city: news.city,
            reporter_name: news.reporter_name,
            actionsHtml
        });
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

/* ── Copy operations ─────────────────────────────────────── */

async function copyNewsText(id) {
    const news = window._currentOperatorNews;
    if (!news) return;

    const textToCopy = `${news.headline}\n\n${news.body}`;

    try {
        await navigator.clipboard.writeText(textToCopy);
    } catch {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    await api(`/operator/news/${id}/copy`, { method: 'POST', body: JSON.stringify({}) });
    showToast(t('operator.copy_success'), 'success');
    closeArticleModal();
    loadOperatorNews();
}

async function quickCopyText(id) {
    try {
        const news = await api(`/operator/news/${id}`);
        if (news.error) { showToast(news.error, 'error'); return; }
        const textToCopy = `${news.headline}\n\n${news.body}`;
        try {
            await navigator.clipboard.writeText(textToCopy);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = textToCopy;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        await api(`/operator/news/${id}/copy`, { method: 'POST', body: JSON.stringify({}) });
        showToast(t('operator.copy_success'), 'success');
        loadOperatorNews();
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

async function quickCopyHeadline(id) {
    try {
        const news = await api(`/operator/news/${id}`);
        if (news.error) { showToast(news.error, 'error'); return; }
        try {
            await navigator.clipboard.writeText(news.headline);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = news.headline;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        await api(`/operator/news/${id}/copy`, { method: 'POST', body: JSON.stringify({}) });
        showToast(t('operator.copied'), 'success');
        loadOperatorNews();
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

async function copyHeadline(id) {
    const news = window._currentOperatorNews;
    if (!news) return;
    try {
        await navigator.clipboard.writeText(news.headline);
        showToast(t('operator.copied'), 'success');
    } catch (err) {
        const textarea = document.createElement('textarea');
        textarea.value = news.headline;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast(t('operator.copied'), 'success');
    }
}

/* ── Image download operations ───────────────────────────── */

/**
 * Download the selected (cover) image for a news item
 */
function downloadSelectedImage(id) {
    const news = window._currentOperatorNews;
    const imgPath = (news && news.image_path) ? news.image_path : null;
    if (!imgPath) return;
    triggerDownload(imgPath, `news-${id}-cover.jpg`);
    showToast('Downloading cover image...', 'info');
}

/**
 * Download a single image by path
 */
function downloadSingleImage(imagePath, idx) {
    const ext = imagePath.split('.').pop() || 'jpg';
    triggerDownload(imagePath, `image-${idx}.${ext}`);
    showToast('Downloading image...', 'info');
}

/**
 * Download all images for a news item as a ZIP
 */
function downloadNewsImagesZip(id) {
    const token = localStorage.getItem('nms_token');
    // Create a link with the auth token as a query param since ZIP is streamed
    const a = document.createElement('a');
    a.href = `/api/operator/news/${id}/images/zip?token=${encodeURIComponent(token || '')}`;
    a.download = `news-${id}-images.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Preparing ZIP download...', 'info');
}

function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Open an image in a fullscreen overlay
 */
function openImageFullscreen(src) {
    const existing = document.getElementById('imageFullscreenOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'imageFullscreenOverlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.92);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999; cursor: zoom-out;
    `;
    overlay.innerHTML = `
        <img src="${src}" style="max-width:95vw;max-height:92vh;border-radius:8px;box-shadow:0 0 60px rgba(0,0,0,0.8);">
        <button onclick="this.closest('#imageFullscreenOverlay').remove()" style="
            position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.15);
            border:none;color:white;width:36px;height:36px;border-radius:50%;
            cursor:pointer;display:flex;align-items:center;justify-content:center;
            backdrop-filter:blur(4px);
        ">${icon('x', 16)}</button>
    `;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

// Legacy download function (kept for backward compat)
function downloadImage(id) {
    downloadSelectedImage(id);
}
