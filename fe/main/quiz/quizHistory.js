import { API_URL } from '../shared/config.js';
import { getToken, decodeJWT, formatDate } from '../shared/utils.js';
import '../shared/sidebar.js';
import { makeAdminTablesResizableAndSticky } from '../admin/adminTableUtils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const token = getToken();
    if (!token) {
        window.location.href = '../auth/login.html';
        return;
    }

    const decoded = decodeJWT(token);
    if (decoded.VaiTro !== 'SinhVien') {
        alert('Chức năng này chỉ dành cho học sinh/sinh viên');
        window.location.href = '../user/userHome.html';
        return;
    }

    const tbody = document.getElementById('historyTableBody');
    const noHistoryMsg = document.getElementById('noHistoryMessage');
    const table = document.querySelector('.history-table');
    const paginationEl = document.getElementById('pagination');
    
    let allHistoryData = [];
    let currentPage = 1;
    const itemsPerPage = 10;

    const renderTable = () => {
        tbody.innerHTML = '';
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageData = allHistoryData.slice(start, end);

        pageData.forEach(item => {
            const scoreClass = item.DiemSo >= 80 ? 'high' : (item.DiemSo >= 50 ? 'medium' : 'low');
            
            const d = new Date(item.ThoiGianNopBai);
            const timeStr = [
                String(d.getHours()).padStart(2, '0'),
                String(d.getMinutes()).padStart(2, '0'),
                String(d.getSeconds()).padStart(2, '0')
            ].join(':');
            const dateStr = [
                String(d.getDate()).padStart(2, '0'),
                String(d.getMonth() + 1).padStart(2, '0'),
                d.getFullYear()
            ].join('/');
            const formattedDate = `${timeStr} | ${dateStr}`;
            
            let durationStr = '--';
            if (item.ThoiGianBatDau && item.ThoiGianNopBai) {
                const diffMs = new Date(item.ThoiGianNopBai) - new Date(item.ThoiGianBatDau);
                const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
                const mins = Math.floor(diffSecs / 60);
                const secs = diffSecs % 60;
                durationStr = `${mins} phút ${secs} giây`;
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.TieuDe}</strong></td>
                <td>${item.TenMonHoc || '--'}</td>
                <td><div class="time-badge"><i class="fa-regular fa-calendar-check"></i> ${formattedDate}</div></td>
                <td><span style="font-weight: 500; color: var(--text-primary);">${durationStr}</span></td>
                <td><span class="score-badge ${scoreClass}">${item.DiemSo} / 100</span></td>
                <td>
                    <a href="quizResultDetails.html?id=${item.MaKetQua}" class="btn-details">
                        <i class="fa-solid fa-eye"></i> Xem chi tiết
                    </a>
                </td>
            `;
            tbody.appendChild(tr);
        });

        setTimeout(makeAdminTablesResizableAndSticky, 100);
    };

    const renderPagination = () => {
        paginationEl.innerHTML = '';
        const totalPages = Math.ceil(allHistoryData.length / itemsPerPage);
        if (totalPages <= 1) return;

        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
                renderPagination();
            }
        };
        paginationEl.appendChild(prevBtn);

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.onclick = () => {
                    currentPage = i;
                    renderTable();
                    renderPagination();
                };
                paginationEl.appendChild(pageBtn);
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.padding = '0 8px';
                dots.style.color = 'var(--text-secondary)';
                paginationEl.appendChild(dots);
            }
        }

        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
                renderPagination();
            }
        };
        paginationEl.appendChild(nextBtn);
    };

    try {
        const res = await fetch(`${API_URL}/quizzes/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error(await res.text());
        allHistoryData = await res.json();

        if (allHistoryData.length === 0) {
            table.style.display = 'none';
            if (paginationEl) paginationEl.style.display = 'none';
            noHistoryMsg.style.display = 'block';
        } else {
            renderTable();
            renderPagination();
        }

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Lỗi khi tải lịch sử bài thi.</td></tr>`;
    }
});
