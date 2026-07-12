import { API_URL } from "../shared/config.js";
import { getToken, showToast } from "../shared/utils.js";

let currentRejectId = null;
let currentTabStatus = 'ChoDuyet';

document.addEventListener("DOMContentLoaded", () => {
  fetchDocuments(currentTabStatus);

  const tabs = document.querySelectorAll('.tab-item');
  tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
          tabs.forEach(t => t.classList.remove('active'));
          e.currentTarget.classList.add('active');
          
          currentTabStatus = e.currentTarget.getAttribute('data-status');
          fetchDocuments(currentTabStatus);
      });
  });

  const rejectModal = document.getElementById("reject-modal-overlay");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const btnCancelModal = document.getElementById("btn-cancel-modal");
  const btnConfirmReject = document.getElementById("btn-confirm-reject");

  const closeModal = () => {
    if (rejectModal) rejectModal.style.display = "none";
    currentRejectId = null;
    const reasonInput = document.getElementById("reject-reason-input");
    if (reasonInput) reasonInput.value = "";
  };

  if (btnCloseModal) btnCloseModal.addEventListener("click", closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener("click", closeModal);

  if (btnConfirmReject) {
    btnConfirmReject.addEventListener("click", () => {
      const reason = document
        .getElementById("reject-reason-input")
        .value.trim();
      if (!reason) {
        showToast("error", "Vui lòng nhập lý do từ chối.");
        return;
      }
      if (currentRejectId) {
        reviewDocument(currentRejectId, "TuChoi", reason);
        closeModal();
      }
    });
  }
});

async function fetchDocuments(status) {
  const token = getToken();
  if (!token) {
    Swal.fire("Vui lòng đăng nhập dưới tư cách quản trị viên.");
    return;
  }

  const tbody = document.getElementById("pending-documents-tbody");
  if (tbody) tbody.style.opacity = '0';

  await new Promise(resolve => setTimeout(resolve, 200));

  try {
    const response = await fetch(`${API_URL}/admin/documents/list?status=${status}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      Swal.fire("Bạn không có quyền truy cập hoặc phiên đăng nhập đã hết hạn.");
      return;
    }

    const data = await response.json();
    renderDocuments(data, status);
  } catch (error) {
    console.error("Lỗi khi tải danh sách tài liệu:", error);
    showToast("error", "Lỗi hệ thống khi tải dữ liệu.");
  } finally {
      if (tbody) tbody.style.opacity = '1';
  }
}

function renderDocuments(documents, status) {
  const tbody = document.getElementById("pending-documents-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const tabCount = document.querySelector(".tab-count");
  if (tabCount && status === 'ChoDuyet') {
      tabCount.textContent = documents.length;
  }

  if (documents.length === 0) {
    let emptyText = "Không có tài liệu nào chờ duyệt.";
    if (status === 'DaDuyet') emptyText = "Không có tài liệu nào đã duyệt.";
    else if (status === 'TuChoi') emptyText = "Không có tài liệu nào bị từ chối.";
    tbody.innerHTML =
      `<tr><td colspan="6" style="text-align: center; padding: 20px;">${emptyText}</td></tr>`;
    return;
  }

  documents.forEach((doc) => {
    const tr = document.createElement("tr");

    let icon = "fa-file";
    let loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : "";
    if (loaiFile === "pdf") icon = "fa-file-pdf";
    else if (loaiFile === "pptx" || loaiFile === "ppt")
      icon = "fa-chart-column";
    else if (loaiFile === "docx" || loaiFile === "doc")
      icon = "fa-pen-to-square";

    const tenNguoiDang = doc.TenNguoiDang || "Không xác định";
    const userInitial = tenNguoiDang.trim().split(' ').pop().charAt(0).toUpperCase();

    let statusBadgeHtml = '';
    let actionBtnsHtml = `<button class="btn-action btn-view" title="Xem tài liệu" data-url="${doc.FileURL || ""}"><i class="fa-solid fa-eye"></i></button>`;

    if (status === 'ChoDuyet') {
        statusBadgeHtml = `<div style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:var(--warning);"></span><span class="status-badge status-pending" style="color:var(--warning); background:#fffbeb; padding:4px 8px; border-radius:4px; font-weight:500;">Chờ duyệt</span></div>`;
        actionBtnsHtml += `
            <button class="btn-action btn-approve" style="background:#ecfdf5; color:#10b981; padding:4px 8px; border:none; border-radius:4px; cursor:pointer;" title="Duyệt" data-id="${doc.MaTL}"><i class="fa-solid fa-check"></i></button>
            <button class="btn-action btn-reject" style="background:#fef2f2; color:#ef4444; padding:4px 8px; border:none; border-radius:4px; cursor:pointer;" title="Từ chối" data-id="${doc.MaTL}" data-title="${doc.TenTL}"><i class="fa-solid fa-xmark"></i></button>
        `;
    } else if (status === 'DaDuyet') {
        statusBadgeHtml = `<div style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:var(--success);"></span><span class="status-badge status-approved" style="color:var(--success); background:#ecfdf5; padding:4px 8px; border-radius:4px; font-weight:500;">Đã duyệt</span></div>`;
    } else if (status === 'TuChoi') {
        statusBadgeHtml = `<div style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:var(--danger);"></span><span class="status-badge status-rejected" style="color:var(--danger); background:#fef2f2; padding:4px 8px; border-radius:4px; font-weight:500;">Từ chối</span></div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px; max-width: 150px; white-space: normal;" title="${doc.LyDoTuChoi || ''}">Lý do: ${doc.LyDoTuChoi || 'Không rõ'}</div>`;
    }

    let dateStr = '-';
    if (doc.NgayDang) {
        const d = new Date(doc.NgayDang);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        dateStr = `${day}/${month}/${d.getFullYear()}`;
    }

    let avatarHtml = '';
    if (doc.AvatarURL) {
        const fullUrl = doc.AvatarURL.startsWith('http') ? doc.AvatarURL : 'http://localhost:3000' + doc.AvatarURL;
        avatarHtml = `
            <img src="${fullUrl}" style="width:28px; height:28px; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" alt="Avatar">
            <div class="user-initial" style="width:28px; height:28px; border-radius:50%; background:var(--primary); color:white; display:none; justify-content:center; align-items:center; font-weight:bold; font-size:12px;">${userInitial}</div>
        `;
    } else {
        avatarHtml = `<div class="user-initial" style="width:28px; height:28px; border-radius:50%; background:var(--primary); color:white; display:flex; justify-content:center; align-items:center; font-weight:bold; font-size:12px;">${userInitial}</div>`;
    }

    tr.innerHTML = `
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="doc-type" style="font-size:11px; font-weight: 600; background: var(--primary-light); color: var(--secondary); padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px;"><i class="fa-solid ${icon}"></i> ${loaiFile.toUpperCase()}</div>
                    <div class="doc-name" style="font-weight:600; color:var(--text-primary); max-width: 400px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${doc.TenTL}">${doc.TenTL}</div>
                </div>
            </td>
            <td>
                <div class="uploader-info" style="display:flex; align-items:center; flex-direction:row; gap:8px;">
                  ${avatarHtml}
                  <span style="font-weight:500; font-size:14px; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${tenNguoiDang}">${tenNguoiDang}</span>
                </div>
            </td>
            <td>${doc.TenMonHoc || "Không có"}</td>
            <td>${dateStr}</td>
            <td>${statusBadgeHtml}</td>
            <td>
                <div class="action-btns" style="display:flex; gap:8px;">
                  ${actionBtnsHtml}
                </div>
            </td>
        `;
    tbody.appendChild(tr);
  });

  const approveBtns = tbody.querySelectorAll(".btn-approve");
  approveBtns.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      if (
        (
          await Swal.fire({
            title: "Xác nhận",
            text: "Bạn có chắc chắn muốn duyệt tài liệu này?",
            icon: "info",
            showCancelButton: true,
            confirmButtonText: "Đồng ý",
            cancelButtonText: "Hủy",
          })
        ).isConfirmed
      ) {
        reviewDocument(id, "Duyet");
      }
    });
  });

  const rejectBtns = tbody.querySelectorAll(".btn-reject");
  rejectBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      const title = e.currentTarget.getAttribute("data-title");

      currentRejectId = id;
      document.getElementById("reject-doc-title").textContent = title;
      document.getElementById("reject-modal-overlay").style.display = "flex";
    });
  });

  const viewBtns = tbody.querySelectorAll(".btn-view");
  viewBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const url = e.currentTarget.getAttribute("data-url");
      if (url) {
        window.open("http://localhost:3000" + url, "_blank");
      } else {
        showToast("error", "Không có đường dẫn file.");
      }
    });
  });
}

async function reviewDocument(maTL, quyetDinh, lyDoTuChoi = "") {
  const token = getToken();
  try {
    const response = await fetch(`${API_URL}/admin/documents/${maTL}/review`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ quyetDinh, lyDoTuChoi }),
    });

    const result = await response.json();

    if (response.ok) {
      showToast("success", result.message || "Thao tác thành công.");
      await fetchDocuments(currentTabStatus);
    } else {
      showToast("error", result.message || "Lỗi khi xử lý tài liệu.");
    }
  } catch (error) {
    console.error("Lỗi khi duyệt/từ chối tài liệu:", error);
    showToast("error", "Lỗi hệ thống.");
  }
}
