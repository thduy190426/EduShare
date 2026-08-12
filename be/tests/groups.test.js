const request = require('supertest');
const app = require('../server');
const { mockPoolExecute, generateTestToken } = require('./testUtils');

describe('Groups API', () => {

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        if (app.locals.pool) {
            await app.locals.pool.end();
        }
    });

    it('Nên báo lỗi 400 nếu tạo nhóm thiếu tên', async () => {
        const token = generateTestToken({ MaND: 1 });

        mockPoolExecute(app, (query) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .post('/api/groups')
            .set('Authorization', `Bearer ${token}`)
            .send({ moTa: 'Nhóm học toán', maMonHoc: 1 }); 

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Tên nhóm không được để trống.');
    });

    it('Nên tạo nhóm thành công', async () => {
        const token = generateTestToken({ MaND: 1 });

        mockPoolExecute(app, (query) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) {
                return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            }
            if (query.includes('SELECT MaMonHoc FROM MONHOC')) {
                return Promise.resolve([[{ MaMonHoc: 1 }]]); 
            }
            if (query.includes('INSERT INTO NHOM')) {
                return Promise.resolve([{ insertId: 10 }]);
            }
            if (query.includes('INSERT INTO THANHVIEN_NHOM')) {
                return Promise.resolve([{ affectedRows: 1 }]);
            }
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .post('/api/groups')
            .set('Authorization', `Bearer ${token}`)
            .send({ tenNhom: 'Toán Cao Cấp', moTa: 'Học nhóm', maMonHoc: 1 });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Tạo nhóm thành công.');
        expect(response.body.maNhom).toBe(10);
    });
    it('Nên báo lỗi 404 nếu thay đổi trạng thái nhóm không tồn tại', async () => {
        const token = generateTestToken({ MaND: 99, VaiTro: 'Admin' }); 

        mockPoolExecute(app, (query) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            if (query.includes('SELECT TrangThai FROM NHOM WHERE MaNhom = ?')) return Promise.resolve([[]]);
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .put('/api/admin/groups/999/status')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Không tìm thấy nhóm.');
    });

});
