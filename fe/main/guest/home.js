import { API_URL } from '../shared/config.js';
import { escapeHTML, formatRatingSummary, getAssetUrl } from '../shared/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    fetchFeaturedDocuments();
    fetchSubjects();
});

async function fetchSubjects() {
    const grid = document.getElementById('homeSubjectGrid');
    if (!grid) return;

    try {
        const response = await fetch(`${API_URL}/documents/subjects`);
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
    
    const displaySubjects = subjects.slice(0, 8);
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

    try {
        const response = await fetch(`${API_URL}/documents/search?trang=1&limit=4`);
        if (!response.ok) throw new Error('Khong the tai tai lieu noi bat.');

        const data = await response.json();
        renderFeaturedDocuments(data.documents || []);
    } catch (error) {
        console.error('Loi khi tai tai lieu noi bat:', error);
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Khong the tai du lieu tai lieu luc nay.</p>';
    }
}

function renderFeaturedDocuments(documents) {
    const grid = document.getElementById('homeDocGrid');
    if (!grid) return;

    const topDocuments = documents.slice(0, 4);
    if (topDocuments.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Chua co tai lieu nao tren he thong.</p>';
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
        if (fileType === 'pdf' && doc.FileURL) {
            const fileUrlFull = `${API_URL.replace('/api', '')}${doc.FileURL}`;
            thumbHtml = `<iframe src="${fileUrlFull}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" style="position: absolute; top: 0; left: 0; width: calc(100% + 24px); height: calc(100% + 24px); border: none; pointer-events: none;" scrolling="no" tabindex="-1"></iframe>`;
            thumbClass = '';
        }

        const authorInitial = doc.TenNguoiDang ? doc.TenNguoiDang.trim().split(' ').pop().charAt(0).toUpperCase() : '?';
        let avatarHtml = `<div class="avatar-sm">${authorInitial}</div>`;
        if (doc.AvatarURL) {
            avatarHtml = `<div class="avatar-sm" style="background:transparent; color:transparent;"><img src="${getAssetUrl(doc.AvatarURL)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;"></div>`;
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
            </div>
            <div class="doc-content">
                <div class="doc-meta" style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="doc-meta-item"><span><i class="fa-solid fa-folder"></i></span> ${escapeHTML(doc.TenMonHoc || 'Khong xac dinh')}</span>
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
            window.location.href = `../document/documentDetails.html?id=${doc.MaTL}`;
        });

        grid.appendChild(card);
    });
}
