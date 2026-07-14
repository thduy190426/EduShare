import { API_URL } from '../shared/config.js';
import { escapeHTML, getAssetUrl, getToken, showToast } from '../shared/utils.js';


const token = getToken();

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        Swal.fire('Vui lòng đăng nhập.');
        window.location.href = '../guest/guestHome.html';
        return;
    }

    fetchUsers();

    ['input-search', 'filter-role', 'filter-status', 'filter-sort'].forEach(id => {
        document.getElementById(id)?.addEventListener(id === 'input-search' ? 'input' : 'change', () => {
            fetchUsers();
            updateClearFilterButton();
        });
    });

    document.getElementById('btn-clear-filter')?.addEventListener('click', () => {
        document.getElementById('input-search').value = '';
        document.getElementById('filter-role').value = '';
        document.getElementById('filter-status').value = '';
        document.getElementById('filter-sort').value = 'newest';
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

        const queryString = queryParams.toString();
        const url = `${API_URL}/admin/users${queryString ? `?${queryString}` : ''}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 403) {
            Swal.fire('Bạn không có quyền truy cập trang này.');
            window.location.href = '../guest/guestHome.html';
            return;
        }

        const data = await res.json();
        renderUsers(data.users);
    } catch (err) {
        console.error(err);
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('user-table-body');
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Không tìm thấy người dùng nào.</td></tr>';
        return;
    }

    users.forEach(user => {
        const tr = document.createElement('tr');
        
        const userName = user.HoTen || '';
        const userEmail = user.Email || '';
        const initial = userName.charAt(0).toUpperCase();
        let avatarHtml = `<div class="user-initial">${escapeHTML(initial)}</div>`;
        if (user.AvatarURL && user.AvatarURL !== 'null') {
            avatarHtml = `<div class="user-initial" style="background: transparent; color: transparent; overflow: hidden;"><img src="${escapeHTML(getAssetUrl(user.AvatarURL))}" alt="${escapeHTML(userName)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" /></div>`;
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
                <button title="Hiện/ẩn Email" style="background: none; border: none; cursor: pointer; color: var(--text-secondary); margin-left: 6px;" onclick="toggleEmail(this)">
                    <i class="fa-solid fa-eye"></i>
                </button>
            </td>
            <td><span style="color: var(--text-secondary); font-size: 13px; font-weight: 500;">${joinDate}</span></td>
            <td><span class="${statusClass}"><span class="status-dot"></span>${statusText}</span></td>
            <td>
              <div class="action-cell">
                <select class="role-select" onchange="changeRole(${user.MaND}, this.value)">
                    <option value="SinhVien" ${user.VaiTro === 'SinhVien' ? 'selected' : ''}>Sinh viên</option>
                    <option value="GiaoVien" ${user.VaiTro === 'GiaoVien' ? 'selected' : ''}>Giáo viên</option>
                    <option value="Admin" ${user.VaiTro === 'Admin' ? 'selected' : ''}>Admin</option>
                </select>
                <button class="btn-action ${isActive ? 'btn-lock' : 'btn-unlock'}" onclick="toggleStatus(${user.MaND}, '${isActive ? 'BiKhoa' : 'HoatDong'}')">
                    ${isActive ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-solid fa-unlock"></i>'}
                </button>
                <button class="btn-action btn-delete" onclick="deleteUser(${user.MaND}, '${escapeHTML(userName)}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </td>
        `;

        tbody.appendChild(tr);
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
    
    if (icon.classList.contains('fa-eye')) {
        textSpan.textContent = cell.getAttribute('data-full');
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        textSpan.textContent = cell.getAttribute('data-masked');
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};

window.deleteUser = async (maND, userName) => {
    const confirmDelete = await Swal.fire({
        title: 'Xóa vĩnh viễn?',
        html: `Bạn có chắc chắn muốn xóa vĩnh viễn người dùng <b>${userName}</b> không?<br><br><span style="color:var(--danger)">Cảnh báo: Hành động này sẽ xóa toàn bộ tài liệu, nhóm, bình luận và dữ liệu liên quan do người này tạo. Hành động này không thể hoàn tác!</span>`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        confirmButtonText: 'Đồng ý xóa',
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
