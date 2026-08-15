export const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const isValidName = (name) => {
    const nameRegex = /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ\s]{2,50}$/;
    return nameRegex.test(name.trim());
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

export const getRefreshToken = () => {
    return localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
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

export const saveLoginSession = ({ token, refreshToken, avatarURL, rememberLogin }) => {
    const persistentStorage = rememberLogin ? localStorage : sessionStorage;
    const otherStorage = rememberLogin ? sessionStorage : localStorage;

    otherStorage.removeItem('isLoggedIn');
    otherStorage.removeItem('token');
    otherStorage.removeItem('refreshToken');
    otherStorage.removeItem('avatar');
    otherStorage.removeItem('userId');
    otherStorage.removeItem('userRole');

    persistentStorage.setItem('isLoggedIn', 'true');
    persistentStorage.setItem('token', token);
    persistentStorage.setItem('refreshToken', refreshToken);

    const decoded = decodeJWT(token);
    if (decoded) {
        persistentStorage.setItem('userId', decoded.MaND);
        persistentStorage.setItem('userRole', decoded.VaiTro);
    }

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
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('avatar');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('avatar');
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('userRole');
};

export const checkAuth = () => {
    const token = getToken();
    if (!token) return null;
    return decodeJWT(token);
};

export const escapeHTML = (str) => {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, match => {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[match];
    });
};

export const stripHTML = (html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
};

export const formatRatingSummary = (average, count) => {
    const ratingCount = Number(count || 0);
    const ratingAverage = Number.parseFloat(average || 0).toFixed(1);
    return `${ratingAverage} (${ratingCount.toLocaleString('vi-VN')} đánh giá)`;
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

    if (icon === 'success' && typeof window.refreshSidebarBadges === 'function') {
        window.refreshSidebarBadges();
    }
};

let isSessionExpiredAlertShown = false;
let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
    refreshSubscribers.push(cb);
};

const onRefreshed = (token) => {
    refreshSubscribers.map(cb => cb(token));
    refreshSubscribers = [];
};

const originalFetch = window.fetch;
window.fetch = async function () {
    let url = arguments[0];
    let options = arguments[1] || {};

    if (typeof url === 'string' && url.includes('/api/')) {
        const token = getToken();
        if (token) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };
        }
        arguments[1] = options;
    }

    let response = await originalFetch.apply(this, arguments);

    if (response.status === 401) {
        if (typeof url === 'string' && url.includes('/api/') && !url.includes('/login') && !url.includes('/register') && !url.includes('/refresh-token')) {
            const refreshToken = getRefreshToken();

            if (refreshToken) {
                if (!isRefreshing) {
                    isRefreshing = true;
                    try {
                        const refreshRes = await originalFetch('http://localhost:3000/api/refresh-token', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include'
                        });

                        if (refreshRes.ok) {
                            isRefreshing = false;
                            onRefreshed(true);

                            options.credentials = 'include';
                            return await originalFetch(url, options);
                        } else {
                            throw new Error('Refresh token invalid');
                        }
                    } catch (error) {
                        isRefreshing = false;
                        refreshSubscribers = [];
                        clearAuthSession();
                        redirectToLogin();
                        return response;
                    }
                } else {
                    return new Promise((resolve) => {
                        subscribeTokenRefresh(() => {
                            options.credentials = 'include';
                            resolve(originalFetch(url, options));
                        });
                    });
                }
            } else {
                clearAuthSession();
                redirectToLogin();
            }
        }
    }
    return response;
};

function redirectToLogin() {
    if (!isSessionExpiredAlertShown) {
        isSessionExpiredAlertShown = true;
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'warning',
                title: 'Phiên đăng nhập hết hạn',
                text: 'Phiên đăng nhập của bạn đã hết hạn, vui lòng đăng nhập lại để tiếp tục.',
                confirmButtonText: 'Đăng nhập',
                allowOutsideClick: false
            }).then(() => {
                window.location.href = '../auth/login.html';
            });
        } else {
            alert('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
            window.location.href = '../auth/login.html';
        }
    }
}

export const getTimeBasedGreeting = (type = 'home') => {
    const hour = new Date().getHours();

    let timeOfDay = '';
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 18) timeOfDay = 'afternoon';
    else if (hour >= 18 && hour < 22) timeOfDay = 'evening';
    else timeOfDay = 'night';

    const greetings = {
        home: {
            morning: ["Chào buổi sáng", "Bắt đầu ngày mới đầy năng lượng nhé", "Chúc buổi sáng tốt lành", "Ngày mới vui vẻ"],
            afternoon: ["Chào buổi chiều", "Nghỉ ngơi một chút rồi học tiếp nhé", "Buổi chiều hiệu quả", "Chào buổi chiều nắng ấm"],
            evening: ["Chào buổi tối", "Buổi tối an lành", "Chúc bạn một buổi tối thư giãn", "Đã ăn tối chưa?"],
            night: ["Chào cú đêm", "Đừng thức quá khuya nhé", "Học khuya vất vả rồi", "Chúc bạn ngủ ngon sau khi học xong"]
        },
        login: {
            morning: ["Chào ngày mới! Bắt đầu học thôi.", "Đăng nhập thành công! Buổi sáng tốt lành.", "Chào buổi sáng năng lượng!"],
            afternoon: ["Đăng nhập thành công! Chiều năng suất nhé.", "Chào buổi chiều! Cùng chia sẻ tài liệu nào.", "Đăng nhập thành công!"],
            evening: ["Chào buổi tối! Bắt đầu học nhé.", "Đăng nhập thành công! Tối an lành.", "Buổi tối tuyệt vời để học tập!"],
            night: ["Chăm chỉ quá! Đăng nhập thành công.", "Cú đêm à? Chúc bạn học tốt.", "Đăng nhập thành công! Nhớ giữ gìn sức khỏe nhé."]
        },
        logout: {
            morning: ["Đăng xuất thành công. Hẹn gặp lại nhé!", "Tạm biệt! Chúc một ngày vui vẻ.", "Hẹn gặp lại bạn sớm nhé!"],
            afternoon: ["Đăng xuất thành công. Hẹn gặp lại nhé!", "Tạm biệt! Chúc một buổi chiều tốt lành.", "Nghỉ ngơi nhé, hẹn gặp lại!"],
            evening: ["Tạm biệt! Chúc buổi tối ấm áp.", "Đăng xuất thành công. Nghỉ ngơi nhé!", "Hẹn gặp lại vào ngày mai!"],
            night: ["Ngủ ngon nhé! Hẹn gặp lại.", "Khuya rồi, nghỉ ngơi thôi. Đăng xuất thành công!", "Tạm biệt cú đêm, ngủ ngon!"]
        }
    };

    const options = greetings[type][timeOfDay] || greetings[type]['morning'];
    return options[Math.floor(Math.random() * options.length)];
};

export const renderPagination = (containerId, totalPages, currentPage, onPageChange) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    totalPages = Math.max(1, totalPages || 1);
    currentPage = Math.max(1, currentPage || 1);

    container.innerHTML = '';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn prev-btn';
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prevBtn.disabled = currentPage === 1;
    if (currentPage > 1) {
        prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
    }
    container.appendChild(prevBtn);

    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
        const firstPageBtn = document.createElement('button');
        firstPageBtn.className = 'page-btn';
        firstPageBtn.textContent = '1';
        firstPageBtn.addEventListener('click', () => onPageChange(1));
        container.appendChild(firstPageBtn);

        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.className = 'page-dots';
            dots.textContent = '...';
            container.appendChild(dots);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        if (i !== currentPage) {
            pageBtn.addEventListener('click', () => onPageChange(i));
        }
        container.appendChild(pageBtn);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.className = 'page-dots';
            dots.textContent = '...';
            container.appendChild(dots);
        }

        const lastPageBtn = document.createElement('button');
        lastPageBtn.className = 'page-btn';
        lastPageBtn.textContent = totalPages;
        lastPageBtn.addEventListener('click', () => onPageChange(totalPages));
        container.appendChild(lastPageBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn next-btn';
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    nextBtn.disabled = currentPage === totalPages;
    if (currentPage < totalPages) {
        nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
    }
    container.appendChild(nextBtn);
};

export const renderDocumentSkeleton = (count = 6) => {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="doc-card skeleton-card skeleton-box">
                <div class="skeleton-thumb skeleton-box"></div>
                <div class="skeleton-content">
                    <div class="skeleton-meta">
                        <div class="skeleton-text skeleton-box"></div>
                        <div class="skeleton-text skeleton-box" style="width: 25%;"></div>
                    </div>
                    <div class="skeleton-title skeleton-box"></div>
                    <div class="skeleton-desc skeleton-box"></div>
                    <div class="skeleton-desc short skeleton-box"></div>
                    <div class="skeleton-footer">
                        <div class="skeleton-author">
                            <div class="skeleton-avatar skeleton-box"></div>
                            <div class="skeleton-name skeleton-box"></div>
                        </div>
                        <div class="skeleton-stats skeleton-box"></div>
                    </div>
                </div>
            </div>
        `;
    }
    return html;
};

export const renderGroupSkeleton = (count = 6) => {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="group-card skeleton-card skeleton-box">
                <div class="skeleton-group-cover skeleton-box"></div>
                <div class="skeleton-group-info">
                    <div class="skeleton-group-title skeleton-box"></div>
                    <div class="skeleton-group-desc skeleton-box"></div>
                    <div class="skeleton-group-desc skeleton-box" style="width: 80%;"></div>
                    <div class="skeleton-group-meta skeleton-box"></div>
                </div>
            </div>
        `;
    }
    return html;
};

export const renderCommentSkeleton = (count = 3) => {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-comment">
                <div class="skeleton-avatar skeleton-box"></div>
                <div class="skeleton-comment-content">
                    <div class="skeleton-name skeleton-box"></div>
                    <div class="skeleton-text-line skeleton-box"></div>
                    <div class="skeleton-text-line short skeleton-box"></div>
                </div>
            </div>
        `;
    }
    return html;
};


// --- TOAST INTERCEPTOR SYSTEM ---
// Globally override alert() and simple Swal.fire() calls to use Toast notifications.
if (typeof window !== 'undefined') {
    window.alert = function(msg) {
        if (typeof Swal !== 'undefined') {
            Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true }).fire({ icon: 'info', title: msg });
        } else {
            console.log("ALERT:", msg);
        }
    };

    if (window.Swal) {
        const originalFire = window.Swal.fire;
        window.Swal.fire = function(...args) {
            let isSimpleAlert = false;
            let icon = 'info';
            let title = '';
            let text = '';
            
            if (args.length === 1 && typeof args[0] === 'string') {
                isSimpleAlert = true;
                title = args[0];
            } else if (args.length >= 2 && typeof args[0] === 'string') {
                isSimpleAlert = true;
                title = args[0];
                text = args[1] || '';
                icon = args[2] || 'info';
                if (icon === 'question') isSimpleAlert = false;
            } else if (args.length === 1 && typeof args[0] === 'object') {
                const opt = args[0];
                if (!opt.showCancelButton && !opt.input && !opt.showDenyButton && !opt.html && !opt.toast) {
                    if (opt.didOpen && opt.showConfirmButton === false && !opt.timer) {
                        isSimpleAlert = false; // Loading modal
                    } else if (opt.title === 'Đang đăng xuất...' || opt.title === 'Đang tải...') {
                        isSimpleAlert = false; // Explicit loading titles
                    } else {
                        isSimpleAlert = true;
                        icon = opt.icon || 'info';
                        title = opt.title || '';
                        text = opt.text || '';
                    }
                }
            }
            
            if (isSimpleAlert) {
                const Toast = window.Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true,
                    didOpen: (toast) => {
                        toast.addEventListener('mouseenter', window.Swal.stopTimer)
                        toast.addEventListener('mouseleave', window.Swal.resumeTimer)
                    }
                });
                let finalTitle = title;
                if (text && text !== title) {
                    finalTitle = finalTitle ? `${finalTitle}: ${text}` : text;
                }
                // Strip HTML tags for clean toast
                if (typeof finalTitle === 'string') {
                   finalTitle = finalTitle.replace(/<[^>]*>?/gm, '');
                }
                return Toast.fire({ icon, title: finalTitle, toast: true });
            }
            
            return originalFire.apply(this, args);
        };
    }
}
// --------------------------------
