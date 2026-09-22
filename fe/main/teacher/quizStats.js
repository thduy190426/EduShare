import { API_URL } from '../shared/config.js';
import { getToken, decodeJWT } from '../shared/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const token = getToken();
    if (!token) {
        Swal.fire('Vui lòng đăng nhập.');
        window.location.href = '../auth/login.html';
        return;
    }
    const decoded = decodeJWT(token);
    if (!decoded || (decoded.VaiTro !== 'GiangVien' && decoded.VaiTro !== 'GiaoVien' && decoded.VaiTro !== 'Admin')) {
        Swal.fire('Bạn không có quyền truy cập trang này.');
        window.location.href = '../auth/login.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id');

    if (!quizId) {
        alert('Không tìm thấy thông tin đề thi.');
        window.location.href = 'quizManagement.html';
        return;
    }

    let statsData = [];

    const loadData = async () => {
        try {
            const res = await fetch(`${API_URL}/quizzes/${quizId}/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(await res.text());
            
            const data = await res.json();
            
            if (data.quiz && data.quiz.TieuDe) {
                document.getElementById('quizTitle').textContent = `Thống kê: ${data.quiz.TieuDe}`;
            } else {
                document.getElementById('quizTitle').textContent = `Thống kê kết quả`;
            }

            statsData = data.stats || [];
            updateSummaryCards(statsData);
            renderTable(statsData);
        } catch (err) {
            console.error(err);
            document.getElementById('quizTitle').textContent = 'Lỗi tải dữ liệu';
            document.getElementById('studentTableBody').innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">${err.message || 'Lỗi kết nối máy chủ'}</td></tr>`;
        }
    };

    const updateSummaryCards = (data) => {
        if (!data || data.length === 0) {
            document.getElementById('totalAttempts').textContent = '0';
            document.getElementById('avgScore').textContent = '0';
            document.getElementById('maxScore').textContent = '0';
            return;
        }

        const total = data.length;
        let sum = 0;
        let max = -1;

        data.forEach(item => {
            const score = parseFloat(item.DiemSo) || 0;
            sum += score;
            if (score > max) max = score;
        });

        const avg = (sum / total).toFixed(2);

        document.getElementById('totalAttempts').textContent = total;
        document.getElementById('avgScore').textContent = avg;
        document.getElementById('maxScore').textContent = max;
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'Chưa nộp';
        const d = new Date(dateString);
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const date = d.toLocaleDateString('vi-VN');
        return `${time} <span style="color:var(--text-muted); margin: 0 4px;">|</span> ${date}`;
    };

    const getAvatar = (name) => {
        const initial = name ? name.charAt(0).toUpperCase() : '?';
        return `<div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; flex-shrink: 0;">${initial}</div>`;
    };

    let currentPage = 1;
    const itemsPerPage = 10;

    const renderPagination = (totalItems) => {
        const container = document.getElementById('paginationStats');
        container.innerHTML = '';
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        
        if (totalPages <= 1) return;

        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            const isActive = i === currentPage;
            btn.style.cssText = `
                padding: 6px 12px; 
                border: 1px solid ${isActive ? 'var(--primary)' : 'var(--border-color)'}; 
                background: ${isActive ? 'var(--primary)' : '#fff'}; 
                color: ${isActive ? '#fff' : 'var(--text-main)'}; 
                border-radius: 6px; 
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s;
            `;
            btn.textContent = i;
            
            btn.onmouseover = () => { if (!isActive) btn.style.background = '#f8fafc'; };
            btn.onmouseout = () => { if (!isActive) btn.style.background = '#fff'; };
            
            btn.onclick = () => {
                currentPage = i;
                applyFilters(false);
            };
            container.appendChild(btn);
        }
    };

    const renderTable = (data) => {
        const tbody = document.getElementById('studentTableBody');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Chưa có dữ liệu làm bài</td></tr>';
            document.getElementById('paginationStats').innerHTML = '';
            return;
        }

        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedData = data.slice(startIndex, startIndex + itemsPerPage);

        paginatedData.forEach((item, index) => {
            const globalIndex = startIndex + index + 1;
            const score = parseFloat(item.DiemSo) || 0;
            let badgeClass = 'poor';
            if (score >= 8) badgeClass = 'excellent';
            else if (score >= 5) badgeClass = 'good';

            const startTime = formatDateTime(item.ThoiGianBatDau);
            const submitTime = formatDateTime(item.ThoiGianNopBai);
            const avatar = getAvatar(item.HoTen);

            tbody.innerHTML += `
                <tr>
                    <td>${globalIndex}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            ${avatar}
                            <strong>${item.HoTen}</strong>
                        </div>
                    </td>
                    <td>${item.Email}</td>
                    <td><span class="score-badge ${badgeClass}">${score}</span></td>
                    <td>${startTime}</td>
                    <td>${submitTime}</td>
                </tr>
            `;
        });

        renderPagination(data.length);
    };

    const applyFilters = (resetPage = true) => {
        if (resetPage === true) currentPage = 1;
        
        const term = document.getElementById('searchStudent').value.toLowerCase();
        const scoreFilter = document.getElementById('filterScore').value;
        
        const filtered = statsData.filter(item => {
            const matchSearch = (item.HoTen && item.HoTen.toLowerCase().includes(term)) ||
                                (item.Email && item.Email.toLowerCase().includes(term));
            
            const score = parseFloat(item.DiemSo) || 0;
            let matchScore = true;
            if (scoreFilter === 'excellent') matchScore = score >= 8;
            else if (scoreFilter === 'good') matchScore = (score >= 5 && score < 8);
            else if (scoreFilter === 'poor') matchScore = score < 5;
            
            return matchSearch && matchScore;
        });
        
        renderTable(filtered);
    };

    document.getElementById('searchStudent').addEventListener('input', applyFilters);
    document.getElementById('filterScore').addEventListener('change', applyFilters);

    loadData();
});
