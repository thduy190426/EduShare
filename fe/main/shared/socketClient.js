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
    }
    return socket;
};
