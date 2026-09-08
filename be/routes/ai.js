const express = require('express');
const router = express.Router();
const { askAIAssistant } = require('../services/aiService');
const { authMiddleware } = require('../middlewares/auth');

router.post('/ask', authMiddleware, async (req, res) => {
    try {
        const db = req.app.locals.pool;
        const { query } = req.body;
        if (!query || query.trim() === '') {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập câu hỏi.' });
        }

        const keywords = query.split(' ').filter(k => k.length > 2);
        let contextDocs = [];

        if (keywords.length > 0) {
            let sql = `
                SELECT tl.MaTL, tl.TenTL, tl.MoTa, tl.SoLuotTai, mh.TenMonHoc 
                FROM TAILIEU tl 
                LEFT JOIN MONHOC mh ON tl.MaMonHoc = mh.MaMonHoc
                WHERE tl.TrangThaiKiemDuyet = 'DaDuyet' AND tl.IsDeleted = FALSE AND (
            `;
            const conditions = [];
            const values = [];
            keywords.forEach(kw => {
                conditions.push(`(tl.TenTL LIKE ? OR tl.MoTa LIKE ? OR mh.TenMonHoc LIKE ?)`);
                values.push(`%${kw}%`, `%${kw}%`, `%${kw}%`);
            });
            sql += conditions.join(' OR ') + `) ORDER BY tl.SoLuotTai DESC LIMIT 5`;

            const [docs] = await db.query(sql, values);
            contextDocs = docs;
        }

        const aiResponse = await askAIAssistant(query, contextDocs);

        if (!aiResponse) {
             return res.status(500).json({ success: false, message: 'Lỗi khi kết nối AI.' });
        }

        res.json({ success: true, answer: aiResponse, docs: contextDocs });
    } catch (error) {
        console.error('Error in /api/ai/ask:', error);
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
});

module.exports = router;
