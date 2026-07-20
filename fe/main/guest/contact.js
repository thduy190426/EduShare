import { API_URL } from "../shared/config.js";

document.addEventListener("DOMContentLoaded", () => {
    const contactForm = document.getElementById("contactForm");
    const btnSubmit = document.getElementById("btn-submit");
    const inputName = document.getElementById("input-name");
    const inputEmail = document.getElementById("input-email");
    const inputSubject = document.getElementById("input-subject");
    const inputMessage = document.getElementById("input-message");

    function validateForm() {
        const name = inputName.value.trim();
        const email = inputEmail.value.trim();
        const subject = inputSubject.value.trim();
        const message = inputMessage.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (name && emailRegex.test(email) && subject && message) {
            btnSubmit.disabled = false;
            btnSubmit.style.opacity = '1';
            btnSubmit.style.cursor = 'pointer';
        } else {
            btnSubmit.disabled = true;
            btnSubmit.style.opacity = '0.5';
            btnSubmit.style.cursor = 'not-allowed';
        }
    }

    if (contactForm) {
        inputName.addEventListener("input", validateForm);
        inputEmail.addEventListener("input", validateForm);
        inputSubject.addEventListener("input", validateForm);
        inputMessage.addEventListener("input", validateForm);

        contactForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const name = document.getElementById("input-name").value.trim();
            const email = document.getElementById("input-email").value.trim();
            const subject = document.getElementById("input-subject").value.trim();
            const message = document.getElementById("input-message").value.trim();

            if (!name || !email || !subject || !message) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Thông báo',
                    text: 'Vui lòng điền đầy đủ thông tin vào form.'
                });
                return;
            }

            const recaptchaToken = typeof grecaptcha !== 'undefined' ? grecaptcha.getResponse() : '';
            if (!recaptchaToken) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Thông báo',
                    text: 'Vui lòng xác nhận bạn không phải người máy'
                });
                return;
            }

            const btnSubmit = document.getElementById("btn-submit");
            const originalBtnText = btnSubmit.innerHTML;
            btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>Đang gửi...';
            btnSubmit.disabled = true;

            try {
                const response = await fetch(`${API_URL}/contact`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name, email, subject, message, recaptchaToken })
                });

                const data = await response.json();

                if (response.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Gửi thành công!',
                        text: data.message || 'Cảm ơn bạn đã liên hệ. Chúng tôi sẽ phản hồi sớm nhất.'
                    });
                    contactForm.reset();
                    validateForm();
                } else {
                    if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
                    Swal.fire({
                        icon: 'error',
                        title: 'Lỗi gửi tin nhắn',
                        text: data.message || 'Có lỗi xảy ra, vui lòng thử lại.'
                    });
                }
            } catch (error) {
                console.error("Lỗi khi gửi liên hệ:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Lỗi kết nối',
                    text: 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.'
                });
                if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
            } finally {
                btnSubmit.innerHTML = originalBtnText;
                btnSubmit.disabled = false;
            }
        });
    }
});
