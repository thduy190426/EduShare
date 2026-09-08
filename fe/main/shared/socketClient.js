import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";

const API_URL = window.API_URL || 'http://localhost:3000';
let socket = null;

export const getSocket = () => {
    if (!socket) {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) return null;

        socket = io(API_URL, {
            auth: { token }
        });

        socket.on('connect', () => {
        });

        socket.on('disconnect', () => {
        });

        socket.on('connect_error', (err) => {
            console.error('[Socket] Lỗi kết nối:', err.message);
        });

        socket.on('force_logout', (data) => {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Tài khoản bị khóa',
                    text: data.reason || 'Phiên đăng nhập đã bị chấm dứt do vi phạm tiêu chuẩn cộng đồng.',
                    confirmButtonText: 'Đóng',
                    allowOutsideClick: false
                }).then(() => {
                    localStorage.removeItem('token');
                    sessionStorage.removeItem('token');
                    localStorage.removeItem('user');
                    sessionStorage.removeItem('user');
                    window.location.href = '../auth/login.html';
                });
            } else {
                alert(data.reason || 'Phiên đăng nhập đã bị chấm dứt.');
                localStorage.removeItem('token');
                sessionStorage.removeItem('token');
                localStorage.removeItem('user');
                sessionStorage.removeItem('user');
                window.location.href = '../auth/login.html';
            }
        });
    }
    return socket;
};
