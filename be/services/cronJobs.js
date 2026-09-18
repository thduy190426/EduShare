const cron = require('node-cron');
const { sendNotificationToUser } = require('./socket');
const { getRedisClient } = require('../config/redis');

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
                    sendNotificationToUser(user.MaND, 'new_notification', { message: `Chúc mừng! Bạn đã đạt Top ${i + 1} Bảng Vàng đóng góp tháng trước và nhận được ${xuThuong} Xu từ EduShare!` });
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

    cron.schedule('*/5 * * * *', async () => {
        try {
            const currentYear = new Date().getFullYear();
            
            const [userCount] = await pool.execute('SELECT COUNT(*) as count FROM NGUOIDUNG');
            const [docCount] = await pool.execute('SELECT COUNT(*) as count FROM TAILIEU');
            const [downloadSum] = await pool.execute('SELECT SUM(SoLuotTai) as total FROM TAILIEU');
            const [reportCount] = await pool.execute('SELECT COUNT(*) as count FROM BAOCAOVIPHAM WHERE TrangThai = "ChoXuLy"');
            const [pendingDocCount] = await pool.execute('SELECT COUNT(*) as count FROM TAILIEU WHERE TrangThaiKiemDuyet = "ChoDuyet"');
            const [pendingPaymentCount] = await pool.execute('SELECT COUNT(*) as count FROM GIAODICH_NAPXU WHERE TrangThai = "ChoDuyet"');
            const [pendingTeacherCount] = await pool.execute('SELECT COUNT(*) as count FROM YEU_CAU_GIAO_VIEN WHERE TrangThai = "ChoDuyet"');
            const [pendingSubjectCount] = await pool.execute('SELECT COUNT(*) as count FROM DEXUAT_MONHOC WHERE TrangThai = "ChoDuyet"');
            const [revenueSum] = await pool.execute('SELECT SUM(SoTien) as total FROM GIAODICH_NAPXU WHERE TrangThai = "DaDuyet"');
            
            const [usersByRoleRows] = await pool.execute('SELECT VaiTro, COUNT(*) as count FROM NGUOIDUNG GROUP BY VaiTro');
            const [docsByStatusRows] = await pool.execute('SELECT TrangThaiKiemDuyet, COUNT(*) as count FROM TAILIEU GROUP BY TrangThaiKiemDuyet');
            const [docsBySubjectRows] = await pool.execute(`
                SELECT MH.TenMonHoc, COUNT(TL.MaTL) as count 
                FROM TAILIEU TL
                JOIN MONHOC MH ON TL.MaMonHoc = MH.MaMonHoc
                GROUP BY MH.TenMonHoc
                ORDER BY count DESC
                LIMIT 5
            `);
            const [topDepositors] = await pool.execute(`
                SELECT ND.MaND, ND.HoTen, ND.AvatarURL, SUM(G.SoXu) as totalXu
                FROM GIAODICH_NAPXU G
                JOIN NGUOIDUNG ND ON G.MaND = ND.MaND
                WHERE G.TrangThai = 'DaDuyet' AND ND.VaiTro != 'Admin'
                GROUP BY ND.MaND, ND.HoTen, ND.AvatarURL
                ORDER BY totalXu DESC
                LIMIT 5
            `);
            const [topContributors] = await pool.execute(`
                SELECT ND.MaND, ND.HoTen, ND.AvatarURL,
                    (SELECT COUNT(*) FROM TAILIEU TL WHERE TL.MaND_NguoiDang = ND.MaND AND TL.TrangThaiKiemDuyet = 'DaDuyet') AS countDoc,
                    (SELECT COUNT(*) FROM BINHLUAN BL WHERE BL.MaND = ND.MaND) AS countComment
                FROM NGUOIDUNG ND
                WHERE ND.VaiTro != 'Admin'
                ORDER BY (countDoc * 10 + countComment) DESC
                LIMIT 5
            `);
            
            const [revenueRows] = await pool.execute(`
                SELECT MONTH(NgayTao) as month, SUM(SoTien) as revenue 
                FROM GIAODICH_NAPXU 
                WHERE TrangThai = 'DaDuyet' AND YEAR(NgayTao) = ?
                GROUP BY MONTH(NgayTao) 
                ORDER BY month ASC
            `, [currentYear]);
            const [userGrowthRows] = await pool.execute(`
                SELECT MONTH(NgayTao) as month, COUNT(*) as newUsers 
                FROM NGUOIDUNG 
                WHERE YEAR(NgayTao) = ?
                GROUP BY MONTH(NgayTao) 
                ORDER BY month ASC
            `, [currentYear]);
            const [trendingSubjects] = await pool.execute(`
                SELECT MH.TenMonHoc, COALESCE(SUM(TL.SoLuotTai), 0) as totalDownloads 
                FROM MONHOC MH 
                JOIN TAILIEU TL ON MH.MaMonHoc = TL.MaMonHoc 
                WHERE TL.TrangThaiKiemDuyet = 'DaDuyet' 
                GROUP BY MH.TenMonHoc 
                ORDER BY totalDownloads DESC 
                LIMIT 5
            `);
            
            const dataJSON = JSON.stringify({
                usersByRole: usersByRoleRows,
                docsByStatus: docsByStatusRows,
                docsBySubject: docsBySubjectRows,
                topDepositors: topDepositors,
                topContributors: topContributors,
                revenueByMonth: revenueRows,
                userGrowth: userGrowthRows,
                trendingSubjects: trendingSubjects
            });

            await pool.execute(`
                INSERT INTO ADMIN_DASHBOARD_SUMMARY 
                (Id, TotalUsers, TotalDocuments, TotalDownloads, PendingReports, PendingDocs, PendingPayments, PendingTeachers, PendingSubjects, TotalRevenue, DataJSON, LastUpdated) 
                VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON DUPLICATE KEY UPDATE 
                TotalUsers=VALUES(TotalUsers), TotalDocuments=VALUES(TotalDocuments), TotalDownloads=VALUES(TotalDownloads),
                PendingReports=VALUES(PendingReports), PendingDocs=VALUES(PendingDocs), PendingPayments=VALUES(PendingPayments),
                PendingTeachers=VALUES(PendingTeachers), PendingSubjects=VALUES(PendingSubjects), TotalRevenue=VALUES(TotalRevenue),
                DataJSON=VALUES(DataJSON), LastUpdated=CURRENT_TIMESTAMP
            `, [
                userCount[0].count,
                docCount[0].count,
                downloadSum[0].total || 0,
                reportCount[0].count,
                pendingDocCount[0].count,
                pendingPaymentCount[0].count,
                pendingTeacherCount[0].count,
                pendingSubjectCount[0].count,
                revenueSum[0].total || 0,
                dataJSON
            ]);

            const dashboardData = {
                users: userCount[0].count,
                documents: docCount[0].count,
                downloads: downloadSum[0].total || 0,
                pendingReports: reportCount[0].count,
                pendingDocs: pendingDocCount[0].count,
                pendingPayments: pendingPaymentCount[0].count,
                pendingTeachers: pendingTeacherCount[0].count,
                pendingSubjects: pendingSubjectCount[0].count,
                usersByRole: usersByRoleRows || [],
                docsByStatus: docsByStatusRows || [],
                docsBySubject: docsBySubjectRows || [],
                topDepositors: topDepositors || [],
                topContributors: topContributors || [],
                revenueByMonth: revenueRows || [],
                userGrowth: userGrowthRows || [],
                trendingSubjects: trendingSubjects || []
            };

            const redisClient = getRedisClient();
            if (redisClient) {
                await redisClient.set('admin:dashboard_summary', JSON.stringify(dashboardData), 'EX', 3600);
            }

            console.log('Đã cập nhật Admin Dashboard Summary (Cronjob 5 phút)');
        } catch (error) {
            console.error('Lỗi khi chạy cronjob cập nhật Dashboard Summary:', error);
        }
    });
    console.log('Đã khởi tạo Cron Job cập nhật Dashboard (5 phút/lần).');

    cron.schedule('0 2 * * *', async () => {
        try {
            const [rows] = await pool.execute('SELECT TenCauHinh, GiaTri FROM CAUHINH_HETHONG WHERE TenCauHinh IN ("AUTO_BACKUP_ENABLED", "AUTO_BACKUP_SCHEDULE", "MAX_BACKUPS_RETAIN")');
            let enabled = 0, schedule = 'daily', maxRetain = 5;
            rows.forEach(r => {
                if (r.TenCauHinh === 'AUTO_BACKUP_ENABLED') enabled = parseInt(r.GiaTri);
                if (r.TenCauHinh === 'AUTO_BACKUP_SCHEDULE') schedule = r.GiaTri;
                if (r.TenCauHinh === 'MAX_BACKUPS_RETAIN') maxRetain = parseInt(r.GiaTri);
            });

            if (!enabled) return;

            const now = new Date();
            const dayOfWeek = now.getDay();
            const dayOfMonth = now.getDate();

            if (schedule === 'weekly' && dayOfWeek !== 0) return;
            if (schedule === 'monthly' && dayOfMonth !== 1) return;

            const fs = require('fs');
            const path = require('path');
            const { exec } = require('child_process');
            const util = require('util');
            const execPromise = util.promisify(exec);

            const BACKUP_DIR = path.join(__dirname, '..', 'public', 'uploads', 'backups');
            if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

            const timestamp = now.toISOString().replace(/[:.]/g, '-');
            const filename = `backup_auto_${timestamp}.sql`;
            const filepath = path.join(BACKUP_DIR, filename);

            const host = process.env.DB_HOST || 'localhost';
            const user = process.env.DB_USER || 'root';
            const password = process.env.DB_PASSWORD || '';
            const database = process.env.DB_NAME || 'edushare_db';

            let dumpCmd = `mysqldump -h ${host} -u ${user} `;
            if (password) dumpCmd += `-p"${password}" `;
            dumpCmd += `${database} > "${filepath}"`;

            await execPromise(dumpCmd);
            console.log(`Đã sao lưu tự động thành công: ${filename}`);

            if (maxRetain > 0) {
                const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql'));
                const statsList = files.map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }));
                statsList.sort((a, b) => b.time - a.time); 

                if (statsList.length > maxRetain) {
                    const toDelete = statsList.slice(maxRetain);
                    for (const file of toDelete) {
                        fs.unlinkSync(path.join(BACKUP_DIR, file.name));
                        console.log(`Đã xóa bản sao lưu cũ: ${file.name}`);
                    }
                }
            }

        } catch (error) {
            console.error('Lỗi khi chạy cronjob tự động sao lưu:', error);
        }
    });
    console.log('Đã khởi tạo Cron Job tự động sao lưu (2h sáng hàng ngày).');
}

module.exports = { initCronJobs };
