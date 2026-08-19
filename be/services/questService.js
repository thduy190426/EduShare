const updateQuestProgress = async (maND, loaiNV, amount, pool) => {
    try {
        const [quests] = await pool.execute('SELECT * FROM NHIEMVU WHERE LoaiNV = ? AND TrangThai = "HoatDong"', [loaiNV]);
        if (quests.length === 0) return;

        for (const quest of quests) {
            const [progressRows] = await pool.execute('SELECT * FROM TIENDO_NHIEMVU WHERE MaND = ? AND MaNV = ?', [maND, quest.MaNV]);
            let currentProgress = 0;
            let status = 'DangLam';

            if (progressRows.length > 0) {
                const p = progressRows[0];
                const pDate = new Date(p.NgayCapNhat);
                const now = new Date();
                
                let isExpired = false;
                if (quest.TanSuat === 'HangNgay') {
                    if (pDate.getDate() !== now.getDate() || pDate.getMonth() !== now.getMonth() || pDate.getFullYear() !== now.getFullYear()) {
                        isExpired = true;
                    }
                } else if (quest.TanSuat === 'HangTuan') {
                    const diffTime = Math.abs(now - pDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays >= 7) isExpired = true;
                }

                if (isExpired) {
                    currentProgress = 0;
                    status = 'DangLam';
                } else {
                    currentProgress = p.TienDo;
                    status = p.TrangThai;
                }
            }

            if (status === 'DaNhan') continue;

            currentProgress += amount;
            if (currentProgress >= quest.MucTieu && status !== 'DaNhan') {
                currentProgress = quest.MucTieu;
                status = 'ChoNhan';
            }

            await pool.execute(
                `INSERT INTO TIENDO_NHIEMVU (MaND, MaNV, TienDo, TrangThai, NgayCapNhat) 
                 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) 
                 ON DUPLICATE KEY UPDATE TienDo = VALUES(TienDo), TrangThai = VALUES(TrangThai), NgayCapNhat = CURRENT_TIMESTAMP`,
                [maND, quest.MaNV, currentProgress, status]
            );
        }
    } catch (err) {
        console.error(`Error updating quest progress for User ${maND} - Quest ${loaiNV}:`, err);
    }
};

module.exports = { updateQuestProgress };
