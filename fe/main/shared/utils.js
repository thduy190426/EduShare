export const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const decodeJWT = (token) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Lỗi giải mã JWT:', e);
        return null;
    }
};

export const getToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
};

export const getAvatar = () => {
    return localStorage.getItem('avatar') || sessionStorage.getItem('avatar');
};

export const getAssetUrl = (url) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
    return `http://localhost:3000${url}`;
};

export const getUserProfileUrl = (maND, userPath = '../user/otherUserProfile.html') => {
    if (!maND) return '';
    return `${userPath}?id=${encodeURIComponent(maND)}`;
};

export const saveLoginSession = ({ token, avatarURL, rememberLogin }) => {
    const persistentStorage = rememberLogin ? localStorage : sessionStorage;
    const otherStorage = rememberLogin ? sessionStorage : localStorage;

    otherStorage.removeItem('token');
    otherStorage.removeItem('avatar');
    persistentStorage.setItem('token', token);

    if (avatarURL) {
        persistentStorage.setItem('avatar', avatarURL);
    } else {
        persistentStorage.removeItem('avatar');
    }
};

export const setAvatarForCurrentSession = (avatarURL) => {
    const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
    if (avatarURL) {
        storage.setItem('avatar', avatarURL);
    } else {
        storage.removeItem('avatar');
    }
};

export const clearAuthSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('avatar');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('avatar');
};

export const checkAuth = () => {
    const token = getToken();
    return token ? decodeJWT(token) : null;
};

export const escapeHTML = (str) => {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, match => {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[match];
    });
};

export const showToast = (icon, title) => {
    if (typeof Swal !== 'undefined') {
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
        Toast.fire({ icon, title });
    }
};
