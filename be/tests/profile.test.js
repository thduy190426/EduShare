const request = require('supertest');
const app = require('../server');
const { mockPoolExecute, generateTestToken } = require('./testUtils');

describe('User Profile API', () => {

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        if (app.locals.pool) {
            await app.locals.pool.end();
        }
    });

    it('Nên trả về 401 nếu gọi API profile mà không có token', async () => {
        const response = await request(app).get('/api/users/profile');
        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Không tìm thấy token xác thực.');
    });

    it('Nên trả về thông tin profile nếu token hợp lệ', async () => {
        const token = generateTestToken({ MaND: 1 });

        mockPoolExecute(app, (query, params) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) {
                return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            }

            if (query.includes('SELECT MaND, HoTen, Email, VaiTro, AvatarURL, Tuoi, GioiTinh, DiaChi')) {
                return Promise.resolve([[{
                    MaND: 1, HoTen: 'Test User', Email: 'test@example.com', VaiTro: 'SinhVien'
                }]]);
            }
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .get('/api/users/profile')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.profile.HoTen).toBe('Test User');
    });

    it('Nên cập nhật thông tin cá nhân thành công', async () => {
        const token = generateTestToken({ MaND: 1 });

        mockPoolExecute(app, (query, params) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) {
                return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            }
            if (query.includes('UPDATE NGUOIDUNG SET')) {
                return Promise.resolve([{ affectedRows: 1 }]);
            }
            if (query.includes('SELECT MaND, HoTen, Email, VaiTro, AvatarURL, Tuoi, GioiTinh, DiaChi FROM NGUOIDUNG')) {
                return Promise.resolve([[{
                    MaND: 1, HoTen: 'Updated Name', Email: 'test@example.com', Tuoi: 25, GioiTinh: 'Nam', DiaChi: 'HN'
                }]]);
            }
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .put('/api/users/profile')
            .set('Authorization', `Bearer ${token}`)
            .send({ hoTen: 'Updated Name', tuoi: 25, gioiTinh: 'Nam', diaChi: 'HN' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Cập nhật hồ sơ thành công.');
        expect(response.body.token).toBeDefined();
    });

    it('Nên báo lỗi 404 nếu user không tồn tại khi lấy profile', async () => {
        const token = generateTestToken({ MaND: 99 }); 

        mockPoolExecute(app, (query) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            if (query.includes('SELECT MaND, HoTen, Email, VaiTro, AvatarURL, Tuoi, GioiTinh, DiaChi FROM NGUOIDUNG')) {
                return Promise.resolve([[]]);
            }
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .get('/api/users/profile')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Không tìm thấy người dùng.');
    });

    it('Nên báo lỗi 500 nếu xảy ra lỗi máy chủ', async () => {
        const token = generateTestToken({ MaND: 1 }); 

        mockPoolExecute(app, (query) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            return Promise.reject(new Error('Lỗi database'));
        });

        const response = await request(app)
            .get('/api/users/profile')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(500);
    });

});
