const jwt = require('jsonwebtoken');
const { getRedisClient } = require('../config/redis');

const authMiddleware = async (req, res, next) => {
    let token = null;
    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    } else {
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else if (req.query && req.query.token) {
            token = req.query.token;
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Không tìm thấy token xác thực.' });
    }

    try {
        const redisClient = getRedisClient();
        if (redisClient) {
            const isBlacklisted = await redisClient.get(`bl_${token}`);
            if (isBlacklisted) {
                return res.status(401).json({ message: 'Token đã bị vô hiệu hóa (Đăng xuất).' });
            }
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const pool = req.app.locals.pool;
        if (pool) {
            const [userRows] = await pool.execute('SELECT TrangThai, VaiTro, AdminRole FROM NGUOIDUNG WHERE MaND = ?', [decoded.MaND]);
            if (userRows.length === 0) {
                return res.status(401).json({ message: 'Người dùng không tồn tại.' });
            }
            if (userRows[0].TrangThai !== 'HoatDong') {
                return res.status(403).json({ message: 'Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động.' });
            }
            decoded.VaiTro = userRows[0].VaiTro;
            decoded.AdminRole = userRows[0].AdminRole;
        }

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
};

const adminMiddleware = async (req, res, next) => {
    await authMiddleware(req, res, () => {
        if (!req.user) {
            return res.status(401).json({ message: 'Không tìm thấy thông tin user.' });
        }
        if (req.user.VaiTro === 'Admin') {
            next();
        } else {
            return res.status(403).json({ message: 'Chỉ Admin mới có quyền thực hiện chức năng này.' });
        }
    });
};

const superAdminMiddleware = async (req, res, next) => {
    await authMiddleware(req, res, () => {
        if (!req.user) {
            return res.status(401).json({ message: 'Không tìm thấy thông tin user.' });
        }
        if (req.user.VaiTro === 'Admin' && req.user.AdminRole === 'SuperAdmin') {
            next();
        } else {
            return res.status(403).json({ message: 'Chỉ Super Admin mới có quyền thực hiện chức năng này.' });
        }
    });
};

const teacherMiddleware = async (req, res, next) => {
    await authMiddleware(req, res, () => {
        if (!req.user) {
            return res.status(401).json({ message: 'Chưa xác thực người dùng.' });
        }
        if (req.user.VaiTro === 'GiaoVien' || req.user.VaiTro === 'Admin') {
            next();
        } else {
            return res.status(403).json({ message: 'Bạn không có quyền thực hiện chức năng này.' });
        }
    });
};

module.exports = {
    authMiddleware,
    adminMiddleware,
    superAdminMiddleware,
    teacherMiddleware
};
