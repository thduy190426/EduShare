document.addEventListener('DOMContentLoaded', async () => {
    const API_URL = 'http://localhost:3000/api';

    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    const token = urlParams.get('token');

    if (!email || !token) {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi',
            text: 'Link khôi phục mật khẩu không hợp lệ.',
            confirmButtonText: 'Quay lại'
        }).then(() => {
            window.location.href = 'forgot-password.html';
        });
        return;
    }

    try {
        const response = await fetch(`${API_URL}/verify-reset-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, token })
        });

        if (!response.ok) {
            const data = await response.json();
            Swal.fire({
                icon: 'error',
                title: 'Lỗi xác thực',
                text: data.message || 'Link khôi phục mật khẩu đã hết hạn hoặc không hợp lệ.',
                confirmButtonText: 'Yêu cầu gửi lại'
            }).then(() => {
                window.location.href = 'forgot-password.html';
            });
            return;
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi kết nối',
            text: 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.'
        });
    }

    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
    const btnResetPassword = document.getElementById('btnResetPassword');

    document.querySelectorAll('.toggle-password').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const icon = this.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });

    const validatePasswords = () => {
        const newPass = newPasswordInput.value.trim();
        const confirmPass = confirmNewPasswordInput.value.trim();
        return newPass.length >= 6 && newPass === confirmPass;
    };

    const updateResetBtnState = () => {
        if (validatePasswords()) {
            btnResetPassword.disabled = false;
        } else {
            btnResetPassword.disabled = true;
        }
    };

    newPasswordInput.addEventListener('input', updateResetBtnState);
    confirmNewPasswordInput.addEventListener('input', updateResetBtnState);
    updateResetBtnState();

    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = newPasswordInput.value.trim();
        const confirmNewPassword = confirmNewPasswordInput.value.trim();

        if (newPassword.length < 6) {
            Swal.fire({ icon: 'warning', title: 'Lưu ý', text: 'Mật khẩu phải có ít nhất 6 ký tự.' });
            return;
        }

        if (newPassword !== confirmNewPassword) {
            Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Mật khẩu xác nhận không khớp.' });
            return;
        }

        btnResetPassword.disabled = true;
        btnResetPassword.innerHTML = '&nbsp; Đang xử lý...';

        try {
            const response = await fetch(`${API_URL}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token, newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Thành công!',
                    text: data.message,
                    confirmButtonText: 'Đăng nhập ngay',
                    allowOutsideClick: false
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.location.href = 'login.html';
                    }
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Lỗi đặt lại mật khẩu',
                    text: data.message
                });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Lỗi kết nối',
                text: 'Không thể kết nối đến máy chủ.'
            });
        } finally {
            btnResetPassword.disabled = false;
            btnResetPassword.textContent = 'Đổi mật khẩu';
        }
    });
});
