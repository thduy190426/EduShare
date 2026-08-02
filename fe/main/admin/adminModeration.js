import { API_URL } from "../shared/config.js";
import { getToken, showToast, escapeHTML, renderPagination } from "../shared/utils.js";

let currentRejectId = null;
let currentBulkRejectIds = [];
let currentTabStatus = 'ChoDuyet';
let currentPage = 1;
const limit = 10;
let currentSortBy = 'NgayDang';
let currentOrder = 'DESC';

document.addEventListener("DOMContentLoaded", () => {
  fetchDocuments(currentTabStatus);

  const tabs = document.querySelectorAll('.tab-item');
  tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
          tabs.forEach(t => t.classList.remove('active'));
          e.currentTarget.classList.add('active');
          
          currentTabStatus = e.currentTarget.getAttribute('data-status');
          currentPage = 1;
          
          const selectAllDocs = document.getElementById("selectAllDocs");
          if (selectAllDocs) selectAllDocs.checked = false;
          
          fetchDocuments(currentTabStatus);
      });
  });

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
          
          fetchDocuments(currentTabStatus);
      });
  });

  const selectAllDocs = document.getElementById("selectAllDocs");
  if (selectAllDocs) {
      selectAllDocs.addEventListener("change", (e) => {
          const checkboxes = document.querySelectorAll(".doc-checkbox");
          checkboxes.forEach(cb => {
              cb.checked = e.target.checked;
          });
          updateBulkToolbar();
      });
  }

  const rejectModal = document.getElementById("reject-modal-overlay");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const btnCancelModal = document.getElementById("btn-cancel-modal");
  const btnConfirmReject = document.getElementById("btn-confirm-reject");

  const closeModal = () => {
    if (rejectModal) {
      rejectModal.classList.add("hide");
      setTimeout(() => {
        rejectModal.style.display = "none";
        rejectModal.classList.remove("hide");
        currentRejectId = null;
        const reasonInput = document.getElementById("reject-reason-input");
        if (reasonInput) reasonInput.value = "";
      }, 200);
    }
  };

  if (btnCloseModal) btnCloseModal.addEventListener("click", closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener("click", closeModal);

  
  const reasonInput = document.getElementById("reject-reason-input");
  if (reasonInput && btnConfirmReject) {
    reasonInput.addEventListener('input', () => {
      const val = reasonInput.value.trim();
      btnConfirmReject.disabled = val.length < 10;
    });
  }

  if (btnConfirmReject) {
    btnConfirmReject.addEventListener("click", () => {
      const reason = document
        .getElementById("reject-reason-input")
        .value.trim();
      if (!reason) {
        showToast("error", "Vui lòng nhập lý do từ chối.");
        return;
      }
      if (currentBulkRejectIds && currentBulkRejectIds.length > 0) {
        reviewBulkDocuments(currentBulkRejectIds, "TuChoi", reason);
        closeModal();
      } else if (currentRejectId) {
        reviewDocument(currentRejectId, "TuChoi", reason);
        closeModal();
      }
    });
  }

  const btnBulkApprove = document.getElementById("btn-bulk-approve");
  if (btnBulkApprove) {
      btnBulkApprove.addEventListener("click", async () => {
          const selectedIds = getSelectedDocumentIds();
          if (selectedIds.length === 0) return;

          if (
              (
                  await Swal.fire({
                      title: "Xác nhận duyệt hàng loạt",
                      html: `Bạn có chắc chắn muốn duyệt <b>${selectedIds.length}</b> tài liệu đã chọn?`,
                      icon: "info",
                      showCancelButton: true,
                      confirmButtonText: "Đồng ý",
                      cancelButtonText: "Hủy",
                  })
              ).isConfirmed
          ) {
              reviewBulkDocuments(selectedIds, "Duyet");
          }
      });
  }

  const btnBulkReject = document.getElementById("btn-bulk-reject");
  if (btnBulkReject) {
      btnBulkReject.addEventListener("click", () => {
          const selectedIds = getSelectedDocumentIds();
          if (selectedIds.length === 0) return;

          currentBulkRejectIds = selectedIds;
          currentRejectId = null;
          document.getElementById("reject-doc-title").textContent = `${selectedIds.length} tài liệu đã chọn`;
          const reasonInput = document.getElementById("reject-reason-input");
          if (reasonInput) reasonInput.value = "";
          const btnConfirm = document.getElementById("btn-confirm-reject");
          if (btnConfirm) btnConfirm.disabled = true;
          const m = document.getElementById("reject-modal-overlay"); m.style.display = "flex"; m.classList.remove("hide");
      });
  }
});

function getSelectedDocumentIds() {
    const checkboxes = document.querySelectorAll(".doc-checkbox:checked");
    return Array.from(checkboxes).map(cb => cb.value);
}

function updateBulkToolbar() {
    const selectedIds = getSelectedDocumentIds();
    const toolbar = document.getElementById("bulk-actions-toolbar");
    const countSpan = document.getElementById("bulk-selected-count");
    if (selectedIds.length > 0 && currentTabStatus === 'ChoDuyet') {
        toolbar.style.display = "flex";
        countSpan.textContent = selectedIds.length;
    } else {
        toolbar.style.display = "none";
    }
}

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
    const response = await fetch(`${API_URL}/admin/documents/list?status=${status}&page=${currentPage}&limit=${limit}&sortBy=${currentSortBy}&order=${currentOrder}`, {
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
    renderDocuments(data.data || [], status);
    fetchCounts();
    
    if (data.pagination) {
        renderPagination('moderation-pagination', data.pagination.totalPages, currentPage, (page) => {
            currentPage = page;
            fetchDocuments(currentTabStatus);
        });
    }
  } catch (error) {
    console.error("Lỗi khi tải danh sách tài liệu:", error);
    showToast("error", "Lỗi hệ thống khi tải dữ liệu.");
  } finally {
      if (tbody) tbody.style.opacity = '1';
  }
}

async function fetchCounts() {
  const token = getToken();
  if (!token) return;

  try {
    const response = await fetch(`${API_URL}/admin/documents/counts`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.ok) {
      const counts = await response.json();
      const pendingCountTab = document.getElementById("pending-count-tab");
      const approvedCountTab = document.getElementById("approved-count-tab");
      const rejectedCountTab = document.getElementById("rejected-count-tab");
      
      if (pendingCountTab) pendingCountTab.textContent = counts.ChoDuyet || 0;
      if (approvedCountTab) approvedCountTab.textContent = counts.DaDuyet || 0;
      if (rejectedCountTab) rejectedCountTab.textContent = counts.TuChoi || 0;
    }
  } catch (error) {
    console.error("Lỗi khi tải số lượng tài liệu:", error);
  }
}

function renderDocuments(documents, status) {
  const tbody = document.getElementById("pending-documents-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  
  updateBulkToolbar();

  if (documents.length === 0) {
    let emptyText = "Không có tài liệu nào đang trong trạng thái chờ duyệt.";
    if (status === 'DaDuyet') emptyText = "Không có tài liệu nào đã duyệt.";
    else if (status === 'TuChoi') emptyText = "Không có tài liệu nào bị từ chối.";
      tbody.innerHTML =
        `<tr><td colspan="8" style="text-align: center; padding: 20px;">${emptyText}</td></tr>`;
      return;
  }

  documents.forEach((doc, index) => {
    const tr = document.createElement("tr");

    let icon = "fa-file";
    let iconColor = "#64748B";
    let iconBg = "#F1F5F9";
    let loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : "";
    
    if (loaiFile === "pdf") {
      icon = "fa-file-pdf";
      iconColor = "#DC2626";
      iconBg = "#FEE2E2";
    } else if (loaiFile === "pptx" || loaiFile === "ppt") {
      icon = "fa-file-powerpoint";
      iconColor = "#EA580C";
      iconBg = "#FFEDD5";
    } else if (loaiFile === "docx" || loaiFile === "doc") {
      icon = "fa-file-word";
      iconColor = "#2563EB";
      iconBg = "#DBEAFE";
    }

    const tenNguoiDang = doc.TenNguoiDang || "Không xác định";
    const userInitial = tenNguoiDang.trim().split(' ').pop().charAt(0).toUpperCase();

    let statusBadgeHtml = '';
    let actionBtnsHtml = `<button class="btn-action btn-view" title="Xem tài liệu" data-url="${doc.FileURL || ""}"><i class="fa-solid fa-eye"></i></button>`;

    if (status === 'ChoDuyet') {
        statusBadgeHtml = `<div style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:var(--warning);"></span><span style="color:var(--warning); font-size:14px; font-weight:600;">Chờ duyệt</span></div>`;
        
        if (doc.PhanHoiTuChoi) {
            statusBadgeHtml += `<div style="font-size:12px; color:#D97706; margin-top:6px; max-width: 180px; white-space: normal; background: #FEF3C7; padding: 6px; border-radius: 4px; border: 1px solid #FDE68A;" title="${doc.PhanHoiTuChoi.replace(/"/g, '&quot;')}"><i class="fa-solid fa-comment-dots" style="margin-right:4px;"></i> <strong>Phản hồi:</strong> ${doc.PhanHoiTuChoi}</div>`;
        }

        actionBtnsHtml += `
            <button class="btn-action btn-approve" style="background:#ecfdf5; color:#10b981; padding:4px 8px; border:none; border-radius:4px; cursor:pointer;" title="Duyệt" data-id="${doc.MaTL}"><i class="fa-solid fa-check"></i></button>
            <button class="btn-action btn-reject" style="background:#fef2f2; color:#ef4444; padding:4px 8px; border:none; border-radius:4px; cursor:pointer;" title="Từ chối" data-id="${doc.MaTL}" data-title="${doc.TenTL}"><i class="fa-solid fa-xmark"></i></button>
        `;
    } else if (status === 'DaDuyet') {
        const isHidden = doc.TrangThaiHienThi === 'An';
        statusBadgeHtml = `<div style="display:flex; align-items:center; gap:6px;">
            <span style="width:8px; height:8px; border-radius:50%; background:var(--success);"></span>
            <span style="color:var(--success); font-size:14px; font-weight:600;">Đã duyệt</span>
            ${isHidden ? '<span style="background:#f1f5f9; color:#475569; font-size:12px; padding:2px 6px; border-radius:12px; font-weight:500; margin-left:4px;"><i class="fa-solid fa-eye-slash"></i> Đã ẩn</span>' : ''}
        </div>`;
        
        const toggleIcon = isHidden ? 'fa-eye' : 'fa-eye-slash';
        const toggleTitle = isHidden ? 'Hiện tài liệu' : 'Ẩn tài liệu';
        const toggleColor = isHidden ? '#10b981' : '#f59e0b';
        const toggleBg = isHidden ? '#ecfdf5' : '#fef3c7';
        
        actionBtnsHtml += `
            <button class="btn-action btn-toggle-visibility" style="background:${toggleBg}; color:${toggleColor}; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; margin-left:8px;" title="${toggleTitle}" data-id="${doc.MaTL}" data-title="${escapeHTML(doc.TenTL)}" data-status="${doc.TrangThaiHienThi}"><i class="fa-solid ${toggleIcon}"></i></button>
            <button class="btn-action btn-delete-doc" style="background:#fef2f2; color:#ef4444; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; margin-left:8px;" title="Xóa vĩnh viễn" data-id="${doc.MaTL}" data-title="${escapeHTML(doc.TenTL)}"><i class="fa-solid fa-trash"></i></button>
        `;
    } else if (status === 'TuChoi') {
        statusBadgeHtml = `<div style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:var(--danger);"></span><span style="color:var(--danger); font-size:14px; font-weight:600;">Từ chối</span></div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px; max-width: 150px; white-space: normal;" title="${doc.LyDoTuChoi || ''}">Lý do: ${doc.LyDoTuChoi || 'Không rõ'}</div>`;
        actionBtnsHtml += `
            <button class="btn-action btn-delete-doc" style="background:#fef2f2; color:#ef4444; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; margin-left:8px;" title="Xóa vĩnh viễn" data-id="${doc.MaTL}" data-title="${escapeHTML(doc.TenTL)}"><i class="fa-solid fa-trash"></i></button>
        `;
    }

    let dateStr = '-';
    if (doc.NgayDang) {
        const d = new Date(doc.NgayDang);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        dateStr = `${hh}:${mm}:${ss} <span style="color:var(--border); margin: 0 4px;">|</span> ${day}/${month}/${year}`;
    }

    let avatarHtml = '';
    if (doc.AvatarURL) {
        const fullUrl = doc.AvatarURL.startsWith('http') ? doc.AvatarURL : 'http://localhost:3000' + doc.AvatarURL;
        avatarHtml = `
            <img src="${fullUrl}" style="width:28px; height:28px; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" alt="Avatar">
            <div class="user-initial" style="width:28px; height:28px; border-radius:50%; background:#EFF6FF; color:#2563EB; display:none; justify-content:center; align-items:center; font-weight:bold; font-size:12px;">${userInitial}</div>
        `;
    } else {
        avatarHtml = `<div class="user-initial" style="width:28px; height:28px; border-radius:50%; background:#EFF6FF; color:#2563EB; display:flex; justify-content:center; align-items:center; font-weight:bold; font-size:12px;">${userInitial}</div>`;
    }

        tr.innerHTML = `
            <td style="text-align: center;">
                ${status === 'ChoDuyet' ? `<input type="checkbox" class="doc-checkbox" value="${doc.MaTL}" style="cursor: pointer;">` : ''}
            </td>
            <td style="text-align: center; font-weight: bold; color: var(--text-secondary);">
                <span>${(currentPage - 1) * limit + index + 1}</span>
            </td>
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid ${icon}" style="color: ${iconColor}; font-size: 1.4rem;"></i>
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

  const rowCheckboxes = tbody.querySelectorAll(".doc-checkbox");
  rowCheckboxes.forEach(cb => {
      cb.addEventListener("change", () => {
          updateBulkToolbar();
          const allCheckboxes = tbody.querySelectorAll(".doc-checkbox");
          const checkedCheckboxes = tbody.querySelectorAll(".doc-checkbox:checked");
          const selectAllDocs = document.getElementById("selectAllDocs");
          if (selectAllDocs) {
              selectAllDocs.checked = allCheckboxes.length > 0 && allCheckboxes.length === checkedCheckboxes.length;
          }
      });
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
      const reasonInput = document.getElementById("reject-reason-input");
      if (reasonInput) reasonInput.value = "";
      const btnConfirm = document.getElementById("btn-confirm-reject");
      if (btnConfirm) btnConfirm.disabled = true;
      const m = document.getElementById("reject-modal-overlay"); m.style.display = "flex"; m.classList.remove("hide");
    });
  });

  const viewBtns = tbody.querySelectorAll(".btn-view");
  viewBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const url = e.currentTarget.getAttribute("data-url");
      if (url) {
        const fullUrl = url.startsWith('http') ? url : "http://localhost:3000" + url;
        window.open(fullUrl, "_blank");
      } else {
        showToast("error", "Không có đường dẫn file.");
      }
    });
  });

  const toggleVisibilityBtns = tbody.querySelectorAll(".btn-toggle-visibility");
  toggleVisibilityBtns.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      const title = e.currentTarget.getAttribute("data-title");
      const currentStatus = e.currentTarget.getAttribute("data-status");
      const isHidden = currentStatus === 'An';
      
      const actionText = isHidden ? "hiện" : "ẩn";
      
      if (
        (
          await Swal.fire({
            title: `Xác nhận ${actionText} tài liệu`,
            html: `Bạn có chắc chắn muốn ${actionText} tài liệu <b>${escapeHTML(title)}</b> không?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Đồng ý",
            cancelButtonText: "Hủy",
          })
        ).isConfirmed
      ) {
        toggleDocumentVisibility(id);
      }
    });
  });

  const deleteBtns = tbody.querySelectorAll(".btn-delete-doc");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      const title = e.currentTarget.getAttribute("data-title");
      if (
        (
          await Swal.fire({
            title: "Xóa vĩnh viễn?",
            html: `Bạn có chắc chắn muốn xóa vĩnh viễn tài liệu <b>${escapeHTML(title)}</b> không?<br><br><span style="color:var(--danger)">Cảnh báo: Hành động này sẽ xóa file và toàn bộ đánh giá, bình luận liên quan. Không thể hoàn tác!</span>`,
            icon: "error",
            showCancelButton: true,
            confirmButtonText: "Xóa",
            confirmButtonColor: "#EF4444",
            cancelButtonText: "Hủy",
          })
        ).isConfirmed
      ) {
        deleteDocument(id);
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

async function reviewBulkDocuments(documentIds, quyetDinh, lyDoTuChoi = "") {
  const token = getToken();
  try {
    const response = await fetch(`${API_URL}/admin/documents/bulk-review`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentIds, quyetDinh, lyDoTuChoi }),
    });

    const result = await response.json();

    if (response.ok) {
      showToast("success", result.message || "Thao tác thành công.");
      await fetchDocuments(currentTabStatus);
    } else {
      showToast("error", result.message || "Lỗi khi xử lý hàng loạt.");
    }
  } catch (error) {
    console.error("Lỗi khi duyệt/từ chối hàng loạt:", error);
    showToast("error", "Lỗi hệ thống.");
  }
}

async function deleteDocument(maTL) {
  const token = getToken();
  try {
    const response = await fetch(`${API_URL}/documents/${maTL}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const result = await response.json();

    if (response.ok) {
      showToast("success", result.message || "Đã xóa tài liệu thành công.");
      await fetchDocuments(currentTabStatus);
    } else {
      showToast("error", result.message || "Lỗi khi xóa tài liệu.");
    }
  } catch (error) {
    console.error("Lỗi khi xóa tài liệu:", error);
    showToast("error", "Lỗi hệ thống.");
  }
}

async function toggleDocumentVisibility(maTL) {
  const token = getToken();
  try {
    const response = await fetch(`${API_URL}/admin/documents/${maTL}/toggle-visibility`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const result = await response.json();

    if (response.ok) {
      showToast("success", result.message || "Đã thay đổi trạng thái ẩn/hiện.");
      await fetchDocuments(currentTabStatus);
    } else {
      showToast("error", result.message || "Lỗi khi thay đổi trạng thái.");
    }
  } catch (error) {
    console.error("Lỗi khi toggle ẩn/hiện:", error);
    showToast("error", "Lỗi hệ thống.");
  }
}
