import { API_URL, fetchAppConfig } from '../shared/config.js';
import { isValidEmail, isValidName } from '../shared/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const config = await fetchAppConfig();

    const googleScript = document.createElement('script');
    googleScript.src = 'https://accounts.google.com/gsi/client';
    googleScript.async = true;
    googleScript.defer = true;
    googleScript.onload = () => {
        if (config.googleClientId) {
            google.accounts.id.initialize({
                client_id: config.googleClientId,
                callback: handleGoogleLogin
            });
            const btnContainer = document.getElementById('googleSigninBtnContainer');
            if (btnContainer) {
                google.accounts.id.renderButton(
                    btnContainer,
                    { theme: 'outline', size: 'large', width: 250 }
                );
            }
        }
    };
    document.head.appendChild(googleScript);

    window.onRecaptchaLoad = function() {
        const recaptchaContainer = document.getElementById('recaptcha-container');
        if (recaptchaContainer && config.recaptchaSiteKey) {
            grecaptcha.render(recaptchaContainer, {
                'sitekey': config.recaptchaSiteKey,
                'callback': enableSubmitBtn,
                'expired-callback': disableSubmitBtn
            });
        }
    };
    const recaptchaScript = document.createElement('script');
    recaptchaScript.src = 'https://www.google.com/recaptcha/api.js?render=explicit&onload=onRecaptchaLoad';
    recaptchaScript.async = true;
    recaptchaScript.defer = true;
    document.head.appendChild(recaptchaScript);

    const fetchSchoolsAndMajors = async () => {
        try {
            const [schoolRes, majorRes] = await Promise.all([
                fetch(`${API_URL}/truonghoc`),
                fetch(`${API_URL}/khoanganh`)
            ]);
            if (schoolRes.ok && majorRes.ok) {
                const schoolData = await schoolRes.json();
                const majorData = await majorRes.json();
                
                const schoolSelect = document.getElementById('registerSchool');
                const majorSelect = document.getElementById('registerMajor');
                
                if (schoolSelect) {
                    schoolData.truongHoc.forEach(school => {
                        const option = document.createElement('option');
                        option.value = school.TenTruong;
                        option.textContent = school.TenTruong;
                        schoolSelect.appendChild(option);
                    });
                }
                
                if (majorSelect) {
                    majorData.khoaNganh.forEach(major => {
                        const option = document.createElement('option');
                        option.value = major.TenKhoa;
                        option.textContent = major.TenKhoa;
                        majorSelect.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách trường/khoa:', error);
        }
    };
    fetchSchoolsAndMajors();

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
        
        if (isValidName(hoTen) && isValidEmail(email) && matKhau.length >= 6 && matKhau === xacNhanMatKhau && agreeTerms && window.isCaptchaSolved) {
            registerSubmitBtn.disabled = false;
            registerSubmitBtn.style.opacity = '1';
            registerSubmitBtn.style.cursor = 'pointer';
        } else {
            registerSubmitBtn.disabled = true;
            registerSubmitBtn.style.opacity = '0.5';
            registerSubmitBtn.style.cursor = 'not-allowed';
        }
    };
    window.validateRegisterForm = validateRegisterForm;

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
            
            const truongHoc = document.getElementById('registerSchool')?.value.trim() || '';
            const khoaNganh = document.getElementById('registerMajor')?.value.trim() || '';

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

            if (!isValidName(hoTen)) {
                Toast.fire({ icon: 'warning', title: 'Họ tên không hợp lệ (2-50 ký tự, không chứa số hoặc ký tự đặc biệt).' });
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

            const recaptchaToken = typeof grecaptcha !== 'undefined' ? grecaptcha.getResponse() : '';
            if (!recaptchaToken) {
                Toast.fire({ icon: 'warning', title: 'Vui lòng xác nhận bạn không phải người máy' });
                return;
            }

            try {
                const submitBtn = registerForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;"></i>&nbsp; Đang đăng kí...';

                const response = await fetch(`${API_URL}/register/send-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hoTen, email, recaptchaToken })
                });

                const data = await response.json();

                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                submitBtn.innerHTML = originalText;

                if (!response.ok) {
                    if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
                    Swal.fire({
                        icon: 'error',
                        title: 'Đăng ký thất bại',
                        text: data.message || 'Lỗi gửi mã OTP'
                    });
                } else {
                    Toast.fire({ icon: 'success', title: data.message || 'Mã OTP đã được gửi' });
                    
                    const matKhau = document.getElementById('registerPassword').value;
                    const truongHoc = document.getElementById('registerSchool')?.value.trim() || '';
                    const khoaNganh = document.getElementById('registerMajor')?.value.trim() || '';

                    const registerData = { hoTen, email, matKhau, truongHoc, khoaNganh };
                    sessionStorage.setItem('registerData', JSON.stringify(registerData));

                    setTimeout(() => {
                        window.location.href = 'register-verify.html';
                    }, 1000);
                }
            } catch (error) {
                console.error(error);
                const submitBtn = registerForm.querySelector('button[type="submit"]');
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                submitBtn.innerHTML = 'Đăng ký tài khoản';
                if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
                Swal.fire({
                    icon: 'error',
                    title: 'Lỗi kết nối',
                    text: 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.'
                });
            }
        });
    }
});

window.handleGoogleLogin = async function(response) {
    try {
        const res = await fetch('http://localhost:3000/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('userId', data.user.MaND);
            localStorage.setItem('userRole', data.user.VaiTro);
            localStorage.setItem('userAvatar', data.user.AvatarURL || '');
            
            Swal.fire({
                title: 'Đăng nhập thành công',
                text: 'Đang chuyển hướng...',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                if (data.user.VaiTro === 'Admin') {
                    window.location.href = '../admin/adminDashboard.html';
                } else {
                    window.location.href = '../user/userHome.html';
                }
            });
        } else {
            Swal.fire('Lỗi', data.message || 'Đăng nhập Google thất bại', 'error');
        }
    } catch (error) {
        console.error('Lỗi đăng nhập Google:', error);
        Swal.fire('Lỗi', 'Không thể kết nối đến server', 'error');
    }
};
