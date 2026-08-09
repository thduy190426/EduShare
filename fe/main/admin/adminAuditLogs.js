import { API_URL } from '../shared/config.js';
import { getToken } from '../shared/utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('log-table-body');
  const searchInput = document.getElementById('input-search');
  const filterAction = document.getElementById('filter-action');
  const filterDate = document.getElementById('filter-date');
  const btnClear = document.getElementById('btn-clear-filter');
  const paginationContainer = document.getElementById('log-pagination');
  
  let currentPage = 1;
  let currentLimit = 20;

  async function fetchLogs() {
    const token = getToken();
    if (!token) {
      window.location.href = '../auth/login.html';
      return;
    }

    try {
      const search = searchInput.value.trim();
      const action = filterAction.value;
      const date = filterDate.value;
      
      const queryParams = new URLSearchParams({
        page: currentPage,
        limit: currentLimit,
        search: search,
        action: action,
        date: date
      });

      const res = await fetch(`${API_URL}/admin/audit-logs?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error('Lỗi khi tải dữ liệu logs');
      }

      const responseData = await res.json();
      renderTable(responseData.data);
      renderPagination(responseData.pagination);
    } catch (error) {
      console.error(error);
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: #ef4444;"><i class="fa-solid fa-circle-exclamation" style="font-size: 32px; margin-bottom: 12px; display: block;"></i> Lỗi khi kết nối đến máy chủ</td></tr>`;
    }
  }

  function renderTable(logs) {
    tableBody.innerHTML = '';
    if (!logs || logs.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: #64748b;"><i class="fa-solid fa-folder-open" style="font-size: 32px; margin-bottom: 12px; color: #cbd5e1; display: block;"></i> Không tìm thấy nhật ký nào phù hợp</td></tr>`;
      return;
    }

    logs.forEach((log, index) => {
      let badgeClass = 'badge-other';
      if (log.HanhDong.includes('APPROVE')) badgeClass = 'badge-approve';
      else if (log.HanhDong.includes('DELETE') || log.HanhDong.includes('REJECT') || log.HanhDong.includes('REMOVE')) badgeClass = 'badge-delete';
      else if (log.HanhDong.includes('UPDATE') || log.HanhDong.includes('EDIT')) badgeClass = 'badge-update';

      const stt = (currentPage - 1) * currentLimit + index + 1;
      const adminName = log.AdminName || 'Admin (Đã bị xóa)';
      const adminEmail = log.AdminEmail || '';
      const ip = log.IPAddress || '127.0.0.1';
      
      const dateObj = new Date(log.ThoiGian);
      const d = String(dateObj.getDate()).padStart(2, '0');
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const y = dateObj.getFullYear();
      const time = dateObj.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
      const formattedDate = `${time} ${d}/${m}/${y}`;
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="text-align: center; color: #64748b;">${stt}</td>
        <td>
          <div style="font-weight: 600; color: #1e293b;">${adminName}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${adminEmail}</div>
        </td>
        <td><span class="badge-action ${badgeClass}">${log.HanhDong}</span></td>
        <td><div class="log-details">${log.ChiTiet}</div></td>
        <td style="font-family: monospace; color: #475569;">${ip}</td>
        <td style="color: #475569; font-size: 14px;">${formattedDate}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  function renderPagination(pagination) {
    if (!paginationContainer) return;
    
    paginationContainer.innerHTML = '';
    const totalPages = Math.max(1, pagination.totalPages || 1);
    
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        fetchLogs();
      }
    });
    paginationContainer.appendChild(prevBtn);

    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = startPage + maxVisiblePages - 1;
    
    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
      const btn = document.createElement('button');
      btn.className = 'page-btn';
      btn.textContent = '1';
      btn.addEventListener('click', () => { currentPage = 1; fetchLogs(); });
      paginationContainer.appendChild(btn);
      
      if (startPage > 2) {
        const dots = document.createElement('span');
        dots.className = 'page-dots';
        dots.textContent = '...';
        paginationContainer.appendChild(dots);
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      const btn = document.createElement('button');
      btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
      btn.textContent = i;
      btn.addEventListener('click', () => {
        currentPage = i;
        fetchLogs();
      });
      paginationContainer.appendChild(btn);
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const dots = document.createElement('span');
        dots.className = 'page-dots';
        dots.textContent = '...';
        paginationContainer.appendChild(dots);
      }
      const btn = document.createElement('button');
      btn.className = 'page-btn';
      btn.textContent = totalPages;
      btn.addEventListener('click', () => { currentPage = totalPages; fetchLogs(); });
      paginationContainer.appendChild(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        fetchLogs();
      }
    });
    paginationContainer.appendChild(nextBtn);
  }

  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      fetchLogs();
    }, 500);
  });
  
  filterAction.addEventListener('change', () => {
    currentPage = 1;
    fetchLogs();
  });
  
  filterDate.addEventListener('change', () => {
    currentPage = 1;
    fetchLogs();
  });
  
  btnClear.addEventListener('click', () => {
    searchInput.value = '';
    filterAction.value = '';
    filterDate.value = '';
    currentPage = 1;
    fetchLogs();
  });

  fetchLogs();
});
