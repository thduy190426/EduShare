const { getRedisClient } = require('../config/redis');

/**
 * Middleware để cache các request GET
 * @param {number} duration Thời gian cache (giây)
 * @param {boolean} isGlobal Cờ để đánh dấu cache toàn cục (không dùng userId)
 */
const cacheMiddleware = (duration = 60, isGlobal = false) => {
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
            const urlPath = req.originalUrl || req.url;
            const key = isGlobal ? `cache:global:${urlPath}` : `cache:${userId}:${urlPath}`;

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

const deleteCacheByPattern = async (pattern) => {
    const redisClient = getRedisClient();
    if (!redisClient) return;

    try {
        const stream = redisClient.scanStream({
            match: pattern,
            count: 100
        });

        stream.on('data', (keys) => {
            if (keys.length) {
                const pipeline = redisClient.pipeline();
                keys.forEach((key) => pipeline.del(key));
                pipeline.exec();
            }
        });

        stream.on('end', () => {
            console.log(`Đã dọn dẹp cache cho pattern: ${pattern}`);
        });
    } catch (error) {
        console.error('Lỗi xóa cache bằng pattern:', error);
    }
};

module.exports = { cacheMiddleware, deleteCacheByPattern };
