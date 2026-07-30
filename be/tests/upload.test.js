const request = require('supertest');
const app = require('../server');
const { mockPoolExecute, generateTestToken } = require('./testUtils');
const fs = require('fs');
const path = require('path');

const { PassThrough } = require('stream');

jest.mock('cloudinary', () => ({
    v2: {
        config: jest.fn(),
        uploader: {
            upload_stream: jest.fn((options, callback) => {
                const stream = new require('stream').PassThrough();
                stream.on('finish', () => {
                    callback(null, { secure_url: 'http://example.com/file.pdf' });
                });
                return stream;
            }),
            upload: jest.fn().mockResolvedValue({ secure_url: 'http://example.com/file.pdf' }),
            destroy: jest.fn().mockResolvedValue({ result: 'ok' })
        }
    }
}));

jest.mock('../services/virusScanner', () => ({
    scanFileVirus: jest.fn().mockResolvedValue({ safe: true, message: 'Safe' })
}));

describe('Documents API', () => {

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        if (app.locals.pool) {
            await app.locals.pool.end();
        }
    });

    describe('GET /api/documents/subjects', () => {
        it('Nên lấy danh sách môn học thành công', async () => {
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT MaMonHoc, TenMonHoc, CapHoc')) {
                    return Promise.resolve([[{ MaMonHoc: 1, TenMonHoc: 'Toan' }]]);
                }
                return Promise.resolve([[]]);
            });

            const response = await request(app).get('/api/documents/subjects');
            expect(response.status).toBe(200);
            expect(response.body.subjects[0].TenMonHoc).toBe('Toan');
        });
        
        it('Nên báo lỗi 500 nếu db lỗi', async () => {
            mockPoolExecute(app, () => Promise.reject(new Error('Lỗi DB')));
            const response = await request(app).get('/api/documents/subjects');
            expect(response.status).toBe(500);
        });
    });

    describe('POST /api/documents/upload', () => {
        it('Nên báo lỗi 400 nếu thiếu file', async () => {
            const token = generateTestToken();
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                return Promise.resolve([[]]);
            });

            const response = await request(app)
                .post('/api/documents/upload')
                .set('Authorization', `Bearer ${token}`)
                .field('tenTL', 'Test')
                .field('maMonHoc', 1);
            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Vui lòng chọn file tài liệu.');
        });

        it('Nên tải lên thành công', async () => {
            const token = generateTestToken();
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                if (query.includes('INSERT INTO TAILIEU')) return Promise.resolve([{ insertId: 1 }]);
                if (query.includes('SELECT MaND FROM NGUOIDUNG WHERE VaiTro = "Admin"')) return Promise.resolve([[{ MaND: 99 }]]);
                if (query.includes('INSERT INTO THONGBAO')) return Promise.resolve([{ insertId: 1 }]);
                return Promise.resolve([[]]);
            });

            const response = await request(app)
                .post('/api/documents/upload')
                .set('Authorization', `Bearer ${token}`)
                .field('tenTL', 'Test Document')
                .field('maMonHoc', 1)
                .attach('fileUpload', Buffer.from('dummy content'), 'test.pdf');
            
            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Tải lên tài liệu thành công.');
        });
    });

    describe('GET /api/documents/search', () => {
        it('Nên tìm kiếm tài liệu thành công', async () => {
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT COUNT(*) AS total')) return Promise.resolve([[{ total: 1 }]]);
                if (query.includes('SELECT')) {
                    return Promise.resolve([[{ MaTL: 1, TenTL: 'Test TL' }]]);
                }
                return Promise.resolve([[]]);
            });

            const response = await request(app).get('/api/documents/search?tuKhoa=test&maMonHoc=1');
            expect(response.status).toBe(200);
            expect(response.body.documents[0].TenTL).toBe('Test TL');
            expect(response.body.totalRecords).toBe(1);
        });
    });

    describe('GET /api/documents/:maTL/related', () => {
        it('Nên trả về 404 nếu tài liệu không tồn tại', async () => {
            mockPoolExecute(app, (query) => {
                return Promise.resolve([[]]);
            });
            const response = await request(app).get('/api/documents/999/related');
            expect(response.status).toBe(404);
        });

        it('Nên lấy tài liệu liên quan thành công', async () => {
            mockPoolExecute(app, (query) => {
                if (query.includes('WHERE MaTL = ?')) return Promise.resolve([[{ MaMonHoc: 1, LoaiFile: 'pdf' }]]);
                if (query.includes('GROUP BY')) return Promise.resolve([[{ MaTL: 2, TenTL: 'Related TL' }]]);
                return Promise.resolve([[]]);
            });
            const response = await request(app).get('/api/documents/1/related');
            expect(response.status).toBe(200);
            expect(response.body.documents[0].TenTL).toBe('Related TL');
        });
    });

    describe('GET /api/documents/:maTL', () => {
        it('Nên trả về 404 nếu tài liệu không tồn tại', async () => {
            mockPoolExecute(app, (query) => {
                if (query.includes('UPDATE TAILIEU SET SoLuotXem')) return Promise.resolve([{ affectedRows: 0 }]);
                if (query.includes('SELECT TL.*')) return Promise.resolve([[]]);
                return Promise.resolve([[]]);
            });
            const response = await request(app).get('/api/documents/999');
            expect(response.status).toBe(404);
        });

        it('Nên trả về chi tiết tài liệu thành công', async () => {
            mockPoolExecute(app, (query) => {
                if (query.includes('UPDATE TAILIEU SET SoLuotXem')) return Promise.resolve([{ affectedRows: 1 }]);
                if (query.includes('SELECT TL.*')) return Promise.resolve([[{ MaTL: 1, TenTL: 'TL 1' }]]);
                if (query.includes('SELECT BL.*')) return Promise.resolve([[{ MaBL: 1, NoiDung: 'Hay' }]]);
                return Promise.resolve([[]]);
            });
            const response = await request(app).get('/api/documents/1');
            expect(response.status).toBe(200);
            expect(response.body.document.TenTL).toBe('TL 1');
            expect(response.body.comments[0].NoiDung).toBe('Hay');
        });
    });

    describe('POST /api/documents/:maTL/bookmark', () => {
        it('Nên thêm bookmark thành công', async () => {
            const token = generateTestToken();
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                if (query.includes('SELECT * FROM BOOKMARK')) return Promise.resolve([[]]);
                if (query.includes('INSERT INTO BOOKMARK')) return Promise.resolve([{ affectedRows: 1 }]);
                return Promise.resolve([[]]);
            });
            const response = await request(app).post('/api/documents/1/bookmark').set('Authorization', `Bearer ${token}`);
            expect(response.status).toBe(200);
            expect(response.body.isBookmarked).toBe(true);
        });
    });

    describe('POST /api/documents/:maTL/rate', () => {
        it('Nên báo lỗi nếu số sao không hợp lệ', async () => {
            const token = generateTestToken();
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                return Promise.resolve([[]]);
            });
            const response = await request(app).post('/api/documents/1/rate').set('Authorization', `Bearer ${token}`).send({ soSao: 6 });
            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/documents/:maTL/comments', () => {
        it('Nên bình luận thành công', async () => {
            const token = generateTestToken();
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                if (query.includes('SELECT 1 FROM TAILIEU WHERE MaTL = ?')) return Promise.resolve([[{ 1: 1 }]]);
                if (query.includes('SELECT 1 FROM BINHLUAN WHERE MaND = ?')) return Promise.resolve([[]]);
                if (query.includes('INSERT INTO BINHLUAN')) return Promise.resolve([{ insertId: 1 }]);
                return Promise.resolve([[]]);
            });
            const response = await request(app)
                .post('/api/documents/1/comments')
                .set('Authorization', `Bearer ${token}`)
                .send({ noiDung: 'Bình luận test' });
            expect(response.status).toBe(201);
            expect(response.body.message).toBe('Bình luận thành công.');
        });
    });

    describe('PUT /api/documents/:maTL/verify', () => {
        it('Nên xác thực tài liệu thành công bởi giáo viên', async () => {
            const token = generateTestToken({ VaiTro: 'GiaoVien' });
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                if (query.includes('SELECT LaTaiLieuChinhThuc')) return Promise.resolve([[{ LaTaiLieuChinhThuc: 0 }]]);
                if (query.includes('UPDATE TAILIEU SET LaTaiLieuChinhThuc')) return Promise.resolve([{ affectedRows: 1 }]);
                return Promise.resolve([[]]);
            });
            const response = await request(app).put('/api/documents/1/verify').set('Authorization', `Bearer ${token}`);
            expect(response.status).toBe(200);
            expect(response.body.LaTaiLieuChinhThuc).toBe(true);
        });
    });

    describe('DELETE /api/documents/:maTL', () => {
        it('Nên trả về 404 nếu không tìm thấy tài liệu', async () => {
            const token = generateTestToken({ MaND: 1 });
            mockPoolExecute(app, (query) => {
                if (query.includes('SELECT TrangThai FROM NGUOIDUNG')) return Promise.resolve([[{ TrangThai: 'HoatDong' }]]);
                if (query.includes('SELECT MaND_NguoiDang')) return Promise.resolve([[]]);
                return Promise.resolve([[]]);
            });
            const response = await request(app).delete('/api/documents/999').set('Authorization', `Bearer ${token}`);
            expect(response.status).toBe(404);
        });
    });

});
