const express = require('express');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const https = require('https');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function extractTextFromFile(filePath, mimeType) {
    try {
        let text = '';
        if (mimeType === 'application/pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer, { max: 3 });
            text = data.text;
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ path: filePath });
            text = result.value;
        }

        if (text) {
            text = text.replace(/\s+/g, ' ').trim();
            return text.substring(0, 1000);
        }
    } catch (err) {
        console.error('Error extracting text:', err);
    }
    return '';
}
async function getFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const rs = fs.createReadStream(filePath);
        rs.on('error', reject);
        rs.on('data', chunk => hash.update(chunk));
        rs.on('end', () => resolve(hash.digest('hex')));
    });
}
const xssLibrary = require('xss');
const myXss = new xssLibrary.FilterXSS({
    whiteList: {
        ...xssLibrary.getDefaultWhiteList(),
        p: ['style', 'class'],
        span: ['style', 'class'],
        strong: [],
        em: [],
        u: [],
        s: [],
        blockquote: [],
        ol: [],
        ul: [],
        li: ['class'],
        h1: [],
        h2: [],
        br: [],
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt', 'width', 'height']
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script']
});
const xss = (html) => myXss.process(html);
require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadToCloudinary = (filePathOrBuffer, options) => {
    if (Buffer.isBuffer(filePathOrBuffer)) {
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
                if (result) resolve(result);
                else reject(error);
            });
            streamifier.createReadStream(filePathOrBuffer).pipe(stream);
        });
    } else {
        return cloudinary.uploader.upload(filePathOrBuffer, options);
    }
};

const generatePreviewPdf = async (buffer) => {
    try {
        const originalDoc = await PDFDocument.load(buffer);
        const previewDoc = await PDFDocument.create();
        const numPages = Math.min(3, originalDoc.getPageCount());
        const copiedPages = await previewDoc.copyPages(originalDoc, Array.from({ length: numPages }, (_, i) => i));

        const font = await previewDoc.embedFont(StandardFonts.Helvetica);

        for (const page of copiedPages) {
            const { width, height } = page.getSize();
            page.drawText('PREVIEW - EDUSHARE', {
                x: width / 2 - 150,
                y: height / 2,
                size: 40,
                font: font,
                color: rgb(0.75, 0.75, 0.75),
                opacity: 0.3,
                rotate: degrees(-45),
            });
            previewDoc.addPage(page);
        }

        const previewBytes = await previewDoc.save();
        return Buffer.from(previewBytes);
    } catch (e) {
        console.error('Lỗi tạo preview PDF:', e);
        return null;
    }
};

const deleteFromCloudinary = async (fileUrl) => {
    if (!fileUrl || !fileUrl.includes('cloudinary.com')) return;
    try {
        const urlParts = fileUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        let publicId = filename.split('.')[0];
        const folder = urlParts[urlParts.length - 2];
        if (folder && folder !== 'upload' && !folder.startsWith('v')) {
            publicId = folder + '/' + publicId;
        }
        await cloudinary.uploader.destroy(publicId);
    } catch (e) {
        console.error('Lỗi xóa file trên Cloudinary:', e);
    }
};

const router = express.Router();
const { authMiddleware, teacherMiddleware } = require('./middlewares/auth');
const { uploadLimiter, rateLimiter, reportLimiter, downloadLimiter, commentLimiter } = require('./middlewares/rateLimit');
const { scanFileVirus } = require('./services/virusScanner');
const { moderationMiddleware } = require('./middlewares/moderation');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
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

router.get('/subjects/popular', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT MH.MaMonHoc, MH.TenMonHoc, MH.CapHoc, COUNT(TL.MaTL) as DocCount
            FROM MONHOC MH
            LEFT JOIN TAILIEU TL ON MH.MaMonHoc = TL.MaMonHoc AND TL.TrangThaiKiemDuyet = 'DaDuyet' AND TL.IsDeleted = FALSE
            WHERE MH.TrangThai = 'HoatDong'
            GROUP BY MH.MaMonHoc, MH.TenMonHoc, MH.CapHoc
            ORDER BY DocCount DESC, MH.TenMonHoc ASC
            LIMIT 4
        `);
        res.status(200).json({ subjects: rows });
    } catch (error) {
        console.error('Lỗi API /documents/subjects/popular:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách môn học phổ biến.' });
    }
});

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
            WHERE TL.TrangThaiKiemDuyet = "DaDuyet" AND TL.IsDeleted = FALSE AND MH.CapHoc IS NOT NULL AND MH.CapHoc != ''
            ORDER BY MH.CapHoc ASC
        `);
        res.status(200).json({ levels: rows.map(r => r.CapHoc) });
    } catch (error) {
        console.error('Lỗi API /documents/levels:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách cấp bậc.' });
    }
});

router.get('/generate-signature', authMiddleware, (req, res) => {
    try {
        const timestamp = Math.round((new Date).getTime() / 1000);
        const folder = 'documents'; 
        const signature = cloudinary.utils.api_sign_request({
            timestamp: timestamp,
            folder: folder
        }, process.env.CLOUDINARY_API_SECRET);

        res.status(200).json({
            signature,
            timestamp,
            folder,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY
        });
    } catch (error) {
        console.error('Lỗi tạo signature:', error);
        res.status(500).json({ message: 'Lỗi tạo chữ ký upload.' });
    }
});

router.get('/stats/platform', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [docRows] = await pool.execute("SELECT COUNT(*) AS count FROM TAILIEU WHERE TrangThaiKiemDuyet = 'DaDuyet'");
        const [userRows] = await pool.execute("SELECT COUNT(*) AS count FROM NGUOIDUNG");
        const [dlRows] = await pool.execute("SELECT SUM(SoLuotTai) AS count FROM TAILIEU");

        res.status(200).json({
            documents: docRows[0].count || 0,
            users: userRows[0].count || 0,
            downloads: dlRows[0].count || 0
        });
    } catch (error) {
        console.error('Lỗi API /documents/stats/platform:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error('Khong the tai file ve may chu'));
            }
            response.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', err => {
            fs.unlink(destPath, () => reject(err));
        });
    });
}

router.post('/upload', authMiddleware, uploadLimiter, upload.none(), moderationMiddleware(['tenTL', 'moTa']), async (req, res) => {
    const { cloudinaryUrl, publicId, mimeType, fileName } = req.body;
    
    if (!cloudinaryUrl) {
        return res.status(400).json({ message: 'Lỗi: Không tìm thấy đường dẫn file từ Cloudinary.' });
    }

    const tempFilePath = path.join(os.tmpdir(), `temp_${Date.now()}_${publicId.replace(/\//g, '_')}`);
    
    try {
        await downloadFile(cloudinaryUrl, tempFilePath);

        const fileHash = await getFileHash(tempFilePath);

        const virusScanResult = await scanFileVirus(fileHash);
        if (!virusScanResult.safe) {
            fs.unlinkSync(tempFilePath);
            await deleteFromCloudinary(cloudinaryUrl);
            return res.status(400).json({ message: virusScanResult.message });
        }

        const tenTL = xss(req.body.tenTL);
        const moTa = req.body.moTa ? xss(req.body.moTa) : null;
        const maMonHoc = req.body.maMonHoc;
        let laTaiLieuChinhThuc = false;

        if (req.user.VaiTro === 'GiaoVien' && req.body.laTaiLieuChinhThuc === 'true') {
            laTaiLieuChinhThuc = true;
        }

        let laTaiLieuDocQuyen = req.body.laTaiLieuDocQuyen === 'true';
        let giaXu = parseInt(req.body.giaXu) || 0;

        if (req.user.VaiTro !== 'GiaoVien' && req.user.VaiTro !== 'Admin') {
            laTaiLieuDocQuyen = false;
        }

        if (!laTaiLieuDocQuyen) {
            giaXu = 0;
        } else if (giaXu < 0 || giaXu > 1000000) {
            fs.unlinkSync(tempFilePath);
            await deleteFromCloudinary(cloudinaryUrl);
            return res.status(400).json({ message: 'Giá Xu phải lớn hơn hoặc bằng 0 và không vượt quá 1.000.000.' });
        }

        if (!tenTL || !maMonHoc) {
            fs.unlinkSync(tempFilePath);
            await deleteFromCloudinary(cloudinaryUrl);
            return res.status(400).json({ message: 'Vui lòng cung cấp đủ tên tài liệu và mã môn học.' });
        }

        const loaiFile = path.extname(fileName || '').toLowerCase().replace('.', '') || (cloudinaryUrl.endsWith('.pdf') ? 'pdf' : 'docx');
        const isPdf = loaiFile === 'pdf';

        const pool = req.app.locals.pool;
        const [existingDocs] = await pool.execute('SELECT MaTL FROM TAILIEU WHERE FileHash = ? AND TrangThaiKiemDuyet != "TuChoi"', [fileHash]);
        if (existingDocs.length > 0) {
            fs.unlinkSync(tempFilePath);
            await deleteFromCloudinary(cloudinaryUrl);
            return res.status(400).json({ message: 'Tài liệu này đã tồn tại trên hệ thống. Xin vui lòng không re-up.' });
        }

        const fileURL = cloudinaryUrl;
        let previewURL = null;
        let textSEO = await extractTextFromFile(tempFilePath, mimeType);

        if (laTaiLieuDocQuyen && isPdf) {
            const fileBuffer = fs.readFileSync(tempFilePath);
            const previewBuffer = await generatePreviewPdf(fileBuffer);
            if (previewBuffer) {
                const previewUploadResult = await uploadToCloudinary(previewBuffer, {
                    resource_type: 'image',
                    folder: 'edushare_docs_previews',
                    format: 'pdf'
                });
                previewURL = previewUploadResult.secure_url;
            }
        }

        fs.unlinkSync(tempFilePath);

        await pool.execute(
            `INSERT INTO TAILIEU (TenTL, MoTa, FileURL, PreviewURL, LoaiFile, MaMonHoc, MaND_NguoiDang, TrangThaiKiemDuyet, LaTaiLieuChinhThuc, LaTaiLieuDocQuyen, GiaXu, FileHash, TextSEO) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'ChoDuyet', ?, ?, ?, ?, ?)`,
            [tenTL, moTa || null, fileURL, previewURL, loaiFile, maMonHoc, req.user.MaND, laTaiLieuChinhThuc, laTaiLieuDocQuyen, giaXu, fileHash, textSEO || null]
        );

        await notifyActiveAdmins(
            pool,
            `Có tài liệu mới chờ kiểm duyệt: "${tenTL}".`,
            '../admin/adminModeration.html',
            req.user.MaND
        );

        res.status(200).json({ message: 'Tải lên tài liệu thành công.', fileURL });
    } catch (dbErr) {
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
        await deleteFromCloudinary(cloudinaryUrl);
        console.error('Lỗi khi tải lên hoặc lưu DB:', dbErr);
        res.status(500).json({ message: 'Lỗi máy chủ khi xử lý tài liệu.' });
    }
});


router.get('/recommended', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const limit = 4;
        const maND = req.user.MaND;

        const selectClause = `
            SELECT 
                TL.MaTL, TL.TenTL, TL.MoTa, TL.FileURL, TL.PreviewURL, TL.LoaiFile, 
                TL.SoLuotTai, TL.NgayDang, TL.LaTaiLieuChinhThuc, TL.MaND_NguoiDang,
                TL.LaTaiLieuDocQuyen, TL.GiaXu,
                ND.HoTen AS TenNguoiDang, ND.AvatarURL,
                COALESCE(MH.TenMonHoc, 'Không xác định') AS TenMonHoc,
                COALESCE((SELECT ROUND(AVG(SoSao), 1) FROM DANHGIA WHERE MaTL = TL.MaTL), 0) AS DiemDanhGia
            FROM TAILIEU TL
            JOIN NGUOIDUNG ND ON TL.MaND_NguoiDang = ND.MaND
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            WHERE TL.TrangThaiKiemDuyet = 'DaDuyet' AND TL.IsDeleted = FALSE
              AND TL.MaTL NOT IN (SELECT MaTL FROM LICH_SU_TAI WHERE MaND = ?)
        `;

        const colabSql = selectClause + `
            AND TL.MaTL IN (
                SELECT MaTL FROM LICH_SU_TAI 
                WHERE MaND IN (
                    SELECT MaND FROM (
                        SELECT DISTINCT L2.MaND FROM LICH_SU_TAI L2 
                        WHERE L2.MaTL IN (SELECT L3.MaTL FROM LICH_SU_TAI L3 WHERE L3.MaND = ?)
                          AND L2.MaND != ?
                    ) AS SimilarUsers
                )
            )
            ORDER BY TL.SoLuotTai DESC
            LIMIT ?
        `;

        let [recommendedDocs] = await pool.execute(colabSql, [maND, maND, maND, limit.toString()]);

        if (recommendedDocs.length < limit) {
            const currentIds = recommendedDocs.map(d => d.MaTL);
            let notInClause = '';
            let params = [maND, maND];

            if (currentIds.length > 0) {
                notInClause = ` AND TL.MaTL NOT IN (${currentIds.map(() => '?').join(',')})`;
                params.push(...currentIds);
            }
            params.push((limit - recommendedDocs.length).toString());

            const contentSql = selectClause + notInClause + `
                AND TL.MaMonHoc IN (
                    SELECT MaMonHoc FROM (
                        SELECT T.MaMonHoc, COUNT(*) as count
                        FROM LICH_SU_TAI L
                        JOIN TAILIEU T ON L.MaTL = T.MaTL
                        WHERE L.MaND = ? AND T.MaMonHoc IS NOT NULL
                        GROUP BY T.MaMonHoc
                        ORDER BY count DESC
                        LIMIT 3
                    ) AS TopSubjects
                )
                ORDER BY DiemDanhGia DESC, TL.SoLuotTai DESC
                LIMIT ?
            `;
            const [contentDocs] = await pool.execute(contentSql, params);
            recommendedDocs = [...recommendedDocs, ...contentDocs];
        }

        if (recommendedDocs.length < limit) {
            const currentIds = recommendedDocs.map(d => d.MaTL);
            let notInClause = '';
            let params = [maND];

            if (currentIds.length > 0) {
                notInClause = ` AND TL.MaTL NOT IN (${currentIds.map(() => '?').join(',')})`;
                params.push(...currentIds);
            }
            params.push((limit - recommendedDocs.length).toString());

            const fallbackSql = selectClause + notInClause + `
                ORDER BY DiemDanhGia DESC, TL.SoLuotTai DESC
                LIMIT ?
            `;
            const [fallbackDocs] = await pool.execute(fallbackSql, params);
            recommendedDocs = [...recommendedDocs, ...fallbackDocs];
        }

        res.status(200).json({ documents: recommendedDocs });
    } catch (error) {
        console.error('Lỗi khi gợi ý tài liệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy gợi ý.' });
    }
});

router.get('/search', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        let { tuKhoa, maMonHoc, loaiFile, sapXep, trang, limit: queryLimit, capHoc, nguoiDang, tuNgay, denNgay, chinhThuc } = req.query;
        if (tuKhoa) tuKhoa = xss(tuKhoa);


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
        let whereClause = ` WHERE TL.TrangThaiKiemDuyet = 'DaDuyet' AND TL.IsDeleted = FALSE`;

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
            orderClause = ` ORDER BY TL.LaTaiLieuDocQuyen DESC, TL.SoLuotTai DESC, TL.MaTL DESC`;
        } else if (sapXep === 'NoiBat') {
            orderClause = ` ORDER BY TL.LaTaiLieuDocQuyen DESC, DiemDanhGia DESC, TL.SoLuotTai DESC, TL.MaTL DESC`;
        } else if (sapXep === 'Relevance' && booleanSearchQuery) {
            orderClause = ` ORDER BY TL.LaTaiLieuDocQuyen DESC, score DESC, TL.MaTL DESC`;
        } else {
            orderClause = ` ORDER BY TL.LaTaiLieuDocQuyen DESC, TL.MaTL DESC`;
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
             WHERE MaTL = ? AND TrangThaiKiemDuyet = 'DaDuyet'`,
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
            WHERE TL.TrangThaiKiemDuyet = 'DaDuyet' AND TL.IsDeleted = FALSE
              AND TL.MaTL <> ?
              AND (TL.MaMonHoc <=> ? OR TL.LoaiFile = ?)
            GROUP BY
                TL.MaTL, TL.TenTL, TL.MoTa, TL.FileURL, TL.PreviewURL, TL.LoaiFile,
                TL.SoLuotTai, TL.SoLuotXem, TL.NgayDang, TL.LaTaiLieuChinhThuc,
                TL.MaND_NguoiDang, ND.HoTen, ND.AvatarURL, MH.TenMonHoc
            ORDER BY
                CASE WHEN TL.MaMonHoc <=> ? THEN 0 ELSE 1 END,
                CASE WHEN TL.LoaiFile = ? THEN 0 ELSE 1 END,
                TL.LaTaiLieuChinhThuc DESC,
                DiemDanhGia DESC,
                TL.SoLuotTai DESC,
                TL.NgayDang DESC
            LIMIT ${limit}
        `, [maTL, currentDoc.MaMonHoc, currentDoc.LoaiFile, currentDoc.MaMonHoc, currentDoc.LoaiFile]);

        res.status(200).json({ documents: relatedDocs });
    } catch (error) {
        console.error('Lỗi khi lấy tài liệu liên quan:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy tài liệu liên quan.' });
    }
});

router.get('/:maTL/related-groups', async (req, res) => {
    const maTL = req.params.maTL;
    
    try {
        const pool = req.app.locals.pool;

        const [currentRows] = await pool.execute(
            `SELECT MaMonHoc, MaND_NguoiDang
             FROM TAILIEU
             WHERE MaTL = ? AND TrangThaiKiemDuyet = 'DaDuyet'`,
            [maTL]
        );

        if (currentRows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
        }

        const { MaMonHoc, MaND_NguoiDang } = currentRows[0];

        const [groups] = await pool.execute(`
            SELECT 
                N.MaNhom, N.TenNhom, N.AnhBia, N.IsPrivate,
                COUNT(TN.MaND) AS SoThanhVien
            FROM NHOM N
            LEFT JOIN THANHVIEN_NHOM TN ON N.MaNhom = TN.MaNhom
            WHERE N.IsPrivate = FALSE 
              AND (N.MaMonHoc = ? OR N.MaND_QuanTri = ?)
            GROUP BY N.MaNhom, N.TenNhom, N.AnhBia, N.IsPrivate
            ORDER BY 
                CASE WHEN N.MaMonHoc = ? THEN 0 ELSE 1 END,
                SoThanhVien DESC
            LIMIT 3
        `, [MaMonHoc, MaND_NguoiDang, MaMonHoc]);

        res.status(200).json({ groups });
    } catch (error) {
        console.error('Lỗi khi lấy nhóm liên quan:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy nhóm liên quan.' });
    }
});

router.get('/feed', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.MaND;
        const limit = parseInt(req.query.limit) || 4;

        const pool = req.app.locals.pool;
        const [docs] = await pool.execute(`
            SELECT 
                TL.MaTL, TL.TenTL, TL.LoaiFile, TL.GiaXu, 
                TL.SoLuotXem, TL.SoLuotTai, TL.NgayDang, 
                TL.LaTaiLieuChinhThuc, TL.LaTaiLieuDocQuyen,
                MH.TenMonHoc, 
                ND.HoTen as TenNguoiDang, ND.AvatarURL, ND.MaND as MaND_NguoiDang,
                COALESCE(AVG(DG.SoSao), 0) as DiemDanhGia
            FROM TAILIEU TL
            INNER JOIN THEODOI TD ON TL.MaND_NguoiDang = TD.MaND_DuocTheoDoi
            JOIN NGUOIDUNG ND ON TL.MaND_NguoiDang = ND.MaND
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            LEFT JOIN DANHGIA DG ON TL.MaTL = DG.MaTL
            WHERE TD.MaND_TheoDoi = ${userId} AND TL.TrangThaiKiemDuyet = 'DaDuyet' AND TL.IsDeleted = FALSE
            GROUP BY TL.MaTL
            ORDER BY TL.NgayDang DESC
            LIMIT ${limit}
        `);

        res.status(200).json({ documents: docs });
    } catch (error) {
        console.error('Lỗi API /documents/feed:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy bảng tin.' });
    }
});

const viewTracker = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of viewTracker.entries()) {
        if (now - timestamp > 3600000) {
            viewTracker.delete(key);
        }
    }
}, 3600000);

router.get('/:maTL', async (req, res) => {
    const maTL = req.params.maTL;
    try {
        const pool = req.app.locals.pool;

        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const trackKey = `${clientIp}_${maTL}`;

        if (!viewTracker.has(trackKey)) {
            await pool.execute('UPDATE TAILIEU SET SoLuotXem = SoLuotXem + 1 WHERE MaTL = ? AND TrangThaiKiemDuyet = "DaDuyet"', [maTL]);
            viewTracker.set(trackKey, Date.now());
        }

        const [rows] = await pool.execute(`
            SELECT TL.*, ND.HoTen AS TenNguoiDang, ND.AvatarURL, COALESCE(MH.TenMonHoc, 'Không xác định') AS TenMonHoc,
                   COALESCE((SELECT AVG(SoSao) FROM DANHGIA WHERE MaTL = TL.MaTL), 0) AS DiemDanhGia,
                   (SELECT COUNT(*) FROM DANHGIA WHERE MaTL = TL.MaTL) AS SoDanhGia
            FROM TAILIEU TL
            JOIN NGUOIDUNG ND ON TL.MaND_NguoiDang = ND.MaND
            LEFT JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
            WHERE TL.MaTL = ? AND TL.TrangThaiKiemDuyet = 'DaDuyet'
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
            ORDER BY BL.DaGhim DESC, BL.NgayBinhLuan ASC
        `, [maTL]);

        let isBookmarked = false;
        let hasRated = false;
        let hasDownloaded = false;
        let hasPurchased = false;
        let canViewFullDoc = false;
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

                if (decoded.VaiTro === 'Admin' || decoded.VaiTro === 'GiaoVien' || taiLieu.MaND_NguoiDang === decoded.MaND) {
                    canViewFullDoc = true;
                }
            } catch (e) {

            }
        }

        if (taiLieu.IsDeleted && !hasPurchased && !canViewFullDoc) {
            return res.status(404).json({ message: 'Tài liệu này đã bị gỡ khỏi hệ thống.' });
        }

        if (taiLieu.LaTaiLieuDocQuyen && !hasPurchased && !canViewFullDoc) {
            taiLieu.FileURL = null;
        }

        res.status(200).json({ document: taiLieu, comments, isBookmarked, hasRated, hasDownloaded, hasPurchased });
    } catch (error) {
        console.error('Lỗi khi lấy chi tiết tài liệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.get('/:maTL/download', authMiddleware, downloadLimiter, async (req, res) => {
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
        } else if (req.user.VaiTro === 'Admin' || req.user.VaiTro === 'GiaoVien') {
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

        if (doc.LaTaiLieuDocQuyen && doc.MaND_NguoiDang !== maND && req.user.VaiTro !== 'Admin' && req.user.VaiTro !== 'GiaoVien') {
            const [purchaseRows] = await pool.execute('SELECT 1 FROM TAILIEU_DAMUA WHERE MaTL = ? AND MaND = ?', [maTL, maND]);
            if (purchaseRows.length === 0) {
                return res.status(403).json({ message: 'Bạn cần mở khoá tài liệu PREMIUM này trước khi tải.' });
            }
        }


        const fileName = `Tailieu_${doc.MaTL}.${doc.LoaiFile}`;
        res.setHeader('X-Download-Filename', encodeURIComponent(fileName));
        res.setHeader('Access-Control-Expose-Headers', 'X-Download-Filename');

        const updateDownloadHistory = async () => {
            const connection = await pool.getConnection();
            await connection.beginTransaction();
            try {
                const [historyRows] = await connection.execute('SELECT 1 FROM LICH_SU_TAI WHERE MaND = ? AND MaTL = ?', [maND, maTL]);
                if (historyRows.length === 0) {
                    await connection.execute('INSERT INTO LICH_SU_TAI (MaND, MaTL) VALUES (?, ?)', [maND, maTL]);
                    await connection.execute('UPDATE TAILIEU SET SoLuotTai = SoLuotTai + 1 WHERE MaTL = ?', [maTL]);

                    if (!doc.LaTaiLieuDocQuyen && doc.MaND_NguoiDang !== maND) {
                        const maxDailyReward = 5;
                        const [todayRewards] = await connection.execute(
                            `SELECT COUNT(*) as count FROM LICH_SU_XU 
                             WHERE MaND = ? AND LoaiGiaoDich = 'ThuongXu' AND DATE(NgayTao) = CURDATE()`,
                            [doc.MaND_NguoiDang]
                        );

                        if (todayRewards[0].count < maxDailyReward) {
                            await connection.execute('UPDATE NGUOIDUNG SET SoDuXu = SoDuXu + 1 WHERE MaND = ?', [doc.MaND_NguoiDang]);
                            await connection.execute(
                                "INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, 'ThuongXu', 1, ?)",
                                [doc.MaND_NguoiDang, `Thưởng 1 Xu vì có người tải tài liệu: ${doc.TenTL}`]
                            );
                            await connection.execute(
                                "INSERT INTO THONGBAO (MaND, NoiDung, LoaiTB) VALUES (?, ?, 'HeThong')",
                                [doc.MaND_NguoiDang, `Bạn vừa nhận được +1 Xu từ lượt tải tài liệu "${doc.TenTL}". (Giới hạn: ${todayRewards[0].count + 1}/${maxDailyReward} Xu thưởng mỗi ngày)`]
                            );
                        }
                    }
                }
                await connection.commit();
            } catch (dbErr) {
                await connection.rollback();
                console.error('Lỗi khi cập nhật lịch sử tải:', dbErr);
            } finally {
                connection.release();
            }
        };

        if (doc.FileURL.startsWith('http')) {
            await updateDownloadHistory();
            let downloadUrl = doc.FileURL;

            if (doc.LoaiFile && doc.LoaiFile.toLowerCase() === 'pdf') {
                https.get(downloadUrl, (fileResponse) => {
                    const chunks = [];
                    fileResponse.on('data', chunk => chunks.push(chunk));
                    fileResponse.on('end', async () => {
                        try {
                            const pdfBuffer = Buffer.concat(chunks);
                            const pdfDoc = await PDFDocument.load(pdfBuffer);
                            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                            const pages = pdfDoc.getPages();

                            for (const page of pages) {
                                const { width, height } = page.getSize();
                                page.drawText('EduShare', {
                                    x: width / 2 - 100,
                                    y: height / 2,
                                    size: 50,
                                    font: font,
                                    color: rgb(0.75, 0.75, 0.75),
                                    opacity: 0.3,
                                    rotate: degrees(-45),
                                });
                            }

                            const pdfBytes = await pdfDoc.save();
                            res.type('pdf');
                            res.send(Buffer.from(pdfBytes));
                        } catch (err) {
                            console.error('Lỗi đóng dấu watermark:', err);
                            res.status(500).json({ message: 'Lỗi khi xử lý file PDF.' });
                        }
                    });
                    fileResponse.on('error', (err) => {
                        console.error('Lỗi tải từ Cloudinary:', err);
                        if (!res.headersSent) res.status(500).json({ message: 'Không thể tải file từ máy chủ.' });
                    });
                }).on('error', (err) => {
                    console.error('Lỗi tải từ Cloudinary:', err);
                    if (!res.headersSent) res.status(500).json({ message: 'Không thể tải file từ máy chủ.' });
                });
            } else {
                if (downloadUrl.includes('/upload/')) {
                    downloadUrl = downloadUrl.replace('/upload/', '/upload/fl_attachment/');
                }
                https.get(downloadUrl, (fileStream) => {
                    fileStream.pipe(res);
                }).on('error', (err) => {
                    console.error('Lỗi khi tải file từ Cloudinary:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ message: 'Không thể tải file từ máy chủ.' });
                    }
                });
            }
            return;
        }

        const filePath = path.join(__dirname, 'public', doc.FileURL);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Không tìm thấy file vật lý trên máy chủ.' });
        }

        if (doc.LoaiFile && doc.LoaiFile.toLowerCase() === 'pdf') {
            try {
                const pdfBuffer = fs.readFileSync(filePath);
                const pdfDoc = await PDFDocument.load(pdfBuffer);
                const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                const pages = pdfDoc.getPages();

                for (const page of pages) {
                    const { width, height } = page.getSize();
                    page.drawText('EduShare', {
                        x: width / 2 - 100,
                        y: height / 2,
                        size: 50,
                        font: font,
                        color: rgb(0.75, 0.75, 0.75),
                        opacity: 0.3,
                        rotate: degrees(-45),
                    });
                }

                const pdfBytes = await pdfDoc.save();
                res.type('pdf');
                res.send(Buffer.from(pdfBytes));
                await updateDownloadHistory();
            } catch (err) {
                console.error('Lỗi đóng dấu watermark local:', err);
                if (!res.headersSent) res.status(500).json({ message: 'Lỗi xử lý file PDF.' });
            }
        } else {
            res.type(path.extname(filePath));
            res.sendFile(filePath, async (err) => {
                if (!err) {
                    await updateDownloadHistory();
                } else {
                    console.error('Lỗi hoặc gián đoạn khi gửi file:', err);
                }
            });
        }

    } catch (error) {
        console.error('Lỗi khi tải tài liệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.post('/:maTL/buy', authMiddleware, async (req, res) => {
    const maTL = req.params.maTL;
    const maND = req.user.MaND;

    try {
        const pool = req.app.locals.pool;

        const [docs] = await pool.execute('SELECT MaND_NguoiDang, GiaXu, LaTaiLieuDocQuyen, TenTL FROM TAILIEU WHERE MaTL = ? AND TrangThaiKiemDuyet = "DaDuyet" AND IsDeleted = FALSE', [maTL]);
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu PREMIUM.' });
        }

        const doc = docs[0];
        if (!doc.LaTaiLieuDocQuyen) {
            return res.status(400).json({ message: 'Đây không phải là tài liệu Premium.' });
        }

        if (doc.MaND_NguoiDang === maND) {
            return res.status(400).json({ message: 'Bạn không thể mua tài liệu của chính mình.' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const [purchaseRows] = await connection.execute('SELECT 1 FROM TAILIEU_DAMUA WHERE MaTL = ? AND MaND = ? FOR UPDATE', [maTL, maND]);
            if (purchaseRows.length > 0) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ message: 'Bạn đã mua tài liệu này rồi.' });
            }

            const [userRows] = await connection.execute('SELECT SoDuXu FROM NGUOIDUNG WHERE MaND = ? FOR UPDATE', [maND]);
            if (userRows.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ message: 'Người dùng không tồn tại.' });
            }

            const soDuXu = userRows[0].SoDuXu;
            const giaXu = doc.GiaXu || 0;

            if (soDuXu < giaXu) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ message: 'Số dư Xu không đủ. Vui lòng nạp thêm.' });
            }

            await connection.execute('UPDATE NGUOIDUNG SET SoDuXu = SoDuXu - ? WHERE MaND = ?', [giaXu, maND]);
            await connection.execute('UPDATE NGUOIDUNG SET SoDuXu = SoDuXu + ? WHERE MaND = ?', [giaXu, doc.MaND_NguoiDang]);

            await connection.execute('INSERT INTO TAILIEU_DAMUA (MaND, MaTL, GiaXuThoiDiemMua) VALUES (?, ?, ?)', [maND, maTL, giaXu]);

            await connection.execute(
                'INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, ?, ?, ?)',
                [maND, 'MuaTaiLieu', -giaXu, `Mua tài liệu: ${doc.TenTL}`]
            );

            await connection.execute(
                'INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, ?, ?, ?)',
                [doc.MaND_NguoiDang, 'BanTaiLieu', giaXu, `Bán tài liệu: ${doc.TenTL}`]
            );

            await connection.execute(
                'INSERT INTO THONGBAO (MaND, NoiDung, LoaiTB) VALUES (?, ?, ?)',
                [doc.MaND_NguoiDang, `Bạn vừa nhận được ${giaXu} Xu từ do có người vừa mua tài liệu "${doc.TenTL}".`, 'HeThong']
            );

            await connection.commit();
            connection.release();

            const { sendNotificationToUser } = require('./services/socket');
            sendNotificationToUser(doc.MaND_NguoiDang, 'document_bought', {
                message: `Bạn vừa nhận được ${giaXu} Xu do có người mua tài liệu "${doc.TenTL}".`
            });

            res.status(200).json({ message: 'Mua tài liệu thành công!' });
        } catch (dbErr) {
            await connection.rollback();
            connection.release();
            throw dbErr;
        }
    } catch (error) {
        console.error('Lỗi khi mua tài liệu:', error);
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

        const [docs] = await pool.execute('SELECT 1 FROM TAILIEU WHERE MaTL = ? AND TrangThaiKiemDuyet = "DaDuyet"', [maTL]);
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


router.post('/:maTL/comments', authMiddleware, commentLimiter, moderationMiddleware(['noiDung']), async (req, res) => {
    const maTL = req.params.maTL;
    const maND = req.user.MaND;
    let { noiDung, maBL_Cha } = req.body;
    noiDung = xss(noiDung);

    if (!noiDung || noiDung.trim() === '' || noiDung.length > 1000) {
        return res.status(400).json({ message: 'Nội dung bình luận không hợp lệ (1-1000 ký tự).' });
    }

    try {
        const pool = req.app.locals.pool;

        const [docs] = await pool.execute('SELECT 1 FROM TAILIEU WHERE MaTL = ? AND TrangThaiKiemDuyet = "DaDuyet"', [maTL]);
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

        const mentionRegex = /@\[(.*?)\]\((\d+)\)/g;
        let match;
        const taggedUserIds = new Set();
        while ((match = mentionRegex.exec(noiDung)) !== null) {
            taggedUserIds.add(parseInt(match[2]));
        }

        if (taggedUserIds.size > 0) {
            const [currentUserRows] = await pool.execute('SELECT HoTen FROM NGUOIDUNG WHERE MaND = ?', [maND]);
            const currentUserHoTen = currentUserRows.length > 0 ? currentUserRows[0].HoTen : 'Một người dùng';

            for (const taggedMaND of taggedUserIds) {
                if (taggedMaND !== maND) {
                    await pool.execute(
                        'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                        [taggedMaND, 'NhacDen', `${currentUserHoTen} đã nhắc đến bạn trong một bình luận.`, `../document/documentDetails.html?id=${maTL}`]
                    );
                }
            }
        }

        const [newCommentRows] = await pool.execute(`
            SELECT BL.MaBL, BL.NoiDung, BL.NgayBinhLuan, BL.DaChinhSua, BL.Ghim, BL.MaBL_Cha,
                   ND.MaND, ND.HoTen, ND.AvatarURL, ND.Role
            FROM BINHLUAN BL
            JOIN NGUOIDUNG ND ON BL.MaND = ND.MaND
            WHERE BL.MaBL = ?
        `, [result.insertId]);

        if (newCommentRows.length > 0) {
            const io = req.app.get('io');
            if (io) {
                io.to(`document_${maTL}`).emit('new_document_comment', newCommentRows[0]);
            }
        }

        res.status(201).json({ message: 'Bình luận thành công.', maBL: result.insertId, comment: newCommentRows[0] });
    } catch (error) {
        console.error('Lỗi comment:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.delete('/comments/:maBL', authMiddleware, async (req, res) => {
    const maBL = req.params.maBL;
    const maND = req.user.MaND;

    try {
        const pool = req.app.locals.pool;

        const [rows] = await pool.execute(`
            SELECT B.MaND AS CommentOwner, T.MaND_NguoiDang AS DocOwner 
            FROM BINHLUAN B 
            JOIN TAILIEU T ON B.MaTL = T.MaTL 
            WHERE B.MaBL = ?
        `, [maBL]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy bình luận.' });
        }

        const { CommentOwner, DocOwner } = rows[0];

        if (CommentOwner !== maND && DocOwner !== maND && req.user.VaiTro !== 'Admin') {
            return res.status(403).json({ message: 'Bạn không có quyền xóa bình luận này.' });
        }

        await pool.execute('DELETE FROM BINHLUAN WHERE MaBL_Cha = ?', [maBL]);
        await pool.execute('DELETE FROM BINHLUAN WHERE MaBL = ?', [maBL]);

        res.status(200).json({ message: 'Đã xóa bình luận.' });
    } catch (error) {
        console.error('Lỗi xóa bình luận:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/comments/:maBL/pin', authMiddleware, async (req, res) => {
    const maBL = req.params.maBL;
    const maND = req.user.MaND;

    try {
        const pool = req.app.locals.pool;

        const [rows] = await pool.execute(`
            SELECT B.MaTL, B.DaGhim, T.MaND_NguoiDang AS DocOwner 
            FROM BINHLUAN B 
            JOIN TAILIEU T ON B.MaTL = T.MaTL 
            WHERE B.MaBL = ?
        `, [maBL]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy bình luận.' });
        }

        if (rows[0].DocOwner !== maND && req.user.VaiTro !== 'Admin') {
            return res.status(403).json({ message: 'Chỉ tác giả tài liệu mới có quyền ghim bình luận.' });
        }

        const newPinState = rows[0].DaGhim ? false : true;
        await pool.execute('UPDATE BINHLUAN SET DaGhim = ? WHERE MaBL = ?', [newPinState, maBL]);

        res.status(200).json({ message: newPinState ? 'Đã ghim bình luận.' : 'Đã bỏ ghim bình luận.', DaGhim: newPinState });
    } catch (error) {
        console.error('Lỗi ghim bình luận:', error);
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

        const [docs] = await pool.execute('SELECT TenTL, MaND_NguoiDang FROM TAILIEU WHERE MaTL = ?', [maTL]);
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

        const [reportCount] = await pool.execute(
            'SELECT COUNT(*) as count FROM BAOCAOVIPHAM WHERE MaTL = ? AND TrangThai = "ChoXuLy"',
            [maTL]
        );

        const [settingRows] = await pool.execute('SELECT GiaTri FROM CAUHINH_HETHONG WHERE TenCauHinh = "MAX_REPORTS_AUTO_HIDE"');
        const MAX_REPORTS_AUTO_HIDE = settingRows.length > 0 ? parseInt(settingRows[0].GiaTri, 10) : 5;

        if (reportCount[0].count >= MAX_REPORTS_AUTO_HIDE) {
            await pool.execute(
                'UPDATE TAILIEU SET TrangThaiKiemDuyet = "ChoDuyet" WHERE MaTL = ?',
                [maTL]
            );
            await notifyActiveAdmins(
                pool,
                `Tài liệu "${docs[0].TenTL}" đã bị tạm ẩn do có quá nhiều báo cáo vi phạm. Vui lòng kiểm tra.`,
                '../admin/adminViolationReports.html',
                maND
            );
            
            await pool.execute(
                'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                [docs[0].MaND_NguoiDang, 'HeThong', `Tài liệu "${docs[0].TenTL}" của bạn đã bị tạm ẩn do nhận được quá nhiều báo cáo vi phạm từ cộng đồng. Admin sẽ kiểm tra lại.`, `../document/myDocuments.html`]
            );
        } else {
            await notifyActiveAdmins(
                pool,
                `Có báo cáo vi phạm mới cho tài liệu: "${docs[0].TenTL}".`,
                '../admin/adminViolationReports.html',
                maND
            );
        }

        res.status(201).json({ message: 'Đã gửi báo cáo vi phạm.' });
    } catch (error) {
        console.error('Lỗi report:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.put('/:maTL/file', authMiddleware, upload.none(), async (req, res) => {
    const { cloudinaryUrl, publicId, mimeType, fileName } = req.body;
    
    if (!cloudinaryUrl) {
        return res.status(400).json({ message: 'Vui lòng cung cấp URL file mới.' });
    }

    const maTL = req.params.maTL;
    const maND = req.user.MaND;
    const tempFilePath = path.join(os.tmpdir(), `temp_${Date.now()}_update_${publicId.replace(/\//g, '_')}`);

    try {
        const pool = req.app.locals.pool;

        const [docs] = await pool.execute('SELECT MaND_NguoiDang, TrangThaiKiemDuyet, FileURL FROM TAILIEU WHERE MaTL = ?', [maTL]);
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
        }

        if (docs[0].MaND_NguoiDang !== maND && req.user.VaiTro !== 'Admin') {
            return res.status(403).json({ message: 'Bạn không có quyền sửa tài liệu này.' });
        }

        await downloadFile(cloudinaryUrl, tempFilePath);

        const loaiFile = path.extname(fileName || '').toLowerCase().replace('.', '') || (cloudinaryUrl.endsWith('.pdf') ? 'pdf' : 'docx');
        const fileURL = cloudinaryUrl;
        let previewURL = null;
        let textSEO = await extractTextFromFile(tempFilePath, mimeType);

        const fileHash = await getFileHash(tempFilePath);
        
        const virusScanResult = await scanFileVirus(fileHash);
        if (!virusScanResult.safe) {
            fs.unlinkSync(tempFilePath);
            await deleteFromCloudinary(cloudinaryUrl);
            return res.status(400).json({ message: virusScanResult.message });
        }

        const [existingDocs] = await pool.execute('SELECT MaTL FROM TAILIEU WHERE FileHash = ? AND MaTL != ? AND TrangThaiKiemDuyet != "TuChoi"', [fileHash, maTL]);
        if (existingDocs.length > 0) {
            fs.unlinkSync(tempFilePath);
            await deleteFromCloudinary(cloudinaryUrl);
            return res.status(400).json({ message: 'Tài liệu này đã tồn tại trên hệ thống. Xin vui lòng không re-up.' });
        }

        await pool.execute(
            'UPDATE TAILIEU SET FileURL = ?, PreviewURL = ?, LoaiFile = ?, FileHash = ?, TextSEO = ?, TrangThaiKiemDuyet = "ChoDuyet" WHERE MaTL = ?',
            [fileURL, previewURL, loaiFile, fileHash, textSEO || null, maTL]
        );

        try {
            if (docs[0].FileURL && docs[0].FileURL.startsWith('/uploads/')) {
                const oldFilePath = path.join(__dirname, 'public', docs[0].FileURL);
                if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
            } else if (docs[0].FileURL && docs[0].FileURL.includes('cloudinary.com')) {
                await deleteFromCloudinary(docs[0].FileURL);
            }
        } catch (e) {
            console.error('Lỗi xóa file cũ:', e);
        }

        fs.unlinkSync(tempFilePath);
        res.status(200).json({ message: 'Cập nhật file thành công. Tài liệu đang chờ duyệt lại.' });
    } catch (error) {
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
        await deleteFromCloudinary(cloudinaryUrl);
        console.error('Lỗi cập nhật file tài liệu:', error);
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

router.put('/:maTL', authMiddleware, upload.none(), async (req, res) => {
    const maTL = req.params.maTL;
    const maND = req.user.MaND;
    const tenTL = xss(req.body.tenTL);
    const moTa = req.body.moTa ? xss(req.body.moTa) : null;
    const maMonHoc = req.body.maMonHoc;
    const giaXu = req.body.giaXu;
    const { cloudinaryUrl, publicId, mimeType, fileName } = req.body;

    if (!tenTL || !maMonHoc) {
        return res.status(400).json({ message: 'Vui lòng cung cấp đủ tên tài liệu và mã môn học.' });
    }

    let parsedGiaXu = null;
    if (giaXu !== undefined && giaXu !== null) {
        parsedGiaXu = parseInt(giaXu);
        if (isNaN(parsedGiaXu) || parsedGiaXu < 0 || parsedGiaXu > 1000000) {
            return res.status(400).json({ message: 'Giá Xu không hợp lệ. Phải từ 0 đến 1,000,000.' });
        }
    }

    let tempFilePath = null;

    try {
        const pool = req.app.locals.pool;

        const [docs] = await pool.execute('SELECT MaND_NguoiDang, TrangThaiKiemDuyet, FileURL, LaTaiLieuDocQuyen FROM TAILIEU WHERE MaTL = ?', [maTL]);
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
        }

        if (docs[0].MaND_NguoiDang !== maND && req.user.VaiTro !== 'Admin') {
            return res.status(403).json({ message: 'Bạn không có quyền sửa tài liệu này.' });
        }

        if (cloudinaryUrl) {
            tempFilePath = path.join(os.tmpdir(), `temp_${Date.now()}_update2_${publicId.replace(/\//g, '_')}`);
            await downloadFile(cloudinaryUrl, tempFilePath);

            const loaiFile = path.extname(fileName || '').toLowerCase().replace('.', '') || (cloudinaryUrl.endsWith('.pdf') ? 'pdf' : 'docx');
            const isPdf = loaiFile === 'pdf';
            const fileURL = cloudinaryUrl;
            let previewURL = null;
            let textSEO = await extractTextFromFile(tempFilePath, mimeType);
            const fileHash = await getFileHash(tempFilePath);
            
            const virusScanResult = await scanFileVirus(fileHash);
            if (!virusScanResult.safe) {
                fs.unlinkSync(tempFilePath);
                await deleteFromCloudinary(cloudinaryUrl);
                return res.status(400).json({ message: virusScanResult.message });
            }

            const [existingDocs] = await pool.execute('SELECT MaTL FROM TAILIEU WHERE FileHash = ? AND MaTL != ? AND TrangThaiKiemDuyet != "TuChoi"', [fileHash, maTL]);
            if (existingDocs.length > 0) {
                fs.unlinkSync(tempFilePath);
                await deleteFromCloudinary(cloudinaryUrl);
                return res.status(400).json({ message: 'Tài liệu này đã tồn tại trên hệ thống. Xin vui lòng không re-up.' });
            }

            if (docs[0].LaTaiLieuDocQuyen && isPdf) {
                const fileBuffer = fs.readFileSync(tempFilePath);
                const previewBuffer = await generatePreviewPdf(fileBuffer);
                if (previewBuffer) {
                    const previewUploadResult = await uploadToCloudinary(previewBuffer, {
                        resource_type: 'image',
                        folder: 'edushare_docs_previews',
                        format: 'pdf'
                    });
                    previewURL = previewUploadResult.secure_url;
                }
            }

            await pool.execute(
                'UPDATE TAILIEU SET TenTL = ?, MoTa = ?, MaMonHoc = ?, GiaXu = COALESCE(?, GiaXu), FileURL = ?, PreviewURL = ?, LoaiFile = ?, FileHash = ?, TextSEO = ?, TrangThaiKiemDuyet = "ChoDuyet" WHERE MaTL = ?',
                [tenTL, moTa, maMonHoc, parsedGiaXu, fileURL, previewURL, loaiFile, fileHash, textSEO || null, maTL]
            );

            try {
                if (docs[0].FileURL && docs[0].FileURL.startsWith('/uploads/')) {
                    const oldFilePath = path.join(__dirname, 'public', docs[0].FileURL);
                    if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
                } else if (docs[0].FileURL && docs[0].FileURL.includes('cloudinary.com')) {
                    await deleteFromCloudinary(docs[0].FileURL);
                }
            } catch (e) {
                console.error('Lỗi xóa file cũ:', e);
            }
            fs.unlinkSync(tempFilePath);
        } else {
            await pool.execute(
                'UPDATE TAILIEU SET TenTL = ?, MoTa = ?, MaMonHoc = ?, GiaXu = COALESCE(?, GiaXu) WHERE MaTL = ?',
                [tenTL, moTa, maMonHoc, parsedGiaXu, maTL]
            );
        }

        res.status(200).json({ message: 'Cập nhật tài liệu thành công.' });
    } catch (error) {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
        if (cloudinaryUrl) {
            await deleteFromCloudinary(cloudinaryUrl);
        }
        console.error('Lỗi cập nhật tài liệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.put('/:id/appeal', authMiddleware, async (req, res) => {
    try {
        const docId = req.params.id;
        const userId = req.user.MaND;
        const { phanHoi } = req.body;

        if (!phanHoi || phanHoi.trim() === '') {
            return res.status(400).json({ message: 'Vui lòng nhập nội dung phản hồi.' });
        }

        const pool = req.app.locals.pool;

        const [docs] = await pool.execute(
            'SELECT TenTL, TrangThaiKiemDuyet FROM TAILIEU WHERE MaTL = ? AND MaND_NguoiDang = ?',
            [docId, userId]
        );

        if (docs.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu hoặc bạn không có quyền.' });
        }

        if (docs[0].TrangThaiKiemDuyet !== 'TuChoi') {
            return res.status(400).json({ message: 'Chỉ có thể phản hồi cho tài liệu bị từ chối.' });
        }

        await pool.execute(
            'UPDATE TAILIEU SET TrangThaiKiemDuyet = "ChoDuyet", PhanHoiTuChoi = ? WHERE MaTL = ?',
            [phanHoi.trim(), docId]
        );

        await notifyActiveAdmins(
            pool,
            `Tài liệu "${docs[0].TenTL}" vừa có phản hồi khiếu nại và đang chờ duyệt lại.`,
            `../admin/adminModeration.html`
        );

        res.status(200).json({ message: 'Gửi phản hồi thành công. Tài liệu đang chờ duyệt lại.' });
    } catch (error) {
        console.error('Lỗi khi gửi phản hồi tài liệu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


router.get('/:maTL/stream', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.query('SELECT FileURL FROM TAILIEU WHERE MaTL = ?', [req.params.maTL]);
        if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy tài liệu' });

        const fileUrl = rows[0].FileURL;
        if (!fileUrl) return res.status(404).json({ message: 'Tài liệu không có file đính kèm' });

        const path = require('path');
        const fs = require('fs');
        const filePath = path.join(__dirname, 'public', fileUrl);

        if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File không tồn tại' });

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'inline; filename="document.bin"');

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    } catch (err) {
        console.error('Lỗi stream file:', err);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
});

router.delete('/:maTL', authMiddleware, async (req, res) => {
    const maTL = req.params.maTL;
    const maND = req.user.MaND;

    try {
        const pool = req.app.locals.pool;

        const [docs] = await pool.execute('SELECT MaND_NguoiDang, IsDeleted FROM TAILIEU WHERE MaTL = ?', [maTL]);
        if (docs.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
        }

        const doc = docs[0];
        
        if (doc.MaND_NguoiDang !== maND && req.user.VaiTro !== 'Admin') {
            return res.status(403).json({ message: 'Bạn không có quyền xóa tài liệu này.' });
        }

        if (doc.IsDeleted) {
            return res.status(400).json({ message: 'Tài liệu này đã bị xóa rồi.' });
        }

        await pool.execute('UPDATE TAILIEU SET IsDeleted = TRUE WHERE MaTL = ?', [maTL]);

        res.status(200).json({ message: 'Đã xóa tài liệu (Xóa mềm).' });
    } catch (error) {
        console.error('Lỗi API DELETE /documents/:maTL:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

module.exports = router;
