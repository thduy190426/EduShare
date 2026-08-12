const cron = require('node-cron');

function initCronJobs(pool) {
    cron.schedule('1 0 1 * *', async () => {
        console.log('Đang chạy tác vụ phát thưởng Xu cho Top Bảng Vàng tháng trước...');
        try {
            const sql = `
                SELECT 
                    ND.MaND, 
                    COUNT(TL.MaTL) AS TotalDocuments,
                    IFNULL(SUM(TL.SoLuotTai), 0) AS TotalDownloads
                FROM NGUOIDUNG ND
                JOIN TAILIEU TL ON ND.MaND = TL.MaND_NguoiDang
                WHERE TL.TrangThaiKiemDuyet = 'DaDuyet' 
                  AND MONTH(TL.NgayDang) = MONTH(CURRENT_DATE() - INTERVAL 1 MONTH) 
                  AND YEAR(TL.NgayDang) = YEAR(CURRENT_DATE() - INTERVAL 1 MONTH)
                GROUP BY ND.MaND
                ORDER BY TotalDocuments DESC, TotalDownloads DESC
                LIMIT 4
            `;

            const [topUsers] = await pool.execute(sql);
            if (topUsers.length === 0) {
                console.log('Không có thành viên nào thỏa điều kiện để phát thưởng.');
                return;
            }

            const rewards = [500, 300, 200, 100];

            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                for (let i = 0; i < topUsers.length; i++) {
                    const user = topUsers[i];
                    const xuThuong = rewards[i];

                    await connection.execute('UPDATE NGUOIDUNG SET SoDuXu = SoDuXu + ? WHERE MaND = ?', [xuThuong, user.MaND]);

                    await connection.execute(
                        "INSERT INTO LICH_SU_XU (MaND, LoaiGiaoDich, SoXuThayDoi, MoTa) VALUES (?, 'ThuongXu', ?, ?)",
                        [user.MaND, xuThuong, `Thưởng Top ${i + 1} Bảng Vàng tháng trước`]
                    );

                    await connection.execute(
                        "INSERT INTO THONGBAO (MaND, NoiDung, LoaiTB) VALUES (?, ?, 'HeThong')",
                        [user.MaND, `Chúc mừng! Bạn đã đạt Top ${i + 1} Bảng Vàng đóng góp tháng trước và nhận được ${xuThuong} Xu từ EduShare!`]
                    );
                }

                await connection.commit();
                console.log(`Đã phát thưởng thành công cho ${topUsers.length} thành viên Top Bảng Vàng!`);
            } catch (txErr) {
                await connection.rollback();
                throw txErr;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Lỗi khi chạy cronjob phát thưởng Top Bảng Vàng:', error);
        }
    });
    console.log('Đã khởi tạo các Cron Job tự động (Phát thưởng Top Bảng Vàng).');
    cron.schedule('0 3 * * *', async () => {
        try {
            const [result] = await pool.execute('DELETE FROM REFRESH_TOKENS WHERE ExpiresAt < CURRENT_TIMESTAMP');
            if (result.affectedRows > 0) {
                console.log(`Đã dọn dẹp ${result.affectedRows} token hết hạn khỏi CSDL.`);
            }
        } catch (error) {
            console.error('Lỗi khi dọn dẹp token:', error);
        }
    });
}

module.exports = { initCronJobs };
