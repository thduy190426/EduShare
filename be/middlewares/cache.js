const { getRedisClient } = require('../config/redis');

/**
 * Middleware để cache các request GET
 * @param {number} duration Thời gian cache (giây)
 */
const cacheMiddleware = (duration = 60) => {
    return async (req, res, next) => {
        if (req.method !== 'GET') {
            return next();
        }

        const redisClient = getRedisClient();
        if (!redisClient) {
            return next();
        }

        try {
            const userId = req.user ? req.user.MaND : 'guest';
            const key = `cache:${userId}:${req.originalUrl || req.url}`;

            const cachedResponse = await redisClient.get(key);

            if (cachedResponse) {
                res.setHeader('X-Cache', 'HIT');
                return res.json(JSON.parse(cachedResponse));
            }

            res.setHeader('X-Cache', 'MISS');
            const originalJson = res.json.bind(res);

            res.json = (body) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    redisClient.set(key, JSON.stringify(body), 'EX', duration)
                        .catch(err => console.error('Lỗi lưu cache:', err));
                }
                originalJson(body);
            };

            next();
        } catch (error) {
            console.error('Lỗi cache middleware:', error);
            next();
        }
    };
};

module.exports = { cacheMiddleware };
