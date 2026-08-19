const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
const userSockets = new Map();
const chatCooldowns = new Map();

const initSocket = (server, app) => {
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
            io.emit('user_status_change', { userId, status: 'online' });
        }
        userSockets.get(userId).add(socket.id);

        socket.emit('initial_status', Array.from(userSockets.keys()));

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

        socket.on('send_message', async (data) => {
            const { receiverId, text, type, replyToId } = data;
            const senderId = socket.user.MaND;
            const messageType = type || 'text';
            if (!receiverId || !text || !text.trim()) return;

            try {
                const pool = app.locals.pool;

                const [blockCheck] = await pool.execute(
                    'SELECT DaChan FROM CAIDAT_CHAT WHERE (MaND = ? AND MaND_DoiTac = ?) OR (MaND = ? AND MaND_DoiTac = ?)',
                    [senderId, receiverId, receiverId, senderId]
                );
                const isBlocked = blockCheck.some(r => r.DaChan);
                if (isBlocked) {
                    return socket.emit('message_error', { message: 'Bạn không thể gửi tin nhắn cho người này.' });
                }

                const [result] = await pool.execute(
                    'INSERT INTO TINNHAN (NguoiGui, NguoiNhan, NoiDung, LoaiTinNhan, TraLoiCho_MaTN) VALUES (?, ?, ?, ?, ?)',
                    [senderId, receiverId, text.trim(), messageType, replyToId || null]
                );

                const messageObj = {
                    MaTN: result.insertId,
                    NguoiGui: senderId,
                    NguoiNhan: receiverId,
                    NoiDung: text.trim(),
                    NgayGui: new Date().toISOString(),
                    DaDoc: 0,
                    DaNhan: 0,
                    LoaiTinNhan: messageType,
                    DaThuHoi: 0,
                    Reactions: null,
                    TraLoiCho_MaTN: replyToId || null
                };

                const receiverSockets = userSockets.get(receiverId.toString());
                if (receiverSockets && receiverSockets.size > 0) {
                    receiverSockets.forEach(sockId => {
                        io.to(sockId).emit('receive_message', messageObj);
                    });

                    await pool.execute('UPDATE TINNHAN SET DaNhan = 1 WHERE MaTN = ?', [result.insertId]);
                    messageObj.DaNhan = 1;
                }

                socket.emit('message_sent', messageObj);

            } catch (err) {
                console.error('Lỗi khi gửi tin nhắn qua socket:', err);
            }
        });

        socket.on('send_group_message', async (data) => {
            const { groupId, text, type, replyToId, replyToName, replyToText, replyToType } = data;
            const senderId = socket.user.MaND;
            const messageType = type || 'text';
            if (!groupId || !text || !text.trim()) return;

            const now = Date.now();
            const lastMsgTime = chatCooldowns.get(senderId);
            if (lastMsgTime && now - lastMsgTime < 1500) {
                socket.emit('spam_warning', { message: 'Bạn đang nhắn tin quá nhanh. Vui lòng chờ 1.5 giây giữa các tin nhắn.' });
                return;
            }
            chatCooldowns.set(senderId, now);

            try {
                const pool = app.locals.pool;
                
                const [memberCheck] = await pool.execute('SELECT 1 FROM THANHVIEN_NHOM WHERE MaNhom = ? AND MaND = ?', [groupId, senderId]);
                if (memberCheck.length === 0) return;

                const [result] = await pool.execute(
                    'INSERT INTO TINNHAN_NHOM (MaNhom, MaND_Gui, NoiDung, LoaiTinNhan, TraLoiCho_MaTN) VALUES (?, ?, ?, ?, ?)',
                    [groupId, senderId, text.trim(), messageType, replyToId || null]
                );

                const [userRows] = await pool.execute('SELECT HoTen, AvatarURL FROM NGUOIDUNG WHERE MaND = ?', [senderId]);
                const senderName = userRows[0]?.HoTen || socket.user.HoTen;
                const senderAvatar = userRows[0]?.AvatarURL || socket.user.AvatarURL;

                const messageObj = {
                    MaTN: result.insertId,
                    MaNhom: groupId,
                    MaND_Gui: senderId,
                    HoTen: senderName,
                    AvatarURL: senderAvatar,
                    NoiDung: text.trim(),
                    NgayGui: new Date().toISOString(),
                    LoaiTinNhan: messageType,
                    DaThuHoi: 0,
                    DaChinhSua: 0,
                    Reactions: null,
                    TraLoiCho_MaTN: replyToId || null,
                    TraLoi_HoTen: replyToName || null,
                    TraLoi_NoiDung: replyToText || null,
                    TraLoi_LoaiTinNhan: replyToType || 'text'
                };

                io.to(`group_${groupId}`).emit('receive_group_message', messageObj);

            } catch (err) {
                console.error('Lỗi khi gửi tin nhắn nhóm qua socket:', err);
            }
        });

        socket.on('typing', (data) => {
            const receiverSockets = userSockets.get(data.receiverId.toString());
            if (receiverSockets) {
                receiverSockets.forEach(sockId => io.to(sockId).emit('typing', { senderId: socket.user.MaND }));
            }
        });

        socket.on('stop_typing', (data) => {
            const receiverSockets = userSockets.get(data.receiverId.toString());
            if (receiverSockets) {
                receiverSockets.forEach(sockId => io.to(sockId).emit('stop_typing', { senderId: socket.user.MaND }));
            }
        });

        socket.on('message_unsent', (data) => {
            const receiverSockets = userSockets.get(data.receiverId.toString());
            if (receiverSockets) {
                receiverSockets.forEach(sockId => io.to(sockId).emit('message_unsent', data));
            }
        });

        socket.on('message_edited', (data) => {
            const receiverSockets = userSockets.get(data.receiverId.toString());
            if (receiverSockets) {
                receiverSockets.forEach(sockId => io.to(sockId).emit('message_edited', data));
            }
        });

        socket.on('message_reacted', (data) => {
            const receiverSockets = userSockets.get(data.receiverId.toString());
            if (receiverSockets) {
                receiverSockets.forEach(sockId => io.to(sockId).emit('message_reacted', data));
            }
        });

        socket.on('group_message_unsent', (data) => {
            if (data.groupId) {
                io.to(`group_${data.groupId}`).emit('group_message_unsent', data);
            }
        });

        socket.on('group_message_edited', (data) => {
            if (data.groupId) {
                io.to(`group_${data.groupId}`).emit('group_message_edited', data);
            }
        });

        socket.on('group_message_reacted', (data) => {
            if (data.groupId) {
                io.to(`group_${data.groupId}`).emit('group_message_reacted', data);
            }
        });

        socket.on('disconnect', () => {
            if (userSockets.has(userId)) {
                userSockets.get(userId).delete(socket.id);
                if (userSockets.get(userId).size === 0) {
                    userSockets.delete(userId);
                    io.emit('user_status_change', { userId, status: 'offline' });
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
