const request = require('supertest');
const app = require('../server');
const bcrypt = require('bcrypt');
const { mockPoolExecute } = require('./testUtils');

describe('Auth API - Đăng nhập và Đăng ký', () => {

    afterEach(() => {
        jest.restoreAllMocks(); 
    });

    afterAll(async () => {
        if (app.locals.pool) {
            await app.locals.pool.end();
        }
    });

    it('Nên báo lỗi 400 nếu gửi thiếu email hoặc mật khẩu (Login)', async () => {
        const response = await request(app)
            .post('/api/login')
            .send({ email: 'test@gmail.com' }); 

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Vui lòng cung cấp email và mật khẩu.');
    });

    it('Nên báo lỗi 400 nếu bỏ trống dữ liệu khi đăng ký (Register)', async () => {
        const response = await request(app)
            .post('/api/register')
            .send({ email: 'newuser@gmail.com' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Vui lòng điền đầy đủ thông tin.');
    });

    it('Nên đăng nhập thành công và trả về token hợp lệ', async () => {
        mockPoolExecute(app, (query, params) => {
            if (query.includes('SELECT * FROM NGUOIDUNG WHERE Email = ?')) {
                return Promise.resolve([[{ 
                    MaND: 1, 
                    Email: 'success@example.com', 
                    MatKhau: 'hashed_password',
                    VaiTro: 'SinhVien',
                    TrangThai: 'HoatDong'
                }]]);
            }
            return Promise.resolve([[]]);
        });

        jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

        const response = await request(app)
            .post('/api/login')
            .send({ email: 'success@example.com', matKhau: 'password123' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Đăng nhập thành công.');
        expect(response.body.token).toBeDefined();
    });

    it('Nên báo lỗi 403 nếu tài khoản bị khóa', async () => {
        mockPoolExecute(app, (query, params) => {
            if (query.includes('SELECT * FROM NGUOIDUNG WHERE Email = ?')) {
                return Promise.resolve([[{ 
                    Email: 'banned@example.com', 
                    TrangThai: 'BiKhoa'
                }]]);
            }
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .post('/api/login')
            .send({ email: 'banned@example.com', matKhau: 'password' });

        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Tài khoản của bạn đã bị khóa.');
    });

    it('Nên đăng ký thành công người dùng mới', async () => {
        mockPoolExecute(app, (query, params) => {
            if (query.includes('SELECT Email FROM NGUOIDUNG WHERE Email = ?')) {
                return Promise.resolve([[]]); 
            }
            if (query.includes('INSERT INTO NGUOIDUNG')) {
                return Promise.resolve([{ insertId: 99 }]); 
            }
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .post('/api/register')
            .send({ hoTen: 'Test User', email: 'new@example.com', matKhau: 'pass123', vaiTro: 'SinhVien' });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Đăng ký thành công.');
        expect(response.body.maND).toBe(99);
    });

    it('Nên báo lỗi 409 nếu đăng ký bằng email đã tồn tại', async () => {
        mockPoolExecute(app, (query, params) => {
            if (query.includes('SELECT Email FROM NGUOIDUNG WHERE Email = ?')) {
                return Promise.resolve([[{ Email: 'existing@example.com' }]]);
            }
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .post('/api/register')
            .send({ hoTen: 'Test User', email: 'existing@example.com', matKhau: 'pass123', vaiTro: 'SinhVien' });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe('Email đã được sử dụng.');
    });

    it('Nên báo lỗi 404 nếu email đăng nhập không tồn tại', async () => {
        mockPoolExecute(app, (query, params) => {
            if (query.includes('SELECT * FROM NGUOIDUNG WHERE Email = ?')) {
                return Promise.resolve([[]]);
            }
            return Promise.resolve([[]]);
        });

        const response = await request(app)
            .post('/api/login')
            .send({ email: 'notfound@example.com', matKhau: 'pass123' });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Email không tồn tại.');
    });

    it('Nên báo lỗi 500 nếu xảy ra lỗi máy chủ', async () => {
        mockPoolExecute(app, (query, params) => {
            return Promise.reject(new Error('Lỗi database mô phỏng'));
        });

        const response = await request(app)
            .post('/api/login')
            .send({ email: 'error@example.com', matKhau: 'pass123' });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Lỗi máy chủ.');
    });

});
