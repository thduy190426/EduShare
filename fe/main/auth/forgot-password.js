document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000/api';
    
    const stepEmail = document.getElementById('step-email');
    const stepOtp = document.getElementById('step-otp');
    const stepReset = document.getElementById('step-reset');
    
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const verifyOtpForm = document.getElementById('verifyOtpForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    
    const emailInput = document.getElementById('resetEmail');
    const otpInput = document.getElementById('otpCode');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
    
    const btnSendOTP = document.getElementById('btnSendOTP');
    const btnVerifyOTP = document.getElementById('btnVerifyOTP');
    const btnResetPassword = document.getElementById('btnResetPassword');
    const resendOtpBtn = document.getElementById('resendOtp');
    
    let currentEmail = '';

    const showStep = (stepElement) => {
        document.querySelectorAll('.step-container').forEach(el => el.classList.remove('active'));
        stepElement.classList.add('active');
    };

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

    const validateEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const updateBtnState = () => {
        if (validateEmail(emailInput.value.trim())) {
            btnSendOTP.disabled = false;
        } else {
            btnSendOTP.disabled = true;
        }
    };

    emailInput.addEventListener('input', updateBtnState);
    updateBtnState(); 

    const validateOtp = (otp) => /^[0-9]{6}$/.test(otp);
    
    const updateVerifyBtnState = () => {
        if (validateOtp(otpInput.value.trim())) {
            btnVerifyOTP.disabled = false;
        } else {
            btnVerifyOTP.disabled = true;
        }
    };
    
    otpInput.addEventListener('input', updateVerifyBtnState);
    updateVerifyBtnState();

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

    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        if (!email) return;

        btnSendOTP.disabled = true;
        btnSendOTP.textContent = 'Đang gửi...';

        try {
            const response = await fetch(`${API_URL}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                currentEmail = email;
                document.getElementById('displayEmail').textContent = currentEmail;
                showStep(stepOtp);
                Swal.fire({
                    icon: 'success',
                    title: 'Thành công!',
                    text: data.message,
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Lỗi',
                    text: data.message
                });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Lỗi kết nối',
                text: 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.'
            });
        } finally {
            btnSendOTP.disabled = false;
            btnSendOTP.textContent = 'Gửi mã xác nhận';
        }
    });

    verifyOtpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otp = otpInput.value.trim();
        if (!otp) return;

        btnVerifyOTP.disabled = true;
        btnVerifyOTP.textContent = 'Đang kiểm tra...';

        try {
            const response = await fetch(`${API_URL}/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentEmail, otp })
            });

            const data = await response.json();

            if (response.ok) {
                showStep(stepReset);
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Lỗi xác thực',
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
            btnVerifyOTP.disabled = false;
            btnVerifyOTP.textContent = 'Xác nhận';
        }
    });

    resendOtpBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!currentEmail) return;

        resendOtpBtn.style.pointerEvents = 'none';
        resendOtpBtn.textContent = 'Đang gửi...';

        try {
            const response = await fetch(`${API_URL}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentEmail })
            });

            const data = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Đã gửi lại',
                    text: 'Mã OTP mới đã được gửi đến email của bạn.',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Lỗi',
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
            resendOtpBtn.style.pointerEvents = 'auto';
            resendOtpBtn.textContent = 'Gửi lại';
        }
    });

    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = newPasswordInput.value.trim();
        const confirmNewPassword = confirmNewPasswordInput.value.trim();
        const otp = otpInput.value.trim();

        if (newPassword.length < 6) {
            Swal.fire({ icon: 'warning', title: 'Lưu ý', text: 'Mật khẩu phải có ít nhất 6 ký tự.' });
            return;
        }

        if (newPassword !== confirmNewPassword) {
            Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Mật khẩu xác nhận không khớp.' });
            return;
        }

        btnResetPassword.disabled = true;
        btnResetPassword.innerHTML = '&nbsp; Đang gửi mã...';

        try {
            const response = await fetch(`${API_URL}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentEmail, otp, newPassword })
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
