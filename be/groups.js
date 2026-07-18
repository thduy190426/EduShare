const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();
const { authMiddleware } = require('./middlewares/auth');

router.get('/', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const maND = req.user.MaND;
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const offset = (page - 1) * limit;

        const [[{ totalCount }]] = await pool.execute(`
            SELECT COUNT(*) AS totalCount FROM NHOM WHERE TrangThai = 'HoatDong'
        `);

        const [rows] = await pool.execute(`
            SELECT N.*, ND.HoTen AS TenNguoiQuanTri, MH.TenMonHoc,
                   (SELECT COUNT(*) FROM THANHVIEN_NHOM WHERE MaNhom = N.MaNhom) AS SoLuongThanhVien,
                   EXISTS(SELECT 1 FROM THANHVIEN_NHOM TV WHERE TV.MaNhom = N.MaNhom AND TV.MaND = ?) AS IsMember
            FROM NHOM N
            JOIN NGUOIDUNG ND ON N.MaND_QuanTri = ND.MaND
            LEFT JOIN MONHOC MH ON N.MaMonHoc = MH.MaMonHoc
            WHERE N.TrangThai = 'HoatDong'
            ORDER BY N.NgayTao DESC
            LIMIT ${limit} OFFSET ${offset}
        `, [maND]);

        res.status(200).json({ 
            groups: rows,
            pagination: {
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page,
                limit
            }
        });
    } catch (error) {
        console.error('Lỗi API /groups (GET):', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.post('/', authMiddleware, async (req, res) => {
    const { tenNhom, moTa, maMonHoc } = req.body;
    const maND = req.user.MaND;

    if (!tenNhom) {
        return res.status(400).json({ message: 'Tên nhóm không được để trống.' });
    }

    const pool = req.app.locals.pool;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();


        const [groupResult] = await conn.execute(
            'INSERT INTO NHOM (TenNhom, MoTa, MaND_QuanTri, MaMonHoc) VALUES (?, ?, ?, ?)',
            [tenNhom, moTa || '', maND, maMonHoc || null]
        );
        const maNhom = groupResult.insertId;


        await conn.execute(
            'INSERT INTO THANHVIEN_NHOM (MaND, MaNhom, VaiTroTrongNhom) VALUES (?, ?, ?)',
            [maND, maNhom, 'QuanTri']
        );

        await conn.commit();
        res.status(201).json({ message: 'Tạo nhóm thành công.', maNhom });
    } catch (error) {
        await conn.rollback();
        console.error('Lỗi API /groups (POST):', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    } finally {
        conn.release();
    }
});

router.get('/my-groups', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const maND = req.user.MaND;
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const offset = (page - 1) * limit;

        const [[{ totalCount }]] = await pool.execute(`
            SELECT COUNT(*) AS totalCount 
            FROM NHOM N
            JOIN THANHVIEN_NHOM TV ON N.MaNhom = TV.MaNhom
            WHERE N.TrangThai = 'HoatDong' AND TV.MaND = ?
        `, [maND]);

        const [rows] = await pool.execute(`
            SELECT N.*, ND.HoTen AS TenNguoiQuanTri, MH.TenMonHoc,
                   (SELECT COUNT(*) FROM THANHVIEN_NHOM WHERE MaNhom = N.MaNhom) AS SoLuongThanhVien,
                   1 AS IsMember
            FROM NHOM N
            JOIN NGUOIDUNG ND ON N.MaND_QuanTri = ND.MaND
            LEFT JOIN MONHOC MH ON N.MaMonHoc = MH.MaMonHoc
            JOIN THANHVIEN_NHOM TV ON N.MaNhom = TV.MaNhom
            WHERE N.TrangThai = 'HoatDong' AND TV.MaND = ?
            ORDER BY TV.NgayThamGia DESC
            LIMIT ${limit} OFFSET ${offset}
        `, [maND]);

        res.status(200).json({ 
            groups: rows,
            pagination: {
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page,
                limit
            }
        });
    } catch (error) {
        console.error('Lỗi API /groups/my-groups:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/recommended', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const maND = req.user.MaND;
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 3, 1), 12);

        const [rows] = await pool.execute(`
            SELECT N.*, ND.HoTen AS TenNguoiQuanTri, MH.TenMonHoc,
                   (SELECT COUNT(*) FROM THANHVIEN_NHOM WHERE MaNhom = N.MaNhom) AS SoLuongThanhVien,
                   0 AS IsMember,
                   (
                       CASE
                           WHEN N.MaMonHoc IN (
                               SELECT DISTINCT T.MaMonHoc
                               FROM TAILIEU T
                               WHERE T.MaND_NguoiDang = ? AND T.MaMonHoc IS NOT NULL
                           ) THEN 3
                           ELSE 0
                       END
                       +
                       CASE
                           WHEN N.MaMonHoc IN (
                               SELECT DISTINCT N2.MaMonHoc
                               FROM THANHVIEN_NHOM TV2
                               JOIN NHOM N2 ON TV2.MaNhom = N2.MaNhom
                               WHERE TV2.MaND = ? AND N2.MaMonHoc IS NOT NULL
                           ) THEN 2
                           ELSE 0
                       END
                   ) AS DiemGoiY
            FROM NHOM N
            JOIN NGUOIDUNG ND ON N.MaND_QuanTri = ND.MaND
            LEFT JOIN MONHOC MH ON N.MaMonHoc = MH.MaMonHoc
            LEFT JOIN THANHVIEN_NHOM TV ON TV.MaNhom = N.MaNhom AND TV.MaND = ?
            WHERE N.TrangThai = 'HoatDong' AND TV.MaNhom IS NULL
            ORDER BY DiemGoiY DESC, SoLuongThanhVien DESC, N.NgayTao DESC
            LIMIT ${limit}
        `, [maND, maND, maND]);

        res.status(200).json({ groups: rows });
    } catch (error) {
        console.error('Lỗi API /groups/recommended:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.post('/:maNhom/join', authMiddleware, async (req, res) => {
    const maNhom = req.params.maNhom;
    const maND = req.user.MaND;

    try {
        const pool = req.app.locals.pool;


        const [groupCheck] = await pool.execute('SELECT TrangThai FROM NHOM WHERE MaNhom = ?', [maNhom]);
        if (groupCheck.length === 0) return res.status(404).json({ message: 'Không tìm thấy nhóm.' });
        if (groupCheck[0].TrangThai !== 'HoatDong') return res.status(400).json({ message: 'Nhóm đã bị khóa.' });

        const [checkRows] = await pool.execute('SELECT * FROM THANHVIEN_NHOM WHERE MaND = ? AND MaNhom = ?', [maND, maNhom]);
        if (checkRows.length > 0) {
            return res.status(400).json({ message: 'Đã tham gia nhóm này.' });
        }


        await pool.execute(
            'INSERT INTO THANHVIEN_NHOM (MaND, MaNhom, VaiTroTrongNhom) VALUES (?, ?, ?)',
            [maND, maNhom, 'ThanhVien']
        );

        res.status(200).json({ message: 'Tham gia nhóm thành công.' });
    } catch (error) {
        console.error('Lỗi API /groups/:maNhom/join:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.post('/:maNhom/leave', authMiddleware, async (req, res) => {
    const maNhom = req.params.maNhom;
    const maND = req.user.MaND;
    const { newAdminId } = req.body;
    const pool = req.app.locals.pool;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [memberRows] = await conn.execute('SELECT * FROM THANHVIEN_NHOM WHERE MaND = ? AND MaNhom = ?', [maND, maNhom]);
        if (memberRows.length === 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'Bạn không phải là thành viên của nhóm này.' });
        }

        if (memberRows[0].VaiTroTrongNhom === 'QuanTri') {
            let nextAdminId = null;

            if (newAdminId) {
                const [checkAdmin] = await conn.execute('SELECT * FROM THANHVIEN_NHOM WHERE MaND = ? AND MaNhom = ?', [newAdminId, maNhom]);
                if (checkAdmin.length > 0) {
                    nextAdminId = newAdminId;
                }
            }
            
            if (!nextAdminId) {
                const [nextAdminRows] = await conn.execute(`
                    SELECT MaND
                    FROM THANHVIEN_NHOM
                    WHERE MaNhom = ? AND MaND <> ?
                    ORDER BY NgayThamGia ASC
                    LIMIT 1
                `, [maNhom, maND]);
                if (nextAdminRows.length > 0) {
                    nextAdminId = nextAdminRows[0].MaND;
                }
            }

            if (nextAdminId) {
                await conn.execute(
                    'UPDATE THANHVIEN_NHOM SET VaiTroTrongNhom = ? WHERE MaND = ? AND MaNhom = ?',
                    ['QuanTri', nextAdminId, maNhom]
                );
                await conn.execute(
                    'UPDATE NHOM SET MaND_QuanTri = ? WHERE MaNhom = ?',
                    [nextAdminId, maNhom]
                );
            } else {
                await conn.execute(
                    'UPDATE NHOM SET TrangThai = ? WHERE MaNhom = ?',
                    ['NgungHoatDong', maNhom]
                );
            }
        }


        await conn.execute('DELETE FROM THANHVIEN_NHOM WHERE MaND = ? AND MaNhom = ?', [maND, maNhom]);
        await conn.commit();

        res.status(200).json({ message: 'Rời nhóm thành công.' });
    } catch (error) {
        await conn.rollback();
        console.error('Lỗi API /groups/:maNhom/leave:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    } finally {
        conn.release();
    }
});


router.get('/:maNhom/members', authMiddleware, async (req, res) => {
    const maNhom = req.params.maNhom;

    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT TV.VaiTroTrongNhom, TV.NgayThamGia, ND.MaND, ND.HoTen, ND.Email, ND.AvatarURL
            FROM THANHVIEN_NHOM TV
            JOIN NGUOIDUNG ND ON TV.MaND = ND.MaND
            WHERE TV.MaNhom = ?
            ORDER BY TV.VaiTroTrongNhom ASC, TV.NgayThamGia ASC
        `, [maNhom]);

        res.status(200).json({ members: rows });
    } catch (error) {
        console.error('Lỗi API /groups/:maNhom/members:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.delete('/:maNhom/members/:memberId', authMiddleware, async (req, res) => {
    const maNhom = req.params.maNhom;
    const memberId = req.params.memberId;
    const adminId = req.user.MaND;
    const { lyDo } = req.body || {};

    try {
        const pool = req.app.locals.pool;

        const [adminRows] = await pool.execute(
            'SELECT VaiTroTrongNhom FROM THANHVIEN_NHOM WHERE MaND = ? AND MaNhom = ?',
            [adminId, maNhom]
        );
        if (adminRows.length === 0) {
            return res.status(403).json({ message: 'Bạn không phải là thành viên của nhóm này.' });
        }
        if (adminRows[0].VaiTroTrongNhom !== 'QuanTri') {
            return res.status(403).json({ message: 'Chỉ quản trị viên mới có thể đuổi thành viên.' });
        }
        if (String(adminId) === String(memberId)) {
            return res.status(400).json({ message: 'Bạn không thể tự đuổi chính mình khỏi nhóm.' });
        }

        const [memberRows] = await pool.execute(
            'SELECT TV.MaND, ND.HoTen FROM THANHVIEN_NHOM TV JOIN NGUOIDUNG ND ON TV.MaND = ND.MaND WHERE TV.MaND = ? AND TV.MaNhom = ?',
            [memberId, maNhom]
        );
        if (memberRows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy thành viên trong nhóm.' });
        }

        await pool.execute(
            'DELETE FROM THANHVIEN_NHOM WHERE MaND = ? AND MaNhom = ?',
            [memberId, maNhom]
        );

        res.status(200).json({
            message: 'Đã đuổi thành viên khỏi nhóm.',
            removedMember: memberRows[0],
            lyDo: lyDo || ''
        });
    } catch (error) {
        console.error('Lỗi API DELETE /groups/:maNhom/members/:memberId:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.post('/:maNhom/share-document', authMiddleware, async (req, res) => {
    const maNhom = req.params.maNhom;
    const maND = req.user.MaND;
    const { maTL } = req.body;

    if (!maTL) return res.status(400).json({ message: 'Vui lòng chọn tài liệu để chia sẻ.' });

    try {
        const pool = req.app.locals.pool;


        const [memberRows] = await pool.execute('SELECT * FROM THANHVIEN_NHOM WHERE MaND = ? AND MaNhom = ?', [maND, maNhom]);
        if (memberRows.length === 0) {
            return res.status(403).json({ message: 'Bạn không phải là thành viên của nhóm này.' });
        }


        const [docRows] = await pool.execute('SELECT MaND_NguoiDang, TrangThaiKiemDuyet, TrangThaiHienThi FROM TAILIEU WHERE MaTL = ?', [maTL]);
        if (docRows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
        }
        const doc = docRows[0];
        if (doc.TrangThaiHienThi === 'An' || (doc.MaND_NguoiDang !== maND && doc.TrangThaiKiemDuyet !== 'DaDuyet')) {
            return res.status(403).json({ message: 'Tài liệu chưa được duyệt, bị ẩn hoặc bạn không có quyền chia sẻ tài liệu này.' });
        }


        const [docCheckRows] = await pool.execute('SELECT * FROM TAILIEU_NHOM WHERE MaTL = ? AND MaNhom = ?', [maTL, maNhom]);
        if (docCheckRows.length > 0) {
            return res.status(400).json({ message: 'Tài liệu này đã được chia sẻ trong nhóm.' });
        }


        await pool.execute('INSERT INTO TAILIEU_NHOM (MaTL, MaNhom) VALUES (?, ?)', [maTL, maNhom]);

        res.status(200).json({ message: 'Chia sẻ tài liệu vào nhóm thành công.' });
    } catch (error) {
        console.error('Lỗi API /groups/:maNhom/share-document:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.get('/:maNhom/documents', authMiddleware, async (req, res) => {
    const maNhom = req.params.maNhom;

    try {
        const pool = req.app.locals.pool;

        const [groupCheck] = await pool.execute('SELECT MaND_QuanTri FROM NHOM WHERE MaNhom = ?', [maNhom]);
        if (groupCheck.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy nhóm.' });
        }
        const isGroupAdmin = groupCheck[0].MaND_QuanTri === req.user.MaND;

        if (req.user.VaiTro !== 'Admin' && !isGroupAdmin) {
            const [memberCheck] = await pool.execute('SELECT 1 FROM THANHVIEN_NHOM WHERE MaNhom = ? AND MaND = ?', [maNhom, req.user.MaND]);
            if (memberCheck.length === 0) {
                return res.status(403).json({ message: 'Bạn không có quyền xem tài liệu của nhóm này.' });
            }
        }

        let query = `
            SELECT T.*, TN.NgayChiaSe, TN.TrangThai AS TrangThaiNhom, N.HoTen AS TenNguoiDang, N.AvatarURL, MH.TenMonHoc,
                   COALESCE((SELECT ROUND(AVG(SoSao), 1) FROM DANHGIA WHERE MaTL = T.MaTL), 0) AS DiemDanhGia,
                   (SELECT COUNT(*) FROM DANHGIA WHERE MaTL = T.MaTL) AS SoDanhGia
            FROM TAILIEU_NHOM TN
            JOIN TAILIEU T ON TN.MaTL = T.MaTL
            LEFT JOIN NGUOIDUNG N ON T.MaND_NguoiDang = N.MaND
            LEFT JOIN MONHOC MH ON T.MaMonHoc = MH.MaMonHoc
            WHERE TN.MaNhom = ? AND T.TrangThaiHienThi = 'Hien'
        `;
        const params = [maNhom];

        if (!isGroupAdmin) {
            query += " AND TN.TrangThai = 'Hien'";
        }

        query += " ORDER BY TN.NgayChiaSe DESC";

        const [rows] = await pool.execute(query, params);

        res.status(200).json({ documents: rows });
    } catch (error) {
        console.error('Lỗi API /groups/:maNhom/documents:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/:maNhom/documents/:maTL/toggle-status', authMiddleware, async (req, res) => {
    const maNhom = req.params.maNhom;
    const maTL = req.params.maTL;
    const maND = req.user.MaND;

    const pool = req.app.locals.pool;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [groupCheck] = await conn.execute('SELECT MaND_QuanTri, TenNhom FROM NHOM WHERE MaNhom = ?', [maNhom]);
        if (groupCheck.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Không tìm thấy nhóm.' });
        }
        if (groupCheck[0].MaND_QuanTri !== maND) {
            await conn.rollback();
            return res.status(403).json({ message: 'Chỉ quản trị viên mới có thể ẩn/hiện tài liệu.' });
        }
        const tenNhom = groupCheck[0].TenNhom;

        const [docInGroupCheck] = await conn.execute('SELECT TrangThai FROM TAILIEU_NHOM WHERE MaNhom = ? AND MaTL = ?', [maNhom, maTL]);
        if (docInGroupCheck.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Tài liệu không tồn tại trong nhóm này.' });
        }
        const currentStatus = docInGroupCheck[0].TrangThai;
        const newStatus = currentStatus === 'Hien' ? 'An' : 'Hien';

        await conn.execute('UPDATE TAILIEU_NHOM SET TrangThai = ? WHERE MaNhom = ? AND MaTL = ?', [newStatus, maNhom, maTL]);

        const [docCheck] = await conn.execute('SELECT TenTL, MaND_NguoiDang FROM TAILIEU WHERE MaTL = ?', [maTL]);
        if (docCheck.length > 0) {
            const tenTL = docCheck[0].TenTL;
            const nguoiDangId = docCheck[0].MaND_NguoiDang;
            
            if (String(nguoiDangId) !== String(maND)) {
                const actionText = newStatus === 'An' ? 'ẩn' : 'hiện lại';
                const thongBaoMsg = `Tài liệu "${tenTL}" của bạn đã bị quản trị viên ${actionText} trong nhóm "${tenNhom}".`;
                const linkDich = `/fe/pages/group/groupDetails.html?id=${maNhom}`;
                
                await conn.execute(
                    'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                    [nguoiDangId, 'HeThong', thongBaoMsg, linkDich]
                );
            }
        }

        await conn.commit();
        res.status(200).json({ message: 'Cập nhật trạng thái tài liệu thành công.', newStatus });
    } catch (error) {
        await conn.rollback();
        console.error('Lỗi API PUT /groups/:maNhom/documents/:maTL/toggle-status:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    } finally {
        conn.release();
    }
});


router.get('/:maNhom', authMiddleware, async (req, res) => {
    const maNhom = req.params.maNhom;
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT N.*, ND.HoTen AS TenNguoiQuanTri, MH.TenMonHoc
            FROM NHOM N
            JOIN NGUOIDUNG ND ON N.MaND_QuanTri = ND.MaND
            LEFT JOIN MONHOC MH ON N.MaMonHoc = MH.MaMonHoc
            WHERE N.MaNhom = ? AND N.TrangThai = 'HoatDong'
        `, [maNhom]);

        if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy nhóm.' });


        const [memberCheck] = await pool.execute('SELECT * FROM THANHVIEN_NHOM WHERE MaNhom = ? AND MaND = ?', [maNhom, req.user.MaND]);

        res.status(200).json({
            group: rows[0],
            isMember: memberCheck.length > 0
        });
    } catch (error) {
        console.error('Lỗi API /groups/:maNhom:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/:maNhom', authMiddleware, async (req, res) => {
    const maNhom = req.params.maNhom;
    const maND = req.user.MaND;
    const { tenNhom, moTa, maMonHoc } = req.body;

    if (!tenNhom) {
        return res.status(400).json({ message: 'Tên nhóm không được để trống.' });
    }

    try {
        const pool = req.app.locals.pool;

        const [groupCheck] = await pool.execute('SELECT MaND_QuanTri FROM NHOM WHERE MaNhom = ?', [maNhom]);
        if (groupCheck.length === 0) return res.status(404).json({ message: 'Không tìm thấy nhóm.' });
        if (groupCheck[0].MaND_QuanTri !== maND) return res.status(403).json({ message: 'Bạn không có quyền sửa nhóm này.' });

        await pool.execute('UPDATE NHOM SET TenNhom = ?, MoTa = ?, MaMonHoc = ? WHERE MaNhom = ?', [tenNhom, moTa || null, maMonHoc || null, maNhom]);
        res.status(200).json({ message: 'Cập nhật thành công.' });
    } catch (error) {
        console.error('Lỗi API /groups/:maNhom:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.delete('/:maNhom', authMiddleware, async (req, res) => {
    const maNhom = req.params.maNhom;
    const maND = req.user.MaND;
    try {
        const pool = req.app.locals.pool;
        const [groupCheck] = await pool.execute('SELECT MaND_QuanTri FROM NHOM WHERE MaNhom = ?', [maNhom]);
        if (groupCheck.length === 0) return res.status(404).json({ message: 'Không tìm thấy nhóm.' });
        if (groupCheck[0].MaND_QuanTri !== maND) return res.status(403).json({ message: 'Bạn không có quyền.' });
        await pool.execute('UPDATE NHOM SET TrangThai = "NgungHoatDong" WHERE MaNhom = ?', [maNhom]);
        res.status(200).json({ message: 'Thành công.' });
    } catch (error) {
        console.error('Lỗi API /groups/:maNhom:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.delete('/:maNhom/documents/:maTL', authMiddleware, async (req, res) => {
    const maNhom = req.params.maNhom;
    const maTL = req.params.maTL;
    const maND = req.user.MaND;
    const { lyDo } = req.body || {};

    const pool = req.app.locals.pool;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        const [groupCheck] = await conn.execute('SELECT MaND_QuanTri, TenNhom FROM NHOM WHERE MaNhom = ?', [maNhom]);
        if (groupCheck.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Không tìm thấy nhóm.' });
        }
        if (groupCheck[0].MaND_QuanTri !== maND) {
            await conn.rollback();
            return res.status(403).json({ message: 'Chỉ quản trị viên mới có thể xóa tài liệu khỏi nhóm.' });
        }
        const tenNhom = groupCheck[0].TenNhom;

        const [docInGroupCheck] = await conn.execute('SELECT * FROM TAILIEU_NHOM WHERE MaNhom = ? AND MaTL = ?', [maNhom, maTL]);
        if (docInGroupCheck.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Tài liệu không tồn tại trong nhóm này.' });
        }

        const [docCheck] = await conn.execute('SELECT TenTL, MaND_NguoiDang FROM TAILIEU WHERE MaTL = ?', [maTL]);
        
        await conn.execute('DELETE FROM TAILIEU_NHOM WHERE MaNhom = ? AND MaTL = ?', [maNhom, maTL]);

        if (docCheck.length > 0) {
            const tenTL = docCheck[0].TenTL;
            const nguoiDangId = docCheck[0].MaND_NguoiDang;
            
            if (String(nguoiDangId) !== String(maND)) {
                let thongBaoMsg = `Tài liệu "${tenTL}" của bạn đã bị quản trị viên ẩn/xóa khỏi nhóm "${tenNhom}".`;
                if (lyDo && lyDo.trim()) {
                    thongBaoMsg += ` Lý do: ${lyDo.trim()}`;
                }
                const linkDich = `/fe/pages/document/documentDetails.html?id=${maTL}`;
                
                await conn.execute(
                    'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                    [nguoiDangId, 'HeThong', thongBaoMsg, linkDich]
                );
            }
        }

        await conn.commit();
        res.status(200).json({ message: 'Đã xóa tài liệu khỏi nhóm thành công.' });
    } catch (error) {
        await conn.rollback();
        console.error('Lỗi API DELETE /groups/:maNhom/documents/:maTL:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    } finally {
        conn.release();
    }
});

module.exports = router;
