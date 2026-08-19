import { renderBreadcrumb } from '../shared/utils.js';
import { API_URL } from "../shared/config.js";
import { getToken, showToast, getAssetUrl, escapeHTML, renderPagination, showExportColumnPicker } from "../shared/utils.js";

let currentStatus = 'ChoDuyet';
let currentPage = 1;
const limit = 10;

document.addEventListener("DOMContentLoaded", () => {
    renderBreadcrumb([{ name: 'Trang chủ Admin', url: 'adminDashboard.html' }, { name: 'Thanh toán' }]);

    setupTabs();
    fetchCounts();
    fetchTransactions();

    const btnExport = document.getElementById('btn-export-csv');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const columnsDef = [
                { id: 'MaGD', label: 'Mã GD' },
                { id: 'NguoiDung', label: 'Người Dùng' },
                { id: 'Email', label: 'Email' },
                { id: 'SoTien', label: 'Số Tiền (VNĐ)' },
                { id: 'SoXu', label: 'Số Xu' },
                { id: 'KhuyenMai', label: 'Khuyến Mãi' },
                { id: 'NgayTao', label: 'Ngày Tạo' },
                { id: 'NgayDuyet', label: 'Ngày Duyệt' },
                { id: 'TrangThai', label: 'Trạng Thái' }
            ];

            showExportColumnPicker(columnsDef, async (selectedCols) => {
                const token = getToken();
                try {
                    btnExport.disabled = true;
                    btnExport.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Đang xuất...';

                    const colsParam = selectedCols.join(',');
                    const response = await fetch(`${API_URL}/payment/export/history?cols=${colsParam}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!response.ok) {
                        const data = await response.json();
                        throw new Error(data.message || 'Lỗi khi tải báo cáo');
                    }

                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'lich-su-nap-xu.csv';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                } catch (err) {
                    showToast(err.message, 'error');
                } finally {
                    btnExport.disabled = false;
                    btnExport.innerHTML = '<i class="fa-solid fa-file-csv" style="margin-right: 6px;"></i> Xuất CSV';
                }
            });
        });
    }
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelector('.tab-item.active').classList.remove('active');
            tab.classList.add('active');
            currentStatus = tab.dataset.status;
            currentPage = 1;
            fetchTransactions();
        });
    });
}

async function fetchCounts() {
    const token = getToken();
    try {
        const response = await fetch(`${API_URL}/payment/transactions/counts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            document.getElementById('pending-count-tab').textContent = data.ChoDuyet || 0;
            document.getElementById('approved-count-tab').textContent = data.DaDuyet || 0;
            document.getElementById('rejected-count-tab').textContent = data.TuChoi || 0;
        }
    } catch (e) {
        console.error(e);
    }
}

async function fetchTransactions() {
    const token = getToken();
    try {
        const response = await fetch(`${API_URL}/payment/transactions?status=${currentStatus}&page=${currentPage}&limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Failed to fetch transactions");

        const data = await response.json();
        renderTransactions(data.data || []);

        if (data.pagination) {
            renderPagination('payment-pagination', data.pagination.totalPages, currentPage, (page) => {
                currentPage = page;
                fetchTransactions();
            });
        }
    } catch (error) {
        console.error(error);
        showToast("error", "Lỗi khi tải danh sách giao dịch.");
    }
}

function renderTransactions(transactions) {
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px;">Không có giao dịch nào.</td></tr>`;
        return;
    }

    transactions.forEach((tx, index) => {
        const tr = document.createElement("tr");

        const d = new Date(tx.NgayTao);
        const date = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} | ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

        let statusHtml = '';
        if (tx.TrangThai === 'ChoDuyet') statusHtml = `<div style="display:inline-flex;align-items:center;gap:6px;color:#f59e0b;font-weight:500;"><div style="width:8px;height:8px;border-radius:50%;background:#f59e0b;"></div>Chờ duyệt</div>`;
        if (tx.TrangThai === 'DaDuyet') statusHtml = `<div style="display:inline-flex;align-items:center;gap:6px;color:#10b981;font-weight:500;"><div style="width:8px;height:8px;border-radius:50%;background:#10b981;"></div>Đã duyệt</div>`;
        if (tx.TrangThai === 'TuChoi') statusHtml = `<div style="display:inline-flex;align-items:center;gap:6px;color:#ef4444;font-weight:500;"><div style="width:8px;height:8px;border-radius:50%;background:#ef4444;"></div>Từ chối</div>`;

        let actionHtml = '';
        if (tx.TrangThai === 'ChoDuyet') {
            actionHtml = `
                <button class="btn-reject" data-id="${tx.MaGD}" title="Từ chối" style="background:#ef4444; color:white; border:none; width:32px; height:32px; border-radius:4px; cursor:pointer; margin-right:4px; display:inline-flex; align-items:center; justify-content:center;"><i class="fa-solid fa-xmark"></i></button>
                <button class="btn-approve" data-id="${tx.MaGD}" title="Duyệt" style="background:#10b981; color:white; border:none; width:32px; height:32px; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;"><i class="fa-solid fa-check"></i></button>
            `;
        } else if (tx.TrangThai === 'TuChoi') {
            actionHtml = `
                <button class="btn-delete" data-id="${tx.MaGD}" title="Xóa" style="background:#64748b; color:white; border:none; width:32px; height:32px; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;"><i class="fa-solid fa-trash"></i></button>
            `;
        }

        const initial = tx.HoTen ? tx.HoTen.trim().split(' ').pop().charAt(0).toUpperCase() : '?';
        let avatarHtml = `<div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary-light); color: var(--secondary); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; flex-shrink: 0;">${escapeHTML(initial)}</div>`;
        if (tx.AvatarURL && tx.AvatarURL !== 'null') {
            avatarHtml = `<img src="${escapeHTML(getAssetUrl(tx.AvatarURL))}" alt="${escapeHTML(tx.HoTen)}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />`;
        }

        tr.innerHTML = `
            <td style="text-align: center; font-weight: bold; color: var(--text-secondary);" data-label="STT">${index + 1}</td>
            <td data-label="Người nạp">
                <div style="display:flex;align-items:center;gap:12px;">
                    ${avatarHtml}
                    <div>
                        <div><strong>${tx.HoTen}</strong></div>
                    </div>
                </div>
            </td>
            <td data-label="Số tiền / Xu">
                <div style="color:#ef4444; font-weight:600;"><i class="fa-solid fa-money-bill-wave" style="margin-right:6px;"></i> ${tx.SoTien.toLocaleString('vi-VN')} đ</div>
                <div style="color:#f59e0b; font-size:13px; font-weight:600;"><i class="fa-solid fa-coins" style="margin-right:9px;"></i> ${tx.SoXu.toLocaleString('vi-VN')} Xu</div>
            </td>
            <td data-label="Ngày tạo">${date}</td>
            <td data-label="Trạng thái">${statusHtml}</td>
            <td style="text-align: right;" data-label="Thao tác">${actionHtml}</td>
        `;

        if (tx.TrangThai === 'ChoDuyet') {
            tr.querySelector('.btn-approve').addEventListener('click', () => handleApprove(tx.MaGD));
            tr.querySelector('.btn-reject').addEventListener('click', () => handleReject(tx.MaGD));
        } else if (tx.TrangThai === 'TuChoi') {
            tr.querySelector('.btn-delete').addEventListener('click', () => handleDelete(tx.MaGD));
        }

        tbody.appendChild(tr);
    });
}

async function handleApprove(id) {
    const confirm = await Swal.fire({
        title: 'Xác nhận duyệt',
        text: 'Bạn có chắc chắn đã nhận được tiền và muốn cộng xu cho người dùng này?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Duyệt',
        cancelButtonText: 'Hủy'
    });

    if (!confirm.isConfirmed) return;

    const token = getToken();
    try {
        const response = await fetch(`${API_URL}/payment/approve/${id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (response.ok) {
            showToast("success", "Đã duyệt giao dịch thành công.");
            fetchCounts();
            fetchTransactions();
        } else {
            showToast("error", data.message || "Lỗi khi duyệt.");
        }
    } catch (e) {
        console.error(e);
        showToast("error", "Lỗi kết nối.");
    }
}

async function handleReject(id) {
    const confirm = await Swal.fire({
        title: 'Từ chối giao dịch',
        text: 'Bạn có chắc chắn muốn hủy bỏ giao dịch nạp xu này?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Từ chối',
        cancelButtonText: 'Đóng'
    });

    if (!confirm.isConfirmed) return;

    const token = getToken();
    try {
        const response = await fetch(`${API_URL}/payment/reject/${id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (response.ok) {
            showToast("success", "Đã từ chối giao dịch.");
            fetchCounts();
            fetchTransactions();
        } else {
            showToast("error", data.message || "Lỗi khi từ chối.");
        }
    } catch (e) {
        console.error(e);
        showToast("error", "Lỗi kết nối.");
    }
}

async function handleDelete(id) {
    const confirm = await Swal.fire({
        title: 'Xóa giao dịch',
        text: 'Bạn có chắc chắn muốn xóa vĩnh viễn giao dịch nạp xu đã từ chối này?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Đóng',
        confirmButtonColor: '#ef4444'
    });

    if (!confirm.isConfirmed) return;

    const token = getToken();
    try {
        const response = await fetch(`${API_URL}/payment/delete/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (response.ok) {
            showToast("success", "Đã xóa giao dịch.");
            fetchCounts();
            fetchTransactions();
        } else {
            showToast("error", data.message || "Lỗi khi xóa.");
        }
    } catch (e) {
        console.error(e);
        showToast("error", "Lỗi kết nối.");
    }
}

