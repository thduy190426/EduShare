const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test_secret_key';

function generateTestToken(user = {}) {
    const payload = {
        MaND: user.MaND || 1,
        VaiTro: user.VaiTro || 'SinhVien',
        HoTen: user.HoTen || 'Test User'
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

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
