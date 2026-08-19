import { API_URL } from './config.js';
import { decodeJWT, getAssetUrl, getToken, getRefreshToken, getAvatar, clearAuthSession, showToast, getTimeBasedGreeting } from './utils.js';
import { getSocket } from './socketClient.js';
import './chatWidget.js';
import { makeAdminTablesResizableAndSticky } from '../admin/adminTableUtils.js';

const SIDEBAR_ITEMS = [
    { label: 'Trang chủ', icon: 'fa-house', href: '../user/userHome.html', roles: ['SinhVien', 'GiaoVien'], group: 'user' },
    { label: 'Tìm kiếm tài liệu', icon: 'fa-magnifying-glass', href: '../document/searchResults.html', roles: ['SinhVien', 'GiaoVien'], group: 'user' },
    { label: 'Tải tài liệu', icon: 'fa-upload', href: '../document/uploadDocument.html', roles: ['SinhVien', 'GiaoVien'], group: 'user' },
    { label: 'Tài liệu của tôi', icon: 'fa-folder-open', href: '../document/myDocuments.html', roles: ['SinhVien', 'GiaoVien'], group: 'user' },
    { label: 'Nhóm học tập', icon: 'fa-users', href: '../group/groupList.html', roles: ['SinhVien', 'GiaoVien'], group: 'user' },
    { label: 'Nhiệm vụ hàng ngày', icon: 'fa-gift', href: '../user/quests.html', roles: ['SinhVien', 'GiaoVien'], group: 'user' },
    { label: 'Nạp EduCoin', icon: 'fa-coins', href: '../user/buyCoins.html', roles: ['SinhVien'], group: 'user' },
    { label: 'Lịch sử giao dịch', icon: 'fa-clock-rotate-left', href: '../user/transactionHistory.html', roles: ['SinhVien'], group: 'user' },
    { label: 'Hồ sơ của tôi', icon: 'fa-user', href: '../user/userProfile.html', roles: ['SinhVien', 'GiaoVien'], group: 'user' },
    { label: 'Tổng quan', icon: 'fa-chart-column', href: '../admin/adminDashboard.html', roles: ['Admin'], group: 'admin' },
    { label: 'Kiểm duyệt', icon: 'fa-shield-halved', href: '../admin/adminModeration.html', roles: ['Admin', 'GiaoVien'], badge: 'pendingDocs', group: 'admin' },
    { label: 'Quản lý nạp xu', icon: 'fa-money-bill-transfer', href: '../admin/adminPayments.html', roles: ['Admin'], badge: 'pendingPayments', group: 'admin' },
    { label: 'Duyệt giáo viên', icon: 'fa-id-card-clip', href: '../admin/adminTeacherRequests.html', roles: ['Admin'], badge: 'pendingTeachers', group: 'admin' },
    { label: 'Người dùng', icon: 'fa-users-gear', href: '../admin/adminUserManagement.html', roles: ['Admin'], group: 'admin' },
    { label: 'Môn học', icon: 'fa-book', href: '../admin/adminSubjects.html', roles: ['Admin'], badge: 'pendingSubjects', group: 'admin' },
    { label: 'Quản lý nhóm', icon: 'fa-users-rectangle', href: '../admin/adminGroups.html', roles: ['Admin'], group: 'admin' },
    { label: 'Báo cáo', icon: 'fa-flag', href: '../admin/adminViolationReports.html', roles: ['Admin'], badge: 'pendingReports', group: 'admin' },
    { label: 'Mã ưu đãi', icon: 'fa-ticket', href: '../admin/adminPromos.html', roles: ['Admin'], group: 'admin' },
    { label: 'Gói nạp', icon: 'fa-box-open', href: '../admin/adminPackages.html', roles: ['Admin'], group: 'admin' },
    { label: 'Nhật ký (Logs)', icon: 'fa-clipboard-list', href: '../admin/adminAuditLogs.html', roles: ['Admin'], group: 'admin' },
    { label: 'Cấu hình hệ thống', icon: 'fa-gear', href: '../admin/adminSettings.html', roles: ['Admin'], group: 'admin' }
];

async function renderSidebar() {
    const sidebarEl = document.getElementById('app-sidebar');
    if (!sidebarEl) return;

    const token = getToken();
    if (!token) {
        window.location.href = '../guest/guestHome.html';
        return;
    }

    const decoded = decodeJWT(token);
    if (!decoded || !decoded.VaiTro) {
        window.location.href = '../auth/login.html';
        return;
    }

    const userRole = decoded.VaiTro;
    const currentPath = window.location.pathname;

    let html = ``;
    const userItems = SIDEBAR_ITEMS.filter(item => item.group === 'user' && item.roles.includes(userRole));
    const adminItems = SIDEBAR_ITEMS.filter(item => item.group === 'admin' && item.roles.includes(userRole));

    if (userItems.length > 0) {
        html += `<div class="menu-group">`;
        if (adminItems.length > 0) html += `<div class="menu-label">Học tập</div>`;
        userItems.forEach(item => {
            const isActive = currentPath.includes(item.href.split('/').pop()) ? 'active' : '';
            html += `
                <a href="${item.href}" class="menu-item ${isActive}">
                    <span class="menu-icon"><i class="fa-solid ${item.icon}"></i></span>
                    <span class="menu-text">${item.label}</span>
                </a>
            `;
        });
        html += `</div>`;
    }

    if (adminItems.length > 0) {
        html += `<div class="menu-group">
            <div class="menu-label">Quản trị</div>`;
        adminItems.forEach(item => {
            const isActive = currentPath.includes(item.href.split('/').pop()) ? 'active' : '';
            const badgeId = item.badge ? `id="badge-${item.badge}"` : '';
            const badgeHtml = item.badge ? `<span class="badge" ${badgeId} style="display:none;">0</span>` : '';
            html += `
                <a href="${item.href}" class="menu-item ${isActive}">
                    <span class="menu-icon"><i class="fa-solid ${item.icon}"></i></span>
                    <span class="menu-text">${item.label}</span>
                    ${badgeHtml}
                </a>
            `;
        });
        html += `</div>`;
    }

    const isInitiallyCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    const toggleIconClass = isInitiallyCollapsed ? 'fa-arrow-right' : 'fa-arrow-left';

    html += `
        <div class="menu-group hide-on-tablet-mobile" style="margin-top: auto; padding-top: 24px; border-top: 1px solid var(--border); margin-bottom: 0;">
            <div class="sidebar-toggle" id="btn-toggle-sidebar">
                <i class="fa-solid ${toggleIconClass}" id="icon-toggle-sidebar" style="font-size: 14px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid var(--border); background-color: var(--white); color: var(--text-secondary); box-shadow: 0 1px 4px rgba(0,0,0,0.05); transition: all 0.2s ease;"></i>
            </div>
            <a href="#" id="btn-logout-sidebar" class="menu-item" style="color: var(--danger);">
                <span class="menu-icon"><i class="fa-solid fa-right-from-bracket"></i></span>
                <span class="menu-text">Đăng xuất</span>
            </a>
        </div>
    `;

    sidebarEl.innerHTML = html;
    window.setTimeout(() => {
        document.documentElement.classList.add('sidebar-animated');
    }, 120);

    setupSidebarNavigation(sidebarEl);

    const btnLogout = document.getElementById('btn-logout-sidebar');
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                if (typeof Swal !== 'undefined') {
                    const logoutGreeting = getTimeBasedGreeting('logout');
                    Swal.fire({
                        title: 'Đang đăng xuất...',
                        text: logoutGreeting,
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        showConfirmButton: false,
                        didOpen: () => {
                            Swal.showLoading();
                        }
                    });
                } else {
                    document.body.style.pointerEvents = 'none';
                    document.body.style.opacity = '0.5';
                }

                const currentRefreshToken = getRefreshToken();
                if (currentRefreshToken) {
                    await fetch('http://localhost:3000/api/logout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refreshToken: currentRefreshToken })
                    });
                }

                clearAuthSession();
                setTimeout(() => {
                    window.location.href = '../auth/login.html';
                }, 1000);
            } catch (error) {
                console.error(error);
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Lỗi',
                        text: 'Đăng xuất thất bại'
                    });
                } else {
                    document.body.style.pointerEvents = 'auto';
                    document.body.style.opacity = '1';
                    showToast('error', 'Đăng xuất thất bại');
                }
            }
        });
    }

    const btnToggle = document.getElementById('btn-toggle-sidebar');
    if (btnToggle) {
        if (localStorage.getItem('sidebar-collapsed') === 'true') {
            document.documentElement.classList.add('sidebar-collapsed');
        }
        btnToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('sidebar-collapsed');
            const isCollapsed = document.documentElement.classList.contains('sidebar-collapsed');
            localStorage.setItem('sidebar-collapsed', isCollapsed);

            const iconEl = document.getElementById('icon-toggle-sidebar');
            if (iconEl) {
                if (isCollapsed) {
                    iconEl.classList.remove('fa-arrow-left', 'fa-bars');
                    iconEl.classList.add('fa-arrow-right');
                } else {
                    iconEl.classList.remove('fa-arrow-right', 'fa-bars');
                    iconEl.classList.add('fa-arrow-left');
                }
            }
        });
    }
    await refreshSidebarBadges();

    try {
        const res = await fetch(`${API_URL}/notifications/unread-count`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            const navBadge = document.getElementById('navNotificationBadge');
            const notificationBtn = document.getElementById('navNotifications');
            if (navBadge) {
                if (Number(data.count || 0) > 0) {
                    navBadge.textContent = data.count > 99 ? '99+' : data.count;
                    navBadge.style.display = 'flex';
                    if (notificationBtn) notificationBtn.classList.add('has-unread');
                } else {
                    navBadge.textContent = '0';
                    navBadge.style.display = 'none';
                    if (notificationBtn) notificationBtn.classList.remove('has-unread');
                }
            }
        }
    } catch (e) {
        console.error('Lỗi load unread count:', e);
    }
}

function setupSidebarNavigation(sidebarEl) {
    const navLinks = sidebarEl.querySelectorAll('a.menu-item[href]:not([href="#"])');

    navLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
            const href = link.getAttribute('href');
            if (!href || link.classList.contains('active')) return;

            const targetUrl = new URL(href, window.location.href);
            const isPlainLeftClick = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

            if (!isPlainLeftClick || targetUrl.origin !== window.location.origin) return;

            event.preventDefault();
            document.documentElement.classList.remove('sidebar-animated');
            document.documentElement.classList.add('page-is-leaving');
            link.classList.add('active');

            window.setTimeout(() => {
                window.location.href = targetUrl.href;
            }, 90);
        }, { once: true });
    });
}

window.refreshSidebarBadges = async function () {
    const token = getToken();
    if (!token) return;

    const decoded = decodeJWT(token);
    if (!decoded || !decoded.VaiTro) return;

    const updateSidebarBadge = (id, count) => {
        const badgeEl = document.getElementById(id);
        if (!badgeEl) return;
        const menuItem = badgeEl.closest('.menu-item');
        if (count > 0) {
            badgeEl.textContent = count > 99 ? '99+' : count;
            badgeEl.style.display = 'flex';
            if (menuItem) menuItem.classList.add('has-unread');
        } else {
            badgeEl.textContent = '0';
            badgeEl.style.display = 'none';
            if (menuItem) menuItem.classList.remove('has-unread');
        }
    };

    if (decoded.VaiTro === 'Admin') {
        try {
            const res = await fetch(`${API_URL}/admin/stats/overview`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) return;

            const data = await res.json();
            updateSidebarBadge('badge-pendingDocs', data.pendingDocs || 0);
            updateSidebarBadge('badge-pendingReports', data.pendingReports || 0);
            updateSidebarBadge('badge-pendingPayments', data.pendingPayments || 0);
            updateSidebarBadge('badge-pendingTeachers', data.pendingTeachers || 0);
            updateSidebarBadge('badge-pendingSubjects', data.pendingSubjects || 0);
        } catch (e) {
            console.error('Lỗi refresh sidebar badges:', e);
        }
    } else if (decoded.VaiTro === 'GiaoVien') {
        try {
            const res = await fetch(`${API_URL}/admin/documents/counts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const counts = await res.json();
                updateSidebarBadge('badge-pendingDocs', counts.ChoDuyet || 0);
            }
        } catch (e) {
            console.error('Lỗi refresh teacher moderation badge:', e);
        }
    }
};

function renderNavbarUserProfile() {
    try {
        const token = getToken();
        if (!token) return;
        const payload = decodeJWT(token);
        if (!payload) return;

        const avatarEl = document.getElementById('navAvatar');
        const nameEl = document.getElementById('navUserName');
        const roleEl = document.getElementById('navUserRole');

        if (avatarEl && payload.HoTen) {
            const savedAvatar = getAvatar();
            if (savedAvatar && savedAvatar !== 'null') {
                avatarEl.innerHTML = `<img src="${getAssetUrl(savedAvatar)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" referrerpolicy="no-referrer">`;
                avatarEl.style.background = 'transparent';
                avatarEl.style.color = 'transparent';
            } else {
                avatarEl.textContent = payload.HoTen.trim().split(' ').pop().charAt(0).toUpperCase();
                avatarEl.style.background = 'var(--primary-light)';
                avatarEl.style.color = 'var(--primary)';
            }
        }

        if (nameEl && payload.HoTen) {
            nameEl.textContent = payload.HoTen;
        }

        if (roleEl && payload.VaiTro) {
            roleEl.textContent = payload.VaiTro === 'Admin' ? 'Quản trị viên' : (payload.VaiTro === 'GiaoVien' ? 'Giáo viên' : 'Sinh viên');
            if (payload.VaiTro === 'Admin') {
                roleEl.style.color = 'var(--danger-color, #ef4444)';
                roleEl.style.fontWeight = '600';
            }
        }

    } catch (e) {
        console.error('Lỗi load user profile navbar:', e);
    }
}

function setupUserProfileNavigation() {
    const profileEls = document.querySelectorAll('#userProfileNav, .navbar .user-profile');
    if (!profileEls.length) return;

    const isAlreadyOnProfile = window.location.pathname.includes('userProfile.html');

    const goToProfile = () => {
        if (!isAlreadyOnProfile) {
            window.location.href = new URL('../user/userProfile.html', window.location.href).href;
        }
    };

    profileEls.forEach((profileEl) => {
        if (isAlreadyOnProfile) {
            profileEl.style.cursor = 'default';
        } else {
            profileEl.style.cursor = 'pointer';
            profileEl.setAttribute('role', 'button');
            profileEl.setAttribute('tabindex', '0');

            profileEl.addEventListener('click', goToProfile);
            profileEl.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    goToProfile();
                }
            });
        }
    });
}

function setupNotificationNavigation() {
    const notificationBtn = document.getElementById('navNotifications');
    if (!notificationBtn) return;

    notificationBtn.addEventListener('click', () => {
        window.location.href = new URL('../user/notifications.html', window.location.href).href;
    });
}

function setupRealtimeNotifications() {
    const socket = getSocket();
    if (!socket) return;

    socket.on('notification', (payload) => {
        const { type, data } = payload;
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'info',
                title: 'Thông báo mới',
                text: data.message || 'Bạn có một thông báo mới',
                showConfirmButton: false,
                timer: 4000,
                timerProgressBar: true
            });
        } else if (typeof showToast === 'function') {
            showToast('info', data.message || 'Bạn có thông báo mới');
        }

        const badgeEls = document.querySelectorAll('.notification-badge, #notificationCount, .badge-count');
        badgeEls.forEach(badge => {
            let count = parseInt(badge.textContent || '0');
            badge.textContent = count + 1;
            badge.style.display = 'inline-flex';
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const token = getToken();
    let userRole = null;
    if (token) {
        const decoded = decodeJWT(token);
        if (decoded) userRole = decoded.VaiTro;
    }

    renderSidebar();
    renderNavbarUserProfile();
    setupUserProfileNavigation();
    setupNotificationNavigation();
    setupRealtimeNotifications();

    if (window.location.pathname.includes('/admin/')) {
        makeAdminTablesResizableAndSticky();
    }
    
    setupCommandPalette(userRole);
});

function setupCommandPalette(userRole) {
    if (userRole !== 'Admin') return;

    if (!document.getElementById('command-palette-styles')) {
        const style = document.createElement('style');
        style.id = 'command-palette-styles';
        style.innerHTML = `
            #command-palette-overlay {
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(15, 23, 42, 0.4);
                backdrop-filter: blur(8px);
                z-index: 10000;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding-top: 12vh;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.2s, visibility 0.2s;
            }
            #command-palette-overlay.show {
                opacity: 1;
                visibility: visible;
            }
            #command-palette-modal {
                background: var(--white);
                width: 100%;
                max-width: 600px;
                border-radius: 12px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                overflow: hidden;
                transform: scale(0.95);
                transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                display: flex;
                flex-direction: column;
                margin: 0 16px;
            }
            #command-palette-overlay.show #command-palette-modal {
                transform: scale(1);
            }
            .cp-header {
                padding: 16px 20px;
                border-bottom: 1px solid var(--border);
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .cp-header i {
                color: var(--text-secondary);
                font-size: 18px;
            }
            .cp-input {
                border: none;
                outline: none;
                font-size: 18px;
                flex-grow: 1;
                background: transparent;
                color: var(--text-primary);
                font-family: inherit;
            }
            .cp-results {
                max-height: 400px;
                overflow-y: auto;
                padding: 12px;
            }
            .cp-item {
                padding: 12px 16px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: 12px;
                cursor: pointer;
                text-decoration: none;
                color: var(--text-primary);
                font-size: 15px;
            }
            .cp-item.selected, .cp-item:hover {
                background: var(--primary-light);
            }
            .cp-item i {
                color: var(--primary);
                width: 24px;
                text-align: center;
                font-size: 16px;
            }
            .cp-empty {
                padding: 24px;
                text-align: center;
                color: var(--text-secondary);
                font-size: 14px;
            }
            .cp-shortcut {
                font-size: 12px;
                background: var(--bg);
                border: 1px solid var(--border);
                padding: 2px 6px;
                border-radius: 4px;
                color: var(--text-secondary);
                margin-left: auto;
            }
        `;
        document.head.appendChild(style);
    }

    const overlay = document.createElement('div');
    overlay.id = 'command-palette-overlay';
    overlay.innerHTML = `
        <div id="command-palette-modal">
            <div class="cp-header">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="cp-input" class="cp-input" placeholder="Tìm kiếm trang hoặc chức năng..." autocomplete="off">
            </div>
            <div class="cp-results" id="cp-results"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('cp-input');
    const resultsContainer = document.getElementById('cp-results');
    
    const uniqueItemsMap = new Map();
    SIDEBAR_ITEMS.filter(item => item.roles.includes('Admin')).forEach(item => {
        uniqueItemsMap.set(item.href, item);
    });
    const cpItems = Array.from(uniqueItemsMap.values());
    
    let currentResults = [];
    let selectedIndex = 0;

    function renderResults(query = '') {
        query = query.toLowerCase().trim();
        currentResults = cpItems.filter(item => item.label.toLowerCase().includes(query));
        
        if (currentResults.length === 0) {
            resultsContainer.innerHTML = '<div class="cp-empty">Không tìm thấy kết quả phù hợp.</div>';
            return;
        }

        resultsContainer.innerHTML = currentResults.map((item, index) => `
            <a href="${item.href}" class="cp-item ${index === 0 ? 'selected' : ''}" data-index="${index}">
                <i class="fa-solid ${item.icon}"></i>
                <span>${item.label}</span>
                <span class="cp-shortcut">↵</span>
            </a>
        `).join('');
        selectedIndex = 0;
    }

    function updateSelection() {
        const items = resultsContainer.querySelectorAll('.cp-item');
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    function togglePalette() {
        if (overlay.classList.contains('show')) {
            overlay.classList.remove('show');
            document.body.style.overflow = '';
            input.blur();
        } else {
            overlay.classList.add('show');
            document.body.style.overflow = 'hidden';
            input.value = '';
            renderResults();
            setTimeout(() => input.focus(), 50);
        }
    }

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            togglePalette();
        }
        
        if (!overlay.classList.contains('show')) return;

        if (e.key === 'Escape') {
            togglePalette();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (selectedIndex < currentResults.length - 1) {
                selectedIndex++;
                updateSelection();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selectedIndex > 0) {
                selectedIndex--;
                updateSelection();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentResults[selectedIndex]) {
                let targetHref = currentResults[selectedIndex].href;
                window.location.href = targetHref;
            }
        }
    });

    input.addEventListener('input', (e) => {
        renderResults(e.target.value);
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            togglePalette();
        }
    });
}

window.refreshSidebarBadges = async function() {
    const token = getToken();
    if (!token) return;

    const decoded = decodeJWT(token);
    if (!decoded || !decoded.VaiTro) return;
    const userRole = decoded.VaiTro;

    const updateSidebarBadge = (id, count) => {
        const badgeEl = document.getElementById(id);
        if (!badgeEl) return;
        const menuItem = badgeEl.closest('.menu-item');
        if (count > 0) {
            badgeEl.textContent = count > 99 ? '99+' : count;
            badgeEl.style.display = 'flex';
            if (menuItem) menuItem.classList.add('has-unread');
        } else {
            badgeEl.textContent = '0';
            badgeEl.style.display = 'none';
            if (menuItem) menuItem.classList.remove('has-unread');
        }
    };

    if (userRole === 'Admin') {
        try {
            const res = await fetch(`${API_URL}/admin/stats/overview`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                updateSidebarBadge('badge-pendingDocs', data.pendingDocs || 0);
                updateSidebarBadge('badge-pendingReports', data.pendingReports || 0);
                updateSidebarBadge('badge-pendingPayments', data.pendingPayments || 0);
                updateSidebarBadge('badge-pendingTeachers', data.pendingTeachers || 0);
                updateSidebarBadge('badge-pendingSubjects', data.pendingSubjects || 0);
            }
        } catch (e) {
            console.error('Lỗi load Admin badges:', e);
        }
    } else if (userRole === 'GiaoVien') {
        try {
            const res = await fetch(`${API_URL}/admin/documents/counts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const counts = await res.json();
                updateSidebarBadge('badge-pendingDocs', counts.ChoDuyet || 0);
            }
        } catch (e) {
            console.error('Lỗi load teacher moderation badge:', e);
        }
    }
};
