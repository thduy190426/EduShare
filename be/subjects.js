const express = require('express');
const router = express.Router();

const { authMiddleware } = require('./middlewares/auth');

const parseId = (value) => {
    const id = Number.parseInt(value, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
};

router.get('/my', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT
                MH.MaMonHoc,
                MH.TenMonHoc,
                MH.CapHoc,
                UM.NgayTheoDoi,
                COUNT(DISTINCT CASE WHEN TL.TrangThaiKiemDuyet = 'DaDuyet' THEN TL.MaTL END) AS SoTaiLieu,
                COUNT(DISTINCT CASE WHEN N.TrangThai = 'HoatDong' OR N.TrangThai IS NULL THEN N.MaNhom END) AS SoNhom
            FROM NGUOIDUNG_MONHOC UM
            JOIN MONHOC MH ON UM.MaMonHoc = MH.MaMonHoc
            LEFT JOIN TAILIEU TL ON TL.MaMonHoc = MH.MaMonHoc
            LEFT JOIN NHOM N ON N.MaMonHoc = MH.MaMonHoc
            WHERE UM.MaND = ? AND MH.TrangThai = 'HoatDong'
            GROUP BY MH.MaMonHoc, MH.TenMonHoc, MH.CapHoc, UM.NgayTheoDoi
            ORDER BY UM.NgayTheoDoi DESC
        `, [req.user.MaND]);

        res.status(200).json({ subjects: rows });
    } catch (error) {
        console.error('Lỗi API GET /subjects/my:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy môn học của bạn.' });
    }
});

router.get('/available', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const search = (req.query.search || '').trim();
        const params = [req.user.MaND];
        let searchClause = '';

        if (search) {
            searchClause = ' AND MH.TenMonHoc LIKE ?';
            params.push(`%${search}%`);
        }

        const [rows] = await pool.execute(`
            SELECT
                MH.MaMonHoc,
                MH.TenMonHoc,
                MH.CapHoc,
                COUNT(DISTINCT CASE WHEN TL.TrangThaiKiemDuyet = 'DaDuyet' THEN TL.MaTL END) AS SoTaiLieu,
                COUNT(DISTINCT CASE WHEN N.TrangThai = 'HoatDong' OR N.TrangThai IS NULL THEN N.MaNhom END) AS SoNhom
            FROM MONHOC MH
            LEFT JOIN NGUOIDUNG_MONHOC UM ON UM.MaMonHoc = MH.MaMonHoc AND UM.MaND = ?
            LEFT JOIN TAILIEU TL ON TL.MaMonHoc = MH.MaMonHoc
            LEFT JOIN NHOM N ON N.MaMonHoc = MH.MaMonHoc
            WHERE MH.TrangThai = 'HoatDong' AND UM.MaMonHoc IS NULL ${searchClause}
            GROUP BY MH.MaMonHoc, MH.TenMonHoc, MH.CapHoc
            ORDER BY MH.TenMonHoc ASC
            LIMIT 50
        `, params);

        res.status(200).json({ subjects: rows });
    } catch (error) {
        console.error('Lỗi API GET /subjects/available:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách môn học.' });
    }
});

router.post('/:maMonHoc/follow', authMiddleware, async (req, res) => {
    const maMonHoc = parseId(req.params.maMonHoc);
    if (!maMonHoc) return res.status(400).json({ message: 'Môn học không hợp lệ.' });

    try {
        const pool = req.app.locals.pool;
        const [subjectRows] = await pool.execute(
            'SELECT MaMonHoc, TenMonHoc FROM MONHOC WHERE MaMonHoc = ? AND TrangThai = "HoatDong"',
            [maMonHoc]
        );

        if (subjectRows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy môn học.' });
        }

        await pool.execute(
            'INSERT IGNORE INTO NGUOIDUNG_MONHOC (MaND, MaMonHoc) VALUES (?, ?)',
            [req.user.MaND, maMonHoc]
        );

        res.status(201).json({ message: 'Đã thêm vào môn học của tôi.', subject: subjectRows[0] });
    } catch (error) {
        console.error('Lỗi API POST /subjects/:maMonHoc/follow:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi thêm môn học.' });
    }
});

router.delete('/:maMonHoc/follow', authMiddleware, async (req, res) => {
    const maMonHoc = parseId(req.params.maMonHoc);
    if (!maMonHoc) return res.status(400).json({ message: 'Môn học không hợp lệ.' });

    try {
        const pool = req.app.locals.pool;
        const [result] = await pool.execute(
            'DELETE FROM NGUOIDUNG_MONHOC WHERE MaND = ? AND MaMonHoc = ?',
            [req.user.MaND, maMonHoc]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Môn học này chưa có trong danh sách của bạn.' });
        }

        res.status(200).json({ message: 'Đã xoá môn học ra khỏi danh sách của bạn.' });
    } catch (error) {
        console.error('Lỗi API DELETE /subjects/:maMonHoc/follow:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi xoá môn học.' });
    }
});

module.exports = router;
