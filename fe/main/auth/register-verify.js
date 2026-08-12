import { API_URL } from '../shared/config.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerDataStr = sessionStorage.getItem('registerData');

    if (!registerDataStr) {
        window.location.href = 'register.html';
        return;
    }

    let registerData = null;
    try {
        registerData = JSON.parse(registerDataStr);
    } catch (e) {
        console.error('Lỗi khi đọc dữ liệu đăng ký', e);
        window.location.href = 'register.html';
        return;
    }

    const displayEmail = document.getElementById('displayEmail');
    if (displayEmail) {
        displayEmail.textContent = registerData.email || '';
    }

    const verifyForm = document.getElementById('verifyRegisterOtpForm');
    const otpInput = document.getElementById('otpCode');
    const btnVerifyOTP = document.getElementById('btnVerifyOTP');
    const btnResendOtp = document.getElementById('resendOtp');

    if (btnVerifyOTP) {
        btnVerifyOTP.disabled = true;
        btnVerifyOTP.style.opacity = '0.5';
        btnVerifyOTP.style.cursor = 'not-allowed';
    }

    const checkOtpInput = () => {
        if (!otpInput || !btnVerifyOTP) return;
        const val = otpInput.value.trim();
        const isValid = /^\d{6}$/.test(val);
        if (isValid) {
            btnVerifyOTP.disabled = false;
            btnVerifyOTP.style.opacity = '1';
            btnVerifyOTP.style.cursor = 'pointer';
        } else {
            btnVerifyOTP.disabled = true;
            btnVerifyOTP.style.opacity = '0.5';
            btnVerifyOTP.style.cursor = 'not-allowed';
        }
    };

    if (otpInput) {
        otpInput.addEventListener('input', checkOtpInput);
    }

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });

    if (verifyForm) {
        verifyForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const otp = otpInput.value.trim();
            if (!otp || otp.length !== 6) {
                Toast.fire({ icon: 'warning', title: 'Vui lòng nhập đủ 6 số OTP.' });
                return;
            }

            const originalText = btnVerifyOTP.innerHTML;
            btnVerifyOTP.disabled = true;
            btnVerifyOTP.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;></i>Đang xử lý...';
            btnVerifyOTP.style.opacity = '0.7';
            btnVerifyOTP.style.cursor = 'not-allowed';

            try {
                const payload = { ...registerData, otp };

                const response = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (!response.ok) {
                    btnVerifyOTP.disabled = false;
                    btnVerifyOTP.innerHTML = originalText;
                    btnVerifyOTP.style.opacity = '1';
                    btnVerifyOTP.style.cursor = 'pointer';
                    Toast.fire({ icon: 'error', title: data.message || 'Đăng ký thất bại' });
                } else {
                    Swal.fire({
                        icon: 'success',
                        title: 'Thành công',
                        text: 'Đăng ký tài khoản thành công!',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    sessionStorage.removeItem('registerData');
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                }
            } catch (error) {
                console.error(error);
                btnVerifyOTP.disabled = false;
                btnVerifyOTP.innerHTML = originalText;
                btnVerifyOTP.style.opacity = '1';
                btnVerifyOTP.style.cursor = 'pointer';
                Toast.fire({ icon: 'error', title: 'Không thể kết nối đến máy chủ' });
            }
        });
    }

    if (btnResendOtp) {
        btnResendOtp.addEventListener('click', async (e) => {
            e.preventDefault();

            if (btnResendOtp.classList.contains('disabled')) return;

            btnResendOtp.classList.add('disabled');
            const originalText = btnResendOtp.innerHTML;
            btnResendOtp.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';

            try {
                const response = await fetch(`${API_URL}/register/send-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hoTen: registerData.hoTen, email: registerData.email })
                });

                const data = await response.json();

                if (!response.ok) {
                    Toast.fire({ icon: 'error', title: data.message || 'Lỗi gửi mã OTP' });
                    btnResendOtp.classList.remove('disabled');
                    btnResendOtp.innerHTML = originalText;
                } else {
                    Toast.fire({ icon: 'success', title: 'Mã OTP mới đã được gửi' });

                    let secondsLeft = 60;
                    const timerInterval = setInterval(() => {
                        btnResendOtp.innerHTML = `Gửi lại sau ${secondsLeft}s`;
                        secondsLeft--;
                        if (secondsLeft < 0) {
                            clearInterval(timerInterval);
                            btnResendOtp.classList.remove('disabled');
                            btnResendOtp.innerHTML = originalText;
                        }
                    }, 1000);
                }
            } catch (error) {
                console.error(error);
                btnResendOtp.classList.remove('disabled');
                btnResendOtp.innerHTML = originalText;
                Toast.fire({ icon: 'error', title: 'Không thể kết nối đến máy chủ' });
            }
        });
    }
});
