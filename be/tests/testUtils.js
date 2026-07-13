const jwt = require('jsonwebtoken');

// Đảm bảo JWT_SECRET được set trong môi trường test
process.env.JWT_SECRET = 'test_secret_key';

/**
 * Sinh token xác thực cho các test case cần đăng nhập
 * @param {Object} user - Object chứa { MaND, VaiTro, HoTen }
 */
function generateTestToken(user = {}) {
    const payload = {
        MaND: user.MaND || 1,
        VaiTro: user.VaiTro || 'SinhVien',
        HoTen: user.HoTen || 'Test User'
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Mock hàm pool.execute() và pool.getConnection() của MySQL
 * @param {Object} app - Express app
 * @param {Function} logic - Hàm chứa logic mock, trả về mảng kết quả mock: [[rows], [fields]]
 */
function mockPoolExecute(app, logic) {
    if (app.locals.pool) {
        if (app.locals.pool.execute) {
            jest.spyOn(app.locals.pool, 'execute').mockImplementation(logic);
        }
        if (app.locals.pool.getConnection) {
            jest.spyOn(app.locals.pool, 'getConnection').mockResolvedValue({
                execute: logic,
                beginTransaction: jest.fn().mockResolvedValue(),
                commit: jest.fn().mockResolvedValue(),
                rollback: jest.fn().mockResolvedValue(),
                release: jest.fn()
            });
        }
        return true;
    }
    return null;
}

module.exports = {
    generateTestToken,
    mockPoolExecute
};
