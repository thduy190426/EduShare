import { API_URL } from '../shared/config.js';
import { getToken } from '../shared/utils.js';


const token = getToken();

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        Swal.fire('Vui lòng đăng nhập.');
        window.location.href = '../guest/guestHome.html';
        return;
    }

    fetchStats();
});

async function fetchStats() {
    try {
        const res = await fetch(`${API_URL}/admin/stats/overview`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 403) {
            Swal.fire('Bạn không có quyền truy cập trang này.');
            window.location.href = '../guest/guestHome.html';
            return;
        }

        const data = await res.json();
        
        document.getElementById('stat-users').textContent = Number(data.users || 0).toLocaleString();
        document.getElementById('stat-documents').textContent = Number(data.documents || 0).toLocaleString();
        document.getElementById('stat-downloads').textContent = Number(data.downloads || 0).toLocaleString();
        document.getElementById('stat-reports').textContent = Number(data.pendingReports || 0).toLocaleString();

        drawChart(data);

    } catch (err) {
        console.error(err);
    }
}

function drawChart(data) {
    const ctx = document.getElementById('overviewChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Người dùng', 'Tài liệu', 'Lượt tải', 'Báo cáo chờ'],
            datasets: [{
                label: 'Thống kê',
                data: [data.users, data.documents, data.downloads, data.pendingReports],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.5)',
                    'rgba(16, 185, 129, 0.5)',
                    'rgba(245, 158, 11, 0.5)',
                    'rgba(239, 68, 68, 0.5)'
                ],
                borderColor: [
                    'rgba(59, 130, 246, 1)',
                    'rgba(16, 185, 129, 1)',
                    'rgba(245, 158, 11, 1)',
                    'rgba(239, 68, 68, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

