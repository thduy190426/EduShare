import { renderBreadcrumb } from '../shared/utils.js';
import { getToken, decodeJWT } from '../shared/utils.js';

let initialSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
    renderBreadcrumb([{ name: 'Trang chủ Admin', url: 'adminDashboard.html' }, { name: 'Cài đặt' }]);
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
            if (settings.DEFAULT_PAGE_SIZE) {
                document.getElementById('DEFAULT_PAGE_SIZE').value = settings.DEFAULT_PAGE_SIZE.giaTri;
                document.getElementById('desc_DEFAULT_PAGE_SIZE').textContent = settings.DEFAULT_PAGE_SIZE.moTa;
                initialSettings.DEFAULT_PAGE_SIZE = settings.DEFAULT_PAGE_SIZE.giaTri;
            }
            if (settings.OTP_EXPIRY_MINUTES) {
                document.getElementById('OTP_EXPIRY_MINUTES').value = settings.OTP_EXPIRY_MINUTES.giaTri;
                document.getElementById('desc_OTP_EXPIRY_MINUTES').textContent = settings.OTP_EXPIRY_MINUTES.moTa;
                initialSettings.OTP_EXPIRY_MINUTES = settings.OTP_EXPIRY_MINUTES.giaTri;
            }
            if (settings.JWT_EXPIRY_DAYS) {
                document.getElementById('JWT_EXPIRY_DAYS').value = settings.JWT_EXPIRY_DAYS.giaTri;
                document.getElementById('desc_JWT_EXPIRY_DAYS').textContent = settings.JWT_EXPIRY_DAYS.moTa;
                initialSettings.JWT_EXPIRY_DAYS = settings.JWT_EXPIRY_DAYS.giaTri;
            }
            if (settings.DOC_APPROVAL_REWARD_XU) {
                document.getElementById('DOC_APPROVAL_REWARD_XU').value = settings.DOC_APPROVAL_REWARD_XU.giaTri;
                document.getElementById('desc_DOC_APPROVAL_REWARD_XU').textContent = settings.DOC_APPROVAL_REWARD_XU.moTa;
                initialSettings.DOC_APPROVAL_REWARD_XU = settings.DOC_APPROVAL_REWARD_XU.giaTri;
            }
            if (settings.MAX_DOC_PRICE_XU) {
                document.getElementById('MAX_DOC_PRICE_XU').value = settings.MAX_DOC_PRICE_XU.giaTri;
                document.getElementById('desc_MAX_DOC_PRICE_XU').textContent = settings.MAX_DOC_PRICE_XU.moTa;
                initialSettings.MAX_DOC_PRICE_XU = settings.MAX_DOC_PRICE_XU.giaTri;
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
    const currentDefaultPageSize = document.getElementById('DEFAULT_PAGE_SIZE').value;
    const currentOtpExpiry = document.getElementById('OTP_EXPIRY_MINUTES').value;
    const currentJwtExpiry = document.getElementById('JWT_EXPIRY_DAYS').value;
    const currentDocReward = document.getElementById('DOC_APPROVAL_REWARD_XU').value;
    const currentMaxDocPrice = document.getElementById('MAX_DOC_PRICE_XU').value;

    const isChanged = currentRate !== initialSettings.XU_TO_VND_RATE ||
                      currentDocs !== initialSettings.MAX_DOCS_PER_GROUP ||
                      currentReports !== initialSettings.MAX_REPORTS_AUTO_HIDE ||
                      currentUploadSize !== initialSettings.MAX_UPLOAD_SIZE_MB ||
                      currentAvatarSize !== initialSettings.MAX_AVATAR_SIZE_MB ||
                      currentAvatarChanges !== initialSettings.MAX_AVATAR_CHANGES ||
                      currentAvatarReset !== initialSettings.AVATAR_LIMIT_RESET_HOURS ||
                      currentDefaultPageSize !== initialSettings.DEFAULT_PAGE_SIZE ||
                      currentOtpExpiry !== initialSettings.OTP_EXPIRY_MINUTES ||
                      currentJwtExpiry !== initialSettings.JWT_EXPIRY_DAYS ||
                      currentDocReward !== initialSettings.DOC_APPROVAL_REWARD_XU ||
                      currentMaxDocPrice !== initialSettings.MAX_DOC_PRICE_XU;

    const isValid = currentRate > 0 && currentDocs > 0 && currentReports > 0 && 
                    currentUploadSize > 0 && currentAvatarSize > 0 && 
                    currentAvatarChanges > 0 && currentAvatarReset > 0 &&
                    currentDefaultPageSize > 0 && currentOtpExpiry > 0 && currentJwtExpiry > 0 &&
                    currentDocReward >= 0 && currentMaxDocPrice >= 0;

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
            AVATAR_LIMIT_RESET_HOURS: document.getElementById('AVATAR_LIMIT_RESET_HOURS').value,
            DEFAULT_PAGE_SIZE: document.getElementById('DEFAULT_PAGE_SIZE').value,
            OTP_EXPIRY_MINUTES: document.getElementById('OTP_EXPIRY_MINUTES').value,
            JWT_EXPIRY_DAYS: document.getElementById('JWT_EXPIRY_DAYS').value,
            DOC_APPROVAL_REWARD_XU: document.getElementById('DOC_APPROVAL_REWARD_XU').value,
            MAX_DOC_PRICE_XU: document.getElementById('MAX_DOC_PRICE_XU').value
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
                initialSettings.DEFAULT_PAGE_SIZE = updates.DEFAULT_PAGE_SIZE;
                initialSettings.OTP_EXPIRY_MINUTES = updates.OTP_EXPIRY_MINUTES;
                initialSettings.JWT_EXPIRY_DAYS = updates.JWT_EXPIRY_DAYS;
                initialSettings.DOC_APPROVAL_REWARD_XU = updates.DOC_APPROVAL_REWARD_XU;
                initialSettings.MAX_DOC_PRICE_XU = updates.MAX_DOC_PRICE_XU;

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

renderBreadcrumb([{ name: 'Trang chủ Admin', url: 'adminDashboard.html' }, { name: 'Cài đặt' }]);
