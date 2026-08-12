const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const chatUploadDir = path.join(__dirname, 'public/uploads/chat');
if (!fs.existsSync(chatUploadDir)) {
    fs.mkdirSync(chatUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, chatUploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        let ext = path.extname(file.originalname);
        if (!ext && file.mimetype.startsWith('audio/')) ext = '.webm';
        cb(null, uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

router.get('/contacts', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.MaND;
        const pool = req.app.locals.pool;
        const sql = `
            SELECT 
                ND.MaND, ND.HoTen, ND.AvatarURL, ND.VaiTro,
                M.NoiDung as LatestMessage,
                M.NgayGui as LatestMessageTime,
                M.NguoiGui as LatestMessageSender,
                M.DaDoc as LatestMessageRead,
                M.LoaiTinNhan as LatestMessageType,
                M.DaThuHoi as LatestMessageUnsent,
                M.DaChinhSua as LatestMessageEdited,
                (SELECT COUNT(*) FROM TINNHAN WHERE NguoiGui = ND.MaND AND NguoiNhan = ? AND DaDoc = FALSE) as UnreadCount
            FROM NGUOIDUNG ND
            INNER JOIN (
                SELECT 
                    IF(NguoiGui = ?, NguoiNhan, NguoiGui) as PartnerId,
                    MAX(MaTN) as MaxMaTN
                FROM TINNHAN
                WHERE NguoiGui = ? OR NguoiNhan = ?
                GROUP BY PartnerId
            ) as LastMsg ON ND.MaND = LastMsg.PartnerId
            INNER JOIN TINNHAN M ON LastMsg.MaxMaTN = M.MaTN
            ORDER BY M.NgayGui DESC
        `;

        const [contacts] = await pool.execute(sql, [userId, userId, userId, userId]);
        res.status(200).json({ contacts });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách liên hệ chat:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/history/:partnerId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.MaND;
        const partnerId = req.params.partnerId;
        const limit = parseInt(req.query.limit) || 50;
        const pool = req.app.locals.pool;

        const sql = `
            SELECT sub.*, M2.NoiDung as ReplyToNoiDung, M2.LoaiTinNhan as ReplyToLoaiTinNhan 
            FROM (
                SELECT MaTN, NguoiGui, NguoiNhan, NoiDung, DaDoc, NgayGui, LoaiTinNhan, DaThuHoi, Reactions, DaChinhSua, DaNhan, TraLoiCho_MaTN
                FROM TINNHAN
                WHERE (NguoiGui = ? AND NguoiNhan = ?) OR (NguoiGui = ? AND NguoiNhan = ?)
                ORDER BY NgayGui DESC
                LIMIT ?
            ) sub
            LEFT JOIN TINNHAN M2 ON sub.TraLoiCho_MaTN = M2.MaTN
            ORDER BY sub.NgayGui ASC
        `;

        const [messages] = await pool.execute(sql, [userId, partnerId, partnerId, userId, limit.toString()]);
        await pool.execute(
            'UPDATE TINNHAN SET DaDoc = TRUE WHERE NguoiGui = ? AND NguoiNhan = ? AND DaDoc = FALSE',
            [partnerId, userId]
        );

        res.status(200).json({ messages });
    } catch (error) {
        console.error('Lỗi khi lấy lịch sử chat:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/read/:partnerId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.MaND;
        const partnerId = req.params.partnerId;
        const pool = req.app.locals.pool;

        await pool.execute(
            'UPDATE TINNHAN SET DaDoc = TRUE WHERE NguoiGui = ? AND NguoiNhan = ? AND DaDoc = FALSE',
            [partnerId, userId]
        );
        res.status(200).json({ message: 'Đã cập nhật trạng thái đọc.' });
    } catch (error) {
        console.error('Lỗi khi cập nhật trạng thái đọc:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/search-users', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.MaND;
        const keyword = req.query.q || '';
        const pool = req.app.locals.pool;

        if (!keyword.trim()) {
            return res.status(200).json({ users: [] });
        }

        const sql = `
            SELECT MaND, HoTen, AvatarURL, VaiTro
            FROM NGUOIDUNG
            WHERE HoTen LIKE ? AND MaND != ? AND TrangThai = 'HoatDong'
            LIMIT 10
        `;

        const [users] = await pool.execute(sql, [`%${keyword}%`, userId]);
        res.status(200).json({ users });
    } catch (error) {
        console.error('Lỗi khi tìm kiếm người dùng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

module.exports = router;

router.put('/unsend/:messageId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.MaND;
        const messageId = req.params.messageId;
        const pool = req.app.locals.pool;

        const [result] = await pool.execute(
            'UPDATE TINNHAN SET DaThuHoi = TRUE WHERE MaTN = ? AND NguoiGui = ?',
            [messageId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(403).json({ message: 'Không thể thu hồi tin nhắn này.' });
        }

        res.status(200).json({ message: 'Thu hồi thành công.' });
    } catch (error) {
        console.error('Lỗi khi thu hồi tin nhắn:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/edit/:messageId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.MaND;
        const messageId = req.params.messageId;
        const { text } = req.body;
        const pool = req.app.locals.pool;

        if (!text || !text.trim()) return res.status(400).json({ message: 'Nội dung không hợp lệ.' });

        const [result] = await pool.execute(
            "UPDATE TINNHAN SET NoiDung = ?, DaChinhSua = TRUE WHERE MaTN = ? AND NguoiGui = ? AND LoaiTinNhan = 'text' AND DaThuHoi = FALSE",
            [text.trim(), messageId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(403).json({ message: 'Không thể sửa tin nhắn này.' });
        }

        res.status(200).json({ message: 'Sửa thành công.' });
    } catch (error) {
        console.error('Lỗi khi sửa tin nhắn:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/react/:messageId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.MaND;
        const messageId = req.params.messageId;
        const { reaction } = req.body;
        const pool = req.app.locals.pool;

        const [rows] = await pool.execute('SELECT Reactions FROM TINNHAN WHERE MaTN = ?', [messageId]);
        if (rows.length === 0) return res.status(404).json({ message: 'Tin nhắn không tồn tại.' });

        let reactions = rows[0].Reactions;
        let reactionsObj = {};
        if (reactions) {
            try {
                reactionsObj = JSON.parse(reactions);
            } catch(e) {}
        }

        if (reaction) {
            reactionsObj[userId] = reaction;
        } else {
            delete reactionsObj[userId]; 
        }

        const newReactionsStr = JSON.stringify(reactionsObj);
        await pool.execute('UPDATE TINNHAN SET Reactions = ? WHERE MaTN = ?', [newReactionsStr, messageId]);

        res.status(200).json({ message: 'Cập nhật cảm xúc thành công', reactions: reactionsObj });
    } catch (error) {
        console.error('Lỗi khi thả cảm xúc:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Vui lòng chọn file.' });
        }
        const fileUrl = `/uploads/chat/${req.file.filename}`;
        res.status(200).json({ url: fileUrl, originalName: req.file.originalname });
    } catch (error) {
        console.error('Lỗi upload file chat:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/link-preview', authMiddleware, async (req, res) => {
    try {
        const urlStr = req.query.url;
        if (!urlStr) return res.status(400).json({ message: 'Thiếu URL.' });

        const urlObj = new URL(urlStr);
        const client = urlObj.protocol === 'https:' ? https : http;

        client.get(urlStr, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                return res.status(404).json({ message: 'Redirects not supported in simple preview' });
            }
            let data = '';
            response.on('data', chunk => {
                data += chunk;
                if (data.length > 50000) response.destroy(); 
            });
            response.on('end', () => {
                const titleMatch = data.match(/<title>([^<]*)<\/title>/i);
                const imageMatch = data.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i) || 
                                   data.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"[^>]*>/i);

                const title = titleMatch ? titleMatch[1].trim() : urlObj.hostname;
                const image = imageMatch ? imageMatch[1] : null;

                res.status(200).json({ title, image, url: urlStr, domain: urlObj.hostname });
            });
            response.on('error', () => res.status(500).json({ message: 'Failed to fetch' }));
        }).on('error', () => {
            res.status(500).json({ message: 'Network error' });
        });
    } catch (error) {
        res.status(400).json({ message: 'URL không hợp lệ.' });
    }
});

module.exports = router;
