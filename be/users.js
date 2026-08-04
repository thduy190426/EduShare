const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Busboy = require('busboy');
const { Readable } = require('stream');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const streamifier = require('streamifier');
const router = express.Router();
const { authMiddleware } = require('./middlewares/auth');
const cloudinary = require('./config/cloudinary');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

const generateOTPChangePwEmail = (hoTen, otp) => {
    return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4F46E5; margin: 0; font-size: 28px;">EduShare</h1>
            <p style="color: #6B7280; margin-top: 5px; font-size: 16px;">Nền tảng chia sẻ tài liệu học tập</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb;">
            <h2 style="color: #1f2937; margin-top: 0;">Xin chào ${hoTen},</h2>
            <p style="font-size: 16px;">Chúng tôi nhận được yêu cầu đổi mật khẩu cho tài khoản EduShare của bạn. Dưới đây là mã xác thực OTP để hoàn tất quá trình đổi mật khẩu:</p>
            <div style="background: #EEF2FF; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; border: 1px dashed #4F46E5;">
                <div style="font-size: 32px; font-weight: 700; color: #4F46E5; letter-spacing: 4px;">${otp}</div>
            </div>
            <p style="font-size: 14px; color: #6b7280; font-style: italic;">Mã này sẽ hết hạn sau 15 phút.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 14px; color: #6b7280; margin: 0;">Nếu bạn không yêu cầu đổi mật khẩu, vui lòng bỏ qua email này.</p>
        </div>
    </div>`;
};

const generateOTPDeleteAccountEmail = (hoTen, otp) => {
    return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #EF4444; margin: 0; font-size: 28px;">EduShare</h1>
            <p style="color: #6B7280; margin-top: 5px; font-size: 16px;">Yêu cầu xóa tài khoản</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); border: 1px solid #EF4444;">
            <h2 style="color: #1f2937; margin-top: 0;">Xin chào ${hoTen},</h2>
            <p style="font-size: 16px;">Chúng tôi nhận được yêu cầu <strong>xóa tài khoản vĩnh viễn</strong> trên EduShare của bạn. Đây là một hành động không thể hoàn tác.</p>
            <p style="font-size: 16px;">Dưới đây là mã xác thực OTP để hoàn tất quá trình xóa tài khoản:</p>
            <div style="background: #FEF2F2; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; border: 1px dashed #EF4444;">
                <div style="font-size: 32px; font-weight: 700; color: #EF4444; letter-spacing: 4px;">${otp}</div>
            </div>
            <p style="font-size: 14px; color: #6b7280; font-style: italic;">Mã này sẽ hết hạn sau 15 phút.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 14px; color: #6b7280; margin: 0;">Nếu bạn không yêu cầu xóa tài khoản, <strong>vui lòng đổi mật khẩu ngay lập tức</strong> để bảo vệ tài khoản.</p>
        </div>
    </div>`;
};

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

    await conn.execute('DELETE FROM TAILIEU_DAMUA WHERE MaND = ?', [maND]);
    await conn.execute('UPDATE GIAODICH_NAPXU SET MaND_Duyet = NULL WHERE MaND_Duyet = ?', [maND]);
    await conn.execute('DELETE FROM GIAODICH_NAPXU WHERE MaND = ?', [maND]);
    await conn.execute('DELETE FROM LICH_SU_XU WHERE MaND = ?', [maND]);
    await conn.execute('DELETE FROM YEU_CAU_GIAO_VIEN WHERE MaND = ?', [maND]);


    if (await tableExists(conn, 'LICH_SU_TAI')) {
        await conn.execute('DELETE FROM LICH_SU_TAI WHERE MaND = ?', [maND]);
    }
    if (await tableExists(conn, 'AUDIT_LOG')) {
        await conn.execute('DELETE FROM AUDIT_LOG WHERE MaND_ThucHien = ? OR MaND_BiTacDong = ?', [maND, maND]);
    }

    if (documentIds.length > 0) {
        const placeholders = documentIds.map(() => '?').join(',');
        await conn.execute(`UPDATE TAILIEU SET IsDeleted = TRUE WHERE MaTL IN (${placeholders})`, documentIds);
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

router.get('/search', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const searchQuery = req.query.q || '';
        if (!searchQuery.trim()) {
            return res.json([]);
        }

        const [users] = await pool.execute(
            'SELECT MaND, HoTen, AvatarURL FROM NGUOIDUNG WHERE HoTen LIKE ? AND TrangThai = "HoatDong" LIMIT 10',
            [`%${searchQuery}%`]
        );
        res.json(users);
    } catch (error) {
        console.error('Lỗi API search user:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/top-contributors', async (req, res) => {
    try {
        const pool = req.app.locals.pool;

        const sql = `
            SELECT 
                ND.MaND, 
                ND.HoTen, 
                ND.AvatarURL, 
                COUNT(TL.MaTL) AS TotalDocuments,
                IFNULL(SUM(TL.SoLuotTai), 0) AS TotalDownloads,
                (SELECT COUNT(*) FROM BINHLUAN BL WHERE BL.MaND = ND.MaND AND MONTH(BL.NgayBinhLuan) = MONTH(CURRENT_DATE()) AND YEAR(BL.NgayBinhLuan) = YEAR(CURRENT_DATE())) AS TotalComments
            FROM NGUOIDUNG ND
            JOIN TAILIEU TL ON ND.MaND = TL.MaND_NguoiDang
            WHERE TL.TrangThaiKiemDuyet = 'DaDuyet' 
              AND MONTH(TL.NgayDang) = MONTH(CURRENT_DATE()) 
              AND YEAR(TL.NgayDang) = YEAR(CURRENT_DATE())
            GROUP BY ND.MaND
            ORDER BY TotalDocuments DESC, TotalDownloads DESC
            LIMIT 4
        `;

        const [rows] = await pool.execute(sql);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Lỗi khi lấy top contributors:', error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
});

router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute('SELECT MaND, HoTen, Email, VaiTro, AvatarURL, Tuoi, GioiTinh, DiaChi, TruongHoc, KhoaNganh, SoDuXu, HienThiLichSuTai, HienThiDanhGia, AuthType, IsTwoFactorEnabled FROM NGUOIDUNG WHERE MaND = ?', [req.user.MaND]);

        if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });

        res.status(200).json({ profile: rows[0] });
    } catch (error) {
        console.error('Lỗi lấy profile:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.post('/send-change-password-otp', authMiddleware, async (req, res) => {
    try {
        const { matKhauCu } = req.body;
        const pool = req.app.locals.pool;
        const maND = req.user.MaND;
        const [rows] = await pool.execute('SELECT Email, HoTen, MatKhau, AuthType FROM NGUOIDUNG WHERE MaND = ?', [maND]);
        if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });

        if (rows[0].AuthType === 'Local') {
            if (!matKhauCu) {
                return res.status(400).json({ message: 'Vui lòng cung cấp mật khẩu hiện tại.' });
            }
            const isMatch = await bcrypt.compare(matKhauCu, rows[0].MatKhau);
            if (!isMatch) {
                return res.status(400).json({ message: 'Mật khẩu hiện tại không chính xác.' });
            }
        }

        const email = rows[0].Email;
        const hoTen = rows[0].HoTen;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await pool.execute(
            'INSERT INTO RESET_PASSWORD_OTP (Email, OTP, ExpiresAt) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE OTP = ?, ExpiresAt = ?',
            [email, otp, expiresAt, otp, expiresAt]
        );

        await transporter.sendMail({
            from: `"EduShare" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Mã OTP Đổi Mật Khẩu',
            html: generateOTPChangePwEmail(hoTen, otp)
        });

        res.status(200).json({ message: 'Mã OTP đã được gửi đến email của bạn.' });
    } catch (err) {
        console.error('Lỗi gửi OTP đổi mật khẩu:', err);
        res.status(500).json({ message: 'Lỗi máy chủ khi gửi OTP.' });
    }
});


router.put('/profile', authMiddleware, async (req, res) => {
    const { hoTen, matKhauCu, matKhauMoi, tuoi, gioiTinh, diaChi, truongHoc, khoaNganh, otp, hienThiLichSuTai, hienThiDanhGia } = req.body;
    const normalizedTruongHoc = typeof truongHoc === 'string' && truongHoc.trim() !== '' ? truongHoc.trim() : null;
    const normalizedKhoaNganh = typeof khoaNganh === 'string' && khoaNganh.trim() !== '' ? khoaNganh.trim() : null;
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

        if (matKhauMoi) {
            const [rows] = await pool.execute('SELECT Email, MatKhau, AuthType FROM NGUOIDUNG WHERE MaND = ?', [maND]);
            if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });

            const email = rows[0].Email;
            const userAuthType = rows[0].AuthType;

            if (userAuthType === 'Local') {
                if (!matKhauCu) {
                    return res.status(400).json({ message: 'Vui lòng cung cấp mật khẩu cũ.' });
                }
                const isMatch = await bcrypt.compare(matKhauCu, rows[0].MatKhau);
                if (!isMatch) {
                    return res.status(400).json({ message: 'Mật khẩu cũ không chính xác.' });
                }
            }

            if (!otp) {
                return res.status(400).json({ message: 'Vui lòng cung cấp mã OTP để đổi mật khẩu.' });
            }

            const [otpRows] = await pool.execute('SELECT * FROM RESET_PASSWORD_OTP WHERE Email = ? AND OTP = ?', [email, otp]);
            if (otpRows.length === 0) {
                return res.status(400).json({ message: 'Mã OTP không chính xác.' });
            }
            if (new Date() > new Date(otpRows[0].ExpiresAt)) {
                return res.status(400).json({ message: 'Mã OTP đã hết hạn.' });
            }

            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(matKhauMoi, saltRounds);
            await pool.execute('UPDATE NGUOIDUNG SET HoTen = ?, MatKhau = ?, Tuoi = ?, GioiTinh = ?, DiaChi = ?, TruongHoc = ?, KhoaNganh = ?, HienThiLichSuTai = ?, HienThiDanhGia = ? WHERE MaND = ?',
                [normalizedHoTen, hashedPassword, normalizedTuoi, normalizedGioiTinh, normalizedDiaChi, normalizedTruongHoc, normalizedKhoaNganh, hienThiLichSuTai, hienThiDanhGia, maND]);
            await pool.execute('DELETE FROM RESET_PASSWORD_OTP WHERE Email = ?', [email]);
        } else {
            await pool.execute(
                'UPDATE NGUOIDUNG SET HoTen = ?, Tuoi = ?, GioiTinh = ?, DiaChi = ?, TruongHoc = ?, KhoaNganh = ?, HienThiLichSuTai = ?, HienThiDanhGia = ? WHERE MaND = ?',
                [normalizedHoTen, normalizedTuoi, normalizedGioiTinh, normalizedDiaChi, normalizedTruongHoc, normalizedKhoaNganh, hienThiLichSuTai, hienThiDanhGia, maND]
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

router.post('/profile/delete-otp', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute('SELECT Email, HoTen FROM NGUOIDUNG WHERE MaND = ?', [req.user.MaND]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }

        const email = rows[0].Email;
        const hoTen = rows[0].HoTen;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await pool.execute(
            'INSERT INTO DELETE_ACCOUNT_OTP (Email, OTP, ExpiresAt) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE OTP = ?, ExpiresAt = ?',
            [email, otp, expiresAt, otp, expiresAt]
        );

        await transporter.sendMail({
            from: `"EduShare" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Mã OTP Xóa Tài Khoản',
            html: generateOTPDeleteAccountEmail(hoTen, otp)
        });

        res.status(200).json({ message: 'Mã OTP đã được gửi đến email của bạn.' });
    } catch (err) {
        console.error('Lỗi gửi OTP xóa tài khoản:', err);
        res.status(500).json({ message: 'Lỗi máy chủ khi gửi OTP.' });
    }
});

router.delete('/profile', authMiddleware, async (req, res) => {
    const { matKhau, otp } = req.body || {};

    if (!otp) {
        return res.status(400).json({ message: 'Vui lòng nhập mã OTP để xác nhận xoá tài khoản.' });
    }

    const pool = req.app.locals.pool;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [userRows] = await conn.execute('SELECT MaND, HoTen, Email, MatKhau, VaiTro, TrangThai, AuthType FROM NGUOIDUNG WHERE MaND = ?', [req.user.MaND]);
        if (userRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }

        const user = userRows[0];

        if (user.AuthType === 'Local') {
            if (!matKhau) {
                await conn.rollback();
                return res.status(400).json({ message: 'Vui lòng nhập mật khẩu để xác nhận xoá tài khoản.' });
            }
            const isMatch = await bcrypt.compare(matKhau, user.MatKhau);
            if (!isMatch) {
                await conn.rollback();
                return res.status(400).json({ message: 'Mật khẩu xác nhận không chính xác.' });
            }
        }

        const [otpRows] = await conn.execute('SELECT * FROM DELETE_ACCOUNT_OTP WHERE Email = ? AND OTP = ?', [user.Email, otp]);
        if (otpRows.length === 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'Mã OTP không chính xác.' });
        }
        if (new Date() > new Date(otpRows[0].ExpiresAt)) {
            await conn.rollback();
            return res.status(400).json({ message: 'Mã OTP đã hết hạn.' });
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
        await pool.execute('DELETE FROM DELETE_ACCOUNT_OTP WHERE Email = ?', [user.Email]);
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

const avatarUpdateLimits = new Map();
const MAX_AVATAR_CHANGES = 5;
const AVATAR_LIMIT_RESET_TIME = 60 * 60 * 1000;

function checkAvatarRateLimit(maND) {
    const now = Date.now();
    if (!avatarUpdateLimits.has(maND)) {
        avatarUpdateLimits.set(maND, { count: 1, resetAt: now + AVATAR_LIMIT_RESET_TIME });
        return true;
    }

    const limitData = avatarUpdateLimits.get(maND);
    if (now > limitData.resetAt) {
        avatarUpdateLimits.set(maND, { count: 1, resetAt: now + AVATAR_LIMIT_RESET_TIME });
        return true;
    }

    if (limitData.count >= MAX_AVATAR_CHANGES) {
        return false;
    }

    limitData.count++;
    return true;
}

router.post('/profile/avatar', authMiddleware, async (req, res) => {
    if (!checkAvatarRateLimit(req.user.MaND)) {
        return res.status(429).json({ message: 'Bạn đã thay đổi ảnh đại diện quá nhiều lần. Vui lòng thử lại sau 1 giờ.' });
    }
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
    if (!checkAvatarRateLimit(req.user.MaND)) {
        return res.status(429).json({ message: 'Bạn đã xoá ảnh đại diện quá nhiều lần. Vui lòng thử lại sau 1 giờ.' });
    }
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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const offset = (page - 1) * limit;

        const [countResult] = await pool.execute('SELECT COUNT(*) AS total FROM TAILIEU WHERE MaND_NguoiDang = ?', [req.user.MaND]);
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        const [rows] = await pool.execute(`
            SELECT
                TL.MaTL,
                TL.TenTL,
                TL.MoTa,
                TL.FileURL,
                TL.LoaiFile,
                TL.MaMonHoc,
                TL.TrangThaiKiemDuyet,
                TL.SoLuotTai,
                TL.NgayDang,
                TL.LaTaiLieuChinhThuc,
                TL.LaTaiLieuDocQuyen,
                TL.GiaXu,
                TL.LyDoTuChoi,
                MH.TenMonHoc,
                COALESCE((SELECT ROUND(AVG(SoSao), 1) FROM DANHGIA WHERE MaTL = TL.MaTL), 0) AS DiemDanhGia,
                (SELECT COUNT(*) FROM DANHGIA WHERE MaTL = TL.MaTL) AS SoDanhGia
            FROM TAILIEU TL
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            WHERE TL.MaND_NguoiDang = ?
            ORDER BY TL.NgayDang DESC
            LIMIT ? OFFSET ?
        `, [req.user.MaND, limit.toString(), offset.toString()]);

        res.status(200).json({ documents: rows, total, totalPages, currentPage: page });
    } catch (error) {
        console.error('Lỗi my-documents:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.get('/bookmarks', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const offset = (page - 1) * limit;

        const [countResult] = await pool.execute(`
            SELECT COUNT(*) AS total FROM BOOKMARK B
            JOIN TAILIEU TL ON B.MaTL = TL.MaTL
            WHERE B.MaND = ? AND TL.TrangThaiHienThi = 'Hien'
        `, [req.user.MaND]);
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        const [rows] = await pool.execute(`
            SELECT TL.*, MH.TenMonHoc, B.NgayLuu, ND.HoTen AS TenNguoiDang,
                   COALESCE((SELECT ROUND(AVG(SoSao), 1) FROM DANHGIA WHERE MaTL = TL.MaTL), 0) AS DiemDanhGia,
                   (SELECT COUNT(*) FROM DANHGIA WHERE MaTL = TL.MaTL) AS SoDanhGia
            FROM BOOKMARK B
            JOIN TAILIEU TL ON B.MaTL = TL.MaTL
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            LEFT JOIN NGUOIDUNG ND ON TL.MaND_NguoiDang = ND.MaND
            WHERE B.MaND = ? AND TL.TrangThaiHienThi = 'Hien'
            ORDER BY B.NgayLuu DESC
            LIMIT ? OFFSET ?
        `, [req.user.MaND, limit.toString(), offset.toString()]);

        res.status(200).json({ documents: rows, total, totalPages, currentPage: page });
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
                   COALESCE((SELECT ROUND(AVG(SoSao), 1) FROM DANHGIA WHERE MaTL = TL.MaTL), 0) AS DiemDanhGia,
                   (SELECT COUNT(*) FROM DANHGIA WHERE MaTL = TL.MaTL) AS SoDanhGia
            FROM TAILIEU TL
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            WHERE TL.MaND_NguoiDang = ? AND TL.TrangThaiKiemDuyet = 'DaDuyet' AND TL.TrangThaiHienThi = 'Hien'
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


        const [userRows] = await pool.execute('SELECT MaND, HoTen, Email, VaiTro, AvatarURL, TruongHoc, KhoaNganh, HienThiLichSuTai, HienThiDanhGia FROM NGUOIDUNG WHERE MaND = ?', [maND_Khac]);
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

            await pool.execute(
                'DELETE FROM THONGBAO WHERE MaND = ? AND LinkDich = ? AND NoiDung LIKE ?',
                [maND_DuocTheoDoi, `../user/otherUserProfile.html?id=${maND_TheoDoi}`, '%đã bắt đầu theo dõi bạn%']
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
                'DELETE FROM THONGBAO WHERE MaND = ? AND LinkDich = ? AND NoiDung LIKE ?',
                [maND_DuocTheoDoi, `../user/otherUserProfile.html?id=${maND_TheoDoi}`, '%đã bắt đầu theo dõi bạn%']
            );

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
            SELECT TL.MaTL, TL.TenTL, TL.MoTa, TL.LoaiFile, TL.MaMonHoc, TL.TrangThaiKiemDuyet,
                   TL.SoLuotTai, TL.NgayDang, TL.LaTaiLieuChinhThuc,
                   MH.TenMonHoc, LST.NgayTai AS NgayTai,
                   COALESCE((SELECT ROUND(AVG(SoSao), 1) FROM DANHGIA WHERE MaTL = TL.MaTL), 0) AS DiemDanhGia,
                   (SELECT COUNT(*) FROM DANHGIA WHERE MaTL = TL.MaTL) AS SoDanhGia
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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const offset = (page - 1) * limit;

        const [countResult] = await pool.execute('SELECT COUNT(*) AS total FROM BAOCAOVIPHAM WHERE MaND = ?', [req.user.MaND]);
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        const [rows] = await pool.execute(`
            SELECT BC.*, TL.TenTL, TL.FileURL 
            FROM BAOCAOVIPHAM BC 
            JOIN TAILIEU TL ON BC.MaTL = TL.MaTL 
            WHERE BC.MaND = ? 
            ORDER BY BC.NgayBaoCao DESC
            LIMIT ? OFFSET ?
        `, [req.user.MaND, limit.toString(), offset.toString()]);
        res.status(200).json({ reports: rows, total, totalPages, currentPage: page });
    } catch (error) {
        console.error('Lỗi lấy báo cáo:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/purchased-documents', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const offset = (page - 1) * limit;

        const [countResult] = await pool.execute('SELECT COUNT(*) AS total FROM TAILIEU_DAMUA WHERE MaND = ?', [req.user.MaND]);
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        const [rows] = await pool.execute(`
            SELECT TL.MaTL, TL.TenTL, TL.MoTa, TL.LoaiFile, TL.MaMonHoc, TL.TrangThaiKiemDuyet,
                   TL.SoLuotTai, TL.NgayDang, TL.LaTaiLieuChinhThuc, TL.LaTaiLieuDocQuyen, TL.GiaXu,
                   MH.TenMonHoc, TDM.NgayMua, TDM.GiaXuThoiDiemMua,
                   ND.HoTen AS TenNguoiBan,
                   COALESCE((SELECT ROUND(AVG(SoSao), 1) FROM DANHGIA WHERE MaTL = TL.MaTL), 0) AS DiemDanhGia,
                   (SELECT COUNT(*) FROM DANHGIA WHERE MaTL = TL.MaTL) AS SoDanhGia
            FROM TAILIEU_DAMUA TDM
            JOIN TAILIEU TL ON TDM.MaTL = TL.MaTL
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            LEFT JOIN NGUOIDUNG ND ON TL.MaND_NguoiDang = ND.MaND
            WHERE TDM.MaND = ?
            ORDER BY TDM.NgayMua DESC
            LIMIT ? OFFSET ?
        `, [req.user.MaND, limit.toString(), offset.toString()]);
        res.status(200).json({ documents: rows, total, totalPages, currentPage: page });
    } catch (error) {
        console.error('Lỗi lấy tài liệu đã mua:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/transactions', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT MaLS, LoaiGiaoDich, SoXuThayDoi, MoTa, NgayTao
            FROM LICH_SU_XU
            WHERE MaND = ?
            ORDER BY NgayTao DESC
        `, [req.user.MaND]);
        res.status(200).json({ transactions: rows });
    } catch (error) {
        console.error('Lỗi lấy lịch sử giao dịch:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.post('/upgrade-teacher', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const maND = req.user.MaND;
        const { minhChungURL } = req.body;

        if (!minhChungURL) {
            return res.status(400).json({ message: 'Vui lòng cung cấp link ảnh minh chứng.' });
        }

        const [existingReq] = await pool.execute('SELECT TrangThai FROM YEU_CAU_GIAO_VIEN WHERE MaND = ? ORDER BY NgayTao DESC LIMIT 1', [maND]);

        if (existingReq.length > 0 && existingReq[0].TrangThai === 'ChoDuyet') {
            return res.status(400).json({ message: 'Bạn đang có một yêu cầu chờ duyệt.' });
        }

        await pool.execute(
            'INSERT INTO YEU_CAU_GIAO_VIEN (MaND, MinhChungURL, TrangThai) VALUES (?, ?, ?)',
            [maND, minhChungURL, 'ChoDuyet']
        );

        res.status(201).json({ message: 'Gửi yêu cầu thành công. Vui lòng chờ Admin duyệt.' });
    } catch (error) {
        console.error('Lỗi gửi yêu cầu nâng cấp giáo viên:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/upgrade-status', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const maND = req.user.MaND;

        const [rows] = await pool.execute(
            'SELECT MaYeuCau, MinhChungURL, TrangThai, LyDoTuChoi, NgayTao FROM YEU_CAU_GIAO_VIEN WHERE MaND = ? ORDER BY NgayTao DESC LIMIT 1',
            [maND]
        );

        if (rows.length === 0) {
            return res.status(200).json({ status: null });
        }

        res.status(200).json({ status: rows[0] });
    } catch (error) {
        console.error('Lỗi lấy trạng thái nâng cấp:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

const uploadImage = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, os.tmpdir()),
        filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ cho phép tải lên hình ảnh.'));
        }
    }
});

router.post('/upload-image', authMiddleware, uploadImage.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Không tìm thấy file hình ảnh.' });
    }

    try {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'edushare_kyc', resource_type: 'image' },
            (error, result) => {
                if (error) {
                    console.error('Lỗi upload ảnh:', error);
                    return res.status(500).json({ message: 'Lỗi tải ảnh lên server.' });
                }
                res.status(200).json({ url: result.secure_url });
            }
        );
        streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
    } catch (err) {
        console.error('Lỗi xử lý upload ảnh:', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/:maND/downloaded-documents', authMiddleware, async (req, res) => {
    const maND_Khac = req.params.maND;
    try {
        const pool = req.app.locals.pool;

        if (parseInt(maND_Khac) !== req.user.MaND) {
            const [userRows] = await pool.execute('SELECT HienThiLichSuTai FROM NGUOIDUNG WHERE MaND = ?', [maND_Khac]);
            if (userRows.length === 0 || !userRows[0].HienThiLichSuTai) {
                return res.status(403).json({ message: 'Người dùng đã ẩn danh sách này.' });
            }
        }

        const [rows] = await pool.execute(`
            SELECT 
                TL.MaTL, TL.TenTL, TL.MoTa, TL.FileURL, TL.PreviewURL, TL.LoaiFile, 
                TL.SoLuotTai, TL.NgayDang, TL.LaTaiLieuChinhThuc, TL.MaND_NguoiDang,
                TL.LaTaiLieuDocQuyen, TL.GiaXu,
                COALESCE(MH.TenMonHoc, 'Không xác định') AS TenMonHoc, ND.HoTen AS NguoiDang, ND.AvatarURL,
                COALESCE((SELECT ROUND(AVG(SoSao), 1) FROM DANHGIA WHERE MaTL = TL.MaTL), 0) AS DiemDanhGia,
                (SELECT COUNT(*) FROM DANHGIA WHERE MaTL = TL.MaTL) AS SoDanhGia
            FROM LICH_SU_TAI LST
            JOIN TAILIEU TL ON LST.MaTL = TL.MaTL
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc 
            JOIN NGUOIDUNG ND ON TL.MaND_NguoiDang = ND.MaND 
            WHERE LST.MaND = ? AND TL.TrangThaiKiemDuyet = 'DaDuyet'
            ORDER BY LST.NgayTai DESC
        `, [maND_Khac]);

        res.status(200).json({ documents: rows });
    } catch (error) {
        console.error('Lỗi lấy tài liệu đã tải xuống:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/:maND/rated-documents', authMiddleware, async (req, res) => {
    const maND_Khac = req.params.maND;
    try {
        const pool = req.app.locals.pool;

        if (parseInt(maND_Khac) !== req.user.MaND) {
            const [userRows] = await pool.execute('SELECT HienThiDanhGia FROM NGUOIDUNG WHERE MaND = ?', [maND_Khac]);
            if (userRows.length === 0 || !userRows[0].HienThiDanhGia) {
                return res.status(403).json({ message: 'Người dùng đã ẩn danh sách này.' });
            }
        }

        const [rows] = await pool.execute(`
            SELECT 
                TL.MaTL, TL.TenTL, TL.MoTa, TL.FileURL, TL.PreviewURL, TL.LoaiFile, 
                TL.SoLuotTai, TL.NgayDang, TL.LaTaiLieuChinhThuc, TL.MaND_NguoiDang,
                TL.LaTaiLieuDocQuyen, TL.GiaXu,
                COALESCE(MH.TenMonHoc, 'Không xác định') AS TenMonHoc, ND.HoTen AS NguoiDang, ND.AvatarURL,
                COALESCE((SELECT ROUND(AVG(SoSao), 1) FROM DANHGIA WHERE MaTL = TL.MaTL), 0) AS DiemDanhGia,
                (SELECT COUNT(*) FROM DANHGIA WHERE MaTL = TL.MaTL) AS SoDanhGia,
                DG.SoSao AS UserRating
            FROM DANHGIA DG
            JOIN TAILIEU TL ON DG.MaTL = TL.MaTL
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc 
            JOIN NGUOIDUNG ND ON TL.MaND_NguoiDang = ND.MaND 
            WHERE DG.MaND = ? AND TL.TrangThaiKiemDuyet = 'DaDuyet'
            ORDER BY DG.NgayDanhGia DESC
        `, [maND_Khac]);

        res.status(200).json({ documents: rows });
    } catch (error) {
        console.error('Lỗi lấy tài liệu đã đánh giá:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

module.exports = router;
