/* ============================================================
   EDITOR PAGE — Split screen: Raw News | Processed News
   ============================================================ */

let editorTab = 'raw';
let _rawNewsData = [];
let _rawNewsReporterFilter = '';
let _rawNewsSubEditorFilter = '';
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

function onRawSubEditorFilterChange(val) {
    _rawNewsSubEditorFilter = val;
    loadRawNews();
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
        const params = new URLSearchParams({ page: String(_rawPage) });
        if (_rawNewsSubEditorFilter) params.set('sub_editor_id', _rawNewsSubEditorFilter);
        const data = await api(`/editor/news/raw?${params.toString()}`);
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

        // Populate raw-news filters from active users
        let allReporters = [];
        let allSubEditors = [];
        try {
            const [repData, subEditorData] = await Promise.all([
                api('/editor/reporters'),
                api('/editor/sub-editors')
            ]);
            if (!repData.error) allReporters = repData.reporters || [];
            if (!subEditorData.error) allSubEditors = subEditorData.subEditors || [];
        } catch (e) {
            console.error('Failed to fetch raw news filters', e);
        }
        
        const filterContainer = document.getElementById('rawNewsFilterContainer');
        if (filterContainer) {
            filterContainer.innerHTML = `
                <select class="form-input form-select" style="max-width: 150px; padding: 4px 8px; font-size: 0.85rem;" onchange="onRawReporterFilterChange(this.value)">
                    <option value="" data-i18n="common.all_reporters">${t('common.all_reporters') || 'सभी रिपोर्टर'}</option>
                    ${allReporters.map(r => `<option value="${escapeHtml(r.name)}" ${r.name === _rawNewsReporterFilter ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
                </select>
                <select class="form-input form-select" style="max-width: 170px; padding: 4px 8px; font-size: 0.85rem; margin-left: 8px;" onchange="onRawSubEditorFilterChange(this.value)">
                    <option value="">सब-एडिटर चुनें</option>
                    <option value="direct" ${_rawNewsSubEditorFilter === 'direct' ? 'selected' : ''}>सीधी खबरें</option>
                    ${allSubEditors.map(se => {
                        const name = se.name_hi || se.full_name || se.name_en || 'Sub-Editor';
                        return `<option value="${se.id}" ${String(se.id) === String(_rawNewsSubEditorFilter) ? 'selected' : ''}>${escapeHtml(name)}</option>`;
                    }).join('')}
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
        if (isCurrentPage('editor') && !document.hidden && !document.getElementById('articleModal')) {
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
    if (!document.hidden && isCurrentPage('editor') && !document.getElementById('articleModal')) refreshEditorNews(false);
}

function refreshEditorNewsOnFocus() {
    if (isCurrentPage('editor') && !document.getElementById('articleModal')) refreshEditorNews(false);
}

function refreshEditorNewsOnScroll() {
    if (!isCurrentPage('editor') || editorTab !== 'raw') return;
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
                <button class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); sendRawNewsToPageMint(${n.id}, this)" title="बिना AI rewrite — मूल खबर PageMint API">
                    ${icon('server',12)} PageMint API (Raw)
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
    if (!container) return;
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
                    <button class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); quickOperatorForwardNews(${n.id}, this)">
                        ${icon('user',12)} सिर्फ ऑपरेटर को भेजें
                    </button>
                    <button class="btn btn-danger btn-xs" onclick="event.stopPropagation(); hideProcessedNewsFromEditor(${n.id}, this)" title="सिर्फ Processed सूची से हटाएं">
                        ${icon('x-circle',12)} हटाएं
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
        extraHtml += renderEditorImagePicker(news, id);
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
            imageCrop: getEditorCoverImageCrop(news, id),
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
        extraHtml += renderEditorImagePicker(news, id);

        const actionsHtml = news.status === 'raw' ? `
            <button class="btn btn-success" style="flex:1;" onclick="approveNews(${id})">
                ${icon('check', 14)} ${t('editor.approve_btn')}
            </button>
        ` : `
            <button class="btn btn-primary" style="flex:1;" onclick="forwardEditedNews(${id}, this)">
                ${icon('send', 14)} ${t('editor.forward_card_btn')}
            </button>
            <button class="btn btn-secondary btn-website-forward" style="flex:1;" onclick="websiteForwardEditedNews(${id}, this)">
                ${icon('globe', 14)} सिर्फ वेबसाइट पर फॉरवर्ड करें
            </button>
            <button class="btn btn-secondary" style="flex:1;" onclick="operatorForwardEditedNews(${id}, this)">
                ${icon('user', 14)} सिर्फ ऑपरेटर को भेजें
            </button>
            <button class="btn btn-danger btn-sm" onclick="hideProcessedNewsFromEditor(${id}, this)">
                ${icon('x-circle', 14)} Processed सूची से हटाएं
            </button>
        `;

        showArticleModal({
            headline: '',
            body: '',
            extraHtml: extraHtml,
            image_path: news.selected_image_path || news.image_path,
            imageCrop: getEditorCoverImageCrop(news, id),
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

const EDITOR_MAX_NEWS_IMAGES = 10;
let _editorCropperInstance = null;
let _editorCropObjectUrl = null;

function isMobileEditorUi() {
    return window.matchMedia('(max-width: 768px)').matches
        || window.matchMedia('(pointer: coarse)').matches;
}

function getEditorCropExportLimits() {
    if (isMobileEditorUi()) {
        return { maxWidth: 1200, maxHeight: 1200, quality: 0.82, smoothing: 'medium' };
    }
    return { maxWidth: 2000, maxHeight: 2000, quality: 0.88, smoothing: 'high' };
}

function loadImageElement(url) {
    return new Promise((resolve, reject) => {
        const el = new Image();
        el.decoding = 'async';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Image failed to load'));
        el.src = url;
    });
}

async function loadOptimizedCropPreviewSource(url) {
    const bustUrl = bustImageUrl(url);
    const img = await loadImageElement(bustUrl);
    const maxEdge = isMobileEditorUi() ? 1280 : 1920;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) {
        throw new Error('Invalid image dimensions');
    }
    if (w <= maxEdge && h <= maxEdge) {
        return { src: bustUrl, revoke: null };
    }

    const scale = maxEdge / Math.max(w, h);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) {
        throw new Error('Could not prepare crop preview');
    }
    const objectUrl = URL.createObjectURL(blob);
    return { src: objectUrl, revoke: objectUrl };
}

function getEditorCropperOptions() {
    const mobile = isMobileEditorUi();
    return {
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 0.9,
        responsive: true,
        restore: false,
        checkOrientation: false,
        modal: true,
        guides: !mobile,
        center: !mobile,
        highlight: !mobile,
        background: false,
        zoomOnWheel: !mobile,
        touchDragZoom: true,
        wheelZoomRatio: 0.08
    };
}

function waitForNextPaint() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function bustImageUrl(url) {
    if (!url) return url;
    const base = String(url).split('?')[0];
    return `${base}?t=${Date.now()}`;
}

function getEditorCoverImageCrop(news, newsId) {
    const images = news.images || [];
    const cover = images.find(img => img.is_selected) || images[0];
    if (!cover) return null;
    return { newsId: Number(newsId), imageId: Number(cover.id) };
}

function renderEditorImagePicker(news, id) {
    const images = news.images || [];
    const atLimit = images.length >= EDITOR_MAX_NEWS_IMAGES;

    return `
        <div class="editor-image-picker">
            <div class="editor-image-picker-label">${icon('photos', 14)} Cover Image & Sequence (${images.length} photos)</div>
            <div class="editor-image-grid sortable-image-grid" id="editorImageGrid-${id}">
                ${images.map((img, idx) => `
                    <div class="editor-img-tile ${img.is_selected ? 'selected' : ''}" data-image-id="${img.id}" tabindex="0" role="button" aria-label="Image ${idx + 1}">
                        <img src="${img.image_path}" alt="">
                        <button class="editor-img-crop-btn" type="button" onclick="event.stopPropagation(); openEditorImageCropFromTile(${id}, ${img.id}, this)" aria-label="Crop image">
                            ${icon('image', 12)}
                        </button>
                        <button class="editor-img-delete-btn" type="button" onclick="deleteEditorImage(${id}, ${img.id}, this, event)" aria-label="Delete image">
                            ${icon('trash', 12)}
                        </button>
                        <div class="editor-img-order-badge">${idx + 1}</div>
                        ${img.is_selected ? `<div class="editor-img-selected-badge">${icon('check', 10)} Cover</div>` : ''}
                    </div>
                `).join('')}
            </div>
            <div class="editor-image-add-row" style="margin-top: 10px;">
                <input type="file" id="editorImageUpload-${id}" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp" style="display:none" onchange="uploadEditorImages(${id}, this)">
                <button type="button" class="btn btn-secondary btn-sm" ${atLimit ? 'disabled' : ''} onclick="document.getElementById('editorImageUpload-${id}').click()">
                    ${icon('plus', 12)} फोटो जोड़ें (${images.length}/${EDITOR_MAX_NEWS_IMAGES})
                </button>
            </div>
        </div>
    `;
}

async function refreshEditorImagePickerInModal(newsId) {
    try {
        const news = await api(`/editor/news/${newsId}`);
        if (news.error) return;
        const picker = document.querySelector('.editor-image-picker');
        if (!picker) return;
        const replacement = document.createElement('div');
        replacement.innerHTML = renderEditorImagePicker(news, newsId);
        picker.replaceWith(replacement.firstElementChild);
        initEditorImageSorter(newsId);
        refreshIcons();
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

function closeEditorImageCropModal() {
    if (_editorCropperInstance) {
        _editorCropperInstance.destroy();
        _editorCropperInstance = null;
    }
    if (_editorCropObjectUrl) {
        URL.revokeObjectURL(_editorCropObjectUrl);
        _editorCropObjectUrl = null;
    }
    const el = document.getElementById('editorImageCropModal');
    if (el) el.remove();
    document.body.style.overflow = document.getElementById('articleModal') ? 'hidden' : '';
}

function openEditorImageCropFromTile(newsId, imageId, buttonEl) {
    const src = buttonEl?.closest('.editor-img-tile')?.querySelector('img')?.src;
    if (!src) {
        showToast('Image not found', 'error');
        return;
    }
    openEditorImageCrop(newsId, imageId, src);
}

async function openEditorImageCrop(newsId, imageId, imageUrl) {
    if (typeof Cropper === 'undefined') {
        showToast('Image crop tool is loading. Please refresh and try again.', 'error');
        return;
    }

    closeEditorImageCropModal();

    document.body.insertAdjacentHTML('beforeend', `
        <div class="confirm-overlay editor-crop-overlay" id="editorImageCropModal" onclick="if(event.target === this) closeEditorImageCropModal()">
            <div class="card editor-crop-card" onclick="event.stopPropagation()">
                <div class="editor-crop-header">
                    <strong>फोटो क्रॉप करें</strong>
                    <button type="button" class="btn-icon" onclick="closeEditorImageCropModal()" aria-label="Close">✕</button>
                </div>
                <div class="editor-crop-stage" id="editorCropStage">
                    <div class="editor-crop-loading" id="editorCropLoading">
                        <div class="loading-spinner"></div>
                        <span>फोटो तैयार हो रही है...</span>
                    </div>
                    <img id="editorCropTargetImage" class="editor-crop-target hidden" alt="Crop preview">
                </div>
                <div class="editor-crop-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeEditorImageCropModal()">${t('common.cancel')}</button>
                    <button type="button" class="btn btn-primary" id="editorCropSaveBtn" disabled onclick="saveEditorImageCrop(${newsId}, ${imageId})">
                        ${icon('check', 14)} क्रॉप सेव करें
                    </button>
                </div>
            </div>
        </div>
    `);

    const img = document.getElementById('editorCropTargetImage');
    const loadingEl = document.getElementById('editorCropLoading');
    const saveBtn = document.getElementById('editorCropSaveBtn');

    try {
        const prepared = await loadOptimizedCropPreviewSource(imageUrl);
        _editorCropObjectUrl = prepared.revoke;
        img.src = prepared.src;
        img.classList.remove('hidden');

        await new Promise((resolve, reject) => {
            if (img.complete && img.naturalWidth > 0) {
                resolve();
                return;
            }
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Crop preview failed to load'));
        });

        if (!document.getElementById('editorImageCropModal') || _editorCropperInstance || !img) return;
        _editorCropperInstance = new Cropper(img, {
            ...getEditorCropperOptions(),
            ready() {
                if (loadingEl) loadingEl.classList.add('hidden');
                if (saveBtn) saveBtn.disabled = false;
            }
        });
    } catch (err) {
        closeEditorImageCropModal();
        showToast(t('common.error'), 'error');
    }
}

function applyCroppedImagesToEditorUi(newsId, result) {
    const images = result.images || [];
    const selectedPath = result.selected_image_path || null;

    images.forEach(img => {
        const tile = document.querySelector(`.editor-img-tile[data-image-id="${img.id}"]`);
        const imgEl = tile?.querySelector('img');
        if (imgEl) imgEl.src = bustImageUrl(img.image_path);
    });

    const modalImg = document.querySelector('#articleModal .modal-image');
    if (modalImg && selectedPath) {
        modalImg.src = bustImageUrl(selectedPath);
        modalImg.style.display = '';
    }
}

async function saveEditorImageCrop(newsId, imageId) {
    if (!_editorCropperInstance) return;

    const saveBtn = document.getElementById('editorCropSaveBtn');
    const originalHtml = saveBtn?.innerHTML;
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `${icon('loader', 14)} सेव...`;
    }

    try {
        await waitForNextPaint();
        const limits = getEditorCropExportLimits();
        const canvas = _editorCropperInstance.getCroppedCanvas({
            maxWidth: limits.maxWidth,
            maxHeight: limits.maxHeight,
            fillColor: '#ffffff',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: limits.smoothing
        });
        if (!canvas) {
            showToast('क्रॉप एरिया चुनें', 'error');
            return;
        }

        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/jpeg', limits.quality);
        });
        if (!blob) {
            showToast(t('common.error'), 'error');
            return;
        }

        const formData = new FormData();
        formData.append('image', blob, `cropped-${imageId}.jpg`);

        const result = await api(`/editor/news/${newsId}/images/${imageId}/crop`, {
            method: 'POST',
            body: formData,
            isFormData: true
        });

        if (result.error) {
            showToast(result.error, 'error');
            return;
        }

        closeEditorImageCropModal();
        applyCroppedImagesToEditorUi(newsId, result);
        showToast(result.message || 'क्रॉप की गई फोटो सेव हो गई', 'success');

        setTimeout(async () => {
            await refreshEditorImagePickerInModal(newsId);
            if (document.getElementById('rawNewsList')) loadRawNews();
            if (document.getElementById('processedNewsList')) loadProcessedNews();
            if (document.getElementById('forwardedNewsList')) loadForwardedNews();
        }, 0);
    } catch (err) {
        showToast(t('common.error'), 'error');
    } finally {
        if (saveBtn && document.getElementById('editorCropSaveBtn')) {
            saveBtn.disabled = false;
            if (originalHtml) saveBtn.innerHTML = originalHtml;
            refreshIcons();
        }
    }
}

async function uploadEditorImages(newsId, inputEl) {
    const files = inputEl?.files;
    if (!files || files.length < 1) return;

    const formData = new FormData();
    for (const file of files) {
        formData.append('images', file);
    }

    const addBtn = inputEl.parentElement?.querySelector('button');
    const originalBtnHtml = addBtn?.innerHTML;
    if (addBtn) {
        addBtn.disabled = true;
        addBtn.innerHTML = `${icon('loader', 12)} अपलोड...`;
    }

    try {
        const result = await api(`/editor/news/${newsId}/images/upload`, {
            method: 'POST',
            body: formData,
            isFormData: true
        });

        if (result.error) {
            showToast(result.error, 'error');
            return;
        }

        await refreshEditorImagePickerInModal(newsId);

        const modalImg = document.querySelector('.modal-image');
        if (modalImg && result.selected_image_path) {
            modalImg.src = result.selected_image_path;
            modalImg.style.display = '';
        } else if (modalImg && !result.selected_image_path) {
            modalImg.remove();
        }

        if (document.getElementById('rawNewsList')) loadRawNews();
        if (document.getElementById('processedNewsList')) loadProcessedNews();
        if (document.getElementById('forwardedNewsList')) loadForwardedNews();
        showToast(result.message || 'फोटो जोड़ दी गई', 'success');
    } catch (err) {
        showToast(t('common.error'), 'error');
    } finally {
        inputEl.value = '';
        if (addBtn) {
            addBtn.disabled = false;
            if (originalBtnHtml) addBtn.innerHTML = originalBtnHtml;
            refreshIcons();
        }
    }
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
        if (event.target.closest('.editor-img-delete-btn') || event.target.closest('.editor-img-crop-btn')) return;
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
                await refreshEditorImagePickerInModal(newsId);
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
        targetWords: options.targetWords || 400,
        includeImageCaption: options.includeImageCaption !== false
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
        includeImageCaption: true,
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
                    <div class="selector-pills" id="captionEnablePills" style="margin-bottom: 10px;">
                        <button type="button" class="selector-pill active" data-val="1">इमेज कैप्शन चालू</button>
                        <button type="button" class="selector-pill" data-val="0">इमेज कैप्शन बंद</button>
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

    const captionPillsEl = document.getElementById('captionPills');
    const captionEnablePills = document.getElementById('captionEnablePills');
    function syncCaptionWordPills() {
        if (!captionPillsEl) return;
        const disabled = state.includeImageCaption === false;
        captionPillsEl.style.opacity = disabled ? '0.45' : '1';
        captionPillsEl.style.pointerEvents = disabled ? 'none' : 'auto';
    }
    if (captionEnablePills) {
        captionEnablePills.querySelectorAll('.selector-pill').forEach(pill => {
            pill.onclick = () => {
                captionEnablePills.querySelectorAll('.selector-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                state.includeImageCaption = pill.dataset.val !== '0';
                syncCaptionWordPills();
            };
        });
    }
    syncCaptionWordPills();

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
        if (endpoint === '/forward' || endpoint === '/forward-operator') {
            await loadForwardedNews();
        }
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

async function operatorForwardEditedNews(id, buttonEl = null) {
    const saved = await saveProcessedNewsEdits(id, { silent: true });
    if (!saved) return;
    await forwardNewsWithProgress(id, buttonEl, '/forward-operator', 'खबर सिर्फ ऑपरेटर को भेज दी गई', true);
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

async function quickOperatorForwardNews(id, buttonEl = null) {
    await forwardNewsWithProgress(id, buttonEl, '/forward-operator', 'खबर सिर्फ ऑपरेटर को भेज दी गई', false);
}

async function hideProcessedNewsFromEditor(id, buttonEl = null) {
    if (!confirm('क्या आप इस खबर को सिर्फ Processed सूची से हटाना चाहते हैं? (डेटाबेस / ऑपरेटर / वेबसाइट — कहीं और नहीं हटेगी)')) {
        return;
    }
    if (buttonEl) {
        buttonEl.disabled = true;
    }
    try {
        const result = await api(`/editor/news/${id}/hide-processed`, {
            method: 'POST',
            body: JSON.stringify({})
        });
        if (result.error) {
            showToast(result.error, 'error');
            if (buttonEl) buttonEl.disabled = false;
            return;
        }
        closeArticleModal();
        showToast(result.message || 'Processed सूची से हटा दिया गया', 'success');
        await loadProcessedNews();
    } catch (err) {
        showToast(t('common.error'), 'error');
        if (buttonEl) buttonEl.disabled = false;
    }
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
                    ${n.sub_editor_name ? `<span class="news-card-meta-item">${icon('bot',12)} उप-संपादक: ${escapeHtml(n.sub_editor_name_hi || n.sub_editor_name)}</span>` : ''}
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
        extraHtml = `${extraHtml}${renderEditorImagePicker(news, id)}`;

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
let _selectedApiRawNews = new Set();
// Single news id (from either list) marked as the lead/hero story for the
// next bundle send. Only one at a time; cleared whenever the selection or
// target changes so a stale lead id can never leak into a new bundle.
let _leadApiNewsId = null;
let _apiNewsCache = [];
let _apiRawNewsCache = [];
let _apiNewsSort = 'latest';
let _apiPdfPollTimer = null;
let _apiPdfElapsedTimer = null;
let _apiPdfWaitStartedAt = 0;

// Clears the (currently unused) PDF-wait polling timers and hides the wait
// status box. Was being called from backToApiTargets() without ever having
// been defined, which threw a ReferenceError and silently aborted the
// function before it could switch screens back -- i.e. the back button.
function stopApiPdfWait() {
    if (_apiPdfPollTimer) { clearInterval(_apiPdfPollTimer); _apiPdfPollTimer = null; }
    if (_apiPdfElapsedTimer) { clearInterval(_apiPdfElapsedTimer); _apiPdfElapsedTimer = null; }
    _apiPdfWaitStartedAt = 0;
    const status = document.getElementById('apiBundleWaitStatus');
    if (status) {
        status.classList.add('hidden');
        status.innerHTML = '';
    }
}

// Single back button for the API screen: goes up one level at a time --
// out of the news list to the target list, then out of the target list to
// the More menu -- instead of showing two stacked back buttons at once.
function apiScreenBack() {
    const newsSelection = document.getElementById('apiNewsSelection');
    if (newsSelection && !newsSelection.classList.contains('hidden')) {
        backToApiTargets();
    } else {
        switchEditorPane('more');
    }
}

function renderEditorApiScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('editor.title', 'server')}
        <main class="page-content" style="padding-bottom: 70px;">
            <div class="split-pane-header" style="padding: 12px 16px; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="btn btn-secondary btn-sm" onclick="apiScreenBack()">← वापस</button>
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
                        <strong id="apiSelectedTargetTitle" style="font-size:14px;"></strong>
                        <div>
                            <input type="checkbox" id="selectAllApiNews" onchange="toggleSelectAllApiNews(this.checked)">
                            <label for="selectAllApiNews" style="margin-left:8px; font-size:14px;">सभी चुनें</label>
                        </div>
                        <select class="form-input form-select api-sort-select" id="apiNewsSortSelect" onchange="changeApiNewsSort(this.value)">
                            <option value="latest">Latest to Oldest</option>
                            <option value="oldest">Oldest to Latest</option>
                        </select>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
                        <button class="btn btn-secondary btn-sm" id="apiRawBundleSendBtn" onclick="sendApiRawNewspaperBundle()" disabled>
                            📰 RAW खबरें PageMint भेजें (0)
                        </button>
                        <button class="btn btn-primary btn-sm" id="apiBundleSendBtn" onclick="sendApiNewspaperBundle()" disabled>
                            📰 AI rewritten खबरें PageMint भेजें (0)
                        </button>
                        <button class="btn btn-primary btn-sm" id="apiBothBundleSendBtn" onclick="sendApiBothNewspaperBundles()" disabled style="background:var(--accent-green,#16a34a); border-color:var(--accent-green,#16a34a);">
                            📰 RAW + AI दोनों भेजें (0)
                        </button>
                    </div>
                </div>
                <div id="apiBundleWaitStatus" class="api-bundle-wait hidden"></div>
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
            const rawCount = Number(t.raw_news_count || 0);
            return `
            <div class="card" style="display:flex; align-items:center; gap:16px; cursor:pointer; padding: 12px 16px; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='var(--card-bg)'" onclick="selectApiTarget(${t.id}, '${escapeHtml(t.full_name)}')">
                ${avatarHtml}
                <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                    <div style="font-weight:600; font-size:1.1rem; color:var(--text-primary);">${escapeHtml(t.full_name)}</div>
                    <div style="font-size:0.9rem; color:var(--text-secondary); margin-top:4px;">
                        <strong>${t.role === 'sub_editor' ? 'Sub-Editor' : 'API Reporter'}</strong> <span style="margin: 0 6px;">•</span> ${escapeHtml(t.district || t.city || 'No City')}
                    </div>
                    <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:4px;">
                        RAW: <strong style="color:${rawCount > 0 ? 'var(--accent-orange)' : 'inherit'}">${rawCount}</strong>
                        <span style="margin: 0 6px;">•</span>
                        AI rewritten: <strong style="color:${count > 0 ? 'var(--accent-green)' : 'inherit'}">${count}</strong>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                    <button type="button" class="btn btn-primary btn-xs" style="white-space:nowrap; background:var(--accent-green,#16a34a); border-color:var(--accent-green,#16a34a);"
                        onclick="event.stopPropagation(); generateApiPdfForTarget(${t.id}, '${escapeHtml(t.full_name)}', this)"
                        title="आज (24hr) की सभी RAW + AI rewritten खबरें एक साथ PageMint भेजें">
                        ${icon('send', 12)} PDF जनरेट करें
                    </button>
                    ${icon('chevron-right', 18)}
                </div>
            </div>
        `}).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

/**
 * One-click shortcut from the target list: pulls today's (आज / under-24h)
 * RAW and AI-rewritten news for this target and sends whichever of the two
 * bundles are non-empty to PageMint -- the same two API calls
 * sendApiBothNewspaperBundles() makes after a manual selection, just without
 * having to open the target and select every card by hand first.
 */
async function generateApiPdfForTarget(targetId, targetName, buttonEl) {
    if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = 'लोड हो रहा है...'; }

    let rawToday = [];
    let aiToday = [];
    try {
        const data = await api(`/editor/api-targets/${targetId}/news?sort=latest`);
        rawToday = (data.raw_news || []).filter(isApiNewsToday);
        aiToday = (data.news || []).filter(isApiNewsToday);
    } catch (err) {
        showToast(t('common.error'), 'error');
        if (buttonEl) { buttonEl.disabled = false; buttonEl.innerHTML = `${icon('send', 12)} PDF जनरेट करें`; }
        return;
    }

    if (rawToday.length === 0 && aiToday.length === 0) {
        showToast(`${targetName} की आज (24hr) की कोई RAW या AI rewritten खबर उपलब्ध नहीं है`, 'error');
        if (buttonEl) { buttonEl.disabled = false; buttonEl.innerHTML = `${icon('send', 12)} PDF जनरेट करें`; }
        return;
    }

    const parts = [];
    if (rawToday.length > 0) parts.push(`${rawToday.length} RAW`);
    if (aiToday.length > 0) parts.push(`${aiToday.length} AI rewritten`);
    if (!confirm(`क्या आप ${targetName} की आज की ${parts.join(' + ')} खबरें PageMint को भेजना चाहते हैं?`)) {
        if (buttonEl) { buttonEl.disabled = false; buttonEl.innerHTML = `${icon('send', 12)} PDF जनरेट करें`; }
        return;
    }

    if (buttonEl) buttonEl.textContent = 'भेज रहा है...';

    let rawOk = rawToday.length === 0;
    let aiOk = aiToday.length === 0;
    let firstError = null;

    if (rawToday.length > 0) {
        try {
            const res = await api('/editor/newspaper-generator/raw-bundle', {
                method: 'POST',
                body: JSON.stringify({ target_user_id: targetId, news_ids: rawToday.map(n => n.id), lead_news_id: null })
            });
            if (res.error) firstError = res.error; else rawOk = true;
        } catch (err) {
            firstError = t('common.error');
        }
    }

    if (aiToday.length > 0) {
        try {
            const res = await api('/editor/newspaper-generator/bundle', {
                method: 'POST',
                body: JSON.stringify({ target_user_id: targetId, news_ids: aiToday.map(n => n.id), lead_news_id: null })
            });
            if (res.error) firstError = firstError || res.error; else aiOk = true;
        } catch (err) {
            firstError = firstError || t('common.error');
        }
    }

    if (rawOk && aiOk) {
        showToast(`${targetName} की आज की ${parts.join(' + ')} खबरें भेज दी गईं`, 'success');
    } else if (rawOk || aiOk) {
        showToast(`एक बंडल भेज दिया गया, दूसरे में समस्या: ${firstError || ''}`, 'error');
    } else {
        showToast(firstError || t('common.error'), 'error');
    }

    await loadApiTargets();
}

function backToApiTargets() {
    stopApiPdfWait();
    document.getElementById('apiTargetsSelection').classList.remove('hidden');
    document.getElementById('apiNewsSelection').classList.add('hidden');
    _selectedApiTargetId = null;
    _selectedApiTargetName = '';
    _selectedApiNews.clear();
    _selectedApiRawNews.clear();
    _leadApiNewsId = null;
    _apiNewsCache = [];
    _apiRawNewsCache = [];
}

async function selectApiTarget(id, name) {
    _selectedApiTargetId = id;
    _selectedApiTargetName = name;
    document.getElementById('apiTargetsSelection').classList.add('hidden');
    document.getElementById('apiNewsSelection').classList.remove('hidden');
    _selectedApiNews.clear();
    _selectedApiRawNews.clear();
    _leadApiNewsId = null;
    updateApiBundleToolbar();
    const title = document.getElementById('apiSelectedTargetTitle');
    if (title) title.textContent = `${name} — PageMint API (RAW + AI)`;
    const sortSelect = document.getElementById('apiNewsSortSelect');
    if (sortSelect) sortSelect.value = _apiNewsSort;
    
    await loadNewsForApiTarget();
}

async function loadNewsForApiTarget() {
    const container = document.getElementById('apiNewsList');
    container.innerHTML = '<div class="loading-spinner" style="margin:40px auto;"></div>';

    try {
        const params = new URLSearchParams({ sort: _apiNewsSort });
        const data = await api(`/editor/api-targets/${_selectedApiTargetId}/news?${params.toString()}`);
        _apiNewsCache = data.news || [];
        _apiRawNewsCache = data.raw_news || [];
        renderApiNewsList();
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

function changeApiNewsSort(value) {
    _apiNewsSort = value === 'oldest' ? 'oldest' : 'latest';
    loadNewsForApiTarget();
}

function getApiNewsTimestamp(news) {
    const raw = news.processed_at || news.created_at || '';
    const parsed = Date.parse(String(raw).replace(' ', 'T'));
    return Number.isNaN(parsed) ? 0 : parsed;
}

// Calendar-date key (Asia/Kolkata, YYYY-MM-DD) for grouping the API news list
// into date-locked 24-hour windows -- midnight to midnight, not a rolling
// "last 24 hours from now" window. A news item filed at 11:58pm sits in
// today's group; the instant the clock passes midnight it moves into
// yesterday's group, even though its real age barely changed.
const API_NEWS_DATE_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
function getApiNewsDateKey(news) {
    const ts = getApiNewsTimestamp(news);
    if (!ts) return 'unknown';
    return API_NEWS_DATE_FMT.format(new Date(ts));
}

function isApiNewsToday(news) {
    return getApiNewsDateKey(news) === API_NEWS_DATE_FMT.format(new Date());
}

function formatApiNewsDateLabel(dateKey) {
    if (dateKey === 'unknown') return 'तारीख अज्ञात';
    const todayKey = API_NEWS_DATE_FMT.format(new Date());
    const yesterdayKey = API_NEWS_DATE_FMT.format(new Date(Date.now() - 86400000));
    if (dateKey === todayKey) return 'आज';
    if (dateKey === yesterdayKey) return 'कल';
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Intl.DateTimeFormat('hi-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/**
 * Groups an already-sorted news array into consecutive date buckets,
 * preserving the incoming sort order within and across buckets.
 */
function groupApiNewsByDate(sortedList) {
    const groups = [];
    let currentKey = null;
    for (const news of sortedList) {
        const key = getApiNewsDateKey(news);
        if (key !== currentKey) {
            groups.push({ key, label: formatApiNewsDateLabel(key), items: [] });
            currentKey = key;
        }
        groups[groups.length - 1].items.push(news);
    }
    return groups;
}

function getSortedApiNews() {
    const direction = _apiNewsSort === 'oldest' ? 1 : -1;
    return [..._apiNewsCache].sort((a, b) => {
        const timeDiff = getApiNewsTimestamp(a) - getApiNewsTimestamp(b);
        if (timeDiff !== 0) return timeDiff * direction;
        return (Number(a.id) - Number(b.id)) * direction;
    });
}

function getSortedApiRawNews() {
    const direction = _apiNewsSort === 'oldest' ? 1 : -1;
    return [..._apiRawNewsCache].sort((a, b) => {
        const timeDiff = getApiNewsTimestamp(a) - getApiNewsTimestamp(b);
        if (timeDiff !== 0) return timeDiff * direction;
        return (Number(a.id) - Number(b.id)) * direction;
    });
}

function renderApiNewsCard(news, { raw = false } = {}) {
    const selectedSet = raw ? _selectedApiRawNews : _selectedApiNews;
    const toggleFn = raw ? 'toggleApiRawNewsSelection' : 'toggleApiNewsSelection';
    const chkPrefix = raw ? 'api-raw-chk' : 'api-chk';
    const headline = raw ? news.headline : (news.headline_rewritten || news.headline);
    const badge = raw ? `<span class="status-badge raw" style="font-size:10px;margin-right:6px;">RAW</span>` : '';
    const isLead = _leadApiNewsId === news.id;
    const leadCardStyle = isLead
        ? 'border:2px solid var(--accent-orange, #e67e22); background:rgba(230,126,34,0.06);'
        : '';
    return `
        <div class="card api-news-card" onclick="${toggleFn}(${news.id})" id="api-${raw ? 'raw-' : ''}news-card-${news.id}" style="padding:12px; display:flex; gap:12px; cursor:pointer; ${leadCardStyle}">
            <input type="checkbox" id="${chkPrefix}-${news.id}" style="margin-top:4px;" onclick="event.stopPropagation(); ${toggleFn}(${news.id})" ${selectedSet.has(news.id) ? 'checked' : ''}>
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:0.95rem; line-height:1.4;">${badge}${isLead ? '<span style="font-size:10px;margin-right:6px;color:var(--accent-orange,#e67e22);">⭐ लीड न्यूज़</span>' : ''}<span style="color:var(--accent-orange);margin-right:4px;">#${news.id}</span>${escapeHtml(headline)}</div>
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:6px;">
                    ${escapeHtml(news.reporter_name || '')} • ${escapeHtml(news.city || '')} • ${formatDate(news.processed_at || news.created_at)}
                </div>
            </div>
            <button type="button" class="btn-icon" title="${isLead ? 'लीड न्यूज़ हटाएं' : 'मुख्य/लीड न्यूज़ बनाएं (PageMint front page)'}"
                onclick="event.stopPropagation(); toggleLeadApiNews(${news.id}, ${raw})"
                style="align-self:flex-start; background:none; border:none; font-size:18px; cursor:pointer; padding:2px 6px; opacity:${isLead ? '1' : '0.35'};">
                ⭐
            </button>
        </div>
    `;
}

function renderApiNewsList() {
    const container = document.getElementById('apiNewsList');
    if (!container) return;

    const sortedRaw = getSortedApiRawNews();
    const sortedNews = getSortedApiNews();
    const selectAll = document.getElementById('selectAllApiNews');
    if (selectAll) {
        const todayRaw = sortedRaw.filter(isApiNewsToday);
        const todayNews = sortedNews.filter(isApiNewsToday);
        selectAll.checked = (todayRaw.length + todayNews.length) > 0
            && todayRaw.every(n => _selectedApiRawNews.has(n.id))
            && todayNews.every(n => _selectedApiNews.has(n.id));
    }

    if (sortedRaw.length === 0 && sortedNews.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${escapeHtml(_selectedApiTargetName || 'इस यूज़र')} की कोई RAW या AI rewritten खबर उपलब्ध नहीं है</div></div>`;
        updateApiBundleToolbar();
        return;
    }

    const dateHeaderHtml = (label) => `
        <div class="api-news-date-header" style="margin:14px 0 6px; padding:4px 8px; font-size:12px; font-weight:700; color:var(--text-secondary); background:var(--bg-glass, #f1f5f9); border-radius:6px; width:fit-content;">
            ${escapeHtml(label)}
        </div>
    `;

    const sections = [];
    if (sortedRaw.length > 0) {
        sections.push(`
            <div style="margin-bottom:8px; font-size:13px; font-weight:600; color:var(--accent-orange); padding:0 4px;">
                RAW खबरें (बिना AI rewrite — इसी ${escapeHtml(_selectedApiTargetName)} ID पर PageMint)
            </div>
            ${groupApiNewsByDate(sortedRaw).map(group => `
                ${dateHeaderHtml(group.label)}
                ${group.items.map(news => renderApiNewsCard(news, { raw: true })).join('')}
            `).join('')}
        `);
    }
    if (sortedNews.length > 0) {
        sections.push(`
            <div style="margin:16px 0 8px; font-size:13px; font-weight:600; color:var(--text-secondary); padding:0 4px;">
                AI rewritten processed खबरें
            </div>
            ${groupApiNewsByDate(sortedNews).map(group => `
                ${dateHeaderHtml(group.label)}
                ${group.items.map(news => renderApiNewsCard(news, { raw: false })).join('')}
            `).join('')}
        `);
    }
    container.innerHTML = sections.join('');
    updateApiBundleToolbar();
}

function toggleApiNewsSelection(id) {
    const chk = document.getElementById(`api-chk-${id}`);
    if (_selectedApiNews.has(id)) {
        _selectedApiNews.delete(id);
        if (chk) chk.checked = false;
        if (_leadApiNewsId === id) { _leadApiNewsId = null; renderApiNewsList(); return; }
    } else {
        _selectedApiNews.add(id);
        if (chk) chk.checked = true;
    }
    const todayNews = getSortedApiNews().filter(isApiNewsToday);
    const selectAll = document.getElementById('selectAllApiNews');
    if (selectAll) selectAll.checked = todayNews.length > 0 && todayNews.every(n => _selectedApiNews.has(n.id));
    updateApiBundleToolbar();
}

// "सभी चुनें" only ever selects today's (आज / under-24h) news, in both the
// RAW and AI-rewritten lists -- older items sitting in yesterday's/earlier
// date groups are left untouched, so one click can't silently bundle
// already-aged news alongside today's.
function toggleSelectAllApiNews(checked) {
    getSortedApiRawNews().filter(isApiNewsToday).forEach(n => {
        if (checked) _selectedApiRawNews.add(n.id);
        else _selectedApiRawNews.delete(n.id);
        const chk = document.getElementById(`api-raw-chk-${n.id}`);
        if (chk) chk.checked = checked;
    });
    getSortedApiNews().filter(isApiNewsToday).forEach(n => {
        if (checked) _selectedApiNews.add(n.id);
        else _selectedApiNews.delete(n.id);
        const chk = document.getElementById(`api-chk-${n.id}`);
        if (chk) chk.checked = checked;
    });
    if (!checked && _leadApiNewsId != null && !_selectedApiNews.has(_leadApiNewsId) && !_selectedApiRawNews.has(_leadApiNewsId)) {
        _leadApiNewsId = null;
        renderApiNewsList();
        return;
    }
    updateApiBundleToolbar();
}

function toggleApiRawNewsSelection(id) {
    const chk = document.getElementById(`api-raw-chk-${id}`);
    if (_selectedApiRawNews.has(id)) {
        _selectedApiRawNews.delete(id);
        if (chk) chk.checked = false;
        if (_leadApiNewsId === id) { _leadApiNewsId = null; renderApiNewsList(); return; }
    } else {
        _selectedApiRawNews.add(id);
        if (chk) chk.checked = true;
    }
    const todayRaw = getSortedApiRawNews().filter(isApiNewsToday);
    const todayNews = getSortedApiNews().filter(isApiNewsToday);
    const selectAll = document.getElementById('selectAllApiNews');
    if (selectAll) {
        selectAll.checked = (todayRaw.length + todayNews.length) > 0
            && todayRaw.every(n => _selectedApiRawNews.has(n.id))
            && todayNews.every(n => _selectedApiNews.has(n.id));
    }
    updateApiBundleToolbar();
}

/**
 * Marks (or unmarks) a single news item as the lead/hero story for the next
 * bundle send. Only one at a time, across either list. Setting a lead also
 * selects its checkbox (a lead must be part of what's actually sent).
 */
function toggleLeadApiNews(id, raw) {
    if (_leadApiNewsId === id) {
        _leadApiNewsId = null;
    } else {
        _leadApiNewsId = id;
        const selectedSet = raw ? _selectedApiRawNews : _selectedApiNews;
        selectedSet.add(id);
    }
    renderApiNewsList();
}

function updateApiBundleToolbar() {
    const rawBtn = document.getElementById('apiRawBundleSendBtn');
    const btn = document.getElementById('apiBundleSendBtn');
    const bothBtn = document.getElementById('apiBothBundleSendBtn');
    if (rawBtn) {
        rawBtn.disabled = _selectedApiRawNews.size < 1;
        rawBtn.textContent = `📰 RAW खबरें PageMint भेजें (${_selectedApiRawNews.size})`;
    }
    if (btn) {
        btn.disabled = _selectedApiNews.size < 1;
        btn.textContent = `📰 AI rewritten खबरें PageMint भेजें (${_selectedApiNews.size})`;
    }
    if (bothBtn) {
        const total = _selectedApiRawNews.size + _selectedApiNews.size;
        bothBtn.disabled = _selectedApiRawNews.size < 1 || _selectedApiNews.size < 1;
        bothBtn.textContent = `📰 RAW + AI दोनों भेजें (${total})`;
    }
}

async function sendApiRawNewspaperBundle() {
    if (_selectedApiRawNews.size < 1) {
        showToast('कम से कम 1 RAW खबर चुनें', 'error');
        return;
    }
    if (!_selectedApiTargetId) {
        showToast('पहले API reporter / sub-editor चुनें', 'error');
        return;
    }
    const name = _selectedApiTargetName || 'इस यूज़र';
    if (!confirm(`क्या आप ${_selectedApiRawNews.size} RAW खबरों को ${name} की PageMint ID पर भेजना चाहते हैं? (मूल headline, body, images — बिना AI rewrite)`)) {
        return;
    }

    const btn = document.getElementById('apiRawBundleSendBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'भेज रहा है...';
    }

    const leadNewsId = _selectedApiRawNews.has(_leadApiNewsId) ? _leadApiNewsId : null;

    try {
        const res = await api('/editor/newspaper-generator/raw-bundle', {
            method: 'POST',
            body: JSON.stringify({
                target_user_id: _selectedApiTargetId,
                news_ids: Array.from(_selectedApiRawNews),
                lead_news_id: leadNewsId
            })
        });

        if (res.error) {
            showToast(res.error, 'error');
        } else {
            showToast(res.message || `${name} को RAW bundle भेज दिया गया`, 'success');
            _selectedApiRawNews.clear();
            _leadApiNewsId = null;
            await loadNewsForApiTarget();
        }
    } catch (err) {
        showToast(t('common.error'), 'error');
    } finally {
        updateApiBundleToolbar();
    }
}

async function sendRawNewsToPageMint(newsId, btn) {
    if (!confirm('क्या आप इस RAW खबर को बिना AI rewrite के PageMint API जनरेटर में भेजना चाहते हैं? (मूल headline, body और images — reporter/sub-editor ID के साथ)')) {
        return;
    }

    const button = btn || null;
    const originalHtml = button?.innerHTML;
    if (button) {
        button.disabled = true;
        button.textContent = 'भेज रहा है...';
    }

    try {
        const res = await api('/editor/newspaper-generator/raw-bundle', {
            method: 'POST',
            body: JSON.stringify({ news_id: newsId })
        });

        if (res.error) {
            showToast(res.error, 'error');
        } else {
            showToast(res.message || 'Raw खबर PageMint को भेज दी गई', 'success');
        }
    } catch (err) {
        showToast(t('common.error'), 'error');
    } finally {
        if (button) {
            button.disabled = false;
            if (originalHtml) button.innerHTML = originalHtml;
        }
    }
}

async function sendApiNewspaperBundle() {
    if (_selectedApiNews.size < 1) {
        showToast('कम से कम 1 AI rewritten खबर चुनें', 'error');
        return;
    }
    if (!confirm(`क्या आप ${_selectedApiNews.size} AI rewritten खबरों को PageMint PDF जनरेटर को भेजना चाहते हैं? बाकी खाली स्लॉट PageMint/Gautam API से भरे जा सकते हैं।`)) return;

    const btn = document.getElementById('apiBundleSendBtn');
    btn.disabled = true;
    btn.textContent = 'भेज रहा है...';

    const leadNewsId = _selectedApiNews.has(_leadApiNewsId) ? _leadApiNewsId : null;

    try {
        const res = await api('/editor/newspaper-generator/bundle', {
            method: 'POST',
            body: JSON.stringify({
                target_user_id: _selectedApiTargetId,
                news_ids: Array.from(_selectedApiNews),
                lead_news_id: leadNewsId
            })
        });

        if (res.error) {
            showToast(res.error, 'error');
            btn.disabled = false;
            btn.textContent = `📰 AI rewritten खबरें PageMint भेजें (${_selectedApiNews.size})`;
        } else {
            showToast(res.message, 'success');
            _selectedApiNews.clear();
            _leadApiNewsId = null;
            updateApiBundleToolbar();
            await loadNewsForApiTarget();
        }
    } catch (err) {
        showToast(t('common.error'), 'error');
        btn.disabled = false;
        btn.textContent = `📰 AI rewritten खबरें PageMint भेजें (${_selectedApiNews.size})`;
    }
}

/**
 * Sends the selected RAW news and the selected AI-rewritten news as two
 * back-to-back PageMint bundles from a single button, instead of requiring
 * the RAW and AI-rewritten sends to be triggered separately.
 */
async function sendApiBothNewspaperBundles() {
    if (_selectedApiRawNews.size < 1 || _selectedApiNews.size < 1) {
        showToast('RAW और AI rewritten, दोनों में से कम से कम 1-1 खबर चुनें', 'error');
        return;
    }
    if (!_selectedApiTargetId) {
        showToast('पहले API reporter / sub-editor चुनें', 'error');
        return;
    }
    const name = _selectedApiTargetName || 'इस यूज़र';
    if (!confirm(`क्या आप ${_selectedApiRawNews.size} RAW और ${_selectedApiNews.size} AI rewritten खबरें, दोनों को ${name} की PageMint ID पर भेजना चाहते हैं?`)) {
        return;
    }

    const bothBtn = document.getElementById('apiBothBundleSendBtn');
    const rawBtn = document.getElementById('apiRawBundleSendBtn');
    const btn = document.getElementById('apiBundleSendBtn');
    [bothBtn, rawBtn, btn].forEach(b => { if (b) b.disabled = true; });
    if (bothBtn) bothBtn.textContent = 'भेज रहा है...';

    const rawLeadNewsId = _selectedApiRawNews.has(_leadApiNewsId) ? _leadApiNewsId : null;
    const aiLeadNewsId = _selectedApiNews.has(_leadApiNewsId) ? _leadApiNewsId : null;
    const rawCount = _selectedApiRawNews.size;
    const aiCount = _selectedApiNews.size;

    let rawOk = false;
    let aiOk = false;
    let firstError = null;

    try {
        const rawRes = await api('/editor/newspaper-generator/raw-bundle', {
            method: 'POST',
            body: JSON.stringify({
                target_user_id: _selectedApiTargetId,
                news_ids: Array.from(_selectedApiRawNews),
                lead_news_id: rawLeadNewsId
            })
        });
        if (rawRes.error) firstError = rawRes.error; else rawOk = true;
    } catch (err) {
        firstError = t('common.error');
    }

    try {
        const aiRes = await api('/editor/newspaper-generator/bundle', {
            method: 'POST',
            body: JSON.stringify({
                target_user_id: _selectedApiTargetId,
                news_ids: Array.from(_selectedApiNews),
                lead_news_id: aiLeadNewsId
            })
        });
        if (aiRes.error) firstError = firstError || aiRes.error; else aiOk = true;
    } catch (err) {
        firstError = firstError || t('common.error');
    }

    if (rawOk && aiOk) {
        showToast(`${rawCount} RAW + ${aiCount} AI rewritten खबरें, दोनों बंडल भेज दिए गए`, 'success');
        _selectedApiRawNews.clear();
        _selectedApiNews.clear();
        _leadApiNewsId = null;
        await loadNewsForApiTarget();
    } else if (rawOk || aiOk) {
        showToast(`एक बंडल भेज दिया गया, दूसरे में समस्या: ${firstError || ''}`, 'error');
        if (rawOk) _selectedApiRawNews.clear();
        if (aiOk) _selectedApiNews.clear();
        await loadNewsForApiTarget();
    } else {
        showToast(firstError || t('common.error'), 'error');
    }

    updateApiBundleToolbar();
}

// ==========================================
// EDITOR MORE OPTIONS AND PDFS SCREEN
// ==========================================

/**
 * Full-screen view for 'More (अन्य)' Menu
 */
function renderEditorMoreOptionCard({ onclick, iconName, iconBg, iconColor, title, subtitle, titleI18n }) {
    return `
        <div class="more-option-card" onclick="${onclick}">
            <div class="more-option-icon" style="background:${iconBg}; color:${iconColor};">
                ${icon(iconName, 22)}
            </div>
            <div class="more-option-text">
                <div class="more-option-title"${titleI18n ? ` data-i18n="${titleI18n}"` : ''}>${title}</div>
                <div class="more-option-subtitle">${subtitle}</div>
            </div>
            ${icon('chevron-right', 20)}
        </div>
    `;
}

function renderEditorMoreScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('editor.title', 'menu')}
        <main class="page-content" style="padding-bottom: 70px;">
            <div class="split-pane-header" style="padding: 12px 16px; border-bottom: 1px solid var(--border-color);">
                <h3 style="margin: 0;">अन्य विकल्प (More Options)</h3>
            </div>

            <div style="padding: 16px; display: flex; flex-direction: column; gap: 14px;">
                ${renderEditorMoreOptionCard({
                    onclick: "switchEditorPane('api')",
                    iconName: 'user',
                    iconBg: 'var(--accent-orange-light)',
                    iconColor: 'var(--accent-orange)',
                    title: 'संवाददाता पेज',
                    subtitle: 'रिपोर्टर की खबरें चुनें और PageMint को PDF के लिए भेजें'
                })}

                ${renderEditorMoreOptionCard({
                    onclick: "switchEditorPane('pdfs')",
                    iconName: 'download',
                    iconBg: 'var(--accent-orange-light)',
                    iconColor: 'var(--accent-orange)',
                    title: 'PDF डाउनलोड करें',
                    subtitle: 'जनरेट हुई PDF फाइलें देखें और डाउनलोड करें'
                })}

                ${renderEditorMoreOptionCard({
                    onclick: "switchEditorPane('ads')",
                    iconName: 'tag',
                    iconBg: 'rgba(22, 163, 74, 0.12)',
                    iconColor: 'var(--accent-green)',
                    title: t('editor.ads_tab'),
                    titleI18n: 'editor.ads_tab',
                    subtitle: 'विज्ञापन प्रबंधित करें और स्वीकृत करें'
                })}
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
            const st = pdf.status === 'approved' || pdf.status === 'rejected' ? pdf.status : 'pending';

            const badge = st === 'approved'
                ? `<span class="status-badge processed">${icon('check', 10)} स्वीकृत</span>`
                : st === 'rejected'
                    ? `<span class="status-badge rejected">${icon('x', 10)} रिजेक्ट किया गया</span>`
                    : `<span class="status-badge raw">${icon('clock', 10)} समीक्षा हेतु लंबित</span>`;

            const actions = st === 'rejected' ? '' : `
                <div class="news-card-actions-row" style="border-top:none; margin-top:10px; padding-top:0;">
                    <button type="button" class="btn btn-secondary btn-xs" onclick="previewApiPdf(this)" data-pdf-url="${escapeHtml(pdf.pdf_url)}" data-pdf-filename="${escapeHtml(pdf.filename || 'newspaper.pdf')}">${icon('eye', 12)} देखें</button>
                    <a href="${forceDownloadUrl(pdf.pdf_url, pdf.filename)}" download="${escapeHtml(pdf.filename || 'newspaper.pdf')}" class="btn btn-secondary btn-xs">${icon('download', 12)} डाउनलोड</a>
                    ${st === 'pending' ? `
                        <button type="button" class="btn btn-success btn-xs" onclick="approveApiPdf(${pdf.id}, this)">${icon('check', 12)} स्वीकृत करें</button>
                        <button type="button" class="btn btn-danger btn-xs" onclick="rejectApiPdf(${pdf.id}, this)">${icon('x', 12)} रिजेक्ट करें</button>
                    ` : ''}
                </div>
            `;

            return `
                <div class="card news-card" id="editor-pdf-card-${pdf.id}" style="padding: 16px;">
                    <div style="display:flex; align-items:center; gap:16px;">
                        <div style="background: var(--accent-orange-light); padding: 12px; border-radius: 8px; color: var(--accent-orange); flex-shrink:0;">
                            ${icon('archive', 28)}
                        </div>
                        <div style="flex: 1; min-width:0;">
                            <div style="font-weight: 600; font-size: 1.02rem; color: var(--text-primary); word-break: break-all;">
                                ${escapeHtml(pdf.filename || 'newspaper.pdf')}
                            </div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">${dateStr}</div>
                            <div style="margin-top:6px;">${badge}</div>
                        </div>
                    </div>
                    ${actions}
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

/**
 * Opens a generated PDF in a scrollable in-app popup instead of a new
 * browser tab. The popup's own download button forces a real device
 * download via forceDownloadUrl (?dl=1 -> Content-Disposition: attachment),
 * same mechanism the card's regular download link already uses.
 */
function previewApiPdf(btn) {
    const pdfUrl = btn.dataset.pdfUrl;
    const filename = btn.dataset.pdfFilename || 'newspaper.pdf';
    closeArticleModal();
    enableModalPinchZoom();

    const html = `
        <div class="modal-overlay" id="articleModal" onclick="closeModalOutside(event)">
            <div class="modal-content" onclick="event.stopPropagation()" style="max-width:860px; width:100%; height:88vh; padding:0; display:flex; flex-direction:column; overflow:hidden;">
                <div class="modal-handle"></div>
                <button class="modal-close" onclick="closeArticleModal()">${icon('x', 14)}</button>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 52px 12px 16px; border-bottom:1px solid var(--border-color); flex-shrink:0;">
                    <div style="font-weight:600; font-size:0.9rem; word-break:break-all;">${escapeHtml(filename)}</div>
                    <a href="${forceDownloadUrl(pdfUrl, filename)}" download="${escapeHtml(filename)}" class="btn btn-primary btn-xs" style="flex-shrink:0;">${icon('download', 12)} डाउनलोड</a>
                </div>
                <iframe src="${pdfUrl}" style="flex:1; width:100%; border:none;" title="${escapeHtml(filename)}"></iframe>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    document.body.style.overflow = 'hidden';
    applyLanguage();
}

async function approveApiPdf(id, btn) {
    if (btn) btn.disabled = true;
    try {
        const res = await api(`/editor/api-pdfs/${id}/approve`, { method: 'POST', body: JSON.stringify({}) });
        if (res.error) { showToast(res.error, 'error'); if (btn) btn.disabled = false; return; }
        showToast('PDF स्वीकृत कर दी गई', 'success');
        await loadPdfsForSelectedTarget();
    } catch (err) {
        showToast(t('common.error'), 'error');
        if (btn) btn.disabled = false;
    }
}

async function rejectApiPdf(id, btn) {
    if (!confirm('क्या आप वाकई इस PDF को रिजेक्ट करना चाहते हैं? फाइल हमेशा के लिए डिलीट हो जाएगी।')) return;
    if (btn) btn.disabled = true;
    try {
        const res = await api(`/editor/api-pdfs/${id}/reject`, { method: 'POST', body: JSON.stringify({}) });
        if (res.error) { showToast(res.error, 'error'); if (btn) btn.disabled = false; return; }
        showToast('PDF रिजेक्ट कर दी गई', 'success');
        await loadPdfsForSelectedTarget();
    } catch (err) {
        showToast(t('common.error'), 'error');
        if (btn) btn.disabled = false;
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


// ==========================================
// EDITOR ADS SCREEN
// ==========================================

function renderEditorAdsScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('editor.title', 'dollar-sign')}
        <main class="page-content" style="padding-bottom: 70px;">
            <div class="split-pane-header" style="padding: 12px 16px; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="btn btn-secondary btn-sm" onclick="switchEditorPane('more')">← वापस</button>
                    <h3 style="margin: 0;" data-i18n="editor.ads_tab">${t('editor.ads_tab') || 'Advertisement Panel'}</h3>
                </div>
            </div>
            
            <div style="padding: 16px;">
                <div style="display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px;">
                    <button class="btn btn-primary btn-sm" id="btnPendingAds" onclick="loadEditorPendingAds()">पेंडिंग विज्ञापन</button>
                    <button class="btn btn-secondary btn-sm" id="btnApprovedAds" onclick="loadEditorApprovedAds()">स्वीकृत विज्ञापन</button>
                </div>
                
                <div id="editorAdsList" style="display: flex; flex-direction: column; gap: 12px;">
                    <div class="loading-spinner"></div>
                </div>
            </div>
        </main>
        ${renderBottomNav('editor', 'more')}
    `;
    applyLanguage();
    loadEditorPendingAds();
}

let currentEditorAdStatus = 'pending';

async function loadEditorPendingAds() {
    currentEditorAdStatus = 'pending';
    const btnP = document.getElementById('btnPendingAds');
    const btnA = document.getElementById('btnApprovedAds');
    if(btnP) btnP.className = 'btn btn-primary btn-sm';
    if(btnA) btnA.className = 'btn btn-secondary btn-sm';
    
    const container = document.getElementById('editorAdsList');
    if(!container) return;
    container.innerHTML = '<div class="loading-spinner" style="margin:40px auto;"></div>';
    
    try {
        const data = await api('/advertisements/pending');
        const ads = data.ads || [];
        
        if (ads.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-text">कोई पेंडिंग विज्ञापन नहीं है</div></div>`;
            return;
        }
        
        container.innerHTML = ads.map(a => renderEditorAdCard(a, true)).join('');
    } catch(err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

async function loadEditorApprovedAds() {
    currentEditorAdStatus = 'approved';
    const btnP = document.getElementById('btnPendingAds');
    const btnA = document.getElementById('btnApprovedAds');
    if(btnP) btnP.className = 'btn btn-secondary btn-sm';
    if(btnA) btnA.className = 'btn btn-primary btn-sm';
    
    const container = document.getElementById('editorAdsList');
    if(!container) return;
    container.innerHTML = '<div class="loading-spinner" style="margin:40px auto;"></div>';
    
    try {
        const data = await api('/advertisements/approved');
        const ads = data.ads || [];
        
        if (ads.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-text">कोई स्वीकृत विज्ञापन नहीं है</div></div>`;
            return;
        }
        
        container.innerHTML = ads.map(a => renderEditorAdCard(a, false)).join('');
    } catch(err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

function renderEditorAdCard(a, isPending) {
    const isImage = a.file_type && a.file_type.startsWith('image/');
    const previewHtml = isImage 
        ? `<a href="${a.file_path}" target="_blank"><img src="${a.file_path}" style="width:100%; height:150px; object-fit:cover; border-radius:8px;"></a>`
        : `<a href="${a.file_path}" target="_blank" style="text-decoration:none;"><div style="background:var(--bg-secondary); width:100%; height:150px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-direction:column; color:var(--accent-blue);">
            ${icon('file-text', 48)}
            <span style="margin-top:8px; font-weight:500;">View Document</span>
           </div></a>`;

    const btnHtml = isPending ? `
        <div style="display:flex; gap:8px; margin-top:12px;">
            <button class="btn btn-primary" style="flex:1;" onclick="approveEditorAd(${a.id})">${icon('check', 16)} स्वीकृत करें</button>
            <button class="btn btn-secondary" style="flex:1; background:var(--danger-color); color:#fff; border:none;" onclick="rejectEditorAd(${a.id})">${icon('x', 16)} अस्वीकृत करें</button>
        </div>
    ` : `
        <div style="display:flex; gap:8px; margin-top:12px;">
            <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="sendEditorAdToOperator(${a.id})">${icon('send', 16)} ऑपरेटर को भेजें</button>
        </div>
    `;

    return `
        <div class="card" style="padding:16px;">
            ${previewHtml}
            <div style="margin-top:12px;">
                <div style="font-weight:600; font-size:1.1rem; color:var(--text-primary);">${escapeHtml(a.ad_type || 'Unknown Type')}</div>
                <div style="font-size:0.9rem; color:var(--text-secondary); margin-top:4px;">
                    Sub-Editor: ${escapeHtml(a.sub_editor_name || 'Unknown')} (${escapeHtml(a.sub_editor_district || 'No District')})
                </div>
                <div style="font-size:0.9rem; color:var(--text-secondary); margin-top:2px;">
                    Size: ${escapeHtml(a.size || '-')} • Price: ₹${a.price || 0}
                </div>
                ${a.note_sub_editor ? `<div style="font-size:0.85rem; color:var(--text-secondary); margin-top:8px; padding:8px; background:var(--bg-secondary); border-radius:4px;">${escapeHtml(a.note_sub_editor)}</div>` : ''}
                ${!isPending && a.status === 'sent_to_operator' ? `<div style="font-size:0.85rem; color:var(--accent-blue); margin-top:8px; font-weight:500;">ऑपरेटर को भेजा जा चुका है</div>` : ''}
                
                ${a.status !== 'sent_to_operator' ? btnHtml : ''}
            </div>
        </div>
    `;
}

async function approveEditorAd(id) {
    if(!confirm('क्या आप इस विज्ञापन को स्वीकृत करना चाहते हैं?')) return;
    try {
        const res = await api('/advertisements/' + id + '/approve', {
            method: 'POST',
            body: JSON.stringify({ note_editor: '' })
        });
        showToast('विज्ञापन स्वीकृत किया गया', 'success');
        if (currentEditorAdStatus === 'pending') loadEditorPendingAds();
        else loadEditorApprovedAds();
    } catch(err) {
        showToast(err.message || 'Error', 'error');
    }
}

async function rejectEditorAd(id) {
    const reason = prompt('अस्वीकृत करने का कारण:');
    if(reason === null) return;
    try {
        const res = await api('/advertisements/' + id + '/reject', {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
        showToast('विज्ञापन अस्वीकृत किया गया', 'success');
        if (currentEditorAdStatus === 'pending') loadEditorPendingAds();
        else loadEditorApprovedAds();
    } catch(err) {
        showToast(err.message || 'Error', 'error');
    }
}

async function sendEditorAdToOperator(id) {
    if(!confirm('क्या आप इसे ऑपरेटर को भेजना चाहते हैं?')) return;
    try {
        const res = await api('/advertisements/' + id + '/send-to-operator', {
            method: 'POST'
        });
        showToast('ऑपरेटर को भेजा गया', 'success');
        if (currentEditorAdStatus === 'pending') loadEditorPendingAds();
        else loadEditorApprovedAds();
    } catch(err) {
        showToast(err.message || 'Error', 'error');
    }
}
