const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('./middlewares/auth');
const { paymentLimiter } = require('./middlewares/rateLimit');




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

router.post('/promos/validate', authMiddleware, async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Vui lòng nhập mã ưu đãi.' });
    
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute('SELECT MaPromo, DiscountPercent, IsActive FROM PROMO_CODE WHERE Code = ?', [code.trim().toUpperCase()]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Mã ưu đãi không tồn tại.' });
        }
        
        if (!rows[0].IsActive) {
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

    try {
        const pool = req.app.locals.pool;
        
        const [pkgRows] = await pool.execute('SELECT SoTien, SoXu FROM GOI_NAP_XU WHERE MaGoi = ? AND TrangThai = "HoatDong"', [packageId]);
        if (pkgRows.length === 0) {
            return res.status(400).json({ message: 'Gói nạp không hợp lệ hoặc đã bị ẩn.' });
        }
        
        const amount = pkgRows[0].SoTien;
        let coins = pkgRows[0].SoXu;
        
        let maPromo = null;
        if (promoCode) {
            const [promoRows] = await pool.execute('SELECT MaPromo, DiscountPercent, IsActive FROM PROMO_CODE WHERE Code = ?', [promoCode.trim().toUpperCase()]);
            if (promoRows.length > 0 && promoRows[0].IsActive) {
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

router.get('/transactions', adminMiddleware, async (req, res) => {
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

router.get('/transactions/counts', adminMiddleware, async (req, res) => {
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

router.post('/approve/:id', adminMiddleware, async (req, res) => {
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

            await connection.commit();
            connection.release();

            const { sendNotificationToUser } = require('./services/socket');
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

router.post('/reject/:id', adminMiddleware, async (req, res) => {
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

            await connection.commit();
            connection.release();

            const { sendNotificationToUser } = require('./services/socket');
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

router.delete('/delete/:id', adminMiddleware, async (req, res) => {
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

router.get('/export/history', adminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(`
            SELECT G.*, N.HoTen, N.Email 
            FROM GIAODICH_NAPXU G
            JOIN NGUOIDUNG N ON G.MaND = N.MaND
            ORDER BY G.NgayTao DESC
        `);

        let csvContent = '\uFEFF'; 
        csvContent += 'Mã GD,Người Dùng,Email,Số Tiền (VNĐ),Số Xu,Khuyến Mãi,Ngày Tạo,Ngày Duyệt,Trạng Thái\n';

        for (const row of rows) {
            const dateStr = row.NgayTao ? new Date(row.NgayTao).toLocaleString('vi-VN') : '';
            const dateDuyetStr = row.NgayDuyet ? new Date(row.NgayDuyet).toLocaleString('vi-VN') : '';
            
            let statusStr = row.TrangThai;
            if (statusStr === 'DaDuyet') statusStr = 'Đã Duyệt';
            else if (statusStr === 'ChoDuyet') statusStr = 'Chờ Duyệt';
            else if (statusStr === 'TuChoi') statusStr = 'Từ Chối';

            const values = [
                row.MaGD,
                `"${(row.HoTen || '').replace(/"/g, '""')}"`,
                `"${(row.Email || '').replace(/"/g, '""')}"`,
                row.SoTien || 0,
                row.SoXu || 0,
                `"${(row.MaPromo || '').replace(/"/g, '""')}"`,
                `"${dateStr}"`,
                `"${dateDuyetStr}"`,
                `"${statusStr}"`
            ];
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

module.exports = router;
