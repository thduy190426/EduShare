const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();
const { authMiddleware } = require('./middlewares/auth');

router.get('/', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        await pool.execute('DELETE FROM THONGBAO WHERE MaND = ? AND NgayTao < NOW() - INTERVAL 30 DAY', [req.user.MaND]);

        const [countResult] = await pool.execute(`
            SELECT COUNT(*) AS total FROM THONGBAO 
            WHERE MaND = ?
        `, [req.user.MaND]);
        const total = countResult[0].total;

        const [rows] = await pool.execute(`
            SELECT * FROM THONGBAO 
            WHERE MaND = ? 
            ORDER BY NgayTao DESC
            LIMIT ${limit} OFFSET ${offset}
        `, [req.user.MaND]);

        const hasMore = (offset + limit) < total;

        res.status(200).json({ notifications: rows, hasMore, total });
    } catch (error) {
        console.error('Lỗi tải thông báo:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/unread-count', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT COUNT(*) AS count FROM THONGBAO 
            WHERE MaND = ? AND DaDoc = FALSE
        `, [req.user.MaND]);
        res.status(200).json({ count: rows[0].count });
    } catch (error) {
        console.error('Lỗi lấy số lượng thông báo:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/read-all', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        await pool.execute(`
            UPDATE THONGBAO 
            SET DaDoc = TRUE 
            WHERE MaND = ? AND DaDoc = FALSE
        `, [req.user.MaND]);

        res.status(200).json({ message: 'Đã đánh dấu tất cả là đã đọc.' });
    } catch (error) {
        console.error('Lỗi đọc tất cả thông báo:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/:maTB/read', authMiddleware, async (req, res) => {
    const maTB = req.params.maTB;
    try {
        const pool = req.app.locals.pool;

        const [result] = await pool.execute(`
            UPDATE THONGBAO 
            SET DaDoc = TRUE 
            WHERE MaTB = ? AND MaND = ?
        `, [maTB, req.user.MaND]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy thông báo hoặc bạn không có quyền.' });
        }

        res.status(200).json({ message: 'Đã đánh dấu đọc.' });
    } catch (error) {
        console.error('Lỗi đọc thông báo:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.delete('/all', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [result] = await pool.execute(`
            DELETE FROM THONGBAO
            WHERE MaND = ?
        `, [req.user.MaND]);

        res.status(200).json({
            message: 'Đã xoá tất cả thông báo.',
            deletedCount: result.affectedRows
        });
    } catch (error) {
        console.error('Lỗi xóa tất cả thông báo:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.delete('/:maTB', authMiddleware, async (req, res) => {
    const maTB = req.params.maTB;

    try {
        const pool = req.app.locals.pool;
        const [result] = await pool.execute(`
            DELETE FROM THONGBAO
            WHERE MaTB = ? AND MaND = ?
        `, [maTB, req.user.MaND]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy thông báo hoặc bạn không có quyền.' });
        }

        res.status(200).json({ message: 'Đã xóa thông báo.' });
    } catch (error) {
        console.error('Lỗi xóa thông báo:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

module.exports = router;
