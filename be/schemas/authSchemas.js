const { z } = require('zod');

const loginSchema = z.object({
    email: z.string().email('Email không hợp lệ'),
    matKhau: z.string().min(1, 'Mật khẩu không được để trống'),
    rememberLogin: z.boolean().optional(),
    recaptchaToken: z.string().optional()
});

const registerSchema = z.object({
    hoTen: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(100, 'Họ tên quá dài'),
    email: z.string().email('Email không hợp lệ'),
    matKhau: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
    truongHoc: z.string().optional().nullable(),
    khoaNganh: z.string().optional().nullable(),
    otp: z.string().min(6, 'Mã OTP không hợp lệ')
});

const twoFactorLoginSchema = z.object({
    tempToken: z.string().min(1, 'Thiếu token tạm thời'),
    totpCode: z.string().min(6, 'Mã 2FA không hợp lệ')
});

module.exports = {
    loginSchema,
    registerSchema,
    twoFactorLoginSchema
};
