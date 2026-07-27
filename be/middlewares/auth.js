const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Không tìm thấy token xác thực.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const pool = req.app.locals.pool;
        if (pool) {
            const [userRows] = await pool.execute('SELECT TrangThai FROM NGUOIDUNG WHERE MaND = ?', [decoded.MaND]);
            if (userRows.length === 0) {
                return res.status(401).json({ message: 'Người dùng không tồn tại.' });
            }
            if (userRows[0].TrangThai !== 'HoatDong') {
                return res.status(403).json({ message: 'Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động.' });
            }
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
    teacherMiddleware
};
