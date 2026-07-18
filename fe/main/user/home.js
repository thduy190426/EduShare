import { API_URL } from '../shared/config.js';
import { decodeJWT, escapeHTML, formatRatingSummary, getAssetUrl, getToken, getAvatar, getUserProfileUrl } from '../shared/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    loadUserProfileNav();
    fetchMySubjects();
    fetchLatestDocuments();
    fetchRecommendedGroups();

    const btnCustomize = document.getElementById('btn-customize-subjects');
    if (btnCustomize) {
        btnCustomize.addEventListener('click', (e) => {
            e.preventDefault();
            openSubjectPicker();
        });
    }
});

let mySubjects = [];
let selectedSubjectId = '';

async function fetchMySubjects() {
    const token = getToken();
    const grid = document.getElementById('mySubjectGrid');
    if (!token || !grid) return;

    grid.innerHTML = renderInlineState('fa-spinner fa-spin', 'Đang tải môn học của bạn...');

    try {
        const response = await fetch(`${API_URL}/subjects/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Không thể tải môn học của bạn.');

        mySubjects = data.subjects || [];
        renderSubjectChips();
        renderMySubjectCards();
    } catch (error) {
        console.error('Lỗi khi tải môn học của bạn:', error);
        grid.innerHTML = renderInlineState('fa-triangle-exclamation', 'Không thể tải môn học của bạn lúc này.');
    }
}

function renderSubjectChips() {
    const chips = document.getElementById('homeSubjectChips');
    if (!chips) return;

    chips.innerHTML = '';
    chips.appendChild(createSubjectChip('', 'Tất cả'));
    mySubjects.forEach(subject => {
        chips.appendChild(createSubjectChip(String(subject.MaMonHoc), subject.TenMonHoc));
    });
}

function createSubjectChip(subjectId, label) {
    const button = document.createElement('button');
    button.className = `chip ${selectedSubjectId === subjectId ? 'active' : ''}`;
    button.type = 'button';
    button.dataset.subjectId = subjectId;
    button.textContent = label;
    button.addEventListener('click', () => {
        selectedSubjectId = subjectId;
        renderSubjectChips();
        fetchLatestDocuments();
    });
    return button;
}

function renderMySubjectCards() {
    const grid = document.getElementById('mySubjectGrid');
    if (!grid) return;

    if (mySubjects.length === 0) {
        grid.innerHTML = `
            <div class="home-empty-state my-subject-empty">
                <i class="fa-solid fa-book-open"></i>
                <p>Bạn chưa thêm môn học nào. Chọn môn học để trang chủ ưu tiên tài liệu và nhóm phù hợp.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = '';
    mySubjects.forEach(subject => {
        const card = document.createElement('div');
        card.className = 'my-subject-card';
        card.innerHTML = `
            <div class="my-subject-header">
                <div class="my-subject-icon"><i class="fa-solid fa-book"></i></div>
                <div class="my-subject-actions">
                    <button type="button" class="subject-icon-btn" title="Xem tài liệu" data-view-subject="${subject.MaMonHoc}">
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>
                    <button type="button" class="subject-icon-btn danger" title="Bỏ môn" data-remove-subject="${subject.MaMonHoc}">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            </div>
            <div class="my-subject-info">
                <h3>${escapeHTML(subject.TenMonHoc)}</h3>
                <div class="subject-level">${escapeHTML(subject.CapHoc || 'Khác')}</div>
            </div>
            <div class="my-subject-stats">
                <span class="stat-doc"><i class="fa-solid fa-file-pdf"></i> ${Number(subject.SoTaiLieu || 0)} tài liệu</span>
                <span class="stat-group"><i class="fa-solid fa-user-group"></i> ${Number(subject.SoNhom || 0)} nhóm</span>
            </div>
        `;

        card.querySelector('[data-view-subject]').addEventListener('click', () => {
            window.location.href = `../document/searchResults.html?maMonHoc=${subject.MaMonHoc}`;
        });
        card.querySelector('[data-remove-subject]').addEventListener('click', () => removeSubject(subject));
        grid.appendChild(card);
    });
}

function renderInlineState(icon, text) {
    return `
        <div class="home-empty-state my-subject-empty">
            <i class="fa-solid ${icon}"></i>
            <p>${escapeHTML(text)}</p>
        </div>
    `;
}

async function openSubjectPicker() {
    const token = getToken();
    if (!token) {
        window.location.href = '../auth/login.html';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/subjects/available`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Không thể tải danh sách môn học.');

        const subjects = data.subjects || [];
        if (subjects.length === 0) {
            Swal.fire({ icon: 'info', title: 'Đã đầy đủ', text: 'Bạn đã thêm tất cả môn học đang có.' });
            return;
        }

        const options = subjects.map(subject => `
            <div class="subject-picker-item" data-subject-id="${subject.MaMonHoc}">
                <span>
                    <strong>${escapeHTML(subject.TenMonHoc)}</strong>
                    <small>${escapeHTML(subject.CapHoc || 'Khác')} - ${Number(subject.SoTaiLieu || 0)} tài liệu - ${Number(subject.SoNhom || 0)} nhóm</small>
                </span>
                <div class="item-icon"><i class="fa-solid fa-plus"></i></div>
            </div>
        `).join('');

        const modalOverlay = document.getElementById('addSubjectModal');
        const modalBody = document.getElementById('subjectModalBody');
        const btnClose = document.getElementById('btnCloseSubjectModal');

        if (!modalOverlay || !modalBody) return;

        modalBody.innerHTML = `<div class="subject-picker-list">${options}</div>`;
        modalOverlay.classList.add('active');

        const closeModal = () => modalOverlay.classList.remove('active');
        
        if (btnClose) {
            btnClose.onclick = closeModal;
        }
        
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        };

        const items = modalBody.querySelectorAll('.subject-picker-item');
        items.forEach(item => {
            item.addEventListener('click', async () => {
                const pickedSubjectId = item.dataset.subjectId;
                closeModal();
                if (pickedSubjectId) {
                    await followSubject(pickedSubjectId);
                }
            });
        });

    } catch (error) {
        console.error('Lỗi khi mở danh sách môn học:', error);
        Swal.fire({ icon: 'error', title: 'Lỗi', text: error.message });
    }
}

async function followSubject(subjectId) {
    const token = getToken();
    try {
        const response = await fetch(`${API_URL}/subjects/${subjectId}/follow`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Không thể thêm môn học.');

        await fetchMySubjects();
        Swal.fire({ icon: 'success', title: 'Đã thêm môn học', timer: 1200, showConfirmButton: false });
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Lỗi', text: error.message });
    }
}

async function removeSubject(subject) {
    const token = getToken();
    const result = await Swal.fire({
        icon: 'question',
        title: 'Xoá môn học?',
        text: `Bạn sẽ không còn ưu tiên "${subject.TenMonHoc}" trên trang chủ.`,
        showCancelButton: true,
        confirmButtonText: 'Xoá',
        cancelButtonText: 'Hủy',
        confirmButtonColor: 'var(--danger)'
    });

    if (!result.isConfirmed) return;

    try {
        const response = await fetch(`${API_URL}/subjects/${subject.MaMonHoc}/follow`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Không thể bỏ môn học.');

        if (selectedSubjectId === String(subject.MaMonHoc)) selectedSubjectId = '';
        await fetchMySubjects();
        await fetchLatestDocuments();
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Lỗi', text: error.message });
    }
}

function loadUserProfileNav() {
    const token = getToken();
    if (!token) {
        window.location.href = '../auth/login.html';
        return;
    }
    try {
        const payload = decodeJWT(token);
        if (!payload) return;
        
        const userNameEl = document.getElementById('navUserName');
        const userRoleEl = document.getElementById('navUserRole');
        const avatarEl = document.getElementById('navAvatar');
        
        if (userNameEl) userNameEl.textContent = payload.HoTen || 'Người dùng';
        if (userRoleEl) {
            let roleStr = 'Sinh viên';
            if (payload.VaiTro === 'GiaoVien') roleStr = 'Giảng viên';
            if (payload.VaiTro === 'Admin') roleStr = 'Quản trị viên';
            userRoleEl.textContent = roleStr;
        }
        if (avatarEl && payload.HoTen) {
            const savedAvatar = getAvatar();
            if (savedAvatar && savedAvatar !== 'null') {
                avatarEl.innerHTML = `<img src="${getAssetUrl(savedAvatar)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                avatarEl.style.background = 'transparent';
                avatarEl.style.color = 'transparent';
            } else {
                avatarEl.textContent = payload.HoTen.trim().split(' ').pop().charAt(0).toUpperCase();
                avatarEl.style.background = 'var(--primary-light)';
                avatarEl.style.color = 'var(--primary)';
            }
        }
    } catch (e) {
        console.error('Lỗi giải mã token:', e);
    }
}

async function fetchRecommendedGroups() {
    const token = getToken();
    const grid = document.getElementById('homeGroupGrid');
    if (!grid) return;
    if (!token) return;

    grid.innerHTML = `
        <div class="home-empty-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p>Đang tải nhóm học tập...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_URL}/groups/recommended?limit=3`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Không thể tải nhóm học tập.');

        renderRecommendedGroups(data.groups || []);
    } catch (error) {
        console.error('Lỗi khi tải nhóm học tập gợi ý:', error);
        grid.innerHTML = `
            <div class="home-empty-state">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <p>Không thể tải nhóm học tập lúc này.</p>
            </div>
        `;
    }
}

function renderRecommendedGroups(groups) {
    const grid = document.getElementById('homeGroupGrid');
    if (!grid) return;

    if (groups.length === 0) {
        grid.innerHTML = `
            <div class="home-empty-state">
                <i class="fa-solid fa-users"></i>
                <p>Chưa có nhóm phù hợp để gợi ý. Hãy khám phá thêm nhóm học tập mới.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = '';
    groups.forEach(group => {
        const card = document.createElement('div');
        card.className = 'group-card';
        card.innerHTML = `
            <div class="group-header">
                <div class="group-icon"><i class="fa-solid fa-users"></i></div>
                <div class="group-members"><i class="fa-solid fa-user-group"></i> ${group.SoLuongThanhVien || 1}</div>
            </div>
            <div class="group-info">
                <h3 class="group-title">${escapeHTML(group.TenNhom)}</h3>
                <div class="group-subject">${escapeHTML(group.TenMonHoc) || 'Chung'}</div>
                <p class="group-desc">${escapeHTML(group.MoTa) || 'Không có mô tả.'}</p>
            </div>
            <div class="group-actions">
                <button class="btn-outline-primary" type="button" data-group-detail="${group.MaNhom}">
                    <i class="fa-solid fa-circle-info"></i> Chi tiết
                </button>
                <button class="btn-outline-primary btn-join-group" type="button" data-group-join="${group.MaNhom}">
                    <i class="fa-solid fa-user-plus"></i> Tham gia
                </button>
            </div>
        `;

        card.querySelector('[data-group-detail]').addEventListener('click', () => {
            window.location.href = `../group/groupDetails.html?id=${group.MaNhom}`;
        });
        card.querySelector('[data-group-join]').addEventListener('click', (event) => {
            joinRecommendedGroup(group.MaNhom, event.currentTarget);
        });

        grid.appendChild(card);
    });
}

async function joinRecommendedGroup(maNhom, button) {
    const token = getToken();
    if (!token) {
        window.location.href = '../auth/login.html';
        return;
    }

    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';

    try {
        const response = await fetch(`${API_URL}/groups/${maNhom}/join`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) throw new Error(data.message || 'Không thể tham gia nhóm.');

        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'success', title: 'Thành công', text: 'Tham gia nhóm thành công!' });
        }
        fetchRecommendedGroups();
    } catch (error) {
        console.error('Lỗi khi tham gia nhóm gợi ý:', error);
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'error', title: 'Lỗi', text: error.message });
        }
        button.disabled = false;
        button.innerHTML = originalHtml;
    }
}

async function fetchLatestDocuments() {
    try {
        const params = new URLSearchParams({ trang: '1', limit: '4' });
        if (selectedSubjectId) params.set('maMonHoc', selectedSubjectId);
        const response = await fetch(`${API_URL}/documents/search?${params.toString()}`);
        if (!response.ok) throw new Error('Lỗi fetch dữ liệu');

        const data = await response.json();
        renderHomeDocuments(data.documents);
    } catch (error) {
        console.error('Lỗi khi tải tài liệu mới nhất:', error);
        const grid = document.getElementById('homeDocGrid');
        if (grid) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Không thể tải dữ liệu tài liệu lúc này.</p>';
        }
    }
}

function renderHomeDocuments(documents) {
    const grid = document.getElementById('homeDocGrid');
    if (!grid) return;

    grid.innerHTML = '';
    
    
    const top4 = documents.slice(0, 4);

    if (top4.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Chưa có tài liệu nào trên hệ thống.</p>';
        return;
    }

    top4.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'doc-card';

        let icon = 'fa-file';
        let thumbClass = '';
        let loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';

        if (loaiFile === 'pdf') { icon = 'fa-file-pdf'; thumbClass = 'thumb-pdf'; }
        else if (loaiFile === 'pptx' || loaiFile === 'ppt') { icon = 'fa-chart-column'; thumbClass = 'thumb-pptx'; }
        else if (loaiFile === 'docx' || loaiFile === 'doc') { icon = 'fa-pen-to-square'; thumbClass = 'thumb-docx'; }

        const userInitial = doc.TenNguoiDang ? doc.TenNguoiDang.trim().split(' ').pop().charAt(0).toUpperCase() : '?';
        let avatarHtml = `<div class="avatar-sm">${userInitial}</div>`;
        if (doc.AvatarURL) {
            avatarHtml = `<div class="avatar-sm" style="background:transparent; color:transparent;"><img src="${getAssetUrl(doc.AvatarURL)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;"></div>`;
        }

        let thumbHtml = `<i class="fa-solid ${icon}"></i>`;
        if (loaiFile === 'pdf' && doc.FileURL) {
            const fileUrlFull = `${API_URL.replace('/api', '')}${doc.FileURL}`;
            thumbHtml = `<iframe src="${fileUrlFull}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" style="position: absolute; top: 0; left: 0; width: calc(100% + 24px); height: calc(100% + 24px); border: none; pointer-events: none;" scrolling="no" tabindex="-1"></iframe>`;
            thumbClass = '';
        }

        let dateStr = 'Không rõ';
        if (doc.NgayDang) {
            const dateObj = new Date(doc.NgayDang);
            dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
        }

        card.innerHTML = `
            <div class="doc-thumb ${thumbClass}">
                ${thumbHtml}
                ${doc.LaTaiLieuChinhThuc ? '<div class="badge-official"><i class="fa-solid fa-check"></i> Tài liệu chính thống</div>' : ''}
                ${doc.LaTaiLieuDocQuyen ? `<div class="badge-premium" style="position: absolute; top: 12px; left: 12px; z-index: 10; background: #FEF3C7; color: #B45309; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #FDE68A;"><i class="fa-solid fa-crown" style="color: #F59E0B; margin-right: 4px;"></i> PREMIUM (${doc.GiaXu || 0} Xu)</div>` : ''}
            </div>
            <div class="doc-content">
                <div class="doc-meta" style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="doc-meta-item"><span><i class="fa-solid fa-folder"></i></span> ${doc.TenMonHoc || 'Không xác định'}</span>
                    <span class="doc-meta-item" style="font-size: 12px; color: var(--text-secondary);"><i class="fa-solid fa-calendar"></i> ${dateStr}</span>
                </div>
                <h3 class="doc-title">
                    ${doc.TenTL}
                </h3>
                <div class="doc-desc">${doc.MoTa || 'Không có mô tả'}</div>
                <div class="doc-footer">
                    <div class="doc-author js-author-link" data-user-id="${doc.MaND_NguoiDang || ''}" title="Xem hồ sơ người đăng">
                        ${avatarHtml}
                        <span>${doc.TenNguoiDang || 'Ẩn danh'}</span>
                    </div>
                    <div class="doc-stats">
                        <span><i class="fa-solid fa-download" style="color: #6B7280; margin-right: 4px;"></i> ${(doc.SoLuotTai || 0).toLocaleString()}</span>
                        <span><i class="fa-solid fa-star" style="color: #F59E0B; margin-right: 4px;"></i> ${formatRatingSummary(doc.DiemDanhGia, doc.SoDanhGia)}</span>
                    </div>
                </div>
            </div>
        `;
        
        
        card.style.cursor = 'pointer';
        card.onclick = () => {
            window.location.href = `../document/documentDetails.html?id=${doc.MaTL}`;
        };

        const authorEl = card.querySelector('.js-author-link');
        if (authorEl && authorEl.dataset.userId) {
            authorEl.style.cursor = 'pointer';
            authorEl.addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.href = getUserProfileUrl(authorEl.dataset.userId);
            });
        }

        grid.appendChild(card);
    });
}
