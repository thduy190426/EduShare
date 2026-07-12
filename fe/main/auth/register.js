import { API_URL } from '../shared/config.js';
import { isValidEmail } from '../shared/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    
    const registerSubmitBtn = registerForm?.querySelector('button[type="submit"]');
    if (registerSubmitBtn) {
        registerSubmitBtn.disabled = true;
        registerSubmitBtn.style.opacity = '0.5';
        registerSubmitBtn.style.cursor = 'not-allowed';
        registerSubmitBtn.style.transition = 'all 0.3s ease';
    }

    const validateRegisterForm = () => {
        if (!registerSubmitBtn) return;
        const hoTen = document.getElementById('registerName')?.value.trim() || '';
        const email = document.getElementById('registerEmail')?.value.trim() || '';
        const matKhau = document.getElementById('registerPassword')?.value || '';
        const xacNhanMatKhau = document.getElementById('registerConfirmPassword')?.value || '';
        const agreeTerms = document.getElementById('registerAgreeTerms')?.checked || false;
        
        if (hoTen.length >= 2 && isValidEmail(email) && matKhau.length >= 6 && matKhau === xacNhanMatKhau && agreeTerms) {
            registerSubmitBtn.disabled = false;
            registerSubmitBtn.style.opacity = '1';
            registerSubmitBtn.style.cursor = 'pointer';
        } else {
            registerSubmitBtn.disabled = true;
            registerSubmitBtn.style.opacity = '0.5';
            registerSubmitBtn.style.cursor = 'not-allowed';
        }
    };

    if (registerForm) {
        document.getElementById('registerName')?.addEventListener('input', validateRegisterForm);
        document.getElementById('registerEmail')?.addEventListener('input', validateRegisterForm);
        document.getElementById('registerPassword')?.addEventListener('input', validateRegisterForm);
        document.getElementById('registerConfirmPassword')?.addEventListener('input', validateRegisterForm);
        document.getElementById('registerAgreeTerms')?.addEventListener('change', validateRegisterForm);
    }

    const toggleRegisterPassword = document.getElementById('toggleRegisterPassword');
    const registerPassword = document.getElementById('registerPassword');
    const toggleRegisterIcon = document.getElementById('toggleRegisterIcon');

    if (toggleRegisterPassword && registerPassword) {
        toggleRegisterPassword.addEventListener('click', () => {
            const type = registerPassword.getAttribute('type') === 'password' ? 'text' : 'password';
            registerPassword.setAttribute('type', type);
            toggleRegisterIcon.classList.toggle('fa-eye');
            toggleRegisterIcon.classList.toggle('fa-eye-slash');
        });
    }

    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
    const registerConfirmPassword = document.getElementById('registerConfirmPassword');
    const toggleConfirmIcon = document.getElementById('toggleConfirmIcon');

    if (toggleConfirmPassword && registerConfirmPassword) {
        toggleConfirmPassword.addEventListener('click', () => {
            const type = registerConfirmPassword.getAttribute('type') === 'password' ? 'text' : 'password';
            registerConfirmPassword.setAttribute('type', type);
            toggleConfirmIcon.classList.toggle('fa-eye');
            toggleConfirmIcon.classList.toggle('fa-eye-slash');
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const hoTen = document.getElementById('registerName').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const matKhau = document.getElementById('registerPassword').value;
            const xacNhanMatKhau = document.getElementById('registerConfirmPassword') ? document.getElementById('registerConfirmPassword').value : matKhau;
            const selectedRole = document.querySelector('input[name="role"]:checked')?.value || 'student';
            const roleMap = {
                student: 'SinhVien',
                teacher: 'GiaoVien'
            };
            const vaiTro = roleMap[selectedRole];

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

            if (hoTen.length < 2) {
                Toast.fire({ icon: 'warning', title: 'Họ tên phải có ít nhất 2 ký tự.' });
                return;
            }
            if (!isValidEmail(email)) {
                Toast.fire({ icon: 'warning', title: 'Email không hợp lệ.' });
                return;
            }
            if (matKhau.length < 6) {
                Toast.fire({ icon: 'warning', title: 'Mật khẩu phải có ít nhất 6 ký tự.' });
                return;
            }
            if (matKhau !== xacNhanMatKhau) {
                Toast.fire({ icon: 'warning', title: 'Mật khẩu xác nhận không khớp.' });
                return;
            }

            if (!vaiTro) {
                Toast.fire({ icon: 'warning', title: 'Vai trò tài khoản không hợp lệ.' });
                return;
            }

            try {
                const submitBtn = registerForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>Đang xử lý...';

                const response = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hoTen, email, matKhau, vaiTro })
                });

                const data = await response.json();

                if (!response.ok) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                    submitBtn.innerHTML = originalText;
                    Toast.fire({ icon: 'error', title: data.message || 'Đăng ký thất bại' });
                } else {
                    Toast.fire({ icon: 'success', title: 'Đăng ký thành công! Đang chuyển hướng...' });
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 1500);
                }
            } catch (error) {
                console.error(error);
                const submitBtn = registerForm.querySelector('button[type="submit"]');
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                submitBtn.innerHTML = 'Đăng ký tài khoản';
                Toast.fire({ icon: 'error', title: 'Không thể kết nối đến máy chủ' });
            }
        });
    }
});

