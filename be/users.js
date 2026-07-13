const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Busboy = require('busboy');
const { Readable } = require('stream');

const router = express.Router();
const { authMiddleware } = require('./middlewares/auth');
const cloudinary = require('./config/cloudinary');

async function tableExists(conn, tableName) {
    const [rows] = await conn.execute(
        `SELECT 1
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         LIMIT 1`,
        [tableName]
    );
    return rows.length > 0;
}

async function deleteUserAndRelatedData(conn, maND) {
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
        if (await tableExists(conn, 'LICH_SU_TAI')) {
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

    if (await tableExists(conn, 'LICH_SU_TAI')) {
        await conn.execute('DELETE FROM LICH_SU_TAI WHERE MaND = ?', [maND]);
    }
    if (await tableExists(conn, 'AUDIT_LOG')) {
        await conn.execute('DELETE FROM AUDIT_LOG WHERE MaND_ThucHien = ? OR MaND_BiTacDong = ?', [maND, maND]);
    }

    if (documentIds.length > 0) {
        const placeholders = documentIds.map(() => '?').join(',');
        await conn.execute(`DELETE FROM TAILIEU WHERE MaTL IN (${placeholders})`, documentIds);
    }

    return conn.execute('DELETE FROM NGUOIDUNG WHERE MaND = ?', [maND]);
}

function normalizeGioiTinh(value) {
    if (!value) return 'Khác';

    const normalized = String(value).trim().toLowerCase();
    const genderMap = {
        nam: 'Nam',
        nu: 'Nu',
        'nữ': 'Nu',
        'ná»¯': 'Nu',
        khac: 'Khac',
        'khác': 'Khac',
        'khã¡c': 'Khac',
    };

    return genderMap[normalized] || null;
}


router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute('SELECT MaND, HoTen, Email, VaiTro, AvatarURL, Tuoi, GioiTinh, DiaChi FROM NGUOIDUNG WHERE MaND = ?', [req.user.MaND]);

        if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });

        res.status(200).json({ profile: rows[0] });
    } catch (error) {
        console.error('Lỗi lấy profile:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.put('/profile', authMiddleware, async (req, res) => {
    const { hoTen, matKhauCu, matKhauMoi, tuoi, gioiTinh, diaChi } = req.body;
    const normalizedHoTen = typeof hoTen === 'string' ? hoTen.trim() : '';
    const normalizedTuoi = tuoi === undefined || tuoi === '' ? null : Number(tuoi);
    const normalizedGioiTinh = normalizeGioiTinh(gioiTinh);
    const normalizedDiaChi = typeof diaChi === 'string' && diaChi.trim() !== '' ? diaChi.trim() : null;

    if (!normalizedHoTen) {
        return res.status(400).json({ message: 'Họ tên không được để trống.' });
    }

    if (normalizedTuoi !== null && (!Number.isInteger(normalizedTuoi) || normalizedTuoi < 1 || normalizedTuoi > 150)) {
        return res.status(400).json({ message: 'Tuổi không hợp lệ.' });
    }

    if (!normalizedGioiTinh) {
        return res.status(400).json({ message: 'Giới tính không hợp lệ.' });
    }

    try {
        const pool = req.app.locals.pool;
        const maND = req.user.MaND;

        if (matKhauCu && matKhauMoi) {
            const [rows] = await pool.execute('SELECT MatKhau FROM NGUOIDUNG WHERE MaND = ?', [maND]);
            if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });

            const isMatch = await bcrypt.compare(matKhauCu, rows[0].MatKhau);
            if (!isMatch) {
                return res.status(400).json({ message: 'Mật khẩu cũ không chính xác.' });
            }

            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(matKhauMoi, saltRounds);
            await pool.execute('UPDATE NGUOIDUNG SET HoTen = ?, MatKhau = ?, Tuoi = ?, GioiTinh = ?, DiaChi = ? WHERE MaND = ?', [normalizedHoTen, hashedPassword, normalizedTuoi, normalizedGioiTinh, normalizedDiaChi, maND]);
        } else {
            await pool.execute(
                'UPDATE NGUOIDUNG SET HoTen = ?, Tuoi = ?, GioiTinh = ?, DiaChi = ? WHERE MaND = ?',
                [normalizedHoTen, normalizedTuoi, normalizedGioiTinh, normalizedDiaChi, maND]
            );
        }

        const newToken = jwt.sign(
            { MaND: maND, VaiTro: req.user.VaiTro, HoTen: normalizedHoTen },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(200).json({ message: 'Cập nhật hồ sơ thành công.', token: newToken });
    } catch (error) {
        console.error('Lỗi cập nhật profile:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.delete('/profile', authMiddleware, async (req, res) => {
    const { matKhau } = req.body || {};

    if (!matKhau) {
        return res.status(400).json({ message: 'Vui lòng nhập mật khẩu để xác nhận xoá tài khoản.' });
    }

    const pool = req.app.locals.pool;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [userRows] = await conn.execute('SELECT MaND, HoTen, MatKhau, VaiTro, TrangThai FROM NGUOIDUNG WHERE MaND = ?', [req.user.MaND]);
        if (userRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }

        const user = userRows[0];
        const isMatch = await bcrypt.compare(matKhau, user.MatKhau);
        if (!isMatch) {
            await conn.rollback();
            return res.status(400).json({ message: 'Mật khẩu xác nhận không chính xác.' });
        }

        if (user.VaiTro === 'Admin' && user.TrangThai === 'HoatDong') {
            const [adminCount] = await conn.execute("SELECT COUNT(*) AS total FROM NGUOIDUNG WHERE VaiTro = 'Admin' AND TrangThai = 'HoatDong'");
            if (adminCount[0].total <= 1) {
                await conn.rollback();
                return res.status(403).json({ message: 'Không thể xoá Admin cuối cùng của hệ thống.' });
            }
        }

        const [result] = await deleteUserAndRelatedData(conn, req.user.MaND);
        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Không tìm thấy người dùng để xoá.' });
        }

        await conn.commit();
        res.status(200).json({ message: `Đã xoá vĩnh viễn tài khoản "${user.HoTen}".` });
    } catch (error) {
        await conn.rollback();
        console.error('Lỗi xoá tài khoản người dùng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi xoá tài khoản.' });
    } finally {
        conn.release();
    }
});


const AVATAR_MAX_SIZE = 5 * 1024 * 1024;
const AVATAR_ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

function uploadAvatarToCloudinary(buffer, maND) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'edushare/avatars',
                public_id: `user-${maND}-${Date.now()}`,
                overwrite: true,
                resource_type: 'image',
                transformation: [
                    { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                    { quality: 'auto', fetch_format: 'auto' },
                ],
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        Readable.from(buffer).pipe(uploadStream);
    });
}

function parseAvatarRequest(req) {
    return new Promise((resolve, reject) => {
        let avatarFile = null;
        let totalSize = 0;
        let hasAvatarField = false;
        let settled = false;

        const fail = (error) => {
            if (settled) return;
            settled = true;
            reject(error);
        };

        const busboy = Busboy({
            headers: req.headers,
            limits: {
                files: 1,
                fileSize: AVATAR_MAX_SIZE,
            },
        });

        busboy.on('file', (fieldname, file, info) => {
            if (fieldname !== 'avatar') {
                file.resume();
                return;
            }

            hasAvatarField = true;
            const { filename, mimeType } = info;
            const chunks = [];

            if (!AVATAR_ALLOWED_MIME_TYPES.includes(mimeType)) {
                file.resume();
                fail(new Error('Chỉ cho phép định dạng ảnh hợp lệ.'));
                return;
            }

            file.on('data', chunk => {
                totalSize += chunk.length;
                chunks.push(chunk);
            });

            file.on('limit', () => {
                fail(new Error('Ảnh đại diện không được vượt quá 5MB.'));
            });

            file.on('end', () => {
                if (settled) return;
                avatarFile = {
                    filename,
                    mimeType,
                    buffer: Buffer.concat(chunks, totalSize),
                };
            });
        });

        busboy.on('error', fail);
        busboy.on('finish', () => {
            if (settled) return;

            if (!hasAvatarField || !avatarFile) {
                fail(new Error('Vui lòng chọn ảnh đại diện.'));
                return;
            }

            settled = true;
            resolve(avatarFile);
        });

        req.pipe(busboy);
    });
}

router.post('/profile/avatar', authMiddleware, async (req, res) => {
    const hasCloudinaryConfig = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
    if (!hasCloudinaryConfig) {
        return res.status(500).json({ message: 'Chưa cấu hình Cloudinary trên máy chủ.' });
    }

    try {
        const avatarFile = await parseAvatarRequest(req);
        const uploadResult = await uploadAvatarToCloudinary(avatarFile.buffer, req.user.MaND);
        const avatarURL = uploadResult.secure_url;

        const pool = req.app.locals.pool;
        await pool.execute('UPDATE NGUOIDUNG SET AvatarURL = ? WHERE MaND = ?', [avatarURL, req.user.MaND]);
        res.status(200).json({ message: 'Cập nhật ảnh đại diện thành công.', avatarURL });
    } catch (err) {
        console.error('Lỗi upload avatar Cloudinary:', err);
        res.status(400).json({ message: err.message || 'Lỗi máy chủ.' });
    }
});

router.delete('/profile/avatar', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        await pool.execute('UPDATE NGUOIDUNG SET AvatarURL = NULL WHERE MaND = ?', [req.user.MaND]);
        res.status(200).json({ message: 'Đã xoá ảnh đại diện.', avatarURL: null });
    } catch (err) {
        console.error('Lỗi xoá avatar:', err);
        res.status(500).json({ message: 'Lỗi máy chủ khi xoá ảnh đại diện.' });
    }
});

router.get('/my-documents', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT
                TL.MaTL,
                TL.TenTL,
                TL.MoTa,
                TL.LoaiFile,
                TL.MaMonHoc,
                TL.TrangThaiKiemDuyet,
                TL.SoLuotTai,
                TL.NgayDang,
                TL.LaTaiLieuChinhThuc,
                TL.LyDoTuChoi,
                MH.TenMonHoc
            FROM TAILIEU TL
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            WHERE TL.MaND_NguoiDang = ?
            ORDER BY TL.NgayDang DESC
        `, [req.user.MaND]);

        res.status(200).json({ documents: rows });
    } catch (error) {
        console.error('Lỗi my-documents:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.get('/bookmarks', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT TL.*, MH.TenMonHoc, B.NgayLuu, ND.HoTen AS TenNguoiDang
            FROM BOOKMARK B
            JOIN TAILIEU TL ON B.MaTL = TL.MaTL
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            LEFT JOIN NGUOIDUNG ND ON TL.MaND_NguoiDang = ND.MaND
            WHERE B.MaND = ?
            ORDER BY B.NgayLuu DESC
        `, [req.user.MaND]);

        res.status(200).json({ documents: rows });
    } catch (error) {
        console.error('Lỗi bookmarks:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.get('/:maND/documents', authMiddleware, async (req, res) => {
    const maND_Khac = req.params.maND;
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT TL.*, MH.TenMonHoc,
                   (SELECT ROUND(AVG(SoSao), 1) FROM DANHGIA WHERE MaTL = TL.MaTL) AS DiemDanhGia
            FROM TAILIEU TL
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            WHERE TL.MaND_NguoiDang = ? AND TL.TrangThaiKiemDuyet = 'DaDuyet'
            ORDER BY TL.NgayDang DESC
        `, [maND_Khac]);

        res.status(200).json({ documents: rows });
    } catch (error) {
        console.error('Lỗi lấy documents của user:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.get('/:maND/profile', authMiddleware, async (req, res) => {
    const maND_Khac = req.params.maND;
    const maND_HienTai = req.user.MaND;

    try {
        const pool = req.app.locals.pool;


        const [userRows] = await pool.execute('SELECT MaND, HoTen, Email, VaiTro, AvatarURL FROM NGUOIDUNG WHERE MaND = ?', [maND_Khac]);
        if (userRows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });


        const [followRows] = await pool.execute(
            'SELECT * FROM THEODOI WHERE MaND_TheoDoi = ? AND MaND_DuocTheoDoi = ?',
            [maND_HienTai, maND_Khac]
        );

        res.status(200).json({
            profile: userRows[0],
            isFollowing: followRows.length > 0
        });
    } catch (error) {
        console.error('Lỗi lấy profile khác:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.post('/:maND/follow', authMiddleware, async (req, res) => {
    const maND_DuocTheoDoi = req.params.maND;
    const maND_TheoDoi = req.user.MaND;

    if (maND_DuocTheoDoi == maND_TheoDoi) {
        return res.status(400).json({ message: 'Không thể tự theo dõi chính mình.' });
    }

    try {
        const pool = req.app.locals.pool;


        const [targetUser] = await pool.execute('SELECT MaND FROM NGUOIDUNG WHERE MaND = ?', [maND_DuocTheoDoi]);
        if (targetUser.length === 0) {
            return res.status(404).json({ message: 'Người dùng không tồn tại.' });
        }


        const [followRows] = await pool.execute(
            'SELECT * FROM THEODOI WHERE MaND_TheoDoi = ? AND MaND_DuocTheoDoi = ?',
            [maND_TheoDoi, maND_DuocTheoDoi]
        );

        if (followRows.length > 0) {

            await pool.execute(
                'DELETE FROM THEODOI WHERE MaND_TheoDoi = ? AND MaND_DuocTheoDoi = ?',
                [maND_TheoDoi, maND_DuocTheoDoi]
            );
            return res.status(200).json({ message: 'Đã hủy theo dõi.', isFollowing: false });
        } else {

            await pool.execute(
                'INSERT INTO THEODOI (MaND_TheoDoi, MaND_DuocTheoDoi) VALUES (?, ?)',
                [maND_TheoDoi, maND_DuocTheoDoi]
            );


            const [myInfo] = await pool.execute('SELECT HoTen FROM NGUOIDUNG WHERE MaND = ?', [maND_TheoDoi]);
            const tenNguoiTheoDoi = myInfo[0].HoTen;
            await pool.execute(
                'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                [maND_DuocTheoDoi, 'HeThong', `${tenNguoiTheoDoi} đã bắt đầu theo dõi bạn.`, `../user/otherUserProfile.html?id=${maND_TheoDoi}`]
            );

            return res.status(200).json({ message: 'Theo dõi thành công.', isFollowing: true });
        }
    } catch (error) {
        console.error('Lỗi toggle follow:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/download-history', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT TL.MaTL, TL.TenTL, TL.MoTa, TL.LoaiFile, TL.MaMonHoc, 
                   TL.SoLuotTai, TL.NgayDang, TL.LaTaiLieuChinhThuc,
                   MH.TenMonHoc, LST.NgayTai AS NgayTai
            FROM LICH_SU_TAI LST
            JOIN TAILIEU TL ON LST.MaTL = TL.MaTL
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            WHERE LST.MaND = ?
            ORDER BY LST.NgayTai DESC
        `, [req.user.MaND]);

        res.status(200).json({ documents: rows });
    } catch (error) {
        console.error('Lỗi download-history:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/followers', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT ND.MaND, ND.HoTen, ND.AvatarURL, ND.VaiTro, TD.NgayTheoDoi 
            FROM THEODOI TD 
            JOIN NGUOIDUNG ND ON TD.MaND_TheoDoi = ND.MaND 
            WHERE TD.MaND_DuocTheoDoi = ? 
            ORDER BY TD.NgayTheoDoi DESC
        `, [req.user.MaND]);
        res.status(200).json({ followers: rows });
    } catch (error) {
        console.error('Lỗi lấy followers:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/following', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT ND.MaND, ND.HoTen, ND.AvatarURL, ND.VaiTro, TD.NgayTheoDoi 
            FROM THEODOI TD 
            JOIN NGUOIDUNG ND ON TD.MaND_DuocTheoDoi = ND.MaND 
            WHERE TD.MaND_TheoDoi = ? 
            ORDER BY TD.NgayTheoDoi DESC
        `, [req.user.MaND]);
        res.status(200).json({ following: rows });
    } catch (error) {
        console.error('Lỗi lấy following:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/my-reports', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT BC.*, TL.TenTL, TL.FileURL 
            FROM BAOCAOVIPHAM BC 
            JOIN TAILIEU TL ON BC.MaTL = TL.MaTL 
            WHERE BC.MaND = ? 
            ORDER BY BC.NgayBaoCao DESC
        `, [req.user.MaND]);
        res.status(200).json({ reports: rows });
    } catch (error) {
        console.error('Lỗi lấy báo cáo:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

module.exports = router;
