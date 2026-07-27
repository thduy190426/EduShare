import { API_URL } from '../shared/config.js';
import { decodeJWT, getAssetUrl, getToken, getAvatar } from '../shared/utils.js';

let currentPage = 1;
const LIMIT = 20;

document.addEventListener('DOMContentLoaded', () => {
    loadUserProfileNav();
    fetchNotifications(currentPage);

    const btnMarkAll = document.getElementById('btn-mark-all-read');
    if (btnMarkAll) {
        btnMarkAll.addEventListener('click', markAllAsRead);
    }

    const btnDeleteAll = document.getElementById('btn-delete-all-notifications');
    if (btnDeleteAll) {
        btnDeleteAll.addEventListener('click', deleteAllNotifications);
    }

    const btnLoadMore = document.getElementById('btn-load-more');
    if (btnLoadMore) {
        btnLoadMore.addEventListener('click', () => {
            currentPage++;
            btnLoadMore.textContent = 'Đang tải...';
            btnLoadMore.disabled = true;
            fetchNotifications(currentPage);
        });
    }
});

function loadUserProfileNav() {
    const token = getToken();
    if (!token) {
        window.location.href = '../auth/login.html';
        return;
    }
    try {
        const payload = decodeJWT(token);
        if (!payload) return;
        const avatarEl = document.querySelector('.navbar .user-profile .avatar');
        
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

async function fetchNotifications(page = 1) {
    const token = getToken();
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/notifications?page=${page}&limit=${LIMIT}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Lỗi tải thông báo');
        }

        renderNotifications(data.notifications, page, data.hasMore);
    } catch (error) {
        console.error(error);
        const list = document.getElementById('notificationList');
        if (list) {
            list.innerHTML = '<div style="text-align:center; padding:2rem;">Không thể tải thông báo lúc này.</div>';
        }
    }
}

function renderNotifications(notifications, page = 1, hasMore = false) {
    const list = document.getElementById('notificationList');
    if (!list) return;

    if (page === 1) {
        list.innerHTML = '';
    }

    const pageActions = document.querySelector('.page-actions');
    
    if (page === 1 && notifications.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:2rem; color:#6b7280;">Bạn không có thông báo nào.</div>';
        if (pageActions) pageActions.style.display = 'none';
        return;
    }
    
    if (pageActions) pageActions.style.display = 'flex';

    notifications.forEach(noti => {
        const item = document.createElement('div');
        item.className = `notification-item ${noti.DaDoc ? '' : 'unread'}`;
        
        let iconClass = 'fa-bell';
        let typeClass = 'system';
        
        if (noti.LoaiTB === 'TaiLieu') {
            iconClass = 'fa-file-pdf';
            typeClass = 'document';
        } else if (noti.LoaiTB === 'BinhLuan') {
            iconClass = 'fa-comment';
            typeClass = 'comment';
        } else if (noti.LoaiTB === 'CanhBao') {
            iconClass = 'fa-triangle-exclamation';
            typeClass = 'warning';
        }
        const d = new Date(noti.NgayTao);
        const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
        const dateOnlyStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        const dateStr = `<i class="fa-regular fa-clock" style="margin-right:4px;"></i>${timeStr} <span style="margin: 0 4px; color: #D1D5DB;">|</span> <i class="fa-regular fa-calendar" style="margin-right:4px;"></i>${dateOnlyStr}`;
        item.innerHTML = `
            <div class="noti-icon ${typeClass}"><i class="fa-solid ${iconClass}"></i></div>
            <div class="noti-content">
                <div class="noti-text">${noti.NoiDung}</div>
                <div class="noti-time">${dateStr}</div>
            </div>
            <button class="noti-delete-btn" type="button" aria-label="Xoá thông báo" title="Xoá thông báo" data-id="${noti.MaTB}">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;

        if (!noti.DaDoc || noti.LinkDich) {
            item.style.cursor = 'pointer';
            item.onclick = async () => {
                if (!noti.DaDoc) {
                    await markAsRead(noti.MaTB);
                    item.classList.remove('unread');
                    noti.DaDoc = true;
                }

                if (noti.LinkDich) {
                    window.location.href = new URL(noti.LinkDich, window.location.href).href;
                    return;
                }

                item.onclick = null;
                item.style.cursor = 'default';
            };
        }

        const deleteBtn = item.querySelector('.noti-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await deleteNotification(noti.MaTB, item);
            });
        }

        list.appendChild(item);
    });

    const btnLoadMore = document.getElementById('btn-load-more');
    if (btnLoadMore) {
        btnLoadMore.style.display = hasMore ? 'inline-block' : 'none';
        btnLoadMore.textContent = 'Xem thêm thông báo';
        btnLoadMore.disabled = false;
    }
}

async function markAsRead(maTB) {
    const token = getToken();
    if (!token) return;

    try {
        await fetch(`${API_URL}/notifications/${maTB}/read`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (error) {
        console.error('Lỗi khi đánh dấu đọc:', error);
    }
}

async function deleteNotification(maTB, itemEl) {
    const token = getToken();
    if (!token) return;

    const result = await Swal.fire({
        title: 'Xoá thông báo?',
        text: 'Thông báo này sẽ bị xóa khỏi danh sách của bạn.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#EF4444'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/notifications/${maTB}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.message || 'Không thể xóa thông báo');
        }

        itemEl.remove();
        const list = document.getElementById('notificationList');
        if (list && !list.querySelector('.notification-item')) {
            list.innerHTML = '<div style="text-align:center; padding:2rem; color:#6b7280;">Bạn không có thông báo nào.</div>';
            const pageActions = document.querySelector('.page-actions');
            if (pageActions) pageActions.style.display = 'none';
            
            const btnLoadMore = document.getElementById('btn-load-more');
            if (btnLoadMore) btnLoadMore.style.display = 'none';
        }

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Đã xóa thông báo',
            showConfirmButton: false,
            timer: 1500
        });
    } catch (error) {
        console.error('Lỗi khi xóa thông báo:', error);
        Swal.fire('Lỗi', 'Không thể xóa thông báo.', 'error');
    }
}

async function deleteAllNotifications() {
    const token = getToken();
    if (!token) return;

    const hasNotifications = document.querySelector('.notification-item');
    if (!hasNotifications) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: 'Không có thông báo để xóa',
            showConfirmButton: false,
            timer: 1500
        });
        return;
    }

    const result = await Swal.fire({
        title: 'Xóa tất cả thông báo?',
        text: 'Toàn bộ thông báo trong danh sách của bạn sẽ bị xóa.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xóa tất cả',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#EF4444'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/notifications/all`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.message || 'Không thể xóa tất cả thông báo');
        }

        const list = document.getElementById('notificationList');
        if (list) {
            list.innerHTML = '<div style="text-align:center; padding:2rem; color:#6b7280;">Bạn không có thông báo nào.</div>';
        }
        const pageActions = document.querySelector('.page-actions');
        if (pageActions) pageActions.style.display = 'none';
        
        const btnLoadMore = document.getElementById('btn-load-more');
        if (btnLoadMore) btnLoadMore.style.display = 'none';

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Đã xóa tất cả thông báo',
            showConfirmButton: false,
            timer: 1500
        });
    } catch (error) {
        console.error('Lỗi khi xóa tất cả thông báo:', error);
        Swal.fire('Lỗi', 'Không thể xóa tất cả thông báo.', 'error');
    }
}

async function markAllAsRead() {
    const token = getToken();
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/notifications/read-all`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            
            const unreadItems = document.querySelectorAll('.notification-item.unread');
            unreadItems.forEach(item => {
                item.classList.remove('unread');
                item.onclick = null;
                item.style.cursor = 'default';
            });
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Đã đánh dấu tất cả là đã đọc',
                showConfirmButton: false,
                timer: 1500
            });
        }
    } catch (error) {
        console.error('Lỗi khi đánh dấu tất cả đã đọc:', error);
        Swal.fire('Lỗi', 'Không thể đánh dấu đã đọc.', 'error');
    }
}
