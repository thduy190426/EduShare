import { renderBreadcrumb } from '../shared/utils.js';
import { API_URL } from '../shared/config.js';
import { getAssetUrl, getToken, showToast, renderPagination, escapeHTML } from '../shared/utils.js';

const token = getToken();
let currentPage = 1;
const limit = 10;
let currentSortBy = 'NgayBaoCao';
let currentOrder = 'DESC';
let currentStatus = 'ChoXuLy';

async function readErrorMessage(res, fallback) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        const data = await res.json();
        return data.message || fallback;
    }
    return fallback;
}

document.addEventListener('DOMContentLoaded', () => {
    renderBreadcrumb([{ name: 'Trang chủ Admin', url: 'adminDashboard.html' }, { name: 'Báo cáo vi phạm' }]);

    if (!token) {
        Swal.fire('Vui lòng đăng nhập.');
        window.location.href = '../guest/guestHome.html';
        return;
    }

    const tabItems = document.querySelectorAll('.tab-item');
    tabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            tabItems.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentStatus = tab.getAttribute('data-status');
            currentPage = 1;
            fetchReports();
        });
    });

    fetchCounts();
    fetchReports();

    const sortHeaders = document.querySelectorAll('th.sortable');
    sortHeaders.forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.getAttribute('data-sort');
            if (currentSortBy === sortKey) {
                currentOrder = currentOrder === 'DESC' ? 'ASC' : 'DESC';
            } else {
                currentSortBy = sortKey;
                currentOrder = 'ASC';
            }

            sortHeaders.forEach(header => {
                const icon = header.querySelector('.fa-sort, .fa-sort-up, .fa-sort-down');
                if (icon) {
                    icon.className = 'fa-solid fa-sort sort-icon';
                    icon.style.color = '#9ca3af';
                }
            });

            const activeIcon = th.querySelector('.sort-icon, .fa-sort, .fa-sort-up, .fa-sort-down');
            if (activeIcon) {
                activeIcon.className = currentOrder === 'ASC' ? 'fa-solid fa-sort-up sort-icon' : 'fa-solid fa-sort-down sort-icon';
                activeIcon.style.color = 'var(--primary)';
            }

            fetchReports();
        });
    });

    const selectAllReports = document.getElementById("selectAllReports");
    if (selectAllReports) {
        selectAllReports.addEventListener("change", (e) => {
            const checkboxes = document.querySelectorAll(".report-checkbox");
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
            });
            updateBulkToolbar();
        });
    }

    const btnBulkViolation = document.getElementById("btn-bulk-violation");
    if (btnBulkViolation) {
        btnBulkViolation.addEventListener("click", async () => {
            const selectedIds = getSelectedReportIds();
            if (selectedIds.length === 0) return;
            if ((await Swal.fire({ title: "Xác nhận hàng loạt", html: `Bạn có chắc chắn muốn xử lý vi phạm (gỡ) <b>${selectedIds.length}</b> tài liệu đã bị báo cáo?`, icon: "warning", showCancelButton: true, confirmButtonText: "Đồng ý", cancelButtonText: "Hủy" })).isConfirmed) {
                reviewBulkReports(selectedIds, "ViPham");
            }
        });
    }

    const btnBulkReject = document.getElementById("btn-bulk-reject");
    if (btnBulkReject) {
        btnBulkReject.addEventListener("click", async () => {
            const selectedIds = getSelectedReportIds();
            if (selectedIds.length === 0) return;
            if ((await Swal.fire({ title: "Xác nhận hàng loạt", html: `Bạn có chắc chắn muốn từ chối (bỏ qua) <b>${selectedIds.length}</b> báo cáo này?`, icon: "info", showCancelButton: true, confirmButtonText: "Đồng ý", cancelButtonText: "Hủy" })).isConfirmed) {
                reviewBulkReports(selectedIds, "TuChoi");
            }
        });
    }

    const btnBulkDelete = document.getElementById("btn-bulk-delete");
    if (btnBulkDelete) {
        btnBulkDelete.addEventListener("click", async () => {
            const selectedIds = getSelectedReportIds();
            if (selectedIds.length === 0) return;
            if ((await Swal.fire({ title: "Xác nhận xóa hàng loạt", html: `Bạn có chắc chắn muốn xóa vĩnh viễn <b>${selectedIds.length}</b> báo cáo này không?`, icon: "warning", showCancelButton: true, confirmButtonText: "Đồng ý", cancelButtonText: "Hủy" })).isConfirmed) {
                deleteBulkReports(selectedIds);
            }
        });
    }
});

function getSelectedReportIds() {
    const checkboxes = document.querySelectorAll(".report-checkbox:checked");
    return Array.from(checkboxes).map(cb => cb.value);
}

function updateBulkToolbar() {
    const selectedIds = getSelectedReportIds();
    const toolbar = document.getElementById("bulk-actions-toolbar");
    const countSpan = document.getElementById("bulk-selected-count");
    if (selectedIds.length > 0) {
        toolbar.style.display = "flex";
        countSpan.textContent = selectedIds.length;
    } else {
        toolbar.style.display = "none";
    }
}

async function fetchCounts() {
    try {
        const response = await fetch(`${API_URL}/admin/reports/counts`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
            const counts = await response.json();
            const pendingCountTab = document.getElementById("pending-count-tab");
            const approvedCountTab = document.getElementById("approved-count-tab");
            const rejectedCountTab = document.getElementById("rejected-count-tab");

            if (pendingCountTab) pendingCountTab.textContent = counts.ChoXuLy || 0;
            if (approvedCountTab) approvedCountTab.textContent = counts.DaXuLy || 0;
            if (rejectedCountTab) rejectedCountTab.textContent = counts.TuChoi || 0;
        }
    } catch (error) {
        console.error("Lỗi khi tải số lượng báo cáo:", error);
    }
}

async function fetchReports() {
    try {
        const res = await fetch(`${API_URL}/admin/reports?page=${currentPage}&limit=${limit}&sortBy=${currentSortBy}&order=${currentOrder}&status=${currentStatus}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 403) {
            Swal.fire('Bạn không có quyền truy cập trang này.');
            window.location.href = '../guest/guestHome.html';
            return;
        }

        const data = await res.json();
        renderReports(data.data || []);

        if (data.pagination) {
            renderPagination('report-pagination', data.pagination.totalPages, currentPage, (page) => {
                currentPage = page;
                fetchReports();
            });
        }
    } catch (err) {
        console.error(err);
    }
}

function renderReports(reports) {
    const tbody = document.getElementById('report-list');
    tbody.innerHTML = '';

    updateBulkToolbar();

    if (reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Không có báo cáo nào.</td></tr>';
        return;
    }

    reports.forEach((report, index) => {
        const tr = document.createElement('tr');

        const d = new Date(report.NgayBaoCao);
        const timeStr = d.toLocaleTimeString('vi-VN');
        const dateStrFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;

        const initial = report.NguoiBaoCao ? report.NguoiBaoCao.trim().split(' ').pop().charAt(0).toUpperCase() : '?';
        const avatarHtml = report.AvatarNguoiBaoCao && report.AvatarNguoiBaoCao !== 'null'
            ? `<img src="${getAssetUrl(report.AvatarNguoiBaoCao)}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;" onerror="this.onerror=null; this.outerHTML='<div style=\\'width: 28px; height: 28px; border-radius: 50%; background: #EFF6FF; color: #2563EB; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;\\'>${initial}</div>';">`
            : `<div style="width: 28px; height: 28px; border-radius: 50%; background: #EFF6FF; color: #2563EB; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;">${initial}</div>`;

        let statusBadge = '';
        if (report.TrangThai === 'ChoXuLy') statusBadge = '<div style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:var(--warning);"></span><span style="color:var(--warning); font-size:14px; font-weight:600;">Chờ xử lý</span></div>';
        else if (report.TrangThai === 'DaXuLy') statusBadge = '<div style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:var(--success);"></span><span style="color:var(--success); font-size:14px; font-weight:600;">Đã xử lý (Xóa TL)</span></div>';
        else statusBadge = '<div style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:var(--text-secondary);"></span><span style="color:var(--text-secondary); font-size:14px; font-weight:600;">Đã từ chối</span></div>';

        let actionHtml = '';
        if (report.TrangThai === 'ChoXuLy') {
            actionHtml = `
                <div style="display:flex; gap:6px;">
                    <button class="btn-action" style="background:#f1f5f9; color:#475569; padding:4px 8px; border:none; border-radius:4px; cursor:pointer;" onclick="window.open('../document/documentDetails.html?id=${report.MaTL}', '_blank')" title="Xem tài liệu"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn-action" style="background:#fef2f2; color:#ef4444; padding:4px 8px; border:none; border-radius:4px; cursor:pointer;" onclick="reviewReport(${report.MaBC}, 'ViPham')" title="Gỡ tài liệu"><i class="fa-solid fa-ban"></i></button>
                    <button class="btn-action" style="background:#f9fafb; border: 1px solid var(--border); color:var(--text-secondary); padding:4px 8px; border-radius:4px; cursor:pointer;" onclick="reviewReport(${report.MaBC}, 'TuChoi')" title="Từ chối báo cáo"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `;
        } else {
             actionHtml = `
                <div style="display:flex; gap:6px;">
                    <button class="btn-action" style="background:#f1f5f9; color:#475569; padding:4px 8px; border:none; border-radius:4px; cursor:pointer;" onclick="window.open('../document/documentDetails.html?id=${report.MaTL}', '_blank')" title="Xem tài liệu"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn-action" style="background:#fef2f2; color:#ef4444; padding:4px 8px; border:none; border-radius:4px; cursor:pointer;" onclick="deleteReport(${report.MaBC})" title="Xóa báo cáo"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
        }

        tr.innerHTML = `
            <td style="text-align: center;" data-label="">
                <input type="checkbox" class="report-checkbox" value="${report.MaBC}" style="cursor: pointer;">
            </td>
            <td style="text-align: center; font-weight: bold; color: var(--text-secondary);" data-label="STT">
                <span>${(currentPage - 1) * limit + index + 1}</span>
            </td>
            <td data-label="Người báo cáo">
                <div style="display:flex; align-items:center; flex-direction:row; gap:8px;">
                  ${avatarHtml}
                  <span style="font-weight:500; font-size:14px; max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${report.NguoiBaoCao}">${report.NguoiBaoCao}</span>
                </div>
            </td>
            <td data-label="Tài liệu vi phạm">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid fa-file-pdf" style="color: #DC2626; font-size: 1.2rem;"></i>
                    <div style="font-weight:600; color:var(--text-primary); max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${report.TenTL}">${report.TenTL}</div>
                </div>
            </td>
            <td data-label="Lý do chi tiết">
                <div style="font-size: 13px; color: var(--text-secondary); max-height: 40px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" title="${report.LyDo}">${report.LyDo}</div>
            </td>
            <td data-label="Ngày báo cáo">
                <div style="font-size:13px; color:var(--text-secondary);">
                    <div>${timeStr}</div>
                    <div>${dateStrFormatted}</div>
                </div>
            </td>
            <td data-label="Trạng thái">${statusBadge}</td>
            <td data-label="Thao tác">${actionHtml}</td>
        `;

        tbody.appendChild(tr);
    });

    const rowCheckboxes = tbody.querySelectorAll(".report-checkbox");
    rowCheckboxes.forEach(cb => {
        cb.addEventListener("change", () => {
            updateBulkToolbar();
            const allCheckboxes = tbody.querySelectorAll(".report-checkbox");
            const checkedCheckboxes = tbody.querySelectorAll(".report-checkbox:checked");
            const selectAllReports = document.getElementById("selectAllReports");
            if (selectAllReports) {
                selectAllReports.checked = allCheckboxes.length > 0 && allCheckboxes.length === checkedCheckboxes.length;
            }
        });
    });
}

window.reviewReport = async (maBC, quyetDinh) => {
    const actionText = quyetDinh === 'ViPham' ? 'GỠ TÀI LIỆU NÀY (Đánh dấu vi phạm)' : 'TỪ CHỐI BÁO CÁO (Bỏ qua)';
    if (!(await Swal.fire({ title: 'Xác nhận', text: `Bạn có chắc chắn muốn ${actionText}?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Đồng ý', cancelButtonText: 'Hủy' })).isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/admin/reports/${maBC}/review`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ quyetDinh })
        });
        if (res.ok) {
            showToast('success', 'Xử lý báo cáo thành công!');
            fetchReports();
            fetchCounts();
        } else {
            const message = await readErrorMessage(res, 'Không thể xử lý báo cáo.');
            showToast('error', message);
        }
    } catch (err) {
        console.error(err);
    }
};

window.deleteReport = async (maBC) => {
    if (!(await Swal.fire({ title: 'Xác nhận xóa', text: 'Bạn có chắc chắn muốn xóa vĩnh viễn báo cáo này không?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Đồng ý', cancelButtonText: 'Hủy' })).isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/admin/reports/${maBC}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (res.ok) {
            showToast('success', 'Đã xóa báo cáo thành công!');
            fetchReports();
            fetchCounts();
        } else {
            const message = await readErrorMessage(res, 'Không thể xóa báo cáo.');
            showToast('error', message);
        }
    } catch (err) {
        console.error(err);
        showToast('error', 'Lỗi hệ thống.');
    }
};

async function reviewBulkReports(reportIds, quyetDinh) {
    try {
        const res = await fetch(`${API_URL}/admin/reports/bulk-review`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ reportIds, quyetDinh }),
        });

        if (res.ok) {
            showToast("success", "Xử lý báo cáo hàng loạt thành công.");
            document.getElementById("selectAllReports").checked = false;
            fetchReports();
            fetchCounts();
        } else {
            const message = await readErrorMessage(res, "Có lỗi xảy ra khi xử lý.");
            showToast("error", message);
        }
    } catch (err) {
        console.error("Lỗi review bulk reports:", err);
        showToast("error", "Lỗi kết nối.");
    }
}

async function deleteBulkReports(reportIds) {
    try {
        const res = await fetch(`${API_URL}/admin/reports/bulk`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ reportIds }),
        });

        if (res.ok) {
            showToast("success", "Đã xóa hàng loạt báo cáo thành công.");
            document.getElementById("selectAllReports").checked = false;
            fetchReports();
            fetchCounts();
        } else {
            const message = await readErrorMessage(res, "Có lỗi xảy ra khi xóa.");
            showToast("error", message);
        }
    } catch (err) {
        console.error("Lỗi delete bulk reports:", err);
        showToast("error", "Lỗi kết nối.");
    }
}
