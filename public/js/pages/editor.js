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
let _editorRefreshTimer = null;
let _lastEditorScrollRefresh = 0;
let _rawNewsLoadSeq = 0;
let _processedNewsLoadSeq = 0;

function onRawReporterFilterChange(val) {
    _rawNewsReporterFilter = val;
    renderRawNewsCards();
}

function renderEditor() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('editor.title', null, 'pen')}
        <main class="page-content">
            <div class="editor-refresh-toolbar">
                <button class="btn btn-secondary btn-sm" onclick="refreshEditorNews(true)">
                    ${icon('refresh', 14)} ताज़ा करें
                </button>
                <span id="editorRefreshStatus">नई खबरों के लिए सूची ताज़ा रखें</span>
            </div>
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
                    <div class="split-pane-header" style="flex-wrap: wrap; justify-content: space-between; align-items: center;">
                        <h3 data-i18n="editor.raw_title" style="margin:0;">${t('editor.raw_title')}</h3>
                        <div style="display:flex; align-items:center; gap:8px;">
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
    ensureEditorAlertsDefaultOn();
    initEditorFreshness();
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

    if (pane === 'more') {
        renderEditorMoreScreen();
        return;
    }
    if (pane === 'pdfs') {
        renderEditorPdfsScreen();
        return;
    }
    if (pane === 'ads') {
        renderEditorAdsScreen();
        return;
    }
    if (pane === 'api') {
        renderEditorApiScreen();
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
    ensureEditorAlertsDefaultOn();
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
    ensureEditorAlertsDefaultOn();
    loadPublishedNews();
}

async function loadRawNews(append = false) {
    if (!append) _rawPage = 1;
    const container = document.getElementById('rawNewsList');
    const loadSeq = ++_rawNewsLoadSeq;
    try {
        const data = await api(`/editor/news/raw?page=${_rawPage}`);
        if (loadSeq !== _rawNewsLoadSeq) return;
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

async function refreshEditorNews(showToastMessage = false) {
    const statusEl = document.getElementById('editorRefreshStatus');
    if (statusEl) statusEl.textContent = 'ताज़ा हो रहा है...';

    await Promise.all([
        loadRawNews(),
        loadProcessedNews()
    ]);

    const time = new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
    if (statusEl) statusEl.textContent = `आखिरी अपडेट: ${time}`;
    if (showToastMessage) showToast('कच्ची खबर और प्रोसेस्ड खबर ताज़ा हो गई', 'success');
}

function initEditorFreshness() {
    clearInterval(_editorRefreshTimer);
    _editorRefreshTimer = setInterval(() => {
        if (window.location.hash === '#/editor' && !document.hidden && !document.getElementById('articleModal')) {
            refreshEditorNews(false);
        }
    }, 20000);

    document.removeEventListener('visibilitychange', refreshEditorNewsOnVisible);
    document.addEventListener('visibilitychange', refreshEditorNewsOnVisible);
    window.removeEventListener('focus', refreshEditorNewsOnFocus);
    window.addEventListener('focus', refreshEditorNewsOnFocus);
    window.removeEventListener('scroll', refreshEditorNewsOnScroll);
    window.addEventListener('scroll', refreshEditorNewsOnScroll, { passive: true });

    const rawPane = document.getElementById('rawPane');
    if (rawPane && !rawPane.dataset.freshnessReady) {
        rawPane.dataset.freshnessReady = 'true';
        rawPane.addEventListener('scroll', refreshEditorNewsOnScroll, { passive: true });
    }
}

function refreshEditorNewsOnVisible() {
    if (!document.hidden && window.location.hash === '#/editor' && !document.getElementById('articleModal')) refreshEditorNews(false);
}

function refreshEditorNewsOnFocus() {
    if (window.location.hash === '#/editor' && !document.getElementById('articleModal')) refreshEditorNews(false);
}

function refreshEditorNewsOnScroll() {
    if (window.location.hash !== '#/editor' || editorTab !== 'raw') return;
    if (document.getElementById('articleModal')) return;
    const now = Date.now();
    if (now - _lastEditorScrollRefresh < 15000) return;
    const rawPane = document.getElementById('rawPane');
    const paneScroll = rawPane ? rawPane.scrollTop : 0;
    if (window.scrollY > 180 || paneScroll > 180) {
        _lastEditorScrollRefresh = now;
        refreshEditorNews(false);
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
    const loadSeq = ++_processedNewsLoadSeq;
    try {
        const data = await api('/editor/news/processed');
        if (loadSeq !== _processedNewsLoadSeq) return;
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
                    <button class="btn btn-primary btn-xs" onclick="event.stopPropagation(); quickForwardNews(${n.id}, this)">
                        ${icon('send',12)} ${t('editor.forward_card_btn')}
                    </button>
                    <button class="btn btn-secondary btn-xs btn-website-forward" onclick="event.stopPropagation(); quickWebsiteForwardNews(${n.id}, this)">
                        ${icon('globe',12)} सिर्फ वेबसाइट पर
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

        let extraHtml = '';
        if (news.images && news.images.length > 0) extraHtml += renderEditorImagePicker(news, id);
        extraHtml += renderRawNewsWordCount(news);
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
        initEditorImageSorter(id);
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
            <div class="processed-review-block">
                <div class="processed-review-label">${icon('bot', 14)} ${t('editor.rewritten')}</div>
                <h2 class="processed-edit-headline editable-news-field" contenteditable="true" spellcheck="true" data-placeholder="Edit headline">${escapeHtml(news.headline_rewritten || news.headline)}</h2>
                <div class="processed-edit-body editable-news-field" contenteditable="true" spellcheck="true" data-placeholder="Edit article text">${escapeHtml(news.body_rewritten || news.body)}</div>
            </div>
            <div class="raw-source-review">
                <div class="raw-compare-label">${t('editor.raw_title')}</div>
                <h3>${escapeHtml(news.headline)}</h3>
                <div class="raw-source-review-body">${escapeHtml(news.body)}</div>
            </div>
        `;
        if (news.images && news.images.length > 0) {
            extraHtml += renderEditorImagePicker(news, id);
        }

        const actionsHtml = news.status === 'raw' ? `
            <button class="btn btn-success" style="flex:1;" onclick="approveNews(${id})">
                ${icon('check', 14)} ${t('editor.approve_btn')}
            </button>
        ` : `
            <button class="btn btn-secondary" style="flex:1;" onclick="saveProcessedNewsEdits(${id})">
                ${icon('check', 14)} Save Edit
            </button>
            <button class="btn btn-primary" style="flex:1;" onclick="forwardEditedNews(${id}, this)">
                ${icon('send', 14)} ${t('editor.forward_card_btn')}
            </button>
            <button class="btn btn-secondary btn-website-forward" style="flex:1;" onclick="websiteForwardEditedNews(${id}, this)">
                ${icon('globe', 14)} सिर्फ वेबसाइट पर फॉरवर्ड करें
            </button>
        `;

        showArticleModal({
            headline: '',
            body: '',
            extraHtml: extraHtml,
            image_path: news.selected_image_path || news.image_path,
            category: news.category,
            city: news.city,
            reporter_name: news.reporter_name,
            created_at: news.processed_at || news.created_at,
            actionsHtml
        });

        initEditorImageSorter(id);
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

function renderEditorImagePicker(news, id) {
    const images = news.images || [];
    if (!images.length) return '';

    return `
        <div class="editor-image-picker">
            <div class="editor-image-picker-label">${icon('photos', 14)} Cover Image & Sequence (${images.length} photos)</div>
            <div class="editor-image-grid sortable-image-grid" id="editorImageGrid-${id}">
                ${images.map((img, idx) => `
                    <div class="editor-img-tile ${img.is_selected ? 'selected' : ''}" data-image-id="${img.id}" tabindex="0" role="button" aria-label="Image ${idx + 1}">
                        <img src="${img.image_path}" alt="">
                        <button class="editor-img-delete-btn" type="button" onclick="deleteEditorImage(${id}, ${img.id}, this, event)" aria-label="Delete image">
                            ${icon('trash', 12)}
                        </button>
                        <div class="editor-img-order-badge">${idx + 1}</div>
                        ${img.is_selected ? `<div class="editor-img-selected-badge">${icon('check', 10)} Cover</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function countNewsWords(text) {
    return String(text || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
}

function renderRawNewsWordCount(news) {
    const headlineWords = countNewsWords(news.headline);
    const bodyWords = countNewsWords(news.body);
    const totalWords = headlineWords + bodyWords;

    return `
        <div class="raw-word-count">
            ${icon('file-text', 14)}
            <span>कच्ची खबर शब्द: ${totalWords}</span>
            <span>शीर्षक: ${headlineWords}</span>
            <span>खबर: ${bodyWords}</span>
        </div>
    `;
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

function initEditorImageSorter(newsId) {
    const grid = document.getElementById(`editorImageGrid-${newsId}`);
    if (!grid || grid.dataset.sorterReady) return;
    grid.dataset.sorterReady = 'true';

    let draggedTile = null;
    let startX = 0;
    let startY = 0;
    let hasMoved = false;

    grid.addEventListener('pointerdown', (event) => {
        if (event.target.closest('.editor-img-delete-btn')) return;
        const tile = event.target.closest('.editor-img-tile');
        if (!tile || !grid.contains(tile)) return;
        draggedTile = tile;
        startX = event.clientX;
        startY = event.clientY;
        hasMoved = false;
        tile.setPointerCapture(event.pointerId);
    });

    grid.addEventListener('pointermove', (event) => {
        if (!draggedTile) return;
        const moved = Math.abs(event.clientX - startX) + Math.abs(event.clientY - startY);
        if (moved < 8 && !hasMoved) return;
        hasMoved = true;
        draggedTile.classList.add('dragging');
        event.preventDefault();

        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.editor-img-tile');
        if (!target || target === draggedTile || target.parentElement !== grid) return;

        const tiles = [...grid.querySelectorAll('.editor-img-tile')];
        const draggedIndex = tiles.indexOf(draggedTile);
        const targetIndex = tiles.indexOf(target);
        grid.insertBefore(draggedTile, draggedIndex < targetIndex ? target.nextSibling : target);
        updateEditorImageOrderBadges(grid);
    });

    grid.addEventListener('pointerup', async (event) => {
        if (!draggedTile) return;
        const tile = draggedTile;
        draggedTile = null;

        try {
            tile.releasePointerCapture(event.pointerId);
        } catch (err) {
            // The pointer may already be released by the browser.
        }

        tile.classList.remove('dragging');
        if (hasMoved) {
            await saveEditorImageOrder(newsId, grid);
        } else {
            await selectEditorImage(newsId, Number(tile.dataset.imageId), tile);
        }
    });

    grid.addEventListener('pointercancel', () => {
        if (draggedTile) draggedTile.classList.remove('dragging');
        draggedTile = null;
    });
}

function updateEditorImageOrderBadges(grid) {
    grid.querySelectorAll('.editor-img-tile').forEach((tile, idx) => {
        const badge = tile.querySelector('.editor-img-order-badge');
        if (badge) badge.textContent = idx + 1;
    });
}

async function saveEditorImageOrder(newsId, grid) {
    const imageIds = [...grid.querySelectorAll('.editor-img-tile')]
        .map(tile => Number(tile.dataset.imageId))
        .filter(Number.isInteger);

    try {
        const result = await api(`/editor/news/${newsId}/images/reorder`, {
            method: 'POST',
            body: JSON.stringify({ image_ids: imageIds })
        });

        if (result.error) {
            showToast(result.error, 'error');
            return;
        }

        showToast('Image sequence saved', 'success');
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

async function deleteEditorImage(newsId, imageId, buttonEl, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (!confirm('क्या आप इस फोटो को हटाना चाहते हैं?')) return;

    const tile = buttonEl.closest('.editor-img-tile');
    const grid = tile?.closest('.editor-image-grid');
    if (buttonEl) buttonEl.disabled = true;

    try {
        const result = await api(`/editor/news/${newsId}/images/${imageId}/delete`, {
            method: 'POST',
            body: JSON.stringify({})
        });

        if (result.error) {
            showToast(result.error, 'error');
            if (buttonEl) buttonEl.disabled = false;
            return;
        }

        if (tile) tile.remove();
        if (grid) {
            const selectedId = result.images?.find(img => img.is_selected)?.id;
            grid.querySelectorAll('.editor-img-tile').forEach(t => {
                t.classList.remove('selected');
                const badge = t.querySelector('.editor-img-selected-badge');
                if (badge) badge.remove();
            });

            updateEditorImageOrderBadges(grid);
            const selectedTile = selectedId ? grid.querySelector(`[data-image-id="${selectedId}"]`) : null;
            if (selectedTile) {
                selectedTile.classList.add('selected');
                selectedTile.insertAdjacentHTML('beforeend', `<div class="editor-img-selected-badge">${icon('check', 10)} Cover</div>`);
            }

            if (!grid.querySelector('.editor-img-tile')) {
                const picker = grid.closest('.editor-image-picker');
                if (picker) picker.remove();
            }
        }

        const modalImg = document.querySelector('.modal-image');
        if (modalImg) {
            if (result.selected_image_path) {
                modalImg.src = result.selected_image_path;
                modalImg.style.display = '';
            } else {
                modalImg.remove();
            }
        }

        if (document.getElementById('rawNewsList')) loadRawNews();
        if (document.getElementById('processedNewsList')) loadProcessedNews();
        if (document.getElementById('publishedNewsList')) loadPublishedNews();
        showToast('फोटो हटा दी गई', 'success');
        refreshIcons();
    } catch (err) {
        showToast(t('common.error'), 'error');
        if (buttonEl) buttonEl.disabled = false;
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
 * Allows selection of Subheadings (1, 2, 3, 4, 6), Image Caption (20, 30, 40), Language (Hindi, English), Word Limit
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
    const subheadingOptions = [1, 2, 3, 4, 6];
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
    return forwardNewsWithProgress(id, null, '/forward', t('editor.forward_success'), true);
}

function startForwardProgress(buttonEl, label) {
    if (!buttonEl) return () => {};

    let progress = 0;
    const originalHtml = buttonEl.innerHTML;
    buttonEl.disabled = true;
    buttonEl.classList.add('btn-loading-progress');

    const render = () => {
        buttonEl.style.setProperty('--progress', `${progress}%`);
        buttonEl.innerHTML = `
            <span class="btn-progress-fill"></span>
            <span class="btn-progress-label">${icon('loader-2', 14)} ${label} ${progress}%</span>
        `;
        refreshIcons();
    };

    render();
    const timer = setInterval(() => {
        progress = Math.min(90, progress + 5);
        render();
    }, 180);

    return (done = false) => {
        clearInterval(timer);
        if (done) {
            progress = 100;
            render();
            setTimeout(() => {
                buttonEl.disabled = false;
                buttonEl.classList.remove('btn-loading-progress');
                buttonEl.style.removeProperty('--progress');
                buttonEl.innerHTML = originalHtml;
                refreshIcons();
            }, 350);
            return;
        }

        buttonEl.disabled = false;
        buttonEl.classList.remove('btn-loading-progress');
        buttonEl.style.removeProperty('--progress');
        buttonEl.innerHTML = originalHtml;
        refreshIcons();
    };
}

async function forwardNewsWithProgress(id, buttonEl, endpoint, successMessage, closeAfterSuccess) {
    const finishProgress = startForwardProgress(buttonEl, 'फॉरवर्ड');
    try {
        const result = await api(`/editor/news/${id}${endpoint}`, {
            method: 'POST',
            body: JSON.stringify({})
        });

        if (result.error) {
            finishProgress(false);
            showToast(result.error, 'error');
            return;
        }

        finishProgress(true);
        if (closeAfterSuccess) closeArticleModal();
        showToast(successMessage, 'success');
        await loadProcessedNews();
        await loadRawNews();
        return result;
    } catch (err) {
        finishProgress(false);
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

async function forwardEditedNews(id, buttonEl = null) {
    const saved = await saveProcessedNewsEdits(id, { silent: true });
    if (!saved) return;
    await forwardNewsWithProgress(id, buttonEl, '/forward', t('editor.forward_success'), true);
}

async function websiteForwardEditedNews(id, buttonEl = null) {
    const saved = await saveProcessedNewsEdits(id, { silent: true });
    if (!saved) return;
    await forwardNewsWithProgress(id, buttonEl, '/forward-website', 'खबर सिर्फ वेबसाइट पर भेज दी गई', false);
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

async function quickForwardNews(id, buttonEl = null) {
    await forwardNewsWithProgress(id, buttonEl, '/forward', t('editor.forward_success'), false);
}

async function quickWebsiteForwardNews(id, buttonEl = null) {
    await forwardNewsWithProgress(id, buttonEl, '/forward-website', 'खबर सिर्फ वेबसाइट पर भेज दी गई', false);
}

function renderEditorExternalLinks(news) {
    const links = [
        news.external_hindi_url ? `<button class="btn external-copy-btn" onclick="event.stopPropagation(); copyExternalArticleLink('${encodeURIComponent(news.external_hindi_url)}', 'Hindi')">${icon('copy',14)} हिंदी लिंक कॉपी करें</button>` : '',
        news.external_english_url ? `<button class="btn external-copy-btn" onclick="event.stopPropagation(); copyExternalArticleLink('${encodeURIComponent(news.external_english_url)}', 'English')">${icon('copy',14)} English link copy</button>` : ''
    ].filter(Boolean);

    if (!links.length) return '';
    return `<div class="external-links-panel">${links.join('')}</div>`;
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
        if (hasImages) extraHtml = `${extraHtml}${renderEditorImagePicker(news, id)}`;

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
        initEditorImageSorter(id);
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


// ==========================================
// EDITOR API NEWSPAPER GENERATOR HUB
// ==========================================

let _apiTargets = [];
let _selectedApiTargetId = null;
let _selectedApiTargetName = '';
let _selectedApiNews = new Set();
let _apiNewsCache = [];

function renderEditorApiScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('editor.title', 'server')}
        <main class="page-content" style="padding-bottom: 70px;">
            <div class="split-pane-header" style="padding: 12px 16px; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="btn btn-secondary btn-sm" onclick="switchEditorPane('more')">← वापस</button>
                    <h3 style="margin: 0;">न्यूज़पेपर API</h3>
                </div>
            </div>
            
            <div id="apiTargetsSelection" style="padding: 16px;">
                <h4 style="margin-bottom:12px; color:var(--text-secondary);">सब-एडिटर / API रिपोर्टर चुनें</h4>
                <div id="apiTargetsList" class="user-list" style="display: flex; flex-direction: column; gap: 10px;">
                    <div class="loading-spinner"></div>
                </div>
            </div>

            <div id="apiNewsSelection" class="hidden" style="padding: 0 8px;">
                <div class="bundle-toolbar" style="padding: 10px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 10;">
                    <div style="display:flex; align-items:center; gap: 12px; flex-wrap:wrap;">
                        <button class="btn btn-secondary btn-sm" onclick="backToApiTargets()">← वापस</button>
                        <strong id="apiSelectedTargetTitle" style="font-size:14px;"></strong>
                        <div>
                            <input type="checkbox" id="selectAllApiNews" onchange="toggleSelectAllApiNews(this.checked)">
                            <label for="selectAllApiNews" style="margin-left:8px; font-size:14px;">सभी चुनें</label>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm" id="apiBundleSendBtn" onclick="sendApiNewspaperBundle()" disabled>
                        📰 API बंडल भेजें (0)
                    </button>
                </div>
                <div id="apiNewsList" style="margin-top: 12px; padding: 0 8px; display: flex; flex-direction: column; gap: 10px;"></div>
            </div>
        </main>
        ${renderBottomNav('editor', 'more')}
    `;
    applyLanguage();
    loadApiTargets();
}

async function loadApiTargets() {
    const container = document.getElementById('apiTargetsList');
    if (!container) return;
    try {
        const data = await api('/editor/api-targets');
        _apiTargets = data.targets || [];
        
        if (_apiTargets.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-text">कोई API इनेबल्ड व्यक्ति नहीं मिला</div></div>`;
            return;
        }

        container.innerHTML = _apiTargets.map(t => {
            const avatarHtml = t.avatar_path 
                ? `<img src="${t.avatar_path}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">`
                : `<div class="user-avatar ${t.role}" style="width:40px; height:40px; font-size:18px;">${t.full_name.charAt(0).toUpperCase()}</div>`;
            
            const count = Number(t.processed_rewritten_count || 0);
            return `
            <div class="card" style="display:flex; align-items:center; gap:16px; cursor:pointer; padding: 12px 16px; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='var(--card-bg)'" onclick="selectApiTarget(${t.id}, '${escapeHtml(t.full_name)}')">
                ${avatarHtml}
                <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                    <div style="font-weight:600; font-size:1.1rem; color:var(--text-primary);">${escapeHtml(t.full_name)}</div>
                    <div style="font-size:0.9rem; color:var(--text-secondary); margin-top:4px;">
                        <strong>${t.role === 'sub_editor' ? 'Sub-Editor' : 'API Reporter'}</strong> <span style="margin: 0 6px;">•</span> ${escapeHtml(t.district || t.city || 'No City')}
                    </div>
                    <div style="font-size:0.85rem; color:${count >= 7 ? 'var(--accent-green)' : 'var(--accent-orange)'}; margin-top:4px;">
                        AI rewritten processed news: ${count}
                    </div>
                </div>
                ${icon('chevron-right', 20)}
            </div>
        `}).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

function backToApiTargets() {
    document.getElementById('apiTargetsSelection').classList.remove('hidden');
    document.getElementById('apiNewsSelection').classList.add('hidden');
    _selectedApiTargetId = null;
    _selectedApiTargetName = '';
    _selectedApiNews.clear();
    _apiNewsCache = [];
}

async function selectApiTarget(id, name) {
    _selectedApiTargetId = id;
    _selectedApiTargetName = name;
    document.getElementById('apiTargetsSelection').classList.add('hidden');
    document.getElementById('apiNewsSelection').classList.remove('hidden');
    _selectedApiNews.clear();
    updateApiBundleToolbar();
    const title = document.getElementById('apiSelectedTargetTitle');
    if (title) title.textContent = `${name} की AI rewritten processed खबरें`;
    
    await loadNewsForApiTarget();
}

async function loadNewsForApiTarget() {
    const container = document.getElementById('apiNewsList');
    container.innerHTML = '<div class="loading-spinner" style="margin:40px auto;"></div>';

    try {
        const data = await api(`/editor/api-targets/${_selectedApiTargetId}/news`);
        _apiNewsCache = data.news || [];
        
        if (_apiNewsCache.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-text">${escapeHtml(_selectedApiTargetName || 'इस यूज़र')} की कोई AI rewritten processed खबर उपलब्ध नहीं है</div></div>`;
            return;
        }

        container.innerHTML = _apiNewsCache.map(news => `
            <div class="card api-news-card" onclick="toggleApiNewsSelection(${news.id})" id="api-news-card-${news.id}" style="padding:12px; display:flex; gap:12px; cursor:pointer;">
                <input type="checkbox" id="api-chk-${news.id}" style="margin-top:4px;" onclick="event.stopPropagation(); toggleApiNewsSelection(${news.id})" ${_selectedApiNews.has(news.id) ? 'checked' : ''}>
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:0.95rem; line-height:1.4;">${escapeHtml(news.headline_rewritten || news.headline)}</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:6px;">
                        ${escapeHtml(news.reporter_name || '')} • ${escapeHtml(news.city || '')} • ${formatDate(news.processed_at)}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

function toggleApiNewsSelection(id) {
    const chk = document.getElementById(`api-chk-${id}`);
    if (_selectedApiNews.has(id)) {
        _selectedApiNews.delete(id);
        if (chk) chk.checked = false;
    } else {
        _selectedApiNews.add(id);
        if (chk) chk.checked = true;
    }
    updateApiBundleToolbar();
}

function toggleSelectAllApiNews(checked) {
    _apiNewsCache.forEach(n => {
        if (checked) _selectedApiNews.add(n.id);
        else _selectedApiNews.delete(n.id);
        const chk = document.getElementById(`api-chk-${n.id}`);
        if (chk) chk.checked = checked;
    });
    updateApiBundleToolbar();
}

function updateApiBundleToolbar() {
    const btn = document.getElementById('apiBundleSendBtn');
    if (!btn) return;
    btn.disabled = _selectedApiNews.size < 7;
    btn.textContent = `📰 API बंडल भेजें (${_selectedApiNews.size})`;
}

async function sendApiNewspaperBundle() {
    if (_selectedApiNews.size < 7) {
        showToast('कम से कम 7 खबरें चुनें', 'error');
        return;
    }
    if (!confirm(`क्या आप ${_selectedApiNews.size} खबरों का बंडल न्यूज़पेपर जनरेटर को भेजना चाहते हैं?`)) return;

    const btn = document.getElementById('apiBundleSendBtn');
    btn.disabled = true;
    btn.textContent = 'भेज रहा है...';

    try {
        const res = await api('/editor/newspaper-generator/bundle', {
            method: 'POST',
            body: JSON.stringify({
                target_user_id: _selectedApiTargetId,
                news_ids: Array.from(_selectedApiNews)
            })
        });

        if (res.error) {
            showToast(res.error, 'error');
            btn.disabled = false;
            btn.textContent = `📰 API बंडल भेजें (${_selectedApiNews.size})`;
        } else {
            showToast(res.message, 'success');
            _selectedApiNews.clear();
            updateApiBundleToolbar();
            await loadNewsForApiTarget();
        }
    } catch (err) {
        showToast(t('common.error'), 'error');
        btn.disabled = false;
        btn.textContent = `📰 API बंडल भेजें (${_selectedApiNews.size})`;
    }
}

// ==========================================
// EDITOR MORE OPTIONS AND PDFS SCREEN
// ==========================================

/**
 * Full-screen view for 'More (अन्य)' Menu
 */
function renderEditorMoreScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('editor.title', 'menu')}
        <main class="page-content" style="padding-bottom: 70px;">
            <div class="split-pane-header" style="padding: 12px 16px; border-bottom: 1px solid var(--border-color);">
                <h3 style="margin: 0;">अन्य विकल्प (More Options)</h3>
            </div>
            
            <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
                <div class="card" style="padding: 16px; display: flex; align-items: center; gap: 16px; cursor: pointer;" onclick="switchEditorPane('api')">
                    <div style="background: var(--bg-secondary); padding: 12px; border-radius: 50%; color: var(--accent-blue);">
                        ${icon('server', 24)}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 1.1rem; color: var(--text-primary);">न्यूज़पेपर API जनरेटर</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">रिपोर्टर्स और सब-एडिटर्स के लिए ऑटोमैटिक PDF जनरेट करें</div>
                    </div>
                    ${icon('chevron-right', 20)}
                </div>

                <div class="card" style="padding: 16px; display: flex; align-items: center; gap: 16px; cursor: pointer;" onclick="switchEditorPane('pdfs')">
                    <div style="background: var(--bg-secondary); padding: 12px; border-radius: 50%; color: var(--accent-orange);">
                        ${icon('file-text', 24)}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 1.1rem; color: var(--text-primary);">जनरेटेड PDFs (Generated PDFs)</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">API द्वारा जनरेट की गई और अपलोड की गई PDF फाइलें देखें</div>
                    </div>
                    ${icon('chevron-right', 20)}
                </div>

                <div class="card" style="padding: 16px; display: flex; align-items: center; gap: 16px; cursor: pointer;" onclick="switchEditorPane('ads')">
                    <div style="background: var(--bg-secondary); padding: 12px; border-radius: 50%; color: var(--success-color);">
                        ${icon('dollar-sign', 24)}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 1.1rem; color: var(--text-primary);" data-i18n="editor.ads_tab">${t('editor.ads_tab')}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">विज्ञापन प्रबंधित करें और स्वीकृत करें</div>
                    </div>
                    ${icon('chevron-right', 20)}
                </div>
            </div>
        </main>
        ${renderBottomNav('editor', 'more')}
    `;
    applyLanguage();
}

/**
 * Full-screen view for Generated PDFs
 */
function renderEditorPdfsScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('editor.title', 'file-text')}
        <main class="page-content" style="padding-bottom: 70px;">
            <div class="split-pane-header" style="padding: 12px 16px; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="btn btn-secondary btn-sm" onclick="switchEditorPane('more')">← वापस</button>
                    <h3 style="margin: 0;">जनरेटेड PDFs</h3>
                </div>
            </div>
            
            <div id="pdfTargetsSelection" style="padding: 16px;">
                <h4 style="margin-bottom:12px; color:var(--text-secondary);">यूज़र चुनें (Select User to View PDFs)</h4>
                <div id="pdfTargetsList" class="user-list" style="display: flex; flex-direction: column; gap: 10px;">
                    <div class="loading-spinner"></div>
                </div>
            </div>

            <div id="pdfViewerSelection" class="hidden" style="padding: 0 8px;">
                <div class="bundle-toolbar" style="padding: 10px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 10;">
                    <div style="display:flex; align-items:center; gap: 12px;">
                        <button class="btn btn-secondary btn-sm" onclick="backToPdfTargets()">← वापस</button>
                        <h4 id="pdfTargetTitle" style="margin:0;"></h4>
                    </div>
                    <label class="btn btn-primary btn-sm" style="cursor:pointer; margin:0;">
                        ${icon('upload', 14)} अपलोड (Upload PDF)
                        <input type="file" id="manualPdfUpload" accept="application/pdf" style="display:none;" onchange="uploadManualPdf(this)">
                    </label>
                </div>
                <div id="pdfFilesList" style="margin-top: 12px; padding: 0 8px; display: flex; flex-direction: column; gap: 10px;"></div>
            </div>
        </main>
        ${renderBottomNav('editor', 'more')}
    `;
    applyLanguage();
    loadPdfTargets();
}

let _selectedPdfTargetId = null;

async function loadPdfTargets() {
    const container = document.getElementById('pdfTargetsList');
    if (!container) return;
    try {
        const data = await api('/editor/api-targets');
        const targets = data.targets || [];
        
        if (targets.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-text">कोई API इनेबल्ड व्यक्ति नहीं मिला</div></div>`;
            return;
        }

        container.innerHTML = targets.map(t => {
            const avatarHtml = t.avatar_path 
                ? `<img src="${t.avatar_path}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">`
                : `<div class="user-avatar ${t.role}" style="width:40px; height:40px; font-size:18px;">${t.full_name.charAt(0).toUpperCase()}</div>`;
            const pdfCount = Number(t.pdf_count || 0);
            
            return `
            <div class="card" style="display:flex; align-items:center; gap:16px; cursor:pointer; padding: 12px 16px; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='var(--card-bg)'" onclick="selectPdfTarget(${t.id}, '${escapeHtml(t.full_name)}')">
                ${avatarHtml}
                <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                    <div style="font-weight:600; font-size:1.1rem; color:var(--text-primary);">
                        ${escapeHtml(t.full_name)}
                        <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:500; margin-left:6px;">#${t.id}</span>
                    </div>
                    <div style="font-size:0.9rem; color:var(--text-secondary); margin-top:4px;">
                        <strong>${t.role === 'sub_editor' ? 'Sub-Editor' : 'API Reporter'}</strong> <span style="margin: 0 6px;">•</span> ${escapeHtml(t.district || t.city || 'No City')}
                    </div>
                    <div style="font-size:0.85rem; color:${pdfCount ? 'var(--accent-green)' : 'var(--text-secondary)'}; margin-top:4px;">
                        Generated PDFs: ${pdfCount}
                    </div>
                </div>
                ${icon('chevron-right', 20)}
            </div>
        `}).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

function backToPdfTargets() {
    document.getElementById('pdfTargetsSelection').classList.remove('hidden');
    document.getElementById('pdfViewerSelection').classList.add('hidden');
    _selectedPdfTargetId = null;
}

async function selectPdfTarget(id, name) {
    _selectedPdfTargetId = id;
    document.getElementById('pdfTargetsSelection').classList.add('hidden');
    document.getElementById('pdfViewerSelection').classList.remove('hidden');
    document.getElementById('pdfTargetTitle').textContent = `${name} की PDFs`;
    
    await loadPdfsForSelectedTarget();
}

async function loadPdfsForSelectedTarget() {
    const container = document.getElementById('pdfFilesList');
    container.innerHTML = '<div class="loading-spinner" style="margin:40px auto;"></div>';

    try {
        const data = await api(`/editor/api-targets/${_selectedPdfTargetId}/pdfs`);
        const pdfs = data.pdfs || [];
        
        if (pdfs.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-text">इस यूज़र के लिए कोई PDF नहीं मिली।</div></div>`;
            return;
        }

        container.innerHTML = pdfs.map(pdf => {
            const dateStr = new Date(pdf.created_at).toLocaleString('hi-IN');
            return `
                <div class="card" style="padding: 16px; display: flex; align-items: center; gap: 16px;">
                    <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; color: var(--accent-orange);">
                        ${icon('file', 32)}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 1.05rem; color: var(--text-primary); word-break: break-all;">
                            <a href="${pdf.pdf_url}" target="_blank" style="text-decoration:none; color:inherit;">${escapeHtml(pdf.filename || 'newspaper.pdf')}</a>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 6px;">${dateStr}</div>
                    </div>
                    <a href="${pdf.pdf_url}" download class="btn btn-secondary btn-sm" style="display:flex; align-items:center; gap:6px;">
                        ${icon('download', 16)} डाउनलोड
                    </a>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

async function uploadManualPdf(input) {
    if (!input.files || !input.files[0]) return;
    if (!_selectedPdfTargetId) return;

    const file = input.files[0];
    if (file.type !== 'application/pdf') {
        showToast('केवल PDF फाइलें अपलोड की जा सकती हैं।', 'error');
        input.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('target_user_id', _selectedPdfTargetId);

    const btnLabel = input.parentElement;
    const originalHtml = btnLabel.innerHTML;
    btnLabel.innerHTML = '<div class="loading-spinner" style="width:14px; height:14px;"></div> अपलोड हो रहा है...';
    btnLabel.style.pointerEvents = 'none';

    try {
        const token = localStorage.getItem('nms_token');
        const res = await fetch('/api/webhook/manual-upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        
        showToast('PDF सफलतापूर्वक अपलोड की गई', 'success');
        await loadPdfsForSelectedTarget();
    } catch(err) {
        showToast(err.message || 'PDF अपलोड करने में विफल', 'error');
    } finally {
        btnLabel.innerHTML = originalHtml;
        btnLabel.style.pointerEvents = 'auto';
        input.value = ''; // Reset input
    }
}
