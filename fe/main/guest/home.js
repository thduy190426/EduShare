import { API_URL } from '../shared/config.js';
import { escapeHTML, formatRatingSummary, getAssetUrl, renderDocumentSkeleton } from '../shared/utils.js';
document.addEventListener('DOMContentLoaded', () => {
    fetchFeaturedDocuments();
    fetchSubjects();
    fetchStats();
    initGlobalSearch();
});

function initGlobalSearch() {
    let searchTimeout = null;
    const searchInput = document.getElementById('guestSearchInput');
    const searchSuggestions = document.getElementById('searchSuggestions');
    const btnGuestSearch = document.getElementById('btnGuestSearch');

    if (!searchInput || !searchSuggestions) return;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (!query) {
            searchSuggestions.classList.add('hidden');
            return;
        }
        searchTimeout = setTimeout(() => {
            fetchSuggestions(query);
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
            searchSuggestions.classList.add('hidden');
        }
    });

    if (btnGuestSearch) {
        btnGuestSearch.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `../document/searchResults.html?q=${encodeURIComponent(query)}`;
            }
        });
    }
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `../document/searchResults.html?q=${encodeURIComponent(query)}`;
            }
        }
    });
}

async function fetchSuggestions(query) {
    try {
        const response = await fetch(`${API_URL}/documents/search?tuKhoa=${encodeURIComponent(query)}&limit=5`);
        if (!response.ok) return;
        const data = await response.json();
        renderSuggestions(data.documents || []);
    } catch (error) {
        console.error('Lỗi tìm kiếm:', error);
    }
}

function renderSuggestions(docs) {
    const searchSuggestions = document.getElementById('searchSuggestions');
    if (!docs || docs.length === 0) {
        searchSuggestions.innerHTML = '<div style="padding: 12px 16px; color: var(--text-secondary); text-align: center;">Không tìm thấy kết quả phù hợp</div>';
        searchSuggestions.classList.remove('hidden');
        return;
    }
    
    let html = '';
    docs.forEach(doc => {
        let icon = 'fa-file';
        if (doc.LoaiFile === 'pdf') icon = 'fa-file-pdf';
        else if (doc.LoaiFile === 'pptx' || doc.LoaiFile === 'ppt') icon = 'fa-chart-column';
        else if (doc.LoaiFile === 'docx' || doc.LoaiFile === 'doc') icon = 'fa-pen-to-square';
        
        html += `
            <a href="../document/documentDetails.html?id=${doc.MaTL}" class="suggestion-item">
                <div class="suggestion-icon"><i class="fa-solid ${icon}"></i></div>
                <div class="suggestion-content">
                    <div class="suggestion-title">${escapeHTML(doc.TenTL)}</div>
                    <div class="suggestion-meta">${escapeHTML(doc.TenMonHoc || 'Tài liệu chung')} • ${doc.LaTaiLieuDocQuyen ? 'Premium' : 'Miễn phí'}</div>
                </div>
            </a>
        `;
    });
    searchSuggestions.innerHTML = html;
    searchSuggestions.classList.remove('hidden');
}

const previewModal = document.getElementById('previewModal');
const closePreviewModal = document.getElementById('closePreviewModal');
const previewIframe = document.getElementById('previewIframe');
const previewLoading = document.getElementById('previewLoading');

if (closePreviewModal && previewModal) {
    closePreviewModal.addEventListener('click', () => {
        previewModal.classList.add('hidden');
        if(previewIframe) {
            previewIframe.src = '';
            previewIframe.classList.add('hidden');
        }
    });
    window.addEventListener('click', (e) => {
        if (e.target === previewModal) {
            previewModal.classList.add('hidden');
            if(previewIframe) {
                previewIframe.src = '';
                previewIframe.classList.add('hidden');
            }
        }
    });
}

function openPreviewModal(doc) {
    if (doc.LoaiFile === 'pdf' || doc.PreviewURL) {
        if (previewModal && previewLoading && previewIframe) {
            previewModal.classList.remove('hidden');
            previewLoading.classList.remove('hidden');
            previewIframe.classList.add('hidden');
            
            let previewSrc = '';
            if (doc.PreviewURL) {
                previewSrc = doc.PreviewURL.startsWith('http') ? doc.PreviewURL : `${API_URL.replace('/api', '')}${doc.PreviewURL}`;
            } else {
                previewSrc = `${API_URL}/documents/${doc.MaTL}/preview-pdf`;
            }
            
            previewIframe.onload = function() {
                previewLoading.classList.add('hidden');
                previewIframe.classList.remove('hidden');
            };
            
            previewIframe.src = `${previewSrc}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
        }
    } else {
        window.location.href = `../document/documentDetails.html?id=${doc.MaTL}`;
    }
}
async function fetchStats() {
    try {
        const response = await fetch(`${API_URL}/documents/stats/platform`);
        if (!response.ok) return;
        const data = await response.json();
        const docElem = document.getElementById('stat-documents');
        const userElem = document.getElementById('stat-users');
        const dlElem = document.getElementById('stat-downloads');
        const formatNum = (num) => {
            if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + 'M+';
            if (num > 1000) return Math.floor(num / 1000) + '.000+';
            return num + '+';
        };
        if (docElem) docElem.textContent = formatNum(data.documents);
        if (userElem) userElem.textContent = formatNum(data.users);
        if (dlElem) dlElem.textContent = formatNum(data.downloads);
    } catch (error) {
        console.error('Lỗi khi tải thống kê:', error);
    }
}
async function fetchSubjects() {
    const grid = document.getElementById('homeSubjectGrid');
    if (!grid) return;
    try {
        const response = await fetch(`${API_URL}/documents/subjects/popular`);
        if (!response.ok) throw new Error('Không thể tải danh sách môn học.');
        const data = await response.json();
        renderSubjects(data.subjects || []);
    } catch (error) {
        console.error('Lỗi khi tải môn học:', error);
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Không thể tải dữ liệu môn học lúc này.</p>';
    }
}
function renderSubjects(subjects) {
    const grid = document.getElementById('homeSubjectGrid');
    if (!grid) return;
    if (subjects.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Chưa có môn học nào trên hệ thống.</p>';
        return;
    }
    grid.innerHTML = '';
    const displaySubjects = subjects;
    const icons = [
        'fa-ruler-combined', 'fa-magnet', 'fa-laptop', 'fa-floppy-disk', 
        'fa-book', 'fa-flask', 'fa-earth-americas', 'fa-bullhorn'
    ];
    displaySubjects.forEach((subject, index) => {
        const card = document.createElement('div');
        card.className = 'subject-card';
        const iconClass = icons[index % icons.length];
        card.innerHTML = `
            <div class="subject-icon"><i class="fa-solid ${iconClass}"></i></div>
            <div class="subject-name">${escapeHTML(subject.TenMonHoc)}</div>
        `;
        card.addEventListener('click', () => {
            window.location.href = `../document/searchResults.html?maMonHoc=${subject.MaMonHoc}`;
        });
        grid.appendChild(card);
    });
}
async function fetchFeaturedDocuments() {
    const grid = document.getElementById('homeDocGrid');
    if (!grid) return;
    grid.innerHTML = renderDocumentSkeleton(3);
    try {
        const response = await fetch(`${API_URL}/documents/search?trang=1&limit=3&sapXep=NoiBat`);
        if (!response.ok) throw new Error('Không thể tải tài liệu nổi bật.');
        const data = await response.json();
        renderFeaturedDocuments(data.documents || []);
    } catch (error) {
        console.error('Lỗi khi tải tài liệu nổi bật:', error);
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Không thể tải dữ liệu tài liệu lúc này.</p>';
    }
}
function renderFeaturedDocuments(documents) {
    const grid = document.getElementById('homeDocGrid');
    if (!grid) return;
    const topDocuments = documents.slice(0, 3);
    if (topDocuments.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Chưa có tài liệu nào trên hệ thống.</p>';
        return;
    }
    grid.innerHTML = '';
    topDocuments.forEach((doc) => {
        const card = document.createElement('div');
        card.className = 'doc-card';
        let icon = 'fa-file';
        let thumbClass = '';
        const fileType = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';
        if (fileType === 'pdf') {
            icon = 'fa-file-pdf';
            thumbClass = 'thumb-pdf';
        } else if (fileType === 'pptx' || fileType === 'ppt') {
            icon = 'fa-chart-column';
            thumbClass = 'thumb-pptx';
        } else if (fileType === 'docx' || fileType === 'doc') {
            icon = 'fa-pen-to-square';
            thumbClass = 'thumb-docx';
        }
        let thumbHtml = `<i class="fa-solid ${icon}"></i>`;
        if (doc.ThumbnailURL) {
            const thumbUrlFull = doc.ThumbnailURL.startsWith('http') ? doc.ThumbnailURL : `${API_URL.replace('/api', '')}${doc.ThumbnailURL}`;
            thumbHtml = `<img src="${thumbUrlFull}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; border: none; pointer-events: none;" loading="lazy" alt="Preview">`;
            thumbClass = '';
        } else {
            let previewTarget = null;
            if (doc.PreviewURL) {
                previewTarget = doc.PreviewURL;
            } else if (fileType === 'pdf' && doc.FileURL) {
                previewTarget = doc.FileURL;
            }
            if (previewTarget) {
                const fileUrlFull = previewTarget.startsWith('http') ? previewTarget : `${API_URL.replace('/api', '')}${previewTarget}`;
                thumbHtml = `<iframe src="${fileUrlFull}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" style="position: absolute; top: 0; left: 0; width: calc(100% + 24px); height: calc(100% + 24px); border: none; pointer-events: none;" scrolling="no" tabindex="-1" loading="lazy"></iframe>`;
                thumbClass = '';
            }
        }
        const authorInitial = doc.TenNguoiDang ? doc.TenNguoiDang.trim().split(' ').pop().charAt(0).toUpperCase() : '?';
        let avatarHtml = `<div class="avatar-sm">${authorInitial}</div>`;
        if (doc.AvatarURL) {
            avatarHtml = `<div class="avatar-sm" style="background:transparent; color:transparent;"><img loading="lazy" src="${getAssetUrl(doc.AvatarURL)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;"></div>`;
        }
        let dateText = 'Khong ro';
        if (doc.NgayDang) {
            const date = new Date(doc.NgayDang);
            dateText = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        }
        card.innerHTML = `
            <div class="doc-thumb ${thumbClass}">
                ${thumbHtml}
                ${doc.LaTaiLieuChinhThuc ? '<div class="badge-official"><i class="fa-solid fa-check"></i> Tài liệu chính thống</div>' : ''}
                ${doc.LaTaiLieuDocQuyen ? `<div class="badge-premium" style="position: absolute; top: 12px; left: 12px; z-index: 10; background: #FEF3C7; color: #B45309; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #FDE68A;"><i class="fa-solid fa-crown" style="color: #F59E0B; margin-right: 4px;"></i> PREMIUM (${doc.GiaXu || 0} Xu)</div>` : ''}
            </div>
            <div class="doc-content">
                <div class="doc-meta" style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="doc-meta-item" style="max-width: 65%;"><span><i class="fa-solid fa-folder" style="flex-shrink: 0;"></i></span> <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(doc.TenMonHoc || 'Khong xac dinh')}">${escapeHTML(doc.TenMonHoc || 'Khong xac dinh')}</span></span>
                    <span class="doc-meta-item" style="font-size: 12px; color: var(--text-secondary);"><i class="fa-solid fa-calendar"></i> ${dateText}</span>
                </div>
                <h3 class="doc-title">${escapeHTML(doc.TenTL || 'Tai lieu')}</h3>
                <div class="doc-desc">${escapeHTML(doc.MoTa || 'Khong co mo ta')}</div>
                <div class="doc-footer">
                    <div class="doc-author">
                        ${avatarHtml}
                        <span>${escapeHTML(doc.TenNguoiDang || 'An danh')}</span>
                    </div>
                    <div class="doc-stats">
                        <span><i class="fa-solid fa-download" style="color: #6B7280; margin-right: 4px;"></i> ${(doc.SoLuotTai || 0).toLocaleString()}</span>
                        <span><i class="fa-solid fa-star" style="color: #F59E0B; margin-right: 4px;"></i> ${formatRatingSummary(doc.DiemDanhGia, doc.SoDanhGia)}</span>
                    </div>
                </div>
            </div>
        `;
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            openPreviewModal(doc);
        });
        grid.appendChild(card);
    });
}
