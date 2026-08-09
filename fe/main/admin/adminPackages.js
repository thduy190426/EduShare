import { API_URL } from '../shared/config.js';
import { getToken, showToast, escapeHTML, renderPagination } from '../shared/utils.js';

function formatCurrency(amount) {
    if (amount === undefined || amount === null) return '0 VNĐ';
    return amount.toLocaleString('vi-VN') + ' VNĐ';
}

let packages = [];
let currentEditingId = null;
let originalPackageData = null;
let currentPage = 1;
const limit = 10;

document.addEventListener('DOMContentLoaded', () => {
    fetchPackages();
    setupCreateModal();
});

async function fetchPackages() {
    const tableBody = document.getElementById('packages-table-body');
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Đang tải...</td></tr>';

    try {
        const token = getToken();
        const res = await fetch(`${API_URL}/admin/packages?page=${currentPage}&limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            packages = data.data || [];
            renderPackages();
            
            if (data.pagination) {
                renderPagination('packages-pagination', data.pagination.totalPages, currentPage, (page) => {
                    currentPage = page;
                    fetchPackages();
                });
            }
        } else {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Lỗi tải dữ liệu</td></tr>';
        }
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Lỗi kết nối</td></tr>';
    }
}

function renderPackages() {
    const tableBody = document.getElementById('packages-table-body');
    if (packages.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Không có gói nạp nào</td></tr>';
        return;
    }

    tableBody.innerHTML = packages.map((pkg) => {
        const isActive = pkg.TrangThai === 'HoatDong';
        return `
            <tr>
                <td style="font-weight: 600; color: var(--text-secondary);">${escapeHTML(pkg.MaGoi)}</td>
                <td style="font-weight: bold; color: var(--primary);">${escapeHTML(pkg.TenGoi)}</td>
                <td style="font-weight: 600;">${formatCurrency(pkg.SoTien)}</td>
                <td style="color: #f59e0b; font-weight: bold;">${pkg.SoXu} Xu</td>
                <td>${pkg.KhuyenMai > 0 ? `<span style="color:#10b981;">+${pkg.KhuyenMai}%</span>` : '-'}</td>
                <td>
                    <span class="status-badge ${isActive ? 'active' : 'inactive'}" style="display: inline-flex; align-items: center; color: ${isActive ? '#16a34a' : '#ea580c'}; font-size: 13px; font-weight: 500;">
                        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: ${isActive ? '#16a34a' : '#ea580c'}; margin-right: 6px;"></span>
                        ${isActive ? 'Hiển thị' : 'Đang ẩn'}
                    </span>
                </td>
                <td>
                    <button class="btn-action btn-edit" data-id="${pkg.MaGoi}" title="Sửa" style="background: none; border: none; cursor: pointer; color: #3b82f6; font-size: 16px; margin-right: 10px;">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-action btn-toggle" data-id="${pkg.MaGoi}" title="Bật/Tắt" style="background: none; border: none; cursor: pointer; color: ${isActive ? '#f59e0b' : '#10b981'}; font-size: 16px; margin-right: 10px;">
                        <i class="fa-solid ${isActive ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                    </button>
                    <button class="btn-action btn-delete" data-id="${pkg.MaGoi}" title="Xóa/Ẩn" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 16px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => openEditModal(e.currentTarget.dataset.id));
    });

    document.querySelectorAll('.btn-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => togglePackage(e.currentTarget.dataset.id));
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => deletePackage(e.currentTarget.dataset.id));
    });
}

function setupCreateModal() {
    const btnShow = document.getElementById('btn-show-create-modal');
    const modal = document.getElementById('package-custom-modal');
    const btnCloseX = document.getElementById('btn-close-modal-x');
    const btnCancel = document.getElementById('btn-cancel-custom');
    const btnSubmit = document.getElementById('btn-submit-custom');
    const inputMaGoi = document.getElementById('input-magoi');
    const inputTenGoi = document.getElementById('input-tengoi');
    const inputSoTien = document.getElementById('input-sotien');
    const inputSoXu = document.getElementById('input-soxu');
    const inputKhuyenMai = document.getElementById('input-khuyenmai');
    const inputThuTu = document.getElementById('input-thutu');
    const modalTitle = document.getElementById('package-modal-title');

    if (!btnShow || !modal) return;

    window.openEditModal = (id) => {
        const pkg = packages.find(p => p.MaGoi == id);
        if (!pkg) return;

        currentEditingId = id;
        originalPackageData = {
            MaGoi: pkg.MaGoi,
            TenGoi: pkg.TenGoi,
            SoTien: pkg.SoTien,
            SoXu: pkg.SoXu,
            KhuyenMai: pkg.KhuyenMai,
            ThuTu: pkg.ThuTu
        };

        inputMaGoi.value = pkg.MaGoi;
        inputMaGoi.disabled = true; // Không cho sửa mã gói
        inputTenGoi.value = pkg.TenGoi;
        inputSoTien.value = pkg.SoTien;
        inputSoXu.value = pkg.SoXu;
        inputKhuyenMai.value = pkg.KhuyenMai;
        inputThuTu.value = pkg.ThuTu;

        modalTitle.innerHTML = '<i class="fa-solid fa-pen"></i> Chỉnh Sửa Gói Nạp';
        btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> Lưu thay đổi';

        validateForm();
        modal.classList.add('show');
    };

    function closeModal() {
        modal.classList.remove('show');
    }

    function validateForm() {
        if (inputMaGoi && !inputMaGoi.disabled) {
            inputMaGoi.value = inputMaGoi.value.toUpperCase().replace(/\s/g, '');
        }

        const maGoi = inputMaGoi.value.trim();
        const tenGoi = inputTenGoi.value.trim();
        const soTien = parseInt(inputSoTien.value, 10);
        const soXu = parseInt(inputSoXu.value, 10);
        const khuyenMai = parseInt(inputKhuyenMai.value, 10) || 0;
        const thuTu = parseInt(inputThuTu.value, 10) || 0;

        const isValidMaGoi = maGoi.length > 0;
        const isValidTenGoi = tenGoi.length > 0;
        const isValidSoTien = !isNaN(soTien) && soTien >= 0;
        const isValidSoXu = !isNaN(soXu) && soXu >= 0;

        let isChanged = true;
        if (currentEditingId && originalPackageData) {
            isChanged = (
                maGoi !== originalPackageData.MaGoi ||
                tenGoi !== originalPackageData.TenGoi ||
                soTien !== originalPackageData.SoTien ||
                soXu !== originalPackageData.SoXu ||
                khuyenMai !== originalPackageData.KhuyenMai ||
                thuTu !== originalPackageData.ThuTu
            );
        }

        btnSubmit.disabled = !(isValidMaGoi && isValidTenGoi && isValidSoTien && isValidSoXu && isChanged);
    }

    inputMaGoi.addEventListener('input', validateForm);
    inputTenGoi.addEventListener('input', validateForm);
    inputSoTien.addEventListener('input', validateForm);
    inputSoXu.addEventListener('input', validateForm);
    inputKhuyenMai.addEventListener('input', validateForm);
    inputThuTu.addEventListener('input', validateForm);

    btnShow.addEventListener('click', () => {
        currentEditingId = null;
        originalPackageData = null;
        inputMaGoi.value = '';
        inputMaGoi.disabled = false;
        inputTenGoi.value = '';
        inputSoTien.value = '';
        inputSoXu.value = '';
        inputKhuyenMai.value = '0';
        inputThuTu.value = '0';

        modalTitle.innerHTML = '<i class="fa-solid fa-box-open"></i> Tạo Gói Nạp Mới';
        btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> Tạo gói nạp';

        validateForm();
        modal.classList.add('show');
        setTimeout(() => inputMaGoi.focus(), 100);
    });

    btnCloseX.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    btnSubmit.addEventListener('click', async () => {
        const payload = {
            MaGoi: inputMaGoi.value.trim().toUpperCase(),
            TenGoi: inputTenGoi.value.trim(),
            SoTien: parseInt(inputSoTien.value),
            SoXu: parseInt(inputSoXu.value),
            KhuyenMai: parseInt(inputKhuyenMai.value) || 0,
            ThuTu: parseInt(inputThuTu.value) || 0,
            TrangThai: 'HoatDong'
        };

        if (!payload.MaGoi || !payload.TenGoi || isNaN(payload.SoTien) || isNaN(payload.SoXu)) {
            showToast('error', 'Vui lòng điền đủ các thông tin bắt buộc (Mã, Tên, Giá, Xu).');
            return;
        }

        const originalText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
        btnSubmit.disabled = true;

        try {
            const token = getToken();
            let url = `${API_URL}/admin/packages`;
            let method = 'POST';

            if (currentEditingId) {
                url = `${API_URL}/admin/packages/${currentEditingId}`;
                method = 'PUT';
            }

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok) {
                showToast('success', currentEditingId ? 'Cập nhật thành công' : 'Tạo gói thành công');
                closeModal();
                fetchPackages();
            } else {
                showToast('error', data.message || 'Lỗi xử lý');
            }
        } catch (err) {
            showToast('error', 'Lỗi kết nối');
        } finally {
            btnSubmit.innerHTML = originalText;
            btnSubmit.disabled = false;
        }
    });
}

async function togglePackage(id) {
    try {
        const token = getToken();
        const res = await fetch(`${API_URL}/admin/packages/${id}/toggle`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            showToast('success', 'Đã cập nhật trạng thái');
            fetchPackages();
        } else {
            showToast('error', 'Lỗi cập nhật');
        }
    } catch (err) {
        showToast('error', 'Lỗi kết nối');
    }
}

async function deletePackage(id) {
    const confirmResult = await Swal.fire({
        title: 'Bạn có chắc chắn?',
        text: 'Gói nạp này sẽ bị ẩn đi khỏi trang nạp xu của người dùng. Tuy nhiên người dùng vẫn xem lại được các giao dịch cũ liên quan đến gói này.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'Có, ẩn gói này',
        cancelButtonText: 'Hủy'
    });

    if (confirmResult.isConfirmed) {
        try {
            const token = getToken();
            const res = await fetch(`${API_URL}/admin/packages/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                showToast('success', 'Đã ẩn gói nạp.');
                fetchPackages();
            } else {
                const data = await res.json();
                showToast('error', data.message || 'Lỗi xử lý');
            }
        } catch (err) {
            showToast('error', 'Lỗi kết nối');
        }
    }
}
