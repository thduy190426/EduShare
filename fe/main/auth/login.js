import { API_URL } from '../shared/config.js';
import { isValidEmail, saveLoginSession } from '../shared/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    const loginSubmitBtn = loginForm?.querySelector('button[type="submit"]');
    if (loginSubmitBtn) {
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.style.opacity = '0.5';
        loginSubmitBtn.style.cursor = 'not-allowed';
        loginSubmitBtn.style.transition = 'all 0.3s ease';
    }

    const validateLoginForm = () => {
        if (!loginSubmitBtn) return;
        const email = document.getElementById('loginEmail')?.value.trim() || '';
        const matKhau = document.getElementById('loginPassword')?.value || '';
        
        if (isValidEmail(email) && matKhau.length > 0) {
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.style.opacity = '1';
            loginSubmitBtn.style.cursor = 'pointer';
        } else {
            loginSubmitBtn.disabled = true;
            loginSubmitBtn.style.opacity = '0.5';
            loginSubmitBtn.style.cursor = 'not-allowed';
        }
    };

    if (loginForm) {
        document.getElementById('loginEmail')?.addEventListener('input', validateLoginForm);
        document.getElementById('loginPassword')?.addEventListener('input', validateLoginForm);
    }

    const toggleLoginPassword = document.getElementById('toggleLoginPassword');
    const loginPassword = document.getElementById('loginPassword');
    const toggleLoginIcon = document.getElementById('toggleLoginIcon');

    if (toggleLoginPassword && loginPassword) {
        toggleLoginPassword.addEventListener('click', () => {
            const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
            loginPassword.setAttribute('type', type);
            toggleLoginIcon.classList.toggle('fa-eye');
            toggleLoginIcon.classList.toggle('fa-eye-slash');
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value.trim();
            const matKhau = document.getElementById('loginPassword').value;
            const rememberLogin = document.getElementById('rememberLogin')?.checked ?? true;
            
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

            if (!isValidEmail(email)) {
                Toast.fire({ icon: 'error', title: 'Email không hợp lệ.' });
                return;
            }
            if (matKhau.length === 0) {
                Toast.fire({ icon: 'error', title: 'Vui lòng nhập mật khẩu.' });
                return;
            }

            try {
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>&nbsp; Đang xử lý...';

                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, matKhau, rememberLogin })
                });

                const data = await response.json();

                if (!response.ok) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                    submitBtn.innerHTML = originalText;
                    Toast.fire({ icon: 'error', title: data.message || 'Đăng nhập thất bại' });
                } else {
                    Toast.fire({ icon: 'success', title: 'Đăng nhập thành công! Đang chuyển hướng...' });
                    
                    saveLoginSession({
                        token: data.token,
                        avatarURL: data.avatarURL,
                        rememberLogin
                    });

                    let vaiTro = 'SinhVien';
                    try {
                        const base64Url = data.token.split('.')[1];
                        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                        }).join(''));
                        const payload = JSON.parse(jsonPayload);
                        vaiTro = payload.VaiTro;
                    } catch (e) {
                        console.error('Lỗi giải mã token:', e);
                    }

                    setTimeout(() => {
                        if (vaiTro === 'Admin') {
                            window.location.href = '../admin/adminDashboard.html';
                        } else {
                            window.location.href = '../user/userHome.html';
                        }
                    }, 1500);
                }
            } catch (error) {
                console.error(error);
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                submitBtn.innerHTML = 'Đăng nhập';
                Toast.fire({ icon: 'error', title: 'Không thể kết nối đến máy chủ' });
            }
        });
    }
});

