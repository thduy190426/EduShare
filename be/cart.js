const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./middlewares/auth');

router.get('/', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const userId = req.user.MaND;

        const [rows] = await pool.execute(`
            SELECT G.MaTL, G.NgayThem, T.TenTL, T.GiaXu, T.ThumbnailURL, U.HoTen as TenTacGia
            FROM GIOHANG G
            JOIN TAILIEU T ON G.MaTL = T.MaTL
            JOIN NGUOIDUNG U ON T.MaND_NguoiDang = U.MaND
            WHERE G.MaND = ?
            ORDER BY G.NgayThem DESC
        `, [userId]);

        res.status(200).json(rows);
    } catch (error) {
        console.error('Lỗi khi lấy giỏ hàng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy giỏ hàng.' });
    }
});

router.get('/count', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const userId = req.user.MaND;

        const [rows] = await pool.execute('SELECT COUNT(*) as count FROM GIOHANG WHERE MaND = ?', [userId]);
        res.status(200).json({ count: rows[0].count });
    } catch (error) {
        console.error('Lỗi khi đếm số lượng giỏ hàng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.post('/add', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const userId = req.user.MaND;
        const { maTL } = req.body;

        if (!maTL) return res.status(400).json({ message: 'Thiếu mã tài liệu.' });

        const [docs] = await pool.execute('SELECT MaND_NguoiDang, LaTaiLieuDocQuyen, TrangThaiKiemDuyet, IsDeleted FROM TAILIEU WHERE MaTL = ?', [maTL]);
        if (docs.length === 0) return res.status(404).json({ message: 'Tài liệu không tồn tại.' });
        
        const doc = docs[0];
        if (doc.TrangThaiKiemDuyet !== 'DaDuyet' || doc.IsDeleted) return res.status(400).json({ message: 'Tài liệu không khả dụng.' });
        if (!doc.LaTaiLieuDocQuyen) return res.status(400).json({ message: 'Tài liệu này không phải tài liệu Premium.' });
        if (doc.MaND_NguoiDang === userId) return res.status(400).json({ message: 'Bạn không thể mua tài liệu của chính mình.' });

        const [purchased] = await pool.execute('SELECT 1 FROM TAILIEU_DAMUA WHERE MaND = ? AND MaTL = ?', [userId, maTL]);
        if (purchased.length > 0) return res.status(400).json({ message: 'Bạn đã mua tài liệu này rồi.' });

        const [inCart] = await pool.execute('SELECT 1 FROM GIOHANG WHERE MaND = ? AND MaTL = ?', [userId, maTL]);
        if (inCart.length > 0) return res.status(400).json({ message: 'Tài liệu đã có trong giỏ hàng.' });

        await pool.execute('INSERT INTO GIOHANG (MaND, MaTL) VALUES (?, ?)', [userId, maTL]);
        res.status(201).json({ message: 'Đã thêm vào giỏ hàng.' });
    } catch (error) {
        console.error('Lỗi khi thêm vào giỏ hàng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.delete('/remove/:maTL', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const userId = req.user.MaND;
        const maTL = req.params.maTL;

        const [result] = await pool.execute('DELETE FROM GIOHANG WHERE MaND = ? AND MaTL = ?', [userId, maTL]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Tài liệu không có trong giỏ hàng.' });

        res.status(200).json({ message: 'Đã xóa khỏi giỏ hàng.' });
    } catch (error) {
        console.error('Lỗi khi xóa tài liệu khỏi giỏ hàng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/promo/validate', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const code = req.query.code?.trim().toUpperCase();

        if (!code) return res.status(400).json({ message: 'Thiếu mã khuyến mãi' });

        const [rows] = await pool.execute(
            'SELECT DiscountPercent FROM PROMO_CODE WHERE Code = ? AND IsActive = TRUE AND (NgayHetHan IS NULL OR NgayHetHan >= CURRENT_TIMESTAMP)',
            [code]
        );

        if (rows.length > 0) {
            res.status(200).json({ DiscountPercent: rows[0].DiscountPercent });
        } else {
            res.status(400).json({ message: 'Mã khuyến mãi không hợp lệ hoặc đã hết hạn.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.post('/checkout', authMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const userId = req.user.MaND;
        const { promoCode } = req.body;

        const idempotencyKey = req.headers['x-idempotency-key'];

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            if (idempotencyKey) {
                try {
                    await connection.execute('INSERT INTO IDEMPOTENCY_KEYS (IdempotencyKey, MaND, ApiEndpoint) VALUES (?, ?, ?)', [idempotencyKey, userId, req.originalUrl]);
                } catch (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        await connection.rollback();
                        connection.release();
                        return res.status(409).json({ message: 'Giao dịch đang được xử lý hoặc đã hoàn tất. Vui lòng không gửi lại.' });
                    }
                    throw err;
                }
            }

            const [cartItems] = await connection.execute(`
                SELECT G.MaTL, T.GiaXu, T.MaND_NguoiDang, T.TenTL
                FROM GIOHANG G
                JOIN TAILIEU T ON G.MaTL = T.MaTL
                WHERE G.MaND = ? FOR UPDATE
            `, [userId]);

            if (cartItems.length === 0) {
                await connection.rollback();
                return res.status(400).json({ message: 'Giỏ hàng đang trống.' });
            }

            let totalXu = 0;
            cartItems.forEach(item => totalXu += item.GiaXu);
            
            let discountPercent = 0;
            if (promoCode) {
                const [promoRows] = await connection.execute(
                    'SELECT MaPromo, DiscountPercent FROM PROMO_CODE WHERE Code = ? AND IsActive = TRUE AND (NgayHetHan IS NULL OR NgayHetHan >= CURRENT_TIMESTAMP)', 
                    [promoCode.trim().toUpperCase()]
                );
                
                if (promoRows.length > 0) {
                    discountPercent = promoRows[0].DiscountPercent;
                } else {
                    await connection.rollback();
                    return res.status(400).json({ message: 'Mã khuyến mãi không hợp lệ hoặc đã hết hạn.' });
                }
            }

            const finalTotalXu = Math.floor(totalXu * (1 - discountPercent / 100));

            const [userRows] = await connection.execute('SELECT SoDuXu FROM NGUOIDUNG WHERE MaND = ? FOR UPDATE', [userId]);
            if (userRows[0].SoDuXu < finalTotalXu) {
                await connection.rollback();
                return res.status(400).json({ message: 'Bạn không đủ Xu để thanh toán giỏ hàng này.' });
            }

            await connection.execute('UPDATE NGUOIDUNG SET SoDuXu = SoDuXu - ? WHERE MaND = ?', [finalTotalXu, userId]);
            await connection.execute(
                'INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, ?, ?, ?)',
                [userId, 'MuaTaiLieu', -finalTotalXu, `Thanh toán giỏ hàng gồm ${cartItems.length} tài liệu (Giảm giá ${discountPercent}%).`]
            );

            for (const item of cartItems) {
                await connection.execute('INSERT INTO TAILIEU_DAMUA (MaND, MaTL) VALUES (?, ?)', [userId, item.MaTL]);
                
                await connection.execute('UPDATE NGUOIDUNG SET SoDuXu = SoDuXu + ? WHERE MaND = ?', [item.GiaXu, item.MaND_NguoiDang]);
                await connection.execute(
                    'INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, ?, ?, ?)',
                    [item.MaND_NguoiDang, 'BanTaiLieu', item.GiaXu, `Doanh thu từ việc bán tài liệu: "${item.TenTL}"`]
                );
            }

            await connection.execute('DELETE FROM GIOHANG WHERE MaND = ?', [userId]);

            await connection.commit();
            res.status(200).json({ message: 'Thanh toán thành công!', totalPaid: finalTotalXu });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Lỗi khi thanh toán giỏ hàng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ trong quá trình thanh toán.' });
    }
});

module.exports = router;