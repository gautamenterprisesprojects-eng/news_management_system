/* ============================================================
   MODAL COMPONENT — Full-screen article reader
   ============================================================ */

/**
 * Show article reader modal
 * @param {object} options
 * @param {string} options.headline
 * @param {string} options.body
 * @param {string} options.image_path
 * @param {string} options.category
 * @param {string} options.city
 * @param {string} options.reporter_name
 * @param {string} options.created_at
 * @param {string} options.actionsHtml - HTML for action buttons
 * @param {string} options.extraHtml - Additional HTML (badges, history) to render
 */
function showArticleModal(options) {
    const {
        headline = '',
        body = '',
        image_path = null,
        category = '',
        city = '',
        reporter_name = '',
        created_at = '',
        actionsHtml = '',
        extraHtml = ''
    } = options;

    const imageHtml = image_path
        ? `<img class="modal-image" src="${image_path}" alt="News Image" onerror="this.style.display='none'">`
        : '';

    const metaItems = [];
    if (category) metaItems.push(`<span class="status-badge processed">${category}</span>`);
    if (city) metaItems.push(`<span class="news-card-meta-item">${icon('pin',12)} ${city}</span>`);
    if (reporter_name) metaItems.push(`<span class="news-card-meta-item">${icon('user',12)} ${reporter_name}</span>`);
    if (created_at) metaItems.push(`<span class="news-card-meta-item">${icon('clock',12)} ${formatDate(created_at)}</span>`);

    const modalHtml = `
        <div class="modal-overlay" id="articleModal" onclick="closeModalOutside(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-handle"></div>
                <button class="modal-close" onclick="closeArticleModal()">${icon('x', 14)}</button>
                ${imageHtml}
                <div class="modal-body">
                    <div class="modal-meta">
                        ${metaItems.join('')}
                    </div>
                    ${headline ? `<h2 class="modal-headline">${escapeHtml(headline)}</h2>` : ''}
                    ${actionsHtml ? `<div class="modal-actions-top">${actionsHtml}</div>` : ''}
                    ${extraHtml ? `<div class="modal-extra-info">${extraHtml}</div>` : ''}
                    ${body ? `<div class="modal-article">${escapeHtml(body)}</div>` : ''}
                    ${actionsHtml ? `<div class="modal-actions modal-actions-bottom">${actionsHtml}</div>` : ''}
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    closeArticleModal();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.body.style.overflow = 'hidden';
    initArticleModalGestures();
    applyLanguage();
}

/**
 * Close article modal
 */
function closeArticleModal() {
    const modal = document.getElementById('articleModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

/**
 * Close modal when clicking overlay
 */
function closeModalOutside(event) {
    if (event.target.classList.contains('modal-overlay')) {
        closeArticleModal();
    }
}

function initArticleModalGestures() {
    const modal = document.getElementById('articleModal');
    const content = modal?.querySelector('.modal-content');
    const dragTargets = modal?.querySelectorAll('.modal-image, .modal-handle');
    if (!modal || !content || !dragTargets?.length) return;

    let startY = 0;
    let currentY = 0;
    let dragging = false;

    const begin = (event) => {
        const point = event.touches ? event.touches[0] : event;
        startY = point.clientY;
        currentY = startY;
        dragging = true;
        content.classList.add('modal-dragging');
    };

    const move = (event) => {
        if (!dragging) return;
        const point = event.touches ? event.touches[0] : event;
        currentY = point.clientY;
        const distance = Math.max(0, currentY - startY);
        if (distance > 0) {
            content.style.transform = `translateY(${Math.min(distance, 140)}px)`;
        }
    };

    const end = () => {
        if (!dragging) return;
        dragging = false;
        content.classList.remove('modal-dragging');
        const distance = currentY - startY;
        content.style.transform = '';
        if (distance > 80) closeArticleModal();
    };

    dragTargets.forEach(target => {
        target.addEventListener('touchstart', begin, { passive: true });
        target.addEventListener('touchmove', move, { passive: true });
        target.addEventListener('touchend', end);
        target.addEventListener('pointerdown', begin);
        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', end);
        target.addEventListener('pointercancel', end);
    });
}

/**
 * Show a confirmation dialog
 * @param {string} title
 * @param {string} text
 * @param {Function} onConfirm
 */
function showConfirm(title, text, onConfirm) {
    const html = `
        <div class="confirm-overlay" id="confirmDialog" onclick="closeConfirm()">
            <div class="confirm-dialog" onclick="event.stopPropagation()">
                <div class="confirm-icon">⚠️</div>
                <div class="confirm-title">${title}</div>
                <div class="confirm-text">${text}</div>
                <div class="confirm-actions">
                    <button class="btn btn-secondary" onclick="closeConfirm()" data-i18n="common.cancel">${t('common.cancel')}</button>
                    <button class="btn btn-danger" id="confirmYesBtn" data-i18n="common.confirm">${t('common.confirm')}</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('confirmYesBtn').onclick = () => {
        closeConfirm();
        onConfirm();
    };
    applyLanguage();
}

function closeConfirm() {
    const dialog = document.getElementById('confirmDialog');
    if (dialog) dialog.remove();
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        document.body.insertAdjacentHTML('beforeend', '<div class="toast-container"></div>');
        container = document.querySelector('.toast-container');
    }

    const existingToast = container.querySelector('.toast');
    if (existingToast) {
        clearTimeout(existingToast._removeTimer);
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(toast);

    toast._removeTimer = setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) container.remove();
    }, 3000);
}

/**
 * Helper: Format date string for display
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now - d;
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

/**
 * Helper: Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
