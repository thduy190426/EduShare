import { API_URL, fetchAppConfig } from '../shared/config.js';
import { isValidEmail, saveLoginSession, getTimeBasedGreeting } from '../shared/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const config = await fetchAppConfig();

    // 1. Initialize Facebook
    window.fbAsyncInit = function() {
        FB.init({
            appId      : config.facebookAppId || '',
            cookie     : true,
            xfbml      : true,
            version    : 'v20.0'
        });
    };
    const fbScript = document.createElement('script');
    fbScript.src = 'https://connect.facebook.net/vi_VN/sdk.js';
    fbScript.async = true;
    fbScript.defer = true;
    fbScript.crossOrigin = 'anonymous';
    document.head.appendChild(fbScript);

    // 2. Initialize Google Sign-In
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

    // 3. Initialize reCAPTCHA
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

    const loginForm = document.getElementById('loginForm');
    
    const lastLoginMethod = localStorage.getItem('lastLoginMethod');
    if (lastLoginMethod && loginForm) {
        let badgeHtml = '';
        if (lastLoginMethod === 'email') {
            badgeHtml = `<div class="last-login-badge" style="background-color: #E8F5E9; color: #2E7D32; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; text-align: center; margin-bottom: 24px; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #C8E6C9; box-shadow: 0 2px 4px rgba(46, 125, 50, 0.1);"><i class="fa-solid fa-envelope" style="font-size: 15px;"></i> Lần trước bạn đã dùng Email</div>`;
        } else if (lastLoginMethod === 'google') {
            badgeHtml = `<div class="last-login-badge" style="background-color: #FFF8E1; color: #F57F17; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; text-align: center; margin-bottom: 24px; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #FFECB3; box-shadow: 0 2px 4px rgba(245, 127, 23, 0.1);"><i class="fa-brands fa-google" style="font-size: 15px;"></i> Lần trước bạn đã dùng Google</div>`;
        } else if (lastLoginMethod === 'facebook') {
            badgeHtml = `<div class="last-login-badge" style="background-color: #E3F2FD; color: #1565C0; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; text-align: center; margin-bottom: 24px; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #BBDEFB; box-shadow: 0 2px 4px rgba(21, 101, 192, 0.1);"><i class="fa-brands fa-facebook" style="font-size: 15px;"></i> Lần trước bạn đã dùng Facebook</div>`;
        }
        loginForm.insertAdjacentHTML('beforebegin', `<div style="text-align:center; animation: fadeInDown 0.5s ease-out;">${badgeHtml}</div>`);
        
        if (!document.getElementById('badge-animation')) {
            const style = document.createElement('style');
            style.id = 'badge-animation';
            style.innerHTML = `@keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`;
            document.head.appendChild(style);
        }
    }
    
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
        
        if (isValidEmail(email) && matKhau.length > 0 && window.isCaptchaSolved) {
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.style.opacity = '1';
            loginSubmitBtn.style.cursor = 'pointer';
        } else {
            loginSubmitBtn.disabled = true;
            loginSubmitBtn.style.opacity = '0.5';
            loginSubmitBtn.style.cursor = 'not-allowed';
        }
    };
    window.validateLoginForm = validateLoginForm;

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

            const recaptchaToken = typeof grecaptcha !== 'undefined' ? grecaptcha.getResponse() : '';
            if (!recaptchaToken) {
                Toast.fire({ icon: 'warning', title: 'Vui lòng xác nhận bạn không phải người máy' });
                return;
            }

            try {
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>&nbsp; Đang đăng nhập...';

                document.body.style.pointerEvents = 'none';
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        title: 'Đang đăng nhập...',
                        text: 'Vui lòng chờ giây lát',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        showConfirmButton: false,
                        didOpen: () => {
                            Swal.showLoading();
                        }
                    });
                }

                const [response] = await Promise.all([
                    fetch(`${API_URL}/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, matKhau, rememberLogin, recaptchaToken })
                    }),
                    new Promise(resolve => setTimeout(resolve, 1000))
                ]);

                const data = await response.json();

                if (!response.ok) {
                    document.body.style.pointerEvents = 'auto';
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                    submitBtn.innerHTML = originalText;
                    if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
                    Swal.fire({
                        icon: 'error',
                        title: 'Đăng nhập thất bại',
                        text: data.message || 'Email hoặc mật khẩu không đúng'
                    });
                } else if (data.require2FA) {
                    Swal.close();
                    document.body.style.pointerEvents = 'auto';
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                    submitBtn.innerHTML = originalText;
                    
                    const { value: totpCode } = await Swal.fire({
                        title: 'Xác thực 2 bước',
                        html: '<p>Tài khoản của bạn đã được bảo vệ bằng 2FA.</p><p>Vui lòng nhập mã 6 số từ Google Authenticator:</p>',
                        input: 'text',
                        inputAttributes: {
                            maxlength: 6,
                            autocapitalize: 'off',
                            autocorrect: 'off',
                            style: 'text-align: center; font-size: 24px; letter-spacing: 4px;'
                        },
                        showCancelButton: true,
                        confirmButtonText: 'Xác nhận',
                        cancelButtonText: 'Hủy',
                        allowOutsideClick: false,
                        preConfirm: (code) => {
                            if (!code || code.length !== 6) {
                                Swal.showValidationMessage('Vui lòng nhập đủ mã 6 số');
                            }
                            return code;
                        }
                    });
                    
                    if (totpCode) {
                        Swal.fire({
                            title: 'Đang xác thực...',
                            allowOutsideClick: false,
                            didOpen: () => { Swal.showLoading(); }
                        });
                        
                        const verifyRes = await fetch(`${API_URL}/auth/2fa/login`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tempToken: data.tempToken, totpCode })
                        });
                        const verifyData = await verifyRes.json();
                        
                        if (!verifyRes.ok) {
                            Swal.fire('Lỗi', verifyData.message || 'Mã xác thực không hợp lệ', 'error');
                            return;
                        }
                        
                        const greeting = getTimeBasedGreeting('login');
                        Toast.fire({ icon: 'success', title: greeting });
                        localStorage.setItem('lastLoginMethod', 'email');
                        
                        saveLoginSession({
                            token: verifyData.token,
                            refreshToken: verifyData.refreshToken,
                            avatarURL: verifyData.avatarURL,
                            rememberLogin
                        });

                        let vaiTro = 'SinhVien';
                        try {
                            const base64Url = verifyData.token.split('.')[1];
                            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                            }).join(''));
                            const payload = JSON.parse(jsonPayload);
                            vaiTro = payload.VaiTro;
                        } catch (e) {}

                        setTimeout(() => {
                            if (vaiTro === 'Admin') {
                                window.location.href = '../admin/adminDashboard.html';
                            } else {
                                window.location.href = '../user/userHome.html';
                            }
                        }, 1500);
                    }
                } else {
                    const greeting = getTimeBasedGreeting('login');
                    Toast.fire({ icon: 'success', title: greeting });
                    localStorage.setItem('lastLoginMethod', 'email');
                    
                    saveLoginSession({
                        token: data.token,
                        refreshToken: data.refreshToken,
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
                document.body.style.pointerEvents = 'auto';
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                submitBtn.innerHTML = 'Đăng nhập';
                if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
                Toast.fire({ icon: 'error', title: 'Không thể kết nối đến máy chủ' });
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
            localStorage.setItem('lastLoginMethod', 'google');
            saveLoginSession({
                token: data.token,
                refreshToken: null,
                avatarURL: data.user.AvatarURL,
                rememberLogin: true
            });
            localStorage.setItem('userId', data.user.MaND);
            localStorage.setItem('userRole', data.user.VaiTro);
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



    const facebookLoginBtn = document.getElementById('facebookLoginBtn');
    if (facebookLoginBtn) {
        facebookLoginBtn.addEventListener('click', () => {
            FB.login(function(response) {
                if (response.authResponse) {
                    handleFacebookLogin(response.authResponse.accessToken);
                } else {
                    console.log('User cancelled login or did not fully authorize.');
                }
            }, {scope: 'public_profile,email'});
        });
    }

window.handleFacebookLogin = async function(accessToken) {
    try {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Đang đăng nhập...',
                text: 'Vui lòng chờ giây lát',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
        }

        const res = await fetch(`${API_URL}/auth/facebook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken })
        });
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('lastLoginMethod', 'facebook');
            saveLoginSession({
                token: data.token,
                refreshToken: null,
                avatarURL: data.user.AvatarURL,
                rememberLogin: true
            });
            localStorage.setItem('userId', data.user.MaND);
            localStorage.setItem('userRole', data.user.VaiTro);
            if (typeof Swal !== 'undefined') {
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
                if (data.user.VaiTro === 'Admin') {
                    window.location.href = '../admin/adminDashboard.html';
                } else {
                    window.location.href = '../user/userHome.html';
                }
            }
        } else {
            if (typeof Swal !== 'undefined') Swal.fire('Lỗi', data.message || 'Đăng nhập Facebook thất bại', 'error');
        }
    } catch (error) {
        console.error('Lỗi đăng nhập Facebook:', error);
        if (typeof Swal !== 'undefined') Swal.fire('Lỗi', 'Không thể kết nối đến server', 'error');
    }
};
