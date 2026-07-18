import { API_URL } from '../shared/config.js';
import { getAssetUrl, getToken, showToast } from '../shared/utils.js';

const token = getToken();

async function readErrorMessage(res, fallback) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        const data = await res.json();
        return data.message || fallback;
    }

    return fallback;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        Swal.fire('Vui lòng đăng nhập.');
        window.location.href = '../guest/guestHome.html';
        return;
    }

    fetchReports();
});

async function fetchReports() {
    try {
        const res = await fetch(`${API_URL}/admin/reports`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 403) {
            Swal.fire('Bạn không có quyền truy cập trang này.');
            window.location.href = '../guest/guestHome.html';
            return;
        }

        const data = await res.json();
        renderReports(data.reports);
    } catch (err) {
        console.error(err);
    }
}

function renderReports(reports) {
    const container = document.getElementById('report-list');
    container.innerHTML = '';

    if (reports.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center;">Không có báo cáo nào.</div>';
        return;
    }

    reports.forEach(report => {
        const el = document.createElement('div');
        el.className = 'report-card';
        
        const d = new Date(report.NgayBaoCao);
        const timeStr = d.toLocaleTimeString('vi-VN');
        const dateStrFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
        
        const initial = report.NguoiBaoCao ? report.NguoiBaoCao.trim().split(' ').pop().charAt(0).toUpperCase() : '?';
        const avatarHtml = report.AvatarNguoiBaoCao
            ? `<img src="${getAssetUrl(report.AvatarNguoiBaoCao)}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">`
            : `<div style="width: 36px; height: 36px; border-radius: 50%; background: #E0E7FF; color: #4338CA; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${initial}</div>`;
        
        let statusBadge = '';
        if (report.TrangThai === 'ChoXuLy') statusBadge = '<span style="color:var(--warning); font-weight:600;">Chờ xử lý</span>';
        else if (report.TrangThai === 'DaXuLy') statusBadge = '<span style="color:var(--success); font-weight:600;">Đã xử lý (Xóa TL)</span>';
        else statusBadge = '<span style="color:var(--text-secondary); font-weight:600;">Đã từ chối</span>';

        let actionHtml = '';
        if (report.TrangThai === 'ChoXuLy') {
            actionHtml = `
                <div class="report-actions">
                    <button class="btn btn-outline" onclick="window.open('../document/documentDetails.html?id=${report.MaTL}', '_blank')"><i class="fa-solid fa-eye"></i> Xem tài liệu</button>
                    <button class="btn btn-danger-outline" onclick="reviewReport(${report.MaBC}, 'TuChoi')">Từ chối (Bỏ qua)</button>
                    <button class="btn btn-success" onclick="reviewReport(${report.MaBC}, 'ViPham')">Xử lý (Gỡ tài liệu)</button>
                </div>
            `;
        } else {
             actionHtml = `
                <div class="report-actions">
                    <button class="btn btn-outline" onclick="window.open('../document/documentDetails.html?id=${report.MaTL}', '_blank')"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn btn-danger-outline" onclick="deleteReport(${report.MaBC})"><i class="fa-solid fa-trash"></i></button>
                    <span>Trạng thái: ${statusBadge}</span>
                </div>
            `;
        }

        el.innerHTML = `
          <div class="report-header">
            <div>
              <span class="report-reason-badge">Báo cáo tài liệu</span>
              <div class="report-target">
                <span class="report-target-icon"><i class="fa-solid fa-file-pdf"></i></span>
                ${report.TenTL}
              </div>
              <div class="report-meta" style="display: flex; align-items: flex-start; gap: 12px; margin-top: 12px;">
                ${avatarHtml}
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-weight: 600; color: var(--text-primary); font-size: 14px;">${report.NguoiBaoCao}</span>
                    <div style="display: flex; flex-direction: column; gap: 4px; color: var(--text-secondary); font-size: 13px;">
                        <span><i class="fa-regular fa-clock" style="width: 14px; text-align: center; margin-right: 4px;"></i> ${timeStr}</span>
                        <span><i class="fa-regular fa-calendar" style="width: 14px; text-align: center; margin-right: 4px;"></i> ${dateStrFormatted}</span>
                    </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="report-content">
            <strong>Chi tiết lý do:</strong><br/>
            ${report.LyDo}
          </div>

          ${actionHtml}
        `;

        container.appendChild(el);
    });
}

window.reviewReport = async (maBC, quyetDinh) => {
    const actionText = quyetDinh === 'ViPham' ? 'GỠ TÀI LIỆU NÀY (Đánh dấu vi phạm)' : 'TỪ CHỐI BÁO CÁO (Bỏ qua)';
    if (!(await Swal.fire({ title: 'Xác nhận', text: `Bạn có chắc chắn muốn ${actionText}?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Đồng ý', cancelButtonText: 'Hủy' })).isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/admin/reports/${maBC}/review`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ quyetDinh })
        });
        if (res.ok) {
            showToast('success', 'Xử lý báo cáo thành công!');
            fetchReports();
        } else {
            const message = await readErrorMessage(res, 'Không thể xử lý báo cáo.');
            showToast('error', message);
        }
    } catch (err) {
        console.error(err);
    }
};

window.deleteReport = async (maBC) => {
    if (!(await Swal.fire({ title: 'Xác nhận xóa', text: 'Bạn có chắc chắn muốn xóa vĩnh viễn báo cáo này không?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Đồng ý', cancelButtonText: 'Hủy' })).isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/admin/reports/${maBC}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (res.ok) {
            showToast('success', 'Đã xóa báo cáo thành công!');
            fetchReports();
        } else {
            const message = await readErrorMessage(res, 'Không thể xóa báo cáo.');
            showToast('error', message);
        }
    } catch (err) {
        console.error(err);
        showToast('error', 'Lỗi hệ thống.');
    }
};
