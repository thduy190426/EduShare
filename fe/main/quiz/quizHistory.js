import { API_URL } from '../shared/config.js';
import { getToken, decodeJWT, formatDate } from '../shared/utils.js';
import '../shared/sidebar.js';

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

    try {
        const res = await fetch(`${API_URL}/quizzes/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error(await res.text());
        const historyData = await res.json();

        if (historyData.length === 0) {
            table.style.display = 'none';
            noHistoryMsg.style.display = 'block';
        } else {
            tbody.innerHTML = '';
            historyData.forEach(item => {
                const scoreClass = item.DiemSo >= 80 ? 'high' : (item.DiemSo >= 50 ? 'medium' : 'low');
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${item.TieuDe}</strong></td>
                    <td>${item.TenMonHoc || '--'}</td>
                    <td>${formatDate(item.ThoiGianNopBai)}</td>
                    <td><span class="score-badge ${scoreClass}">${item.DiemSo} / 100</span></td>
                    <td>
                        <a href="quizResultDetails.html?id=${item.MaKetQua}" class="btn-details">
                            <i class="fa-solid fa-eye"></i> Xem chi tiết
                        </a>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Lỗi khi tải lịch sử bài thi.</td></tr>`;
    }
});
