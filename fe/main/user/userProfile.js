import { API_URL } from '../shared/config.js';
import { getAssetUrl, getToken, setAvatarForCurrentSession } from '../shared/utils.js';

const token = getToken();

const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        Toast.fire({ icon: 'warning', title: 'Vui lòng đăng nhập để xem hồ sơ.' });
        window.location.href = '../guest/guestHome.html';
        return;
    }

    initProfile();
    initFollowers();
    initDocuments();
    setupEventListeners();
});



let followersList = [];
let followingList = [];
let initialProfileState = {};

function checkProfileChanges() {
    const currentHoTen = document.getElementById('input-hoten').value;
    const currentTuoi = document.getElementById('input-tuoi').value;
    const currentGioiTinh = document.getElementById('input-gioitinh').value;
    const currentDiaChi = document.getElementById('input-diachi').value;

    const isChanged = 
        currentHoTen !== initialProfileState.hoTen ||
        currentTuoi !== initialProfileState.tuoi ||
        currentGioiTinh !== initialProfileState.gioiTinh ||
        currentDiaChi !== initialProfileState.diaChi;

    const btnSave = document.getElementById('btn-save-profile');
    if (isChanged && currentHoTen.trim() !== '') {
        btnSave.disabled = false;
        btnSave.style.opacity = '1';
        btnSave.style.cursor = 'pointer';
    } else {
        btnSave.disabled = true;
        btnSave.style.opacity = '0.6';
        btnSave.style.cursor = 'not-allowed';
    }
}

async function initFollowers() {
    try {
        const [followersRes, followingRes] = await Promise.all([
            fetch(`${API_URL}/users/followers`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/users/following`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        if (followersRes.ok) {
            const data = await followersRes.json();
            followersList = data.followers || [];
            document.getElementById('count-followers').textContent = followersList.length;
        }
        if (followingRes.ok) {
            const data = await followingRes.json();
            followingList = data.following || [];
            document.getElementById('count-following').textContent = followingList.length;
        }
    } catch (err) {
        console.error('Lỗi lấy followers/following:', err);
    }
}

window.openFollowModal = function(type) {
    const title = document.getElementById('follow-modal-title');
    const container = document.getElementById('follow-list-container');
    container.innerHTML = '';
    
    let list = [];
    if (type === 'followers') {
        title.textContent = 'Người theo dõi';
        list = followersList;
    } else {
        title.textContent = 'Đang theo dõi';
        list = followingList;
    }
    
    if (list.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-secondary);">Danh sách trống</div>';
    } else {
        list.forEach(user => {
            const avatarHtml = user.AvatarURL 
                ? `<img src="${getAssetUrl(user.AvatarURL)}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">` 
                : `<div style="width:40px; height:40px; border-radius:50%; background:var(--primary); color:white; display:flex; justify-content:center; align-items:center; font-weight:bold;">${user.HoTen.trim().split(' ').pop().charAt(0).toUpperCase()}</div>`;
                
            const roleStr = user.VaiTro === 'SinhVien' ? 'Sinh viên' : (user.VaiTro === 'GiaoVien' ? 'Giảng viên' : 'Quản trị viên');
            
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '12px';
            item.style.padding = '8px';
            item.style.border = '1px solid var(--border)';
            item.style.borderRadius = '8px';
            item.innerHTML = `
                ${avatarHtml}
                <div style="flex:1;">
                    <div style="font-weight:600; font-size:15px;">${user.HoTen}</div>
                    <div style="font-size:13px; color:var(--text-secondary);">${roleStr}</div>
                </div>
                <button onclick="window.location.href='otherUserProfile.html?id=${user.MaND}'" style="padding:6px 12px; background:var(--primary-light); color:var(--primary); border:none; border-radius:4px; cursor:pointer; font-weight:600; font-size:13px;">Xem hồ sơ</button>
            `;
            container.appendChild(item);
        });
    }
    document.getElementById('follow-modal').style.display = 'flex';
};

async function initProfile() {
    try {
        const res = await fetch(`${API_URL}/users/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Không thể lấy thông tin cá nhân.');
        
        const data = await res.json();
        const profile = data.profile;
        
        
        document.getElementById('header-name').textContent = profile.HoTen;
        document.getElementById('header-email').textContent = profile.Email;
        document.getElementById('header-role').textContent = profile.VaiTro === 'SinhVien' ? 'Sinh viên' : profile.VaiTro === 'GiaoVien' ? 'Giảng viên' : 'Quản trị viên';
        
        if (profile.AvatarURL) {
            setAvatarForCurrentSession(profile.AvatarURL);
            const avatarHtml = `<img src="${getAssetUrl(profile.AvatarURL)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            document.getElementById('header-avatar').innerHTML = avatarHtml;
            document.getElementById('nav-avatar').innerHTML = avatarHtml;
            document.getElementById('header-avatar').style.background = 'transparent';
            document.getElementById('nav-avatar').style.background = 'transparent';
        } else {
            const initial = profile.HoTen.trim().split(' ').pop().charAt(0).toUpperCase();
            document.getElementById('header-avatar').textContent = initial;
            document.getElementById('nav-avatar').textContent = initial;
            document.getElementById('header-avatar').style.background = '';
            document.getElementById('nav-avatar').style.background = '';
        }

        
        document.getElementById('input-hoten').value = profile.HoTen;
        document.getElementById('input-email').value = profile.Email; 
        document.getElementById('input-tuoi').value = profile.Tuoi || '';
        document.getElementById('input-gioitinh').value = normalizeGioiTinhValue(profile.GioiTinh);
        document.getElementById('input-diachi').value = profile.DiaChi || '';
        
        initialProfileState = {
            hoTen: profile.HoTen || '',
            tuoi: profile.Tuoi ? String(profile.Tuoi) : '',
            gioiTinh: normalizeGioiTinhValue(profile.GioiTinh),
            diaChi: profile.DiaChi || ''
        };
        checkProfileChanges();
    } catch (err) {
        console.error(err);
        Toast.fire({ icon: 'error', title: err.message });
    }
}

async function saveProfile() {
    const hoTen = document.getElementById('input-hoten').value;
    const tuoi = document.getElementById('input-tuoi').value;
    const gioiTinh = document.getElementById('input-gioitinh').value;
    const diaChi = document.getElementById('input-diachi').value;
    
    if (!hoTen.trim()) return Toast.fire({ icon: 'warning', title: 'Họ tên không được để trống.' });

    try {
        const res = await fetch(`${API_URL}/users/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ hoTen, tuoi, gioiTinh, diaChi })
        });
        const data = await res.json();
        if (res.ok) {
            Toast.fire({ icon: 'success', title: 'Cập nhật thông tin thành công!' });
            if (data.token) {
                if (localStorage.getItem('token')) {
                    localStorage.setItem('token', data.token);
                } else if (sessionStorage.getItem('token')) {
                    sessionStorage.setItem('token', data.token);
                }
            }
            setTimeout(() => window.location.reload(), 1500);
        } else {
            Toast.fire({ icon: 'error', title: data.message });
        }
    } catch (err) {
        console.error(err);
    }
}

function normalizeGioiTinhValue(value) {
    if (!value) return 'Khac';

    const normalized = String(value).trim().toLowerCase();
    const genderMap = {
        nam: 'Nam',
        nu: 'Nu',
        'nữ': 'Nu',
        khac: 'Khac',
        'khác': 'Khac',
    };

    return genderMap[normalized] || 'Khac';
}

async function changePassword() {
    const matKhauCu = document.getElementById('input-old-pw').value;
    const matKhauMoi = document.getElementById('input-new-pw').value;
    const confirm = document.getElementById('input-confirm-pw').value;
    const hoTen = document.getElementById('input-hoten').value;

    if (!matKhauCu || !matKhauMoi || !confirm) return Toast.fire({ icon: 'warning', title: 'Vui lòng điền đủ thông tin đổi mật khẩu.' });
    if (matKhauMoi !== confirm) return Toast.fire({ icon: 'warning', title: 'Mật khẩu xác nhận không khớp.' });

    try {
        const res = await fetch(`${API_URL}/users/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ hoTen, matKhauCu, matKhauMoi })
        });
        const data = await res.json();
        if (res.ok) {
            Toast.fire({ icon: 'success', title: 'Cập nhật mật khẩu thành công!' });
            if (data.token) {
                if (localStorage.getItem('token')) {
                    localStorage.setItem('token', data.token);
                } else if (sessionStorage.getItem('token')) {
                    sessionStorage.setItem('token', data.token);
                }
            }
            document.getElementById('input-old-pw').value = '';
            document.getElementById('input-new-pw').value = '';
            document.getElementById('input-confirm-pw').value = '';
            checkPasswordChanges();
            
            const btnTogglePwd = document.getElementById('btn-toggle-pwd');
            if (btnTogglePwd) {
                document.getElementById('pwd-content').classList.remove('expanded');
                btnTogglePwd.classList.remove('expanded');
                btnTogglePwd.querySelector('.toggle-text').textContent = 'Mở rộng';
            }
        } else {
            Toast.fire({ icon: 'error', title: data.message });
        }
    } catch (err) {
        console.error(err);
    }
}




async function initDocuments() {
    await fetchMyDocuments();
    await fetchBookmarks();
    await fetchMyReports();
}

async function fetchMyDocuments() {
    try {
        const res = await fetch(`${API_URL}/users/my-documents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const container = document.getElementById('my-docs-container');
        container.innerHTML = '';
        
        if (data.documents.length === 0) {
            container.innerHTML = '<p>Bạn chưa đăng tài liệu nào.</p>';
            return;
        }

        data.documents.forEach((doc, index) => {
            const el = document.createElement('div');
            el.className = 'doc-item';
            el.style.animationDelay = `${index * 0.04}s`;
            
            let icon = 'fa-file';
            let loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';
            if (loaiFile === 'pdf') icon = 'fa-file-pdf';
            else if (loaiFile === 'pptx' || loaiFile === 'ppt') icon = 'fa-chart-column';
            else if (loaiFile === 'docx' || loaiFile === 'doc') icon = 'fa-pen-to-square';

            const statusColor = doc.TrangThaiKiemDuyet === 'DaDuyet' ? 'var(--success)' : 
                               (doc.TrangThaiKiemDuyet === 'ChoDuyet' ? 'var(--warning)' : 'var(--danger)');
            const statusText = doc.TrangThaiKiemDuyet === 'DaDuyet' ? 'Đã duyệt' : 
                              (doc.TrangThaiKiemDuyet === 'ChoDuyet' ? 'Chờ kiểm duyệt' : 'Từ chối');

            el.innerHTML = `
                <div class="doc-info">
                  <div class="doc-icon"><i class="fa-solid ${icon}"></i></div>
                  <div>
                    <div class="doc-title">${doc.TenTL}</div>
                    <div class="doc-meta">
                      <span>Môn: ${doc.TenMonHoc || 'Không xác định'}</span>
                      <span>•</span>
                      <span>${doc.SoLuotTai || 0} lượt tải</span>
                      <span>•</span>
                      <span style="color:${statusColor}; font-weight:500;">${statusText}</span>
                    </div>
                  </div>
                </div>
                <a href="../document/documentDetails.html?id=${doc.MaTL}" class="btn-outline-primary"><i class="fa-solid fa-eye" style="margin-right: 6px;"></i> Xem chi tiết</a>
            `;
            container.appendChild(el);
        });
    } catch (err) {
        console.error(err);
    }
}

async function fetchBookmarks() {
    try {
        const res = await fetch(`${API_URL}/users/bookmarks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const container = document.getElementById('bookmarks-container');
        container.innerHTML = '';
        
        if (data.documents.length === 0) {
            container.innerHTML = '<p>Bạn chưa lưu tài liệu nào.</p>';
            return;
        }

        data.documents.forEach((doc, index) => {
            const el = document.createElement('div');
            el.className = 'doc-item';
            el.style.animationDelay = `${index * 0.04}s`;
            
            let icon = 'fa-file';
            let loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';
            if (loaiFile === 'pdf') icon = 'fa-file-pdf';
            else if (loaiFile === 'pptx' || loaiFile === 'ppt') icon = 'fa-chart-column';
            else if (loaiFile === 'docx' || loaiFile === 'doc') icon = 'fa-pen-to-square';

            const dateStr = new Date(doc.NgayLuu).toLocaleDateString('vi-VN');

            el.innerHTML = `
                <div class="doc-info">
                  <div class="doc-icon"><i class="fa-solid ${icon}"></i></div>
                  <div>
                    <div class="doc-title">${doc.TenTL}</div>
                    <div class="doc-meta">
                      <span>Người đăng: ${doc.TenNguoiDang}</span>
                      <span>•</span>
                      <span>Môn: ${doc.TenMonHoc || 'Không xác định'}</span>
                      <span>•</span>
                      <span style="color:var(--text-secondary);">Lưu ngày: ${dateStr}</span>
                    </div>
                  </div>
                </div>
                <a href="../document/documentDetails.html?id=${doc.MaTL}" class="btn-outline-primary"><i class="fa-solid fa-eye" style="margin-right: 6px;"></i> Xem chi tiết</a>
            `;
            container.appendChild(el);
        });
    } catch (err) {
        console.error(err);
    }
}

async function fetchMyReports() {
    try {
        const res = await fetch(`${API_URL}/users/my-reports`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const container = document.getElementById('my-reports-container');
        container.innerHTML = '';
        
        if (!data.reports || data.reports.length === 0) {
            container.innerHTML = '<p>Bạn chưa gửi báo cáo nào.</p>';
            return;
        }

        data.reports.forEach((report, index) => {
            const el = document.createElement('div');
            el.className = 'doc-item';
            el.style.animationDelay = `${index * 0.04}s`;
            
            const statusColor = report.TrangThai === 'DaXuLy' ? 'var(--success)' : 
                               (report.TrangThai === 'ChoXuLy' ? 'var(--warning)' : 'var(--danger)');
            const statusText = report.TrangThai === 'DaXuLy' ? 'Đã xử lý' : 
                              (report.TrangThai === 'ChoXuLy' ? 'Chờ xử lý' : 'Từ chối');
            const dateStr = new Date(report.NgayBaoCao).toLocaleDateString('vi-VN');

            el.innerHTML = `
                <div class="doc-info" style="flex:1;">
                  <div>
                    <div class="doc-title" style="margin-bottom: 5px;">Tài liệu: ${report.TenTL || 'N/A'}</div>
                    <div class="doc-meta" style="color: var(--text-primary); margin-bottom: 5px;">
                      Lý do: <strong>${report.LyDo}</strong>
                    </div>
                    <div class="doc-meta">
                      <span style="color:${statusColor}; font-weight:500;">${statusText}</span>
                      <span>•</span>
                      <span style="color:var(--text-secondary);">Ngày gửi: ${dateStr}</span>
                    </div>
                  </div>
                </div>
                <a href="../document/documentDetails.html?id=${report.MaTL}" class="btn-outline-primary"><i class="fa-solid fa-eye" style="margin-right: 6px;"></i> Xem tài liệu</a>
            `;
            container.appendChild(el);
        });
    } catch (err) {
        console.error(err);
    }
}

function setupTabListeners() {
    const tabMyDocs = document.getElementById('tab-my-docs');
    const tabBookmarks = document.getElementById('tab-bookmarks');
    const tabMyReports = document.getElementById('tab-my-reports');
    
    const containerMyDocs = document.getElementById('my-docs-container');
    const containerBookmarks = document.getElementById('bookmarks-container');
    const containerMyReports = document.getElementById('my-reports-container');

    function resetTabs() {
        tabMyDocs.classList.remove('active');
        tabBookmarks.classList.remove('active');
        tabMyReports.classList.remove('active');
        
        containerMyDocs.style.display = 'none';
        containerBookmarks.style.display = 'none';
        containerMyReports.style.display = 'none';
    }

    tabMyDocs.addEventListener('click', () => {
        resetTabs();
        tabMyDocs.classList.add('active');
        containerMyDocs.style.display = 'flex';
        containerMyDocs.style.flexDirection = 'column';
        containerMyDocs.style.gap = '15px';
    });

    tabBookmarks.addEventListener('click', () => {
        resetTabs();
        tabBookmarks.classList.add('active');
        containerBookmarks.style.display = 'flex';
        containerBookmarks.style.flexDirection = 'column';
        containerBookmarks.style.gap = '15px';
    });
    
    tabMyReports.addEventListener('click', () => {
        resetTabs();
        tabMyReports.classList.add('active');
        containerMyReports.style.display = 'flex';
        containerMyReports.style.flexDirection = 'column';
        containerMyReports.style.gap = '15px';
    });
}




async function initNotificationsLegacy() {
    try {
        const res = await fetch(`${API_URL}/notifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        const list = document.getElementById('notif-list');
        list.innerHTML = '';
        
        let unreadCount = 0;
        
        if (data.notifications.length === 0) {
            list.innerHTML = '<div style="padding:15px; text-align:center; color:#6b7280;">Chưa có thông báo nào.</div>';
        } else {
            data.notifications.forEach(tb => {
                if (!tb.DaDoc) unreadCount++;
                
                const item = document.createElement('div');
                item.style.padding = '12px 16px';
                item.style.borderBottom = '1px solid #E5E7EB';
                item.style.cursor = 'pointer';
                if (!tb.DaDoc) {
                    item.style.backgroundColor = '#EFF6FF'; 
                    item.style.fontWeight = '600';
                }

                item.innerHTML = `
                    <div style="font-size: 14px; margin-bottom: 4px;">${tb.NoiDung}</div>
                    <div style="font-size: 12px; color: #6B7280;">${new Date(tb.NgayTao).toLocaleString('vi-VN')}</div>
                `;

                
                item.addEventListener('click', async () => {
                    if (!tb.DaDoc) {
                        try {
                            const readRes = await fetch(`${API_URL}/notifications/${tb.MaTB}/read`, {
                                method: 'PUT',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (readRes.ok) {
                                item.style.backgroundColor = 'transparent';
                                item.style.fontWeight = '400';
                                tb.DaDoc = true;
                                unreadCount--;
                                updateNotifBadge(unreadCount);
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    }
                });

                list.appendChild(item);
            });
        }

        updateNotifBadge(unreadCount);

    } catch (err) {
        console.error(err);
    }
}

function updateNotifBadge(count) {
    const badge = document.getElementById('notif-badge');
    if (count > 0) {
        badge.style.display = 'block';
        badge.textContent = count;
    } else {
        badge.style.display = 'none';
    }
}

function checkPasswordChanges() {
    const matKhauCu = document.getElementById('input-old-pw').value;
    const matKhauMoi = document.getElementById('input-new-pw').value;
    const confirm = document.getElementById('input-confirm-pw').value;
    const btn = document.getElementById('btn-change-pw');
    
    if (matKhauCu.trim() && matKhauMoi.trim() && confirm.trim() && matKhauMoi === confirm) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }
}

function setupEventListeners() {
    document.getElementById('btn-save-profile').addEventListener('click', saveProfile);
    
    const btnChangePw = document.getElementById('btn-change-pw');
    btnChangePw.addEventListener('click', changePassword);
    
    checkPasswordChanges();
    ['input-old-pw', 'input-new-pw', 'input-confirm-pw'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', checkPasswordChanges);
    });
    
    ['input-hoten', 'input-tuoi', 'input-diachi'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', checkProfileChanges);
    });
    const gioiTinhEl = document.getElementById('input-gioitinh');
    if(gioiTinhEl) gioiTinhEl.addEventListener('change', checkProfileChanges);
    
    const btnTogglePwd = document.getElementById('btn-toggle-pwd');
    if (btnTogglePwd) {
        btnTogglePwd.addEventListener('click', () => {
            const content = document.getElementById('pwd-content');
            const textSpan = btnTogglePwd.querySelector('.toggle-text');
            const isExpanded = content.classList.contains('expanded');
            
            if (isExpanded) {
                content.classList.remove('expanded');
                btnTogglePwd.classList.remove('expanded');
                textSpan.textContent = 'Mở rộng';
            } else {
                content.classList.add('expanded');
                btnTogglePwd.classList.add('expanded');
                textSpan.textContent = 'Thu gọn';
            }
        });
    }
    
    setupTabListeners();

    const btnEditAvatar = document.querySelector('.btn-edit-avatar');
    const inputAvatar = document.getElementById('input-avatar');
    if (btnEditAvatar && inputAvatar) {
        btnEditAvatar.addEventListener('click', () => {
            inputAvatar.click();
        });

        inputAvatar.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('avatar', file);

            try {
                Swal.fire({
                    title: 'Đang tải lên...',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });

                const res = await fetch(`${API_URL}/users/profile/avatar`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await res.json();
                
                if (res.ok) {
                    Toast.fire({ icon: 'success', title: data.message });
                    initProfile();
                } else {
                    Toast.fire({ icon: 'error', title: data.message });
                }
            } catch (err) {
                console.error(err);
                Toast.fire({ icon: 'error', title: 'Không thể tải lên ảnh đại diện.' });
            } finally {
                inputAvatar.value = '';
            }
        });
    }

    
    const btnNotif = document.getElementById('btn-notifications');
    const dropdown = document.getElementById('notif-dropdown');
    if (!btnNotif || !dropdown) return;
    btnNotif.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', () => {
        dropdown.style.display = 'none';
    });
    
    dropdown.addEventListener('click', (e) => {
        e.stopPropagation(); 
    });
}

