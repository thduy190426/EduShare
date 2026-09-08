const express = require('express');
const router = express.Router();

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_USER,
        pass: process.env.NODEMAILER_PASS
    }
});

const { authMiddleware, superAdminMiddleware } = require('../middlewares/auth');
const { paymentLimiter } = require('../middlewares/rateLimit');

router.get('/packages', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute('SELECT MaGoi AS id, SoTien AS price, SoXu AS coins, KhuyenMai, TenGoi FROM GOI_NAP_XU WHERE TrangThai = "HoatDong" ORDER BY ThuTu ASC, SoTien ASC');
        res.status(200).json({ packages: rows });
    } catch (err) {
        console.error('Lỗi khi lấy gói nạp:', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.post('/buy-premium', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const maND = req.user.MaND;
        const price = 1000;
        const premiumDays = 30;
        const premiumQuota = 100;

        const [users] = await pool.execute('SELECT SoDuXu, Premium_Until, Premium_Quota FROM NGUOIDUNG WHERE MaND = ?', [maND]);
        if (users.length === 0) return res.status(404).json({ message: 'Người dùng không tồn tại.' });
        
        const user = users[0];
        if (user.SoDuXu < price) {
            return res.status(400).json({ message: 'Số dư xu không đủ để mua gói Premium.' });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            let newPremiumUntil;
            if (user.Premium_Until && new Date(user.Premium_Until) > new Date()) {
                newPremiumUntil = new Date(user.Premium_Until);
            } else {
                newPremiumUntil = new Date();
            }
            newPremiumUntil.setDate(newPremiumUntil.getDate() + premiumDays);
            
            const formatForMySQL = (date) => {
                return date.toISOString().slice(0, 19).replace('T', ' ');
            };
            const formattedDate = formatForMySQL(newPremiumUntil);

            await connection.execute(
                'UPDATE NGUOIDUNG SET SoDuXu = SoDuXu - ?, Premium_Until = ?, Premium_Quota = Premium_Quota + ? WHERE MaND = ?',
                [price, formattedDate, premiumQuota, maND]
            );

            await connection.execute(
                'INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, ?, ?, ?)',
                [maND, 'MuaTaiLieu', -price, `Mua gói Premium ${premiumDays} ngày`]
            );

            await connection.commit();
            res.status(200).json({ 
                message: 'Đăng ký gói Premium thành công!',
                premiumUntil: newPremiumUntil,
                premiumQuota: user.Premium_Quota + premiumQuota
            });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Lỗi khi mua gói Premium:', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/flash-sale', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute('SELECT Code, DiscountPercent, NgayHetHan FROM PROMO_CODE WHERE IsActive = TRUE AND IsFlashSale = TRUE AND (NgayHetHan IS NULL OR NgayHetHan > CURRENT_TIMESTAMP) ORDER BY NgayHetHan ASC LIMIT 1');
        if (rows.length > 0) {
            res.status(200).json(rows[0]);
        } else {
            res.status(200).json(null);
        }
    } catch (err) {
        console.error('Lỗi khi lấy flash sale:', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.post('/promos/validate', authMiddleware, async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Vui lòng nhập mã ưu đãi.' });
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute('SELECT MaPromo, DiscountPercent, IsActive, NgayHetHan FROM PROMO_CODE WHERE Code = ?', [code.trim().toUpperCase()]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Mã ưu đãi không tồn tại.' });
        }
        if (!rows[0].IsActive || (rows[0].NgayHetHan && new Date(rows[0].NgayHetHan) < new Date())) {
            return res.status(400).json({ message: 'Mã ưu đãi đã hết hạn hoặc bị vô hiệu hóa.' });
        }
        const [used] = await pool.execute('SELECT MaGD FROM GIAODICH_NAPXU WHERE MaND = ? AND MaPromo = ? AND TrangThai = "DaDuyet"', [req.user.MaND, rows[0].MaPromo]);
        if (used.length > 0) {
            return res.status(400).json({ message: 'Bạn đã sử dụng mã khuyến mãi này trước đó, mỗi mã chỉ dùng được 1 lần.' });
        }
        res.status(200).json({ discountPercent: rows[0].DiscountPercent });
    } catch (err) {
        console.error('Lỗi khi validate promo code:', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
router.post('/create', authMiddleware, paymentLimiter, async (req, res) => {
    const { packageId, promoCode } = req.body;
    const userId = req.user.MaND;
    const idempotencyKey = req.headers['x-idempotency-key'];

    try {
        const pool = req.app.locals.pool;

        if (idempotencyKey) {
            try {
                await pool.execute('INSERT INTO IDEMPOTENCY_KEYS (IdempotencyKey, MaND, ApiEndpoint) VALUES (?, ?, ?)', [idempotencyKey, userId, req.originalUrl]);
            } catch (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ message: 'Giao dịch đang được xử lý hoặc đã hoàn tất. Vui lòng không gửi lại.' });
                }
                throw err;
            }
        }

        const [pkgRows] = await pool.execute('SELECT SoTien, SoXu FROM GOI_NAP_XU WHERE MaGoi = ? AND TrangThai = "HoatDong"', [packageId]);
        if (pkgRows.length === 0) {
            return res.status(400).json({ message: 'Gói nạp không hợp lệ hoặc đã bị ẩn.' });
        }
        const amount = pkgRows[0].SoTien;
        let coins = pkgRows[0].SoXu;
        let maPromo = null;
        if (promoCode) {
            const [promoRows] = await pool.execute('SELECT MaPromo, DiscountPercent, IsActive, NgayHetHan FROM PROMO_CODE WHERE Code = ?', [promoCode.trim().toUpperCase()]);
            if (promoRows.length > 0 && promoRows[0].IsActive && (!promoRows[0].NgayHetHan || new Date(promoRows[0].NgayHetHan) >= new Date())) {
                maPromo = promoRows[0].MaPromo;
                const [used] = await pool.execute('SELECT MaGD FROM GIAODICH_NAPXU WHERE MaND = ? AND MaPromo = ? AND TrangThai = "DaDuyet"', [userId, maPromo]);
                if (used.length > 0) {
                    return res.status(400).json({ message: 'Bạn đã sử dụng mã khuyến mãi này trước đó.' });
                }
                coins = Math.floor(coins * (1 + promoRows[0].DiscountPercent / 100));
            }
        }
        const [pendingTx] = await pool.execute(
            'SELECT MaGD FROM GIAODICH_NAPXU WHERE MaND = ? AND TrangThai = ?',
            [userId, 'ChoDuyet']
        );
        let maGD;
        if (pendingTx.length > 0) {
            maGD = pendingTx[0].MaGD;
            await pool.execute(
                'UPDATE GIAODICH_NAPXU SET SoTien = ?, SoXu = ?, MaPromo = ?, NgayTao = CURRENT_TIMESTAMP WHERE MaGD = ?',
                [amount, coins, maPromo, maGD]
            );
        } else {
            const [result] = await pool.execute(
                'INSERT INTO GIAODICH_NAPXU (MaND, SoTien, SoXu, TrangThai, MaPromo) VALUES (?, ?, ?, ?, ?)',
                [userId, amount, coins, 'ChoDuyet', maPromo]
            );
            maGD = result.insertId;
        }
                const bankName = 'TECHCOMBANK'; 
        const accountNo = '19073799656017'; 
        const accountName = 'TRAN HOANG DUY'; 
        const addInfo = `NAPXU ${maGD}`; 
        const qrUrl = `https://img.vietqr.io/image/${bankName}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(accountName)}`;
        res.status(200).json({ maGD, amount, coins, qrUrl, addInfo });
    } catch (error) {
        console.error('Lỗi khi tạo giao dịch nạp xu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi tạo giao dịch.' });
    }
});
router.get('/transactions', superAdminMiddleware, async (req, res) => {
    const status = req.query.status || 'ChoDuyet';
    try {
        const pool = req.app.locals.pool;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const countSql = `SELECT COUNT(*) as total FROM GIAODICH_NAPXU G WHERE G.TrangThai = ?`;
        const [countResult] = await pool.execute(countSql, [status]);
        const totalRecords = countResult[0].total;
        const totalPages = Math.ceil(totalRecords / limit);
        const offset = (page - 1) * limit;
        const [rows] = await pool.execute(
            `SELECT G.*, N.HoTen, N.Email, N.AvatarURL 
             FROM GIAODICH_NAPXU G
             JOIN NGUOIDUNG N ON G.MaND = N.MaND
             WHERE G.TrangThai = ?
             ORDER BY G.NgayTao DESC
             LIMIT ? OFFSET ?`,
            [status, limit.toString(), offset.toString()]
        );
        res.status(200).json({ 
            data: rows,
            pagination: { currentPage: page, limit, totalPages, totalRecords }
        });
    } catch (error) {
        console.error('Lỗi khi lấy giao dịch:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
router.get('/transactions/counts', superAdminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT TrangThai, COUNT(*) as count 
            FROM GIAODICH_NAPXU 
            GROUP BY TrangThai
        `);
        const counts = { ChoDuyet: 0, DaDuyet: 0, TuChoi: 0 };
        rows.forEach(r => counts[r.TrangThai] = r.count);
        res.status(200).json(counts);
    } catch (error) {
        console.error('Lỗi count:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
router.post('/approve/:id', superAdminMiddleware, async (req, res) => {
    const maGD = req.params.id;
    const adminId = req.user.MaND;
    try {
        const pool = req.app.locals.pool;
        const [txRows] = await pool.execute('SELECT * FROM GIAODICH_NAPXU WHERE MaGD = ?', [maGD]);
        if (txRows.length === 0) return res.status(404).json({ message: 'Không tìm thấy giao dịch.' });
        const tx = txRows[0];
        if (tx.TrangThai !== 'ChoDuyet') return res.status(400).json({ message: 'Giao dịch này đã được xử lý.' });
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        try {
            await connection.execute(
                'UPDATE GIAODICH_NAPXU SET TrangThai = "DaDuyet", MaND_Duyet = ?, NgayDuyet = CURRENT_TIMESTAMP WHERE MaGD = ?',
                [adminId, maGD]
            );
            await connection.execute('UPDATE NGUOIDUNG SET SoDuXu = SoDuXu + ? WHERE MaND = ?', [tx.SoXu, tx.MaND]);
            const moTaGiaoDich = `Nạp xu qua mã QR - Mã GD: ${maGD}`;
            await connection.execute(
                'INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, ?, ?, ?)',
                [tx.MaND, 'NapXu', tx.SoXu, moTaGiaoDich]
            );
            await connection.execute(
                'INSERT INTO THONGBAO (MaND, NoiDung, LoaiTB) VALUES (?, ?, ?)',
                [tx.MaND, `Giao dịch nạp ${tx.SoXu} xu của bạn đã được phê duyệt thành công!`, 'HeThong']
            );
            sendNotificationToUser(tx.MaND, 'new_notification', { message: `Giao dịch nạp ${tx.SoXu} xu của bạn đã được phê duyệt thành công!`, link: null });
            await connection.commit();
            connection.release();
            const { sendNotificationToUser } = require('../services/socket');
            sendNotificationToUser(tx.MaND, 'payment_approved', {
                message: `Giao dịch nạp ${tx.SoXu} xu của bạn đã được phê duyệt thành công!`
            });
            res.status(200).json({ message: 'Duyệt thành công!' });
        } catch (dbErr) {
            await connection.rollback();
            connection.release();
            throw dbErr;
        }
    } catch (error) {
        console.error('Lỗi khi duyệt:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
router.post('/reject/:id', superAdminMiddleware, async (req, res) => {
    const maGD = req.params.id;
    const adminId = req.user.MaND;
    try {
        const pool = req.app.locals.pool;
        const [txRows] = await pool.execute('SELECT TrangThai, MaND FROM GIAODICH_NAPXU WHERE MaGD = ?', [maGD]);
        if (txRows.length === 0) return res.status(404).json({ message: 'Không tìm thấy giao dịch.' });
        if (txRows[0].TrangThai !== 'ChoDuyet') return res.status(400).json({ message: 'Giao dịch đã được xử lý.' });
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        try {
            await connection.execute(
                'UPDATE GIAODICH_NAPXU SET TrangThai = "TuChoi", MaND_Duyet = ?, NgayDuyet = CURRENT_TIMESTAMP WHERE MaGD = ?',
                [adminId, maGD]
            );
            await connection.execute(
                'INSERT INTO THONGBAO (MaND, NoiDung, LoaiTB) VALUES (?, ?, ?)',
                [txRows[0].MaND, `Giao dịch nạp xu (Mã GD: ${maGD}) của bạn đã bị từ chối do không nhận được thanh toán.`, 'HeThong']
            );
            sendNotificationToUser(txRows[0].MaND, 'new_notification', { message: `Giao dịch nạp xu (Mã GD: ${maGD}) của bạn đã bị từ chối do không nhận được thanh toán.`, link: null });
            await connection.commit();
            connection.release();
            const { sendNotificationToUser } = require('../services/socket');
            sendNotificationToUser(txRows[0].MaND, 'payment_rejected', {
                message: `Giao dịch nạp xu (Mã GD: ${maGD}) của bạn đã bị từ chối do không nhận được thanh toán.`
            });
            res.status(200).json({ message: 'Đã từ chối giao dịch.' });
        } catch (dbErr) {
            await connection.rollback();
            throw dbErr;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Lỗi khi từ chối:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
router.delete('/delete/:id', superAdminMiddleware, async (req, res) => {
    const maGD = req.params.id;
    try {
        const pool = req.app.locals.pool;
        const [txRows] = await pool.execute('SELECT TrangThai FROM GIAODICH_NAPXU WHERE MaGD = ?', [maGD]);
        if (txRows.length === 0) return res.status(404).json({ message: 'Không tìm thấy giao dịch.' });
        if (txRows[0].TrangThai !== 'TuChoi') return res.status(400).json({ message: 'Chỉ có thể xóa giao dịch đã bị từ chối.' });
        await pool.execute('DELETE FROM GIAODICH_NAPXU WHERE MaGD = ?', [maGD]);
        res.status(200).json({ message: 'Đã xóa giao dịch.' });
    } catch (error) {
        console.error('Lỗi khi xóa giao dịch:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});
router.get('/export/history', superAdminMiddleware, async (req, res) => {
    try {
        const selectedCols = req.query.cols ? req.query.cols.split(',') : null;

        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT G.*, N.HoTen, N.Email 
            FROM GIAODICH_NAPXU G
            JOIN NGUOIDUNG N ON G.MaND = N.MaND
            ORDER BY G.NgayTao DESC
        `);

        const allColumns = [
            { id: 'MaGD', label: 'Mã GD' },
            { id: 'NguoiDung', label: 'Người Dùng' },
            { id: 'Email', label: 'Email' },
            { id: 'SoTien', label: 'Số Tiền (VNĐ)' },
            { id: 'SoXu', label: 'Số Xu' },
            { id: 'KhuyenMai', label: 'Khuyến Mãi' },
            { id: 'NgayTao', label: 'Ngày Tạo' },
            { id: 'NgayDuyet', label: 'Ngày Duyệt' },
            { id: 'TrangThai', label: 'Trạng Thái' }
        ];

        const exportColumns = selectedCols ? allColumns.filter(c => selectedCols.includes(c.id)) : allColumns;

        let csvContent = '\uFEFF'; 
        csvContent += exportColumns.map(c => c.label).join(',') + '\n';

        for (const row of rows) {
            const dateStr = row.NgayTao ? new Date(row.NgayTao).toLocaleString('vi-VN') : '';
            const dateDuyetStr = row.NgayDuyet ? new Date(row.NgayDuyet).toLocaleString('vi-VN') : '';
            let statusStr = row.TrangThai;
            if (statusStr === 'DaDuyet') statusStr = 'Đã Duyệt';
            else if (statusStr === 'ChoDuyet') statusStr = 'Chờ Duyệt';
            else if (statusStr === 'TuChoi') statusStr = 'Từ Chối';
            
            const rowDataMap = {
                'MaGD': row.MaGD,
                'NguoiDung': `"${(row.HoTen || '').replace(/"/g, '""')}"`,
                'Email': `"${(row.Email || '').replace(/"/g, '""')}"`,
                'SoTien': row.SoTien || 0,
                'SoXu': row.SoXu || 0,
                'KhuyenMai': `"${(row.MaPromo || '').replace(/"/g, '""')}"`,
                'NgayTao': `"${dateStr}"`,
                'NgayDuyet': `"${dateDuyetStr}"`,
                'TrangThai': `"${statusStr}"`
            };

            const values = exportColumns.map(c => rowDataMap[c.id]);
            csvContent += values.join(',') + '\n';
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="lich-su-nap-xu.csv"');
        res.send(csvContent);
    } catch (error) {
        console.error('Lỗi xuất lịch sử nạp xu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.post('/donate/request-otp', authMiddleware, async (req, res) => {
    const { amount, receiverId } = req.body;
    const userId = req.user.MaND;

    if (userId === parseInt(receiverId)) {
        return res.status(400).json({ message: 'Không thể tự tặng Xu cho chính mình.' });
    }
    try {
        const pool = req.app.locals.pool;
        const [configRows] = await pool.execute("SELECT GiaTri FROM CAUHINH_HETHONG WHERE TenCauHinh = 'MIN_DONATE_XU'");
        const minDonate = configRows.length > 0 ? parseInt(configRows[0].GiaTri) || 10 : 10;

        if (!amount || isNaN(amount) || amount < minDonate) {
            return res.status(400).json({ message: `Số Xu tối thiểu là ${minDonate}.` });
        }
        const [userRows] = await pool.execute('SELECT Email, HoTen, SoDuXu FROM NGUOIDUNG WHERE MaND = ?', [userId]);
        if (userRows.length === 0) return res.status(404).json({ message: 'Người dùng không tồn tại.' });
        if (userRows[0].SoDuXu < amount) {
            return res.status(400).json({ message: 'Số dư không đủ để tặng.' });
        }

        const otp = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

        await pool.execute(
            'INSERT INTO DONATE_OTP (Email, OTP, ExpiresAt) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE OTP = ?, ExpiresAt = ?',
            [userRows[0].Email, otp, expiresAt, otp, expiresAt]
        );

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #4F46E5; text-align: center;">Xác Nhận Tặng Xu</h2>
                <p>Chào <strong>${userRows[0].HoTen}</strong>,</p>
                <p>Bạn vừa yêu cầu tặng <strong>${amount} Xu</strong> cho một người dùng khác trên EduShare.</p>
                <p>Để hoàn tất giao dịch, vui lòng sử dụng mã OTP sau:</p>
                <div style="text-align: center; margin: 20px 0;">
                    <span style="display: inline-block; padding: 10px 20px; font-size: 24px; font-weight: bold; background-color: #F3F4F6; border-radius: 4px; letter-spacing: 2px; color: #111827;">${otp}</span>
                </div>
                <p>Mã OTP này sẽ hết hạn sau <strong>5 phút</strong>.</p>
                <p>Trân trọng,<br>Đội ngũ EduShare</p>
            </div>
        `;

        await transporter.sendMail({
            from: `"EduShare" <${process.env.NODEMAILER_USER}>`,
            to: userRows[0].Email,
            subject: 'Mã OTP Xác Nhận Tặng Xu',
            html: emailHtml
        });

        res.status(200).json({ message: 'Mã OTP đã được gửi đến email của bạn.' });
    } catch (err) {
        console.error('Lỗi khi gửi OTP donate:', err);
        res.status(500).json({ message: 'Lỗi máy chủ khi gửi OTP.' });
    }
});

router.post('/donate', authMiddleware, async (req, res) => {
    const { receiverId, amount, message, otp } = req.body;
    const userId = req.user.MaND;

    if (userId === parseInt(receiverId)) {
        return res.status(400).json({ message: 'Không thể tự tặng Xu cho chính mình.' });
    }
        try {
        const pool = req.app.locals.pool;
        const [configRows] = await pool.execute("SELECT TenCauHinh, GiaTri FROM CAUHINH_HETHONG WHERE TenCauHinh IN ('MIN_DONATE_XU', 'TAX_RATE_PERCENT')");
        let minDonate = 10, taxRate = 10;
        configRows.forEach(r => {
            if (r.TenCauHinh === 'MIN_DONATE_XU') minDonate = parseInt(r.GiaTri) || 10;
            if (r.TenCauHinh === 'TAX_RATE_PERCENT') taxRate = parseFloat(r.GiaTri) || 10;
        });

        if (!amount || isNaN(amount) || amount < minDonate) {
            return res.status(400).json({ message: `Số Xu tối thiểu là ${minDonate}.` });
        }
        if (amount >= 500 && !otp) {
            return res.status(400).json({ message: 'Giao dịch lớn cần xác thực OTP.', requireOTP: true });
        }

        if (amount >= 500) {
            const [userRows] = await pool.execute('SELECT Email FROM NGUOIDUNG WHERE MaND = ?', [userId]);
            if (userRows.length === 0) return res.status(404).json({ message: 'Lỗi xác thực người gửi.' });
            
            const email = userRows[0].Email;
            const [otpRows] = await pool.execute('SELECT * FROM DONATE_OTP WHERE Email = ? AND OTP = ?', [email, otp]);
            if (otpRows.length === 0) {
                return res.status(400).json({ message: 'Mã OTP không chính xác.' });
            }
            if (new Date(otpRows[0].ExpiresAt) < new Date()) {
                return res.status(400).json({ message: 'Mã OTP đã hết hạn.' });
            }
            await pool.execute('DELETE FROM DONATE_OTP WHERE Email = ?', [email]);
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const [senderRows] = await connection.execute('SELECT SoDuXu, HoTen FROM NGUOIDUNG WHERE MaND = ? FOR UPDATE', [userId]);
            const [receiverRows] = await connection.execute('SELECT SoDuXu FROM NGUOIDUNG WHERE MaND = ? FOR UPDATE', [receiverId]);
            
            if (senderRows.length === 0 || receiverRows.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ message: 'Người dùng không tồn tại.' });
            }

            const sender = senderRows[0];
            if (sender.SoDuXu < amount) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ message: 'Số dư không đủ.' });
            }

            const tax = Math.floor(amount * (taxRate / 100));
            const receiveAmount = amount - tax;

            await connection.execute('UPDATE NGUOIDUNG SET SoDuXu = SoDuXu - ? WHERE MaND = ?', [amount, userId]);
            await connection.execute('UPDATE NGUOIDUNG SET SoDuXu = SoDuXu + ? WHERE MaND = ?', [receiveAmount, receiverId]);

            await connection.execute(
                'INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, ?, ?, ?)',
                [userId, 'TangXu', -amount, `Tặng Xu cho người dùng ID ${receiverId}`]
            );

            await connection.execute(
                'INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, ?, ?, ?)',
                [receiverId, 'NhanXu', receiveAmount, `Được tặng Xu từ ${sender.HoTen}`]
            );

            const notifContent = `Bạn vừa được <b>${sender.HoTen}</b> tặng ${receiveAmount} Xu (Đã trừ ${tax} Xu thuế).${message ? ` Lời nhắn: "${message}"` : ''}`;
            await connection.execute(
                'INSERT INTO THONGBAO (MaND, NoiDung, LoaiTB) VALUES (?, ?, ?)',
                [receiverId, notifContent, 'HeThong']
            );

            await connection.commit();
            connection.release();

            const { sendNotificationToUser } = require('../services/socket');
            sendNotificationToUser(receiverId, 'new_notification', { message: notifContent, link: `/pages/user/transactionHistory.html` });
            
            res.status(200).json({ message: 'Tặng Xu thành công!', receiveAmount, tax });
        } catch (dbErr) {
            await connection.rollback();
            connection.release();
            throw dbErr;
        }
    } catch (error) {
        console.error('Lỗi khi tặng xu:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

module.exports = router;
