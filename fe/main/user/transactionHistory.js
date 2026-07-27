import { API_URL } from '../shared/config.js';
import { getToken, escapeHTML } from '../shared/utils.js';

let allTransactions = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 10;

document.addEventListener('DOMContentLoaded', async () => {
    const token = getToken();
    if (!token) {
        window.location.href = '../auth/login.html';
        return;
    }

    const btnExportExcel = document.getElementById('btn-export-excel');
    const btnExportPdf = document.getElementById('btn-export-pdf');

    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', exportToExcel);
    }
    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', exportToPDF);
    }

    await fetchTransactions(token);
});

async function fetchTransactions(token) {
    const listEl = document.getElementById('transaction-list');
    listEl.innerHTML = `
        <tr>
            <td colspan="4" class="empty-state">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>Đang tải dữ liệu...</p>
            </td>
        </tr>
    `;

    try {
        const res = await fetch(`${API_URL}/users/transactions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.ok) {
            const data = await res.json();
            allTransactions = data.transactions || [];
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

    if (!allTransactions || allTransactions.length === 0) {
        listEl.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <p>Bạn chưa có giao dịch nào.</p>
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
        'PhatXu': 'Phạt Xu'
    };

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentItems = allTransactions.slice(startIndex, endIndex);

    let html = '';
    currentItems.forEach(tx => {
        const dateObj = new Date(tx.NgayTao);
        const dateStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')} | ${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
        
        const typeLabel = typeMapping[tx.LoaiGiaoDich] || tx.LoaiGiaoDich;
        
        let amountClass = tx.SoXuThayDoi >= 0 ? 'positive' : 'negative';
        let amountText = tx.SoXuThayDoi >= 0 ? `+${tx.SoXuThayDoi}` : `${tx.SoXuThayDoi}`;

        html += `
            <tr>
                <td class="tx-date">${dateStr}</td>
                <td><span class="tx-type ${tx.LoaiGiaoDich}">${typeLabel}</span></td>
                <td><span class="tx-amount ${amountClass}">${amountText} Xu</span></td>
                <td class="tx-desc">${escapeHTML(tx.MoTa || '')}</td>
            </tr>
        `;
    });

    listEl.innerHTML = html;
    renderPagination();
}

function renderPagination() {
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;

    const totalPages = Math.ceil(allTransactions.length / ITEMS_PER_PAGE);

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let html = '';
    html += `<button class="btn-page ${currentPage === 1 ? 'disabled' : ''}" data-page="${currentPage - 1}">Trước</button>`;
    
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="btn-page ${currentPage === i ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    html += `<button class="btn-page ${currentPage === totalPages ? 'disabled' : ''}" data-page="${currentPage + 1}">Sau</button>`;

    paginationContainer.innerHTML = html;

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
    if (allTransactions.length === 0) {
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
        'PhatXu': 'Phạt Xu'
    };

    const data = allTransactions.map(tx => {
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
    if (allTransactions.length === 0) {
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
                ${allTransactions.map(tx => {
                    const d = new Date(tx.NgayTao);
                    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    
                    const typeMapping = {
                        'NapXu': 'Nạp Xu',
                        'MuaTaiLieu': 'Mua Tài Liệu',
                        'BanTaiLieu': 'Bán Tài Liệu',
                        'TruXuAdmin': 'Admin Trừ Xu',
                        'ThuongXu': 'Thưởng Xu',
                        'HoanXu': 'Hoàn Xu',
                        'PhatXu': 'Phạt Xu'
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
