const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { getRedisClient } = require('../config/redis');

const isTest = process.env.NODE_ENV === 'test';

const createRedisStore = (prefix) => {
    return new RedisStore({
        sendCommand: (...args) => getRedisClient().call(...args),
        prefix: prefix
    });
};

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: isTest ? 1000 : 5, 
    message: { message: 'Bạn đã đạt giới hạn tải lên tài liệu. Vui lòng thử lại sau 1 giờ.' },
    standardHeaders: true, 
    legacyHeaders: false, 
    store: createRedisStore('rl:upload:'),
});

const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: isTest ? 1000 : 30, 
    message: { message: 'Bạn đã đánh giá quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore('rl:rate:'),
});

const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: isTest ? 1000 : 5, 
    message: { message: 'Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau 1 giờ.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore('rl:report:'),
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: isTest ? 1000 : 5, 
    message: { message: 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore('rl:login:'),
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: isTest ? 1000 : 5, 
    message: { message: 'Bạn đã đăng ký quá nhiều tài khoản. Vui lòng thử lại sau 1 giờ.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore('rl:register:'),
});

const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: isTest ? 1000 : 3, 
    message: { message: 'Bạn đã gửi liên hệ quá nhiều lần. Vui lòng thử lại sau 1 giờ.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore('rl:contact:'),
});

const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, 
    max: isTest ? 1000 : 3, 
    message: { message: 'Bạn đã yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau 5 phút.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore('rl:otp:'),
});

const downloadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isTest ? 1000 : 30,
    message: { message: 'Bạn đã tải tài liệu quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore('rl:download:'),
});

const commentLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: isTest ? 1000 : 5, 
    message: { message: 'Bạn bình luận quá nhanh (giới hạn 5 lần/phút). Vui lòng thử lại sau 1 phút.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore('rl:comment:'),
});

const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: isTest ? 1000 : 10, 
    message: { message: 'Bạn đã yêu cầu tạo giao dịch quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore('rl:payment:'),
});

const groupPostLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: isTest ? 1000 : 3, 
    message: { message: 'Bạn đăng bài quá nhanh (giới hạn 3 bài/phút). Vui lòng thử lại sau 1 phút.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore('rl:group_post:'),
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
    paymentLimiter,
    groupPostLimiter
};
