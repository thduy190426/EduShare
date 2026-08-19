const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { adminMiddleware, teacherMiddleware } = require('./middlewares/auth');
router.get('/documents/list', teacherMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const status = req.query.status || 'ChoDuyet';
        let baseCondition = `WHERE TL.TrangThaiKiemDuyet = ?`;
        const params = [status];
        if (req.user.VaiTro === 'GiaoVien') {
            baseCondition += ` AND ND.VaiTro = 'SinhVien'`;
        }
        const countSql = `SELECT COUNT(*) as total FROM TAILIEU TL LEFT JOIN NGUOIDUNG ND ON TL.MaND_NguoiDang = ND.MaND ${baseCondition}`;
        const [countResult] = await pool.execute(countSql, params);
        const totalRecords = countResult[0].total;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const totalPages = Math.ceil(totalRecords / limit);
        const offset = (page - 1) * limit;
        const validSortColumns = ['TenTL', 'TenNguoiDang', 'TenMonHoc', 'NgayDang', 'TrangThaiKiemDuyet'];
        let sortBy = req.query.sortBy || 'NgayDang';
        if (!validSortColumns.includes(sortBy)) sortBy = 'NgayDang';
        let sortOrder = (req.query.order && req.query.order.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
        let sortClause = `ORDER BY TL.NgayDang DESC`;
        if (sortBy === 'TenTL') sortClause = `ORDER BY TL.TenTL ${sortOrder}`;
        else if (sortBy === 'TenNguoiDang') sortClause = `ORDER BY ND.HoTen ${sortOrder}`;
        else if (sortBy === 'TenMonHoc') sortClause = `ORDER BY MH.TenMonHoc ${sortOrder}`;
        else if (sortBy === 'NgayDang') sortClause = `ORDER BY TL.NgayDang ${sortOrder}`;
        else if (sortBy === 'TrangThaiKiemDuyet') sortClause = `ORDER BY TL.TrangThaiKiemDuyet ${sortOrder}`;
        let sql = `
            SELECT 
                TL.MaTL, TL.TenTL, TL.MoTa, TL.FileURL, TL.LoaiFile, TL.NgayDang,
                ND.HoTen AS TenNguoiDang, ND.AvatarURL,
                MH.TenMonHoc,
                TL.TrangThaiKiemDuyet, TL.LyDoTuChoi, TL.PhanHoiTuChoi, TL.TrangThaiHienThi
            FROM TAILIEU TL
            LEFT JOIN NGUOIDUNG ND ON TL.MaND_NguoiDang = ND.MaND
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            ${baseCondition}
            ${sortClause}
            LIMIT ? OFFSET ?
        `;
        const queryParams = [...params, limit.toString(), offset.toString()];
        const [rows] = await pool.execute(sql, queryParams);
        res.status(200).json({ 
            data: rows,
            pagination: { currentPage: page, limit, totalPages, totalRecords }
        });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách kiểm duyệt:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy dữ liệu.' });
    }
});
router.get('/documents/counts', teacherMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        let sql = `SELECT TL.TrangThaiKiemDuyet, COUNT(*) as count FROM TAILIEU TL`;
        if (req.user.VaiTro === 'GiaoVien') {
            sql += ` JOIN NGUOIDUNG ND ON TL.MaND_NguoiDang = ND.MaND WHERE ND.VaiTro = 'SinhVien'`;
        }
        sql += ` GROUP BY TL.TrangThaiKiemDuyet`;
        const [rows] = await pool.execute(sql);
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
router.put('/documents/bulk-review', teacherMiddleware, async (req, res) => {
    const { documentIds, quyetDinh, lyDoTuChoi } = req.body;
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({ message: 'Danh sách tài liệu không hợp lệ.' });
    }
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
        let successCount = 0;
        let failCount = 0;
        for (const maTL of documentIds) {
            const [docRows] = await conn.execute(
                'SELECT T.MaND_NguoiDang, T.TenTL, ND.VaiTro FROM TAILIEU T JOIN NGUOIDUNG ND ON T.MaND_NguoiDang = ND.MaND WHERE T.MaTL = ?', 
                [maTL]
            );
            if (docRows.length === 0) {
                failCount++;
                continue;
            }
            const taiLieu = docRows[0];
            if (req.user.VaiTro === 'GiaoVien' && taiLieu.VaiTro !== 'SinhVien') {
                failCount++;
                continue;
            }
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
            successCount++;
        }
        await conn.commit();
        res.status(200).json({ 
            message: `Đã xử lý xong. Thành công: ${successCount}, Thất bại: ${failCount}` 
        });
    } catch (error) {
        await conn.rollback();
        console.error('Lỗi khi duyệt hàng loạt:', error);
        res.status(500).json({ message: 'Lỗi máy chủ trong quá trình xử lý.' });
    } finally {
        conn.release();
    }
});
router.put('/documents/:maTL/review', teacherMiddleware, async (req, res) => {
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
        const [docRows] = await conn.execute(
            'SELECT T.MaND_NguoiDang, T.TenTL, ND.VaiTro FROM TAILIEU T JOIN NGUOIDUNG ND ON T.MaND_NguoiDang = ND.MaND WHERE T.MaTL = ?', 
            [maTL]
        );
        if (docRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
        }
        const taiLieu = docRows[0];
        if (req.user.VaiTro === 'GiaoVien' && taiLieu.VaiTro !== 'SinhVien') {
            await conn.rollback();
            return res.status(403).json({ message: 'Bạn chỉ có quyền kiểm duyệt tài liệu của Học sinh.' });
        }
        const trangThaiMoi = quyetDinh === 'Duyet' ? 'DaDuyet' : 'TuChoi';
        if (quyetDinh === 'TuChoi') {
            await conn.execute('UPDATE TAILIEU SET TrangThaiKiemDuyet = ?, LyDoTuChoi = ? WHERE MaTL = ?', [trangThaiMoi, lyDoTuChoi, maTL]);
        } else {
            await conn.execute('UPDATE TAILIEU SET TrangThaiKiemDuyet = ?, LyDoTuChoi = NULL WHERE MaTL = ?', [trangThaiMoi, maTL]);
        }
        let noiDungThongBao = '';
        if (quyetDinh === 'Duyet') {
            let rewardXu = 0;
            try {
                const [cfg] = await conn.execute('SELECT GiaTri FROM CAUHINH_HETHONG WHERE TenCauHinh = "DOC_APPROVAL_REWARD_XU"');
                if (cfg.length > 0) rewardXu = parseInt(cfg[0].GiaTri) || 0;
            } catch (e) {}

            if (rewardXu > 0) {
                await conn.execute('UPDATE NGUOIDUNG SET SoDuXu = SoDuXu + ? WHERE MaND = ?', [rewardXu, taiLieu.MaND_NguoiDang]);
                await conn.execute("INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, 'ThuongXu', ?, ?)", [taiLieu.MaND_NguoiDang, rewardXu, `Thưởng ${rewardXu} Xu vì tài liệu được duyệt: ${taiLieu.TenTL}`]);
            }

            noiDungThongBao = `Tài liệu "${taiLieu.TenTL}" đã được duyệt.` + (rewardXu > 0 ? ` Bạn được thưởng +${rewardXu} Xu.` : '');
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
router.put('/documents/:maTL/toggle-visibility', teacherMiddleware, async (req, res) => {
    const maTL = req.params.maTL;
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(
            'SELECT T.TrangThaiHienThi, T.TrangThaiKiemDuyet, ND.VaiTro FROM TAILIEU T JOIN NGUOIDUNG ND ON T.MaND_NguoiDang = ND.MaND WHERE T.MaTL = ?', 
            [maTL]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
        }
        if (req.user.VaiTro === 'GiaoVien' && rows[0].VaiTro !== 'SinhVien') {
            return res.status(403).json({ message: 'Bạn chỉ có quyền ẩn/hiện tài liệu của Học sinh.' });
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
        const { search, role, status, sort, page, limit } = req.query;
        const pool = req.app.locals.pool;
        let baseCondition = 'WHERE MaND <> ?';
        const params = [req.user.MaND];
        if (search) {
            baseCondition += ' AND (HoTen LIKE ? OR Email LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term);
        }
        if (['SinhVien', 'GiaoVien', 'Admin'].includes(role)) {
            baseCondition += ' AND VaiTro = ?';
            params.push(role);
        }
        if (['HoatDong', 'BiKhoa'].includes(status)) {
            baseCondition += ' AND TrangThai = ?';
            params.push(status);
        }
        const countSql = `SELECT COUNT(*) as total FROM NGUOIDUNG ${baseCondition}`;
        const [countResult] = await pool.execute(countSql, params);
        const totalRecords = countResult[0].total;
        const currentPage = parseInt(page) || 1;
        const perPage = parseInt(limit) || 10;
        const totalPages = Math.ceil(totalRecords / perPage);
        const offset = (currentPage - 1) * perPage;
        const sortMap = {
            newest: 'NGUOIDUNG.MaND DESC',
            oldest: 'NGUOIDUNG.MaND ASC',
            name_asc: 'NGUOIDUNG.HoTen ASC',
            name_desc: 'NGUOIDUNG.HoTen DESC'
        };
        
        let sql = `
            SELECT NGUOIDUNG.MaND, NGUOIDUNG.HoTen, NGUOIDUNG.Email, NGUOIDUNG.VaiTro, NGUOIDUNG.TrangThai, NGUOIDUNG.AvatarURL, NGUOIDUNG.NgayTao,
                   DANHHIEU.TenDanhHieu AS DanhHieu, DANHHIEU.IconClass AS DanhHieuIcon, DANHHIEU.MauSac AS DanhHieuMauSac
            FROM NGUOIDUNG 
            LEFT JOIN NGUOIDUNG_DANHHIEU ON NGUOIDUNG.MaND = NGUOIDUNG_DANHHIEU.MaND AND NGUOIDUNG_DANHHIEU.LaDanhHieuChinh = TRUE
            LEFT JOIN DANHHIEU ON NGUOIDUNG_DANHHIEU.MaDanhHieu = DANHHIEU.MaDanhHieu
            ${baseCondition.replace(/MaND/g, 'NGUOIDUNG.MaND').replace(/HoTen/g, 'NGUOIDUNG.HoTen').replace(/Email/g, 'NGUOIDUNG.Email').replace(/VaiTro/g, 'NGUOIDUNG.VaiTro').replace(/TrangThai/g, 'NGUOIDUNG.TrangThai')}
        `;
        sql += ` ORDER BY ${sortMap[sort] || sortMap.newest}`;
        sql += ` LIMIT ? OFFSET ?`;
        const queryParams = [...params, perPage.toString(), offset.toString()];
        const [rows] = await pool.execute(sql, queryParams);
        res.status(200).json({ 
            data: rows, 
            pagination: { currentPage, limit: perPage, totalPages, totalRecords } 
        });
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
        const [docRows] = await conn.execute('SELECT MaTL, FileURL, PreviewURL, ThumbnailURL FROM TAILIEU WHERE MaND_NguoiDang = ?', [maND]);
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
            await conn.execute(`DELETE FROM TAILIEU_DAMUA WHERE MaTL IN (${placeholders})`, documentIds);
            await conn.execute(`DELETE FROM TAILIEU WHERE MaTL IN (${placeholders})`, documentIds);
            try {
                for (const doc of docRows) {
                    if (doc.FileURL) {
                        const filePath = path.join(__dirname, 'public', doc.FileURL);
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    }
                    if (doc.PreviewURL) {
                        const coverPath = path.join(__dirname, 'public', doc.PreviewURL);
                        if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
                    }
                }
            } catch (e) {
                console.error('Lỗi xóa file vật lý khi xóa người dùng:', e);
            }
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
router.put('/users/bulk-status', adminMiddleware, async (req, res) => {
    const { userIds, trangThai } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: 'Danh sách người dùng không hợp lệ.' });
    }
    if (trangThai !== 'HoatDong' && trangThai !== 'BiKhoa') {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    }
    if (userIds.includes(req.user.MaND.toString()) || userIds.includes(req.user.MaND)) {
        return res.status(403).json({ message: 'Bạn không thể khóa/mở khóa tài khoản của chính mình trong thao tác hàng loạt.' });
    }
    const pool = req.app.locals.pool;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        if (trangThai === 'BiKhoa') {
            const placeholders = userIds.map(() => '?').join(',');
            const [adminRows] = await conn.execute(`SELECT MaND FROM NGUOIDUNG WHERE MaND IN (${placeholders}) AND VaiTro = 'Admin'`, userIds);
            if (adminRows.length > 0) {
                const [activeAdmins] = await conn.execute("SELECT COUNT(*) AS total FROM NGUOIDUNG WHERE VaiTro = 'Admin' AND TrangThai = 'HoatDong'");
                if (activeAdmins[0].total <= adminRows.length) {
                    await conn.rollback();
                    return res.status(403).json({ message: 'Không thể khóa Admin cuối cùng của hệ thống.' });
                }
            }
        }
        const placeholders = userIds.map(() => '?').join(',');
        await conn.execute(`UPDATE NGUOIDUNG SET TrangThai = ? WHERE MaND IN (${placeholders})`, [trangThai, ...userIds]);
        for (const maND of userIds) {
            await conn.execute(
                'INSERT INTO AUDIT_LOG (MaND_ThucHien, MaND_BiTacDong, HanhDong, ChiTiet) VALUES (?, ?, ?, ?)',
                [req.user.MaND, maND, trangThai === 'BiKhoa' ? 'KhoaTaiKhoan' : 'MoKhoaTaiKhoan', `Đổi trạng thái thành ${trangThai} (Hàng loạt)`]
            );
        }
        await conn.commit();
        res.status(200).json({ message: `Đã ${trangThai === 'BiKhoa' ? 'khóa' : 'mở khóa'} ${userIds.length} tài khoản.` });
    } catch (error) {
        await conn.rollback();
        console.error('Lỗi API /users/bulk-status:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
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
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        try {
            const [userRows] = await connection.execute('SELECT VaiTro FROM NGUOIDUNG WHERE MaND = ? FOR UPDATE', [maND]);
            if (userRows.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
            }
            if (trangThai === 'BiKhoa') {
                if (userRows[0].VaiTro === 'Admin') {
                    const [adminCount] = await connection.execute("SELECT COUNT(*) AS total FROM NGUOIDUNG WHERE VaiTro = 'Admin' AND TrangThai = 'HoatDong' FOR UPDATE");
                    if (adminCount[0].total <= 1) {
                        await connection.rollback();
                        connection.release();
                        return res.status(403).json({ message: 'Không thể khóa Admin cuối cùng của hệ thống.' });
                    }
                }
            }
            await connection.execute('UPDATE NGUOIDUNG SET TrangThai = ? WHERE MaND = ?', [trangThai, maND]);
            await connection.execute(
                'INSERT INTO AUDIT_LOG (MaND_ThucHien, MaND_BiTacDong, HanhDong, ChiTiet) VALUES (?, ?, ?, ?)',
                [req.user.MaND, maND, trangThai === 'BiKhoa' ? 'KhoaTaiKhoan' : 'MoKhoaTaiKhoan', `Đổi trạng thái thành ${trangThai}`]
            );
            await connection.commit();
            res.status(200).json({ message: `Đã ${trangThai === 'BiKhoa' ? 'khóa' : 'mở khóa'} tài khoản.` });
        } catch (dbErr) {
            await connection.rollback();
            throw dbErr;
        } finally {
            connection.release();
        }
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
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        try {
            const [userRows] = await connection.execute('SELECT VaiTro FROM NGUOIDUNG WHERE MaND = ? FOR UPDATE', [maND]);
            if (userRows.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
            }
            if (userRows[0].VaiTro === 'Admin' && vaiTro !== 'Admin') {
                const [adminCount] = await connection.execute("SELECT COUNT(*) AS total FROM NGUOIDUNG WHERE VaiTro = 'Admin' AND TrangThai = 'HoatDong' FOR UPDATE");
                if (adminCount[0].total <= 1) {
                    await connection.rollback();
                    connection.release();
                    return res.status(403).json({ message: 'Không thể hạ quyền Admin cuối cùng của hệ thống.' });
                }
            }
            await connection.execute('UPDATE NGUOIDUNG SET VaiTro = ? WHERE MaND = ?', [vaiTro, maND]);
            await connection.execute(
                'INSERT INTO AUDIT_LOG (MaND_ThucHien, MaND_BiTacDong, HanhDong, ChiTiet) VALUES (?, ?, ?, ?)',
                [req.user.MaND, maND, 'DoiQuyen', `Đổi quyền thành ${vaiTro}`]
            );
            await connection.commit();
            res.status(200).json({ message: 'Thay đổi quyền thành công.' });
        } catch (dbErr) {
            await connection.rollback();
            throw dbErr;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Lỗi API /users/:maND/role:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
router.get('/reports/counts', adminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT TrangThai, COUNT(*) as count 
            FROM BAOCAOVIPHAM 
            GROUP BY TrangThai
        `);
        const counts = { ChoXuLy: 0, DaXuLy: 0, TuChoi: 0 };
        rows.forEach(row => {
            if (counts[row.TrangThai] !== undefined) {
                counts[row.TrangThai] = row.count;
            }
        });
        res.status(200).json(counts);
    } catch (error) {
        console.error('Lỗi API /reports/counts:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
router.get('/reports', adminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        let statusFilter = req.query.status;
        let whereClause = '';
        let params = [];
        let countParams = [];
        if (statusFilter && ['ChoXuLy', 'DaXuLy', 'TuChoi'].includes(statusFilter)) {
            whereClause = 'WHERE B.TrangThai = ?';
            params.push(statusFilter);
            countParams.push(statusFilter);
        }
        const countSql = `SELECT COUNT(*) as total FROM BAOCAOVIPHAM B ${whereClause}`;
        const [countResult] = await pool.execute(countSql, countParams);
        const totalRecords = countResult[0].total;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const totalPages = Math.ceil(totalRecords / limit);
        const offset = (page - 1) * limit;
        const validSortColumns = ['NguoiBaoCao', 'TenTL', 'NgayBaoCao', 'TrangThai'];
        let sortBy = req.query.sortBy || 'NgayBaoCao';
        if (!validSortColumns.includes(sortBy)) sortBy = 'NgayBaoCao';
        let sortOrder = (req.query.order && req.query.order.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
        let sortClause = `ORDER BY B.NgayBaoCao DESC`;
        if (sortBy === 'NguoiBaoCao') sortClause = `ORDER BY N.HoTen ${sortOrder}`;
        else if (sortBy === 'TenTL') sortClause = `ORDER BY T.TenTL ${sortOrder}`;
        else if (sortBy === 'NgayBaoCao') sortClause = `ORDER BY B.NgayBaoCao ${sortOrder}`;
        else if (sortBy === 'TrangThai') sortClause = `ORDER BY B.TrangThai ${sortOrder}`;
        params.push(limit.toString(), offset.toString());
        const [rows] = await pool.execute(`
            SELECT B.*, T.TenTL, T.FileURL, T.TrangThaiKiemDuyet, N.HoTen AS NguoiBaoCao, N.AvatarURL AS AvatarNguoiBaoCao
            FROM BAOCAOVIPHAM B
            JOIN TAILIEU T ON B.MaTL = T.MaTL
            JOIN NGUOIDUNG N ON B.MaND = N.MaND
            ${whereClause}
            ${sortClause}
            LIMIT ? OFFSET ?
        `, params);
        res.status(200).json({ 
            data: rows,
            pagination: { currentPage: page, limit, totalPages, totalRecords }
        });
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
            SELECT B.MaTL, B.MaND AS NguoiBaoCao, T.MaND_NguoiDang, T.TenTL, T.LaTaiLieuDocQuyen, T.GiaXu, T.FileURL, T.PreviewURL, T.ThumbnailURL 
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
                if (doc.LaTaiLieuDocQuyen && doc.GiaXu > 0) {
                    const [buyers] = await conn.execute('SELECT MaND FROM TAILIEU_DAMUA WHERE MaTL = ?', [doc.MaTL]);
                    if (buyers.length > 0) {
                        const tongXuHoan = buyers.length * doc.GiaXu;
                        await conn.execute('UPDATE NGUOIDUNG SET SoDuXu = GREATEST(0, SoDuXu - ?) WHERE MaND = ?', [tongXuHoan, doc.MaND_NguoiDang]);
                        await conn.execute(
                            "INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, 'PhatXu', ?, ?)",
                            [doc.MaND_NguoiDang, -tongXuHoan, `Trừ ${tongXuHoan} Xu do tài liệu "${doc.TenTL}" bị xoá vì vi phạm và phải hoàn tiền cho người mua.`]
                        );
                        for (let buyer of buyers) {
                            await conn.execute('UPDATE NGUOIDUNG SET SoDuXu = SoDuXu + ? WHERE MaND = ?', [doc.GiaXu, buyer.MaND]);
                            await conn.execute(
                                "INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, 'HoanXu', ?, ?)",
                                [buyer.MaND, doc.GiaXu, `Hoàn lại ${doc.GiaXu} Xu do tài liệu "${doc.TenTL}" bị xoá vì vi phạm.`]
                            );
                            await conn.execute(
                                "INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, 'HeThong', ?, ?)",
                                [buyer.MaND, `Tài liệu "${doc.TenTL}" mà bạn đã mua vừa bị gỡ do vi phạm. Hệ thống đã hoàn lại ${doc.GiaXu} Xu vào ví của bạn.`, '../user/userProfile.html']
                            );
                        }
                    }
                } else {
                    const [downloads] = await conn.execute('SELECT COUNT(*) as count FROM LICH_SU_TAI WHERE MaTL = ? AND MaND != ?', [doc.MaTL, doc.MaND_NguoiDang]);
                    const downloadCount = downloads[0].count;
                    if (downloadCount > 0) {
                        await conn.execute('UPDATE NGUOIDUNG SET SoDuXu = GREATEST(0, SoDuXu - ?) WHERE MaND = ?', [downloadCount, doc.MaND_NguoiDang]);
                        await conn.execute(
                            "INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, 'PhatXu', ?, ?)",
                            [doc.MaND_NguoiDang, -downloadCount, `Truy thu ${downloadCount} Xu thưởng do tài liệu "${doc.TenTL}" bị xoá vì vi phạm.`]
                        );
                    }
                }
                try {
                    if (doc.FileURL) {
                        const filePath = path.join(__dirname, 'public', doc.FileURL);
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    }
                    if (doc.PreviewURL) {
                        const coverPath = path.join(__dirname, 'public', doc.PreviewURL);
                        if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
                    }
                } catch (e) {
                    console.error('Lỗi khi xóa file vật lý (Báo cáo vi phạm):', e);
                }
                await conn.execute(
                    'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                    [doc.MaND_NguoiDang, 'HeThong', `Tài liệu "${doc.TenTL}" của bạn đã bị từ chối do vi phạm quy định cộng đồng. Nếu có truy thu Xu, vui lòng kiểm tra Lịch sử giao dịch.`, '../document/myDocuments.html']
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
router.put('/reports/bulk-review', adminMiddleware, async (req, res) => {
    const { reportIds, quyetDinh } = req.body;
    if (!Array.isArray(reportIds) || reportIds.length === 0) {
        return res.status(400).json({ message: 'Danh sách báo cáo không hợp lệ.' });
    }
    if (quyetDinh !== 'ViPham' && quyetDinh !== 'TuChoi') {
        return res.status(400).json({ message: 'Quyết định không hợp lệ.' });
    }
    const pool = req.app.locals.pool;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (const maBC of reportIds) {
            const [bcRows] = await conn.execute(`
                SELECT B.MaTL, B.MaND AS NguoiBaoCao, T.MaND_NguoiDang, T.TenTL, T.LaTaiLieuDocQuyen, T.GiaXu, T.FileURL, T.PreviewURL, T.ThumbnailURL
                FROM BAOCAOVIPHAM B 
                JOIN TAILIEU T ON B.MaTL = T.MaTL 
                WHERE B.MaBC = ?
            `, [maBC]);
            if (bcRows.length === 0) continue;
            const doc = bcRows[0];
            if (quyetDinh === 'ViPham') {
                await conn.execute('UPDATE BAOCAOVIPHAM SET TrangThai = ? WHERE MaBC = ?', ['DaXuLy', maBC]);
                await conn.execute('UPDATE TAILIEU SET TrangThaiKiemDuyet = ? WHERE MaTL = ?', ['TuChoi', doc.MaTL]);
                if (doc.LaTaiLieuDocQuyen && doc.GiaXu > 0) {
                    const [buyers] = await conn.execute('SELECT MaND FROM TAILIEU_DAMUA WHERE MaTL = ?', [doc.MaTL]);
                    if (buyers.length > 0) {
                        const tongXuHoan = buyers.length * doc.GiaXu;
                        await conn.execute('UPDATE NGUOIDUNG SET SoDuXu = GREATEST(0, SoDuXu - ?) WHERE MaND = ?', [tongXuHoan, doc.MaND_NguoiDang]);
                        await conn.execute(
                            "INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, 'PhatXu', ?, ?)",
                            [doc.MaND_NguoiDang, -tongXuHoan, `Trừ ${tongXuHoan} Xu do tài liệu "${doc.TenTL}" bị xoá vì vi phạm và phải hoàn tiền cho người mua.`]
                        );
                        for (let buyer of buyers) {
                            await conn.execute('UPDATE NGUOIDUNG SET SoDuXu = SoDuXu + ? WHERE MaND = ?', [doc.GiaXu, buyer.MaND]);
                            await conn.execute(
                                "INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, 'HoanXu', ?, ?)",
                                [buyer.MaND, doc.GiaXu, `Hoàn lại ${doc.GiaXu} Xu do tài liệu "${doc.TenTL}" bị xoá vì vi phạm.`]
                            );
                            await conn.execute(
                                "INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, 'HeThong', ?, ?)",
                                [buyer.MaND, `Tài liệu "${doc.TenTL}" mà bạn đã mua vừa bị gỡ do vi phạm. Hệ thống đã hoàn lại ${doc.GiaXu} Xu vào ví của bạn.`, '../user/userProfile.html']
                            );
                        }
                    }
                } else {
                    const [downloads] = await conn.execute('SELECT COUNT(*) as count FROM LICH_SU_TAI WHERE MaTL = ? AND MaND != ?', [doc.MaTL, doc.MaND_NguoiDang]);
                    const downloadCount = downloads[0].count;
                    if (downloadCount > 0) {
                        await conn.execute('UPDATE NGUOIDUNG SET SoDuXu = GREATEST(0, SoDuXu - ?) WHERE MaND = ?', [downloadCount, doc.MaND_NguoiDang]);
                        await conn.execute(
                            "INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, 'PhatXu', ?, ?)",
                            [doc.MaND_NguoiDang, -downloadCount, `Truy thu ${downloadCount} Xu thưởng do tài liệu "${doc.TenTL}" bị xoá vì vi phạm.`]
                        );
                    }
                }
                try {
                    if (doc.FileURL) {
                        const filePath = path.join(__dirname, 'public', doc.FileURL);
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    }
                    if (doc.PreviewURL) {
                        const coverPath = path.join(__dirname, 'public', doc.PreviewURL);
                        if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
                    }
                } catch (e) {
                    console.error('Lỗi khi xóa file vật lý (Bulk Báo cáo vi phạm):', e);
                }
                await conn.execute(
                    'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                    [doc.MaND_NguoiDang, 'HeThong', `Tài liệu "${doc.TenTL}" của bạn đã bị từ chối do vi phạm quy định cộng đồng. Nếu có truy thu Xu, vui lòng kiểm tra Lịch sử giao dịch.`, '../document/myDocuments.html']
                );
                await conn.execute(
                    'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                    [doc.NguoiBaoCao, 'HeThong', `Báo cáo vi phạm của bạn cho tài liệu "${doc.TenTL}" đã được xử lý (Vi phạm). Cảm ơn bạn đã đóng góp.`, `../document/documentDetails.html?id=${doc.MaTL}`]
                );
            } else {
                await conn.execute('UPDATE BAOCAOVIPHAM SET TrangThai = ? WHERE MaBC = ?', ['TuChoi', maBC]);
                await conn.execute(
                    'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                    [doc.NguoiBaoCao, 'HeThong', `Báo cáo vi phạm của bạn cho tài liệu "${doc.TenTL}" đã bị từ chối do không phát hiện vi phạm.`, `../document/documentDetails.html?id=${doc.MaTL}`]
                );
            }
        }
        await conn.commit();
        res.status(200).json({ message: 'Xử lý báo cáo hàng loạt thành công.' });
    } catch (error) {
        await conn.rollback();
        console.error('Lỗi API /reports/bulk-review:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    } finally {
        conn.release();
    }
});
router.delete('/reports/bulk', adminMiddleware, async (req, res) => {
    const { reportIds } = req.body;
    if (!Array.isArray(reportIds) || reportIds.length === 0) {
        return res.status(400).json({ message: 'Danh sách báo cáo không hợp lệ.' });
    }
    try {
        const pool = req.app.locals.pool;
        const placeholders = reportIds.map(() => '?').join(',');
        const [result] = await pool.execute(`DELETE FROM BAOCAOVIPHAM WHERE MaBC IN (${placeholders})`, reportIds);
        res.status(200).json({ message: `Đã xoá ${result.affectedRows} báo cáo thành công.` });
    } catch (error) {
        console.error('Lỗi API DELETE /admin/reports/bulk:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
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
        const countSql = `SELECT COUNT(*) as total FROM MONHOC WHERE TrangThai IN ('HoatDong', 'TamAn')`;
        const [countResult] = await pool.execute(countSql);
        const totalRecords = countResult[0].total;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const totalPages = Math.ceil(totalRecords / limit);
        const offset = (page - 1) * limit;
        const [rows] = await pool.execute(`
            SELECT MH.*, COUNT(TL.MaTL) AS SoTaiLieu
            FROM MONHOC MH
            LEFT JOIN TAILIEU TL ON MH.MaMonHoc = TL.MaMonHoc AND TL.TrangThaiKiemDuyet = 'DaDuyet'
            WHERE MH.TrangThai IN ('HoatDong', 'TamAn')
            GROUP BY MH.MaMonHoc
            ORDER BY MH.TenMonHoc ASC
            LIMIT ? OFFSET ?
        `, [limit.toString(), offset.toString()]);
        res.status(200).json({ 
            data: rows,
            pagination: { currentPage: page, limit, totalPages, totalRecords }
        });
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
        await pool.execute('UPDATE DEXUAT_MONHOC SET MaMonHocDaTao = NULL WHERE MaMonHocDaTao = ?', [id]);
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
        const [pendingTeacherCount] = await pool.execute('SELECT COUNT(*) as count FROM YEU_CAU_GIAO_VIEN WHERE TrangThai = "ChoDuyet"');
        const [pendingSubjectCount] = await pool.execute('SELECT COUNT(*) as count FROM DEXUAT_MONHOC WHERE TrangThai = "ChoDuyet"');
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
            WHERE G.TrangThai = 'DaDuyet' AND ND.VaiTro != 'Admin'
            GROUP BY ND.MaND, ND.HoTen, ND.AvatarURL
            ORDER BY totalXu DESC
            LIMIT 5
        `);
        const [topContributors] = await pool.execute(`
            SELECT ND.MaND, ND.HoTen, ND.AvatarURL,
                (SELECT COUNT(*) FROM TAILIEU TL WHERE TL.MaND_NguoiDang = ND.MaND AND TL.TrangThaiKiemDuyet = 'DaDuyet') AS countDoc,
                (SELECT COUNT(*) FROM BINHLUAN BL WHERE BL.MaND = ND.MaND) AS countComment
            FROM NGUOIDUNG ND
            WHERE ND.VaiTro != 'Admin'
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
            pendingTeachers: pendingTeacherCount[0].count,
            pendingSubjects: pendingSubjectCount[0].count,
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
router.get('/stats/advanced', adminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const currentYear = new Date().getFullYear();
        const [revenueRows] = await pool.execute(`
            SELECT MONTH(NgayTao) as month, SUM(SoTien) as revenue 
            FROM GIAODICH_NAPXU 
            WHERE TrangThai = 'DaDuyet' AND YEAR(NgayTao) = ?
            GROUP BY MONTH(NgayTao) 
            ORDER BY month ASC
        `, [currentYear]);
        const [userGrowthRows] = await pool.execute(`
            SELECT MONTH(NgayTao) as month, COUNT(*) as newUsers 
            FROM NGUOIDUNG 
            WHERE YEAR(NgayTao) = ?
            GROUP BY MONTH(NgayTao) 
            ORDER BY month ASC
        `, [currentYear]);
        const [trendingSubjects] = await pool.execute(`
            SELECT MH.TenMonHoc, COALESCE(SUM(TL.SoLuotTai), 0) as totalDownloads 
            FROM MONHOC MH 
            JOIN TAILIEU TL ON MH.MaMonHoc = TL.MaMonHoc 
            WHERE TL.TrangThaiKiemDuyet = 'DaDuyet' 
            GROUP BY MH.TenMonHoc 
            ORDER BY totalDownloads DESC 
            LIMIT 5
        `);
        res.status(200).json({
            revenueByMonth: revenueRows,
            userGrowth: userGrowthRows,
            trendingSubjects: trendingSubjects
        });
    } catch (error) {
        console.error('Lỗi API /stats/advanced:', error);
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
                ND.AvatarURL AS AvatarURL,
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
        const countSql = `SELECT COUNT(*) as total FROM NHOM`;
        const [countResult] = await pool.execute(countSql);
        const totalRecords = countResult[0].total;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const totalPages = Math.ceil(totalRecords / limit);
        const offset = (page - 1) * limit;
        const [rows] = await pool.execute(`
            SELECT N.*, ND.HoTen AS TenNguoiQuanTri, ND.AvatarURL AS AvatarQuanTri, MH.TenMonHoc,
                   (SELECT COUNT(*) FROM THANHVIEN_NHOM WHERE MaNhom = N.MaNhom) AS SoLuongThanhVien
            FROM NHOM N
            JOIN NGUOIDUNG ND ON N.MaND_QuanTri = ND.MaND
            LEFT JOIN MONHOC MH ON N.MaMonHoc = MH.MaMonHoc
            ORDER BY N.NgayTao DESC
            LIMIT ? OFFSET ?
        `, [limit.toString(), offset.toString()]);
        res.status(200).json({ 
            data: rows,
            pagination: { currentPage: page, limit, totalPages, totalRecords }
        });
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
router.get('/teacher-requests', adminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [counts] = await pool.execute(`
            SELECT 
                SUM(CASE WHEN TrangThai = 'ChoDuyet' THEN 1 ELSE 0 END) as ChoDuyet,
                SUM(CASE WHEN TrangThai = 'DaDuyet' THEN 1 ELSE 0 END) as DaDuyet,
                SUM(CASE WHEN TrangThai = 'TuChoi' THEN 1 ELSE 0 END) as TuChoi
            FROM YEU_CAU_GIAO_VIEN
        `);
        const countObj = {
            ChoDuyet: counts[0].ChoDuyet || 0,
            DaDuyet: counts[0].DaDuyet || 0,
            TuChoi: counts[0].TuChoi || 0
        };
        const status = req.query.status || 'ChoDuyet';
        const countSql = `SELECT COUNT(*) as total FROM YEU_CAU_GIAO_VIEN WHERE TrangThai = ?`;
        const [countResult] = await pool.execute(countSql, [status]);
        const totalRecords = countResult[0].total;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const totalPages = Math.ceil(totalRecords / limit);
        const offset = (page - 1) * limit;
        const sql = `
            SELECT Y.MaYeuCau, Y.MinhChungURL, Y.TrangThai, Y.NgayTao, Y.LyDoTuChoi,
                   N.MaND, N.HoTen, N.Email, N.AvatarURL
            FROM YEU_CAU_GIAO_VIEN Y
            JOIN NGUOIDUNG N ON Y.MaND = N.MaND
            WHERE Y.TrangThai = ?
            ORDER BY Y.NgayTao DESC
            LIMIT ? OFFSET ?
        `;
        const [rows] = await pool.execute(sql, [status, limit.toString(), offset.toString()]);
        res.status(200).json({ 
            data: rows,
            counts: countObj,
            pagination: { currentPage: page, limit, totalPages, totalRecords }
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách yêu cầu giáo viên:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
router.put('/teacher-requests/:id/review', adminMiddleware, async (req, res) => {
    const maYeuCau = req.params.id;
    const { trangThai, lyDoTuChoi } = req.body;
    if (!['DaDuyet', 'TuChoi'].includes(trangThai)) {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    }
    try {
        const pool = req.app.locals.pool;
        const [reqRows] = await pool.execute('SELECT MaND, TrangThai FROM YEU_CAU_GIAO_VIEN WHERE MaYeuCau = ?', [maYeuCau]);
        if (reqRows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy yêu cầu.' });
        }
        if (reqRows[0].TrangThai !== 'ChoDuyet') {
            return res.status(400).json({ message: 'Yêu cầu này đã được xử lý.' });
        }
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        try {
            await connection.execute(
                'UPDATE YEU_CAU_GIAO_VIEN SET TrangThai = ?, LyDoTuChoi = ? WHERE MaYeuCau = ?',
                [trangThai, lyDoTuChoi || null, maYeuCau]
            );
            if (trangThai === 'DaDuyet') {
                await connection.execute('UPDATE NGUOIDUNG SET VaiTro = "GiaoVien" WHERE MaND = ?', [reqRows[0].MaND]);
                await connection.execute(
                    'INSERT INTO THONGBAO (MaND, NoiDung, LoaiTB) VALUES (?, ?, ?)',
                    [reqRows[0].MaND, 'Yêu cầu nâng cấp tài khoản Giáo viên của bạn đã được phê duyệt.', 'HeThong']
                );
            } else if (trangThai === 'TuChoi') {
                await connection.execute(
                    'INSERT INTO THONGBAO (MaND, NoiDung, LoaiTB) VALUES (?, ?, ?)',
                    [reqRows[0].MaND, `Yêu cầu nâng cấp tài khoản Giáo viên của bạn bị từ chối. Lý do: ${lyDoTuChoi || 'Không hợp lệ.'}`, 'HeThong']
                );
            }
            await connection.commit();
            res.status(200).json({ message: 'Xử lý yêu cầu thành công.' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Lỗi xử lý yêu cầu giáo viên:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
module.exports = router;
router.get('/promos', adminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const countSql = `SELECT COUNT(*) as total FROM PROMO_CODE`;
        const [countResult] = await pool.execute(countSql);
        const totalRecords = countResult[0].total;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const totalPages = Math.ceil(totalRecords / limit);
        const offset = (page - 1) * limit;
        const [rows] = await pool.execute('SELECT * FROM PROMO_CODE ORDER BY NgayTao DESC LIMIT ? OFFSET ?', [limit.toString(), offset.toString()]);
        res.status(200).json({ 
            data: rows,
            pagination: { currentPage: page, limit, totalPages, totalRecords }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi khi lấy danh sách mã ưu đãi' });
    }
});
router.post('/promos', adminMiddleware, async (req, res) => {
    const { Code, DiscountPercent, IsActive, Description, IsFlashSale, NgayHetHan } = req.body;
    try {
        const pool = req.app.locals.pool;
        await pool.execute(
            'INSERT INTO PROMO_CODE (Code, DiscountPercent, IsActive, Description, IsFlashSale, NgayHetHan) VALUES (?, ?, ?, ?, ?, ?)',
            [Code.trim().toUpperCase(), DiscountPercent, IsActive !== undefined ? IsActive : true, Description || null, IsFlashSale ? 1 : 0, NgayHetHan || null]
        );
        res.status(201).json({ message: 'Tạo mã ưu đãi thành công' });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Mã ưu đãi đã tồn tại' });
        }
        res.status(500).json({ message: 'Lỗi khi tạo mã ưu đãi' });
    }
});
router.put('/promos/:id', adminMiddleware, async (req, res) => {
    const { Code, DiscountPercent, Description, IsFlashSale, NgayHetHan } = req.body;
    const { id } = req.params;
    try {
        const pool = req.app.locals.pool;
        await pool.execute(
            'UPDATE PROMO_CODE SET Code = ?, DiscountPercent = ?, Description = ?, IsFlashSale = ?, NgayHetHan = ? WHERE MaPromo = ?',
            [Code.trim().toUpperCase(), DiscountPercent, Description || null, IsFlashSale ? 1 : 0, NgayHetHan || null, id]
        );
        res.status(200).json({ message: 'Cập nhật mã ưu đãi thành công' });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Mã ưu đãi đã tồn tại' });
        }
        res.status(500).json({ message: 'Lỗi khi cập nhật mã ưu đãi' });
    }
});
router.put('/promos/:id/toggle', adminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { id } = req.params;
        await pool.execute('UPDATE PROMO_CODE SET IsActive = NOT IsActive WHERE MaPromo = ?', [id]);
        res.status(200).json({ message: 'C?p nh?t tr?ng th�i th�nh c�ng' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'L?i khi c?p nh?t tr?ng th�i' });
    }
});
router.delete('/promos/:id', adminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { id } = req.params;
        await pool.execute('DELETE FROM PROMO_CODE WHERE MaPromo = ?', [id]);
        res.status(200).json({ message: 'X�a m� uu d�i th�nh c�ng' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'L?i khi x�a m� uu d�i' });
    }
});
router.get('/export/revenue', adminMiddleware, async (req, res) => {
    try {
        const selectedCols = req.query.cols ? req.query.cols.split(',') : null;

        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT G.*, N.HoTen, N.Email 
            FROM GIAODICH_NAPXU G
            JOIN NGUOIDUNG N ON G.MaND = N.MaND
            WHERE G.TrangThai = 'DaDuyet'
            ORDER BY G.NgayDuyet DESC
        `);

        const allColumns = [
            { id: 'MaGD', label: 'Mã GD' },
            { id: 'NguoiDung', label: 'Người Dùng' },
            { id: 'Email', label: 'Email' },
            { id: 'SoTien', label: 'Số Tiền (VNĐ)' },
            { id: 'SoXu', label: 'Số Xu' },
            { id: 'KhuyenMai', label: 'Khuyến Mãi' },
            { id: 'NgayTao', label: 'Ngày Tạo' },
            { id: 'NgayDuyet', label: 'Ngày Duyệt' }
        ];

        const exportColumns = selectedCols ? allColumns.filter(c => selectedCols.includes(c.id)) : allColumns;

        let csvContent = '\uFEFF'; 
        csvContent += exportColumns.map(c => c.label).join(',') + '\n';

        let tongDoanhThu = 0;
        let tongXu = 0;
        
        for (const row of rows) {
            const dateStr = row.NgayTao ? new Date(row.NgayTao).toLocaleString('vi-VN') : '';
            const dateDuyetStr = row.NgayDuyet ? new Date(row.NgayDuyet).toLocaleString('vi-VN') : '';
            tongDoanhThu += parseFloat(row.SoTien || 0);
            tongXu += parseInt(row.SoXu || 0);
            
            const rowDataMap = {
                'MaGD': row.MaGD,
                'NguoiDung': `"${(row.HoTen || '').replace(/"/g, '""')}"`,
                'Email': `"${(row.Email || '').replace(/"/g, '""')}"`,
                'SoTien': row.SoTien || 0,
                'SoXu': row.SoXu || 0,
                'KhuyenMai': `"${(row.MaPromo || '').replace(/"/g, '""')}"`,
                'NgayTao': `"${dateStr}"`,
                'NgayDuyet': `"${dateDuyetStr}"`
            };

            const values = exportColumns.map(c => rowDataMap[c.id]);
            csvContent += values.join(',') + '\n';
        }
        
        const summaryValues = exportColumns.map(c => {
            if (c.id === 'SoTien') return tongDoanhThu;
            if (c.id === 'SoXu') return tongXu;
            if (exportColumns.indexOf(c) === 0) return '\nTổng Cộng';
            return '';
        });
        csvContent += summaryValues.join(',') + '\n';
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="bao-cao-doanh-thu.csv"');
        res.send(csvContent);
    } catch (error) {
        console.error('Lỗi xuất báo cáo doanh thu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
router.get('/packages', adminMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const pool = req.app.locals.pool;
        const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM GOI_NAP_XU');
        const totalRecords = countResult[0].total;
        const totalPages = Math.ceil(totalRecords / limit);
        const [rows] = await pool.execute(`
            SELECT * FROM GOI_NAP_XU 
            ORDER BY ThuTu ASC, SoTien ASC 
            LIMIT ? OFFSET ?
        `, [limit.toString(), offset.toString()]);
        res.status(200).json({ 
            data: rows,
            pagination: { currentPage: page, limit, totalPages, totalRecords }
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách gói nạp:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
router.post('/packages', adminMiddleware, async (req, res) => {
    const { MaGoi, TenGoi, SoTien, SoXu, KhuyenMai, TrangThai, ThuTu } = req.body;
    if (!MaGoi || !TenGoi || !SoTien || !SoXu) {
        return res.status(400).json({ message: 'Vui lòng điền đủ các thông tin bắt buộc.' });
    }
    try {
        const pool = req.app.locals.pool;
        const [check] = await pool.execute('SELECT MaGoi FROM GOI_NAP_XU WHERE MaGoi = ?', [MaGoi]);
        if (check.length > 0) {
            return res.status(400).json({ message: 'Mã gói nạp này đã tồn tại.' });
        }
        await pool.execute(
            'INSERT INTO GOI_NAP_XU (MaGoi, TenGoi, SoTien, SoXu, KhuyenMai, TrangThai, ThuTu) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [MaGoi, TenGoi, SoTien, SoXu, KhuyenMai || 0, TrangThai || 'HoatDong', ThuTu || 0]
        );
        res.status(201).json({ message: 'Thêm gói nạp thành công.' });
    } catch (error) {
        console.error('Lỗi thêm gói nạp:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
router.put('/packages/:id', adminMiddleware, async (req, res) => {
    const maGoi = req.params.id;
    const { TenGoi, SoTien, SoXu, KhuyenMai, TrangThai, ThuTu } = req.body;
    try {
        const pool = req.app.locals.pool;
        await pool.execute(
            'UPDATE GOI_NAP_XU SET TenGoi = ?, SoTien = ?, SoXu = ?, KhuyenMai = ?, TrangThai = ?, ThuTu = ? WHERE MaGoi = ?',
            [TenGoi, SoTien, SoXu, KhuyenMai || 0, TrangThai, ThuTu || 0, maGoi]
        );
        res.status(200).json({ message: 'Cập nhật gói nạp thành công.' });
    } catch (error) {
        console.error('Lỗi cập nhật gói nạp:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
router.put('/packages/:id/toggle', adminMiddleware, async (req, res) => {
    const maGoi = req.params.id;
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute('SELECT TrangThai FROM GOI_NAP_XU WHERE MaGoi = ?', [maGoi]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy gói nạp.' });
        }
        const currentStatus = rows[0].TrangThai;
        const newStatus = currentStatus === 'HoatDong' ? 'TamAn' : 'HoatDong';
        await pool.execute('UPDATE GOI_NAP_XU SET TrangThai = ? WHERE MaGoi = ?', [newStatus, maGoi]);
        res.status(200).json({ message: 'Đã cập nhật trạng thái gói nạp.', newStatus });
    } catch (error) {
        console.error('Lỗi cập nhật trạng thái gói nạp:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
router.delete('/packages/:id', adminMiddleware, async (req, res) => {
    const maGoi = req.params.id;
    try {
        const pool = req.app.locals.pool;
        await pool.execute('UPDATE GOI_NAP_XU SET TrangThai = "TamAn" WHERE MaGoi = ?', [maGoi]);
        res.status(200).json({ message: 'Đã ẩn gói nạp.' });
    } catch (error) {
        console.error('Lỗi xóa gói nạp:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
router.get('/audit-logs', adminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 20;
        let offset = (page - 1) * limit;
        const action = req.query.action || '';
        const date = req.query.date || '';
        const search = req.query.search || '';
        let conditions = [];
        let params = [];
        if (action) {
            conditions.push(`A.HanhDong LIKE ?`);
            params.push(`%${action}%`);
        }
        if (date) {
            conditions.push(`DATE(A.ThoiGian) = ?`);
            params.push(date);
        }
        if (search) {
            conditions.push(`(N.HoTen LIKE ? OR N.Email LIKE ? OR A.ChiTiet LIKE ?)`);
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        let whereClause = '';
        if (conditions.length > 0) {
            whereClause = 'WHERE ' + conditions.join(' AND ');
        }
        const countSql = `
            SELECT COUNT(*) as total 
            FROM AUDIT_LOG A 
            LEFT JOIN NGUOIDUNG N ON A.MaND_ThucHien = N.MaND 
            ${whereClause}
        `;
        const [countResult] = await pool.execute(countSql, params);
        const totalRecords = countResult[0].total;
        const totalPages = Math.ceil(totalRecords / limit);
        const dataSql = `
            SELECT A.*, N.HoTen as AdminName, N.Email as AdminEmail, N.AvatarURL as AdminAvatar
            FROM AUDIT_LOG A 
            LEFT JOIN NGUOIDUNG N ON A.MaND_ThucHien = N.MaND 
            ${whereClause} 
            ORDER BY A.ThoiGian DESC 
            LIMIT ? OFFSET ?
        `;
        const [rows] = await pool.execute(dataSql, [...params, limit.toString(), offset.toString()]);
        res.status(200).json({
            data: rows,
            pagination: { currentPage: page, limit, totalPages, totalRecords }
        });
    } catch (error) {
        console.error('Lỗi khi lấy audit logs:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy dữ liệu audit logs.' });
    }
});
module.exports = router;
