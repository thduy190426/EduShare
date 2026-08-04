const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
const userSockets = new Map();

const initSocket = (server) => {
    io = socketIo(server, {
        cors: {
            origin: '*', 
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
        }
    });

    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Vui lòng đăng nhập'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'duytran_edu_secret_key');
            socket.user = decoded;
            next();
        } catch (err) {
            return next(new Error('Token không hợp lệ hoặc đã hết hạn'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.user.MaND.toString();
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);

        socket.on('join_document', (docId) => {
            socket.join(`document_${docId}`);
        });

        socket.on('join_group', (groupId) => {
            socket.join(`group_${groupId}`);
        });

        socket.on('leave_document', (docId) => {
            socket.leave(`document_${docId}`);
        });
        
        socket.on('leave_group', (groupId) => {
            socket.leave(`group_${groupId}`);
        });

        socket.on('disconnect', () => {
            if (userSockets.has(userId)) {
                userSockets.get(userId).delete(socket.id);
                if (userSockets.get(userId).size === 0) {
                    userSockets.delete(userId);
                }
            }
        });
    });

    return io;
};

const sendNotificationToUser = (userId, type, payload) => {
    if (!io) return;
    const sockets = userSockets.get(userId.toString());
    if (sockets) {
        sockets.forEach(socketId => {
            io.to(socketId).emit('notification', { type, data: payload });
        });
    }
};

const getIo = () => {
    if (!io) {
        throw new Error('Socket.io chưa được khởi tạo');
    }
    return io;
};

module.exports = { initSocket, getIo, sendNotificationToUser };
