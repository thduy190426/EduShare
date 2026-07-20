import { API_URL } from '../shared/config.js';
import { getToken, getAssetUrl } from '../shared/utils.js';


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
        renderRankings(data);

    } catch (err) {
        console.error(err);
    }
}

function drawChart(data) {
    const ctxOverview = document.getElementById('overviewChart');
    if (ctxOverview) {
        new Chart(ctxOverview, {
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

    const ctxRole = document.getElementById('roleChart');
    if (ctxRole && data.usersByRole) {
        const labels = data.usersByRole.map(item => item.VaiTro);
        const counts = data.usersByRole.map(item => item.count);
        new Chart(ctxRole, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
                    borderWidth: 1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const ctxStatus = document.getElementById('statusChart');
    if (ctxStatus && data.docsByStatus) {
        const labels = data.docsByStatus.map(item => {
            if (item.TrangThaiKiemDuyet === 'DaDuyet') return 'Đã duyệt';
            if (item.TrangThaiKiemDuyet === 'ChoDuyet') return 'Chờ duyệt';
            if (item.TrangThaiKiemDuyet === 'TuChoi') return 'Từ chối';
            return item.TrangThaiKiemDuyet;
        });
        const counts = data.docsByStatus.map(item => item.count);
        new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const ctxSubject = document.getElementById('subjectChart');
    if (ctxSubject && data.docsBySubject) {
        const labels = data.docsBySubject.map(item => item.TenMonHoc);
        const counts = data.docsBySubject.map(item => item.count);
        new Chart(ctxSubject, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Số tài liệu',
                    data: counts,
                    backgroundColor: 'rgba(99, 102, 241, 0.5)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
    }
}


function renderRankings(data) {
    const topDepositorsList = document.getElementById('topDepositorsList');
    if (topDepositorsList && data.topDepositors) {
        topDepositorsList.innerHTML = '';
        data.topDepositors.forEach((user, index) => {
            const li = document.createElement('li');
            li.className = 'ranking-item';
            
            let medalClass = 'other';
            let medalText = `#${index + 1}`;
            if (index === 0) { medalClass = 'top-1'; medalText = '<i class="fa-solid fa-trophy"></i>'; }
            else if (index === 1) { medalClass = 'top-2'; medalText = '<i class="fa-solid fa-medal"></i>'; }
            else if (index === 2) { medalClass = 'top-3'; medalText = '<i class="fa-solid fa-medal"></i>'; }

            li.innerHTML = `
                <div class="ranking-medal ${medalClass}">${medalText}</div>
                ${user.AvatarURL 
                    ? `<img class="ranking-avatar" src="${getAssetUrl(user.AvatarURL)}" alt="Avatar" onerror="this.onerror=null; this.outerHTML='&lt;div class=&quot;ranking-avatar fallback&quot; style=&quot;background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 1.2rem;&quot;&gt;${(user.HoTen || 'U').split(' ').pop().charAt(0).toUpperCase()}&lt;/div&gt;';">`
                    : `<div class="ranking-avatar fallback" style="background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 1.2rem;">${(user.HoTen || 'U').split(' ').pop().charAt(0).toUpperCase()}</div>`
                }
                <div class="ranking-info">
                    <div class="ranking-name">${user.HoTen || 'Người dùng ẩn danh'}</div>
                </div>
                <div class="ranking-score">${Number(user.totalXu).toLocaleString()} Xu</div>
            `;
            topDepositorsList.appendChild(li);
        });
    }

    const topContributorsList = document.getElementById('topContributorsList');
    if (topContributorsList && data.topContributors) {
        topContributorsList.innerHTML = '';
        data.topContributors.forEach((user, index) => {
            const li = document.createElement('li');
            li.className = 'ranking-item';
            
            let medalClass = 'other';
            let medalText = `#${index + 1}`;
            if (index === 0) { medalClass = 'top-1'; medalText = '<i class="fa-solid fa-trophy"></i>'; }
            else if (index === 1) { medalClass = 'top-2'; medalText = '<i class="fa-solid fa-medal"></i>'; }
            else if (index === 2) { medalClass = 'top-3'; medalText = '<i class="fa-solid fa-medal"></i>'; }

            const score = (Number(user.countDoc) * 10) + Number(user.countComment);

            li.innerHTML = `
                <div class="ranking-medal ${medalClass}">${medalText}</div>
                ${user.AvatarURL 
                    ? `<img class="ranking-avatar" src="${getAssetUrl(user.AvatarURL)}" alt="Avatar" onerror="this.onerror=null; this.outerHTML='&lt;div class=&quot;ranking-avatar fallback&quot; style=&quot;background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 1.2rem;&quot;&gt;${(user.HoTen || 'U').split(' ').pop().charAt(0).toUpperCase()}&lt;/div&gt;';">`
                    : `<div class="ranking-avatar fallback" style="background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 1.2rem;">${(user.HoTen || 'U').split(' ').pop().charAt(0).toUpperCase()}</div>`
                }
                <div class="ranking-info">
                    <div class="ranking-name">${user.HoTen || 'Người dùng ẩn danh'}</div>
                    <div class="ranking-stat">${user.countDoc} TL, ${user.countComment} BL</div>
                </div>
                <div class="ranking-score">${score} đ</div>
            `;
            topContributorsList.appendChild(li);
        });
    }
}
