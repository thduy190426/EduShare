
import { API_URL } from '../shared/config.js';
import { decodeJWT, getAvatar, getAssetUrl, getToken } from '../shared/utils.js';
import '../shared/chatWidget.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadUserProfileNav();
    const questsList = document.getElementById('questsList');
    let hasRemindedQuests = false;

    async function loadQuests() {
        try {
            const res = await fetch(`${API_URL}/quests`, { method: 'GET' });
            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();
            if (data && data.quests) {
                renderQuests(data.quests);
            }
        } catch (error) {
            questsList.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 20px; grid-column: 1 / -1;">Lỗi tải dữ liệu nhiệm vụ. Vui lòng thử lại sau.</div>`;
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
            questsList.innerHTML = `<div style="text-align: center; color: #6b7280; padding: 20px; grid-column: 1 / -1;">Hiện tại chưa có nhiệm vụ nào.</div>`;
            return;
        }

        questsList.innerHTML = '';
        let claimableCount = 0;
        quests.forEach(q => {
            const progressPercent = Math.min((q.TienDo / q.MucTieu) * 100, 100);
            const isCompleted = q.TienDo >= q.MucTieu;
            const isClaimed = q.TrangThai === 'DaNhan';
            const isClaimable = q.TrangThai === 'ChoNhan';
            if (isClaimable) claimableCount++;

            let actionHtml = '';
            if (isClaimed) {
                actionHtml = `<span class="status-badge status-done"><i class="fa-solid fa-check"></i> Đã nhận</span>`;
            } else {
                actionHtml = `<button class="btn-claim" data-id="${q.MaNV}" ${isClaimable ? '' : 'disabled'}>
                                ${isClaimable ? 'Nhận thưởng' : 'Chưa đạt'}
                              </button>`;
            }

            const card = document.createElement('div');
            card.className = `quest-card ${isClaimed ? 'claimed' : ''}`;
            card.innerHTML = `
                <div class="quest-header-row">
                    <div class="quest-icon-wrapper">
                        ${getIconForType(q.LoaiNV)}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <span class="quest-badge ${q.TanSuat === 'HangNgay' ? 'daily' : 'weekly'}">${q.TanSuat === 'HangNgay' ? 'Hàng ngày' : 'Hàng tuần'}</span>
                        <span class="quest-badge" style="background: ${q.ThuongXu <= 20 ? '#ecfdf5' : q.ThuongXu <= 50 ? '#fffbeb' : '#fef2f2'}; color: ${q.ThuongXu <= 20 ? '#059669' : q.ThuongXu <= 50 ? '#d97706' : '#dc2626'};">${q.ThuongXu <= 20 ? 'Dễ' : q.ThuongXu <= 50 ? 'Trung bình' : 'Khó'}</span>
                    </div>
                </div>
                
                <div class="quest-main-info">
                    <div class="quest-text-content">
                        <h3 class="quest-name">${q.TenNV}</h3>
                        <p class="quest-desc">${q.MoTa}</p>
                    </div>
                </div>
                
                <div class="quest-reward">
                    <i class="fa-solid fa-coins"></i> +${q.ThuongXu} EduCoin
                </div>
                
                <div class="quest-footer">
                    <div class="quest-progress-wrap">
                        <div class="progress-info">
                            <span class="progress-text">Tiến độ</span>
                            <span class="progress-numbers">${q.TienDo} / ${q.MucTieu}</span>
                        </div>
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${progressPercent}%;"></div>
                        </div>
                    </div>
                    
                    <div class="quest-action-wrap">
                        ${actionHtml}
                    </div>
                </div>
            `;
            questsList.appendChild(card);
        });

        document.querySelectorAll('.btn-claim').forEach(btn => {
            btn.addEventListener('click', handleClaim);
        });

        if (claimableCount > 0 && !hasRemindedQuests) {
            hasRemindedQuests = true;
        }
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
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const playBeep = (freq, time) => {
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.frequency.value = freq;
                        gain.gain.setValueAtTime(0.1, ctx.currentTime + time);
                        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 0.1);
                        osc.start(ctx.currentTime + time);
                        osc.stop(ctx.currentTime + time + 0.1);
                    };
                    playBeep(880, 0);
                    playBeep(1320, 0.15);
                } catch(e) {
                    console.error('Audio notification failed', e);
                }
                
                const parent = btn.closest('.quest-action-wrap');
                parent.innerHTML = `<span class="status-badge status-done"><i class="fa-solid fa-check"></i> Đã nhận</span>`;
                
                const card = parent.closest('.quest-card');
                card.classList.add('claimed');
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

