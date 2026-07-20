const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const { adminMiddleware } = require('./middlewares/auth');

router.get('/documents/list', adminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const status = req.query.status || 'ChoDuyet';
        const [rows] = await pool.execute(`
            SELECT 
                TL.MaTL, TL.TenTL, TL.MoTa, TL.FileURL, TL.LoaiFile, TL.NgayDang,
                ND.HoTen AS TenNguoiDang, ND.AvatarURL,
                MH.TenMonHoc,
                TL.TrangThaiKiemDuyet, TL.LyDoTuChoi, TL.PhanHoiTuChoi, TL.TrangThaiHienThi
            FROM TAILIEU TL
            LEFT JOIN NGUOIDUNG ND ON TL.MaND_NguoiDang = ND.MaND
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            WHERE TL.TrangThaiKiemDuyet = ?
            ORDER BY TL.MaTL DESC
        `, [status]);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách kiểm duyệt:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy dữ liệu.' });
    }
});

router.get('/documents/counts', adminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT TrangThaiKiemDuyet, COUNT(*) as count 
            FROM TAILIEU 
            GROUP BY TrangThaiKiemDuyet
        `);
        
        const counts = {
            ChoDuyet: 0,
            DaDuyet: 0,
            TuChoi: 0
        };
        
        rows.forEach(row => {
            if (counts[row.TrangThaiKiemDuyet] !== undefined) {
                counts[row.TrangThaiKiemDuyet] = row.count;
            }
        });
        
        res.status(200).json(counts);
    } catch (error) {
        console.error('Lỗi khi lấy số lượng tài liệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy dữ liệu.' });
    }
});

router.put('/documents/:maTL/review', adminMiddleware, async (req, res) => {
    const maTL = req.params.maTL;
    const { quyetDinh, lyDoTuChoi } = req.body;

    if (quyetDinh !== 'Duyet' && quyetDinh !== 'TuChoi') {
        return res.status(400).json({ message: 'Quyết định không hợp lệ.' });
    }

    if (quyetDinh === 'TuChoi' && (!lyDoTuChoi || lyDoTuChoi.trim() === '')) {
        return res.status(400).json({ message: 'Vui lòng cung cấp lý do từ chối.' });
    }

    const pool = req.app.locals.pool;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();


        const [docRows] = await conn.execute('SELECT MaND_NguoiDang, TenTL FROM TAILIEU WHERE MaTL = ?', [maTL]);
        if (docRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
        }

        const taiLieu = docRows[0];
        const trangThaiMoi = quyetDinh === 'Duyet' ? 'DaDuyet' : 'TuChoi';


        if (quyetDinh === 'TuChoi') {
            await conn.execute('UPDATE TAILIEU SET TrangThaiKiemDuyet = ?, LyDoTuChoi = ? WHERE MaTL = ?', [trangThaiMoi, lyDoTuChoi, maTL]);
        } else {
            await conn.execute('UPDATE TAILIEU SET TrangThaiKiemDuyet = ?, LyDoTuChoi = NULL WHERE MaTL = ?', [trangThaiMoi, maTL]);
        }

        let noiDungThongBao = '';
        if (quyetDinh === 'Duyet') {
            noiDungThongBao = `Tài liệu "${taiLieu.TenTL}" đã được duyệt.`;

            const [followers] = await conn.execute(
                'SELECT MaND_TheoDoi FROM THEODOI WHERE MaND_DuocTheoDoi = ?',
                [taiLieu.MaND_NguoiDang]
            );

            for (const follower of followers) {
                await conn.execute(
                    'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                    [
                        follower.MaND_TheoDoi,
                        'HeThong',
                        `Người bạn đang theo dõi vừa có tài liệu mới được đăng tải: "${taiLieu.TenTL}"!`,
                        `../document/documentDetails.html?id=${maTL}`
                    ]
                );
            }
        } else {
            noiDungThongBao = `Tài liệu "${taiLieu.TenTL}" bị từ chối với lý do: ${lyDoTuChoi}`;
        }

        await conn.execute(
            'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
            [taiLieu.MaND_NguoiDang, 'HeThong', noiDungThongBao, quyetDinh === 'Duyet' ? `../document/documentDetails.html?id=${maTL}` : `../document/myDocuments.html`]
        );

        await conn.commit();
        res.status(200).json({ message: 'Đã xử lý kiểm duyệt thành công.' });
    } catch (error) {
        await conn.rollback();
        console.error('Lỗi khi kiểm duyệt tài liệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ trong quá trình xử lý.' });
    } finally {
        conn.release();
    }
});

router.put('/documents/:maTL/toggle-visibility', adminMiddleware, async (req, res) => {
    const maTL = req.params.maTL;
    
    try {
        const pool = req.app.locals.pool;
        
        const [rows] = await pool.execute('SELECT TrangThaiHienThi, TrangThaiKiemDuyet FROM TAILIEU WHERE MaTL = ?', [maTL]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
        }
        
        if (rows[0].TrangThaiKiemDuyet !== 'DaDuyet') {
            return res.status(400).json({ message: 'Chỉ có thể ẩn/hiện tài liệu đã được duyệt.' });
        }
        
        const newStatus = rows[0].TrangThaiHienThi === 'Hien' ? 'An' : 'Hien';
        
        await pool.execute('UPDATE TAILIEU SET TrangThaiHienThi = ? WHERE MaTL = ?', [newStatus, maTL]);
        
        res.status(200).json({ 
            message: newStatus === 'An' ? 'Đã ẩn tài liệu.' : 'Đã hiện tài liệu.',
            TrangThaiHienThi: newStatus
        });
    } catch (error) {
        console.error('Lỗi khi toggle ẩn/hiện tài liệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/users', adminMiddleware, async (req, res) => {
    try {
        const { search, role, status, sort } = req.query;
        const pool = req.app.locals.pool;

        let sql = 'SELECT MaND, HoTen, Email, VaiTro, TrangThai, AvatarURL, NgayTao FROM NGUOIDUNG WHERE MaND <> ?';
        const params = [req.user.MaND];

        if (search) {
            sql += ' AND (HoTen LIKE ? OR Email LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term);
        }

        if (['SinhVien', 'GiaoVien', 'Admin'].includes(role)) {
            sql += ' AND VaiTro = ?';
            params.push(role);
        }

        if (['HoatDong', 'BiKhoa'].includes(status)) {
            sql += ' AND TrangThai = ?';
            params.push(status);
        }

        const sortMap = {
            newest: 'MaND DESC',
            oldest: 'MaND ASC',
            name_asc: 'HoTen ASC',
            name_desc: 'HoTen DESC'
        };

        sql += ` ORDER BY ${sortMap[sort] || sortMap.newest}`;
        const [rows] = await pool.execute(sql, params);
        res.status(200).json({ users: rows });
    } catch (error) {
        console.error('Lỗi API /users:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.delete('/users/:maND', adminMiddleware, async (req, res) => {
    const maND = parseInt(req.params.maND, 10);

    if (!Number.isInteger(maND)) {
        return res.status(400).json({ message: 'Người dùng không hợp lệ.' });
    }

    if (maND === req.user.MaND) {
        return res.status(403).json({ message: 'Bạn không thể tự xoá tài khoản của chính mình.' });
    }

    const pool = req.app.locals.pool;
    const conn = await pool.getConnection();

    const tableExists = async (tableName) => {
        const [rows] = await conn.execute(
            `SELECT 1
             FROM INFORMATION_SCHEMA.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
             LIMIT 1`,
            [tableName]
        );
        return rows.length > 0;
    };

    try {
        await conn.beginTransaction();

        const [userRows] = await conn.execute('SELECT MaND, HoTen, VaiTro, TrangThai FROM NGUOIDUNG WHERE MaND = ?', [maND]);
        if (userRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Không tìm thấy người dùng để xoá.' });
        }

        const user = userRows[0];
        if (user.VaiTro === 'Admin' && user.TrangThai === 'HoatDong') {
            const [adminCount] = await conn.execute("SELECT COUNT(*) AS total FROM NGUOIDUNG WHERE VaiTro = 'Admin' AND TrangThai = 'HoatDong'");
            if (adminCount[0].total <= 1) {
                await conn.rollback();
                return res.status(403).json({ message: 'Không thể xoá Admin cuối cùng của hệ thống.' });
            }
        }

        const [docRows] = await conn.execute('SELECT MaTL FROM TAILIEU WHERE MaND_NguoiDang = ?', [maND]);
        const documentIds = docRows.map(row => row.MaTL);

        if (documentIds.length > 0) {
            const placeholders = documentIds.map(() => '?').join(',');
            await conn.execute(`UPDATE BINHLUAN SET MaBL_Cha = NULL WHERE MaTL IN (${placeholders})`, documentIds);
            await conn.execute(`DELETE FROM BINHLUAN WHERE MaTL IN (${placeholders})`, documentIds);
            await conn.execute(`DELETE FROM BOOKMARK WHERE MaTL IN (${placeholders})`, documentIds);
            await conn.execute(`DELETE FROM DANHGIA WHERE MaTL IN (${placeholders})`, documentIds);
            await conn.execute(`DELETE FROM BAOCAOVIPHAM WHERE MaTL IN (${placeholders})`, documentIds);
            await conn.execute(`DELETE FROM TAILIEU_NHOM WHERE MaTL IN (${placeholders})`, documentIds);
            if (await tableExists('LICH_SU_TAI')) {
                await conn.execute(`DELETE FROM LICH_SU_TAI WHERE MaTL IN (${placeholders})`, documentIds);
            }
        }

        const [groupRows] = await conn.execute('SELECT MaNhom FROM NHOM WHERE MaND_QuanTri = ?', [maND]);
        const groupIds = groupRows.map(row => row.MaNhom);

        if (groupIds.length > 0) {
            const placeholders = groupIds.map(() => '?').join(',');
            await conn.execute(`DELETE FROM TAILIEU_NHOM WHERE MaNhom IN (${placeholders})`, groupIds);
            await conn.execute(`DELETE FROM THANHVIEN_NHOM WHERE MaNhom IN (${placeholders})`, groupIds);
            await conn.execute(`DELETE FROM NHOM WHERE MaNhom IN (${placeholders})`, groupIds);
        }

        await conn.execute(
            `UPDATE BINHLUAN
             SET MaBL_Cha = NULL
             WHERE MaBL_Cha IN (SELECT MaBL FROM (SELECT MaBL FROM BINHLUAN WHERE MaND = ?) AS user_comments)`,
            [maND]
        );
        await conn.execute('DELETE FROM BINHLUAN WHERE MaND = ?', [maND]);
        await conn.execute('DELETE FROM BOOKMARK WHERE MaND = ?', [maND]);
        await conn.execute('DELETE FROM DANHGIA WHERE MaND = ?', [maND]);
        await conn.execute('DELETE FROM BAOCAOVIPHAM WHERE MaND = ?', [maND]);
        await conn.execute('DELETE FROM THONGBAO WHERE MaND = ?', [maND]);
        await conn.execute('DELETE FROM THANHVIEN_NHOM WHERE MaND = ?', [maND]);
        await conn.execute('DELETE FROM NGUOIDUNG_MONHOC WHERE MaND = ?', [maND]);
        await conn.execute('DELETE FROM THEODOI WHERE MaND_TheoDoi = ? OR MaND_DuocTheoDoi = ?', [maND, maND]);

        if (await tableExists('LICH_SU_TAI')) {
            await conn.execute('DELETE FROM LICH_SU_TAI WHERE MaND = ?', [maND]);
        }
        if (await tableExists('AUDIT_LOG')) {
            await conn.execute('DELETE FROM AUDIT_LOG WHERE MaND_ThucHien = ? OR MaND_BiTacDong = ?', [maND, maND]);
        }

        if (documentIds.length > 0) {
            const placeholders = documentIds.map(() => '?').join(',');
            await conn.execute(`DELETE FROM TAILIEU WHERE MaTL IN (${placeholders})`, documentIds);
        }

        const [result] = await conn.execute('DELETE FROM NGUOIDUNG WHERE MaND = ?', [maND]);
        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Không tìm thấy người dùng để xoá.' });
        }

        await conn.commit();
        res.status(200).json({ message: `Đã xoá người dùng "${user.HoTen}" và dữ liệu liên quan.` });
    } catch (error) {
        await conn.rollback();
        console.error('Lỗi API DELETE /users/:maND:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi xoá người dùng.' });
    } finally {
        conn.release();
    }
});

router.put('/users/:maND/status', adminMiddleware, async (req, res) => {
    const maND = req.params.maND;
    const { trangThai } = req.body;

    if (trangThai !== 'HoatDong' && trangThai !== 'BiKhoa') {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    }

    if (parseInt(maND) === req.user.MaND) {
        return res.status(403).json({ message: 'Bạn không thể tự khóa tài khoản của chính mình.' });
    }

    try {
        const pool = req.app.locals.pool;

        const [userRows] = await pool.execute('SELECT VaiTro FROM NGUOIDUNG WHERE MaND = ?', [maND]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }

        if (trangThai === 'BiKhoa') {
            if (userRows[0].VaiTro === 'Admin') {
                const [adminCount] = await pool.execute("SELECT COUNT(*) AS total FROM NGUOIDUNG WHERE VaiTro = 'Admin' AND TrangThai = 'HoatDong'");
                if (adminCount[0].total <= 1) {
                    return res.status(403).json({ message: 'Không thể khóa Admin cuối cùng của hệ thống.' });
                }
            }
        }

        await pool.execute('UPDATE NGUOIDUNG SET TrangThai = ? WHERE MaND = ?', [trangThai, maND]);

        await pool.execute(
            'INSERT INTO AUDIT_LOG (MaND_ThucHien, MaND_BiTacDong, HanhDong, ChiTiet) VALUES (?, ?, ?, ?)',
            [req.user.MaND, maND, trangThai === 'BiKhoa' ? 'KhoaTaiKhoan' : 'MoKhoaTaiKhoan', `Đổi trạng thái thành ${trangThai}`]
        );

        res.status(200).json({ message: `Đã ${trangThai === 'BiKhoa' ? 'khóa' : 'mở khóa'} tài khoản.` });
    } catch (error) {
        console.error('Lỗi API /users/:maND/status:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/users/:maND/role', adminMiddleware, async (req, res) => {
    const maND = req.params.maND;
    const { vaiTro } = req.body;

    if (!['SinhVien', 'GiaoVien', 'Admin'].includes(vaiTro)) {
        return res.status(400).json({ message: 'Vai trò không hợp lệ.' });
    }

    if (parseInt(maND) === req.user.MaND) {
        return res.status(403).json({ message: 'Bạn không thể tự thay đổi quyền của chính mình.' });
    }

    try {
        const pool = req.app.locals.pool;

        const [userRows] = await pool.execute('SELECT VaiTro FROM NGUOIDUNG WHERE MaND = ?', [maND]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }

        if (userRows[0].VaiTro === 'Admin' && vaiTro !== 'Admin') {
            const [adminCount] = await pool.execute("SELECT COUNT(*) AS total FROM NGUOIDUNG WHERE VaiTro = 'Admin' AND TrangThai = 'HoatDong'");
            if (adminCount[0].total <= 1) {
                return res.status(403).json({ message: 'Không thể hạ quyền Admin cuối cùng của hệ thống.' });
            }
        }

        await pool.execute('UPDATE NGUOIDUNG SET VaiTro = ? WHERE MaND = ?', [vaiTro, maND]);

        await pool.execute(
            'INSERT INTO AUDIT_LOG (MaND_ThucHien, MaND_BiTacDong, HanhDong, ChiTiet) VALUES (?, ?, ?, ?)',
            [req.user.MaND, maND, 'DoiQuyen', `Đổi quyền thành ${vaiTro}`]
        );

        res.status(200).json({ message: 'Thay đổi quyền thành công.' });
    } catch (error) {
        console.error('Lỗi API /users/:maND/role:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/reports', adminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT B.*, T.TenTL, T.FileURL, T.TrangThaiKiemDuyet, N.HoTen AS NguoiBaoCao, N.AvatarURL AS AvatarNguoiBaoCao
            FROM BAOCAOVIPHAM B
            JOIN TAILIEU T ON B.MaTL = T.MaTL
            JOIN NGUOIDUNG N ON B.MaND = N.MaND
            ORDER BY B.NgayBaoCao DESC
        `);
        res.status(200).json({ reports: rows });
    } catch (error) {
        console.error('Lỗi API /reports:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/reports/:maBC/review', adminMiddleware, async (req, res) => {
    const maBC = req.params.maBC;
    const { quyetDinh } = req.body;

    if (quyetDinh !== 'ViPham' && quyetDinh !== 'TuChoi') {
        return res.status(400).json({ message: 'Quyết định không hợp lệ.' });
    }

    const pool = req.app.locals.pool;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [bcRows] = await conn.execute(`
            SELECT B.MaTL, B.MaND AS NguoiBaoCao, T.MaND_NguoiDang, T.TenTL 
            FROM BAOCAOVIPHAM B 
            JOIN TAILIEU T ON B.MaTL = T.MaTL 
            WHERE B.MaBC = ?
        `, [maBC]);

        if (bcRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Không tìm thấy báo cáo.' });
        }

        if (quyetDinh === 'ViPham') {
            await conn.execute('UPDATE BAOCAOVIPHAM SET TrangThai = ? WHERE MaBC = ?', ['DaXuLy', maBC]);

            if (bcRows.length > 0) {
                const doc = bcRows[0];
                await conn.execute('UPDATE TAILIEU SET TrangThaiKiemDuyet = ? WHERE MaTL = ?', ['TuChoi', doc.MaTL]);

                await conn.execute(
                    'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                    [doc.MaND_NguoiDang, 'HeThong', `Tài liệu "${doc.TenTL}" của bạn đã bị từ chối do vi phạm quy định cộng đồng.`, '../document/myDocuments.html']
                );


                await conn.execute(
                    'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                    [doc.NguoiBaoCao, 'HeThong', `Báo cáo vi phạm của bạn cho tài liệu "${doc.TenTL}" đã được xử lý (Vi phạm). Cảm ơn bạn đã đóng góp.`, `../document/documentDetails.html?id=${doc.MaTL}`]
                );
            }
        } else {

            await conn.execute('UPDATE BAOCAOVIPHAM SET TrangThai = ? WHERE MaBC = ?', ['TuChoi', maBC]);

            if (bcRows.length > 0) {
                const doc = bcRows[0];

                await conn.execute(
                    'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                    [doc.NguoiBaoCao, 'HeThong', `Báo cáo vi phạm của bạn cho tài liệu "${doc.TenTL}" đã bị từ chối do không phát hiện vi phạm.`, `../document/documentDetails.html?id=${doc.MaTL}`]
                );
            }
        }

        await conn.commit();
        res.status(200).json({ message: 'Xử lý báo cáo thành công.' });
    } catch (error) {
        await conn.rollback();
        console.error('Lỗi API /reports/:maBC/review:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    } finally {
        conn.release();
    }
});

router.delete('/reports/:maBC', adminMiddleware, async (req, res) => {
    const maBC = Number.parseInt(req.params.maBC, 10);

    if (!Number.isInteger(maBC) || maBC <= 0) {
        return res.status(400).json({ message: 'Báo cáo không hợp lệ.' });
    }

    try {
        const pool = req.app.locals.pool;
        const [result] = await pool.execute('DELETE FROM BAOCAOVIPHAM WHERE MaBC = ?', [maBC]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy báo cáo để xoá.' });
        }

        res.status(200).json({ message: 'Đã xoá báo cáo thành công.' });
    } catch (error) {
        console.error('Lỗi API DELETE /admin/reports/:maBC:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi xoá báo cáo.' });
    }
});

router.get('/subjects', adminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT MH.*, COUNT(TL.MaTL) AS SoTaiLieu
            FROM MONHOC MH
            LEFT JOIN TAILIEU TL ON MH.MaMonHoc = TL.MaMonHoc AND TL.TrangThaiKiemDuyet = 'DaDuyet'
            WHERE MH.TrangThai IN ('HoatDong', 'TamAn')
            GROUP BY MH.MaMonHoc
            ORDER BY MH.TenMonHoc ASC
        `);
        res.status(200).json({ subjects: rows });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/subjects/:id/status', adminMiddleware, async (req, res) => {
    const id = req.params.id;
    const { trangThai } = req.body;

    if (trangThai !== 'HoatDong' && trangThai !== 'TamAn') {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    }

    try {
        const pool = req.app.locals.pool;
        const [result] = await pool.execute('UPDATE MONHOC SET TrangThai = ? WHERE MaMonHoc = ?', [trangThai, id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy môn học.' });
        }
        
        res.status(200).json({ message: `Đã ${trangThai === 'TamAn' ? 'ẩn' : 'hiện'} môn học thành công.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.post('/subjects', adminMiddleware, async (req, res) => {
    const { tenMonHoc, capHoc, moTa } = req.body;
    if (!tenMonHoc) return res.status(400).json({ message: 'Tên môn học bắt buộc.' });

    try {
        const pool = req.app.locals.pool;
        const [result] = await pool.execute('INSERT INTO MONHOC (TenMonHoc, CapHoc, MoTa) VALUES (?, ?, ?)', [tenMonHoc, capHoc || 'Khac', moTa || '']);
        res.status(201).json({ message: 'Thêm môn học thành công.', id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/subjects/:id', adminMiddleware, async (req, res) => {
    const id = req.params.id;
    const { tenMonHoc, capHoc, moTa } = req.body;
    if (!tenMonHoc) return res.status(400).json({ message: 'Tên môn học bắt buộc.' });

    try {
        const pool = req.app.locals.pool;
        const [result] = await pool.execute('UPDATE MONHOC SET TenMonHoc = ?, CapHoc = ?, MoTa = ? WHERE MaMonHoc = ?', [tenMonHoc, capHoc || 'Khac', moTa || '', id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy môn học.' });
        }
        
        res.status(200).json({ message: 'Cập nhật thành công.' });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.delete('/subjects/:id', adminMiddleware, async (req, res) => {
    const id = req.params.id;
    try {
        const pool = req.app.locals.pool;
        const [result] = await pool.execute('DELETE FROM MONHOC WHERE MaMonHoc = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy môn học.' });
        }
        
        res.status(200).json({ message: 'Đã xóa vĩnh viễn môn học.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/stats/overview', adminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;

        const [userCount] = await pool.execute('SELECT COUNT(*) as count FROM NGUOIDUNG');
        const [docCount] = await pool.execute('SELECT COUNT(*) as count FROM TAILIEU');
        const [downloadSum] = await pool.execute('SELECT SUM(SoLuotTai) as total FROM TAILIEU');
        const [reportCount] = await pool.execute('SELECT COUNT(*) as count FROM BAOCAOVIPHAM WHERE TrangThai = "ChoXuLy"');
        const [pendingDocCount] = await pool.execute('SELECT COUNT(*) as count FROM TAILIEU WHERE TrangThaiKiemDuyet = "ChoDuyet"');
        const [pendingPaymentCount] = await pool.execute('SELECT COUNT(*) as count FROM GIAODICH_NAPXU WHERE TrangThai = "ChoDuyet"');

        const [usersByRoleRows] = await pool.execute('SELECT VaiTro, COUNT(*) as count FROM NGUOIDUNG GROUP BY VaiTro');
        
        const [docsByStatusRows] = await pool.execute('SELECT TrangThaiKiemDuyet, COUNT(*) as count FROM TAILIEU GROUP BY TrangThaiKiemDuyet');
        
        const [docsBySubjectRows] = await pool.execute(`
            SELECT MH.TenMonHoc, COUNT(TL.MaTL) as count 
            FROM TAILIEU TL
            JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            GROUP BY MH.TenMonHoc
            ORDER BY count DESC
            LIMIT 5
        `);

        const [topDepositors] = await pool.execute(`
            SELECT ND.MaND, ND.HoTen, ND.AvatarURL, SUM(G.SoXu) as totalXu
            FROM GIAODICH_NAPXU G
            JOIN NGUOIDUNG ND ON G.MaND = ND.MaND
            WHERE G.TrangThai = 'DaDuyet'
            GROUP BY ND.MaND, ND.HoTen, ND.AvatarURL
            ORDER BY totalXu DESC
            LIMIT 5
        `);

        const [topContributors] = await pool.execute(`
            SELECT ND.MaND, ND.HoTen, ND.AvatarURL,
                (SELECT COUNT(*) FROM TAILIEU TL WHERE TL.MaND_NguoiDang = ND.MaND AND TL.TrangThaiKiemDuyet = 'DaDuyet') AS countDoc,
                (SELECT COUNT(*) FROM BINHLUAN BL WHERE BL.MaND = ND.MaND) AS countComment
            FROM NGUOIDUNG ND
            ORDER BY (countDoc * 10 + countComment) DESC
            LIMIT 5
        `);

        res.status(200).json({
            users: userCount[0].count,
            documents: docCount[0].count,
            downloads: downloadSum[0].total || 0,
            pendingReports: reportCount[0].count,
            pendingDocs: pendingDocCount[0].count,
            pendingPayments: pendingPaymentCount[0].count,
            usersByRole: usersByRoleRows,
            docsByStatus: docsByStatusRows,
            docsBySubject: docsBySubjectRows,
            topDepositors: topDepositors,
            topContributors: topContributors
        });
    } catch (error) {
        console.error('Lỗi API /stats/overview:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/subject-suggestions', adminMiddleware, async (req, res) => {
    try {
        const status = req.query.status || 'ChoDuyet';
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT
                DX.MaDeXuat,
                DX.TenMonHoc,
                DX.CapHoc,
                DX.MoTa,
                DX.LyDo,
                DX.TrangThai,
                DX.LyDoTuChoi,
                DX.MaMonHocDaTao,
                DX.NgayDeXuat,
                DX.NgayDuyet,
                ND.HoTen AS TenNguoiDeXuat,
                ND.Email AS EmailNguoiDeXuat,
                AD.HoTen AS TenNguoiDuyet
            FROM DEXUAT_MONHOC DX
            JOIN NGUOIDUNG ND ON DX.MaND_DeXuat = ND.MaND
            LEFT JOIN NGUOIDUNG AD ON DX.MaND_Duyet = AD.MaND
            WHERE DX.TrangThai = ?
            ORDER BY DX.NgayDeXuat DESC
        `, [status]);

        res.status(200).json({ suggestions: rows });
    } catch (error) {
        console.error('Lỗi API GET /admin/subject-suggestions:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.post('/subject-suggestions/:id/approve', adminMiddleware, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: 'Đề xuất không hợp lệ.' });
    }

    const conn = await req.app.locals.pool.getConnection();
    try {
        await conn.beginTransaction();

        const [suggestions] = await conn.execute(
            'SELECT * FROM DEXUAT_MONHOC WHERE MaDeXuat = ? FOR UPDATE',
            [id]
        );

        if (suggestions.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Không tìm thấy đề xuất.' });
        }

        const suggestion = suggestions[0];
        if (suggestion.TrangThai !== 'ChoDuyet') {
            await conn.rollback();
            return res.status(400).json({ message: 'Đề xuất này đã được xử lý.' });
        }

        const [existingSubjects] = await conn.execute(
            'SELECT MaMonHoc FROM MONHOC WHERE LOWER(TenMonHoc) = LOWER(?) AND TrangThai = "HoatDong" LIMIT 1',
            [suggestion.TenMonHoc]
        );

        let maMonHoc = existingSubjects[0]?.MaMonHoc;
        if (!maMonHoc) {
            const [insertResult] = await conn.execute(
                'INSERT INTO MONHOC (TenMonHoc, CapHoc, MoTa) VALUES (?, ?, ?)',
                [suggestion.TenMonHoc, suggestion.CapHoc || 'Khac', suggestion.MoTa || '']
            );
            maMonHoc = insertResult.insertId;
        }

        await conn.execute(
            `UPDATE DEXUAT_MONHOC
             SET TrangThai = 'DaDuyet', MaMonHocDaTao = ?, MaND_Duyet = ?, NgayDuyet = NOW(), LyDoTuChoi = NULL
             WHERE MaDeXuat = ?`,
            [maMonHoc, req.user.MaND, id]
        );

        await conn.execute(
            'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
            [suggestion.MaND_DeXuat, 'HeThong', `Đề xuất môn học "${suggestion.TenMonHoc}" đã được duyệt.`, '../user/userHome.html']
        );

        await conn.commit();
        res.status(200).json({ message: 'Đã duyệt đề xuất và tạo môn học.', maMonHoc });
    } catch (error) {
        await conn.rollback();
        console.error('Lỗi API approve subject suggestion:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    } finally {
        conn.release();
    }
});

router.post('/subject-suggestions/:id/reject', adminMiddleware, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: 'Đề xuất không hợp lệ.' });
    }

    const lyDoTuChoi = (req.body.lyDoTuChoi || '').trim();
    const conn = await req.app.locals.pool.getConnection();

    try {
        await conn.beginTransaction();

        const [suggestions] = await conn.execute(
            'SELECT * FROM DEXUAT_MONHOC WHERE MaDeXuat = ? FOR UPDATE',
            [id]
        );

        if (suggestions.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Không tìm thấy đề xuất.' });
        }

        const suggestion = suggestions[0];
        if (suggestion.TrangThai !== 'ChoDuyet') {
            await conn.rollback();
            return res.status(400).json({ message: 'Đề xuất này đã được xử lý.' });
        }

        await conn.execute(
            `UPDATE DEXUAT_MONHOC
             SET TrangThai = 'TuChoi', LyDoTuChoi = ?, MaND_Duyet = ?, NgayDuyet = NOW()
             WHERE MaDeXuat = ?`,
            [lyDoTuChoi || null, req.user.MaND, id]
        );

        await conn.execute(
            'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
            [suggestion.MaND_DeXuat, 'HeThong', `Đề xuất môn học "${suggestion.TenMonHoc}" đã bị từ chối.`, '../document/uploadDocument.html']
        );

        await conn.commit();
        res.status(200).json({ message: 'Đã từ chối đề xuất môn học.' });
    } catch (error) {
        await conn.rollback();
        console.error('Lỗi API reject subject suggestion:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    } finally {
        conn.release();
    }
});

router.get('/groups', adminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT N.*, ND.HoTen AS TenNguoiQuanTri, ND.AvatarURL AS AvatarQuanTri, MH.TenMonHoc,
                   (SELECT COUNT(*) FROM THANHVIEN_NHOM WHERE MaNhom = N.MaNhom) AS SoLuongThanhVien
            FROM NHOM N
            JOIN NGUOIDUNG ND ON N.MaND_QuanTri = ND.MaND
            LEFT JOIN MONHOC MH ON N.MaMonHoc = MH.MaMonHoc
            ORDER BY N.NgayTao DESC
        `);
        res.status(200).json({ groups: rows });
    } catch (error) {
        console.error('Lỗi API /admin/groups:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/groups/:maNhom/status', adminMiddleware, async (req, res) => {
    const maNhom = req.params.maNhom;
    try {
        const pool = req.app.locals.pool;

        const [rows] = await pool.execute('SELECT TrangThai FROM NHOM WHERE MaNhom = ?', [maNhom]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy nhóm.' });
        }

        const currentState = rows[0].TrangThai;
        const newState = currentState === 'HoatDong' ? 'NgungHoatDong' : 'HoatDong';

        await pool.execute('UPDATE NHOM SET TrangThai = ? WHERE MaNhom = ?', [newState, maNhom]);

        res.status(200).json({
            message: newState === 'NgungHoatDong' ? 'Đã giải tán nhóm.' : 'Đã khôi phục nhóm.',
            TrangThai: newState
        });
    } catch (error) {
        console.error('Lỗi API /admin/groups/:maNhom/status:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.delete('/groups/:maNhom', adminMiddleware, async (req, res) => {
    const maNhom = req.params.maNhom;
    try {
        const pool = req.app.locals.pool;

        await pool.execute('DELETE FROM THANHVIEN_NHOM WHERE MaNhom = ?', [maNhom]);
        await pool.execute('DELETE FROM TAILIEU_NHOM WHERE MaNhom = ?', [maNhom]);
        
        const [result] = await pool.execute('DELETE FROM NHOM WHERE MaNhom = ?', [maNhom]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy nhóm để xóa.' });
        }

        res.status(200).json({ message: 'Đã xóa nhóm vĩnh viễn khỏi cơ sở dữ liệu.' });
    } catch (error) {
        console.error('Lỗi API DELETE /admin/groups/:maNhom:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi xóa nhóm.' });
    }
});

module.exports = router;
