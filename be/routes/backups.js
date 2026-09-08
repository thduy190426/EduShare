const express = require('express');
const router = express.Router();
const { superAdminMiddleware } = require('../middlewares/auth');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const BACKUP_DIR = path.join(__dirname, 'public', 'uploads', 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

router.get('/', superAdminMiddleware, async (req, res) => {
    try {
        const files = fs.readdirSync(BACKUP_DIR);
        const backups = files
            .filter(f => f.endsWith('.sql'))
            .map(file => {
                const filePath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    size: formatBytes(stats.size),
                    sizeBytes: stats.size,
                    createdAt: stats.mtime
                };
            })
            .sort((a, b) => b.createdAt - a.createdAt); 

        res.status(200).json(backups);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách backup:', error);
        res.status(500).json({ message: 'Không thể lấy danh sách sao lưu' });
    }
});

router.post('/create', superAdminMiddleware, async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup_${timestamp}.sql`;
        const filepath = path.join(BACKUP_DIR, filename);
        const host = process.env.DB_HOST || 'localhost';
        const user = process.env.DB_USER || 'root';
        const password = process.env.DB_PASSWORD || '';
        const database = process.env.DB_NAME || 'edushare_db';

        let dumpCmd = `mysqldump -h ${host} -u ${user} `;
        if (password) {
            dumpCmd += `-p"${password}" `;
        }
        dumpCmd += `${database} > "${filepath}"`;

        await execPromise(dumpCmd);

        const pool = req.app.locals.pool;
        if (pool) {
            await pool.execute(
                'INSERT INTO AUDIT_LOG (MaND_ThucHien, HanhDong, ChiTiet) VALUES (?, ?, ?)',
                [req.user.MaND, 'TaoSaoLuu', `Tạo bản sao lưu thủ công: ${filename}`]
            );
        }

        res.status(200).json({ message: 'Tạo bản sao lưu thành công', filename });
    } catch (error) {
        console.error('Lỗi khi tạo backup:', error);
        res.status(500).json({ message: 'Quá trình sao lưu thất bại', error: error.message });
    }
});

router.delete('/:filename', superAdminMiddleware, async (req, res) => {
    try {
        const { filename } = req.params;
        
        if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({ message: 'Tên file không hợp lệ' });
        }

        const filepath = path.join(BACKUP_DIR, filename);

        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);

            const pool = req.app.locals.pool;
            if (pool) {
                await pool.execute(
                    'INSERT INTO AUDIT_LOG (MaND_ThucHien, HanhDong, ChiTiet) VALUES (?, ?, ?)',
                    [req.user.MaND, 'XoaSaoLuu', `Xóa bản sao lưu: ${filename}`]
                );
            }

            res.status(200).json({ message: 'Đã xóa bản sao lưu thành công' });
        } else {
            res.status(404).json({ message: 'Không tìm thấy file sao lưu' });
        }
    } catch (error) {
        console.error('Lỗi khi xóa backup:', error);
        res.status(500).json({ message: 'Không thể xóa bản sao lưu' });
    }
});

router.get('/settings', superAdminMiddleware, async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const [rows] = await pool.execute(
            'SELECT TenCauHinh, GiaTri FROM CAUHINH_HETHONG WHERE TenCauHinh IN ("AUTO_BACKUP_ENABLED", "AUTO_BACKUP_SCHEDULE", "MAX_BACKUPS_RETAIN")'
        );
        
        const settings = {
            AUTO_BACKUP_ENABLED: 0,
            AUTO_BACKUP_SCHEDULE: 'daily',
            MAX_BACKUPS_RETAIN: 5
        };
        
        rows.forEach(r => {
            if (r.TenCauHinh === 'AUTO_BACKUP_ENABLED') settings.AUTO_BACKUP_ENABLED = parseInt(r.GiaTri);
            if (r.TenCauHinh === 'AUTO_BACKUP_SCHEDULE') settings.AUTO_BACKUP_SCHEDULE = r.GiaTri;
            if (r.TenCauHinh === 'MAX_BACKUPS_RETAIN') settings.MAX_BACKUPS_RETAIN = parseInt(r.GiaTri);
        });

        res.status(200).json(settings);
    } catch (error) {
        console.error('Lỗi lấy settings backup:', error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
});

router.put('/settings', superAdminMiddleware, async (req, res) => {
    try {
        const { AUTO_BACKUP_ENABLED, AUTO_BACKUP_SCHEDULE, MAX_BACKUPS_RETAIN } = req.body;
        const pool = req.app.locals.pool;
        
        if (AUTO_BACKUP_ENABLED !== undefined) {
            await pool.execute('UPDATE CAUHINH_HETHONG SET GiaTri = ? WHERE TenCauHinh = "AUTO_BACKUP_ENABLED"', [AUTO_BACKUP_ENABLED.toString()]);
        }
        if (AUTO_BACKUP_SCHEDULE !== undefined) {
            await pool.execute('UPDATE CAUHINH_HETHONG SET GiaTri = ? WHERE TenCauHinh = "AUTO_BACKUP_SCHEDULE"', [AUTO_BACKUP_SCHEDULE.toString()]);
        }
        if (MAX_BACKUPS_RETAIN !== undefined) {
            await pool.execute('UPDATE CAUHINH_HETHONG SET GiaTri = ? WHERE TenCauHinh = "MAX_BACKUPS_RETAIN"', [MAX_BACKUPS_RETAIN.toString()]);
        }
        
        await pool.execute(
            'INSERT INTO AUDIT_LOG (MaND_ThucHien, HanhDong, ChiTiet) VALUES (?, ?, ?)',
            [req.user.MaND, 'CapNhatSaoLuu', 'Cập nhật cài đặt sao lưu tự động']
        );

        res.status(200).json({ message: 'Lưu cài đặt thành công' });
    } catch (error) {
        console.error('Lỗi lưu settings backup:', error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
});

module.exports = router;
