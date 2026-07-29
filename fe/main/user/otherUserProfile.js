import { API_URL } from '../shared/config.js';
import { formatRatingSummary, getToken, getAssetUrl, decodeJWT, getAvatar } from '../shared/utils.js';

const token = getToken();
let currentUserId = null; 
let isFollowing = false;

function buildEducationText(profile) {
    const fields = [
        profile.TruongHoc || 'Chưa cập nhật ',
        profile.KhoaNganh || 'Chưa cập nhật '
    ];

    return fields
        .map(value => (typeof value === 'string' ? value.trim() : ''))
        .join(' - ');
}

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        Swal.fire('Vui lòng đăng nhập.');
        window.location.href = '../guest/guestHome.html';
        return;
    }

    loadUserProfileNav();

    const urlParams = new URLSearchParams(window.location.search);
    currentUserId = urlParams.get('id');

    if (!currentUserId) {
        Swal.fire('Không tìm thấy ID người dùng.');
        window.location.href = '../user/userHome.html';
        return;
    }

    fetchUserProfile();

    document.getElementById('btn-follow').addEventListener('click', toggleFollow);
});

function loadUserProfileNav() {
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
            if (payload.VaiTro === 'Admin') {
                roleStr = 'Quản trị viên';
                userRoleEl.style.color = 'var(--danger-color, #ef4444)';
                userRoleEl.style.fontWeight = '600';
            }
            userRoleEl.textContent = roleStr;
        }
        if (avatarEl && payload.HoTen) {
            const savedAvatar = getAvatar();
            if (savedAvatar) {
                avatarEl.innerHTML = `<img src="${getAssetUrl(savedAvatar)}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                avatarEl.style.background = 'transparent';
                avatarEl.style.color = 'transparent';
            } else {
                const initial = payload.HoTen.trim().split(' ').pop().charAt(0).toUpperCase();
                avatarEl.textContent = initial;
                avatarEl.style.background = 'var(--primary-light)';
                avatarEl.style.color = 'var(--primary)';
            }
        }
    } catch (e) {
        console.error('Invalid token payload', e);
    }
}

async function fetchUserProfile() {
    try {
        const res = await fetch(`${API_URL}/users/${currentUserId}/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (!res.ok) {
            Swal.fire(data.message || 'Lỗi tải hồ sơ');
            window.location.href = '../user/userHome.html';
            return;
        }

        const profile = data.profile;
        isFollowing = data.isFollowing;

        document.getElementById('header-name').textContent = profile.HoTen;
        
        let roleName = 'Sinh viên';
        if (profile.VaiTro === 'GiaoVien') roleName = 'Giáo viên';
        if (profile.VaiTro === 'Admin') roleName = 'Admin';
        document.getElementById('header-role').textContent = roleName;
        
        document.getElementById('view-hoten').value = profile.HoTen || 'Không có tên';
        document.getElementById('view-tuoi').value = profile.Tuoi ? profile.Tuoi : 'Chưa cập nhật';
        
        let gioiTinhStr = 'Chưa cập nhật';
        if (profile.GioiTinh === 'Nam') gioiTinhStr = 'Nam';
        else if (profile.GioiTinh === 'Nu') gioiTinhStr = 'Nữ';
        else if (profile.GioiTinh === 'Khac') gioiTinhStr = 'Khác';
        
        document.getElementById('view-gioitinh').value = gioiTinhStr;
        document.getElementById('view-diachi').value = profile.DiaChi || 'Chưa cập nhật';

        const schoolMajorText = buildEducationText(profile);
        
        document.getElementById('container-school-major').style.display = 'flex';
        document.getElementById('header-school-major').textContent = schoolMajorText;

        const avatarEl = document.getElementById('header-avatar');
        if (profile.AvatarURL) {
            avatarEl.innerHTML = `<img src="${getAssetUrl(profile.AvatarURL)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            avatarEl.style.background = 'transparent';
            avatarEl.style.color = 'transparent';
            avatarEl.style.border = 'none';
        } else {
            avatarEl.innerHTML = profile.HoTen.trim().split(' ').pop().charAt(0).toUpperCase();
            avatarEl.style.background = 'var(--white)';
            avatarEl.style.color = 'var(--primary)';
        }

        updateFollowButtonUI();
        
        setupTabs();
        loadDocuments('shared');

    } catch (err) {
        console.error('Lỗi khi fetchUserProfile:', err);
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.profile-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('active-tab');
                t.style.color = 'var(--text-secondary)';
                t.style.borderBottom = '2px solid transparent';
            });
            tab.classList.add('active-tab');
            tab.style.color = 'var(--primary)';
            tab.style.borderBottom = '2px solid var(--primary)';
            
            const tabId = tab.id;
            if (tabId === 'tab-shared') loadDocuments('shared');
            if (tabId === 'tab-downloads') loadDocuments('downloads');
            if (tabId === 'tab-ratings') loadDocuments('ratings');
        });
    });
}

async function loadDocuments(tabName) {
    const container = document.getElementById('user-docs-container');
    container.innerHTML = '<p style="text-align:center; padding: 20px;">Đang tải tài liệu...</p>';
    
    let endpoint = 'documents';
    let emptyMessage = 'Người dùng này chưa chia sẻ tài liệu nào.';
    if (tabName === 'downloads') {
        endpoint = 'downloaded-documents';
        emptyMessage = 'Người dùng này chưa tải xuống tài liệu nào.';
    } else if (tabName === 'ratings') {
        endpoint = 'rated-documents';
        emptyMessage = 'Người dùng này chưa đánh giá tài liệu nào.';
    }

    try {
        const res = await fetch(`${API_URL}/users/${currentUserId}/${endpoint}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (res.status === 403) {
            container.innerHTML = `<p style="color:var(--text-secondary); text-align: center; padding: 20px;"><i class="fa-solid fa-lock" style="margin-right:8px;"></i>${data.message}</p>`;
            return;
        }
        
        if (!res.ok) throw new Error(data.message || 'Lỗi API');
        
        const docs = data.documents || [];
        renderDocuments(docs, emptyMessage);
    } catch (err) {
        console.error('Lỗi khi tải tài liệu:', err);
        container.innerHTML = '<p style="color:red; text-align: center; padding: 20px;">Lỗi khi tải tài liệu.</p>';
    }
}

function renderDocuments(docs, emptyMessage) {
    const container = document.getElementById('user-docs-container');
    container.innerHTML = '';
    
    if (docs.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); text-align: center; padding: 20px;">${emptyMessage}</p>`;
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'doc-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(340px, 1fr))';
    grid.style.gap = '24px';

    docs.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'doc-card';

        let icon = 'fa-file';
        let thumbClass = '';
        let loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';

        if (loaiFile === 'pdf') { icon = 'fa-file-pdf'; thumbClass = 'thumb-pdf'; }
        else if (loaiFile === 'pptx' || loaiFile === 'ppt') { icon = 'fa-chart-column'; thumbClass = 'thumb-pptx'; }
        else if (loaiFile === 'docx' || loaiFile === 'doc') { icon = 'fa-pen-to-square'; thumbClass = 'thumb-docx'; }

        let authorName = doc.NguoiDang || document.getElementById('header-name').textContent;
        let authorInitial = authorName.trim().split(' ').pop().charAt(0).toUpperCase();
        let avatarHtml = `<div class="avatar-sm">${authorInitial}</div>`;
        
        if (doc.AvatarURL) {
            avatarHtml = `<div class="avatar-sm" style="background:transparent; color:transparent;"><img src="${getAssetUrl(doc.AvatarURL)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;"></div>`;
        } else {
            const headerAvatarImg = document.getElementById('header-avatar').querySelector('img');
            if (headerAvatarImg && !doc.NguoiDang) {
                avatarHtml = `<div class="avatar-sm" style="background:transparent; color:transparent;"><img src="${headerAvatarImg.src}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;"></div>`;
            }
        }

        let thumbHtml = `<i class="fa-solid ${icon}"></i>`;
        let previewTarget = null;
        if (doc.PreviewURL) {
            previewTarget = doc.PreviewURL;
        } else if (loaiFile === 'pdf' && doc.FileURL) {
            previewTarget = doc.FileURL;
        }

        if (previewTarget) {
            const fileUrlFull = previewTarget.startsWith('http') ? previewTarget : `${API_URL.replace('/api', '')}${previewTarget}`;
            thumbHtml = `<iframe src="${fileUrlFull}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" style="position: absolute; top: 0; left: 0; width: calc(100% + 24px); height: calc(100% + 24px); border: none; pointer-events: none;" scrolling="no" tabindex="-1" loading="lazy"></iframe>`;
            thumbClass = '';
        }

        let dateStr = 'Không rõ';
        if (doc.NgayDang) {
            const dateObj = new Date(doc.NgayDang);
            dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
        }

        let ratingHtml = `<span><i class="fa-solid fa-star" style="color: #F59E0B; margin-right: 4px;"></i> ${formatRatingSummary(doc.DiemDanhGia, doc.SoDanhGia)}</span>`;
        if (doc.UserRating) {
            ratingHtml = `<span title="Bạn đã đánh giá ${doc.UserRating} sao"><i class="fa-solid fa-star" style="color: #10B981; margin-right: 4px;"></i> ${doc.UserRating} sao</span>`;
        }

        card.innerHTML = `
            <div class="doc-thumb ${thumbClass}">
                ${thumbHtml}
                ${doc.LaTaiLieuChinhThuc ? '<div class="badge-official"><i class="fa-solid fa-check"></i> Tài liệu chính thống</div>' : ''}
                ${doc.LaTaiLieuDocQuyen ? `<div class="badge-premium" style="position: absolute; top: 12px; left: 12px; z-index: 10; background: #FEF3C7; color: #B45309; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #FDE68A;"><i class="fa-solid fa-crown" style="color: #F59E0B; margin-right: 4px;"></i> PREMIUM (${doc.GiaXu || 0} Xu)</div>` : ''}
            </div>
            <div class="doc-content">
                <div class="doc-meta" style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="doc-meta-item"><span><i class="fa-solid fa-folder"></i></span> ${doc.TenMonHoc || doc.TenMH || 'Chung'}</span>
                    <span class="doc-meta-item" style="font-size: 12px; color: var(--text-secondary);"><i class="fa-solid fa-calendar"></i> ${dateStr}</span>
                </div>
                <h3 class="doc-title">
                    ${doc.TenTL || doc.TieuDe}
                </h3>
                <div class="doc-desc" style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">${doc.MoTa || 'Không có mô tả'}</div>
                <div class="doc-footer">
                    <div class="doc-author">
                        ${avatarHtml}
                        <span>${authorName}</span>
                    </div>
                    <div class="doc-stats">
                        <span><i class="fa-solid fa-download" style="color: #6B7280; margin-right: 4px;"></i> ${(doc.SoLuotTai || 0).toLocaleString()}</span>
                        ${ratingHtml}
                    </div>
                </div>
            </div>
        `;
        
        card.style.cursor = 'pointer';
        card.onclick = () => {
            window.location.href = `../document/documentDetails.html?id=${doc.MaTL}`;
        };

        grid.appendChild(card);
    });

    container.appendChild(grid);
}

function updateFollowButtonUI() {
    const btn = document.getElementById('btn-follow');
    btn.style.display = 'block';

    if (isFollowing) {
        btn.innerHTML = '<i class="fa-solid fa-user-check" style="margin-right: 6px;"></i> Đang theo dõi';
        btn.style.backgroundColor = '#E5E7EB'; 
        btn.style.color = '#374151';
        btn.style.border = '1px solid #D1D5DB';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-user-plus" style="margin-right: 6px;"></i> Theo dõi';
        btn.style.backgroundColor = 'var(--primary)'; 
        btn.style.color = 'white';
        btn.style.border = 'none';
    }
}

let isProcessingFollow = false;

async function toggleFollow() {
    if (isProcessingFollow) return;
    
    const btn = document.getElementById('btn-follow');
    isProcessingFollow = true;
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'wait';

    try {
        const res = await fetch(`${API_URL}/users/${currentUserId}/follow`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (res.ok) {
            isFollowing = data.isFollowing;
            updateFollowButtonUI();
        } else {
            Swal.fire(data.message);
        }
    } catch (err) {
        console.error('Lỗi khi toggleFollow:', err);
    } finally {
        setTimeout(() => {
            isProcessingFollow = false;
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }, 2000);
    }
}

