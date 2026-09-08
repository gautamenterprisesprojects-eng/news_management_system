/* ============================================================
   REPORTER PAGE — Submit news + view own submissions
   ============================================================ */

let reporterTab = 'submit';

function renderReporter() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('reporter.title', null, 'newspaper')}
        <main class="page-content" id="reporterContent">
        </main>
        ${renderBottomNav('reporter', reporterTab)}
    `;
    applyLanguage();
    switchTab(reporterTab);
}

function renderReporterSubmitTab() {
    const content = document.getElementById('reporterContent');
    content.innerHTML = `
        <div class="page-header">
            <h2 data-i18n="reporter.submit_news">${t('reporter.submit_news')}</h2>
        </div>

        <form id="newsForm">
            <div class="form-group">
                <label class="form-label" data-i18n="reporter.body">News Content</label>
                <textarea class="form-input" id="newsBody" required rows="6"
                          data-i18n-placeholder="reporter.body_placeholder"
                          placeholder="${t('reporter.body_placeholder')}"></textarea>
            </div>

            <div class="form-group">
                <label class="form-label" data-i18n="reporter.category">${t('reporter.category')}</label>
                <select class="form-input form-select" id="newsCategory" required>
                    <option value="regional" data-i18n="reporter.cat_regional" selected>${t('reporter.cat_regional')}</option>
                    <option value="regional_district" data-i18n="reporter.cat_regional_district">${t('reporter.cat_regional_district')}</option>
                    <option value="politics" data-i18n="reporter.cat_politics">${t('reporter.cat_politics')}</option>
                    <option value="crime" data-i18n="reporter.cat_crime">${t('reporter.cat_crime')}</option>
                    <option value="sports" data-i18n="reporter.cat_sports">${t('reporter.cat_sports')}</option>
                    <option value="business" data-i18n="reporter.cat_business">${t('reporter.cat_business')}</option>
                    <option value="entertainment" data-i18n="reporter.cat_entertainment">${t('reporter.cat_entertainment')}</option>
                    <option value="technology" data-i18n="reporter.cat_technology">${t('reporter.cat_technology')}</option>
                    <option value="health" data-i18n="reporter.cat_health">${t('reporter.cat_health')}</option>
                    <option value="education" data-i18n="reporter.cat_education">${t('reporter.cat_education')}</option>
                    <option value="local" data-i18n="reporter.cat_local">${t('reporter.cat_local')}</option>
                    <option value="national" data-i18n="reporter.cat_national">${t('reporter.cat_national')}</option>
                    <option value="international" data-i18n="reporter.cat_international">${t('reporter.cat_international')}</option>
                    <option value="other" data-i18n="reporter.cat_other">${t('reporter.cat_other')}</option>
                </select>
            </div>

            <div class="form-group">
                <label class="form-label" data-i18n="reporter.tags">${t('reporter.tags')}</label>
                <input type="text" class="form-input" id="newsTags"
                       data-i18n-placeholder="reporter.tags_placeholder"
                       placeholder="${t('reporter.tags_placeholder')}">
            </div>

            <div class="form-group">
                <label class="form-label" data-i18n="reporter.city">${t('reporter.city')}</label>
                <div style="position:relative;">
                    <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);display:flex;align-items:center;color:var(--text-secondary);">${icon('pin', 14)}</span>
                    <input type="text" class="form-input" id="newsCity" style="padding-left:30px;"
                           data-i18n-placeholder="reporter.city_placeholder"
                           placeholder="${t('reporter.city_placeholder')}">
                </div>
            </div>

            <!-- Multi-image upload -->
            <div class="form-group">
                <label class="form-label">
                    ${icon('photos', 14)} ${t('reporter.image') || 'Images'}
                    <span style="font-size:0.75rem;color:var(--text-secondary);font-weight:400;margin-left:6px;">(${t('reporter.image_multi_hint') || 'Up to 10 photos'})</span>
                </label>

                <!-- Drop zone -->
                <div class="image-upload-area multi-upload-zone" id="multiImageUploadArea" onclick="document.getElementById('newsImages').click()">
                    <div class="upload-icon-svg">${icon('upload', 28)}</div>
                    <div class="upload-text" data-i18n="reporter.image_upload">${t('reporter.image_upload')}</div>
                    <div class="upload-text" style="font-size:0.72rem;margin-top:4px;color:var(--text-secondary);">${t('reporter.image_upload_hint') || 'JPG, PNG, WebP • Max 10MB each'}</div>
                    <input type="file" id="newsImages" accept="image/*" multiple onchange="previewMultiImages(this)" style="display:none;">
                </div>

                <!-- Thumbnail strip -->
                <div class="multi-image-strip hidden" id="multiImageStrip"></div>
            </div>

            <button type="submit" class="btn btn-primary btn-full" id="submitBtn"
                    onclick="submitNews(event)" data-i18n="reporter.submit_btn">
                ${icon('send', 14)} ${t('reporter.submit_btn')}
            </button>
        </form>
    `;
    applyLanguage();
    setupMultiImageDrop();
}

/* ── Multi-image handling ─────────────────────────────────── */

let _selectedFiles = [];
const MAX_REPORTER_IMAGE_BYTES = 10 * 1024 * 1024;

function setupMultiImageDrop() {
    const zone = document.getElementById('multiImageUploadArea');
    if (!zone) return;

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        addFilesToStrip(files);
    });
}

function previewMultiImages(input) {
    const files = Array.from(input.files);
    addFilesToStrip(files);
    // Reset input so same files can be added again if needed
    input.value = '';
}

function addFilesToStrip(files) {
    files.forEach(f => {
        if (_selectedFiles.length >= 10) {
            showToast('Maximum 10 photos allowed', 'error');
            return;
        }
        if (!f.type || !f.type.startsWith('image/')) {
            showToast(`${f.name || 'Selected file'} is not an image`, 'error');
            return;
        }
        if (f.size > MAX_REPORTER_IMAGE_BYTES) {
            showToast(`${f.name || 'Selected image'} is larger than 10MB`, 'error');
            return;
        }
        _selectedFiles.push(f);
    });
    renderImageStrip();
}

function removeImageFromStrip(idx) {
    _selectedFiles.splice(idx, 1);
    renderImageStrip();
}

function renderImageStrip() {
    const strip = document.getElementById('multiImageStrip');
    const zone = document.getElementById('multiImageUploadArea');
    if (!strip) return;

    if (_selectedFiles.length === 0) {
        strip.classList.add('hidden');
        if (zone) zone.classList.remove('hidden');
        return;
    }

    strip.classList.remove('hidden');
    strip.innerHTML = _selectedFiles.map((f, idx) => {
        const url = URL.createObjectURL(f);
        return `
            <div class="multi-thumb-item" id="thumb-${idx}">
                <img src="${url}" alt="Image ${idx + 1}" class="multi-thumb-img">
                ${idx === 0 ? `<div class="multi-thumb-badge">Main</div>` : ''}
                <button type="button" class="multi-thumb-remove" onclick="removeImageFromStrip(${idx})" title="Remove">
                    ${icon('x', 10)}
                </button>
            </div>
        `;
    }).join('');

    // Add "add more" tile if under limit
    if (_selectedFiles.length < 10) {
        strip.innerHTML += `
            <div class="multi-thumb-add" onclick="document.getElementById('newsImages').click()" title="Add more">
                ${icon('plus', 20)}
                <span style="font-size:0.65rem;margin-top:2px;">Add</span>
            </div>
        `;
    }
}

/* ── Submit ──────────────────────────────────────────────── */

async function submitNews(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const body = document.getElementById('newsBody').value.trim();
    const headline = body.substring(0, 50).replace(/\n/g, ' ') + (body.length > 50 ? '...' : '');
    const category = document.getElementById('newsCategory').value;
    const tags = document.getElementById('newsTags').value.trim();
    const city = document.getElementById('newsCity').value.trim();

    if (!body || !category) {
        showToast(t('common.required'), 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `${icon('loader', 14)} ${t('reporter.submitting')}`;

    const formData = new FormData();
    formData.append('headline', headline);
    formData.append('body', body);
    formData.append('category', category);
    if (tags) formData.append('tags', tags);
    if (city) formData.append('city', city);

    // Append all selected images
    _selectedFiles.forEach(f => formData.append('images', f));

    try {
        const data = await api('/reporter/news', {
            method: 'POST',
            body: formData,
            isFormData: true
        });

        if (data.error) {
            showToast(data.error, 'error');
        } else {
            showToast(`${t('reporter.submit_success')} (Article ID: ${data.id})`, 'success');
            document.getElementById('newsForm').reset();
            _selectedFiles = [];
            renderImageStrip();
        }
    } catch (err) {
        showToast(t('common.error'), 'error');
    }

    btn.disabled = false;
    btn.innerHTML = `${icon('send', 14)} ${t('reporter.submit_btn')}`;
    applyLanguage();
}

/* ── My News tab ─────────────────────────────────────────── */

function renderReporterMyNewsTab() {
    const content = document.getElementById('reporterContent');
    content.innerHTML = `
        <div class="page-header">
            <h2 data-i18n="reporter.my_submissions">${t('reporter.my_submissions')}</h2>
        </div>
        <div id="myNewsList">
            <div class="loading-spinner" style="margin: 40px auto;"></div>
        </div>
    `;
    applyLanguage();
    loadMyNews();
}

async function loadMyNews() {
    const container = document.getElementById('myNewsList');
    try {
        const data = await api('/reporter/news');
        if (!data || !data.news || data.news.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-svg">${icon('inbox', 40)}</div>
                    <div class="empty-text" data-i18n="reporter.no_news">${t('reporter.no_news')}</div>
                </div>
            `;
            applyLanguage();
            return;
        }

        container.innerHTML = data.news.map(n => `
            <div class="card news-card">
                <div class="news-card-info">
                    <div class="news-card-headline"><span style="color:var(--accent-orange);margin-right:6px;">#${n.id}</span>${escapeHtml(n.headline)}</div>
                    <div class="news-card-meta">
                        <span class="status-badge ${n.status}">${t('editor.status_' + n.status) || n.status.toUpperCase()}</span>
                        <span class="news-card-meta-item">${icon('folder', 12)} ${n.category}</span>
                        ${n.city ? `<span class="news-card-meta-item">${icon('pin', 12)} ${n.city}</span>` : ''}
                        <span class="news-card-meta-item">${icon('clock', 12)} ${formatDate(n.created_at)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

function renderReporterExternalLinks(news) {
    const primaryUrl = news.external_hindi_url || news.external_english_url;
    const buttons = [];

    if (primaryUrl) {
        buttons.push(`<button class="btn btn-secondary btn-xs" onclick="copyReporterArticleLink('${encodeURIComponent(primaryUrl)}')">${icon('copy', 12)} Copy URL</button>`);
    } else {
        buttons.push(`<button class="btn btn-secondary btn-xs btn-disabled" type="button" disabled title="URL is available after publishing">${icon('copy', 12)} URL pending</button>`);
    }

    if (news.external_hindi_url && news.external_english_url) {
        buttons.push(`<button class="btn btn-secondary btn-xs" onclick="copyReporterArticleLink('${encodeURIComponent(news.external_english_url)}')">${icon('copy', 12)} EN URL</button>`);
    }

    return `<div class="news-card-actions-row">${buttons.join('')}</div>`;
}

async function copyReporterArticleLink(url) {
    const decodedUrl = decodeURIComponent(url);
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(decodedUrl);
        } else {
            const temp = document.createElement('textarea');
            temp.value = decodedUrl;
            temp.style.position = 'fixed';
            temp.style.left = '-9999px';
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
        }
        showToast('URL copied', 'success');
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

/* ── Approved tab ────────────────────────────────────────── */

function renderReporterApprovedTab() {
    const content = document.getElementById('reporterContent');
    content.innerHTML = `
        <div class="page-header">
            <h2 data-i18n="reporter.approved_news">${t('reporter.approved_news') || 'Approved News'}</h2>
        </div>
        <div id="approvedNewsList">
            <div class="loading-spinner" style="margin: 40px auto;"></div>
        </div>
    `;
    applyLanguage();
    loadReporterApprovedNews();
}

async function loadReporterApprovedNews() {
    const container = document.getElementById('approvedNewsList');
    try {
        const data = await api('/reporter/news/approved');
        if (!data || !data.news || data.news.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-svg">${icon('check-circle', 40)}</div>
                    <div class="empty-text" data-i18n="reporter.no_approved">${t('reporter.no_approved') || 'No approved news yet'}</div>
                </div>
            `;
            applyLanguage();
            return;
        }

        container.innerHTML = data.news.map(n => `
            <div class="card news-card">
                <div class="news-card-header">
                    ${n.image_path
                        ? `<img class="news-card-thumb" src="${n.image_path}" alt="" onerror="this.style.display='none'">`
                        : `<div class="news-card-thumb-placeholder">${icon('newspaper', 22)}</div>`
                    }
                    <div class="news-card-info">
                        <div class="news-card-headline"><span style="color:var(--accent-orange);margin-right:6px;">#${n.id}</span>${escapeHtml(n.headline_rewritten || n.headline)}</div>
                    </div>
                </div>
                <div class="news-card-meta">
                    <span class="status-badge ${n.status}">${t('editor.status_' + n.status) || n.status.toUpperCase()}</span>
                    <span class="news-card-meta-item">${icon('folder', 12)} ${n.category}</span>
                    ${n.city ? `<span class="news-card-meta-item">${icon('pin', 12)} ${n.city}</span>` : ''}
                    <span class="news-card-meta-item">${icon('clock', 12)} ${formatDate(n.published_at || n.forwarded_at || n.processed_at)}</span>
                </div>
                ${renderReporterExternalLinks(n)}
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

/* ── Rejected tab ────────────────────────────────────────── */

function renderReporterRejectedTab() {
    const content = document.getElementById('reporterContent');
    content.innerHTML = `
        <div class="page-header">
            <h2 data-i18n="reporter.rejected_news">${t('reporter.rejected_news') || 'Rejected News'}</h2>
        </div>
        <div id="rejectedNewsList">
            <div class="loading-spinner" style="margin: 40px auto;"></div>
        </div>
    `;
    applyLanguage();
    loadReporterRejectedNews();
}

async function loadReporterRejectedNews() {
    const container = document.getElementById('rejectedNewsList');
    try {
        const data = await api('/reporter/news/rejected');
        if (!data || !data.news || data.news.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-svg">${icon('x-circle', 40)}</div>
                    <div class="empty-text" data-i18n="reporter.no_rejected">${t('reporter.no_rejected') || 'No rejected news'}</div>
                </div>
            `;
            applyLanguage();
            return;
        }

        container.innerHTML = data.news.map(n => `
            <div class="card news-card">
                <div class="news-card-info" style="width: 100%;">
                    <div class="news-card-headline" style="color: #64748b; text-decoration: line-through;"><span style="color:var(--accent-orange);margin-right:6px;text-decoration:none;">#${n.id}</span>${escapeHtml(n.headline)}</div>
                    <div class="news-card-body" style="color: #dc2626; font-size: 0.85rem; margin-top: 6px;">
                        <strong>Rejected by ${escapeHtml(n.rejected_by_name)}:</strong> ${escapeHtml(n.reject_reason || 'No reason provided')}
                    </div>
                </div>
                <div class="news-card-meta" style="margin-top: 12px;">
                    <span class="status-badge" style="background: #fee2e2; color: #b91c1c;">${t('editor.status_rejected')}</span>
                    <span class="news-card-meta-item">${icon('folder', 12)} ${n.category}</span>
                    <span class="news-card-meta-item">${icon('clock', 12)} ${formatDate(n.rejected_at)}</span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

function renderReporterPdfsTab() {
    const content = document.getElementById('reporterContent');
    content.innerHTML = `
        <div class="page-header">
            <h2>जनरेटेड PDFs</h2>
            <p>API द्वारा जनरेट की गई आपकी PDF फाइलें</p>
        </div>
        <div id="reporterPdfsList">
            <div class="loading-spinner" style="margin: 40px auto;"></div>
        </div>
    `;
    applyLanguage();
    loadReporterPdfs();
}

async function loadReporterPdfs() {
    const container = document.getElementById('reporterPdfsList');
    try {
        const data = await api('/webhook/my-pdfs');
        const pdfs = data.pdfs || [];
        
        if (pdfs.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-text">कोई PDF उपलब्ध नहीं है</div></div>`;
            return;
        }

        container.innerHTML = pdfs.map(pdf => {
            const dateStr = new Date(pdf.created_at).toLocaleString('hi-IN');
            return `
                <div class="card" style="padding: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 16px;">
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
        container.innerHTML = `<div class="empty-state"><div class="empty-text">Error loading PDFs</div></div>`;
    }
}
