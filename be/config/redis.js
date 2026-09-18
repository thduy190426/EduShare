const Redis = require('ioredis');
const winstonLogger = require('./logger');

let redisClient = null;

const connectRedis = async () => {
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        
        const redisConfig = {
            retryStrategy: (times) => Math.min(times * 50, 2000)
        };

        if (process.env.REDIS_PASSWORD) {
            redisConfig.password = process.env.REDIS_PASSWORD;
        }

        redisClient = new Redis(redisUrl, redisConfig);

        redisClient.on('error', (err) => {
            winstonLogger.error('Redis Client Error', err);
            console.error('Redis Client Error', err);
        });

        redisClient.on('connect', () => {
            winstonLogger.info('Kết nối Redis thành công!');
            console.log('\x1b[32m%s\x1b[0m', 'Đã kết nối thành công tới Redis!');
        });

        return redisClient;
    } catch (error) {
        winstonLogger.error('Lỗi khi khởi tạo Redis:', error);
        console.error('Lỗi khi khởi tạo Redis:', error);
        return null;
    }
};

const getRedisClient = () => redisClient;

module.exports = { connectRedis, getRedisClient };
