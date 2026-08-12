const request = require('supertest');
const app = require('../server');
const { mockPoolExecute, generateTestToken } = require('./testUtils');

describe('Admin API', () => {

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        if (app.locals.pool) {
            await app.locals.pool.end();
        }
    });

    it('Nên báo lỗi 403 nếu user thường cố truy cập Admin Dashboard', async () => {
        const token = generateTestToken({ MaND: 1, VaiTro: 'SinhVien' }); 

        mockPoolExecute(app, (query) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .get('/api/admin/documents/list')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Bạn không có quyền thực hiện chức năng này.');
    });

    it('Nên trả về danh sách tài liệu duyệt nếu là Admin', async () => {
        const token = generateTestToken({ MaND: 99, VaiTro: 'Admin' }); 

        mockPoolExecute(app, (query) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) {
                return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            }
            if (query.includes('COUNT(*)')) {
                return Promise.resolve([[{ total: 1 }]]);
            }
            if (query.includes('SELECT') && query.includes('TL.MaTL')) {
                return Promise.resolve([[{ MaTL: 1, TenTL: 'Tài liệu toán' }]]);
            }
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .get('/api/admin/documents/list')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBe(1);
    });

    it('Nên báo lỗi 404 nếu thay đổi trạng thái user không tồn tại', async () => {
        const token = generateTestToken({ MaND: 99, VaiTro: 'Admin' }); 

        mockPoolExecute(app, (query) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            if (query.includes('SELECT VaiTro FROM NGUOIDUNG WHERE MaND = ?')) {
                return Promise.resolve([[]]); 
            }
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .put('/api/admin/users/123/status')
            .set('Authorization', `Bearer ${token}`)
            .send({ trangThai: 'BiKhoa' });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Không tìm thấy người dùng.');
    });

    it('Nên báo lỗi 500 nếu xảy ra lỗi máy chủ trong Admin API', async () => {
        const token = generateTestToken({ MaND: 99, VaiTro: 'Admin' }); 

        mockPoolExecute(app, (query) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            return Promise.reject(new Error('Lỗi database'));
        });

        const response = await request(app)
            .get('/api/admin/users')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(500);
    });

});
