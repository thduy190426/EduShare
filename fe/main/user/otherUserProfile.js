import { API_URL } from '../shared/config.js';
import { formatRatingSummary, getToken, getAssetUrl, decodeJWT, getAvatar } from '../shared/utils.js';

const token = getToken();
let currentUserId = null; 
let isFollowing = false;

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
            if (payload.VaiTro === 'Admin') roleStr = 'Quản trị viên';
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
        document.getElementById('header-email').textContent = profile.Email;
        
        let roleName = 'Sinh viên';
        if (profile.VaiTro === 'GiaoVien') roleName = 'Giáo viên';
        if (profile.VaiTro === 'Admin') roleName = 'Admin';
        document.getElementById('header-role').textContent = roleName;
        
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
        
        fetchUserDocuments();

    } catch (err) {
        console.error('Lỗi khi fetchUserProfile:', err);
    }
}

async function fetchUserDocuments() {
    try {
        const res = await fetch(`${API_URL}/users/${currentUserId}/documents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const docs = data.documents || [];
        
        const container = document.getElementById('user-docs-container');
        container.innerHTML = '';
        
        if (docs.length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary); text-align: center; padding: 20px;">Người dùng này chưa chia sẻ tài liệu nào.</p>';
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

            const userInitial = document.getElementById('header-name').textContent.trim().split(' ').pop().charAt(0).toUpperCase();
            let avatarHtml = `<div class="avatar-sm">${userInitial}</div>`;
            const headerAvatarImg = document.getElementById('header-avatar').querySelector('img');
            if (headerAvatarImg) {
                avatarHtml = `<div class="avatar-sm" style="background:transparent; color:transparent;"><img src="${headerAvatarImg.src}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;"></div>`;
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
                </div>
                <div class="doc-content">
                    <div class="doc-meta" style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="doc-meta-item"><span><i class="fa-solid fa-folder"></i></span> ${doc.TenMonHoc || 'Chung'}</span>
                        <span class="doc-meta-item" style="font-size: 12px; color: var(--text-secondary);"><i class="fa-solid fa-calendar"></i> ${dateStr}</span>
                    </div>
                    <h3 class="doc-title">
                        ${doc.TenTL}
                    </h3>
                    <div class="doc-desc" style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">${doc.MoTa || 'Không có mô tả'}</div>
                    <div class="doc-footer">
                        <div class="doc-author">
                            ${avatarHtml}
                            <span>${document.getElementById('header-name').textContent}</span>
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

            grid.appendChild(card);
        });

        container.appendChild(grid);
    } catch (err) {
        console.error('Lỗi khi fetchUserDocuments:', err);
        document.getElementById('user-docs-container').innerHTML = '<p style="color:red;">Lỗi khi tải tài liệu.</p>';
    }
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

async function toggleFollow() {
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
    }
}

