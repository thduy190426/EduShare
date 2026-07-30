const request = require('supertest');
const app = require('../server');
const { mockPoolExecute, generateTestToken } = require('./testUtils');

describe('Payment API', () => {

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        if (app.locals.pool) {
            await app.locals.pool.end();
        }
    });

    it('Nên lấy danh sách gói xu thành công', async () => {
        const response = await request(app).get('/api/payment/packages');
        expect(response.status).toBe(200);
        expect(response.body.packages.length).toBeGreaterThan(0);
    });

    it('Nên báo lỗi 400 nếu tạo giao dịch sai gói', async () => {
        const token = generateTestToken({ MaND: 1 });
        mockPoolExecute(app, (query) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            return Promise.resolve([[]]);
        });
        const response = await request(app)
            .post('/api/payment/create')
            .set('Authorization', `Bearer ${token}`)
            .send({ packageId: 'invalid_pkg' });
            
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Gói nạp không hợp lệ.');
    });

    it('Nên tạo giao dịch nạp xu thành công', async () => {
        const token = generateTestToken({ MaND: 1 });
        mockPoolExecute(app, (query) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            if (query.includes('SELECT SoTien, SoXu FROM GOI_NAPXU')) return Promise.resolve([[{ SoTien: 10000, SoXu: 100 }]]);
            if (query.includes('SELECT MaGD FROM GIAODICH_NAPXU')) return Promise.resolve([[]]);
            if (query.includes('INSERT INTO GIAODICH_NAPXU')) return Promise.resolve([{ insertId: 10 }]);
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .post('/api/payment/create')
            .set('Authorization', `Bearer ${token}`)
            .send({ packageId: 'G10K' });
            
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('maGD');
    });

    it('Nên báo lỗi 404 khi admin duyệt giao dịch không tồn tại', async () => {
        const token = generateTestToken({ MaND: 99, VaiTro: 'Admin' });
        mockPoolExecute(app, (query) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            if (query.includes('SELECT * FROM GIAODICH_NAPXU')) return Promise.resolve([[]]);
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .post('/api/payment/approve/999')
            .set('Authorization', `Bearer ${token}`);
            
        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Không tìm thấy giao dịch.');
    });
});
