const API_URL = "http://localhost:3000/api"; 

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (error) {
        await Swal.fire({
            icon: 'error',
            title: 'Đăng nhập thất bại',
            text: 'Bạn đã từ chối cấp quyền cho ứng dụng.'
        });
        window.location.href = 'login.html';
        return;
    }

    if (!code) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/github`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
            }
            
            const user = data.user;
            let redirectUrl = '../user/userHome.html';
            
            if (user && user.VaiTro === 'Admin') {
                redirectUrl = '../admin/adminDashboard.html';
            }

            const lastVisitedPage = localStorage.getItem("lastVisitedPage");
            if (lastVisitedPage && !lastVisitedPage.includes("login.html") && !lastVisitedPage.includes("register.html")) {
                redirectUrl = lastVisitedPage;
            }

            window.location.href = redirectUrl;
        } else {
            await Swal.fire({
                icon: 'error',
                title: 'Đăng nhập thất bại',
                text: data.message || 'Có lỗi xảy ra khi xử lý Github OAuth.'
            });
            window.location.href = 'login.html';
        }
    } catch (err) {
        console.error('Github callback error:', err);
        await Swal.fire({
            icon: 'error',
            title: 'Lỗi kết nối',
            text: 'Không thể kết nối đến máy chủ. Vui lòng thử lại.'
        });
        window.location.href = 'login.html';
    }
});
