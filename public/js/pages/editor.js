/* ============================================================
   EDITOR PAGE — Split screen: Raw News | Processed News
   ============================================================ */

let editorTab = 'raw';
let _rawNewsData = [];
let _rawNewsReporterFilter = '';
let _rawPage = 1;
let _hasMoreRaw = true;
let _publishedNewsData = [];
let _publishedPage = 1;
let _hasMorePublished = true;

function onRawReporterFilterChange(val) {
    _rawNewsReporterFilter = val;
    renderRawNewsCards();
}

function renderEditor() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('editor.title', null, 'pen')}
        <main class="page-content">
            <div class="split-tabs">
                <div class="split-tab active" data-tab="raw" onclick="switchEditorPane('raw')">
                    <span data-i18n="editor.raw_tab">${t('editor.raw_tab')}</span>
                    <span class="tab-count" id="rawCount">0</span>
                </div>
                <div class="split-tab" data-tab="processed" onclick="switchEditorPane('processed')">
                    <span data-i18n="editor.processed_tab">${t('editor.processed_tab')}</span>
                    <span class="tab-count" id="processedCount">0</span>
                </div>
            </div>

            <div class="split-screen">
                <div class="split-pane active" id="rawPane">
                    <div class="split-pane-header">
                        <h3 data-i18n="editor.raw_title">${t('editor.raw_title')}</h3>
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div id="rawNewsFilterContainer"></div>
                            <span class="pane-count" id="rawPaneCount">0</span>
                        </div>
                    </div>
                    <div id="rawNewsList">
                        <div class="loading-spinner" style="margin:40px auto;"></div>
                    </div>
                </div>

                <div class="split-pane" id="processedPane">
                    <div class="split-pane-header">
                        <h3 data-i18n="editor.processed_title">${t('editor.processed_title')}</h3>
                        <span class="pane-count" id="processedPaneCount">0</span>
                    </div>
                    <div id="processedNewsList">
                        <div class="loading-spinner" style="margin:40px auto;"></div>
                    </div>
                </div>
            </div>
        </main>
        ${renderBottomNav('editor', editorTab)}
    `;

    applyLanguage();
    loadRawNews();
    loadProcessedNews();
}

function switchEditorPane(pane) {
    editorTab = pane;

    // Forwarded and Published open as full-screen views
    if (pane === 'forwarded') {
        renderEditorForwardedScreen();
        return;
    }
    if (pane === 'published') {
        renderEditorPublishedScreen();
        return;
    }

    if (!document.getElementById(pane + 'Pane')) {
        renderEditor();
    }

    document.querySelectorAll('.split-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === pane);
    });
    document.querySelectorAll('.split-pane').forEach(p => {
        p.classList.toggle('active', p.id === pane + 'Pane');
    });
    // Update bottom nav
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === pane);
    });
}

/**
 * Full-screen view for Rejected News — opened from bottom nav
 */
function renderEditorForwardedScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('editor.title', null, 'pen')}
        <main class="page-content">
            <div class="split-pane-header" style="padding: 12px 16px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="btn btn-secondary btn-sm" onclick="editorTab='raw'; renderEditor();">← ${t('common.back') || 'वापस'}</button>
                    <h3 style="margin: 0;">❌ रिजेक्टेड खबरें (48h)</h3>
                </div>
                <span class="pane-count" id="forwardedPaneCount">0</span>
            </div>
            <div id="forwardedNewsList" style="padding: 0 8px;">
                <div class="loading-spinner" style="margin:40px auto;"></div>
            </div>
        </main>
        ${renderBottomNav('editor', 'forwarded')}
    `;
    const forwardedHeading = app.querySelector('.split-pane-header h3');
    if (forwardedHeading) {
        forwardedHeading.dataset.i18n = 'editor.forwarded_tab';
        forwardedHeading.textContent = t('editor.forwarded_tab');
    }
    applyLanguage();
    loadForwardedNews();
}

/**
 * Full-screen view for Published News — opened from bottom nav
 */
function renderEditorPublishedScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('editor.title', '✏️')}
        <main class="page-content">
            <div class="split-pane-header" style="padding: 12px 16px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="btn btn-secondary btn-sm" onclick="editorTab='raw'; renderEditor();">← ${t('common.back') || 'वापस'}</button>
                    <h3 style="margin: 0;">📰 प्रकाशित खबरें</h3>
                </div>
                <span class="pane-count" id="publishedPaneCount">0</span>
            </div>
            <div id="publishedNewsList" style="padding: 0 8px;">
                <div class="loading-spinner" style="margin:40px auto;"></div>
            </div>
        </main>
        ${renderBottomNav('editor', 'published')}
    `;
    applyLanguage();
    loadPublishedNews();
}

async function loadRawNews(append = false) {
    if (!append) _rawPage = 1;
    const container = document.getElementById('rawNewsList');
    try {
        const data = await api(`/editor/news/raw?page=${_rawPage}`);
        const news = data.news || [];
        
        // The raw endpoint returns the complete short-retention history. This
        // prevents processed raw articles being hidden on a later page.
        _hasMoreRaw = false;

        if (append) {
            _rawNewsData = [..._rawNewsData, ...news];
        } else {
            _rawNewsData = news;
        }

        // Update counts (approximate if paginated)
        // Processed articles remain visible here for history, but the raw count
        // should represent work that is still awaiting processing.
        const pendingRawCount = _rawNewsData.filter(item => item.status === 'raw').length;
        const countEls = ['rawCount', 'rawPaneCount'];
        countEls.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = pendingRawCount + (_hasMoreRaw ? '+' : '');
        });

        // Populate reporter filter from all reporters
        let allReporters = [];
        try {
            const repData = await api('/editor/reporters');
            if (!repData.error) allReporters = repData.reporters;
        } catch (e) {
            console.error('Failed to fetch reporters', e);
        }
        
        const filterContainer = document.getElementById('rawNewsFilterContainer');
        if (filterContainer) {
            filterContainer.innerHTML = `
                <select class="form-input form-select" style="max-width: 150px; padding: 4px 8px; font-size: 0.85rem;" onchange="onRawReporterFilterChange(this.value)">
                    <option value="" data-i18n="common.all_reporters">${t('common.all_reporters') || 'सभी रिपोर्टर'}</option>
                    ${allReporters.map(r => `<option value="${escapeHtml(r.name)}" ${r.name === _rawNewsReporterFilter ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
                </select>
            `;
        }

        renderRawNewsCards();
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

function renderRawNewsCards() {
    const container = document.getElementById('rawNewsList');
    if (!container) return;

    let filteredNews = _rawNewsData;
    if (_rawNewsReporterFilter) {
        filteredNews = _rawNewsData.filter(n => n.reporter_name === _rawNewsReporterFilter);
    }

    if (filteredNews.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon-svg">${icon('inbox', 40)}</div>
                <div class="empty-text" data-i18n="editor.no_raw">${t('editor.no_raw')}</div>
            </div>
        `;
        applyLanguage();
        return;
    }

    container.innerHTML = filteredNews.map(n => {
        const isProcessed = n.status === 'processed';
        return `
        <div class="card news-card ${isProcessed ? 'greyed-out' : ''}" onclick="${isProcessed ? `openProcessedNewsDetail(${n.id})` : `openRawNewsDetail(${n.id})`}">
            <div class="news-card-header">
                ${n.image_path
                    ? `<img class="news-card-thumb" src="${n.image_path}" alt="" onerror="this.className='news-card-thumb-placeholder';this.innerHTML='📰'">`
                    : `<div class="news-card-thumb-placeholder">📰</div>`
                }
                <div class="news-card-info">
                    <div class="news-card-headline"><span style="color:var(--accent-orange);margin-right:6px;">#${n.id}</span>${escapeHtml(n.headline)}</div>
                    <div class="news-card-body">${escapeHtml(n.body)}</div>
                </div>
            </div>
            <div class="news-card-meta">
                <span class="status-badge ${isProcessed ? 'processed' : 'raw'}">${isProcessed ? t('editor.status_processed') : (n.headline_rewritten ? `${icon('bot',10)} ${t('editor.status_ai_done')}` : t('editor.status_raw'))}</span>
                <span class="news-card-meta-item">${icon('folder',12)} ${n.category}</span>
                ${n.city ? `<span class="news-card-meta-item">${icon('pin',12)} ${n.city}</span>` : ''}
                <span class="news-card-meta-item">${icon('user',12)} ${n.reporter_name}</span>
                <span class="news-card-meta-item">${icon('clock',12)} ${formatDate(n.created_at)}</span>
            </div>
            <div class="news-card-actions-row">
                ${isProcessed ? `
                <button class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); openProcessedNewsDetail(${n.id})">
                    ${icon('eye',12)} पूरी खबर पढ़ें
                </button>
                ` : `
                <button class="btn btn-primary btn-xs" onclick="event.stopPropagation(); triggerRewrite(${n.id}, { language: 'hi', numSubheadings: 3, captionWords: 30, targetWords: 400 }, this)">
                    ${icon('bot',12)} ${t('editor.rewrite_hindi_btn')}
                </button>
                <button class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); triggerRewrite(${n.id}, { language: 'en', numSubheadings: 3, captionWords: 30, targetWords: 400 }, this)">
                    ${icon('globe',12)} ${t('editor.english_btn')}
                </button>
                <button class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); showCustomRewriteModal(${n.id})">
                    ${icon('gear',12)} ${t('editor.rewrite_custom_btn')}
                </button>
                <button class="btn btn-danger btn-xs" onclick="event.stopPropagation(); promptRejectNews(${n.id})">
                    ${icon('x',12)} ${t('editor.reject_btn')}
                </button>
                ${n.headline_rewritten ? `
                    <button class="btn btn-success btn-xs" onclick="event.stopPropagation(); quickApproveNews(${n.id})">
                        ${icon('check',12)} ${t('editor.approve_btn')}
                    </button>
                ` : ''}
                `}
                <button class="btn btn-danger btn-xs" onclick="event.stopPropagation(); deleteNews(${n.id}, 'raw')">
                    ${icon('trash',12)} डिलीट करें
                </button>
            </div>
        </div>
    `}).join('');

    if (_hasMoreRaw) {
        container.innerHTML += `
            <div style="text-align: center; margin: 20px 0;">
                <button class="btn btn-secondary" onclick="_rawPage++; loadRawNews(true)">
                    ${icon('refresh', 14)} और लोड करें (Load More)
                </button>
            </div>
        `;
    }
}

async function loadProcessedNews() {
    const container = document.getElementById('processedNewsList');
    try {
        const data = await api('/editor/news/processed');
        const news = data.news || [];

        const countEls = ['processedCount', 'processedPaneCount'];
        countEls.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = news.length;
        });

        if (news.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-svg">${icon('inbox', 40)}</div>
                    <div class="empty-text" data-i18n="editor.no_processed">${t('editor.no_processed')}</div>
                </div>
            `;
            applyLanguage();
            return;
        }

        container.innerHTML = news.map(n => `
            <div class="card news-card" onclick="openProcessedNewsDetail(${n.id})">
                <div class="news-card-header">
                    ${n.image_path
                        ? `<img class="news-card-thumb" src="${n.image_path}" alt="" onerror="this.className='news-card-thumb-placeholder';this.innerHTML='📰'">`
                        : `<div class="news-card-thumb-placeholder">📰</div>`
                    }
                    <div class="news-card-info">
                        <div class="news-card-headline"><span style="color:var(--accent-orange);margin-right:6px;">#${n.id}</span>${escapeHtml(n.headline_rewritten || n.headline)}</div>
                        <div class="news-card-body">${escapeHtml(n.body_rewritten)}</div>
                    </div>
                </div>
                <div class="news-card-meta">
                    <span class="status-badge processed">${t('editor.status_processed')}</span>
                    ${n.ai_provider ? `<span class="news-card-meta-item">${icon('bot',12)} ${n.ai_provider}</span>` : ''}
                    <span class="news-card-meta-item">${icon('folder',12)} ${n.category}</span>
                    <span class="news-card-meta-item">${icon('clock',12)} ${formatDate(n.processed_at)}</span>
                </div>
                <div class="news-card-actions-row">
                    <button class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); openProcessedNewsDetail(${n.id})">
                        ${icon('eye',12)} पूरी खबर पढ़ें
                    </button>
                    <button class="btn btn-primary btn-xs" onclick="event.stopPropagation(); quickForwardNews(${n.id})">
                        ${icon('send',12)} ${t('editor.forward_card_btn')}
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

async function openRawNewsDetail(id) {
    try {
        const news = await api(`/editor/news/${id}`);
        if (news.error) { showToast(news.error, 'error'); return; }

        const hasRewrite = news.headline_rewritten && news.body_rewritten;

        const actionsHtml = `
            <button class="btn btn-primary btn-sm" onclick="triggerRewrite(${id}, { language: 'hi', numSubheadings: 3, captionWords: 30, targetWords: 400 })">
                ${icon('bot',14)} ${t('editor.rewrite_hindi_btn')}
            </button>
            <button class="btn btn-secondary btn-sm" onclick="triggerRewrite(${id}, { language: 'en', numSubheadings: 3, captionWords: 30, targetWords: 400 })">
                ${icon('globe',14)} ${t('editor.rewrite_english_btn')}
            </button>
            <button class="btn btn-secondary btn-sm" onclick="showCustomRewriteModal(${id})">
                ${icon('gear',14)} ${t('editor.rewrite_custom_btn')}
            </button>
            <button class="btn btn-danger btn-sm" onclick="promptRejectNews(${id})">
                ${icon('x',14)} रिजेक्ट करें
            </button>
            ${hasRewrite ? `
                <button class="btn btn-secondary btn-sm" onclick="saveProcessedNewsEdits(${id})">
                    ${icon('check',14)} Save Edit
                </button>
                <button class="btn btn-success btn-sm" onclick="approveNews(${id})">
                    ${icon('check',14)} ${t('editor.approve_btn')}
                </button>
            ` : ''}
        `;

        // Build editor image picker if multiple images available
        let extraHtml = '';
        if (news.images && news.images.length > 1) {
            extraHtml += `
                <div class="editor-image-picker">
                    <div class="editor-image-picker-label">${icon('photos', 14)} Choose cover image (${news.images.length} photos)</div>
                    <div class="editor-image-grid" id="editorImageGrid-${id}">
                        ${news.images.map(img => `
                            <div class="editor-img-tile ${img.is_selected ? 'selected' : ''}" onclick="selectEditorImage(${id}, ${img.id}, this)">
                                <img src="${img.image_path}" alt="">
                                ${img.is_selected ? `<div class="editor-img-selected-badge">${icon('check', 10)} Cover</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        if (hasRewrite) {
            extraHtml += `
                <div class="processed-review-block">
                    <div class="processed-review-label">${icon('bot', 14)} ${t('editor.rewritten')}</div>
                    <h2 class="processed-edit-headline editable-news-field" contenteditable="true" spellcheck="true" data-placeholder="Edit headline">${escapeHtml(news.headline_rewritten)}</h2>
                    <div class="processed-edit-body editable-news-field" contenteditable="true" spellcheck="true" data-placeholder="Edit article text">${escapeHtml(news.body_rewritten)}</div>
                </div>
                <div class="raw-compare-label">${t('editor.raw_title')}</div>
            `;
        }

        showArticleModal({
            headline: news.headline,
            body: news.body,
            image_path: news.selected_image_path || news.image_path,
            category: news.category,
            city: news.city,
            reporter_name: news.reporter_name,
            created_at: news.created_at,
            extraHtml,
            actionsHtml
        });
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

async function openProcessedNewsDetail(id) {
    try {
        const news = await api(`/editor/news/${id}`);
        if (news.error) { showToast(news.error, 'error'); return; }

        // Keep the reporter's original Kacchi Khabar visible beside the final
        // rewrite. The rewrite is stored separately and never replaces it.
        let extraHtml = `
            <div class="raw-source-review">
                <div class="raw-compare-label">${t('editor.raw_title')}</div>
                <h3>${escapeHtml(news.headline)}</h3>
                <div class="raw-source-review-body">${escapeHtml(news.body)}</div>
            </div>
        `;
        if (news.images && news.images.length > 0) {
            extraHtml += `
                <div class="editor-image-picker" style="margin-top:24px; padding-top:16px; border-top:1px solid var(--border-color);">
                    <div class="editor-image-picker-label" style="font-size:0.9rem; font-weight:600; color:var(--text-secondary); margin-bottom:12px;">${icon('photos', 14)} Cover Image Selection (${news.images.length})</div>
                    <div class="editor-image-grid" id="editorImageGrid-${id}" style="display:flex; flex-wrap:wrap; gap:12px;">
                        ${news.images.map(img => `
                            <div class="editor-img-tile ${img.is_selected ? 'selected' : ''}" onclick="selectEditorImage(${id}, ${img.id}, this)" style="cursor:pointer; position:relative; width:100px; height:100px; border-radius:8px; overflow:hidden; border:2px solid ${img.is_selected ? 'var(--accent-blue)' : 'transparent'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                <img src="${img.image_path}" style="width:100%; height:100%; object-fit:cover;">
                                ${img.is_selected ? `<div class="editor-img-selected-badge" style="position:absolute; bottom:0; left:0; right:0; background:var(--accent-blue); color:white; font-size:10px; text-align:center; padding:2px;">${icon('check', 10)} Cover</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        const actionsHtml = news.status === 'raw' ? `
            <button class="btn btn-success" style="flex:1;" onclick="approveNews(${id})">
                ${icon('check', 14)} ${t('editor.approve_btn')}
            </button>
        ` : `
            <button class="btn btn-secondary" style="flex:1;" onclick="saveProcessedNewsEdits(${id})">
                ${icon('check', 14)} Save Edit
            </button>
            <button class="btn btn-primary" style="flex:1;" onclick="forwardEditedNews(${id})">
                ${icon('send', 14)} ${t('editor.forward_card_btn')}
            </button>
        `;

        showArticleModal({
            title: `${t('editor.status_processed')}`,
            headline: news.headline_rewritten || news.headline,
            body: news.body_rewritten || news.body,
            extraHtml: extraHtml,
            image_path: news.selected_image_path || news.image_path,
            category: news.category,
            city: news.city,
            reporter_name: news.reporter_name,
            created_at: news.processed_at || news.created_at,
            actionsHtml
        });

        enableProcessedNewsEditing();
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

function enableProcessedNewsEditing() {
    const headline = document.querySelector('#articleModal .processed-edit-headline') ||
        document.querySelector('#articleModal .modal-headline');
    const body = document.querySelector('#articleModal .processed-edit-body') ||
        document.querySelector('#articleModal .modal-article');

    if (headline) {
        headline.contentEditable = 'true';
        headline.classList.add('editable-news-field');
        headline.setAttribute('data-placeholder', 'Edit headline');
        headline.setAttribute('spellcheck', 'true');
    }

    if (body) {
        body.contentEditable = 'true';
        body.classList.add('editable-news-field');
        body.setAttribute('data-placeholder', 'Edit article text');
        body.setAttribute('spellcheck', 'true');
    }
}

function hasActiveNewsEditFields() {
    return Boolean(
        (document.querySelector('#articleModal .processed-edit-headline.editable-news-field') ||
            document.querySelector('#articleModal .modal-headline.editable-news-field')) &&
        (document.querySelector('#articleModal .processed-edit-body.editable-news-field') ||
            document.querySelector('#articleModal .modal-article.editable-news-field'))
    );
}

function getProcessedNewsEditPayload() {
    const headline = document.querySelector('#articleModal .processed-edit-headline') ||
        document.querySelector('#articleModal .modal-headline');
    const body = document.querySelector('#articleModal .processed-edit-body') ||
        document.querySelector('#articleModal .modal-article');
    return {
        headline_rewritten: (headline?.innerText || '').trim(),
        body_rewritten: (body?.innerText || '').trim()
    };
}

async function selectEditorImage(newsId, imageId, el) {
    try {
        const result = await api(`/editor/news/${newsId}/images/select`, {
            method: 'POST',
            body: JSON.stringify({ image_id: imageId })
        });
        if (result.error) {
            showToast(result.error, 'error');
            return;
        }
        
        // Update UI locally
        const grid = document.getElementById(`editorImageGrid-${newsId}`);
        if (grid) {
            grid.querySelectorAll('.editor-img-tile').forEach(t => {
                t.classList.remove('selected');
                const badge = t.querySelector('.editor-img-selected-badge');
                if (badge) badge.remove();
                t.style.border = '2px solid transparent';
            });
            el.classList.add('selected');
            el.style.border = '2px solid var(--accent-blue)';
            el.insertAdjacentHTML('beforeend', `<div class="editor-img-selected-badge" style="position:absolute; bottom:0; left:0; right:0; background:var(--accent-blue); color:white; font-size:10px; text-align:center; padding:2px;">${icon('check', 10)} Cover</div>`);
        }
        showToast('Image selected successfully', 'success');
        
        const modalImg = document.querySelector('.modal-image');
        if (modalImg && result.selected_image_path) {
            modalImg.src = result.selected_image_path;
        }

        if (document.getElementById('processedNewsList')) loadProcessedNews();
        if (document.getElementById('publishedNewsList')) loadPublishedNews();
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

/**
 * Trigger AI Rewrite with custom or default parameters
 * @param {number} id - News ID
 * @param {object} options - { language, numSubheadings, captionWords, targetWords }
 * @param {HTMLElement} btn - The button triggering the action (optional)
 */
async function triggerRewrite(id, options = {}, btn = null) {
    const payload = {
        language: options.language || 'hi',
        numSubheadings: options.numSubheadings || 3,
        captionWords: options.captionWords || 30,
        targetWords: options.targetWords || 400
    };

    let originalBtnHtml = '';
    if (btn) {
        btn.disabled = true;
        originalBtnHtml = btn.innerHTML;
        btn.innerHTML = `${icon('loader',12)} AI...`;
    }

    showToast(t('editor.rewriting'), 'info');

    try {
        const result = await api(`/editor/news/${id}/rewrite`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (result.error) {
            showRewriteErrorModal(id, options, result.error);
            return;
        }

        showToast(t('editor.rewrite_done'), 'success');
        closeCustomRewriteModal();
        closeRewriteErrorModal();
        await loadRawNews();
        await loadProcessedNews();
        switchEditorPane('processed');
        // Automatically open the processed preview modal
        openProcessedNewsDetail(id);
    } catch (err) {
        showRewriteErrorModal(id, options, err.message || 'Network error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
        }
    }
}

/**
 * Show Custom AI Rewrite Settings Modal
 * Allows selection of Subheadings (1, 3, 4, 6), Image Caption (20, 30, 40), Language (Hindi, English), Word Limit
 */
function showCustomRewriteModal(newsId) {
    closeCustomRewriteModal();

    const state = {
        targetWords: 400,
        numSubheadings: 3,
        captionWords: 30,
        language: 'hi'
    };

    const wordOptions = [100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 1000];
    const subheadingOptions = [1, 3, 4, 6];
    const captionOptions = [20, 30, 40];
    const languageOptions = [
        { code: 'hi', label: 'हिंदी (Hindi)' },
        { code: 'en', label: 'English' }
    ];

    const html = `
        <div class="confirm-overlay" id="customRewriteModal" onclick="if(event.target === this) closeCustomRewriteModal()">
            <div class="card" style="max-width: 540px; width: 92%; max-height: 90vh; overflow-y: auto; padding: 24px; border-radius: var(--radius-xl); box-shadow: var(--shadow-modal);" onclick="event.stopPropagation()">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${icon('gear', 20)}
                        <h3 style="margin: 0; font-family: Outfit, sans-serif; font-size: 1.15rem; color: #0f172a;">${t('editor.custom_modal_title')}</h3>
                    </div>
                    <button class="btn-icon" onclick="closeCustomRewriteModal()" style="font-size: 1.2rem; cursor: pointer; border: none; background: none;">✕</button>
                </div>

                <!-- Word Limit -->
                <div class="custom-rewrite-section">
                    <div class="custom-rewrite-label">
                        ${icon('ruler',14)} <span>${t('editor.word_limit_title')}</span>
                    </div>
                    <div class="selector-pills" id="wordPills">
                        ${wordOptions.map(w => `
                            <button type="button" class="selector-pill ${w === state.targetWords ? 'active' : ''}" data-val="${w}">
                                ${w} शब्द
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Subheadings -->
                <div class="custom-rewrite-section">
                    <div class="custom-rewrite-label">
                        ${icon('heading',14)} <span>${t('editor.subheadings_title')}</span>
                    </div>
                    <div class="selector-pills" id="subheadingPills">
                        ${subheadingOptions.map(s => `
                            <button type="button" class="selector-pill ${s === state.numSubheadings ? 'active' : ''}" data-val="${s}">
                                ${s} सब हेडिंग
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Image Caption -->
                <div class="custom-rewrite-section">
                    <div class="custom-rewrite-label">
                        ${icon('image',14)} <span>${t('editor.caption_words_title')}</span>
                    </div>
                    <div class="selector-pills" id="captionPills">
                        ${captionOptions.map(c => `
                            <button type="button" class="selector-pill ${c === state.captionWords ? 'active' : ''}" data-val="${c}">
                                ${c} शब्द
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Language -->
                <div class="custom-rewrite-section">
                    <div class="custom-rewrite-label">
                        ${icon('globe',14)} <span>${t('editor.language_title')}</span>
                    </div>
                    <div class="selector-pills" id="langPills">
                        ${languageOptions.map(l => `
                            <button type="button" class="selector-pill ${l.code === state.language ? 'active' : ''}" data-val="${l.code}">
                                ${l.label}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Modal Action Buttons -->
                <div style="display: flex; gap: 10px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                    <button class="btn btn-secondary" style="flex: 1;" onclick="closeCustomRewriteModal()">
                        ${t('common.cancel')}
                    </button>
                    <button class="btn btn-primary" style="flex: 2; font-weight: 700;" id="applyCustomRewriteBtn">
                        ${icon('rocket',14)} ${t('editor.apply_rewrite_btn')}
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    function setupPills(containerId, key, parseNumber = true) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.querySelectorAll('.selector-pill').forEach(pill => {
            pill.onclick = () => {
                container.querySelectorAll('.selector-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                state[key] = parseNumber ? parseInt(pill.dataset.val, 10) : pill.dataset.val;
            };
        });
    }

    setupPills('wordPills', 'targetWords', true);
    setupPills('subheadingPills', 'numSubheadings', true);
    setupPills('captionPills', 'captionWords', true);
    setupPills('langPills', 'language', false);

    document.getElementById('applyCustomRewriteBtn').onclick = () => {
        closeCustomRewriteModal();
        triggerRewrite(newsId, state);
    };
}

function closeCustomRewriteModal() {
    const el = document.getElementById('customRewriteModal');
    if (el) el.remove();
}

/**
 * Show prominent Error Dialog when AI Rewrite fails, instructing editor to retry
 */
function showRewriteErrorModal(newsId, options = {}, errorMsg = '') {
    closeRewriteErrorModal();

    const isHindi = (typeof currentLang !== 'undefined' ? currentLang : 'hi') === 'hi';
    const title = isHindi ? 'AI री-राइट विफल रहा' : 'AI Rewrite Failed';
    const explanation = isHindi
        ? 'संपादक जी, कच्ची खबर को AI द्वारा री-राइट करने में समस्या आई है।'
        : 'Editor, an error occurred while processing this news with AI.';
    const instruction = isHindi
        ? 'कृपया नीचे दिए गए बटन पर क्लिक करके <strong>फिर से AI री-राइट करें</strong>।'
        : 'Please click the button below to <strong>Retry AI Rewrite</strong>.';
    const retryBtnText = isHindi ? '🔄 फिर से AI री-राइट करें' : '🔄 Retry AI Rewrite';
    const cancelBtnText = isHindi ? 'रद्द करें' : 'Cancel';

    const html = `
        <div class="confirm-overlay" id="rewriteErrorModal" onclick="if(event.target === this) closeRewriteErrorModal()">
            <div class="confirm-dialog" style="max-width: 440px;" onclick="event.stopPropagation()">
                <div class="confirm-icon">${icon('warning', 32)}</div>
                <div class="confirm-title" style="color: #b91c1c;">${title}</div>
                <div class="confirm-text" style="text-align: left; margin-bottom: 12px;">
                    <p style="margin-bottom: 8px;">${explanation}</p>
                    <div class="rewrite-error-box" style="margin: 10px 0; text-align: left; font-size: 0.82rem; word-break: break-word;">
                        <strong>त्रुटि विवरण (Error):</strong> ${escapeHtml(errorMsg || 'Connection or API timeout')}
                    </div>
                    <p style="color: #ea580c; font-weight: 600; text-align: center; margin-top: 10px;">${instruction}</p>
                </div>
                <div class="confirm-actions" style="margin-top: 16px;">
                    <button class="btn btn-secondary" onclick="closeRewriteErrorModal()">${cancelBtnText}</button>
                    <button class="btn btn-primary" id="retryRewriteBtn" style="font-weight: 700;">${icon('refresh',14)} ${retryBtnText}</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('retryRewriteBtn').onclick = () => {
        closeRewriteErrorModal();
        triggerRewrite(newsId, options);
    };
}

function closeRewriteErrorModal() {
    const el = document.getElementById('rewriteErrorModal');
    if (el) el.remove();
}

async function approveNews(id) {
    try {
        const editPayload = hasActiveNewsEditFields() ? getProcessedNewsEditPayload() : {};
        const result = await api(`/editor/news/${id}/approve`, {
            method: 'PUT',
            body: JSON.stringify(editPayload)
        });

        if (result.error) {
            showToast(result.error, 'error');
            return;
        }

        closeArticleModal();
        showToast(t('editor.approve_success'), 'success');
        loadRawNews();
        loadProcessedNews();
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

async function forwardNews(id) {
    try {
        const result = await api(`/editor/news/${id}/forward`, {
            method: 'POST',
            body: JSON.stringify({})
        });

        if (result.error) {
            showToast(result.error, 'error');
            return;
        }

        closeArticleModal();
        showToast(t('editor.forward_success'), 'success');
        loadProcessedNews();
        editorTab = 'forwarded';
        renderEditorForwardedScreen();
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

async function saveProcessedNewsEdits(id, options = {}) {
    const payload = getProcessedNewsEditPayload();
    if (!payload.headline_rewritten || !payload.body_rewritten) {
        showToast('Headline and body cannot be empty', 'error');
        return false;
    }

    try {
        const result = await api(`/editor/news/${id}/content`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });

        if (result.error) {
            showToast(result.error, 'error');
            return false;
        }

        if (!options.silent) showToast('Edited news saved', 'success');
        loadProcessedNews();
        return true;
    } catch (err) {
        showToast(t('common.error'), 'error');
        return false;
    }
}

async function forwardEditedNews(id) {
    const saved = await saveProcessedNewsEdits(id, { silent: true });
    if (!saved) return;
    await forwardNews(id);
}


async function quickApproveNews(id) {
    try {
        const result = await api(`/editor/news/${id}/approve`, {
            method: 'PUT',
            body: JSON.stringify({})
        });

        if (result.error) {
            showToast(result.error, 'error');
            return;
        }

        showToast(t('editor.approve_success'), 'success');
        loadRawNews();
        loadProcessedNews();
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

async function quickForwardNews(id) {
    try {
        const result = await api(`/editor/news/${id}/forward`, {
            method: 'POST',
            body: JSON.stringify({})
        });

        if (result.error) {
            showToast(result.error, 'error');
            return;
        }

        showToast(t('editor.forward_success'), 'success');
        loadProcessedNews();
        editorTab = 'forwarded';
        renderEditorForwardedScreen();
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

function renderEditorExternalLinks(news) {
    const links = [
        news.external_hindi_url ? `<button class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); copyExternalArticleLink('${encodeURIComponent(news.external_hindi_url)}', 'Hindi')">${icon('copy',12)} Copy Hindi link</button>` : '',
        news.external_english_url ? `<button class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); copyExternalArticleLink('${encodeURIComponent(news.external_english_url)}', 'English')">${icon('copy',12)} Copy English link</button>` : ''
    ].filter(Boolean);

    if (!links.length) return '';
    return `<div class="news-card-actions-row">${links.join('')}</div>`;
}

async function copyExternalArticleLink(url, language) {
    try {
        await navigator.clipboard.writeText(decodeURIComponent(url));
        showToast(`${language} link copied`, 'success');
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

async function loadForwardedNews() {
    const container = document.getElementById('forwardedNewsList');
    if (!container) return;
    try {
        const data = await api('/editor/news/forwarded');
        const news = data.news || [];
        const count = document.getElementById('forwardedPaneCount');
        if (count) count.textContent = news.length;

        if (news.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon-svg">${icon('send', 40)}</div><div class="empty-text">${t('operator.no_news')}</div></div>`;
            applyLanguage();
            return;
        }

        container.innerHTML = news.map(n => `
            <div class="card news-card" onclick="openPublishedNewsDetail(${n.id})">
                <div class="news-card-header">
                    ${n.image_path ? `<img class="news-card-thumb" src="${n.selected_image_path || n.image_path}" alt="">` : `<div class="news-card-thumb-placeholder">${icon('newspaper', 22)}</div>`}
                    <div class="news-card-info">
                        <div class="news-card-headline"><span style="color:var(--accent-orange);margin-right:6px;">#${n.id}</span>${escapeHtml(n.headline_rewritten || n.headline)}</div>
                        <div class="news-card-body">${escapeHtml(n.body)}</div>
                    </div>
                </div>
                <div class="news-card-meta">
                    <span class="status-badge ${n.status === 'published' ? 'processed' : 'forwarded'}">${n.status === 'published' ? t('editor.status_published') : t('editor.status_forwarded')}</span>
                    <span class="news-card-meta-item">${icon('user',12)} ${escapeHtml(n.reporter_name)}</span>
                    <span class="news-card-meta-item">${icon('clock',12)} ${formatDate(n.forwarded_at)}</span>
                </div>
                <div class="news-card-actions-row">
                    <button class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); openPublishedNewsDetail(${n.id})">${icon('eye',12)} पूरी खबर पढ़ें</button>
                    <button class="btn btn-danger btn-xs" onclick="event.stopPropagation(); deleteNews(${n.id}, 'forwarded')">${icon('trash',12)} डिलीट करें</button>
                </div>
                ${renderEditorExternalLinks(n)}
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

async function loadRejectedNews() {
    const container = document.getElementById('rejectedNewsList');
    if(!container) return;
    try {
        const data = await api('/editor/news/rejected');
        const news = data.news || [];
        const countEls = ['rejectedCount', 'rejectedPaneCount'];
        countEls.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = news.length;
        });

        if (news.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-svg">${icon('inbox', 40)}</div>
                    <div class="empty-text">कोई रिजेक्टेड खबर नहीं है</div>
                </div>
            `;
            return;
        }

        container.innerHTML = news.map(n => `
            <div class="card news-card">
                <div class="news-card-header">
                    <div class="news-card-info" style="width: 100%;">
                        <div class="news-card-headline" style="color: #64748b; text-decoration: line-through;"><span style="color:var(--accent-orange);margin-right:6px;text-decoration:none;">#${n.id}</span>${escapeHtml(n.headline)}</div>
                        <div class="news-card-body" style="color: #dc2626; font-size: 0.85rem; margin-top: 6px;">
                            <strong>कारण:</strong> ${escapeHtml(n.reject_reason || 'कोई कारण नहीं')}
                        </div>
                    </div>
                </div>
                <div class="news-card-meta">
                    <span class="status-badge" style="background: #fee2e2; color: #b91c1c;">${t('editor.status_rejected')}</span>
                    <span class="news-card-meta-item">${icon('clock',12)} ${formatDate(n.rejected_at)}</span>
                    <span class="news-card-meta-item">${icon('user',12)} ${n.reporter_name}</span>
                </div>
                <div class="news-card-actions-row">
                    <button class="btn btn-primary btn-sm" onclick="restoreNews(${n.id})">
                        ${icon('refresh',12)} री-स्टोर करें
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

async function loadPublishedNews(append = false) {
    if (!append) _publishedPage = 1;
    const container = document.getElementById('publishedNewsList');
    if(!container) return;
    try {
        const data = await api(`/editor/news/published?page=${_publishedPage}`);
        const news = data.news || [];
        
        _hasMorePublished = news.length >= 20;

        if (append) {
            _publishedNewsData = [..._publishedNewsData, ...news];
        } else {
            _publishedNewsData = news;
        }

        const countEls = ['publishedCount', 'publishedPaneCount'];
        countEls.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = _publishedNewsData.length + (_hasMorePublished ? '+' : '');
        });

        if (_publishedNewsData.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-svg">${icon('inbox', 40)}</div>
                    <div class="empty-text">कोई प्रकाशित खबर नहीं है</div>
                </div>
            `;
            return;
        }

        container.innerHTML = news.map(n => {
            let copiesHtml = '';
            if (n.copies && n.copies.length > 0) {
                copiesHtml = `<div style="margin-top: 12px; padding: 10px; background: #f8fafc; border-radius: var(--radius-md); font-size: 0.85rem; border: 1px solid #e2e8f0;">
                    <div style="font-weight: 600; color: #475569; margin-bottom: 6px;">${icon('activity', 12)} एक्टिविटी (Activity)</div>
                    ${n.copies.map(c => `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span style="color: var(--accent-blue);">${icon('user',10)} ${escapeHtml(c.operator_name)} द्वारा कॉपी</span>
                            <span style="color: #64748b;">${icon('clock',10)} ${formatDate(c.copied_at)}</span>
                        </div>
                    `).join('')}
                </div>`;
            }

            return `
            <div class="card news-card" onclick="openPublishedNewsDetail(${n.id})">
                <div class="news-card-header">
                    ${n.image_path
                        ? `<img class="news-card-thumb" src="${n.image_path}" alt="" onerror="this.className='news-card-thumb-placeholder';this.innerHTML='📰'">`
                        : `<div class="news-card-thumb-placeholder">📰</div>`
                    }
                    <div class="news-card-info">
                        <div class="news-card-headline"><span style="color:var(--accent-orange);margin-right:6px;">#${n.id}</span>${escapeHtml(n.headline)}</div>
                    </div>
                </div>
                <div class="news-card-meta">
                    <span class="status-badge" style="background: ${n.status === 'published' ? '#dcfce7' : '#e0f2fe'}; color: ${n.status === 'published' ? '#166534' : '#0369a1'};">${n.status === 'published' ? t('editor.status_published') : 'कॉपी किया गया'}</span>
                    ${n.published_at ? `<span class="news-card-meta-item">${icon('clock',12)} ${formatDate(n.published_at)}</span>` : ''}
                    <span class="news-card-meta-item" title="रिपोर्टर">${icon('user',12)} ${escapeHtml(n.reporter_name)} (रिपोर्टर)</span>
                </div>
                ${copiesHtml}
                <div class="news-card-actions-row" style="justify-content: flex-end;">
                    <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteNews(${n.id})">
                        ${icon('trash',12)} डिलीट करें
                    </button>
                </div>
            </div>
        `}).join('');

        if (_hasMorePublished) {
            container.innerHTML += `
                <div style="text-align: center; margin: 20px 0;">
                    <button class="btn btn-secondary" onclick="_publishedPage++; loadPublishedNews(true)">
                        ${icon('refresh', 14)} और लोड करें (Load More)
                    </button>
                </div>
            `;
        }
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

function promptRejectNews(id) {
    const reason = prompt("रिजेक्ट करने का कारण दर्ज करें (वैकल्पिक):");
    if (reason !== null) {
        rejectNews(id, reason);
    }
}

async function rejectNews(id, reason) {
    try {
        const result = await api(`/editor/news/${id}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
        if (result.error) { showToast(result.error, 'error'); return; }
        showToast('खबर रिजेक्ट कर दी गई', 'success');
        closeArticleModal();
        loadRawNews();
        loadRejectedNews();
    } catch(e) {
        showToast(t('common.error'), 'error');
    }
}

async function restoreNews(id) {
    try {
        const result = await api(`/editor/news/${id}/restore`, { method: 'POST', body: JSON.stringify({}) });
        if (result.error) { showToast(result.error, 'error'); return; }
        showToast('खबर वापस कच्ची खबरों में डाल दी गई', 'success');
        loadRawNews();
        loadRejectedNews();
    } catch(e) {
        showToast(t('common.error'), 'error');
    }
}

async function deleteNews(id, source = 'published') {
    if (!confirm("क्या आप वाकई इस खबर को हटाना चाहते हैं? यह वापस नहीं होगा।")) return;
    try {
        const result = await api(`/editor/news/${id}/delete`, { method: 'POST', body: JSON.stringify({}) });
        if (result.error) { showToast(result.error, 'error'); return; }
        showToast('खबर हटा दी गई', 'success');
        if (source === 'raw') {
            loadRawNews();
            loadProcessedNews();
        } else if (source === 'forwarded') {
            loadForwardedNews();
        } else {
            loadPublishedNews();
        }
    } catch(e) {
        showToast(t('common.error'), 'error');
    }
}

async function openPublishedNewsDetail(id) {
    try {
        const news = await api(`/editor/news/${id}`);
        if (news.error) { showToast(news.error, 'error'); return; }

        const hasImages = news.images && news.images.length > 0;
        let extraHtml = renderEditorExternalLinks(news);
        if (hasImages) {
            extraHtml = `
                ${extraHtml}
                <div class="editor-image-picker" style="margin-top:24px; padding-top:16px; border-top:1px solid var(--border-color);">
                    <div class="editor-image-picker-label">${icon('photos', 14)} Cover Image Selection (${news.images.length})</div>
                    <div class="editor-image-grid" id="editorImageGrid-${id}">
                        ${news.images.map(img => `
                            <div class="editor-img-tile ${img.is_selected ? 'selected' : ''}" onclick="selectEditorImage(${id}, ${img.id}, this)">
                                <img src="${img.image_path}" alt="">
                                ${img.is_selected ? `<div class="editor-img-selected-badge">${icon('check', 10)} Cover</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        const actionsHtml = `
            <button class="btn btn-danger" onclick="deleteNews(${id})">
                ${icon('trash', 14)} डिलीट करें
            </button>
        `;

        showArticleModal({
            headline: news.headline_rewritten || news.headline,
            body: news.body_rewritten || news.body,
            extraHtml,
            image_path: news.selected_image_path || news.image_path,
            category: news.category,
            city: news.city,
            reporter_name: news.reporter_name,
            created_at: news.published_at || news.forwarded_at || news.processed_at || news.created_at,
            actionsHtml
        });
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

/**
 * Select a specific image as the cover image for a news article (editor image picker)
 * @param {number} newsId - news article ID
 * @param {number} imageId - selected image ID from news_images
 * @param {HTMLElement} tileEl - the clicked tile element
 */
async function selectEditorImage(newsId, imageId, tileEl) {
    try {
        const result = await api(`/editor/news/${newsId}/images/select`, {
            method: 'POST',
            body: JSON.stringify({ image_id: imageId })
        });

        if (result.error) {
            showToast(result.error, 'error');
            return;
        }

        // Update UI — deselect all, select this one
        const grid = tileEl.closest('.editor-image-grid');
        if (grid) {
            grid.querySelectorAll('.editor-img-tile').forEach(t => {
                t.classList.remove('selected');
                const badge = t.querySelector('.editor-img-selected-badge');
                if (badge) badge.remove();
            });
            tileEl.classList.add('selected');
            tileEl.insertAdjacentHTML('beforeend',
                `<div class="editor-img-selected-badge">${icon('check', 10)} Cover</div>`
            );
        }

        const modalImg = document.querySelector('.modal-image');
        if (modalImg && result.selected_image_path) {
            modalImg.src = result.selected_image_path;
        }

        if (document.getElementById('processedNewsList')) loadProcessedNews();
        if (document.getElementById('publishedNewsList')) loadPublishedNews();
        showToast('Cover image selected', 'success');
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}
