require('dotenv').config();

const getBlacklist = () => {
    if (!process.env.SPAM_BLACKLIST) return [];
    return process.env.SPAM_BLACKLIST
        .split(',')
        .map(word => word.trim().toLowerCase())
        .filter(word => word.length > 0);
};

const containsSpam = (text) => {
    if (!text || typeof text !== 'string') return false;

    const lowerText = text.toLowerCase();
    const blacklist = getBlacklist();

    for (const keyword of blacklist) {
        if (lowerText.includes(keyword)) {
            return true;
        }
    }

    return false;
};

const moderationMiddleware = (fieldsToCheck = []) => {
    return async (req, res, next) => {
        try {
            const pool = req.app.locals.pool;
            let blacklist = [];

            if (pool) {
                const [settingRows] = await pool.execute('SELECT GiaTri FROM CAUHINH_HETHONG WHERE TenCauHinh = "BAD_WORDS"');
                if (settingRows.length > 0 && settingRows[0].GiaTri) {
                    blacklist = settingRows[0].GiaTri.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
                }
            }

            if (blacklist.length === 0) {
                blacklist = getBlacklist();
            }

            for (const field of fieldsToCheck) {
                const value = req.body[field];
                if (value && typeof value === 'string') {
                    const lowerText = value.toLowerCase();
                    for (const keyword of blacklist) {
                        if (lowerText.includes(keyword)) {
                            return res.status(400).json({ 
                                message: `Nội dung chứa từ khóa vi phạm tiêu chuẩn cộng đồng (Spam/Từ khóa cấm).` 
                            });
                        }
                    }
                }
            }
            next();
        } catch (error) {
            console.error('Moderation error:', error);
            next();
        }
    };
};

module.exports = {
    containsSpam,
    moderationMiddleware
};
