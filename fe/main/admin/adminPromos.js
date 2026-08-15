import { API_URL } from '../shared/config.js';
import { getToken, showToast, escapeHTML, renderPagination } from '../shared/utils.js';

let promos = [];
let currentEditingId = null;
let originalPromoData = null;
let currentPage = 1;
const limit = 10;

document.addEventListener('DOMContentLoaded', () => {
    fetchPromos();
    setupCreateModal();
});

async function fetchPromos() {
    const tableBody = document.getElementById('promos-table-body');
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Đang tải...</td></tr>';

    try {
        const token = getToken();
        const res = await fetch(`${API_URL}/admin/promos?page=${currentPage}&limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            promos = data.data || [];
            renderPromos();

            if (data.pagination) {
                renderPagination('promo-pagination', data.pagination.totalPages, currentPage, (page) => {
                    currentPage = page;
                    fetchPromos();
                });
            }
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Lỗi tải dữ liệu</td></tr>';
        }
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Lỗi kết nối</td></tr>';
    }
}

function renderPromos() {
    const tableBody = document.getElementById('promos-table-body');
    if (promos.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Không có mã ưu đãi nào</td></tr>';
        return;
    }

    tableBody.innerHTML = promos.map((promo, index) => {
        return `
            <tr>
                <td style="text-align: center; font-weight: bold; color: var(--text-secondary);" data-label="STT">${index + 1}</td>
                <td style="font-weight: 600; color: var(--primary);" data-label="Mã giảm giá">
                    ${escapeHTML(promo.Code)}
                    ${promo.IsFlashSale ? '<br><span style="background: #FEF3C7; color: #D97706; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-top: 4px; display: inline-flex; align-items: center; gap: 4px;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="#D97706" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Flash Sale</span>' : ''}
                </td>
                <td data-label="Tỉ lệ (%)">+${promo.DiscountPercent}%</td>
                <td style="color: var(--text-secondary); font-size: 14px;" data-label="Mô tả">
                    ${escapeHTML(promo.Description || '')}
                    ${promo.IsFlashSale && promo.NgayHetHan ? `<br><small style="color: #ef4444;"><i class="fa-regular fa-clock"></i> Kết thúc: ${new Date(promo.NgayHetHan).toLocaleString('vi-VN')}</small>` : ''}
                </td>
                <td data-label="Trạng thái">
                    <span class="status-badge ${promo.IsActive ? 'active' : 'inactive'}" style="display: inline-flex; align-items: center; color: ${promo.IsActive ? '#16a34a' : '#ea580c'}; font-size: 13px; font-weight: 500;">
                        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: ${promo.IsActive ? '#16a34a' : '#ea580c'}; margin-right: 6px;"></span>
                        ${promo.IsActive ? 'Hoạt động' : 'Tạm ngừng'}
                    </span>
                </td>
                <td data-label="Hành động">
                    <button class="btn-action btn-edit" data-id="${promo.MaPromo}" title="Sửa" style="background: none; border: none; cursor: pointer; color: #3b82f6; font-size: 16px; margin-right: 10px;">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-action btn-toggle" data-id="${promo.MaPromo}" title="Bật/Tắt" style="background: none; border: none; cursor: pointer; color: ${promo.IsActive ? '#f59e0b' : '#10b981'}; font-size: 16px; margin-right: 10px;">
                        <i class="fa-solid ${promo.IsActive ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                    </button>
                    <button class="btn-action btn-delete" data-id="${promo.MaPromo}" title="Xóa" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 16px;">
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
        btn.addEventListener('click', (e) => togglePromo(e.currentTarget.dataset.id));
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => deletePromo(e.currentTarget.dataset.id));
    });
}

function setupCreateModal() {
    const btnShow = document.getElementById('btn-show-create-modal');
    const modal = document.getElementById('promo-custom-modal');
    const btnCloseX = document.getElementById('btn-close-modal-x');
    const btnCancel = document.getElementById('btn-cancel-custom');
    const btnSubmit = document.getElementById('btn-submit-custom');
    const inputCode = document.getElementById('custom-promo-code');
    const inputDiscount = document.getElementById('custom-promo-discount');
    const inputDesc = document.getElementById('custom-promo-desc');
    const modalTitle = document.getElementById('promo-modal-title');
    const checkboxFlashSale = document.getElementById('custom-promo-flashsale');
    const inputEndDate = document.getElementById('custom-promo-enddate');
    const dateGroup = document.getElementById('flashsale-date-group');

    if (checkboxFlashSale) {
        checkboxFlashSale.addEventListener('change', (e) => {
            if (e.target.checked) {
                dateGroup.style.display = 'block';
                inputEndDate.required = true;
            } else {
                dateGroup.style.display = 'none';
                inputEndDate.required = false;
                inputEndDate.value = '';
            }
            validateForm();
        });
    }

    if (!btnShow || !modal) return;

    window.openEditModal = (id) => {
        const promo = promos.find(p => p.MaPromo == id);
        if (!promo) return;

        currentEditingId = id;
        originalPromoData = {
            Code: promo.Code,
            DiscountPercent: promo.DiscountPercent,
            Description: promo.Description || '',
            IsFlashSale: !!promo.IsFlashSale,
            NgayHetHan: promo.NgayHetHan || ''
        };
        inputCode.value = promo.Code;
        inputDiscount.value = promo.DiscountPercent;
        inputDesc.value = promo.Description || '';
        if (checkboxFlashSale) {
            checkboxFlashSale.checked = !!promo.IsFlashSale;
            dateGroup.style.display = checkboxFlashSale.checked ? 'block' : 'none';
            inputEndDate.required = checkboxFlashSale.checked;
        }
        if (inputEndDate && promo.NgayHetHan) {
            const dt = new Date(promo.NgayHetHan);
            const tzOffset = dt.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(dt - tzOffset)).toISOString().slice(0, 16);
            inputEndDate.value = localISOTime;
        } else if (inputEndDate) {
            inputEndDate.value = '';
        }

        modalTitle.innerHTML = '<i class="fa-solid fa-pen"></i> Chỉnh sửa mã ưu đãi';
        btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> Lưu thay đổi';

        validateForm();
        modal.classList.add('show');
    };

    function closeModal() {
        modal.classList.remove('show');
    }

    function validateForm() {
        inputCode.value = inputCode.value.toUpperCase();

        const code = inputCode.value.trim();
        const discount = parseInt(inputDiscount.value, 10);
        const description = inputDesc.value.trim();

        const isValidCode = code.length > 0 && /^[A-Z0-9_]+$/.test(code);

        const isValidDiscount = !isNaN(discount) && discount >= 1 && discount <= 100;
        
        const isFlashSale = checkboxFlashSale ? checkboxFlashSale.checked : false;
        const endDateVal = inputEndDate ? inputEndDate.value : '';
        const isValidDate = isFlashSale ? !!endDateVal : true;

        let isChanged = true;
        if (currentEditingId && originalPromoData) {
            let originalDateVal = '';
            if (originalPromoData.NgayHetHan) {
                const dt = new Date(originalPromoData.NgayHetHan);
                const tzOffset = dt.getTimezoneOffset() * 60000;
                originalDateVal = (new Date(dt - tzOffset)).toISOString().slice(0, 16);
            }
            isChanged = (code !== originalPromoData.Code) ||
                (discount !== originalPromoData.DiscountPercent) ||
                (description !== originalPromoData.Description) ||
                (isFlashSale !== originalPromoData.IsFlashSale) ||
                (endDateVal !== originalDateVal);
        }

        btnSubmit.disabled = !(isValidCode && isValidDiscount && isValidDate && isChanged);
    }

    inputCode.addEventListener('input', validateForm);
    inputDiscount.addEventListener('input', validateForm);
    inputDesc.addEventListener('input', validateForm);

    btnShow.addEventListener('click', () => {
        currentEditingId = null;
        originalPromoData = null;
        inputCode.value = '';
        inputDiscount.value = '20';
        inputDesc.value = '';
        
        if (checkboxFlashSale) {
            checkboxFlashSale.checked = false;
            dateGroup.style.display = 'none';
            inputEndDate.required = false;
            inputEndDate.value = '';
        }

        modalTitle.innerHTML = '<i class="fa-solid fa-gift"></i> Tạo mã ưu đãi mới';
        btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> Tạo mã';

        validateForm();
        modal.classList.add('show');
        setTimeout(() => inputCode.focus(), 100);
    });

    btnCloseX.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    btnSubmit.addEventListener('click', async () => {
        const code = inputCode.value.trim().toUpperCase();
        const discount = inputDiscount.value;
        const description = inputDesc.value.trim();

        const isFlashSale = checkboxFlashSale ? checkboxFlashSale.checked : false;
        const endDateVal = inputEndDate ? inputEndDate.value : null;

        const payload = { 
            Code: code, 
            DiscountPercent: parseInt(discount), 
            Description: description,
            IsFlashSale: isFlashSale,
            NgayHetHan: endDateVal ? new Date(endDateVal).toISOString() : null
        };

        if (!code || !discount || (isFlashSale && !endDateVal)) {
            showToast('error', 'Vui lòng điền đủ thông tin');
            return;
        }

        const originalText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
        btnSubmit.disabled = true;

        try {
            const token = getToken();
            let url = `${API_URL}/admin/promos`;
            let method = 'POST';

            if (currentEditingId) {
                url = `${API_URL}/admin/promos/${currentEditingId}`;
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
                showToast('success', currentEditingId ? 'Cập nhật thành công' : 'Tạo mã thành công');
                closeModal();
                fetchPromos();
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

async function togglePromo(id) {
    try {
        const token = getToken();
        const res = await fetch(`${API_URL}/admin/promos/${id}/toggle`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            showToast('success', 'Đã cập nhật trạng thái');
            fetchPromos();
        } else {
            showToast('error', 'Lỗi cập nhật');
        }
    } catch (err) {
        showToast('error', 'Lỗi kết nối');
    }
}

async function deletePromo(id) {
    const confirmResult = await Swal.fire({
        title: 'Xóa vĩnh viễn?',
        html: 'Bạn có chắc chắn muốn xóa mã ưu đãi này không?<br><br><span style="color:var(--danger)">Cảnh báo: Hành động này không thể hoàn tác!</span>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xóa',
        confirmButtonColor: '#EF4444',
        cancelButtonText: 'Hủy'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        const token = getToken();
        const res = await fetch(`${API_URL}/admin/promos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            showToast('success', 'Đã xóa mã');
            fetchPromos();
        } else {
            showToast('error', 'Lỗi xóa mã');
        }
    } catch (err) {
        showToast('error', 'Lỗi kết nối');
    }
}
