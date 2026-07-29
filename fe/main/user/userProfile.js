import { API_URL } from '../shared/config.js';
import { clearAuthSession, formatRatingSummary, getAssetUrl, getToken, setAvatarForCurrentSession, escapeHTML } from '../shared/utils.js';

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
let currentProfile = null;

function renderCurrentUserAvatar(profile) {
    const headerAvatar = document.getElementById('header-avatar');
    const navAvatar = document.getElementById('nav-avatar');
    const btnDeleteAvatar = document.getElementById('btn-delete-avatar');
    if (!headerAvatar || !navAvatar || !profile) return;

    if (profile.AvatarURL) {
        setAvatarForCurrentSession(profile.AvatarURL);
        const avatarHtml = `<img src="${getAssetUrl(profile.AvatarURL)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" referrerpolicy="no-referrer">`;
        headerAvatar.innerHTML = avatarHtml;
        navAvatar.innerHTML = avatarHtml;
        headerAvatar.style.background = 'transparent';
        navAvatar.style.background = 'transparent';
        headerAvatar.style.color = 'transparent';
        navAvatar.style.color = 'transparent';
        btnDeleteAvatar?.classList.add('is-visible');
        return;
    }

    setAvatarForCurrentSession(null);
    const initial = profile.HoTen.trim().split(' ').pop().charAt(0).toUpperCase();
    headerAvatar.textContent = initial;
    navAvatar.textContent = initial;
    headerAvatar.style.background = 'var(--primary-light)';
    navAvatar.style.background = 'var(--primary-light)';
    headerAvatar.style.color = 'var(--primary)';
    navAvatar.style.color = 'var(--primary)';
    btnDeleteAvatar?.classList.remove('is-visible');
}

function checkProfileChanges() {
    const currentHoTen = document.getElementById('input-hoten').value;
    const currentTuoi = document.getElementById('input-tuoi').value;
    const currentGioiTinh = document.getElementById('input-gioitinh').value;
    const currentDiaChi = document.getElementById('input-diachi').value;
    const currentTruongHoc = document.getElementById('input-truonghoc').value;
    const currentKhoaNganh = document.getElementById('input-khoanganh').value;
    const currentPrivacyDownloads = document.getElementById('input-privacy-downloads').checked;
    const currentPrivacyRatings = document.getElementById('input-privacy-ratings').checked;

    const isChanged = 
        currentHoTen !== initialProfileState.hoTen ||
        currentTuoi !== initialProfileState.tuoi ||
        currentGioiTinh !== initialProfileState.gioiTinh ||
        currentDiaChi !== initialProfileState.diaChi ||
        currentTruongHoc !== initialProfileState.truongHoc ||
        currentKhoaNganh !== initialProfileState.khoaNganh ||
        currentPrivacyDownloads !== initialProfileState.privacyDownloads ||
        currentPrivacyRatings !== initialProfileState.privacyRatings;

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
                : `<div style="width:40px; height:40px; border-radius:50%; background:var(--primary-light); color:var(--primary); display:flex; justify-content:center; align-items:center; font-weight:bold;">${user.HoTen.trim().split(' ').pop().charAt(0).toUpperCase()}</div>`;

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

window.closeFollowModal = function() {
    const modal = document.getElementById('follow-modal');
    if (!modal) return;
    modal.classList.add('closing');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('closing');
    }, 250);
};

async function initProfile() {
    try {
        const [res, schoolRes, majorRes] = await Promise.all([
            fetch(`${API_URL}/users/profile`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/truonghoc`),
            fetch(`${API_URL}/khoanganh`)
        ]);
        if (!res.ok) throw new Error('Không thể lấy thông tin cá nhân.');
        
        const data = await res.json();
        const profile = data.profile;
        currentProfile = profile;

        if (schoolRes.ok && majorRes.ok) {
            const schoolData = await schoolRes.json();
            const majorData = await majorRes.json();
            
            const schoolSelect = document.getElementById('input-truonghoc');
            const majorSelect = document.getElementById('input-khoanganh');
            
            if (schoolSelect) {
                schoolData.truongHoc.forEach(school => {
                    const option = document.createElement('option');
                    option.value = school.TenTruong;
                    option.textContent = school.TenTruong;
                    schoolSelect.appendChild(option);
                });
            }
            
            if (majorSelect) {
                majorData.khoaNganh.forEach(major => {
                    const option = document.createElement('option');
                    option.value = major.TenKhoa;
                    option.textContent = major.TenKhoa;
                    majorSelect.appendChild(option);
                });
            }
        }
        
        
        document.getElementById('header-name').textContent = profile.HoTen;
        document.getElementById('header-email').textContent = profile.Email;
        document.getElementById('header-role').textContent = profile.VaiTro === 'SinhVien' ? 'Sinh viên' : profile.VaiTro === 'GiaoVien' ? 'Giảng viên' : 'Quản trị viên';
        const elSoDuXu = document.getElementById('header-soduxu');
        if (elSoDuXu) {
            if (profile.VaiTro === 'SinhVien') {
                elSoDuXu.textContent = (profile.SoDuXu || 0).toLocaleString();
            } else {
                elSoDuXu.parentElement.style.display = 'none';
            }
        }
        
        const tabGiaoDich = document.querySelector('.tab-btn[data-tab="transactions"]');
        if (tabGiaoDich && profile.VaiTro !== 'SinhVien') {
            tabGiaoDich.style.display = 'none';
        }
        
        renderCurrentUserAvatar(profile);

        
        document.getElementById('input-hoten').value = profile.HoTen;
        document.getElementById('input-email').value = profile.Email; 
        document.getElementById('input-tuoi').value = profile.Tuoi || '';
        document.getElementById('input-gioitinh').value = normalizeGioiTinhValue(profile.GioiTinh);
        document.getElementById('input-diachi').value = profile.DiaChi || '';
        document.getElementById('input-truonghoc').value = profile.TruongHoc || '';
        document.getElementById('input-khoanganh').value = profile.KhoaNganh || '';
        document.getElementById('input-privacy-downloads').checked = profile.HienThiLichSuTai !== 0;
        document.getElementById('input-privacy-ratings').checked = profile.HienThiDanhGia !== 0;

        if (profile.AuthType !== 'Local') {
            const changePasswordSection = document.getElementById('change-password-section');
            if (changePasswordSection) changePasswordSection.style.display = 'none';
        }
        
        initialProfileState = {
            hoTen: profile.HoTen || '',
            tuoi: profile.Tuoi ? String(profile.Tuoi) : '',
            gioiTinh: normalizeGioiTinhValue(profile.GioiTinh),
            diaChi: profile.DiaChi || '',
            truongHoc: profile.TruongHoc || '',
            khoaNganh: profile.KhoaNganh || '',
            privacyDownloads: profile.HienThiLichSuTai !== 0,
            privacyRatings: profile.HienThiDanhGia !== 0
        };
        checkProfileChanges();
        
        if (profile.VaiTro === 'SinhVien') {
            document.getElementById('upgrade-teacher-section').style.display = 'block';
            initUpgradeTeacher();
        }
    } catch (err) {
        console.error(err);
        Toast.fire({ icon: 'error', title: err.message });
    }
}

async function initUpgradeTeacher() {
    const statusContainer = document.getElementById('upgrade-status-container');
    const form = document.getElementById('form-upgrade-teacher');
    
    try {
        const res = await fetch(`${API_URL}/users/upgrade-status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.status) {
            statusContainer.style.display = 'block';
            if (data.status.TrangThai === 'ChoDuyet') {
                const d = new Date(data.status.NgayTao);
                const timeStr = d.toLocaleTimeString('vi-VN', { hour12: false });
                const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                statusContainer.innerHTML = `<i class="fa-solid fa-clock" style="color: #F59E0B; margin-right: 8px;"></i> Yêu cầu của bạn đang chờ Admin xét duyệt (Gửi lúc: ${timeStr} ${dateStr}).`;
                statusContainer.style.backgroundColor = '#FEF3C7';
                statusContainer.style.border = '1px solid #FDE68A';
                statusContainer.style.color = '#B45309';
                form.style.display = 'none';
            } else if (data.status.TrangThai === 'TuChoi') {
                statusContainer.innerHTML = `
                    <div style="font-weight: 600;"><i class="fa-solid fa-circle-xmark" style="color: #EF4444; margin-right: 8px;"></i> Yêu cầu bị từ chối</div>
                    <div style="margin-top: 4px; font-size: 13px;">Lý do: ${data.status.LyDoTuChoi || 'Không hợp lệ'}</div>
                    <div style="margin-top: 4px; font-size: 13px;">Bạn có thể nộp lại minh chứng bên dưới.</div>
                `;
                statusContainer.style.backgroundColor = '#FEE2E2';
                statusContainer.style.border = '1px solid #FECACA';
                statusContainer.style.color = '#B91C1C';
                form.style.display = 'block';
            } else if (data.status.TrangThai === 'DaDuyet') {
                document.getElementById('upgrade-teacher-section').style.display = 'none';
            }
        }
    } catch (err) {
        console.error('Lỗi lấy trạng thái nâng cấp:', err);
    }
}


async function saveProfile() {
    const hoTen = document.getElementById('input-hoten').value;
    const tuoi = document.getElementById('input-tuoi').value;
    const gioiTinh = document.getElementById('input-gioitinh').value;
    const diaChi = document.getElementById('input-diachi').value;
    const truongHoc = document.getElementById('input-truonghoc').value;
    const khoaNganh = document.getElementById('input-khoanganh').value;
    const hienThiLichSuTai = document.getElementById('input-privacy-downloads').checked ? 1 : 0;
    const hienThiDanhGia = document.getElementById('input-privacy-ratings').checked ? 1 : 0;
    
    if (!hoTen.trim()) return Toast.fire({ icon: 'warning', title: 'Họ tên không được để trống.' });

    try {
        const res = await fetch(`${API_URL}/users/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ hoTen, tuoi, gioiTinh, diaChi, truongHoc, khoaNganh, hienThiLichSuTai, hienThiDanhGia })
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
    const otp = document.getElementById('input-change-pw-otp').value;
    const hoTen = document.getElementById('input-hoten').value;

    if (!matKhauCu || !matKhauMoi || !confirm || !otp) return Toast.fire({ icon: 'warning', title: 'Vui lòng điền đủ thông tin đổi mật khẩu và mã OTP.' });
    if (matKhauMoi !== confirm) return Toast.fire({ icon: 'warning', title: 'Mật khẩu xác nhận không khớp.' });

    try {
        const res = await fetch(`${API_URL}/users/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ hoTen, matKhauCu, matKhauMoi, otp, hienThiLichSuTai: document.getElementById('input-privacy-downloads').checked ? 1 : 0, hienThiDanhGia: document.getElementById('input-privacy-ratings').checked ? 1 : 0 })
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
            document.getElementById('input-change-pw-otp').value = '';
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

let isDeletingAccount = false;



let currentAppealDocId = null;

window.openRejectReasonModal = function(docId, title, reason) {
    currentAppealDocId = docId;
    document.getElementById('reject-reason-doc-title').textContent = title;
    document.getElementById('reject-reason-content').textContent = reason || 'Không có lý do cụ thể.';
    
    const input = document.getElementById('input-reject-appeal');
    input.value = '';
    
    const btnSubmit = document.getElementById('btn-submit-appeal');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.style.opacity = '0.5';
        btnSubmit.style.cursor = 'not-allowed';
    }
    
    const modal = document.getElementById('reject-reason-modal');
    modal.style.display = 'flex';
    setTimeout(() => { modal.style.opacity = '1'; }, 10);
};

window.closeRejectReasonModal = function() {
    currentAppealDocId = null;
    const modal = document.getElementById('reject-reason-modal');
    modal.style.opacity = '0';
    setTimeout(() => { modal.style.display = 'none'; }, 300);
};

function openDeleteAccountModal() {
    const modal = document.getElementById('delete-account-modal');
    if (!modal) return;
    
    const inputPw = document.getElementById('input-delete-pw');
    const deletePwWrapper = document.getElementById('delete-pw-wrapper');
    const inputOtp = document.getElementById('input-delete-otp');
    const errorMsg = document.getElementById('delete-pw-error');
    const btnConfirm = document.getElementById('btn-confirm-delete');
    const btnSendOtp = document.getElementById('btn-send-delete-otp');

    if (currentProfile && currentProfile.AuthType !== 'Local') {
        if (deletePwWrapper) deletePwWrapper.style.display = 'none';
    } else {
        if (deletePwWrapper) deletePwWrapper.style.display = 'block';
    }
    
    if(inputPw) inputPw.value = '';
    if(inputOtp) inputOtp.value = '';
    
    if (btnSendOtp) {
        btnSendOtp.disabled = false;
        btnSendOtp.innerHTML = '<i class="fa-solid fa-paper-plane" style="margin-right: 6px;"></i> Gửi mã OTP';
        btnSendOtp.style.opacity = '1';
        btnSendOtp.style.cursor = 'pointer';
        clearInterval(deleteOtpTimer);
    }
    errorMsg.style.display = 'none';
    
    if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.style.opacity = '0.5';
        btnConfirm.style.cursor = 'not-allowed';
    }
    
    modal.style.display = 'flex';
    modal.offsetHeight; 
    modal.style.opacity = '1';
    modal.querySelector('.modal-content').style.transform = 'scale(1)';
    
    setTimeout(() => {
        inputPw.focus();
    }, 300);
}

function closeDeleteAccountModal() {
    const modal = document.getElementById('delete-account-modal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.querySelector('.modal-content').style.transform = 'scale(0.9)';
    
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

let deleteOtpTimer;

async function sendDeleteAccountOtp() {
    const btnSendOtp = document.getElementById('btn-send-delete-otp');
    
    btnSendOtp.disabled = true;
    btnSendOtp.style.opacity = '0.5';
    btnSendOtp.style.cursor = 'not-allowed';
    const originalHTML = btnSendOtp.innerHTML;
    btnSendOtp.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const res = await fetch(`${API_URL}/users/profile/delete-otp`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json();

        if (!res.ok) {
            Toast.fire({ icon: 'error', title: data.message || 'Lỗi gửi OTP.' });
            btnSendOtp.disabled = false;
            btnSendOtp.style.opacity = '1';
            btnSendOtp.style.cursor = 'pointer';
            btnSendOtp.innerHTML = originalHTML;
            return;
        }

        Toast.fire({ icon: 'success', title: data.message });

        let timeLeft = 60;
        btnSendOtp.innerHTML = `<i class="fa-solid fa-paper-plane" style="margin-right: 6px;"></i> Gửi lại (${timeLeft}s)`;
        
        clearInterval(deleteOtpTimer);
        deleteOtpTimer = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(deleteOtpTimer);
                btnSendOtp.disabled = false;
                btnSendOtp.style.opacity = '1';
                btnSendOtp.style.cursor = 'pointer';
                btnSendOtp.innerHTML = '<i class="fa-solid fa-paper-plane" style="margin-right: 6px;"></i> Gửi mã OTP';
            } else {
                btnSendOtp.innerHTML = `<i class="fa-solid fa-paper-plane" style="margin-right: 6px;"></i> Gửi lại (${timeLeft}s)`;
            }
        }, 1000);

    } catch (err) {
        console.error('Lỗi gửi OTP xoá tài khoản:', err);
        Toast.fire({ icon: 'error', title: 'Lỗi máy chủ khi gửi OTP.' });
        btnSendOtp.disabled = false;
        btnSendOtp.style.opacity = '1';
        btnSendOtp.style.cursor = 'pointer';
        btnSendOtp.innerHTML = originalHTML;
    }
}

async function processDeleteAccount() {
    if (isDeletingAccount) return;
    
    const inputPw = document.getElementById('input-delete-pw');
    const inputOtp = document.getElementById('input-delete-otp');
    const errorMsg = document.getElementById('delete-pw-error');
    const matKhau = inputPw ? inputPw.value.trim() : '';
    const otp = inputOtp ? inputOtp.value.trim() : '';
    const errorTextSpan = errorMsg.querySelector('span');
    
    const isLocal = !currentProfile || currentProfile.AuthType === 'Local';

    if (isLocal && !matKhau) {
        errorTextSpan.textContent = 'Vui lòng nhập mật khẩu để xác nhận.';
        errorMsg.style.display = 'block';
        return;
    }
    if (!otp) {
        errorTextSpan.textContent = 'Vui lòng nhập mã OTP để xác nhận.';
        errorMsg.style.display = 'block';
        return;
    }
    
    errorMsg.style.display = 'none';
    isDeletingAccount = true;
    
    const btnConfirm = document.getElementById('btn-confirm-delete');
    if (!btnConfirm) return;
    const originalText = btnConfirm.innerHTML;
    btnConfirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;"></i> Đang xử lý...';
    btnConfirm.style.pointerEvents = 'none';
    btnConfirm.style.opacity = '0.7';

    try {
        const res = await fetch(`${API_URL}/users/profile`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ matKhau, otp })
        });
        const data = await res.json();

        if (!res.ok) {
            errorTextSpan.textContent = data.message || 'Không thể xoá tài khoản.';
            errorMsg.style.display = 'block';
            isDeletingAccount = false;
            btnConfirm.innerHTML = originalText;
            btnConfirm.style.pointerEvents = 'auto';
            btnConfirm.style.opacity = '1';
            return;
        }

        clearAuthSession();
        Toast.fire({ icon: 'success', title: data.message || 'Đã xoá tài khoản thành công.' });
        closeDeleteAccountModal();
        setTimeout(() => {
            window.location.href = '../guest/guestHome.html';
        }, 1500);
    } catch (err) {
        console.error(err);
        errorTextSpan.textContent = 'Không thể xoá tài khoản lúc này. Vui lòng thử lại sau.';
        errorMsg.style.display = 'block';
        isDeletingAccount = false;
        btnConfirm.innerHTML = originalText;
        btnConfirm.style.pointerEvents = 'auto';
        btnConfirm.style.opacity = '1';
    }
}


async function deleteAvatar() {
    if (!currentProfile?.AvatarURL) return;

    const result = await Swal.fire({
        title: 'Xoá ảnh đại diện?',
        text: 'Hồ sơ của bạn sẽ quay về ảnh mặc định.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xoá',
        cancelButtonText: 'Huỷ',
        confirmButtonColor: '#EF4444'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/users/profile/avatar`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) {
            Toast.fire({ icon: 'error', title: data.message || 'Không thể xoá ảnh đại diện.' });
            return;
        }

        currentProfile = { ...currentProfile, AvatarURL: null };
        renderCurrentUserAvatar(currentProfile);
        Toast.fire({ icon: 'success', title: data.message || 'Đã xoá ảnh đại diện.' });
    } catch (err) {
        console.error(err);
        Toast.fire({ icon: 'error', title: 'Không thể xoá ảnh đại diện lúc này.' });
    }
}




async function initDocuments() {
    await fetchMyDocuments();
    await fetchBookmarks();
    await fetchPurchasedDocuments();
    await fetchTransactions();
    await fetchMyReports();
}

async function fetchMyDocuments() {
    try {
        const res = await fetch(`${API_URL}/users/my-documents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const tab = document.getElementById('tab-my-docs');
        if (tab) tab.innerHTML = `<i class="fa-solid fa-folder-open" style="margin-right: 6px;"></i> Tài liệu của tôi (${data.documents ? data.documents.length : 0})`;
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
            let iconColor = 'inherit';
            let loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';
            if (loaiFile === 'pdf') { icon = 'fa-file-pdf'; iconColor = '#DC2626'; }
            else if (loaiFile === 'pptx' || loaiFile === 'ppt') { icon = 'fa-file-powerpoint'; iconColor = '#EA580C'; }
            else if (loaiFile === 'docx' || loaiFile === 'doc') { icon = 'fa-file-word'; iconColor = '#2563EB'; }

            const statusColor = doc.TrangThaiKiemDuyet === 'DaDuyet' ? 'var(--success)' : 
                               (doc.TrangThaiKiemDuyet === 'ChoDuyet' ? 'var(--warning)' : 'var(--danger)');
            const statusText = doc.TrangThaiKiemDuyet === 'DaDuyet' ? 'Đã duyệt' : 
                              (doc.TrangThaiKiemDuyet === 'ChoDuyet' ? 'Chờ kiểm duyệt' : 'Từ chối');

            let actionBtn = `<a href="../document/documentDetails.html?id=${doc.MaTL}" class="btn-outline-primary"><i class="fa-solid fa-eye" style="margin-right: 6px;"></i> Xem chi tiết</a>`;
            if (doc.TrangThaiKiemDuyet === 'TuChoi') {
                const rejectReason = doc.LyDoTuChoi ? doc.LyDoTuChoi.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, "\\n").replace(/\r/g, "") : '';
                const docTitle = doc.TenTL ? doc.TenTL.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, "\\n").replace(/\r/g, "") : '';
                actionBtn = `<button onclick="window.openRejectReasonModal(${doc.MaTL}, '${docTitle}', '${rejectReason}')" class="btn-outline-primary" style="color: var(--danger); border-color: var(--danger); cursor: pointer; background: transparent;"><i class="fa-solid fa-circle-info" style="margin-right: 6px;"></i> Xem lí do từ chối</button>`;
            }

            el.innerHTML = `
                <div class="doc-info">
                  <div class="doc-icon"><i class="fa-solid ${icon}" style="color: ${iconColor};"></i></div>
                  <div>
                    <div class="doc-title">${doc.TenTL} ${doc.LaTaiLieuDocQuyen ? `<span style="margin-left: 8px; background: #FEF3C7; color: #B45309; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-crown" style="color: #F59E0B;"></i> PREMIUM</span>` : ''}</div>
                    <div class="doc-meta">
                      <span>Môn học: ${doc.TenMonHoc || 'Không xác định'}</span>
                      <span>•</span>
                      <span>${doc.SoLuotTai || 0} lượt tải</span>
                      <span>•</span>
                      <span><i class="fa-solid fa-star" style="color:#F59E0B; margin-right:4px;"></i>${formatRatingSummary(doc.DiemDanhGia, doc.SoDanhGia)}</span>
                      <span>•</span>
                      <span style="color:${statusColor}; font-weight:500;">${statusText}</span>
                    </div>
                  </div>
                </div>
                ${actionBtn}
            `;
            container.appendChild(el);
        });
        addLoadMoreButton(container, 5);
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
        const tab = document.getElementById('tab-bookmarks');
        if (tab) tab.innerHTML = `<i class="fa-solid fa-bookmark" style="margin-right: 6px;"></i> Tài liệu đã lưu (${data.documents ? data.documents.length : 0})`;
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
            let iconColor = 'inherit';
            let loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';
            if (loaiFile === 'pdf') { icon = 'fa-file-pdf'; iconColor = '#DC2626'; }
            else if (loaiFile === 'pptx' || loaiFile === 'ppt') { icon = 'fa-file-powerpoint'; iconColor = '#EA580C'; }
            else if (loaiFile === 'docx' || loaiFile === 'doc') { icon = 'fa-file-word'; iconColor = '#2563EB'; }

            const dateStr = new Date(doc.NgayLuu).toLocaleDateString('vi-VN');

            el.innerHTML = `
                <div class="doc-info">
                  <div class="doc-icon"><i class="fa-solid ${icon}" style="color: ${iconColor};"></i></div>
                  <div>
                    <div class="doc-title">${doc.TenTL} ${doc.LaTaiLieuDocQuyen ? `<span style="margin-left: 8px; background: #FEF3C7; color: #B45309; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-crown" style="color: #F59E0B;"></i> PREMIUM</span>` : ''}</div>
                    <div class="doc-meta">
                      <span>Người đăng: ${doc.TenNguoiDang}</span>
                      <span>•</span>
                      <span>Môn: ${doc.TenMonHoc || 'Không xác định'}</span>
                      <span>•</span>
                      <span><i class="fa-solid fa-star" style="color:#F59E0B; margin-right:4px;"></i>${formatRatingSummary(doc.DiemDanhGia, doc.SoDanhGia)}</span>
                      <span>•</span>
                      <span style="color:var(--text-secondary);">Lưu ngày: ${dateStr}</span>
                    </div>
                  </div>
                </div>
                <a href="../document/documentDetails.html?id=${doc.MaTL}" class="btn-outline-primary"><i class="fa-solid fa-eye" style="margin-right: 6px;"></i> Xem chi tiết</a>
            `;
            container.appendChild(el);
        });
        addLoadMoreButton(container, 5);
    } catch (err) {
        console.error(err);
    }
}

async function fetchPurchasedDocuments() {
    try {
        const res = await fetch(`${API_URL}/users/purchased-documents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const tab = document.getElementById('tab-purchased');
        if (tab) tab.innerHTML = `<i class="fa-solid fa-crown" style="margin-right: 6px;"></i> Tài liệu PREMIUM (${data.documents ? data.documents.length : 0})`;
        const container = document.getElementById('purchased-container');
        container.innerHTML = '';
        
        if (!data.documents || data.documents.length === 0) {
            container.innerHTML = '<p>Bạn chưa mua tài liệu PREMIUM nào.</p>';
            return;
        }

        data.documents.forEach((doc, index) => {
            const el = document.createElement('div');
            el.className = 'doc-item';
            el.style.animationDelay = `${index * 0.04}s`;
            
            let icon = 'fa-file';
            let iconColor = 'inherit';
            let loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';
            if (loaiFile === 'pdf') { icon = 'fa-file-pdf'; iconColor = '#DC2626'; }
            else if (loaiFile === 'pptx' || loaiFile === 'ppt') { icon = 'fa-file-powerpoint'; iconColor = '#EA580C'; }
            else if (loaiFile === 'docx' || loaiFile === 'doc') { icon = 'fa-file-word'; iconColor = '#2563EB'; }

            const d = new Date(doc.NgayMua);
            const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
            const dateOnlyStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            const dateStr = `${timeStr} | ${dateOnlyStr}`;

            el.innerHTML = `
                <div class="doc-info">
                  <div class="doc-icon"><i class="fa-solid ${icon}" style="color: ${iconColor};"></i></div>
                  <div>
                    <div class="doc-title">${escapeHTML(doc.TenTL)} <span style="margin-left: 8px; background: #FEF3C7; color: #B45309; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-crown" style="color: #F59E0B; margin-right:4px"></i> ĐÃ MUA</span></div>
                    <div class="doc-meta">
                      <span>Chủ tài liệu: ${escapeHTML(doc.TenNguoiBan || 'Không xác định')}</span>
                      <span>•</span>
                      <span>Giá: <strong style="color: #D97706;">${doc.GiaXuThoiDiemMua} Xu</strong></span>
                      <span>•</span>
                      <span style="color:var(--text-secondary);">Ngày mua: ${dateStr}</span>
                    </div>
                  </div>
                </div>
                <a href="../document/documentDetails.html?id=${doc.MaTL}" class="btn-outline-primary"><i class="fa-solid fa-eye" style="margin-right: 6px;"></i> Xem chi tiết</a>
            `;
            container.appendChild(el);
        });
        addLoadMoreButton(container, 5);
    } catch (err) {
        console.error(err);
    }
}

async function fetchTransactions() {
    try {
        const res = await fetch(`${API_URL}/users/transactions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const tab = document.getElementById('tab-transactions');
        if (tab) tab.innerHTML = `<i class="fa-solid fa-coins" style="margin-right: 6px;"></i> Lịch sử giao dịch Xu (${data.transactions ? data.transactions.length : 0})`;
        const container = document.getElementById('transactions-container');
        container.innerHTML = '';
        
        if (!data.transactions || data.transactions.length === 0) {
            container.innerHTML = '<p>Bạn chưa có giao dịch nào.</p>';
            return;
        }

        data.transactions.forEach((txn, index) => {
            const el = document.createElement('div');
            el.className = 'doc-item';
            el.style.animationDelay = `${index * 0.04}s`;
            
            const isCong = txn.SoXuThayDoi > 0;
            const icon = isCong ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
            const iconColor = isCong ? 'var(--success)' : 'var(--danger)';
            const sign = isCong ? '+' : '';
            const amountColor = isCong ? 'var(--success)' : 'var(--danger)';
            const d = new Date(txn.NgayTao);
            const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
            const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

            el.innerHTML = `
                <div class="doc-info" style="flex:1;">
                  <div class="doc-icon"><i class="fa-solid ${icon}" style="color: ${iconColor};"></i></div>
                  <div>
                    <div class="doc-title" style="margin-bottom: 5px;">${escapeHTML(txn.MoTa)}</div>
                    <div class="doc-meta">
                      <span style="color:${amountColor}; font-weight:600; font-size: 15px;">${sign}${txn.SoXuThayDoi} Xu</span>
                      <span>•</span>
                      <span style="color:var(--text-secondary);"><i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${timeStr} | ${dateStr}</span>
                    </div>
                  </div>
                </div>
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
        const tab = document.getElementById('tab-my-reports');
        if (tab) tab.innerHTML = `<i class="fa-solid fa-flag" style="margin-right: 6px;"></i> Báo cáo vi phạm (${data.reports ? data.reports.length : 0})`;
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
    const tabPurchased = document.getElementById('tab-purchased');
    const tabTransactions = document.getElementById('tab-transactions');
    const tabMyReports = document.getElementById('tab-my-reports');
    
    const containerMyDocs = document.getElementById('my-docs-container');
    const containerBookmarks = document.getElementById('bookmarks-container');
    const containerPurchased = document.getElementById('purchased-container');
    const containerTransactions = document.getElementById('transactions-container');
    const containerMyReports = document.getElementById('my-reports-container');

    function resetTabs() {
        tabMyDocs.classList.remove('active');
        tabBookmarks.classList.remove('active');
        tabPurchased.classList.remove('active');
        tabTransactions.classList.remove('active');
        tabMyReports.classList.remove('active');
        
        containerMyDocs.style.display = 'none';
        containerBookmarks.style.display = 'none';
        containerPurchased.style.display = 'none';
        containerTransactions.style.display = 'none';
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
        fetchBookmarks();
    });
    
    tabPurchased.addEventListener('click', () => {
        resetTabs();
        tabPurchased.classList.add('active');
        containerPurchased.style.display = 'flex';
        containerPurchased.style.flexDirection = 'column';
        containerPurchased.style.gap = '15px';
        fetchPurchasedDocuments();
    });
    
    tabTransactions.addEventListener('click', () => {
        resetTabs();
        tabTransactions.classList.add('active');
        containerTransactions.style.display = 'flex';
        containerTransactions.style.flexDirection = 'column';
        containerTransactions.style.gap = '15px';
        fetchTransactions();
    });
    
    tabMyReports.addEventListener('click', () => {
        resetTabs();
        tabMyReports.classList.add('active');
        containerMyReports.style.display = 'flex';
        containerMyReports.style.flexDirection = 'column';
        containerMyReports.style.gap = '15px';
        fetchMyReports();
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

                const d = new Date(tb.NgayTao);
                const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
                const dateOnlyStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

                item.innerHTML = `
                    <div style="font-size: 14px; margin-bottom: 4px;">${tb.NoiDung}</div>
                    <div style="font-size: 12px; color: #6B7280;">
                        <i class="fa-regular fa-clock" style="margin-right:2px;"></i>${timeStr} 
                        <span style="margin: 0 4px; color: #D1D5DB;">|</span> 
                        <i class="fa-regular fa-calendar" style="margin-right:2px;"></i>${dateOnlyStr}
                    </div>
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
    const otp = document.getElementById('input-change-pw-otp').value;
    const btn = document.getElementById('btn-change-pw');
    
    const isLocal = !currentProfile || currentProfile.AuthType === 'Local';
    const oldPwValid = isLocal ? matKhauCu.trim().length > 0 : true;

    if (oldPwValid && matKhauMoi.trim() && confirm.trim() && otp.trim() && matKhauMoi === confirm) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }
}

function checkDeleteAccountPassword() {
    const inputPw = document.getElementById('input-delete-pw');
    const inputOtp = document.getElementById('input-delete-otp');
    const btnConfirm = document.getElementById('btn-confirm-delete');
    
    if (inputPw && inputOtp && btnConfirm) {
        const matKhau = inputPw.value.trim();
        const otp = inputOtp.value.trim();
        
        const isLocal = !currentProfile || currentProfile.AuthType === 'Local';
        const pwValid = isLocal ? matKhau.length >= 6 : true;
        
        if (pwValid && otp.length === 6) {
            btnConfirm.disabled = false;
            btnConfirm.style.opacity = '1';
            btnConfirm.style.cursor = 'pointer';
        } else {
            btnConfirm.disabled = true;
            btnConfirm.style.opacity = '0.5';
            btnConfirm.style.cursor = 'not-allowed';
        }
    }
}

function setupEventListeners() {
    document.getElementById('btn-save-profile').addEventListener('click', saveProfile);
    const btnDeleteAccount = document.getElementById('btn-delete-account');
    if (btnDeleteAccount) btnDeleteAccount.addEventListener('click', openDeleteAccountModal);
    
    const btnCancelDelete = document.getElementById('btn-cancel-delete');
    if (btnCancelDelete) btnCancelDelete.addEventListener('click', closeDeleteAccountModal);
    
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');
    if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', processDeleteAccount);
    
    const inputDeletePw = document.getElementById('input-delete-pw');
    if (inputDeletePw) inputDeletePw.addEventListener('input', checkDeleteAccountPassword);

    const inputDeleteOtp = document.getElementById('input-delete-otp');
    if (inputDeleteOtp) inputDeleteOtp.addEventListener('input', checkDeleteAccountPassword);
    
    const btnSendDeleteOtp = document.getElementById('btn-send-delete-otp');
    if (btnSendDeleteOtp) btnSendDeleteOtp.addEventListener('click', sendDeleteAccountOtp);
    
    const modalOverlay = document.getElementById('delete-account-modal');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeDeleteAccountModal();
        });
    }
    
    const btnChangePw = document.getElementById('btn-change-pw');
    btnChangePw.addEventListener('click', changePassword);
    
    const btnSendPwOtp = document.getElementById('btn-send-pw-otp');
    if (btnSendPwOtp) btnSendPwOtp.addEventListener('click', sendChangePasswordOtp);
    
    document.getElementById('input-change-pw-otp')?.addEventListener('input', checkPasswordChanges);
    
    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            this.classList.toggle('fa-eye-slash');
            this.classList.toggle('fa-eye');
        });
    });

    const btnSubmitAppeal = document.getElementById('btn-submit-appeal');
    const inputRejectAppeal = document.getElementById('input-reject-appeal');

    if (inputRejectAppeal && btnSubmitAppeal) {
        inputRejectAppeal.addEventListener('input', function() {
            if (this.value.trim().length > 0) {
                btnSubmitAppeal.disabled = false;
                btnSubmitAppeal.style.opacity = '1';
                btnSubmitAppeal.style.cursor = 'pointer';
            } else {
                btnSubmitAppeal.disabled = true;
                btnSubmitAppeal.style.opacity = '0.5';
                btnSubmitAppeal.style.cursor = 'not-allowed';
            }
        });
    }

    if (btnSubmitAppeal) {
        btnSubmitAppeal.addEventListener('click', async function() {
            const phanHoi = document.getElementById('input-reject-appeal').value;
            if (!phanHoi || phanHoi.trim() === '') {
                Toast.fire({ icon: 'warning', title: 'Vui lòng nhập nội dung phản hồi.' });
                return;
            }

            if (!currentAppealDocId) return;

            const btn = this;
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';
            btn.disabled = true;

            try {
                const res = await fetch(`${API_URL}/documents/${currentAppealDocId}/appeal`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ phanHoi })
                });

                const data = await res.json();
                if (res.ok) {
                    Toast.fire({ icon: 'success', title: data.message });
                    window.closeRejectReasonModal();
                    fetchMyDocuments(); 
                } else {
                    Toast.fire({ icon: 'error', title: data.message || 'Lỗi khi gửi phản hồi.' });
                }
            } catch (error) {
                console.error(error);
                Toast.fire({ icon: 'error', title: 'Lỗi kết nối máy chủ.' });
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    checkPasswordChanges();
    ['input-old-pw', 'input-new-pw', 'input-confirm-pw'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', checkPasswordChanges);
    });
    
    ['input-hoten', 'input-tuoi', 'input-gioitinh', 'input-diachi', 'input-truonghoc', 'input-khoanganh'].forEach(id => {
        document.getElementById(id).addEventListener('input', checkProfileChanges);
        document.getElementById(id).addEventListener('change', checkProfileChanges);
    });
    
    ['input-privacy-downloads', 'input-privacy-ratings'].forEach(id => {
        document.getElementById(id).addEventListener('change', checkProfileChanges);
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
    const btnDeleteAvatar = document.getElementById('btn-delete-avatar');
    const inputAvatar = document.getElementById('input-avatar');
    if (btnDeleteAvatar) btnDeleteAvatar.addEventListener('click', deleteAvatar);
    let cropper = null;
    const cropModal = document.getElementById('crop-modal');
    const imageToCrop = document.getElementById('image-to-crop');
    const btnCancelCrop = document.getElementById('btn-cancel-crop');
    const btnSaveCrop = document.getElementById('btn-save-crop');

    if (btnEditAvatar && inputAvatar) {
        btnEditAvatar.addEventListener('click', () => {
            inputAvatar.value = '';
            inputAvatar.click();
        });

        inputAvatar.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                imageToCrop.src = event.target.result;
                if (cropModal) cropModal.style.display = 'flex';

                if (cropper) cropper.destroy();
                cropper = new Cropper(imageToCrop, {
                    aspectRatio: 1,
                    viewMode: 1,
                    autoCropArea: 1,
                });
            };
            reader.readAsDataURL(file);
        });

        if (btnCancelCrop) {
            btnCancelCrop.addEventListener('click', () => {
                if (cropModal) cropModal.style.display = 'none';
                if (cropper) { cropper.destroy(); cropper = null; }
                inputAvatar.value = '';
            });
        }

        if (btnSaveCrop) {
            btnSaveCrop.addEventListener('click', () => {
                if (!cropper) return;

                const canvas = cropper.getCroppedCanvas({
                    width: 400,
                    height: 400,
                });

                canvas.toBlob(async (blob) => {
                    const formData = new FormData();
                    formData.append('avatar', blob, 'avatar.png');

                    try {
                        if (cropModal) cropModal.style.display = 'none';
                        Swal.fire({
                            title: 'Đang tải ảnh lên...',
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
                        if (cropper) { cropper.destroy(); cropper = null; }
                        inputAvatar.value = '';
                    }
                }, 'image/png');
            });
        }
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

async function sendChangePasswordOtp() {
    const matKhauCu = document.getElementById('input-old-pw').value;
    if (!matKhauCu.trim()) {
        return Toast.fire({ icon: 'warning', title: 'Vui lòng nhập mật khẩu hiện tại trước khi lấy mã OTP.' });
    }

    const btn = document.getElementById('btn-send-pw-otp');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';
    btn.disabled = true;
    
    try {
        const res = await fetch(`${API_URL}/users/send-change-password-otp`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ matKhauCu })
        });
        
        const data = await res.json();
        if (res.ok) {
            Toast.fire({ icon: 'success', title: data.message });
            
            let timeLeft = 60;
            const timerId = setInterval(() => {
                if (timeLeft <= 0) {
                    clearInterval(timerId);
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                } else {
                    btn.innerHTML = `<i class="fa-solid fa-paper-plane" style="margin-right: 6px;"></i> Gửi lại sau ${timeLeft}s`;
                    timeLeft--;
                }
            }, 1000);
        } else {
            Toast.fire({ icon: 'error', title: data.message || 'Lỗi gửi OTP.' });
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        Toast.fire({ icon: 'error', title: 'Lỗi kết nối máy chủ.' });
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function addLoadMoreButton(container, step = 5) {
    let visibleCount = step;
    const items = container.querySelectorAll('.doc-item');
    if (items.length <= visibleCount) return;
    
    items.forEach((item, idx) => {
        if (idx >= visibleCount) item.style.display = 'none';
    });

    const btnWrapper = document.createElement('div');
    btnWrapper.style.textAlign = 'center';
    btnWrapper.style.marginTop = '15px';
    btnWrapper.style.width = '100%';
    btnWrapper.className = 'load-more-wrapper';
    
    const btn = document.createElement('button');
    btn.className = 'btn-outline-primary btn-load-more';
    btn.innerHTML = '<i class="fa-solid fa-angle-down" style="margin-right: 6px;"></i> Tải thêm';
    btn.style.padding = '8px 24px';
    btn.style.borderRadius = '20px';
    btn.style.fontWeight = '500';
    btn.style.transition = 'all 0.3s ease';
    
    btn.onclick = () => {
        const nextVisible = visibleCount + step;
        for (let i = visibleCount; i < nextVisible && i < items.length; i++) {
            items[i].style.display = '';
        }
        visibleCount = nextVisible;
        if (visibleCount >= items.length) {
            btnWrapper.style.display = 'none';
        }
    };
    
    btnWrapper.appendChild(btn);
    container.appendChild(btnWrapper);
}

const upgradeHeader = document.getElementById('upgrade-teacher-header');
if (upgradeHeader) {
    upgradeHeader.addEventListener('click', () => {
        const content = document.getElementById('upgrade-teacher-content');
        const textSpan = upgradeHeader.querySelector('.toggle-text');
        const isExpanded = content.classList.contains('expanded');
        
        if (isExpanded) {
            content.classList.remove('expanded');
            upgradeHeader.classList.remove('expanded');
            textSpan.textContent = 'Mở rộng';
        } else {
            content.classList.add('expanded');
            upgradeHeader.classList.add('expanded');
            textSpan.textContent = 'Thu gọn';
        }
    });
}
const fileInput = document.getElementById('input-upgrade-proof');
const btnSubmitUpgrade = document.getElementById('btn-submit-upgrade');
const uploadZone = document.getElementById('proof-upload-zone');
const previewZone = document.getElementById('proof-preview-zone');
const previewImg = document.getElementById('proof-preview-img');
const btnRemoveProof = document.getElementById('btn-remove-proof');

if (fileInput && btnSubmitUpgrade) {
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                Toast.fire({ icon: 'warning', title: 'Vui lòng chọn file hình ảnh hợp lệ.' });
                fileInput.value = '';
                resetPreview();
                return;
            }
            if (file.size > 5 * 1024 * 1024) { 
                Toast.fire({ icon: 'warning', title: 'Dung lượng ảnh không được vượt quá 5MB.' });
                fileInput.value = '';
                resetPreview();
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImg.src = e.target.result;
                if (uploadZone) uploadZone.style.display = 'none';
                if (previewZone) previewZone.style.display = 'block';
                
                btnSubmitUpgrade.disabled = false;
                btnSubmitUpgrade.style.opacity = '1';
                btnSubmitUpgrade.style.cursor = 'pointer';
            }
            reader.readAsDataURL(file);
        } else {
            resetPreview();
        }
    });

    if (btnRemoveProof) {
        btnRemoveProof.addEventListener('click', () => {
            fileInput.value = '';
            resetPreview();
        });
    }
    
    function resetPreview() {
        if (uploadZone) uploadZone.style.display = 'block';
        if (previewZone) previewZone.style.display = 'none';
        if (previewImg) previewImg.src = '';
        btnSubmitUpgrade.disabled = true;
        btnSubmitUpgrade.style.opacity = '0.5';
        btnSubmitUpgrade.style.cursor = 'not-allowed';
    }
}

if (btnSubmitUpgrade) {
    btnSubmitUpgrade.addEventListener('click', async () => {
        const fileInput = document.getElementById('input-upgrade-proof');
        const file = fileInput.files[0];
        if (!file) {
            return Toast.fire({ icon: 'warning', title: 'Vui lòng chọn ảnh minh chứng.' });
        }

        const originalText = btnSubmitUpgrade.innerHTML;
        btnSubmitUpgrade.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Đang tải ảnh lên...';
        btnSubmitUpgrade.disabled = true;

        try {
            const formData = new FormData();
            formData.append('image', file);

            const uploadRes = await fetch(`${API_URL}/users/upload-image`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) {
                throw new Error(uploadData.message || 'Lỗi tải ảnh.');
            }

            btnSubmitUpgrade.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Đang gửi yêu cầu...';

            const submitRes = await fetch(`${API_URL}/users/upgrade-teacher`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ minhChungURL: uploadData.url })
            });

            const submitData = await submitRes.json();
            if (!submitRes.ok) {
                throw new Error(submitData.message || 'Lỗi gửi yêu cầu.');
            }

            Toast.fire({ icon: 'success', title: submitData.message });
            fileInput.value = '';
            initUpgradeTeacher();
        } catch (err) {
            console.error(err);
            Toast.fire({ icon: 'error', title: err.message });
        } finally {
            btnSubmitUpgrade.innerHTML = originalText;
            btnSubmitUpgrade.disabled = false;
        }
    });
}
