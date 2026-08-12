const express = require('express');
const router = express.Router();
const { adminMiddleware } = require('./middlewares/auth');

router.get('/', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute('SELECT TenCauHinh, GiaTri, MoTa FROM CAUHINH_HETHONG');

        const settings = {};
        rows.forEach(row => {
            settings[row.TenCauHinh] = {
                giaTri: row.GiaTri,
                moTa: row.MoTa
            };
        });

        res.status(200).json(settings);
    } catch (error) {
        console.error('Lỗi khi lấy cấu hình hệ thống:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/', adminMiddleware, async (req, res) => {
    const updates = req.body; 

    if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ message: 'Dữ liệu cập nhật không hợp lệ.' });
    }

    try {
        const pool = req.app.locals.pool;
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            for (const [key, value] of Object.entries(updates)) {
                if (value !== undefined && value !== null && value !== '') {
                    await connection.execute(
                        'UPDATE CAUHINH_HETHONG SET GiaTri = ? WHERE TenCauHinh = ?',
                        [String(value), key]
                    );
                }
            }

            await connection.execute(
                'INSERT INTO AUDIT_LOG (MaND_ThucHien, HanhDong, ChiTiet) VALUES (?, ?, ?)',
                [req.user.MaND, 'CapNhatCauHinh', 'Cập nhật các tham số cấu hình hệ thống']
            );

            await connection.commit();
            res.status(200).json({ message: 'Cập nhật cấu hình hệ thống thành công.' });
        } catch (updateError) {
            await connection.rollback();
            throw updateError;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Lỗi cập nhật cấu hình hệ thống:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

module.exports = router;
