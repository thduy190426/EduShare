const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./middlewares/auth');

router.get('/', authMiddleware, async (req, res) => {
    const pool = req.app.locals.pool;
    try {
        const [quests] = await pool.execute('SELECT * FROM NHIEMVU WHERE TrangThai = "HoatDong"');
        const [progress] = await pool.execute('SELECT * FROM TIENDO_NHIEMVU WHERE MaND = ?', [req.user.MaND]);

        const now = new Date();
        
        const combined = quests.map(q => {
            const p = progress.find(p => p.MaNV === q.MaNV);
            let pData = { TienDo: 0, TrangThai: 'DangLam' };
            
            if (p) {
                const pDate = new Date(p.NgayCapNhat);
                let isExpired = false;
                if (q.TanSuat === 'HangNgay') {
                    if (pDate.getDate() !== now.getDate() || pDate.getMonth() !== now.getMonth() || pDate.getFullYear() !== now.getFullYear()) {
                        isExpired = true;
                    }
                } else if (q.TanSuat === 'HangTuan') {
                    const diffTime = Math.abs(now - pDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays >= 7) isExpired = true;
                }
                
                if (!isExpired) {
                    pData = { TienDo: p.TienDo, TrangThai: p.TrangThai };
                }
            }
            
            return {
                ...q,
                ...pData
            };
        });

        res.json({ quests: combined });
    } catch (err) {
        console.error('Error fetching quests:', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.post('/:maNV/claim', authMiddleware, async (req, res) => {
    const { maNV } = req.params;
    const pool = req.app.locals.pool;
    
    try {
        const [quests] = await pool.execute('SELECT * FROM NHIEMVU WHERE MaNV = ?', [maNV]);
        if (quests.length === 0) return res.status(404).json({ message: 'Không tìm thấy nhiệm vụ.' });
        const quest = quests[0];

        const [progress] = await pool.execute('SELECT * FROM TIENDO_NHIEMVU WHERE MaND = ? AND MaNV = ?', [req.user.MaND, maNV]);
        if (progress.length === 0 || progress[0].TrangThai !== 'ChoNhan') {
            return res.status(400).json({ message: 'Nhiệm vụ chưa hoàn thành hoặc đã nhận thưởng.' });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            
            await conn.execute('UPDATE TIENDO_NHIEMVU SET TrangThai = "DaNhan" WHERE MaND = ? AND MaNV = ?', [req.user.MaND, maNV]);
            await conn.execute('UPDATE NGUOIDUNG SET SoDuXu = SoDuXu + ? WHERE MaND = ?', [quest.ThuongXu, req.user.MaND]);
            
            await conn.execute(
                "INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, 'ThuongXu', ?, ?)",
                [req.user.MaND, quest.ThuongXu, `Thưởng hoàn thành nhiệm vụ: ${quest.TenNV}`]
            );

            await conn.commit();
            res.json({ message: 'Nhận thưởng thành công!', thuongXu: quest.ThuongXu });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error('Error claiming quest:', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

module.exports = router;
