const express = require('express');
const router = express.Router();

const { authMiddleware } = require('./middlewares/auth');
const { sendNotificationToUser } = require('./services/socket');

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
                COUNT(DISTINCT CASE WHEN TL.TrangThaiKiemDuyet = 'DaDuyet' AND TL.TrangThaiHienThi = 'Hien' THEN TL.MaTL END) AS SoTaiLieu,
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
                COUNT(DISTINCT CASE WHEN TL.TrangThaiKiemDuyet = 'DaDuyet' AND TL.TrangThaiHienThi = 'Hien' THEN TL.MaTL END) AS SoTaiLieu,
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

router.post('/suggestions', authMiddleware, async (req, res) => {
    if (req.user.VaiTro !== 'GiaoVien') {
        return res.status(403).json({ message: 'Chỉ Giáo viên mới có thể đề xuất môn học mới.' });
    }

    const tenMonHoc = (req.body.tenMonHoc || '').trim();
    const capHoc = (req.body.capHoc || 'Khac').trim();
    const moTa = (req.body.moTa || '').trim();
    const lyDo = (req.body.lyDo || '').trim();

    if (!tenMonHoc) {
        return res.status(400).json({ message: 'Tên môn học bắt buộc.' });
    }

    try {
        const pool = req.app.locals.pool;

        const [existingSubjects] = await pool.execute(
            'SELECT MaMonHoc, TenMonHoc FROM MONHOC WHERE LOWER(TenMonHoc) = LOWER(?) AND TrangThai = "HoatDong" LIMIT 1',
            [tenMonHoc]
        );

        if (existingSubjects.length > 0) {
            return res.status(409).json({ message: 'Môn học này đã tồn tại trên hệ thống.' });
        }

        const [pendingSuggestions] = await pool.execute(
            'SELECT MaDeXuat FROM DEXUAT_MONHOC WHERE LOWER(TenMonHoc) = LOWER(?) AND TrangThai = "ChoDuyet" LIMIT 1',
            [tenMonHoc]
        );

        if (pendingSuggestions.length > 0) {
            return res.status(409).json({ message: 'Môn học này đã có đề xuất đang chờ duyệt.' });
        }

        const [result] = await pool.execute(
            `INSERT INTO DEXUAT_MONHOC (TenMonHoc, CapHoc, MoTa, LyDo, MaND_DeXuat)
             VALUES (?, ?, ?, ?, ?)`,
            [tenMonHoc, capHoc || 'Khac', moTa || null, lyDo || null, req.user.MaND]
        );

        const [admins] = await pool.execute(
            'SELECT MaND FROM NGUOIDUNG WHERE VaiTro = "Admin" AND TrangThai = "HoatDong"'
        );

        for (const admin of admins) {
            await pool.execute(
                'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                [admin.MaND, 'HeThong', `Giáo viên vừa đề xuất môn học mới: "${tenMonHoc}".`, '../admin/adminSubjects.html']
            );
            sendNotificationToUser(admin.MaND, 'new_notification', { message: `Giáo viên vừa đề xuất môn học mới: "${tenMonHoc}".`, link: '../admin/adminSubjects.html' });
        }

        res.status(201).json({ message: 'Đã gửi đề xuất môn học. Vui lòng chờ Admin duyệt.', id: result.insertId });
    } catch (error) {
        console.error('Lỗi API POST /subjects/suggestions:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi gửi đề xuất môn học.' });
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
