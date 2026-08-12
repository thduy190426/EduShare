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
    return (req, res, next) => {
        try {
            for (const field of fieldsToCheck) {
                const value = req.body[field];
                if (value && containsSpam(value)) {
                    return res.status(400).json({ 
                        message: `Nội dung chứa từ khóa vi phạm tiêu chuẩn cộng đồng (Spam/Từ khóa cấm).` 
                    });
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
