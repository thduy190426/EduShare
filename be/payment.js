const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('./middlewares/auth');

const PACKAGES = [
    { id: 'G10K', price: 10000, coins: 100 },
    { id: 'G20K', price: 20000, coins: 200 },
    { id: 'G50K', price: 50000, coins: 500 },
    { id: 'G100K', price: 100000, coins: 1000 },
    { id: 'G200K', price: 200000, coins: 2000 },
    { id: 'G500K', price: 500000, coins: 5000 }
];

router.get('/packages', (req, res) => {
    res.status(200).json({ packages: PACKAGES });
});

router.post('/create', authMiddleware, async (req, res) => {
    const { packageId } = req.body;
    const pkg = PACKAGES.find(p => p.id === packageId);
    
    if (!pkg) {
        return res.status(400).json({ message: 'Gói nạp không hợp lệ.' });
    }

    const amount = pkg.price;
    const coins = pkg.coins;
    const userId = req.user.MaND;

    try {
        const pool = req.app.locals.pool;
        
        const [pendingTx] = await pool.execute(
            'SELECT MaGD FROM GIAODICH_NAPXU WHERE MaND = ? AND TrangThai = ?',
            [userId, 'ChoDuyet']
        );

        let maGD;

        if (pendingTx.length > 0) {
            maGD = pendingTx[0].MaGD;
            await pool.execute(
                'UPDATE GIAODICH_NAPXU SET SoTien = ?, SoXu = ?, NgayTao = CURRENT_TIMESTAMP WHERE MaGD = ?',
                [amount, coins, maGD]
            );
        } else {
            const [result] = await pool.execute(
                'INSERT INTO GIAODICH_NAPXU (MaND, SoTien, SoXu, TrangThai) VALUES (?, ?, ?, ?)',
                [userId, amount, coins, 'ChoDuyet']
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
        const [rows] = await pool.execute(
            `SELECT G.*, N.HoTen, N.Email, N.AvatarURL 
             FROM GIAODICH_NAPXU G
             JOIN NGUOIDUNG N ON G.MaND = N.MaND
             WHERE G.TrangThai = ?
             ORDER BY G.NgayTao DESC`,
            [status]
        );
        res.status(200).json(rows);
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

        await pool.execute(
            'UPDATE GIAODICH_NAPXU SET TrangThai = "TuChoi", MaND_Duyet = ?, NgayDuyet = CURRENT_TIMESTAMP WHERE MaGD = ?',
            [adminId, maGD]
        );

        await pool.execute(
            'INSERT INTO THONGBAO (MaND, NoiDung, LoaiTB) VALUES (?, ?, ?)',
            [txRows[0].MaND, `Giao dịch nạp xu (Mã GD: ${maGD}) của bạn đã bị từ chối do không nhận được thanh toán.`, 'HeThong']
        );

        res.status(200).json({ message: 'Đã từ chối giao dịch.' });
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

module.exports = router;
