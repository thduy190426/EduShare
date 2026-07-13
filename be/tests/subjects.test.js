const request = require('supertest');
const app = require('../server');
const { mockPoolExecute, generateTestToken } = require('./testUtils');

describe('Subjects API', () => {

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        if (app.locals.pool) {
            await app.locals.pool.end();
        }
    });

    it('Nên lấy danh sách môn học của tôi thành công', async () => {
        const token = generateTestToken({ MaND: 1 });

        mockPoolExecute(app, (query, params) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) {
                return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            }
            if (query.includes('SELECT') && query.includes('MH.MaMonHoc')) {
                return Promise.resolve([[{
                    MaMonHoc: 1, TenMonHoc: 'Toán', CapHoc: 'Đại học', SoTaiLieu: 5, SoNhom: 2
                }]]);
            }
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .get('/api/subjects/my')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.subjects.length).toBe(1);
        expect(response.body.subjects[0].TenMonHoc).toBe('Toán');
    });

    it('Nên theo dõi môn học thành công', async () => {
        const token = generateTestToken({ MaND: 1 });

        mockPoolExecute(app, (query, params) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) {
                return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            }
            if (query.includes('SELECT MaMonHoc, TenMonHoc FROM MONHOC')) {
                return Promise.resolve([[{ MaMonHoc: 2, TenMonHoc: 'Lý' }]]); // Môn học tồn tại
            }
            if (query.includes('INSERT IGNORE INTO NGUOIDUNG_MONHOC')) {
                return Promise.resolve([{ affectedRows: 1 }]);
            }
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .post('/api/subjects/2/follow')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Đã thêm vào môn học của tôi.');
    });

    it('Nên báo lỗi 404 nếu xóa môn học không tồn tại', async () => {
        const token = generateTestToken({ MaND: 99, VaiTro: 'Admin' }); 

        mockPoolExecute(app, (query) => {
            if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
            if (query.includes('DELETE FROM MONHOC')) return Promise.resolve([{ affectedRows: 0 }]);
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .delete('/api/admin/subjects/999')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Không tìm thấy môn học.');
    });

});
