const express = require('express');
const router = express.Router();
const { authMiddleware, teacherMiddleware } = require('../middlewares/auth');
const QuizService = require('../services/quizService');
const ExcelJS = require('exceljs');
const { cacheMiddleware } = require('../middlewares/cache');

const getQuizService = (req) => new QuizService(req.app.locals.pool);

router.post('/questions', teacherMiddleware, async (req, res) => {
    try {
        const result = await getQuizService(req).createQuestion(req.user.MaND, req.body);
        res.status(201).json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.get('/questions/subject/:subjectId', teacherMiddleware, async (req, res) => {
    try {
        const result = await getQuizService(req).getQuestionsBySubject(req.params.subjectId);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.get('/questions/:id', teacherMiddleware, async (req, res) => {
    try {
        const question = await getQuizService(req).getQuestionById(req.params.id);
        if (!question) {
            return res.status(404).json({ error: 'Không tìm thấy câu hỏi' });
        }
        res.json(question);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.put('/questions/:id', teacherMiddleware, async (req, res) => {
    try {
        const result = await getQuizService(req).updateQuestion(req.params.id, req.body);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.post('/', teacherMiddleware, async (req, res) => {
    try {
        const result = await getQuizService(req).createQuiz(req.user.MaND, req.body);
        res.status(201).json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.put('/:id', teacherMiddleware, async (req, res) => {
    try {
        const result = await getQuizService(req).updateQuiz(req.params.id, req.user.MaND, req.body);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.delete('/questions/:id', teacherMiddleware, async (req, res) => {
    try {
        const result = await getQuizService(req).deleteQuestion(req.params.id);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.get('/published', authMiddleware, cacheMiddleware(30), async (req, res) => {
    try {
        const { page, limit, subjectId, search } = req.query;
        const result = await getQuizService(req).getAllPublishedQuizzes({ page, limit, subjectId, search });
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.get('/history', authMiddleware, async (req, res) => {
    try {
        const result = await getQuizService(req).getQuizHistory(req.user.MaND);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.get('/history/:id', authMiddleware, async (req, res) => {
    try {
        const result = await getQuizService(req).getQuizResultDetails(req.params.id, req.user.MaND);
        res.json(result);
    } catch (err) {
        console.error(err);
        if (err.message.includes('Không tìm thấy')) return res.status(404).json({ error: err.message });
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.get('/:id', authMiddleware, cacheMiddleware(30), async (req, res) => {
    try {
        const result = await getQuizService(req).getQuizById(req.params.id);
        if (!result) return res.status(404).json({ error: 'Không tìm thấy đề thi' });
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.get('/subject/:subjectId', authMiddleware, cacheMiddleware(30), async (req, res) => {
    try {
        const isStudent = req.user.VaiTro === 'SinhVien';
        const result = await getQuizService(req).getQuizzesBySubject(req.params.subjectId, isStudent);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.get('/:id/stats', teacherMiddleware, async (req, res) => {
    try {
        const results = await getQuizService(req).getQuizStats(req.params.id);
        const quizInfo = await getQuizService(req).getQuizById(req.params.id);
        res.json({
            quiz: quizInfo,
            stats: results
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.get('/:id/export', teacherMiddleware, async (req, res) => {
    try {
        const format = req.query.format || 'xlsx';
        const results = await getQuizService(req).getQuizStats(req.params.id);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Kết Quả');
        sheet.columns = [
            { header: 'ID', key: 'MaKetQua', width: 10 },
            { header: 'Mã SV', key: 'MaND', width: 10 },
            { header: 'Họ Tên', key: 'HoTen', width: 25 },
            { header: 'Email', key: 'Email', width: 30 },
            { header: 'Điểm Số', key: 'DiemSo', width: 15 },
            { header: 'Bắt Đầu', key: 'ThoiGianBatDau', width: 20 },
            { header: 'Nộp Bài', key: 'ThoiGianNopBai', width: 20 }
        ];

        results.forEach(r => {
            sheet.addRow({
                ...r,
                ThoiGianBatDau: new Date(r.ThoiGianBatDau).toLocaleString('vi-VN'),
                ThoiGianNopBai: r.ThoiGianNopBai ? new Date(r.ThoiGianNopBai).toLocaleString('vi-VN') : ''
            });
        });

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="quiz_results_${req.params.id}.csv"`);
            await workbook.csv.write(res);
        } else {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="quiz_results_${req.params.id}.xlsx"`);
            await workbook.xlsx.write(res);
        }
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.post('/:id/take', authMiddleware, async (req, res) => {
    try {
        const result = await getQuizService(req).getQuizForStudent(req.params.id, req.user.MaND, req.user.VaiTro);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'Lỗi server' });
    }
});

router.post('/:id/submit', authMiddleware, async (req, res) => {
    try {
        const { MaKetQua, answers } = req.body;
        const result = await getQuizService(req).submitQuiz(MaKetQua, req.user.MaND, answers);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'Lỗi server' });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.VaiTro !== 'GiangVien' && req.user.VaiTro !== 'GiaoVien' && req.user.VaiTro !== 'Admin') {
            return res.status(403).json({ error: 'Không có quyền xóa' });
        }
        const result = await getQuizService(req).deleteQuiz(req.params.id);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'Lỗi server' });
    }
});

module.exports = router;
