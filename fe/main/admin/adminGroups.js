import { renderBreadcrumb } from '../shared/utils.js';
import { checkAuth, getToken, showToast, renderPagination } from '../shared/utils.js';
document.addEventListener('DOMContentLoaded', () => {
    renderBreadcrumb([{ name: 'Trang chủ Admin', url: 'adminDashboard.html' }, { name: 'Quản lý Nhóm' }]);

    const user = checkAuth();
    if (!user || user.VaiTro !== 'Admin') {
        showToast('error', 'Bạn không có quyền truy cập trang này!');
        window.location.href = '../auth/login.html';
        return;
    }
    loadGroups();
});
let currentPage = 1;
const limit = 10;
async function loadGroups() {
    const tableBody = document.getElementById('groups-table-body');
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Đang tải dữ liệu...</td></tr>';
    try {
        const token = getToken();
        const response = await fetch(`http://localhost:3000/api/admin/groups?page=${currentPage}&limit=${limit}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Không thể tải danh sách nhóm');
        }
        const data = await response.json();
        renderGroups(data.data || []);
        if (data.pagination) {
            renderPagination('group-pagination', data.pagination.totalPages, currentPage, (page) => {
                currentPage = page;
                loadGroups();
            });
        }
    } catch (error) {
        console.error('Lỗi khi tải danh sách nhóm:', error);
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Lỗi tải dữ liệu. Vui lòng thử lại sau.</td></tr>';
    }
}
function renderGroups(groups) {
    const tableBody = document.getElementById('groups-table-body');
    tableBody.innerHTML = '';
    if (groups.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Không có nhóm nào</td></tr>';
        return;
    }
    groups.forEach((group, index) => {
        const isActive = group.TrangThai === 'HoatDong';
        const statusClass = isActive ? 'status-active' : 'status-locked';
        const statusText = isActive ? 'Hoạt động' : 'Ngừng hoạt động';
        const statusBadge = `<span class="${statusClass}"><span class="status-dot"></span>${statusText}</span>`;
        const detailBtn = `<button class="btn-action" style="background: #EEF2FF; color: #4F46E5; width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;" onclick="window.viewGroupDetails(${group.MaNhom})" title="Chi tiết"><i class="fa-solid fa-eye"></i></button>`;
        const deleteBtn = `<button class="btn-action" style="background: #FEF2F2; color: #EF4444; width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;" onclick="window.deleteGroup(${group.MaNhom})" title="Xóa nhóm khỏi CSDL"><i class="fa-solid fa-trash"></i></button>`;
        const actionBtn = isActive
            ? `<div style="display: flex; gap: 8px; align-items: center;">${detailBtn}<button class="btn-action" style="background: #FFFBEB; color: #D97706; width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;" onclick="window.toggleGroupStatus(${group.MaNhom}, 'HoatDong')" title="Ngừng hoạt động"><i class="fa-solid fa-ban"></i></button>${deleteBtn}</div>`
            : `<div style="display: flex; gap: 8px; align-items: center;">${detailBtn}<button class="btn-action" style="background: #DCFCE7; color: #16A34A; width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;" onclick="window.toggleGroupStatus(${group.MaNhom}, 'NgungHoatDong')" title="Khôi phục"><i class="fa-solid fa-rotate-left"></i></button>${deleteBtn}</div>`;
        const tr = document.createElement('tr');
        let adminAvatarHtml = '';
        if (group.TenNguoiQuanTri) {
            const initial = group.TenNguoiQuanTri.trim().split(' ').pop().charAt(0).toUpperCase();
            if (group.AvatarQuanTri) {
                const fullUrl = group.AvatarQuanTri.startsWith('http') ? group.AvatarQuanTri : 'http://localhost:3000' + group.AvatarQuanTri;
                adminAvatarHtml = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <img src="${fullUrl}" style="width:28px; height:28px; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" alt="Avatar">
                        <div class="user-initial" style="width:28px; height:28px; border-radius:50%; background:#EFF6FF; color:#2563EB; display:none; justify-content:center; align-items:center; font-weight:bold; font-size:12px;">${initial}</div>
                        <span>${group.TenNguoiQuanTri}</span>
                    </div>
                `;
            } else {
                adminAvatarHtml = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="user-initial" style="width:28px; height:28px; border-radius:50%; background:#EFF6FF; color:#2563EB; display:flex; justify-content:center; align-items:center; font-weight:bold; font-size:12px;">${initial}</div>
                        <span>${group.TenNguoiQuanTri}</span>
                    </div>
                `;
            }
        } else {
            adminAvatarHtml = 'N/A';
        }
        tr.innerHTML = `
            <td style="text-align: center; font-weight: bold; color: var(--text-secondary);" data-label="STT">${index + 1}</td>
            <td style="font-weight: 600;" data-label="Tên nhóm">${group.TenNhom}</td>
            <td data-label="Môn học">${group.TenMonHoc || 'Không có'}</td>
            <td data-label="Người quản trị">${adminAvatarHtml}</td>
            <td data-label="Thành viên">${group.SoLuongThanhVien || 0}</td>
            <td data-label="Trạng thái">${statusBadge}</td>
            <td data-label="Thao tác">${actionBtn}</td>
        `;
        tableBody.appendChild(tr);
    });
}
window.toggleGroupStatus = async function(maNhom, currentState) {
    if (currentState === 'HoatDong') {
        const isConfirm = (await Swal.fire({ title: 'Xác nhận', text: "Bạn có chắc chắn muốn giải tán nhóm này không? Mọi tài liệu trong nhóm sẽ bị ẩn.", icon: 'warning', showCancelButton: true, confirmButtonText: 'Đồng ý', cancelButtonText: 'Hủy' })).isConfirmed;
        if (!isConfirm) return;
    }
    try {
        const token = getToken();
        const response = await fetch(`http://localhost:3000/api/admin/groups/${maNhom}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const result = await response.json();
        if (response.ok) {
            showToast('success', result.message);
            loadGroups(); 
        } else {
            showToast('error', result.message || 'Có lỗi xảy ra.');
        }
    } catch (error) {
        console.error('Lỗi khi đổi trạng thái nhóm:', error);
        showToast('error', 'Lỗi hệ thống khi cập nhật trạng thái.');
    }
};
window.deleteGroup = async function(maNhom) {
    const isConfirm = (await Swal.fire({ 
        title: 'Xóa vĩnh viễn', 
        text: "Bạn có chắc chắn muốn xóa nhóm này hoàn toàn khỏi cơ sở dữ liệu không? Mọi tài liệu và thành viên liên quan sẽ bị xóa. Hành động này không thể hoàn tác!", 
        icon: 'error', 
        showCancelButton: true, 
        confirmButtonText: 'Xóa', 
        cancelButtonText: 'Hủy' 
    })).isConfirmed;
    if (!isConfirm) return;
    try {
        const token = getToken();
        const response = await fetch(`http://localhost:3000/api/admin/groups/${maNhom}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();
        if (response.ok) {
            showToast('success', result.message);
            loadGroups(); 
        } else {
            showToast('error', result.message || 'Có lỗi xảy ra.');
        }
    } catch (error) {
        console.error('Lỗi khi xóa nhóm:', error);
        showToast('error', 'Lỗi hệ thống khi xóa nhóm.');
    }
};
window.viewGroupDetails = async function(maNhom) {
    try {
        const token = getToken();
        const resMem = await fetch(`http://localhost:3000/api/groups/${maNhom}/members`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataMem = await resMem.json();
        const members = dataMem.members || [];
        const resDoc = await fetch(`http://localhost:3000/api/groups/${maNhom}/documents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataDoc = await resDoc.json();
        const documents = dataDoc.documents || [];
        let memHtml = members.map(m => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${m.HoTen}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${m.Email}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${m.VaiTroTrongNhom === 'QuanTri' ? 'Quản trị viên' : 'Thành viên'}</td>
            </tr>
        `).join('');
        let docHtml = documents.map(d => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.TenTL}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.TenNguoiDang || 'N/A'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date(d.NgayChiaSe).toLocaleDateString('vi-VN')}</td>
            </tr>
        `).join('');
        Swal.fire({
            title: `Chi tiết nhóm #${maNhom}`,
            width: '800px',
            html: `
                <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                    <h3 style="font-size: 16px; margin-bottom: 10px; color: var(--primary);">Danh sách thành viên (${members.length})</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
                        <thead>
                            <tr style="background: #f8fafc;">
                                <th style="padding: 8px; border-bottom: 2px solid #e2e8f0; text-align: left;">Họ tên</th>
                                <th style="padding: 8px; border-bottom: 2px solid #e2e8f0; text-align: left;">Email</th>
                                <th style="padding: 8px; border-bottom: 2px solid #e2e8f0; text-align: left;">Vai trò</th>
                            </tr>
                        </thead>
                        <tbody>${memHtml || '<tr><td colspan="3" style="padding: 8px; text-align: center;">Không có thành viên</td></tr>'}</tbody>
                    </table>
                    <h3 style="font-size: 16px; margin-bottom: 10px; color: var(--primary);">Tài liệu đã chia sẻ (${documents.length})</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="background: #f8fafc;">
                                <th style="padding: 8px; border-bottom: 2px solid #e2e8f0; text-align: left;">Tên tài liệu</th>
                                <th style="padding: 8px; border-bottom: 2px solid #e2e8f0; text-align: left;">Người chia sẻ</th>
                                <th style="padding: 8px; border-bottom: 2px solid #e2e8f0; text-align: left;">Ngày chia sẻ</th>
                            </tr>
                        </thead>
                        <tbody>${docHtml || '<tr><td colspan="3" style="padding: 8px; text-align: center;">Không có tài liệu</td></tr>'}</tbody>
                    </table>
                </div>
            `,
            showCloseButton: true,
            showConfirmButton: false
        });
    } catch (error) {
        console.error('Lỗi khi tải chi tiết nhóm:', error);
        showToast('error', 'Lỗi khi tải dữ liệu nhóm.');
    }
};
