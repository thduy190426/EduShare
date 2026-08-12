const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('./middlewares/auth');
const { sendNotificationToUser } = require('./services/socket');

router.get('/', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute('SELECT * FROM DANHHIEU');
        res.status(200).json(rows);
    } catch (error) {
        console.error('Lỗi lấy danh hiệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
});

router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const pool = req.app.locals.pool;
        const sql = `
            SELECT D.*, ND.LaDanhHieuChinh, ND.NgayNhan
            FROM DANHHIEU D
            JOIN NGUOIDUNG_DANHHIEU ND ON D.MaDanhHieu = ND.MaDanhHieu
            WHERE ND.MaND = ?
        `;
        const [rows] = await pool.execute(sql, [userId]);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Lỗi lấy danh hiệu người dùng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
});

router.post('/admin/assign', adminMiddleware, async (req, res) => {
    try {
        const { maND, maDanhHieu, laDanhHieuChinh } = req.body;
        if (!maND || !maDanhHieu) {
            return res.status(400).json({ message: 'Thiếu thông tin người dùng hoặc danh hiệu' });
        }

        const pool = req.app.locals.pool;
        
        if (laDanhHieuChinh) {
            await pool.execute('UPDATE NGUOIDUNG_DANHHIEU SET LaDanhHieuChinh = FALSE WHERE MaND = ?', [maND]);
        }

        const sql = `
            INSERT INTO NGUOIDUNG_DANHHIEU (MaND, MaDanhHieu, LaDanhHieuChinh) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE LaDanhHieuChinh = ?
        `;
        await pool.execute(sql, [maND, maDanhHieu, laDanhHieuChinh ? 1 : 0, laDanhHieuChinh ? 1 : 0]);
        
        const [badgeRows] = await pool.execute('SELECT TenDanhHieu FROM DANHHIEU WHERE MaDanhHieu = ?', [maDanhHieu]);
        if (badgeRows.length > 0) {
            const tenDanhHieu = badgeRows[0].TenDanhHieu;
            const noiDung = `Bạn vừa được Quản trị viên trao danh hiệu "${tenDanhHieu}".`;
            await pool.execute('INSERT INTO THONGBAO (MaND, NoiDung, LoaiTB, LinkDich) VALUES (?, ?, ?, ?)', [maND, noiDung, 'HeThong', '../user/userProfile.html']);
            sendNotificationToUser(maND, 'new_badge', { message: noiDung, badgeName: tenDanhHieu });
        }

        res.status(200).json({ message: 'Đã trao danh hiệu thành công' });
    } catch (error) {
        console.error('Lỗi trao danh hiệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
});

router.delete('/admin/revoke', adminMiddleware, async (req, res) => {
    try {
        const { maND, maDanhHieu } = req.body;
        if (!maND || !maDanhHieu) {
            return res.status(400).json({ message: 'Thiếu thông tin' });
        }
        const pool = req.app.locals.pool;
        await pool.execute('DELETE FROM NGUOIDUNG_DANHHIEU WHERE MaND = ? AND MaDanhHieu = ?', [maND, maDanhHieu]);
        res.status(200).json({ message: 'Đã thu hồi danh hiệu' });
    } catch (error) {
        console.error('Lỗi thu hồi danh hiệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
});

module.exports = router;
