/* ============================================================
   SUB-EDITOR PAGE - review, reject, forward to main editor
   ============================================================ */

let subEditorTab = 'pending';

function renderSubEditor() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('editor.title', null, 'clipboard-check')}
        <main class="page-content">
            <div class="page-header">
                <h2>सब-एडिटर पैनल</h2>
                <p>रिपोर्टर की कच्ची खबर जांचें और मुख्य एडिटर को भेजें।</p>
            </div>
            <div id="subEditorNewsList">
                <div class="loading-spinner" style="margin:40px auto;"></div>
            </div>
        </main>
        ${renderBottomNav('sub_editor', subEditorTab)}
    `;
    applyLanguage();
    renderSubEditorTab(subEditorTab);
}

async function renderSubEditorTab(tab) {
    subEditorTab = tab || 'pending';
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === subEditorTab);
    });

    const container = document.getElementById('subEditorNewsList');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner" style="margin:40px auto;"></div>';

    try {
        if (subEditorTab === 'pdfs') {
            loadSubEditorPdfs(container);
            return;
        }

        if (subEditorTab === 'ads') {
            container.innerHTML = `
                <div class="card" style="margin-bottom: var(--space-md);">
                    <h3>विज्ञापन अपलोड करें</h3>
                    <form id="adUploadForm" onsubmit="submitSubEditorAd(event)">
                        <div class="form-group">
                            <label class="form-label">विज्ञापन प्रकार</label>
                            <select class="form-input form-select" id="adUploadType" required>
                                <option value="website">Website</option>
                                <option value="print_edition">Print Edition</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">विज्ञापन फाइल (PDF / Image)</label>
                            <input type="file" class="form-input" id="adUploadFile" accept=".pdf,image/*" required>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <div class="form-group" style="flex:1;">
                                <label class="form-label">साइज (Size)</label>
                                <input type="text" class="form-input" id="adUploadSize" placeholder="e.g. 6x4 inch">
                            </div>
                            <div class="form-group" style="flex:1;">
                                <label class="form-label">कीमत (Price)</label>
                                <input type="text" class="form-input" id="adUploadPrice" placeholder="e.g. ₹5000">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">टिप्पणी (Note)</label>
                            <textarea class="form-input" id="adUploadNote" rows="2" placeholder="मुख्य एडिटर के लिए नोट..."></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary" id="adUploadBtn">अपलोड करें</button>
                    </form>
                </div>
                <div id="subEditorAdsList"></div>
            `;
            loadSubEditorAds();
            return;
        }

        const data = await api(`/sub-editor/news/${subEditorTab}`);
        const news = data.news || [];
        if (!news.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-svg">${icon('inbox', 40)}</div>
                    <div class="empty-text">यहां कोई ${subEditorTab === 'ads' ? 'विज्ञापन' : 'खबर'} नहीं है</div>
                </div>
            `;
            return;
        }

        container.innerHTML = news.map(n => `
            <div class="card news-card" onclick="openSubEditorNews(${n.id})">
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
                    <span class="status-badge ${n.sub_editor_status === 'forwarded' ? 'forwarded' : n.sub_editor_status === 'rejected' ? 'rejected' : 'raw'}">${subEditorStatusLabel(n.sub_editor_status)}</span>
                    <span class="news-card-meta-item">${icon('folder',12)} ${escapeHtml(n.category || '')}</span>
                    ${n.city ? `<span class="news-card-meta-item">${icon('pin',12)} ${escapeHtml(n.city)}</span>` : ''}
                    <span class="news-card-meta-item">${icon('user',12)} ${escapeHtml(n.reporter_name || '')}</span>
                    <span class="news-card-meta-item">${icon('clock',12)} ${formatDate(n.created_at)}</span>
                </div>
                ${subEditorTab === 'pending' ? `
                    <div class="news-card-actions-row">
                        <button class="btn btn-primary btn-xs" onclick="event.stopPropagation(); forwardSubEditorNews(${n.id}, this)">
                            ${icon('send',12)} मुख्य एडिटर को भेजें
                        </button>
                        <button class="btn btn-danger btn-xs" onclick="event.stopPropagation(); rejectSubEditorNews(${n.id})">
                            ${icon('x',12)} रिजेक्ट
                        </button>
                    </div>
                ` : ''}
            </div>
        `).join('');
        applyLanguage();
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

function subEditorStatusLabel(status) {
    if (status === 'forwarded') return 'मुख्य एडिटर को भेजी';
    if (status === 'rejected') return 'रिजेक्टेड';
    return 'पेंडिंग';
}

function startSubEditorButtonProgress(buttonEl) {
    let progress = 0;
    return setInterval(() => {
        progress = Math.min(progress + 8, 92);
        buttonEl.innerHTML = `${icon('loader', 12)} ${progress}%`;
    }, 180);
}

async function openSubEditorNews(id) {
    const news = await api(`/sub-editor/news/${id}`);
    if (news.error) {
        showToast(news.error, 'error');
        return;
    }

    const galleryHtml = news.images?.length ? `
        <div class="operator-image-gallery">
            <div class="operator-gallery-label">${icon('photos', 14)} Images (${news.images.length})</div>
            <div class="operator-gallery-grid">
                ${news.images.map((img, idx) => `
                    <div class="operator-gallery-tile ${img.is_selected ? 'selected' : ''}">
                        <img src="${img.image_path}" alt="Image ${idx + 1}" onclick="openImageFullscreen('${img.image_path}')">
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    const actionsHtml = news.sub_editor_status === 'pending' && news.status === 'raw' ? `
        <button class="btn btn-primary" onclick="forwardSubEditorNews(${id}, this)">
            ${icon('send',14)} मुख्य एडिटर को भेजें
        </button>
        <button class="btn btn-danger" onclick="rejectSubEditorNews(${id})">
            ${icon('x',14)} रिजेक्ट
        </button>
    ` : '';

    showArticleModal({
        headline: news.headline,
        body: news.body,
        extraHtml: galleryHtml,
        image_path: news.selected_image_path || news.image_path,
        category: news.category,
        city: news.city,
        reporter_name: news.reporter_name,
        actionsHtml
    });
}

async function forwardSubEditorNews(id, buttonEl) {
    const originalHtml = buttonEl ? buttonEl.innerHTML : '';
    if (buttonEl) {
        buttonEl.disabled = true;
        buttonEl.innerHTML = `${icon('loader', 12)} 0%`;
    }
    const progress = buttonEl ? startSubEditorButtonProgress(buttonEl) : null;

    try {
        const result = await api(`/sub-editor/news/${id}/forward`, { method: 'POST', body: JSON.stringify({}) });
        if (result.error) {
            showToast(result.error, 'error');
            if (buttonEl) {
                clearInterval(progress);
                buttonEl.disabled = false;
                buttonEl.innerHTML = originalHtml;
            }
            return;
        }
        if (buttonEl) {
            clearInterval(progress);
            buttonEl.innerHTML = `${icon('check', 12)} 100%`;
        }
        showToast('मुख्य एडिटर को भेज दिया गया', 'success');
        closeArticleModal();
        renderSubEditorTab(subEditorTab);
    } catch (err) {
        showToast(t('common.error'), 'error');
        if (buttonEl) {
            clearInterval(progress);
            buttonEl.disabled = false;
            buttonEl.innerHTML = originalHtml;
        }
    }
}

async function rejectSubEditorNews(id) {
    const reason = prompt('रिजेक्ट करने का कारण लिखें') || '';
    const result = await api(`/sub-editor/news/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
    });
    if (result.error) {
        showToast(result.error, 'error');
        return;
    }
    showToast('खबर रिजेक्ट कर दी गई', 'success');
    closeArticleModal();
    renderSubEditorTab(subEditorTab);
}

// ==========================================
// SUB-EDITOR ADVERTISEMENTS
// ==========================================

function switchSubEditorPane(pane) {
    renderSubEditorTab(pane);
}

async function submitSubEditorAd(e) {
    e.preventDefault();
    const btn = document.getElementById('adUploadBtn');
    const type = document.getElementById('adUploadType').value;
    const file = document.getElementById('adUploadFile').files[0];
    const size = document.getElementById('adUploadSize').value;
    const price = document.getElementById('adUploadPrice').value;
    const note = document.getElementById('adUploadNote').value;

    if (!file) return;

    btn.disabled = true;
    btn.textContent = 'अपलोड हो रहा है...';

    const formData = new FormData();
    formData.append('ad_file', file);
    formData.append('ad_type', type);
    formData.append('size', size);
    formData.append('price', price);
    formData.append('note', note);

    try {
        const res = await api('/advertisements/upload', {
            method: 'POST',
            body: formData,
            isFormData: true
        });

        if (res.error) {
            showToast(res.error, 'error');
        } else {
            showToast(res.message, 'success');
            document.getElementById('adUploadForm').reset();
            loadSubEditorAds();
        }
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
    btn.disabled = false;
    btn.textContent = 'अपलोड करें';
}

async function loadSubEditorAds() {
    const listContainer = document.getElementById('subEditorAdsList');
    if (!listContainer) return;
    listContainer.innerHTML = '<div class="loading-spinner" style="margin:20px auto;"></div>';

    try {
        const data = await api('/advertisements/my');
        const ads = data.ads || [];

        if (ads.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-svg">${icon('dollar-sign', 40)}</div>
                    <div class="empty-text">कोई विज्ञापन नहीं</div>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = ads.map(a => `
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
                        <div class="news-card-body" style="margin-top:4px;">
                            ${escapeHtml(a.note_sub_editor || 'No note')}
                        </div>
                    </div>
                </div>
                <div class="news-card-meta">
                    <span class="status-badge ${a.status}">${a.status}</span>
                    <span class="news-card-meta-item">${icon('clock',12)} ${formatDate(a.created_at)}</span>
                    ${a.status === 'rejected' ? `<span class="news-card-meta-item" style="color:var(--accent-red);">Reason: ${escapeHtml(a.reject_reason || '')}</span>` : ''}
                </div>
                <div class="news-card-actions-row">
                    <a href="${a.file_path}" target="_blank" class="btn btn-secondary btn-xs">
                        ${icon('eye', 12)} फाइल देखें (${a.file_type})
                    </a>
                </div>
            </div>
        `).join('');
    } catch (err) {
        listContainer.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

async function loadSubEditorPdfs(container) {
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
