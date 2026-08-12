const { z } = require('zod');

const updateProfileSchema = z.object({
    hoTen: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(100, 'Họ tên quá dài'),
    matKhauCu: z.string().optional(),
    matKhauMoi: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự').optional(),
    tuoi: z.union([
        z.number().int().min(1).max(150),
        z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1 && n <= 150, { message: "Tuổi không hợp lệ" })
    ]).optional().nullable(),
    gioiTinh: z.string().optional().nullable(),
    diaChi: z.string().max(255, 'Địa chỉ quá dài').optional().nullable(),
    truongHoc: z.string().max(255, 'Tên trường quá dài').optional().nullable(),
    khoaNganh: z.string().max(255, 'Tên khoa ngành quá dài').optional().nullable(),
    otp: z.string().optional(),
    hienThiLichSuTai: z.union([z.boolean(), z.number()]).optional(),
    hienThiDanhGia: z.union([z.boolean(), z.number()]).optional()
});

module.exports = {
    updateProfileSchema
};
