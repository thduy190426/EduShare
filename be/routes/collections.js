const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');

router.get('/', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const maND = req.user.MaND;

        const [collections] = await pool.query(`
            SELECT b.*, 
                   (SELECT COUNT(*) FROM BOSUUTAP_TAILIEU bt WHERE bt.MaBST = b.MaBST) as DocCount
            FROM BOSUUTAP b 
            WHERE b.MaND = ?
            ORDER BY b.NgayTao DESC
        `, [maND]);

        res.json(collections);
    } catch (err) {
        console.error('Error fetching collections:', err);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách bộ sưu tập' });
    }
});

router.post('/', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const maND = req.user.MaND;
        const { tenBST, moTa } = req.body;

        if (!tenBST || tenBST.trim() === '') {
            return res.status(400).json({ message: 'Tên bộ sưu tập không được để trống' });
        }

        const [counts] = await pool.query('SELECT COUNT(*) as total FROM BOSUUTAP WHERE MaND = ?', [maND]);
        if (counts[0].total >= 5) {
            return res.status(400).json({ message: 'Bạn chỉ được tạo tối đa 5 bộ sưu tập' });
        }

        const [result] = await pool.query(
            'INSERT INTO BOSUUTAP (MaND, TenBST, MoTa) VALUES (?, ?, ?)',
            [maND, tenBST.trim(), moTa || null]
        );

        res.status(201).json({ message: 'Tạo bộ sưu tập thành công', maBST: result.insertId });
    } catch (err) {
        console.error('Error creating collection:', err);
        res.status(500).json({ message: 'Lỗi máy chủ khi tạo bộ sưu tập' });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const maND = req.user.MaND;
        const maBST = req.params.id;

        const [collections] = await pool.query('SELECT * FROM BOSUUTAP WHERE MaBST = ? AND MaND = ?', [maBST, maND]);
        if (collections.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy bộ sưu tập hoặc bạn không có quyền xóa' });
        }

        await pool.query('DELETE FROM BOSUUTAP WHERE MaBST = ?', [maBST]);
        res.json({ message: 'Xóa bộ sưu tập thành công' });
    } catch (err) {
        console.error('Error deleting collection:', err);
        res.status(500).json({ message: 'Lỗi máy chủ khi xóa bộ sưu tập' });
    }
});

router.get('/:id/documents', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const maND = req.user.MaND;
        const maBST = req.params.id;

        const [collections] = await pool.query('SELECT * FROM BOSUUTAP WHERE MaBST = ? AND MaND = ?', [maBST, maND]);
        if (collections.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy bộ sưu tập' });
        }

        const [documents] = await pool.query(`
            SELECT t.*, u.HoTen as TenNguoiDang, mh.TenMonHoc, bt.NgayThem
            FROM BOSUUTAP_TAILIEU bt
            JOIN TAILIEU t ON bt.MaTL = t.MaTL
            JOIN NGUOIDUNG u ON t.NguoiDang = u.MaND
            LEFT JOIN MONHOC mh ON t.MaMonHoc = mh.MaMonHoc
            WHERE bt.MaBST = ?
            ORDER BY bt.NgayThem DESC
        `, [maBST]);

        res.json(documents);
    } catch (err) {
        console.error('Error fetching collection documents:', err);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy tài liệu trong bộ sưu tập' });
    }
});

router.post('/:id/documents', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const maND = req.user.MaND;
        const maBST = req.params.id;
        const { maTL } = req.body;

        if (!maTL) {
            return res.status(400).json({ message: 'Thiếu thông tin tài liệu' });
        }

        const [collections] = await pool.query('SELECT * FROM BOSUUTAP WHERE MaBST = ? AND MaND = ?', [maBST, maND]);
        if (collections.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy bộ sưu tập' });
        }

        const [docs] = await pool.query('SELECT * FROM TAILIEU WHERE MaTL = ?', [maTL]);
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu' });
        }

        try {
            await pool.query('INSERT INTO BOSUUTAP_TAILIEU (MaBST, MaTL) VALUES (?, ?)', [maBST, maTL]);
            res.status(201).json({ message: 'Thêm tài liệu vào bộ sưu tập thành công' });
        } catch (insertErr) {
            if (insertErr.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ message: 'Tài liệu này đã có trong bộ sưu tập' });
            }
            throw insertErr;
        }

    } catch (err) {
        console.error('Error adding document to collection:', err);
        res.status(500).json({ message: 'Lỗi máy chủ khi thêm tài liệu vào bộ sưu tập' });
    }
});

router.delete('/:id/documents/:docId', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const maND = req.user.MaND;
        const maBST = req.params.id;
        const maTL = req.params.docId;

        const [collections] = await pool.query('SELECT * FROM BOSUUTAP WHERE MaBST = ? AND MaND = ?', [maBST, maND]);
        if (collections.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy bộ sưu tập' });
        }

        await pool.query('DELETE FROM BOSUUTAP_TAILIEU WHERE MaBST = ? AND MaTL = ?', [maBST, maTL]);
        res.json({ message: 'Xóa tài liệu khỏi bộ sưu tập thành công' });

    } catch (err) {
        console.error('Error removing document from collection:', err);
        res.status(500).json({ message: 'Lỗi máy chủ khi xóa tài liệu khỏi bộ sưu tập' });
    }
});

module.exports = router;