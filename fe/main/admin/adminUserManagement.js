import { API_URL } from '../shared/config.js';
import { escapeHTML, getAssetUrl, getToken, showToast, renderPagination } from '../shared/utils.js';


const token = getToken();
let currentPage = 1;
const limit = 10;

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        Swal.fire('Vui lòng đăng nhập.');
        window.location.href = '../guest/guestHome.html';
        return;
    }

    fetchUsers();

    ['input-search', 'filter-role', 'filter-status', 'filter-sort'].forEach(id => {
        document.getElementById(id)?.addEventListener(id === 'input-search' ? 'input' : 'change', () => {
            currentPage = 1;
            fetchUsers();
            updateClearFilterButton();
        });
    });

    document.getElementById('btn-clear-filter')?.addEventListener('click', () => {
        document.getElementById('input-search').value = '';
        document.getElementById('filter-role').value = '';
        document.getElementById('filter-status').value = '';
        document.getElementById('filter-sort').value = 'newest';
        currentPage = 1;
        fetchUsers();
        updateClearFilterButton();
    });

    updateClearFilterButton();
});

function updateClearFilterButton() {
    const filters = getUserFilters();
    const btn = document.getElementById('btn-clear-filter');
    if (!btn) return;
    
    const hasFilter = filters.search !== '' || filters.role !== '' || filters.status !== '' || filters.sort !== 'newest';
    if (hasFilter) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
        btn.style.color = 'var(--secondary)';
        btn.style.borderColor = 'var(--secondary)';
        btn.style.background = 'var(--primary-light)';
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.pointerEvents = 'none';
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderColor = 'var(--border)';
        btn.style.background = '#F8FAFC';
    }
}

function getUserFilters() {
    return {
        search: document.getElementById('input-search')?.value.trim() || '',
        role: document.getElementById('filter-role')?.value || '',
        status: document.getElementById('filter-status')?.value || '',
        sort: document.getElementById('filter-sort')?.value || 'newest'
    };
}

async function fetchUsers() {
    try {
        const filters = getUserFilters();
        const queryParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) queryParams.append(key, value);
        });
        queryParams.append('page', currentPage);
        queryParams.append('limit', limit);

        const queryString = queryParams.toString();
        const url = `${API_URL}/admin/users?${queryString}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 403) {
            Swal.fire('Bạn không có quyền truy cập trang này.');
            window.location.href = '../guest/guestHome.html';
            return;
        }

        const data = await res.json();
        renderUsers(data.data || []);
        
        if (data.pagination) {
            renderPagination('user-pagination', data.pagination.totalPages, currentPage, (newPage) => {
                currentPage = newPage;
                fetchUsers();
            });
        }
        
        const selectAll = document.getElementById('selectAllUsers');
        if (selectAll) selectAll.checked = false;
        updateSelectedCount();
    } catch (err) {
        console.error(err);
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('user-table-body');
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Không tìm thấy người dùng nào.</td></tr>';
        return;
    }

    users.forEach((user, index) => {
        const tr = document.createElement('tr');
        
        const userName = user.HoTen || 'Người dùng ẩn danh';
        const userEmail = user.Email || '';
        const initial = userName.trim().split(' ').pop().charAt(0).toUpperCase();
        let avatarHtml = `<div class="user-initial">${escapeHTML(initial)}</div>`;
        if (user.AvatarURL && user.AvatarURL !== 'null') {
            avatarHtml = `<div class="user-initial" style="background: transparent; color: transparent; overflow: hidden;"><img src="${escapeHTML(getAssetUrl(user.AvatarURL))}" alt="${escapeHTML(userName)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.onerror=null; this.parentElement.style.background='#EFF6FF'; this.parentElement.style.color='#2563EB'; this.parentElement.innerHTML='${escapeHTML(initial)}';" /></div>`;
        }

        let roleBadgeClass = 'role-student';
        let roleName = 'Sinh viên';
        if (user.VaiTro === 'GiaoVien') { roleBadgeClass = 'role-teacher'; roleName = 'Giáo viên'; }
        else if (user.VaiTro === 'Admin') { roleBadgeClass = 'role-admin'; roleName = 'Admin'; }

        const isActive = user.TrangThai === 'HoatDong';
        const statusClass = isActive ? 'status-active' : 'status-locked';
        const statusText = isActive ? 'Hoạt động' : 'Bị khóa';
        const toggleStatusBtnText = isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản';

        let maskedEmail = userEmail;
        if (userEmail && userEmail.includes('@')) {
            const parts = userEmail.split('@');
            const nameLen = parts[0].length;
            const keepLen = Math.min(3, Math.max(1, Math.ceil(nameLen / 3)));
            maskedEmail = parts[0].substring(0, keepLen) + '******@' + parts[1];
        }

        let joinDate = 'N/A';
        if (user.NgayTao) {
            const d = new Date(user.NgayTao);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            const ss = String(d.getSeconds()).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            joinDate = `${hh}:${mm}:${ss} <span style="color:var(--border); margin: 0 4px;">|</span> ${dd}/${mo}/${yyyy}`;
        }

        tr.innerHTML = `
            <td style="text-align: center;"><input type="checkbox" class="user-checkbox" value="${user.MaND}" data-id="${user.MaND}" style="cursor: pointer; transform: scale(1.2);"></td>
            <td style="text-align: center; font-weight: bold; color: var(--text-secondary);">${index + 1}</td>
            <td>
                <div class="user-cell">
                  ${avatarHtml}
                  <div>
                    <div class="user-name">${escapeHTML(userName)}</div>
                  </div>
                </div>
            </td>
            <td><span class="role-badge ${roleBadgeClass}">${roleName}</span></td>
            <td class="email-cell" data-full="${escapeHTML(userEmail)}" data-masked="${escapeHTML(maskedEmail)}">
                <span class="email-text">${escapeHTML(maskedEmail)}</span>
                <button class="btn-toggle-email" title="Hiện/ẩn Email" style="background: none; border: none; cursor: pointer; color: var(--text-secondary); margin-left: 6px;">
                    <i class="fa-solid fa-eye"></i>
                </button>
            </td>
            <td><span style="color: var(--text-secondary); font-size: 13px; font-weight: 500;">${joinDate}</span></td>
            <td><span class="${statusClass}"><span class="status-dot"></span>${statusText}</span></td>
            <td>
              <div class="action-cell">
                <select class="role-select" data-id="${user.MaND}">
                    <option value="SinhVien" ${user.VaiTro === 'SinhVien' ? 'selected' : ''}>Sinh viên</option>
                    <option value="GiaoVien" ${user.VaiTro === 'GiaoVien' ? 'selected' : ''}>Giáo viên</option>
                    <option value="Admin" ${user.VaiTro === 'Admin' ? 'selected' : ''}>Admin</option>
                </select>
                <button class="btn-action ${isActive ? 'btn-lock' : 'btn-unlock'} btn-toggle-status" data-id="${user.MaND}" data-status="${isActive ? 'BiKhoa' : 'HoatDong'}">
                    ${isActive ? '<i class="fa-solid fa-lock-open"></i>' : '<i class="fa-solid fa-lock"></i>'}
                </button>
                <button class="btn-action btn-delete" data-id="${user.MaND}" data-name="${escapeHTML(userName)}">
                    <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    document.querySelectorAll('.user-checkbox').forEach(cb => {
        cb.addEventListener('change', window.updateSelectedCount);
    });
    document.querySelectorAll('.btn-toggle-email').forEach(btn => {
        btn.addEventListener('click', (e) => window.toggleEmail(e.currentTarget));
    });
    document.querySelectorAll('.role-select').forEach(select => {
        select.addEventListener('change', (e) => window.changeRole(e.currentTarget.dataset.id, e.currentTarget.value));
    });
    document.querySelectorAll('.btn-toggle-status').forEach(btn => {
        btn.addEventListener('click', (e) => window.toggleStatus(e.currentTarget.dataset.id, e.currentTarget.dataset.status));
    });
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => window.deleteUser(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
    });
}

window.changeRole = async (maND, newRole) => {
    if (!(await Swal.fire({ title: 'Xác nhận', text: 'Bạn có chắc chắn muốn thay đổi quyền của người dùng này?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Đồng ý', cancelButtonText: 'Hủy' })).isConfirmed) return;
    
    try {
        const res = await fetch(`${API_URL}/admin/users/${maND}/role`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ vaiTro: newRole })
        });
        if (res.ok) {
            showToast('success', 'Cập nhật quyền thành công!');
            fetchUsers();
        } else {
            const data = await res.json();
            showToast('error', data.message);
        }
    } catch (err) {
        console.error(err);
    }
};

window.toggleStatus = async (maND, newStatus) => {
    const actionText = newStatus === 'BiKhoa' ? 'KHÓA' : 'MỞ KHÓA';
    if (!(await Swal.fire({ title: 'Xác nhận', text: `Bạn có chắc chắn muốn ${actionText} tài khoản này không?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Đồng ý', cancelButtonText: 'Hủy' })).isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/admin/users/${maND}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ trangThai: newStatus })
        });
        if (res.ok) {
            showToast('success', `Đã ${newStatus === 'BiKhoa' ? 'khóa' : 'mở khóa'} thành công!`);
            fetchUsers();
        } else {
            const data = await res.json();
            showToast('error', data.message);
        }
    } catch (err) {
        console.error(err);
    }
};

window.toggleEmail = (btn) => {
    const cell = btn.closest('.email-cell');
    const textSpan = cell.querySelector('.email-text');
    const icon = btn.querySelector('i');
    const full = cell.getAttribute('data-full');
    const masked = cell.getAttribute('data-masked');

    if (textSpan.textContent === masked) {
        textSpan.textContent = full;
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        textSpan.textContent = masked;
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};

window.updateSelectedCount = () => {
    const checkboxes = document.querySelectorAll('.user-checkbox');
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
    const selectAllBtn = document.getElementById('selectAllUsers');
    const bulkContainer = document.getElementById('bulk-actions-container');
    const countDisplay = document.getElementById('selected-count');

    if (selectAllBtn) {
        selectAllBtn.checked = checkboxes.length > 0 && checkboxes.length === checkedBoxes.length;
    }
    
    if (countDisplay) {
        countDisplay.textContent = checkedBoxes.length;
    }
    
    if (bulkContainer) {
        bulkContainer.style.display = checkedBoxes.length > 0 ? 'flex' : 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const selectAllBtn = document.getElementById('selectAllUsers');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.user-checkbox');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            updateSelectedCount();
        });
    }

    const btnBulkLock = document.getElementById('btn-bulk-lock');
    if (btnBulkLock) {
        btnBulkLock.addEventListener('click', () => handleBulkAction('BiKhoa'));
    }

    const btnBulkUnlock = document.getElementById('btn-bulk-unlock');
    if (btnBulkUnlock) {
        btnBulkUnlock.addEventListener('click', () => handleBulkAction('HoatDong'));
    }
});

async function handleBulkAction(newStatus) {
    const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
    const userIds = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (userIds.length === 0) return;

    const actionText = newStatus === 'BiKhoa' ? 'KHÓA' : 'MỞ KHÓA';
    const confirmRes = await Swal.fire({
        title: 'Xác nhận thao tác',
        text: `Bạn có chắc chắn muốn ${actionText} ${userIds.length} tài khoản đã chọn?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Đồng ý',
        cancelButtonText: 'Hủy',
        confirmButtonColor: newStatus === 'BiKhoa' ? '#ef4444' : '#10b981'
    });

    if (!confirmRes.isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/admin/users/bulk-status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userIds, trangThai: newStatus })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            showToast('success', data.message);
            fetchUsers();
        } else {
            showToast('error', data.message);
        }
    } catch (err) {
        console.error(err);
        showToast('error', 'Có lỗi xảy ra khi thực hiện thao tác.');
    }
}

window.deleteUser = async (maND, userName) => {
    const confirmDelete = await Swal.fire({
        title: 'Xóa vĩnh viễn?',
        html: `Bạn có chắc chắn muốn xóa vĩnh viễn người dùng <b>${userName}</b> không?<br><br><span style="color:var(--danger)">Cảnh báo: Hành động này sẽ xóa toàn bộ tài liệu, nhóm, bình luận và dữ liệu liên quan do người này tạo. Hành động này không thể hoàn tác!</span>`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy'
    });

    if (!confirmDelete.isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/admin/users/${maND}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await res.json();
        
        if (res.ok) {
            showToast('success', data.message || 'Đã xóa người dùng vĩnh viễn!');
            fetchUsers();
        } else {
            showToast('error', data.message || 'Lỗi khi xóa người dùng.');
        }
    } catch (err) {
        console.error(err);
        showToast('error', 'Lỗi hệ thống khi xóa người dùng.');
    }
};
