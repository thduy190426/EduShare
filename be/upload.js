const express = require('express');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const libre = require('libreoffice-convert');
libre.convertAsync = require('util').promisify(libre.convert);

const router = express.Router();
const { authMiddleware, teacherMiddleware } = require('./middlewares/auth');
const { uploadLimiter, rateLimiter, reportLimiter } = require('./middlewares/rateLimit');


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public/uploads/'));
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = crypto.randomBytes(16).toString('hex') + ext;
        cb(null, safeName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedMimeTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/msword',
            'application/vnd.ms-powerpoint'
        ];

        if ((ext === '.pdf' || ext === '.docx' || ext === '.pptx' || ext === '.doc' || ext === '.ppt') && allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ cho phép định dạng văn bản hợp lệ (PDF, DOCX, PPTX).'));
        }
    }
});

function buildBooleanSearchQuery(keyword) {
    if (!keyword || typeof keyword !== 'string') return '';

    return keyword
        .normalize('NFC')
        .split(/[^\p{L}\p{N}_]+/u)
        .map(term => term.trim())
        .filter(Boolean)
        .map(term => `${term}*`)
        .join(' ');
}

async function notifyActiveAdmins(pool, noiDung, linkDich, excludeUserId = null) {
    try {
        const params = [];
        let whereClause = 'VaiTro = "Admin" AND TrangThai = "HoatDong"';

        if (excludeUserId) {
            whereClause += ' AND MaND <> ?';
            params.push(excludeUserId);
        }

        const [admins] = await pool.execute(
            `SELECT MaND FROM NGUOIDUNG WHERE ${whereClause}`,
            params
        );

        for (const admin of admins) {
            await pool.execute(
                'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                [admin.MaND, 'HeThong', noiDung, linkDich]
            );
        }
    } catch (error) {
        console.error('Lỗi gửi thông báo cho Admin:', error);
    }
}

router.get('/subjects', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT MaMonHoc, TenMonHoc, CapHoc
            FROM MONHOC
            WHERE TrangThai = "HoatDong"
            ORDER BY TenMonHoc ASC
        `);
        res.status(200).json({ subjects: rows });
    } catch (error) {
        console.error('Lỗi API /documents/subjects:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách môn học.' });
    }
});

router.get('/levels', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT DISTINCT MH.CapHoc
            FROM MONHOC MH
            JOIN TAILIEU TL ON MH.MaMonHoc = TL.MaMonHoc
            WHERE TL.TrangThaiKiemDuyet = "DaDuyet" AND TL.TrangThaiHienThi = 'Hien' AND MH.CapHoc IS NOT NULL AND MH.CapHoc != ''
            ORDER BY MH.CapHoc ASC
        `);
        res.status(200).json({ levels: rows.map(r => r.CapHoc) });
    } catch (error) {
        console.error('Lỗi API /documents/levels:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách cấp bậc.' });
    }
});

router.post('/upload', authMiddleware, uploadLimiter, (req, res) => {
    upload.single('fileUpload')(req, res, async function (err) {
        if (err instanceof multer.MulterError) {

            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'Dung lượng file vượt quá giới hạn 20MB.' });
            }
            return res.status(400).json({ message: err.message });
        } else if (err) {

            return res.status(400).json({ message: err.message });
        }


        if (!req.file) {
            return res.status(400).json({ message: 'Vui lòng chọn file tài liệu.' });
        }

        const { tenTL, moTa, maMonHoc } = req.body;
        let laTaiLieuChinhThuc = false;


        if (req.user.VaiTro === 'GiaoVien' && req.body.laTaiLieuChinhThuc === 'true') {
            laTaiLieuChinhThuc = true;
        }

        let laTaiLieuDocQuyen = req.body.laTaiLieuDocQuyen === 'true';
        let giaXu = parseInt(req.body.giaXu) || 0;
        if (!laTaiLieuDocQuyen) giaXu = 0;

        if (!tenTL || !maMonHoc) {
            return res.status(400).json({ message: 'Vui lòng cung cấp đủ tên tài liệu và mã môn học.' });
        }

        const loaiFile = path.extname(req.file.originalname).toLowerCase().replace('.', '');
        const fileURL = `/uploads/${req.file.filename}`;
        let previewURL = null;

        try {
            if (loaiFile === 'pptx' || loaiFile === 'ppt') {
                try {
                    const pptxBuf = fs.readFileSync(req.file.path);
                    const pdfBuf = await libre.convertAsync(pptxBuf, '.pdf', undefined);
                    const pdfFileName = `${path.parse(req.file.filename).name}.pdf`;
                    const pdfPath = path.join(__dirname, 'public/uploads/previews/', pdfFileName);
                    fs.writeFileSync(pdfPath, pdfBuf);
                    previewURL = `/uploads/previews/${pdfFileName}`;
                } catch (convErr) {
                    console.error('Lỗi convert pptx sang pdf:', convErr);
                }
            }

            const pool = req.app.locals.pool;

            await pool.execute(
                `INSERT INTO TAILIEU (TenTL, MoTa, FileURL, PreviewURL, LoaiFile, MaMonHoc, MaND_NguoiDang, TrangThaiKiemDuyet, LaTaiLieuChinhThuc, LaTaiLieuDocQuyen, GiaXu) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'ChoDuyet', ?, ?, ?)`,
                [tenTL, moTa || null, fileURL, previewURL, loaiFile, maMonHoc, req.user.MaND, laTaiLieuChinhThuc, laTaiLieuDocQuyen, giaXu]
            );

            await notifyActiveAdmins(
                pool,
                `Có tài liệu mới chờ kiểm duyệt: "${tenTL}".`,
                '../admin/adminModeration.html',
                req.user.MaND
            );

            res.status(200).json({ message: 'Tải lên tài liệu thành công.', fileURL });
        } catch (dbErr) {
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            console.error('Lỗi khi lưu DB:', dbErr);
            res.status(500).json({ message: 'Lỗi máy chủ khi lưu thông tin tài liệu.' });
        }
    });
});


router.get('/search', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { tuKhoa, maMonHoc, loaiFile, sapXep, trang, limit: queryLimit, capHoc, nguoiDang, tuNgay, denNgay, chinhThuc } = req.query;


        const page = Math.max(parseInt(trang) || 1, 1);
        const limit = Math.min(Math.max(parseInt(queryLimit) || 20, 1), 50);
        const offset = (page - 1) * limit;

        let selectClause = `
            SELECT 
                TL.MaTL, TL.TenTL, TL.MoTa, TL.FileURL, TL.PreviewURL, TL.LoaiFile, 
                TL.SoLuotTai, TL.NgayDang, TL.LaTaiLieuChinhThuc, TL.MaND_NguoiDang,
                TL.LaTaiLieuDocQuyen, TL.GiaXu,
                ND.HoTen AS TenNguoiDang, ND.AvatarURL,
                COALESCE(MH.TenMonHoc, 'Không xác định') AS TenMonHoc,
                COALESCE((SELECT ROUND(AVG(SoSao), 1) FROM DANHGIA WHERE MaTL = TL.MaTL), 0) AS DiemDanhGia,
                (SELECT COUNT(*) FROM DANHGIA WHERE MaTL = TL.MaTL) AS SoDanhGia
        `;
        let fromClause = `
            FROM TAILIEU TL
            JOIN NGUOIDUNG ND ON TL.MaND_NguoiDang = ND.MaND
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
        `;
        let whereClause = ` WHERE TL.TrangThaiKiemDuyet = 'DaDuyet' AND TL.TrangThaiHienThi = 'Hien'`;

        const params = [];
        const countParams = [];

        const booleanSearchQuery = buildBooleanSearchQuery(tuKhoa);

        if (booleanSearchQuery) {

            selectClause += `, MATCH(TL.TenTL, TL.MoTa) AGAINST(? IN BOOLEAN MODE) AS score`;
            whereClause += ` AND MATCH(TL.TenTL, TL.MoTa) AGAINST(? IN BOOLEAN MODE)`;
            params.push(booleanSearchQuery, booleanSearchQuery);
            countParams.push(booleanSearchQuery);
        } else {
            selectClause += `, 0 AS score`;
        }

        if (maMonHoc) {
            const arrMonHoc = Array.isArray(maMonHoc) ? maMonHoc : maMonHoc.split(',');
            const placeholders = arrMonHoc.map(() => '?').join(',');
            whereClause += ` AND TL.MaMonHoc IN (${placeholders})`;
            params.push(...arrMonHoc);
            countParams.push(...arrMonHoc);
        }

        if (loaiFile) {
            const arrLoaiFile = Array.isArray(loaiFile) ? loaiFile : loaiFile.split(',');
            const placeholders = arrLoaiFile.map(() => '?').join(',');
            whereClause += ` AND TL.LoaiFile IN (${placeholders})`;
            params.push(...arrLoaiFile);
            countParams.push(...arrLoaiFile);
        }

        if (capHoc) {
            whereClause += ` AND MH.CapHoc = ?`;
            params.push(capHoc);
            countParams.push(capHoc);
        }

        if (nguoiDang) {
            whereClause += ` AND ND.HoTen LIKE ?`;
            const nguoiDangQuery = `%${nguoiDang}%`;
            params.push(nguoiDangQuery);
            countParams.push(nguoiDangQuery);
        }

        if (tuNgay) {
            whereClause += ` AND TL.NgayDang >= ?`;
            params.push(tuNgay);
            countParams.push(tuNgay);
        }

        if (denNgay) {
            whereClause += ` AND TL.NgayDang <= ?`;
            params.push(denNgay + ' 23:59:59');
            countParams.push(denNgay + ' 23:59:59');
        }

        if (chinhThuc === 'true') {
            whereClause += ` AND TL.LaTaiLieuChinhThuc = 1`;
        }

        let orderClause = '';
        if (sapXep === 'PhoBien') {
            orderClause = ` ORDER BY TL.SoLuotTai DESC, TL.MaTL DESC`;
        } else if (sapXep === 'Relevance' && booleanSearchQuery) {
            orderClause = ` ORDER BY score DESC, TL.MaTL DESC`;
        } else {
            orderClause = ` ORDER BY TL.MaTL DESC`;
        }

        const sql = selectClause + fromClause + whereClause + orderClause + ` LIMIT ? OFFSET ?`;
        const countSql = `SELECT COUNT(*) AS total` + fromClause + whereClause;

        params.push(limit.toString(), offset.toString());

        const [rows] = await pool.execute(sql, params);
        const [countRows] = await pool.execute(countSql, countParams);

        const totalRecords = countRows[0].total;
        const totalPages = Math.ceil(totalRecords / limit);

        res.status(200).json({
            documents: rows,
            totalPages,
            currentPage: page,
            totalRecords
        });

    } catch (error) {
        console.error('Lỗi API tìm kiếm tài liệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi tìm kiếm tài liệu.' });
    }
});

router.get('/:maTL/related', async (req, res) => {
    const maTL = req.params.maTL;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 5, 1), 10);

    try {
        const pool = req.app.locals.pool;

        const [currentRows] = await pool.execute(
            `SELECT MaMonHoc, LoaiFile
             FROM TAILIEU
             WHERE MaTL = ? AND TrangThaiKiemDuyet = 'DaDuyet' AND TrangThaiHienThi = 'Hien'`,
            [maTL]
        );

        if (currentRows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
        }

        const currentDoc = currentRows[0];
        const [relatedDocs] = await pool.execute(`
            SELECT
                TL.MaTL, TL.TenTL, TL.MoTa, TL.FileURL, TL.PreviewURL, TL.LoaiFile,
                TL.SoLuotTai, TL.SoLuotXem, TL.NgayDang, TL.LaTaiLieuChinhThuc,
                TL.MaND_NguoiDang, ND.HoTen AS TenNguoiDang, ND.AvatarURL,
                COALESCE(MH.TenMonHoc, 'Khong xac dinh') AS TenMonHoc,
                COALESCE(ROUND(AVG(DG.SoSao), 1), 0) AS DiemDanhGia,
                COUNT(DG.MaND) AS SoDanhGia
            FROM TAILIEU TL
            JOIN NGUOIDUNG ND ON TL.MaND_NguoiDang = ND.MaND
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            LEFT JOIN DANHGIA DG ON DG.MaTL = TL.MaTL
            WHERE TL.TrangThaiKiemDuyet = 'DaDuyet' AND TL.TrangThaiHienThi = 'Hien'
              AND TL.MaTL <> ?
              AND TL.MaMonHoc = ?
            GROUP BY
                TL.MaTL, TL.TenTL, TL.MoTa, TL.FileURL, TL.PreviewURL, TL.LoaiFile,
                TL.SoLuotTai, TL.SoLuotXem, TL.NgayDang, TL.LaTaiLieuChinhThuc,
                TL.MaND_NguoiDang, ND.HoTen, ND.AvatarURL, MH.TenMonHoc
            ORDER BY
                CASE WHEN TL.LoaiFile = ? THEN 0 ELSE 1 END,
                TL.LaTaiLieuChinhThuc DESC,
                DiemDanhGia DESC,
                TL.SoLuotTai DESC,
                TL.NgayDang DESC
            LIMIT ?
        `, [maTL, currentDoc.MaMonHoc, currentDoc.LoaiFile, limit.toString()]);

        res.status(200).json({ documents: relatedDocs });
    } catch (error) {
        console.error('Lỗi khi lấy tài liệu liên quan:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy tài liệu liên quan.' });
    }
});


router.get('/:maTL', async (req, res) => {
    const maTL = req.params.maTL;
    try {
        const pool = req.app.locals.pool;


        await pool.execute('UPDATE TAILIEU SET SoLuotXem = SoLuotXem + 1 WHERE MaTL = ? AND TrangThaiKiemDuyet = "DaDuyet" AND TrangThaiHienThi = "Hien"', [maTL]);


        const [rows] = await pool.execute(`
            SELECT TL.*, ND.HoTen AS TenNguoiDang, ND.AvatarURL, COALESCE(MH.TenMonHoc, 'Không xác định') AS TenMonHoc,
                   COALESCE((SELECT AVG(SoSao) FROM DANHGIA WHERE MaTL = TL.MaTL), 0) AS DiemDanhGia,
                   (SELECT COUNT(*) FROM DANHGIA WHERE MaTL = TL.MaTL) AS SoDanhGia
            FROM TAILIEU TL
            JOIN NGUOIDUNG ND ON TL.MaND_NguoiDang = ND.MaND
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            WHERE TL.MaTL = ? AND TL.TrangThaiKiemDuyet = 'DaDuyet' AND TL.TrangThaiHienThi = 'Hien'
        `, [maTL]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
        }

        const taiLieu = rows[0];


        const [comments] = await pool.execute(`
            SELECT BL.*, ND.HoTen AS TenNguoiBinhLuan, ND.VaiTro, ND.AvatarURL
            FROM BINHLUAN BL
            JOIN NGUOIDUNG ND ON BL.MaND = ND.MaND
            WHERE BL.MaTL = ?
            ORDER BY BL.NgayBinhLuan ASC
        `, [maTL]);

        let isBookmarked = false;
        let hasRated = false;
        let hasDownloaded = false;
        let hasPurchased = false;
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const tokenStr = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(tokenStr, process.env.JWT_SECRET);
                const [bmRows] = await pool.execute('SELECT 1 FROM BOOKMARK WHERE MaTL = ? AND MaND = ?', [maTL, decoded.MaND]);
                if (bmRows.length > 0) isBookmarked = true;
                const [ratingRows] = await pool.execute('SELECT 1 FROM DANHGIA WHERE MaTL = ? AND MaND = ?', [maTL, decoded.MaND]);
                if (ratingRows.length > 0) hasRated = true;
                const [downloadRows] = await pool.execute('SELECT 1 FROM LICH_SU_TAI WHERE MaTL = ? AND MaND = ?', [maTL, decoded.MaND]);
                if (downloadRows.length > 0) hasDownloaded = true;
                
                if (taiLieu.LaTaiLieuDocQuyen) {
                    const [purchaseRows] = await pool.execute('SELECT 1 FROM TAILIEU_DAMUA WHERE MaTL = ? AND MaND = ?', [maTL, decoded.MaND]);
                    if (purchaseRows.length > 0) hasPurchased = true;
                }
            } catch (e) {

            }
        }

        res.status(200).json({ document: taiLieu, comments, isBookmarked, hasRated, hasDownloaded, hasPurchased });
    } catch (error) {
        console.error('Lỗi khi lấy chi tiết tài liệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.get('/:maTL/download', authMiddleware, async (req, res) => {
    const maTL = req.params.maTL;
    const maND = req.user.MaND;

    try {
        const pool = req.app.locals.pool;

        const [rows] = await pool.execute('SELECT * FROM TAILIEU WHERE MaTL = ?', [maTL]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
        }

        const doc = rows[0];


        let isAllowed = false;
        if (doc.TrangThaiKiemDuyet === 'DaDuyet') {
            isAllowed = true;
        } else if (doc.MaND_NguoiDang === maND) {
            isAllowed = true;
        } else if (req.user.VaiTro === 'Admin') {
            isAllowed = true;
        } else {

            const [groupCheck] = await pool.execute(`
                SELECT 1 FROM TAILIEU_NHOM TN
                JOIN THANHVIEN_NHOM TV ON TN.MaNhom = TV.MaNhom
                WHERE TN.MaTL = ? AND TV.MaND = ?
            `, [maTL, maND]);
            if (groupCheck.length > 0) {
                isAllowed = true;
            }
        }

        if (!isAllowed) {
            return res.status(403).json({ message: 'Bạn không có quyền tải tài liệu này.' });
        }
        
        if (doc.LaTaiLieuDocQuyen && doc.MaND_NguoiDang !== maND && req.user.VaiTro !== 'Admin') {
            const [purchaseRows] = await pool.execute('SELECT 1 FROM TAILIEU_DAMUA WHERE MaTL = ? AND MaND = ?', [maTL, maND]);
            if (purchaseRows.length === 0) {
                return res.status(403).json({ message: 'Bạn cần mở khoá tài liệu PREMIUM này trước khi tải.' });
            }
        }


        const filePath = path.join(__dirname, 'public', doc.FileURL);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Không tìm thấy file vật lý trên máy chủ.' });
        }

        const fileName = `Tailieu_${doc.MaTL}.${doc.LoaiFile}`;
        res.setHeader('X-Download-Filename', encodeURIComponent(fileName));
        res.setHeader('Access-Control-Expose-Headers', 'X-Download-Filename');
        res.type(path.extname(filePath));
        
        res.sendFile(filePath, async (err) => {
            if (!err) {
                try {
                    const [historyRows] = await pool.execute('SELECT 1 FROM LICH_SU_TAI WHERE MaND = ? AND MaTL = ?', [maND, maTL]);
                    if (historyRows.length === 0) {
                        await pool.execute('INSERT INTO LICH_SU_TAI (MaND, MaTL) VALUES (?, ?)', [maND, maTL]);
                        await pool.execute('UPDATE TAILIEU SET SoLuotTai = SoLuotTai + 1 WHERE MaTL = ?', [maTL]);
                    }
                } catch (dbErr) {
                    console.error('Lỗi khi cập nhật lịch sử tải:', dbErr);
                }
            } else {
                console.error('Lỗi hoặc gián đoạn khi gửi file:', err);
            }
        });

    } catch (error) {
        console.error('Lỗi khi tải tài liệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.post('/:maTL/bookmark', authMiddleware, async (req, res) => {
    const maTL = req.params.maTL;
    const maND = req.user.MaND;
    try {
        const pool = req.app.locals.pool;

        const [rows] = await pool.execute('SELECT * FROM BOOKMARK WHERE MaND = ? AND MaTL = ?', [maND, maTL]);

        if (rows.length > 0) {

            await pool.execute('DELETE FROM BOOKMARK WHERE MaND = ? AND MaTL = ?', [maND, maTL]);
            return res.status(200).json({ message: 'Đã bỏ lưu tài liệu.', isBookmarked: false });
        } else {

            await pool.execute('INSERT INTO BOOKMARK (MaND, MaTL) VALUES (?, ?)', [maND, maTL]);
            return res.status(200).json({ message: 'Đã lưu tài liệu.', isBookmarked: true });
        }
    } catch (error) {
        console.error('Lỗi bookmark:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.post('/:maTL/rate', authMiddleware, rateLimiter, async (req, res) => {
    const maTL = req.params.maTL;
    const maND = req.user.MaND;
    const { soSao } = req.body;

    if (!soSao || soSao < 1 || soSao > 5) {
        return res.status(400).json({ message: 'Số sao không hợp lệ (1-5).' });
    }

    try {
        const pool = req.app.locals.pool;

        const [docs] = await pool.execute('SELECT 1 FROM TAILIEU WHERE MaTL = ? AND TrangThaiKiemDuyet = "DaDuyet" AND TrangThaiHienThi = "Hien"', [maTL]);
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Tài liệu không tồn tại hoặc chưa được duyệt.' });
        }

        const [downloadRows] = await pool.execute('SELECT 1 FROM LICH_SU_TAI WHERE MaND = ? AND MaTL = ?', [maND, maTL]);
        if (downloadRows.length === 0) {
            return res.status(403).json({ message: 'Bạn cần tải tài liệu xuống trước khi đánh giá.' });
        }

        const [rows] = await pool.execute('SELECT 1 FROM DANHGIA WHERE MaND = ? AND MaTL = ?', [maND, maTL]);
        if (rows.length > 0) {
            return res.status(409).json({ message: 'Bạn đã đánh giá tài liệu này rồi. Mỗi tài khoản chỉ được đánh giá một lần.' });
        }

        await pool.execute('INSERT INTO DANHGIA (MaND, MaTL, SoSao) VALUES (?, ?, ?)', [maND, maTL, soSao]);


        const [avgRows] = await pool.execute('SELECT AVG(SoSao) AS average, COUNT(*) AS count FROM DANHGIA WHERE MaTL = ?', [maTL]);

        res.status(200).json({ message: 'Đánh giá thành công.', average: avgRows[0].average, count: avgRows[0].count });
    } catch (error) {
        console.error('Lỗi rate:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.post('/:maTL/comments', authMiddleware, async (req, res) => {
    const maTL = req.params.maTL;
    const maND = req.user.MaND;
    const { noiDung, maBL_Cha } = req.body;

    if (!noiDung || noiDung.trim() === '' || noiDung.length > 1000) {
        return res.status(400).json({ message: 'Nội dung bình luận không hợp lệ (1-1000 ký tự).' });
    }

    try {
        const pool = req.app.locals.pool;

        const [docs] = await pool.execute('SELECT 1 FROM TAILIEU WHERE MaTL = ? AND TrangThaiKiemDuyet = "DaDuyet" AND TrangThaiHienThi = "Hien"', [maTL]);
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Tài liệu không tồn tại hoặc chưa được duyệt.' });
        }

        const [recentComments] = await pool.execute(
            'SELECT 1 FROM BINHLUAN WHERE MaND = ? AND NgayBinhLuan > (NOW() - INTERVAL 10 SECOND)',
            [maND]
        );
        if (recentComments.length > 0) {
            return res.status(429).json({ message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' });
        }

        const [result] = await pool.execute(
            'INSERT INTO BINHLUAN (MaND, MaTL, NoiDung, MaBL_Cha) VALUES (?, ?, ?, ?)',
            [maND, maTL, noiDung, maBL_Cha || null]
        );


        if (maBL_Cha) {
            const [parentRows] = await pool.execute('SELECT MaND FROM BINHLUAN WHERE MaBL = ?', [maBL_Cha]);
            if (parentRows.length > 0) {
                const parentMaND = parentRows[0].MaND;
                if (parentMaND !== maND) {
                    await pool.execute(
                        'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                        [parentMaND, 'PhanHoiBL', 'Có người đã trả lời bình luận của bạn.', `../document/documentDetails.html?id=${maTL}`]
                    );
                }
            }
        }

        res.status(201).json({ message: 'Bình luận thành công.', maBL: result.insertId });
    } catch (error) {
        console.error('Lỗi comment:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.post('/:maTL/report', authMiddleware, reportLimiter, async (req, res) => {
    const maTL = req.params.maTL;
    const maND = req.user.MaND;
    const { lyDo } = req.body;

    if (!lyDo || lyDo.trim() === '' || lyDo.length > 500) {
        return res.status(400).json({ message: 'Vui lòng cung cấp lý do báo cáo hợp lệ (1-500 ký tự).' });
    }

    try {
        const pool = req.app.locals.pool;

        const [docs] = await pool.execute('SELECT TenTL FROM TAILIEU WHERE MaTL = ?', [maTL]);
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Tài liệu không tồn tại.' });
        }

        const [existing] = await pool.execute(
            'SELECT 1 FROM BAOCAOVIPHAM WHERE MaTL = ? AND MaND = ? AND TrangThai = "ChoXuLy"',
            [maTL, maND]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Bạn đã báo cáo tài liệu này rồi và đang chờ xử lý.' });
        }

        await pool.execute(
            'INSERT INTO BAOCAOVIPHAM (MaTL, MaND, LyDo, TrangThai) VALUES (?, ?, ?, ?)',
            [maTL, maND, lyDo, 'ChoXuLy']
        );

        await notifyActiveAdmins(
            pool,
            `Có báo cáo vi phạm mới cho tài liệu: "${docs[0].TenTL}".`,
            '../admin/adminViolationReports.html',
            maND
        );

        res.status(201).json({ message: 'Đã gửi báo cáo vi phạm.' });
    } catch (error) {
        console.error('Lỗi report:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.put('/:maTL/verify', authMiddleware, teacherMiddleware, async (req, res) => {
    const maTL = req.params.maTL;

    try {
        const pool = req.app.locals.pool;


        const [docs] = await pool.execute('SELECT LaTaiLieuChinhThuc FROM TAILIEU WHERE MaTL = ?', [maTL]);
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
        }

        const currentState = docs[0].LaTaiLieuChinhThuc;
        const newState = !currentState;


        await pool.execute('UPDATE TAILIEU SET LaTaiLieuChinhThuc = ? WHERE MaTL = ?', [newState, maTL]);

        res.status(200).json({
            message: newState ? 'Đã xác thực tài liệu.' : 'Đã hủy xác thực tài liệu.',
            LaTaiLieuChinhThuc: newState
        });
    } catch (error) {
        console.error('Lỗi xác thực tài liệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/:maTL', authMiddleware, (req, res) => {
    upload.single('fileUpload')(req, res, async function (err) {
        if (err) return res.status(400).json({ message: err.message });

        const maTL = req.params.maTL;
        const maND = req.user.MaND;
        const { tenTL, moTa, maMonHoc } = req.body;

        if (!tenTL || !maMonHoc) {
            return res.status(400).json({ message: 'Vui lòng cung cấp đủ tên tài liệu và mã môn học.' });
        }

        try {
            const pool = req.app.locals.pool;

            const [docs] = await pool.execute('SELECT MaND_NguoiDang, TrangThaiKiemDuyet, FileURL FROM TAILIEU WHERE MaTL = ?', [maTL]);
            if (docs.length === 0) {
                return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
            }

            if (docs[0].MaND_NguoiDang !== maND && req.user.VaiTro !== 'Admin') {
                return res.status(403).json({ message: 'Bạn không có quyền sửa tài liệu này.' });
            }

            if (req.file) {
                const loaiFile = path.extname(req.file.originalname).toLowerCase().replace('.', '');
                const fileURL = `/uploads/${req.file.filename}`;

                let previewURL = null;
                if (loaiFile === 'pptx' || loaiFile === 'ppt') {
                    try {
                        const pptxBuf = fs.readFileSync(req.file.path);
                        const pdfBuf = await libre.convertAsync(pptxBuf, '.pdf', undefined);
                        const pdfFileName = `${path.parse(req.file.filename).name}.pdf`;
                        const pdfPath = path.join(__dirname, 'public/uploads/previews/', pdfFileName);
                        fs.writeFileSync(pdfPath, pdfBuf);
                        previewURL = `/uploads/previews/${pdfFileName}`;
                    } catch (convErr) {
                        console.error('Lỗi convert pptx sang pdf khi sửa:', convErr);
                    }
                }

                await pool.execute(
                    'UPDATE TAILIEU SET TenTL = ?, MoTa = ?, MaMonHoc = ?, FileURL = ?, PreviewURL = ?, LoaiFile = ?, TrangThaiKiemDuyet = "ChoDuyet" WHERE MaTL = ?',
                    [tenTL, moTa || null, maMonHoc, fileURL, previewURL, loaiFile, maTL]
                );

                try {
                    const oldFilePath = path.join(__dirname, 'public', docs[0].FileURL);
                    if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
                } catch (e) {
                    console.error('Lỗi xóa file cũ:', e);
                }
            } else {
                await pool.execute(
                    'UPDATE TAILIEU SET TenTL = ?, MoTa = ?, MaMonHoc = ?, TrangThaiKiemDuyet = "ChoDuyet" WHERE MaTL = ?',
                    [tenTL, moTa || null, maMonHoc, maTL]
                );
            }

            res.status(200).json({ message: 'Đã cập nhật thông tin tài liệu thành công. Vui lòng chờ duyệt lại.' });
        } catch (error) {
            console.error('Lỗi khi sửa tài liệu:', error);
            res.status(500).json({ message: 'Lỗi máy chủ.' });
        }
    });
});


router.delete('/:maTL', authMiddleware, async (req, res) => {
    const maTL = req.params.maTL;
    const maND = req.user.MaND;

    try {
        const pool = req.app.locals.pool;

        const [docs] = await pool.execute('SELECT MaND_NguoiDang, FileURL, TenTL, TrangThaiKiemDuyet FROM TAILIEU WHERE MaTL = ?', [maTL]);
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
        }

        if (docs[0].MaND_NguoiDang !== maND && req.user.VaiTro !== 'Admin') {
            return res.status(403).json({ message: 'Bạn không có quyền xóa tài liệu này.' });
        }

        if (docs[0].TrangThaiKiemDuyet === 'ChoDuyet') {
            await pool.execute(
                'DELETE FROM THONGBAO WHERE NoiDung = ? AND LinkDich = ?',
                [`Có tài liệu mới chờ kiểm duyệt: "${docs[0].TenTL}".`, '../admin/adminModeration.html']
            );
        }

        await pool.execute('DELETE FROM BINHLUAN WHERE MaTL = ?', [maTL]);
        await pool.execute('DELETE FROM BOOKMARK WHERE MaTL = ?', [maTL]);
        await pool.execute('DELETE FROM DANHGIA WHERE MaTL = ?', [maTL]);
        await pool.execute('DELETE FROM BAOCAOVIPHAM WHERE MaTL = ?', [maTL]);
        await pool.execute('DELETE FROM TAILIEU_NHOM WHERE MaTL = ?', [maTL]);
        await pool.execute('DELETE FROM LICH_SU_TAI WHERE MaTL = ?', [maTL]);

        await pool.execute('DELETE FROM TAILIEU WHERE MaTL = ?', [maTL]);


        try {
            const fs = require('fs');
            const filePath = path.join(__dirname, 'public', docs[0].FileURL);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (e) {
            console.error('Lỗi khi xóa file vật lý:', e);
        }

        res.status(200).json({ message: 'Đã xóa tài liệu thành công.' });
    } catch (error) {
        console.error('Lỗi khi xóa tài liệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.post('/:maTL/buy', authMiddleware, async (req, res) => {
    const maTL = req.params.maTL;
    const maND = req.user.MaND;

    try {
        const pool = req.app.locals.pool;

        const [docs] = await pool.execute('SELECT MaND_NguoiDang, GiaXu, LaTaiLieuDocQuyen, TenTL FROM TAILIEU WHERE MaTL = ? AND TrangThaiKiemDuyet = "DaDuyet" AND TrangThaiHienThi = "Hien"', [maTL]);
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu PREMIUM.' });
        }

        const doc = docs[0];
        if (!doc.LaTaiLieuDocQuyen) {
            return res.status(400).json({ message: 'Tài liệu này không phải là tài liệu độc quyền (PREMIUM).' });
        }

        if (doc.MaND_NguoiDang === maND) {
            return res.status(400).json({ message: 'Bạn không thể mua tài liệu do chính bạn đăng.' });
        }

        const [purchaseRows] = await pool.execute('SELECT 1 FROM TAILIEU_DAMUA WHERE MaTL = ? AND MaND = ?', [maTL, maND]);
        if (purchaseRows.length > 0) {
            return res.status(400).json({ message: 'Bạn đã mua tài liệu này rồi.' });
        }

        const [userRows] = await pool.execute('SELECT SoDuXu FROM NGUOIDUNG WHERE MaND = ?', [maND]);
        if (userRows.length === 0) return res.status(404).json({ message: 'Người dùng không tồn tại.' });

        const soDuHienTai = userRows[0].SoDuXu;
        if (soDuHienTai < doc.GiaXu) {
            return res.status(400).json({ message: 'Bạn không đủ xu để mua tài liệu này.' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            await connection.execute('UPDATE NGUOIDUNG SET SoDuXu = SoDuXu - ? WHERE MaND = ?', [doc.GiaXu, maND]);
            
            await connection.execute('UPDATE NGUOIDUNG SET SoDuXu = SoDuXu + ? WHERE MaND = ?', [doc.GiaXu, doc.MaND_NguoiDang]);

            await connection.execute('INSERT INTO TAILIEU_DAMUA (MaND, MaTL, GiaXuThoiDiemMua) VALUES (?, ?, ?)', [maND, maTL, doc.GiaXu]);

            await connection.execute('INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, ?, ?, ?)', [maND, 'MuaTaiLieu', -doc.GiaXu, `Mua tài liệu: ${doc.TenTL}`]);

            await connection.execute('INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, ?, ?, ?)', [doc.MaND_NguoiDang, 'BanTaiLieu', doc.GiaXu, `Bán tài liệu: ${doc.TenTL}`]);

            await connection.commit();
            res.status(200).json({ message: 'Mua tài liệu thành công!' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Lỗi khi mua tài liệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

module.exports = router;
