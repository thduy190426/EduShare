const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: isTest ? 1000 : 10, 
    message: { message: 'Bạn đã đạt giới hạn tải lên tài liệu. Vui lòng thử lại sau 1 giờ.' },
    standardHeaders: true, 
    legacyHeaders: false, 
});

const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: isTest ? 1000 : 30, 
    message: { message: 'Bạn đã đánh giá quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: isTest ? 1000 : 5, 
    message: { message: 'Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau 1 giờ.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: isTest ? 1000 : 5, 
    message: { message: 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: isTest ? 1000 : 5, 
    message: { message: 'Bạn đã đăng ký quá nhiều tài khoản. Vui lòng thử lại sau 1 giờ.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: isTest ? 1000 : 3, 
    message: { message: 'Bạn đã gửi liên hệ quá nhiều lần. Vui lòng thử lại sau 1 giờ.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, 
    max: isTest ? 1000 : 3, 
    message: { message: 'Bạn đã yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau 5 phút.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const downloadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isTest ? 1000 : 30,
    message: { message: 'Bạn đã tải tài liệu quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const commentLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: isTest ? 1000 : 5, 
    message: { message: 'Bạn bình luận quá nhanh (giới hạn 5 lần/phút). Vui lòng thử lại sau 1 phút.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: isTest ? 1000 : 10, 
    message: { message: 'Bạn đã yêu cầu tạo giao dịch quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    uploadLimiter,
    rateLimiter,
    reportLimiter,
    loginLimiter,
    registerLimiter,
    contactLimiter,
    otpLimiter,
    downloadLimiter,
    commentLimiter,
    paymentLimiter
};
