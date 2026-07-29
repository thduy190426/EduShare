import { API_URL } from "../shared/config.js";
import { getToken, showToast, renderPagination, getAssetUrl, escapeHTML } from "../shared/utils.js";

document.addEventListener("DOMContentLoaded", () => {
    fetchRequests();
    setupModals();
});

let currentRequests = [];
let currentPage = 1;
const limit = 10;

async function fetchRequests() {
    const token = getToken();
    try {
        const response = await fetch(`${API_URL}/admin/teacher-requests?page=${currentPage}&limit=${limit}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Failed to fetch requests");
        
        const data = await response.json();
        currentRequests = data.data || [];
        renderRequests(currentRequests);
        
        if (data.pagination) {
            renderPagination('teacher-pagination', data.pagination.totalPages, currentPage, (page) => {
                currentPage = page;
                fetchRequests();
            });
        }
    } catch (error) {
        console.error(error);
        showToast("error", "Lỗi khi tải danh sách yêu cầu.");
    }
}

function renderRequests(requests) {
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";

    if (requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px;">Không có yêu cầu nào.</td></tr>`;
        return;
    }

    requests.forEach((req, index) => {
        const tr = document.createElement("tr");
        
        const d = new Date(req.NgayTao);
        const date = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")} | ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        
        let statusHtml = "";
        if (req.TrangThai === "ChoDuyet") statusHtml = `<div style="display: flex; align-items: center; gap: 6px;"><div style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b;"></div><span style="color:#f59e0b; font-weight: 500;">Chờ duyệt</span></div>`;
        if (req.TrangThai === "DaDuyet") statusHtml = `<div style="display: flex; align-items: center; gap: 6px;"><div style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></div><span style="color:#10b981; font-weight: 500;">Đã duyệt</span></div>`;
        if (req.TrangThai === "TuChoi") statusHtml = `<div style="display: flex; align-items: center; gap: 6px;"><div style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444;"></div><span style="color:#ef4444; font-weight: 500;">Từ chối</span></div><div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${req.LyDoTuChoi || ""}</div>`;

        let actionHtml = "";
        if (req.TrangThai === "ChoDuyet") {
            actionHtml = `
                <button class="btn-approve" title="Duyệt" style="background:#10b981; color:white; border:none; width:32px; height:32px; border-radius:4px; cursor:pointer; margin-right:4px;"><i class="fa-solid fa-check"></i></button>
                <button class="btn-reject" title="Từ chối" style="background:#ef4444; color:white; border:none; width:32px; height:32px; border-radius:4px; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
            `;
        }

        tr.innerHTML = `
            <td style="text-align: center; font-weight: bold; color: var(--text-secondary);">${index + 1}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${req.AvatarURL && req.AvatarURL !== 'null'
                        ? `<img src="${escapeHTML(getAssetUrl(req.AvatarURL))}" alt="${escapeHTML(req.HoTen)}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border);" onerror="this.onerror=null; this.outerHTML='<div style=\\'width:36px;height:36px;border-radius:50%;background:var(--primary-light);color:var(--secondary);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px;\\'>${escapeHTML(req.HoTen.trim().split(' ').pop().charAt(0).toUpperCase())}</div>';">`
                        : `<div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary-light); color: var(--secondary); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px;">${escapeHTML(req.HoTen.trim().split(' ').pop().charAt(0).toUpperCase())}</div>`
                    }
                    <div>
                        <div style="font-weight: 500; color: var(--text-primary);">${req.HoTen}</div>
                        <div style="font-size: 13px; color: var(--text-secondary);">${req.Email}</div>
                    </div>
                </div>
            </td>
            <td>${date}</td>
            <td>
                <button class="btn-view-proof" data-url="${req.MinhChungURL}" style="background:var(--primary); color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
                    <i class="fa-solid fa-eye" style="margin-right: 4px;"></i> Xem ảnh
                </button>
            </td>
            <td>${statusHtml}</td>
            <td style="text-align: right; white-space: nowrap;">${actionHtml}</td>
        `;

        const btnView = tr.querySelector(".btn-view-proof");
        if (btnView) {
            btnView.addEventListener("click", () => {
                Swal.fire({
                    title: 'Minh chứng Giáo viên',
                    imageUrl: btnView.dataset.url,
                    imageAlt: 'Minh chứng',
                    width: '600px',
                    showConfirmButton: false,
                    showCloseButton: true
                });
            });
        }

        if (req.TrangThai === "ChoDuyet") {
            tr.querySelector(".btn-approve").addEventListener("click", () => handleReview(req.MaYeuCau, "DaDuyet"));
            tr.querySelector(".btn-reject").addEventListener("click", () => openRejectModal(req.MaYeuCau, req.HoTen));
        }

        tbody.appendChild(tr);
    });
}

function setupModals() {
    const rejectModal = document.getElementById("reject-modal-overlay");
    
    document.getElementById("btn-close-modal").addEventListener("click", () => {
        rejectModal.style.display = "none";
    });
    
    document.getElementById("btn-cancel-modal").addEventListener("click", () => {
        rejectModal.style.display = "none";
    });
    
    window.addEventListener("click", (e) => {
        if (e.target === rejectModal) rejectModal.style.display = "none";
    });
}

let currentRejectId = null;

function openRejectModal(id, hoTen) {
    currentRejectId = id;
    document.getElementById("reject-reason-input").value = "";
    const titleEl = document.getElementById("reject-doc-title");
    if (titleEl) titleEl.textContent = hoTen;
    document.getElementById("reject-modal-overlay").style.display = "flex";
}

document.getElementById("btn-confirm-reject").addEventListener("click", () => {
    const reason = document.getElementById("reject-reason-input").value.trim();
    if (!reason) {
        showToast("warning", "Vui lòng nhập lý do từ chối.");
        return;
    }
    document.getElementById("reject-modal-overlay").style.display = "none";
    handleReview(currentRejectId, "TuChoi", reason);
});

async function handleReview(id, status, reason = null) {
    const actionText = status === "DaDuyet" ? "duyệt" : "từ chối";
    
    if (status === "DaDuyet") {
        const confirm = await Swal.fire({
            title: "Xác nhận duyệt",
            text: "Bạn có chắc chắn muốn duyệt người dùng này thành Giáo viên?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Đồng ý",
            cancelButtonText: "Hủy"
        });
        if (!confirm.isConfirmed) return;
    }

    const token = getToken();
    try {
        const response = await fetch(`${API_URL}/admin/teacher-requests/${id}/review`, {
            method: "PUT",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ trangThai: status, lyDoTuChoi: reason })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast("success", `Đã ${actionText} yêu cầu thành công.`);
            fetchRequests(); 
        } else {
            showToast("error", data.message || `Lỗi khi ${actionText} yêu cầu.`);
        }
    } catch (e) {
        console.error(e);
        showToast("error", "Lỗi kết nối máy chủ.");
    }
}
