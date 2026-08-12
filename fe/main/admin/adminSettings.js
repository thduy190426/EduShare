import { getToken, decodeJWT } from '../shared/utils.js';

let initialSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
    const token = getToken();
    if (!token) return;

    const user = decodeJWT(token);
    if (!user || user.VaiTro !== 'Admin') {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi truy cập',
            text: 'Bạn không có quyền truy cập trang này.'
        }).then(() => {
            window.location.href = '../../pages/user/userHome.html';
        });
        return;
    }

    await loadSettings(token);
    setupForm(token);
});

async function loadSettings(token) {
    try {
        const response = await fetch('http://localhost:3000/api/settings', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const settings = await response.json();

            if (settings.XU_TO_VND_RATE) {
                document.getElementById('XU_TO_VND_RATE').value = settings.XU_TO_VND_RATE.giaTri;
                document.getElementById('desc_XU_TO_VND_RATE').textContent = settings.XU_TO_VND_RATE.moTa;
                initialSettings.XU_TO_VND_RATE = settings.XU_TO_VND_RATE.giaTri;
            }
            if (settings.MAX_DOCS_PER_GROUP) {
                document.getElementById('MAX_DOCS_PER_GROUP').value = settings.MAX_DOCS_PER_GROUP.giaTri;
                document.getElementById('desc_MAX_DOCS_PER_GROUP').textContent = settings.MAX_DOCS_PER_GROUP.moTa;
                initialSettings.MAX_DOCS_PER_GROUP = settings.MAX_DOCS_PER_GROUP.giaTri;
            }
            if (settings.MAX_REPORTS_AUTO_HIDE) {
                document.getElementById('MAX_REPORTS_AUTO_HIDE').value = settings.MAX_REPORTS_AUTO_HIDE.giaTri;
                document.getElementById('desc_MAX_REPORTS_AUTO_HIDE').textContent = settings.MAX_REPORTS_AUTO_HIDE.moTa;
                initialSettings.MAX_REPORTS_AUTO_HIDE = settings.MAX_REPORTS_AUTO_HIDE.giaTri;
            }
            if (settings.MAX_UPLOAD_SIZE_MB) {
                document.getElementById('MAX_UPLOAD_SIZE_MB').value = settings.MAX_UPLOAD_SIZE_MB.giaTri;
                document.getElementById('desc_MAX_UPLOAD_SIZE_MB').textContent = settings.MAX_UPLOAD_SIZE_MB.moTa;
                initialSettings.MAX_UPLOAD_SIZE_MB = settings.MAX_UPLOAD_SIZE_MB.giaTri;
            }
            if (settings.MAX_AVATAR_SIZE_MB) {
                document.getElementById('MAX_AVATAR_SIZE_MB').value = settings.MAX_AVATAR_SIZE_MB.giaTri;
                document.getElementById('desc_MAX_AVATAR_SIZE_MB').textContent = settings.MAX_AVATAR_SIZE_MB.moTa;
                initialSettings.MAX_AVATAR_SIZE_MB = settings.MAX_AVATAR_SIZE_MB.giaTri;
            }
            if (settings.MAX_AVATAR_CHANGES) {
                document.getElementById('MAX_AVATAR_CHANGES').value = settings.MAX_AVATAR_CHANGES.giaTri;
                document.getElementById('desc_MAX_AVATAR_CHANGES').textContent = settings.MAX_AVATAR_CHANGES.moTa;
                initialSettings.MAX_AVATAR_CHANGES = settings.MAX_AVATAR_CHANGES.giaTri;
            }
            if (settings.AVATAR_LIMIT_RESET_HOURS) {
                document.getElementById('AVATAR_LIMIT_RESET_HOURS').value = settings.AVATAR_LIMIT_RESET_HOURS.giaTri;
                document.getElementById('desc_AVATAR_LIMIT_RESET_HOURS').textContent = settings.AVATAR_LIMIT_RESET_HOURS.moTa;
                initialSettings.AVATAR_LIMIT_RESET_HOURS = settings.AVATAR_LIMIT_RESET_HOURS.giaTri;
            }

            validateForm();
        } else {
            console.error('Không thể tải cấu hình');
        }
    } catch (error) {
        console.error('Lỗi kết nối:', error);
    }
}

function validateForm() {
    const btnSave = document.getElementById('btnSave');

    const currentRate = document.getElementById('XU_TO_VND_RATE').value;
    const currentDocs = document.getElementById('MAX_DOCS_PER_GROUP').value;
    const currentReports = document.getElementById('MAX_REPORTS_AUTO_HIDE').value;
    const currentUploadSize = document.getElementById('MAX_UPLOAD_SIZE_MB').value;
    const currentAvatarSize = document.getElementById('MAX_AVATAR_SIZE_MB').value;
    const currentAvatarChanges = document.getElementById('MAX_AVATAR_CHANGES').value;
    const currentAvatarReset = document.getElementById('AVATAR_LIMIT_RESET_HOURS').value;

    const isChanged = currentRate !== initialSettings.XU_TO_VND_RATE ||
                      currentDocs !== initialSettings.MAX_DOCS_PER_GROUP ||
                      currentReports !== initialSettings.MAX_REPORTS_AUTO_HIDE ||
                      currentUploadSize !== initialSettings.MAX_UPLOAD_SIZE_MB ||
                      currentAvatarSize !== initialSettings.MAX_AVATAR_SIZE_MB ||
                      currentAvatarChanges !== initialSettings.MAX_AVATAR_CHANGES ||
                      currentAvatarReset !== initialSettings.AVATAR_LIMIT_RESET_HOURS;

    const isValid = currentRate > 0 && currentDocs > 0 && currentReports > 0 && 
                    currentUploadSize > 0 && currentAvatarSize > 0 && 
                    currentAvatarChanges > 0 && currentAvatarReset > 0;

    btnSave.disabled = !(isChanged && isValid);
}

function setupForm(token) {
    const form = document.getElementById('settingsForm');

    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', validateForm);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const updates = {
            XU_TO_VND_RATE: document.getElementById('XU_TO_VND_RATE').value,
            MAX_DOCS_PER_GROUP: document.getElementById('MAX_DOCS_PER_GROUP').value,
            MAX_REPORTS_AUTO_HIDE: document.getElementById('MAX_REPORTS_AUTO_HIDE').value,
            MAX_UPLOAD_SIZE_MB: document.getElementById('MAX_UPLOAD_SIZE_MB').value,
            MAX_AVATAR_SIZE_MB: document.getElementById('MAX_AVATAR_SIZE_MB').value,
            MAX_AVATAR_CHANGES: document.getElementById('MAX_AVATAR_CHANGES').value,
            AVATAR_LIMIT_RESET_HOURS: document.getElementById('AVATAR_LIMIT_RESET_HOURS').value
        };

        try {
            const btnSave = document.getElementById('btnSave');
            btnSave.disabled = true;
            btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

            const response = await fetch('http://localhost:3000/api/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });

            const data = await response.json();

            if (response.ok) {
                initialSettings.XU_TO_VND_RATE = updates.XU_TO_VND_RATE;
                initialSettings.MAX_DOCS_PER_GROUP = updates.MAX_DOCS_PER_GROUP;
                initialSettings.MAX_REPORTS_AUTO_HIDE = updates.MAX_REPORTS_AUTO_HIDE;
                initialSettings.MAX_UPLOAD_SIZE_MB = updates.MAX_UPLOAD_SIZE_MB;
                initialSettings.MAX_AVATAR_SIZE_MB = updates.MAX_AVATAR_SIZE_MB;
                initialSettings.MAX_AVATAR_CHANGES = updates.MAX_AVATAR_CHANGES;
                initialSettings.AVATAR_LIMIT_RESET_HOURS = updates.AVATAR_LIMIT_RESET_HOURS;

                Swal.fire({
                    icon: 'success',
                    title: 'Thành công',
                    text: data.message,
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Lỗi',
                    text: data.message || 'Không thể cập nhật cấu hình.'
                });
            }

            btnSave.innerHTML = '<i class="fa-solid fa-save"></i> Lưu cấu hình';
            validateForm();

        } catch (error) {
            console.error('Lỗi kết nối:', error);
            Swal.fire({
                icon: 'error',
                title: 'Lỗi máy chủ',
                text: 'Không thể kết nối đến máy chủ.'
            });
            document.getElementById('btnSave').innerHTML = '<i class="fa-solid fa-save"></i> Lưu cấu hình';
            validateForm();
        }
    });
}
