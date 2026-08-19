
import { API_URL } from '../shared/config.js';
import { decodeJWT, getAvatar, getAssetUrl, getToken } from '../shared/utils.js';
import '../shared/chatWidget.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadUserProfileNav();
    const questsList = document.getElementById('questsList');

    async function loadQuests() {
        try {
            const res = await fetch(`${API_URL}/quests`, { method: 'GET' });
            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();
            if (data && data.quests) {
                renderQuests(data.quests);
            }
        } catch (error) {
            questsList.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 20px;">Lỗi tải dữ liệu nhiệm vụ. Vui lòng thử lại sau.</div>`;
        }
    }

    function getIconForType(type) {
        switch(type) {
            case 'DangNhap': return '<i class="fa-solid fa-right-to-bracket" style="color: #3b82f6;"></i>';
            case 'DanhGia': return '<i class="fa-solid fa-star" style="color: #eab308;"></i>';
            case 'BinhLuanNhom': return '<i class="fa-solid fa-users" style="color: #10b981;"></i>';
            case 'CapNhatHoSo': return '<i class="fa-solid fa-user-pen" style="color: #f97316;"></i>';
            case 'MuaTaiLieu': return '<i class="fa-solid fa-cart-shopping" style="color: #ec4899;"></i>';
            case 'UpTaiLieu': return '<i class="fa-solid fa-cloud-arrow-up" style="color: #8b5cf6;"></i>';
            default: return '<i class="fa-solid fa-check-circle" style="color: #6b7280;"></i>';
        }
    }

    function renderQuests(quests) {
        if (quests.length === 0) {
            questsList.innerHTML = `<div style="text-align: center; color: #6b7280; padding: 20px;">Hiện tại chưa có nhiệm vụ nào.</div>`;
            return;
        }

        questsList.innerHTML = '';
        quests.forEach(q => {
            const progressPercent = Math.min((q.TienDo / q.MucTieu) * 100, 100);
            const isCompleted = q.TienDo >= q.MucTieu;
            const isClaimed = q.TrangThai === 'DaNhan';
            const isClaimable = q.TrangThai === 'ChoNhan';

            let actionHtml = '';
            if (isClaimed) {
                actionHtml = `<span class="status-badge status-done"><i class="fa-solid fa-check"></i> Đã nhận</span>`;
            } else {
                actionHtml = `<button class="btn-claim" data-id="${q.MaNV}" ${isClaimable ? '' : 'disabled'}>
                                ${isClaimable ? 'Nhận thưởng' : 'Chưa đạt'}
                              </button>`;
            }

            const card = document.createElement('div');
            card.className = 'quest-card';
            card.innerHTML = `
                <div class="quest-info">
                    <div class="quest-title">
                        ${getIconForType(q.LoaiNV)}
                        ${q.TenNV}
                        <span style="font-size: 0.75rem; font-weight: normal; background: #e5e7eb; padding: 2px 8px; border-radius: 10px; margin-left: 10px; color: #4b5563;">${q.TanSuat === 'HangNgay' ? 'Hàng ngày' : 'Hàng tuần'}</span>
                    </div>
                    <div class="quest-desc">${q.MoTa}</div>
                    <div class="quest-reward">
                        <i class="fa-solid fa-coins"></i> +${q.ThuongXu} EduCoin
                    </div>
                    
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${progressPercent}%; ${isClaimed ? 'background: #10b981;' : ''}"></div>
                    </div>
                    <div class="progress-text">${q.TienDo} / ${q.MucTieu} hoàn thành</div>
                </div>
                <div class="quest-action">
                    ${actionHtml}
                </div>
            `;
            questsList.appendChild(card);
        });

        document.querySelectorAll('.btn-claim').forEach(btn => {
            btn.addEventListener('click', handleClaim);
        });
    }

    async function handleClaim(e) {
        const btn = e.currentTarget;
        const maNV = btn.getAttribute('data-id');

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            
            const res = await fetch(`${API_URL}/quests/${maNV}/claim`, { method: 'POST' });
            const data = await res.json();
            
            if (res.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Nhận thưởng thành công',
                    text: `Bạn nhận được ${data.thuongXu} EduCoin.`,
                    confirmButtonColor: '#4f46e5'
                });
                
                const parent = btn.closest('.quest-action');
                parent.innerHTML = `<span class="status-badge status-done"><i class="fa-solid fa-check"></i> Đã nhận</span>`;
                
                const progressBar = parent.previousElementSibling.querySelector('.progress-bar');
                progressBar.style.background = '#10b981';
            } else {
                throw new Error(data.message || 'Có lỗi xảy ra, vui lòng thử lại!');
            }
        } catch (error) {
            btn.disabled = false;
            btn.innerHTML = 'Nhận thưởng';
            Swal.fire({
                icon: 'error',
                title: 'Lỗi',
                text: error.message || 'Có lỗi xảy ra, vui lòng thử lại!',
                confirmButtonColor: '#ef4444'
            });
        }
    }

    function loadUserProfileNav() {
        const token = getToken();
        if (!token) return;
        const decoded = decodeJWT(token);
        if (!decoded) return;
        document.getElementById('navUserName').textContent = decoded.HoTen || 'Người dùng';
        const roleText = decoded.VaiTro === 'SinhVien' ? 'Sinh Viên' : (decoded.VaiTro === 'GiaoVien' ? 'Giáo Viên' : 'Admin');
        document.getElementById('navUserRole').textContent = roleText;
        const navAvatar = document.getElementById('navAvatar');
        const avatarUrl = getAvatar();
        if (avatarUrl) {
            navAvatar.innerHTML = `<img src="${getAssetUrl(avatarUrl)}" alt="Avatar">`;
        } else {
            navAvatar.innerHTML = decoded.HoTen ? decoded.HoTen.charAt(0).toUpperCase() : 'U';
        }
    }

    loadQuests();
});
