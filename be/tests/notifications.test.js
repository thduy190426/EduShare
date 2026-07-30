const request = require('supertest');
const app = require('../server');
const { mockPoolExecute, generateTestToken } = require('./testUtils');

describe('Notifications API', () => {

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        if (app.locals.pool) {
            await app.locals.pool.end();
        }
    });

    describe('GET /api/notifications/', () => {
        it('Nên lấy danh sách thông báo thành công', async () => {
            const token = generateTestToken({ MaND: 1 });
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                if (query.includes('DELETE FROM THONGBAO')) return Promise.resolve([{ affectedRows: 0 }]);
                if (query.includes('SELECT COUNT(*) AS total FROM THONGBAO')) return Promise.resolve([[{ total: 1 }]]);
                if (query.includes('SELECT * FROM THONGBAO')) {
                    return Promise.resolve([[{ MaTB: 1, NoiDung: 'Test' }]]);
                }
                return Promise.resolve([[]]);
            });

            const response = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${token}`);
            
            expect(response.status).toBe(200);
            expect(response.body.notifications[0].NoiDung).toBe('Test');
        });
        
        it('Nên báo lỗi 500 nếu db lỗi', async () => {
            const token = generateTestToken({ MaND: 1 });
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                return Promise.reject(new Error('DB Error'));
            });

            const response = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${token}`);
            
            expect(response.status).toBe(500);
        });
    });

    describe('GET /api/notifications/unread-count', () => {
        it('Nên lấy số lượng thông báo chưa đọc thành công', async () => {
            const token = generateTestToken({ MaND: 1 });
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                if (query.includes('SELECT COUNT(*) AS count FROM THONGBAO')) {
                    return Promise.resolve([[{ count: 5 }]]);
                }
                return Promise.resolve([[]]);
            });

            const response = await request(app)
                .get('/api/notifications/unread-count')
                .set('Authorization', `Bearer ${token}`);
            
            expect(response.status).toBe(200);
            expect(response.body.count).toBe(5);
        });
    });

    describe('PUT /api/notifications/read-all', () => {
        it('Nên đánh dấu tất cả là đã đọc thành công', async () => {
            const token = generateTestToken({ MaND: 1 });
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                if (query.includes('UPDATE THONGBAO')) {
                    return Promise.resolve([{ affectedRows: 2 }]);
                }
                return Promise.resolve([[]]);
            });

            const response = await request(app)
                .put('/api/notifications/read-all')
                .set('Authorization', `Bearer ${token}`);
            
            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Đã đánh dấu tất cả là đã đọc.');
        });
    });

    describe('PUT /api/notifications/:maTB/read', () => {
        it('Nên báo lỗi 404 nếu thông báo không tồn tại', async () => {
            const token = generateTestToken({ MaND: 1 });
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                if (query.includes('UPDATE THONGBAO')) {
                    return Promise.resolve([{ affectedRows: 0 }]);
                }
                return Promise.resolve([[]]);
            });

            const response = await request(app)
                .put('/api/notifications/999/read')
                .set('Authorization', `Bearer ${token}`);
            
            expect(response.status).toBe(404);
        });

        it('Nên đánh dấu đã đọc một thông báo thành công', async () => {
            const token = generateTestToken({ MaND: 1 });
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                if (query.includes('UPDATE THONGBAO')) {
                    return Promise.resolve([{ affectedRows: 1 }]);
                }
                return Promise.resolve([[]]);
            });

            const response = await request(app)
                .put('/api/notifications/1/read')
                .set('Authorization', `Bearer ${token}`);
            
            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Đã đánh dấu đọc.');
        });
    });

    describe('DELETE /api/notifications/all', () => {
        it('Nên xóa tất cả thông báo thành công', async () => {
            const token = generateTestToken({ MaND: 1 });
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                if (query.includes('DELETE FROM THONGBAO')) {
                    return Promise.resolve([{ affectedRows: 3 }]);
                }
                return Promise.resolve([[]]);
            });

            const response = await request(app)
                .delete('/api/notifications/all')
                .set('Authorization', `Bearer ${token}`);
            
            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Đã xoá tất cả thông báo.');
        });
    });

    describe('DELETE /api/notifications/:maTB', () => {
        it('Nên báo lỗi 404 nếu thông báo không tồn tại', async () => {
            const token = generateTestToken({ MaND: 1 });
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                if (query.includes('DELETE FROM THONGBAO')) {
                    return Promise.resolve([{ affectedRows: 0 }]);
                }
                return Promise.resolve([[]]);
            });

            const response = await request(app)
                .delete('/api/notifications/999')
                .set('Authorization', `Bearer ${token}`);
            
            expect(response.status).toBe(404);
        });

        it('Nên xóa một thông báo thành công', async () => {
            const token = generateTestToken({ MaND: 1 });
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                if (query.includes('DELETE FROM THONGBAO')) {
                    return Promise.resolve([{ affectedRows: 1 }]);
                }
                return Promise.resolve([[]]);
            });

            const response = await request(app)
                .delete('/api/notifications/1')
                .set('Authorization', `Bearer ${token}`);
            
            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Đã xóa thông báo.');
        });
    });

});
