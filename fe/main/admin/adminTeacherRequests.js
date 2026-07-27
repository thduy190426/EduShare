import { API_URL } from "../shared/config.js";
import { getToken, showToast, renderPagination } from "../shared/utils.js";

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
        const date = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} | ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        
        let statusHtml = "";
        if (req.TrangThai === "ChoDuyet") statusHtml = `<span style="color:#f59e0b; font-weight: 500;">Chờ duyệt</span>`;
        if (req.TrangThai === "DaDuyet") statusHtml = `<span style="color:#10b981; font-weight: 500;">Đã duyệt</span>`;
        if (req.TrangThai === "TuChoi") statusHtml = `<span style="color:#ef4444; font-weight: 500;">Từ chối</span><div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${req.LyDoTuChoi || ""}</div>`;

        let actionHtml = "";
        if (req.TrangThai === "ChoDuyet") {
            actionHtml = `
                <button class="btn-approve" style="background:#10b981; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-right:4px;">Duyệt</button>
                <button class="btn-reject" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Từ chối</button>
            `;
        }

        tr.innerHTML = `
            <td style="text-align: center; font-weight: bold; color: var(--text-secondary);">${index + 1}</td>
            <td>
                <div><strong>${req.HoTen}</strong></div>
                <div style="font-size: 13px; color: var(--text-secondary);">${req.Email}</div>
            </td>
            <td>${date}</td>
            <td>
                <button class="btn-view-proof" data-url="${req.MinhChungURL}" style="background:var(--primary); color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
                    <i class="fa-solid fa-eye" style="margin-right: 4px;"></i> Xem ảnh
                </button>
            </td>
            <td>${statusHtml}</td>
            <td style="text-align: right;">${actionHtml}</td>
        `;

        const btnView = tr.querySelector(".btn-view-proof");
        if (btnView) {
            btnView.addEventListener("click", () => {
                document.getElementById("proof-image").src = btnView.dataset.url;
                document.getElementById("proof-modal").style.display = "block";
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
    const proofModal = document.getElementById("proof-modal");
    const rejectModal = document.getElementById("reject-modal");
    
    document.getElementById("close-proof-modal").addEventListener("click", () => {
        proofModal.style.display = "none";
    });
    
    document.getElementById("close-reject-modal").addEventListener("click", () => {
        rejectModal.style.display = "none";
    });
    
    document.getElementById("btn-cancel-reject").addEventListener("click", () => {
        rejectModal.style.display = "none";
    });
    
    window.addEventListener("click", (e) => {
        if (e.target === proofModal) proofModal.style.display = "none";
        if (e.target === rejectModal) rejectModal.style.display = "none";
    });
}

let currentRejectId = null;

function openRejectModal(id, hoTen) {
    currentRejectId = id;
    document.getElementById("reject-reason").value = "";
    document.getElementById("reject-modal").style.display = "block";
}

document.getElementById("btn-confirm-reject").addEventListener("click", () => {
    const reason = document.getElementById("reject-reason").value.trim();
    if (!reason) {
        showToast("warning", "Vui lòng nhập lý do từ chối.");
        return;
    }
    document.getElementById("reject-modal").style.display = "none";
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
            fetchRequests(); // Reload
        } else {
            showToast("error", data.message || `Lỗi khi ${actionText} yêu cầu.`);
        }
    } catch (e) {
        console.error(e);
        showToast("error", "Lỗi kết nối máy chủ.");
    }
}
