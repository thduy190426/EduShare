import { API_URL } from './config.js';
import { decodeJWT, getAssetUrl, getToken, getAvatar, clearAuthSession } from './utils.js';

const SIDEBAR_ITEMS = [
    { label: 'Trang chủ', icon: 'fa-house', href: '../user/userHome.html', roles: ['SinhVien', 'GiaoVien'], group: 'user' },
    { label: 'Tìm kiếm tài liệu', icon: 'fa-magnifying-glass', href: '../document/searchResults.html', roles: ['SinhVien', 'GiaoVien'], group: 'user' },
    { label: 'Tải tài liệu', icon: 'fa-upload', href: '../document/uploadDocument.html', roles: ['SinhVien', 'GiaoVien'], group: 'user' },
    { label: 'Tài liệu của tôi', icon: 'fa-folder-open', href: '../document/myDocuments.html', roles: ['SinhVien', 'GiaoVien'], group: 'user' },
    { label: 'Nhóm học tập', icon: 'fa-users', href: '../group/groupList.html', roles: ['SinhVien', 'GiaoVien'], group: 'user' },
    { label: 'Hồ sơ của tôi', icon: 'fa-user', href: '../user/userProfile.html', roles: ['SinhVien', 'GiaoVien'], group: 'user' },
  
    { label: 'Tổng quan', icon: 'fa-chart-column', href: '../admin/adminDashboard.html', roles: ['Admin'], group: 'admin' },
    { label: 'Kiểm duyệt', icon: 'fa-shield-halved', href: '../admin/adminModeration.html', roles: ['Admin'], badge: 'pendingDocs', group: 'admin' },
    { label: 'Người dùng', icon: 'fa-users-gear', href: '../admin/adminUserManagement.html', roles: ['Admin'], group: 'admin' },
    { label: 'Môn học', icon: 'fa-book', href: '../admin/adminSubjects.html', roles: ['Admin'], group: 'admin' },
    { label: 'Quản lý Nhóm', icon: 'fa-users-rectangle', href: '../admin/adminGroups.html', roles: ['Admin'], group: 'admin' },
    { label: 'Báo cáo', icon: 'fa-flag', href: '../admin/adminViolationReports.html', roles: ['Admin'], badge: 'pendingReports', group: 'admin' }
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

    html += `
        <div class="menu-group hide-on-tablet-mobile" style="margin-top: auto; padding-top: 24px; border-top: 1px solid var(--border); margin-bottom: 0;">
            <div class="sidebar-toggle" id="btn-toggle-sidebar">
                <i class="fa-solid fa-bars" style="font-size: 20px;"></i>
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
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            clearAuthSession();
            window.location.href = '../auth/login.html';
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
        });
    }

    if (userRole === 'Admin') {
        try {
            const res = await fetch(`${API_URL}/admin/stats/overview`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.pendingDocs > 0) {
                    const badgeDocs = document.getElementById('badge-pendingDocs');
                    if (badgeDocs) {
                        badgeDocs.textContent = data.pendingDocs > 99 ? '99+' : data.pendingDocs;
                        badgeDocs.style.display = 'flex';
                    }
                } else {
                    const badgeDocs = document.getElementById('badge-pendingDocs');
                    if (badgeDocs) {
                        badgeDocs.textContent = '0';
                        badgeDocs.style.display = 'none';
                    }
                }
                if (data.pendingReports > 0) {
                    const badgeReports = document.getElementById('badge-pendingReports');
                    if (badgeReports) {
                        badgeReports.textContent = data.pendingReports > 99 ? '99+' : data.pendingReports;
                        badgeReports.style.display = 'flex';
                    }
                } else {
                    const badgeReports = document.getElementById('badge-pendingReports');
                    if (badgeReports) {
                        badgeReports.textContent = '0';
                        badgeReports.style.display = 'none';
                    }
                }
            }
        } catch (e) {
            console.error('Lỗi load admin badges:', e);
        }
    }

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

    try {
        const res = await fetch(`${API_URL}/admin/stats/overview`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;

        const data = await res.json();
        const badgeDocs = document.getElementById('badge-pendingDocs');
        if (badgeDocs) {
            if (Number(data.pendingDocs || 0) > 0) {
                badgeDocs.textContent = data.pendingDocs > 99 ? '99+' : data.pendingDocs;
                badgeDocs.style.display = 'flex';
            } else {
                badgeDocs.textContent = '0';
                badgeDocs.style.display = 'none';
            }
        }

        const badgeReports = document.getElementById('badge-pendingReports');
        if (badgeReports) {
            if (Number(data.pendingReports || 0) > 0) {
                badgeReports.textContent = data.pendingReports > 99 ? '99+' : data.pendingReports;
                badgeReports.style.display = 'flex';
            } else {
                badgeReports.textContent = '0';
                badgeReports.style.display = 'none';
            }
        }
    } catch (e) {
        console.error('Lá»—i refresh sidebar badges:', e);
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
                avatarEl.innerHTML = `<img src="${getAssetUrl(savedAvatar)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                avatarEl.style.background = 'transparent';
                avatarEl.style.color = 'transparent';
            } else {
                avatarEl.textContent = payload.HoTen.trim().split(' ').pop().charAt(0).toUpperCase();
            }
        }
        
        if (nameEl && payload.HoTen) {
            nameEl.textContent = payload.HoTen;
        }
        
        if (roleEl && payload.VaiTro) {
            roleEl.textContent = payload.VaiTro === 'Admin' ? 'Quản trị viên' : (payload.VaiTro === 'GiaoVien' ? 'Giáo viên' : 'Sinh viên');
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

document.addEventListener('DOMContentLoaded', () => {
    renderSidebar();
    renderNavbarUserProfile();
    setupUserProfileNavigation();
    setupNotificationNavigation();
});
