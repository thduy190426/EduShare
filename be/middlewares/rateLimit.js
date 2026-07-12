const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: 10, 
    message: { message: 'Bạn đã đạt giới hạn tải lên tài liệu. Vui lòng thử lại sau 1 giờ.' },
    standardHeaders: true, 
    legacyHeaders: false, 
});

const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 30, 
    message: { message: 'Bạn đã đánh giá quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: 5, 
    message: { message: 'Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau 1 giờ.' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    uploadLimiter,
    rateLimiter,
    reportLimiter
};
