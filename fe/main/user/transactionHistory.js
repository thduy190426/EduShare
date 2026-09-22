import { renderBreadcrumb } from '../shared/utils.js';
import { API_URL } from '../shared/config.js';
import { getToken, escapeHTML, renderTableSkeleton } from '../shared/utils.js';
import { makeAdminTablesResizableAndSticky } from '../admin/adminTableUtils.js';

let allTransactions = [];
let filteredTransactions = [];
let currentPage = 1;
let isFilterApplied = false;
const ITEMS_PER_PAGE = 10;

function updateFilterButtonsState() {
    const startDateVal = document.getElementById('filter-start-date')?.value;
    const endDateVal = document.getElementById('filter-end-date')?.value;
    const hasInput = !!(startDateVal || endDateVal);
    
    const btnFilter = document.getElementById('btn-filter');
    const btnResetFilter = document.getElementById('btn-reset-filter');
    
    if (btnFilter) {
        btnFilter.disabled = !hasInput;
        btnFilter.style.opacity = btnFilter.disabled ? '0.5' : '1';
        btnFilter.style.cursor = btnFilter.disabled ? 'not-allowed' : 'pointer';
    }
    if (btnResetFilter) {
        btnResetFilter.disabled = !hasInput && !isFilterApplied;
        btnResetFilter.style.opacity = btnResetFilter.disabled ? '0.5' : '1';
        btnResetFilter.style.cursor = btnResetFilter.disabled ? 'not-allowed' : 'pointer';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    makeAdminTablesResizableAndSticky();
    renderBreadcrumb([{ name: 'Trang chủ', url: 'userHome.html' }, { name: 'Lịch sử giao dịch' }]);
    const token = getToken();
    if (!token) {
        window.location.href = '../auth/login.html';
        return;
    }

    const btnExportExcel = document.getElementById('btn-export-excel');
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const btnFilter = document.getElementById('btn-filter');
    const btnResetFilter = document.getElementById('btn-reset-filter');

    const filterStartDate = document.getElementById('filter-start-date');
    const filterEndDate = document.getElementById('filter-end-date');
    
    if (filterStartDate) {
        filterStartDate.addEventListener('change', updateFilterButtonsState);
        filterStartDate.addEventListener('input', updateFilterButtonsState);
    }
    if (filterEndDate) {
        filterEndDate.addEventListener('change', updateFilterButtonsState);
        filterEndDate.addEventListener('input', updateFilterButtonsState);
    }

    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', exportToExcel);
    }
    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', exportToPDF);
    }
    if (btnFilter) {
        btnFilter.addEventListener('click', applyDateFilter);
    }
    if (btnResetFilter) {
        btnResetFilter.addEventListener('click', resetDateFilter);
    }

    updateFilterButtonsState();
    await fetchTransactions(token);
});

async function fetchTransactions(token) {
    const listEl = document.getElementById('transaction-list');
    listEl.innerHTML = renderTableSkeleton(4, 5);

    try {
        const res = await fetch(`${API_URL}/users/transactions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.ok) {
            const data = await res.json();
            allTransactions = data.transactions || [];
            filteredTransactions = [...allTransactions];
            currentPage = 1;
            renderTransactions();
        } else {
            const err = await res.json();
            Swal.fire('Lỗi', err.message || 'Không thể lấy lịch sử giao dịch.', 'error');
            listEl.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <i class="fa-solid fa-triangle-exclamation text-danger"></i>
                        <p>Đã xảy ra lỗi khi tải dữ liệu.</p>
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error(err);
        listEl.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <i class="fa-solid fa-triangle-exclamation text-danger"></i>
                    <p>Mất kết nối máy chủ.</p>
                </td>
            </tr>
        `;
    }
}

function renderTransactions() {
    const listEl = document.getElementById('transaction-list');
    const paginationContainer = document.getElementById('pagination-container');

    if (!filteredTransactions || filteredTransactions.length === 0) {
        listEl.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <p>Không có giao dịch nào phù hợp.</p>
                </td>
            </tr>
        `;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const typeMapping = {
        'NapXu': 'Nạp Xu',
        'MuaTaiLieu': 'Mua Tài Liệu',
        'BanTaiLieu': 'Bán Tài Liệu',
        'TruXuAdmin': 'Admin Trừ Xu',
        'ThuongXu': 'Thưởng Xu',
        'HoanXu': 'Hoàn Xu',
        'PhatXu': 'Phạt Xu',
        'TangXu': 'Tặng Xu',
        'NhanXu': 'Nhận Xu'
    };

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentItems = filteredTransactions.slice(startIndex, endIndex);

    let html = '';
    currentItems.forEach(tx => {
        const dateObj = new Date(tx.NgayTao);
        const dateStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')} | ${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;

        const typeLabel = typeMapping[tx.LoaiGiaoDich] || tx.LoaiGiaoDich;

        let amountClass = tx.SoXuThayDoi >= 0 ? 'positive' : 'negative';
        let amountText = tx.SoXuThayDoi >= 0 ? `+${tx.SoXuThayDoi}` : `${tx.SoXuThayDoi}`;

        html += `
            <tr>
                <td class="tx-date" data-label="Thời gian">${dateStr}</td>
                <td data-label="Loại giao dịch"><span class="tx-type ${tx.LoaiGiaoDich}">${typeLabel}</span></td>
                <td data-label="Số dư thay đổi"><span class="tx-amount ${amountClass}">${amountText} Xu</span></td>
                <td class="tx-desc" data-label="Mô tả chi tiết">${escapeHTML(tx.MoTa || '')}</td>
            </tr>
        `;
    });

    listEl.innerHTML = html;
    renderPagination();
}

function renderPagination() {
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;

    const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));

    let html = '';
    html += `<button class="btn-page ${currentPage === 1 ? 'disabled' : ''}" data-page="${currentPage - 1}">Trước</button>`;

    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="btn-page ${currentPage === i ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    html += `<button class="btn-page ${currentPage === totalPages ? 'disabled' : ''}" data-page="${currentPage + 1}">Sau</button>`;

    paginationContainer.innerHTML = html;
    paginationContainer.style.display = 'flex';
    paginationContainer.style.justifyContent = 'center';
    paginationContainer.style.alignItems = 'center';
    paginationContainer.style.gap = '8px';
    paginationContainer.style.marginTop = '20px';

    const pageButtons = paginationContainer.querySelectorAll('.btn-page:not(.disabled)');
    pageButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newPage = parseInt(e.target.getAttribute('data-page'));
            if (newPage >= 1 && newPage <= totalPages) {
                currentPage = newPage;
                renderTransactions();
            }
        });
    });
}

function exportToExcel() {
    if (filteredTransactions.length === 0) {
        Swal.fire('Thông báo', 'Không có dữ liệu để xuất', 'info');
        return;
    }
    const typeMapping = {
        'NapXu': 'Nạp Xu',
        'MuaTaiLieu': 'Mua Tài Liệu',
        'BanTaiLieu': 'Bán Tài Liệu',
        'TruXuAdmin': 'Admin Trừ Xu',
        'ThuongXu': 'Thưởng Xu',
        'HoanXu': 'Hoàn Xu',
        'PhatXu': 'Phạt Xu',
        'TangXu': 'Tặng Xu',
        'NhanXu': 'Nhận Xu'
    };

    const data = filteredTransactions.map(tx => {
        const d = new Date(tx.NgayTao);
        const typeLabel = typeMapping[tx.LoaiGiaoDich] || tx.LoaiGiaoDich;

        return {
            "Thời gian": `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
            "Loại giao dịch": typeLabel,
            "Số dư thay đổi (Xu)": tx.SoXuThayDoi,
            "Mô tả chi tiết": tx.MoTa
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lịch sử giao dịch");
    XLSX.writeFile(wb, "LichSuGiaoDich.xlsx");
}

function exportToPDF() {
    if (filteredTransactions.length === 0) {
        Swal.fire('Thông báo', 'Không có dữ liệu để xuất', 'info');
        return;
    }

    const div = document.createElement('div');
    div.style.padding = '20px';
    div.innerHTML = `
        <h2 style="text-align: center; font-family: sans-serif; color: #1e293b;">LỊCH SỬ GIAO DỊCH EDUCOIN</h2>
        <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; margin-top: 20px; font-size: 14px;">
            <thead>
                <tr>
                    <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; background: #f8fafc; color: #475569;">Thời gian</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; background: #f8fafc; color: #475569;">Loại giao dịch</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; background: #f8fafc; color: #475569;">Số dư thay đổi</th>
                    <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; background: #f8fafc; color: #475569;">Mô tả chi tiết</th>
                </tr>
            </thead>
            <tbody>
                ${filteredTransactions.map(tx => {
                    const d = new Date(tx.NgayTao);
                    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

                    const typeMapping = {
                        'NapXu': 'Nạp Xu',
                        'MuaTaiLieu': 'Mua Tài Liệu',
                        'BanTaiLieu': 'Bán Tài Liệu',
                        'TruXuAdmin': 'Admin Trừ Xu',
                        'ThuongXu': 'Thưởng Xu',
                        'HoanXu': 'Hoàn Xu',
                        'PhatXu': 'Phạt Xu',
                        'TangXu': 'Tặng Xu',
                        'NhanXu': 'Nhận Xu'
                    };
                    const typeLabel = typeMapping[tx.LoaiGiaoDich] || tx.LoaiGiaoDich;

                    const amountStr = tx.SoXuThayDoi > 0 ? `+${tx.SoXuThayDoi}` : `${tx.SoXuThayDoi}`;
                    const amountColor = tx.SoXuThayDoi > 0 ? '#10B981' : '#EF4444';

                    return `
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 10px; color: #334155;">${dateStr}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 10px; color: #334155;">${typeLabel}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; color: ${amountColor}; font-weight: bold;">${amountStr} Xu</td>
                            <td style="border: 1px solid #cbd5e1; padding: 10px; color: #334155;">${escapeHTML(tx.MoTa || '')}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    const opt = {
        margin:       0.5,
        filename:     'LichSuGiaoDich.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    Swal.fire({
        title: 'Đang xuất file',
        text: 'Vui lòng chờ trong giây lát...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    html2pdf().set(opt).from(div).save().then(() => {
        Swal.close();
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Đã xuất PDF thành công',
            showConfirmButton: false,
            timer: 3000
        });
    });
}

function applyDateFilter() {
    const startDateVal = document.getElementById('filter-start-date').value;
    const endDateVal = document.getElementById('filter-end-date').value;

    if (!startDateVal && !endDateVal) {
        filteredTransactions = [...allTransactions];
        isFilterApplied = false;
    } else {
        isFilterApplied = true;
        filteredTransactions = allTransactions.filter(tx => {
            const txDate = new Date(tx.NgayTao);
            txDate.setHours(0, 0, 0, 0);

            let isAfterStart = true;
            let isBeforeEnd = true;

            if (startDateVal) {
                const startDate = new Date(startDateVal);
                startDate.setHours(0, 0, 0, 0);
                isAfterStart = txDate >= startDate;
            }

            if (endDateVal) {
                const endDate = new Date(endDateVal);
                endDate.setHours(23, 59, 59, 999);
                isBeforeEnd = txDate <= endDate;
            }

            return isAfterStart && isBeforeEnd;
        });
    }

    currentPage = 1;
    renderTransactions();
    updateFilterButtonsState();
}

function resetDateFilter() {
    document.getElementById('filter-start-date').value = '';
    document.getElementById('filter-end-date').value = '';
    filteredTransactions = [...allTransactions];
    currentPage = 1;
    isFilterApplied = false;
    renderTransactions();
    updateFilterButtonsState();
}

renderBreadcrumb([{ name: 'Trang chủ', url: 'userHome.html' }, { name: 'Lịch sử giao dịch' }]);
