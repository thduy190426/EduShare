import { API_URL } from '../shared/config.js';
import { decodeJWT, getAssetUrl, getToken, getAvatar } from '../shared/utils.js';

let currentTab = 'uploaded';
let uploadedDocs = [];
let bookmarkedDocs = [];
let downloadedDocs = [];
let subjects = [];

document.addEventListener('DOMContentLoaded', () => {
    loadUserProfileNav();
    setupTabs();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'bookmarks') {
        const bookmarkTab = document.querySelector('.tab-item[data-tab="bookmarks"]');
        if (bookmarkTab) bookmarkTab.click();
    }

    fetchAllData();
});

function loadUserProfileNav() {
    const token = getToken();
    if (!token) {
        window.location.href = '../auth/login.html';
        return;
    }
    try {
        const payload = decodeJWT(token);
        if (!payload) return;
        const avatarEl = document.getElementById('navAvatar');

        if (avatarEl && payload.HoTen) {
            const savedAvatar = getAvatar();
            if (savedAvatar && savedAvatar !== 'null') {
                avatarEl.innerHTML = `<img src="${getAssetUrl(savedAvatar)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                avatarEl.style.background = 'transparent';
                avatarEl.style.color = 'transparent';
            } else {
                avatarEl.textContent = payload.HoTen.trim().split(' ').pop().charAt(0).toUpperCase();
                avatarEl.style.background = 'var(--primary-light)';
                avatarEl.style.color = 'var(--primary)';
            }
        }
    } catch (e) {
        console.error('Lỗi giải mã token:', e);
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.getAttribute('data-tab');
            renderTable();
        });
    });

    const statusFilter = document.getElementById('filter-status');
    const subjectFilter = document.getElementById('filter-subject');
    const filetypeFilter = document.getElementById('filter-filetype');
    const searchFilter = document.getElementById('filter-search');

    if (statusFilter) statusFilter.addEventListener('change', renderTable);
    if (subjectFilter) subjectFilter.addEventListener('change', renderTable);
    if (filetypeFilter) filetypeFilter.addEventListener('change', renderTable);
    let myDocsSearchTimer = null;
    if (searchFilter) searchFilter.addEventListener('input', () => {
        clearTimeout(myDocsSearchTimer);
        myDocsSearchTimer = setTimeout(() => renderTable(), 500);
    });
}

async function fetchAllData() {
    const token = getToken();
    if (!token) return;

    try {
        const headers = { 'Authorization': `Bearer ${token}` };

        const [uploadRes, bookmarkRes, downloadRes, subjectRes] = await Promise.all([
            fetch(`${API_URL}/users/my-documents`, { headers }),
            fetch(`${API_URL}/users/bookmarks`, { headers }),
            fetch(`${API_URL}/users/download-history`, { headers }),
            fetch(`${API_URL}/documents/subjects`)
        ]);

        if (uploadRes.ok) {
            const upData = await uploadRes.json();
            uploadedDocs = upData.documents || [];
            document.getElementById('count-uploaded').textContent = uploadedDocs.length;
        }

        if (bookmarkRes.ok) {
            const bkData = await bookmarkRes.json();
            bookmarkedDocs = bkData.documents || [];
            document.getElementById('count-bookmarks').textContent = bookmarkedDocs.length;
        }

        if (downloadRes.ok) {
            const dlData = await downloadRes.json();
            downloadedDocs = dlData.documents || [];
            document.getElementById('count-downloads').textContent = downloadedDocs.length;
        }

        if (subjectRes.ok) {
            const subjectData = await subjectRes.json();
            subjects = subjectData.subjects || [];

            const subjectFilter = document.getElementById('filter-subject');
            if (subjectFilter) {
                subjects.forEach(sub => {
                    const option = document.createElement('option');
                    option.value = sub.MaMonHoc;
                    option.textContent = sub.TenMonHoc;
                    subjectFilter.appendChild(option);
                });
            }
        }

        renderTable();
    } catch (error) {
        console.error('Lỗi lấy dữ liệu:', error);
        document.getElementById('my-docs-table-body').innerHTML = `
            <tr><td colspan="6" style="text-align:center; padding: 20px; color: red;">Lỗi tải dữ liệu</td></tr>
        `;
    }
}

function renderTable() {
    const tbody = document.getElementById('my-docs-table-body');
    if (!tbody) return;

    let docsToRender = [];
    if (currentTab === 'uploaded') docsToRender = uploadedDocs;
    else if (currentTab === 'bookmarks') docsToRender = bookmarkedDocs;
    else if (currentTab === 'downloads') docsToRender = downloadedDocs;

    const statusFilter = document.getElementById('filter-status')?.value || 'all';
    const subjectFilter = document.getElementById('filter-subject')?.value || 'all';
    const filetypeFilter = document.getElementById('filter-filetype')?.value || 'all';
    const searchFilter = (document.getElementById('filter-search')?.value || '').toLowerCase();

    docsToRender = docsToRender.filter(doc => {
        let pass = true;

        if (statusFilter !== 'all' && doc.TrangThaiKiemDuyet !== statusFilter) pass = false;

        if (subjectFilter !== 'all' && doc.MaMonHoc != subjectFilter) pass = false;

        if (filetypeFilter !== 'all') {
            const ext = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';
            if (filetypeFilter === 'pdf' && ext !== 'pdf') pass = false;
            if (filetypeFilter === 'doc' && ext !== 'doc' && ext !== 'docx') pass = false;
            if (filetypeFilter === 'ppt' && ext !== 'ppt' && ext !== 'pptx') pass = false;
        }

        if (searchFilter && !doc.TenTL.toLowerCase().includes(searchFilter)) pass = false;

        return pass;
    });

    tbody.innerHTML = '';

    if (docsToRender.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px; color: #6b7280;">Không có dữ liệu.</td></tr>`;
        return;
    }

    docsToRender.forEach((doc, index) => {
        const tr = document.createElement('tr');
        tr.style.animationDelay = `${index * 0.04}s`;

        let icon = 'fa-file';
        let color = '#6b7280';
        let loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';

        if (loaiFile === 'pdf') { icon = 'fa-file-pdf'; color = '#ef4444'; }
        else if (loaiFile === 'pptx' || loaiFile === 'ppt') { icon = 'fa-file-powerpoint'; color = '#f97316'; }
        else if (loaiFile === 'docx' || loaiFile === 'doc') { icon = 'fa-file-word'; color = '#3b82f6'; }

        let statusText = '';
        let statusColor = '';
        let statusBg = '';
        let statusTitle = '';
        if (doc.TrangThaiKiemDuyet === 'DaDuyet') { 
            statusText = 'Đã duyệt'; statusColor = '#22c55e'; statusBg = '#dcfce7'; 
        } else if (doc.TrangThaiKiemDuyet === 'TuChoi') { 
            statusText = 'Từ chối'; 
            statusColor = '#ef4444'; statusBg = '#fee2e2';
            statusTitle = doc.LyDoTuChoi ? `Lý do: ${doc.LyDoTuChoi}` : 'Không có lý do';
        } else { 
            statusText = 'Chờ duyệt'; statusColor = '#f59e0b'; statusBg = '#fef3c7'; 
        }

        let dateField = doc.NgayDang;
        if (currentTab === 'bookmarks' && doc.NgayLuu) dateField = doc.NgayLuu;
        if (currentTab === 'downloads' && doc.NgayTai) dateField = doc.NgayTai;
        const dateObj = new Date(dateField);
        const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;
        const dateOnlyStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
        const dateStr = `${timeStr} <span style="color: #D1D5DB; margin: 0 4px;">|</span> ${dateOnlyStr}`;

        let actionBtns = `<button class="btn-action" title="Xem chi tiết" onclick="window.location.href='documentDetails.html?id=${doc.MaTL}'"><i class="fa-solid fa-eye"></i></button>`;

        if (currentTab === 'uploaded') {
            if (doc.TrangThaiKiemDuyet === 'TuChoi') {
                actionBtns += `
                    <button class="btn-action btn-view-rejection" title="Xem chi tiết lí do bị từ chối" data-id="${doc.MaTL}"><i class="fa-solid fa-circle-exclamation" style="color: var(--danger);"></i></button>
                    <button class="btn-action btn-delete" title="Xóa tài liệu" data-id="${doc.MaTL}"><i class="fa-solid fa-trash" style="color: var(--danger);"></i></button>
                `;
            } else {
                if (doc.TrangThaiKiemDuyet === 'DaDuyet') {
                    actionBtns += `
                        <button class="btn-action btn-update-file" title="Cập nhật bản mới" data-id="${doc.MaTL}"><i class="fa-solid fa-cloud-arrow-up" style="color: #6366F1;"></i></button>
                    `;
                }
                actionBtns += `
                    <button class="btn-action btn-edit" title="Sửa thông tin" data-id="${doc.MaTL}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-action btn-delete" title="Xóa tài liệu" data-id="${doc.MaTL}"><i class="fa-solid fa-trash" style="color: var(--danger);"></i></button>
                `;
            }
        } else if (currentTab === 'bookmarks') {
            actionBtns += `
                <button class="btn-action btn-remove-bookmark" title="Bỏ lưu" data-id="${doc.MaTL}"><i class="fa-solid fa-trash-can" style="color: var(--danger);"></i></button>
            `;
        }

        tr.innerHTML = `
            <td data-label="Tên tài liệu">
                <div style="display:flex; align-items:center; gap: 10px;">
                    <i class="fa-solid ${icon}" style="color: ${color}; font-size: 1.2rem;"></i>
                    <a href="documentDetails.html?id=${doc.MaTL}" style="color: inherit; text-decoration: none; font-weight: 500;">
                        ${doc.TenTL}
                        ${doc.LaTaiLieuDocQuyen ? `<span style="margin-left: 8px; background: #FEF3C7; color: #B45309; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-crown" style="color: #F59E0B;"></i> PREMIUM</span>` : ''}
                    </a>
                </div>
            </td>
            <td data-label="Môn học">${doc.TenMonHoc || 'Không có'}</td>
            <td data-label="Trạng thái">
                <div style="display:inline-flex; align-items:center; gap:6px;" title="${statusTitle}">
                    <span style="width:8px; height:8px; border-radius:50%; background:${statusColor};"></span>
                    <span style="font-size: 14px; color: ${statusColor}; font-weight: 600;">${statusText}</span>
                </div>
            </td>
            <td data-label="Lượt tải">${doc.SoLuotTai || 0}</td>
            <td data-label="Ngày tải lên">${dateStr}</td>
            <td data-label="Hành động">
                <div class="action-btns">
                    ${actionBtns}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (currentTab === 'uploaded') {
        document.querySelectorAll('.btn-view-rejection').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const doc = uploadedDocs.find(d => d.MaTL == id);
                if (doc) openRejectReasonModal(doc);
            });
        });

        document.querySelectorAll('.btn-update-file').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const doc = uploadedDocs.find(d => d.MaTL == id);
                if (doc) openUpdateFileModal(doc);
            });
        });

        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const doc = uploadedDocs.find(d => d.MaTL == id);
                if (doc) openEditModal(doc);
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                confirmDelete(id);
            });
        });
    } else if (currentTab === 'bookmarks') {
        document.querySelectorAll('.btn-remove-bookmark').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                removeBookmark(id);
            });
        });
    }
}

function confirmDelete(id) {
    Swal.fire({
        title: 'Xóa tài liệu này?',
        text: 'Dữ liệu và file đính kèm sẽ bị xóa vĩnh viễn, không thể hoàn tác!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy'
    }).then(async (result) => {
        if (result.isConfirmed) {
            const token = getToken();
            try {
                const res = await fetch(`${API_URL}/documents/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok) {
                    Swal.fire('Đã xóa!', data.message, 'success');
                    fetchAllData();
                } else {
                    Swal.fire('Lỗi', data.message, 'error');
                }
            } catch (err) {
                Swal.fire('Lỗi', 'Không thể kết nối đến server', 'error');
            }
        }
    });
}

async function removeBookmark(id) {
    const token = getToken();
    try {
        const res = await fetch(`${API_URL}/documents/${id}/bookmark`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Đã bỏ lưu tài liệu',
                showConfirmButton: false,
                timer: 1500
            });
            fetchAllData();
        } else {
            Swal.fire('Lỗi', data.message, 'error');
        }
    } catch (err) {
        Swal.fire('Lỗi', 'Không thể kết nối đến server', 'error');
    }
}

window.closeRejectReasonModal = function() {
    const modal = document.getElementById('reject-reason-modal');
    modal.style.opacity = '0';
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

function openRejectReasonModal(doc) {
    const modal = document.getElementById('reject-reason-modal');
    document.getElementById('reject-reason-doc-title').textContent = doc.TenTL;
    document.getElementById('reject-reason-content').textContent = doc.LyDoTuChoi || 'Không có lý do cụ thể.';
    const inputAppeal = document.getElementById('input-reject-appeal');
    inputAppeal.value = '';
    const btnSubmit = document.getElementById('btn-submit-appeal');
    btnSubmit.disabled = true;
    btnSubmit.style.opacity = '0.5';
    btnSubmit.style.cursor = 'not-allowed';

    btnSubmit.onclick = async () => {
        const phanHoi = inputAppeal.value.trim();
        if (!phanHoi) return;

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Đang gửi...';

        const token = getToken();
        try {
            const res = await fetch(`${API_URL}/documents/${doc.MaTL}/appeal`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ phanHoi })
            });
            const data = await res.json();
            if (res.ok) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Đã gửi khiếu nại thành công.',
                    showConfirmButton: false,
                    timer: 2000
                });
                window.closeRejectReasonModal();
                fetchAllData();
            } else {
                Swal.fire('Lỗi', data.message || 'Không thể gửi phản hồi.', 'error');
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane" style="margin-right: 6px;"></i> Gửi phản hồi';
            }
        } catch (error) {
            Swal.fire('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane" style="margin-right: 6px;"></i> Gửi phản hồi';
        }
    };

    inputAppeal.oninput = (e) => {
        if (e.target.value.trim().length > 0) {
            btnSubmit.disabled = false;
            btnSubmit.style.opacity = '1';
            btnSubmit.style.cursor = 'pointer';
        } else {
            btnSubmit.disabled = true;
            btnSubmit.style.opacity = '0.5';
            btnSubmit.style.cursor = 'not-allowed';
        }
    };

    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
    });
}

function openUpdateFileModal(doc) {
    Swal.fire({
        title: 'Cập nhật bản mới',
        text: `Bạn đang cập nhật bản mới cho tài liệu "${doc.TenTL}". Các chỉ số lượt tải và điểm đánh giá sẽ được giữ nguyên. Sau khi cập nhật, tài liệu sẽ chuyển về trạng thái Chờ duyệt.`,
        icon: 'info',
        html: `
            <div style="text-align: left; margin-top: 15px;">
                <label style="display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px;">Chọn file mới:</label>
                <input type="file" id="update-fileUpload" style="width: 100%; padding: 8px; border: 2px dashed #CBD5E1; border-radius: 6px; background: #F8FAFC; cursor: pointer;" accept=".pdf,.doc,.docx,.ppt,.pptx">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-cloud-arrow-up"></i> Tải lên',
        cancelButtonText: 'Hủy',
        customClass: {
            confirmButton: 'modern-btn-confirm',
            cancelButton: 'modern-btn-cancel'
        },
        preConfirm: () => {
            const fileInput = document.getElementById('update-fileUpload');
            if (fileInput.files.length === 0) {
                Swal.showValidationMessage('Vui lòng chọn một file.');
                return false;
            }
            return fileInput.files[0];
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const file = result.value;
            const token = getToken();
            const formData = new FormData();
            formData.append('fileUpload', file);

            Swal.fire({
                title: 'Đang cập nhật...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            try {
                const sigRes = await fetch(`${API_URL}/documents/generate-signature`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!sigRes.ok) throw new Error('Không thể tạo chữ ký bảo mật.');
                const sigData = await sigRes.json();

                const cloudForm = new FormData();
                cloudForm.append('file', file);
                cloudForm.append('api_key', sigData.apiKey);
                cloudForm.append('timestamp', sigData.timestamp);
                cloudForm.append('signature', sigData.signature);
                cloudForm.append('folder', sigData.folder);

                const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloudName}/auto/upload`, {
                    method: 'POST',
                    body: cloudForm
                });
                if (!cloudRes.ok) throw new Error('Lỗi tải lên máy chủ Cloudinary.');
                const cloudData = await cloudRes.json();

                formData.delete('fileUpload');
                formData.append('cloudinaryUrl', cloudData.secure_url);
                formData.append('publicId', cloudData.public_id);
                formData.append('mimeType', file.type);
                formData.append('fileName', file.name);

                const res = await fetch(`${API_URL}/documents/${doc.MaTL}/file`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await res.json();
                if (res.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Thành công',
                        text: data.message || 'Cập nhật file thành công.',
                    });
                    fetchAllData();
                } else {
                    Swal.fire('Lỗi', data.message || 'Không thể cập nhật file.', 'error');
                }
            } catch (error) {
                console.error(error);
                Swal.fire('Lỗi', 'Lỗi kết nối máy chủ.', 'error');
            }
        }
    });
}

function openEditModal(doc) {
    const isTuChoi = doc.TrangThaiKiemDuyet === 'TuChoi';
    const isDaDuyet = doc.TrangThaiKiemDuyet === 'DaDuyet';
    let extraText = '';
    if (isTuChoi) {
        const reason = doc.LyDoTuChoi ? doc.LyDoTuChoi : 'Không có lý do.';
        extraText = `<div class="modern-alert-danger"><i class="fa-solid fa-circle-exclamation" style="margin-top: 3px;"></i><div><strong>Tài liệu bị từ chối:</strong> ${reason}<br><span style="font-size: 13px; opacity: 0.85; margin-top: 4px; display: block;">Lưu ý: Sửa thông tin sẽ tự động gửi duyệt lại.</span></div></div>`;
    } else if (isDaDuyet) {
        extraText = `<div class="modern-alert-warning"><i class="fa-solid fa-triangle-exclamation" style="margin-top: 3px;"></i><div><strong>Tài liệu đã được duyệt</strong><br><span style="font-size: 13px; opacity: 0.85; margin-top: 4px; display: block;">Lưu ý: Việc sửa thông tin sẽ khiến tài liệu cần được ban quản trị duyệt lại.</span></div></div>`;
    }
    const subjectOptions = subjects.map(subject => `
                        <option value="${subject.MaMonHoc}" ${doc.MaMonHoc == subject.MaMonHoc ? 'selected' : ''}>${subject.TenMonHoc}</option>
                    `).join('');

    Swal.fire({
        title: 'Sửa thông tin tài liệu',
        customClass: {
            container: 'modern-modal-container',
            popup: 'modern-modal-popup',
            title: 'modern-modal-title',
            confirmButton: 'modern-btn-confirm',
            cancelButton: 'modern-btn-cancel'
        },
        html: `
            <style>
                .modern-modal-popup { border-radius: 12px !important; padding: 24px 20px 20px 20px !important; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important; width: 36em !important; max-width: 95vw !important; }
                .modern-modal-title { font-size: 20px !important; font-weight: 700 !important; color: #1E293B !important; margin-bottom: 16px !important; font-family: 'Inter', sans-serif !important; }
                .modern-form-group { margin-bottom: 16px; text-align: left; }
                .modern-form-label { display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px; font-family: 'Inter', sans-serif; }
                .modern-form-label i { margin-right: 6px; color: var(--primary); width: 16px; text-align: center; }
                .modern-input { width: 100%; padding: 10px 14px; border: 1.5px solid #E2E8F0; border-radius: 6px; font-size: 14px; transition: all 0.2s; outline: none; background: #F8FAFC; color: #0F172A; box-sizing: border-box; font-family: 'Inter', sans-serif; }
                .modern-input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px var(--primary-light); background: #FFF; }
                .modern-textarea { width: 100%; padding: 10px 14px; border: 1.5px solid #E2E8F0; border-radius: 6px; font-size: 14px; transition: all 0.2s; outline: none; background: #F8FAFC; min-height: 120px; resize: vertical; color: #0F172A; box-sizing: border-box; font-family: 'Inter', sans-serif; line-height: 1.5; }
                .modern-textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 4px var(--primary-light); background: #FFF; }
                .modern-file-input { width: 100%; padding: 8px; border: 2px dashed #CBD5E1; border-radius: 6px; font-size: 13px; background: #F8FAFC; transition: all 0.2s; cursor: pointer; color: #64748B; box-sizing: border-box; }
                .modern-file-input:hover { border-color: var(--primary); background: var(--primary-light); }
                .modern-btn-confirm { background: var(--primary) !important; color: #fff !important; border-radius: 6px !important; padding: 10px 24px !important; font-weight: 600 !important; font-size: 14px !important; transition: all 0.2s !important; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25) !important; margin: 0 6px !important; border: none !important; display: inline-flex !important; align-items: center !important; gap: 8px !important; }
                .modern-btn-confirm:not(:disabled):hover { background: #4338CA !important; transform: translateY(-2px) !important; box-shadow: 0 6px 16px rgba(79, 70, 229, 0.35) !important; }
                .modern-btn-cancel { background: #F1F5F9 !important; color: #475569 !important; border-radius: 6px !important; padding: 10px 24px !important; font-weight: 600 !important; font-size: 14px !important; transition: all 0.2s !important; border: none !important; margin: 0 6px !important; display: inline-flex !important; align-items: center !important; gap: 8px !important; }
                .modern-btn-cancel:hover { background: #E2E8F0 !important; color: #0F172A !important; }
                .modern-alert-warning { background: #FFFBEB; border-left: 4px solid #F59E0B; color: #92400E; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; display: flex; gap: 12px; align-items: flex-start; text-align: left; line-height: 1.5; }
                .modern-alert-danger { background: #FEF2F2; border-left: 4px solid #EF4444; color: #991B1B; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; display: flex; gap: 12px; align-items: flex-start; text-align: left; line-height: 1.5; }
            </style>
            ${extraText}
            <div style="text-align: left;">
                <div class="modern-form-group">
                    <label class="modern-form-label"><i class="fa-solid fa-file-signature"></i>Tên tài liệu <span style="color:#EF4444">*</span></label>
                    <input id="edit-tenTL" class="modern-input" placeholder="Nhập tên tài liệu..." value="${doc.TenTL}">
                </div>
                <div class="modern-form-group">
                    <label class="modern-form-label"><i class="fa-solid fa-book"></i>Môn học <span style="color:#EF4444">*</span></label>
                    <select id="edit-maMonHoc" class="modern-input">
                        ${subjectOptions || '<option value="" disabled selected>Chưa có môn học</option>'}
                    </select>
                </div>
                ${doc.LaTaiLieuDocQuyen ? `
                <div class="modern-form-group">
                    <label class="modern-form-label"><i class="fa-solid fa-coins"></i>Giá Xu <span style="color:#EF4444">*</span></label>
                    <input id="edit-giaXu" type="number" min="0" max="1000000" class="modern-input" placeholder="Nhập giá xu..." value="${doc.GiaXu || 0}">
                </div>
                ` : ''}
                <div class="modern-form-group">
                    <label class="modern-form-label"><i class="fa-solid fa-align-left"></i>Mô tả</label>
                    <textarea id="edit-moTa" class="modern-textarea" placeholder="Nhập mô tả chi tiết về tài liệu này...">${doc.MoTa || ''}</textarea>
                </div>
                <div class="modern-form-group" style="margin-bottom: 0;">
                    <label class="modern-form-label"><i class="fa-solid fa-file-arrow-up"></i>File tài liệu mới <span style="font-weight: 400; color: #94A3B8; font-size: 12px;">(Tùy chọn)</span></label>
                    <input type="file" id="edit-fileUpload" class="modern-file-input" accept=".pdf,.doc,.docx,.ppt,.pptx">
                    <div style="font-size: 13px; color: #475569; margin-top: 8px; font-weight: 500;">
                        <i class="fa-solid fa-paperclip" style="color: #64748B; margin-right: 4px;"></i> File hiện tại: <span style="color: var(--primary);">${doc.FileURL ? doc.FileURL.split('/').pop() : 'Không xác định'}</span>
                    </div>
                    <div style="font-size: 12px; color: #64748B; margin-top: 4px;"><i class="fa-solid fa-circle-info" style="margin-right: 4px; color: #94A3B8;"></i>Để trống nếu không muốn thay đổi file.</div>
                </div>
            </div>
        `,
        showCancelButton: true,
        reverseButtons: true,
        confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Lưu thay đổi',
        cancelButtonText: '<i class="fa-solid fa-xmark"></i> Hủy',
        didOpen: () => {
            const confirmBtn = Swal.getConfirmButton();
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
            confirmBtn.style.cursor = 'not-allowed';

            const tenInput = document.getElementById('edit-tenTL');
            const monHocSelect = document.getElementById('edit-maMonHoc');
            const moTaTextarea = document.getElementById('edit-moTa');
            const fileInput = document.getElementById('edit-fileUpload');
            const giaXuInput = document.getElementById('edit-giaXu');

            const initialTen = doc.TenTL || '';
            const initialMonHoc = String(doc.MaMonHoc || '');
            const initialMoTa = doc.MoTa || '';
            const initialGiaXu = String(doc.GiaXu || 0);

            const validate = () => {
                const currentTen = tenInput.value.trim();
                const currentMonHoc = String(monHocSelect.value || '');
                const currentMoTa = moTaTextarea.value.trim();
                const hasFile = fileInput.files.length > 0;
                let currentGiaXu = '';
                let isGiaXuValid = true;

                if (giaXuInput) {
                    currentGiaXu = String(giaXuInput.value || 0);
                    const val = parseInt(currentGiaXu);
                    isGiaXuValid = !isNaN(val) && val >= 0 && val <= 1000000;
                }

                const isChanged = currentTen !== initialTen || currentMonHoc !== initialMonHoc || currentMoTa !== initialMoTa || (giaXuInput && currentGiaXu !== initialGiaXu) || hasFile;
                const isValid = currentTen !== '' && currentMonHoc !== '' && isGiaXuValid;

                if (isChanged && isValid) {
                    confirmBtn.disabled = false;
                    confirmBtn.style.opacity = '1';
                    confirmBtn.style.cursor = 'pointer';
                } else {
                    confirmBtn.disabled = true;
                    confirmBtn.style.opacity = '0.5';
                    confirmBtn.style.cursor = 'not-allowed';
                }
            };

            tenInput.addEventListener('input', validate);
            monHocSelect.addEventListener('change', validate);
            moTaTextarea.addEventListener('input', validate);
            fileInput.addEventListener('change', validate);
            if (giaXuInput) giaXuInput.addEventListener('input', validate);

            validate();
        },
        preConfirm: () => {
            const tenTL = document.getElementById('edit-tenTL').value.trim();
            const maMonHoc = document.getElementById('edit-maMonHoc').value;
            const moTa = document.getElementById('edit-moTa').value.trim();
            const giaXuInput = document.getElementById('edit-giaXu');
            const giaXu = giaXuInput ? giaXuInput.value : null;
            const fileInput = document.getElementById('edit-fileUpload');
            const file = fileInput.files.length > 0 ? fileInput.files[0] : null;

            if (!tenTL) {
                Swal.showValidationMessage('Tên tài liệu không được để trống');
                return false;
            }
            if (!maMonHoc) {
                Swal.showValidationMessage('Vui lòng chọn môn học');
                return false;
            }
            if (giaXuInput) {
                const val = parseInt(giaXu);
                if (isNaN(val) || val < 0 || val > 1000000) {
                    Swal.showValidationMessage('Giá xu phải nằm trong khoảng 0 đến 1,000,000');
                    return false;
                }
            }
            return { tenTL, maMonHoc, moTa, giaXu, file };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const token = getToken();
            const formData = new FormData();
            formData.append('tenTL', result.value.tenTL);
            formData.append('maMonHoc', result.value.maMonHoc);
            formData.append('moTa', result.value.moTa);
            if (result.value.giaXu !== null) {
                formData.append('giaXu', result.value.giaXu);
            }
            if (result.value.file) {
                formData.append('fileUpload', result.value.file);
            }

            try {
                if (result.value.file) {
                    Swal.fire({
                        title: 'Đang tải lên...',
                        allowOutsideClick: false,
                        didOpen: () => Swal.showLoading()
                    });

                    const sigRes = await fetch(`${API_URL}/documents/generate-signature`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!sigRes.ok) throw new Error('Không thể tạo chữ ký bảo mật.');
                    const sigData = await sigRes.json();

                    const cloudForm = new FormData();
                    cloudForm.append('file', result.value.file);
                    cloudForm.append('api_key', sigData.apiKey);
                    cloudForm.append('timestamp', sigData.timestamp);
                    cloudForm.append('signature', sigData.signature);
                    cloudForm.append('folder', sigData.folder);

                    const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloudName}/auto/upload`, {
                        method: 'POST',
                        body: cloudForm
                    });
                    if (!cloudRes.ok) throw new Error('Lỗi tải lên máy chủ Cloudinary.');
                    const cloudData = await cloudRes.json();

                    formData.delete('fileUpload');
                    formData.append('cloudinaryUrl', cloudData.secure_url);
                    formData.append('publicId', cloudData.public_id);
                    formData.append('mimeType', result.value.file.type);
                    formData.append('fileName', result.value.file.name);
                }

                const res = await fetch(`${API_URL}/documents/${doc.MaTL}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                const data = await res.json();
                if (res.ok) {
                    Swal.fire('Thành công', data.message, 'success');
                    fetchAllData();
                } else {
                    Swal.fire('Lỗi', data.message, 'error');
                }
            } catch (err) {
                Swal.fire('Lỗi', 'Không thể kết nối đến server', 'error');
            }
        }
    });
}
