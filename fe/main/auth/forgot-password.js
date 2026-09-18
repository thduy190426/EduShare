document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000/api';

    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const emailInput = document.getElementById('resetEmail');
    const btnSendOTP = document.getElementById('btnSendOTP');

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

    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        if (!email) return;

        btnSendOTP.disabled = true;
        btnSendOTP.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Đang gửi...';

        try {
            const response = await fetch(`${API_URL}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Thành công!',
                    text: 'Vui lòng kiểm tra email của bạn để lấy link đổi mật khẩu.',
                    confirmButtonText: 'Đã hiểu'
                });
                emailInput.value = '';
                updateBtnState();
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
            btnSendOTP.innerHTML = '<i class="fa-solid fa-paper-plane" style="margin-right: 8px;"></i> Gửi link khôi phục';
        }
    });
});
