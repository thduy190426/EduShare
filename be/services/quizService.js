const mysql = require('mysql2/promise');

class QuizService {
    constructor(pool) {
        this.pool = pool;
    }

    async createQuestion(userId, data) {
        const { MaMonHoc, NoiDung, LoaiCauHoi, DoKho, Diem, PhanHoiTuDong, HinhAnh, DapAn } = data;
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [qRes] = await conn.query(
                `INSERT INTO NGANHANG_CAUHOI (MaMonHoc, MaND_Tao, NoiDung, LoaiCauHoi, DoKho, Diem, PhanHoiTuDong, HinhAnh) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [MaMonHoc, userId, NoiDung, LoaiCauHoi || 'TracNghiem', DoKho || 'TrungBinh', Diem || 1, PhanHoiTuDong, HinhAnh || null]
            );
            const MaCauHoi = qRes.insertId;

            if (DapAn && Array.isArray(DapAn)) {
                for (let ans of DapAn) {
                    await conn.query(
                        `INSERT INTO DAP_AN (MaCauHoi, NoiDung, LaDapAnDung) VALUES (?, ?, ?)`,
                        [MaCauHoi, ans.NoiDung, ans.LaDapAnDung ? 1 : 0]
                    );
                }
            }

            await conn.commit();
            return { MaCauHoi, message: 'Tạo câu hỏi thành công' };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    async getQuestionById(id) {
        const [rows] = await this.pool.query(
            `SELECT c.*, 
                (SELECT JSON_ARRAYAGG(JSON_OBJECT('MaDapAn', d.MaDapAn, 'NoiDung', d.NoiDung, 'LaDapAnDung', d.LaDapAnDung)) 
                 FROM DAP_AN d WHERE d.MaCauHoi = c.MaCauHoi) as DapAn
             FROM NGANHANG_CAUHOI c
             WHERE c.MaCauHoi = ? AND c.IsDeleted = FALSE`,
            [id]
        );
        return rows[0] || null;
    }

    async updateQuestion(id, data) {
        const { NoiDung, LoaiCauHoi, DoKho, Diem, PhanHoiTuDong, HinhAnh, DapAn } = data;
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            
            await conn.query(
                `UPDATE NGANHANG_CAUHOI SET NoiDung = ?, LoaiCauHoi = ?, DoKho = ?, Diem = ?, PhanHoiTuDong = ?, HinhAnh = ? WHERE MaCauHoi = ?`,
                [NoiDung, LoaiCauHoi || 'TracNghiem', DoKho || 'TrungBinh', Diem || 1, PhanHoiTuDong, HinhAnh || null, id]
            );

            await conn.query(`DELETE FROM DAP_AN WHERE MaCauHoi = ?`, [id]);

            if (DapAn && Array.isArray(DapAn)) {
                for (let ans of DapAn) {
                    await conn.query(
                        `INSERT INTO DAP_AN (MaCauHoi, NoiDung, LaDapAnDung) VALUES (?, ?, ?)`,
                        [id, ans.NoiDung, ans.LaDapAnDung ? 1 : 0]
                    );
                }
            }

            await conn.commit();
            return { message: 'Cập nhật câu hỏi thành công' };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    async getQuestionsBySubject(subjectId) {
        const [rows] = await this.pool.query(
            `SELECT c.*, 
                (SELECT JSON_ARRAYAGG(JSON_OBJECT('MaDapAn', d.MaDapAn, 'NoiDung', d.NoiDung, 'LaDapAnDung', d.LaDapAnDung)) 
                 FROM DAP_AN d WHERE d.MaCauHoi = c.MaCauHoi) as DapAn
             FROM NGANHANG_CAUHOI c
             WHERE c.MaMonHoc = ? AND c.IsDeleted = FALSE
             ORDER BY c.NgayTao ASC`,
            [subjectId]
        );
        return rows;
    }

    async createQuiz(userId, data) {
        const { MaMonHoc, TieuDe, MoTa, ThoiGianLamBai, DaoCauHoi, TrangThai, DanhSachCauHoi } = data;
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [qRes] = await conn.query(
                `INSERT INTO QUIZ (MaMonHoc, MaND_Tao, TieuDe, MoTa, ThoiGianLamBai, DaoCauHoi, TrangThai) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [MaMonHoc, userId, TieuDe, MoTa, ThoiGianLamBai || 0, DaoCauHoi ? 1 : 0, TrangThai || 'BanNhap']
            );
            const MaQuiz = qRes.insertId;

            if (DanhSachCauHoi && Array.isArray(DanhSachCauHoi)) {
                for (let i = 0; i < DanhSachCauHoi.length; i++) {
                    await conn.query(
                        `INSERT INTO QUIZ_CAUHOI (MaQuiz, MaCauHoi, ThuTu) VALUES (?, ?, ?)`,
                        [MaQuiz, DanhSachCauHoi[i], i + 1]
                    );
                }
            }

            await conn.commit();
            return { MaQuiz, message: 'Tạo đề thi thành công' };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    async updateQuiz(quizId, userId, data) {
        const { TieuDe, MoTa, ThoiGianLamBai, DaoCauHoi, TrangThai, DanhSachCauHoi } = data;
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();

            await conn.query(
                `UPDATE QUIZ 
                 SET TieuDe = ?, MoTa = ?, ThoiGianLamBai = ?, DaoCauHoi = ?, TrangThai = ?
                 WHERE MaQuiz = ? AND MaND_Tao = ?`,
                [TieuDe, MoTa, ThoiGianLamBai || 0, DaoCauHoi ? 1 : 0, TrangThai || 'BanNhap', quizId, userId]
            );

            await conn.query(`DELETE FROM QUIZ_CAUHOI WHERE MaQuiz = ?`, [quizId]);

            if (DanhSachCauHoi && Array.isArray(DanhSachCauHoi)) {
                for (let i = 0; i < DanhSachCauHoi.length; i++) {
                    await conn.query(
                        `INSERT INTO QUIZ_CAUHOI (MaQuiz, MaCauHoi, ThuTu) VALUES (?, ?, ?)`,
                        [quizId, DanhSachCauHoi[i], i + 1]
                    );
                }
            }

            await conn.commit();
            return { message: 'Cập nhật đề thi thành công' };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    async getQuizById(quizId) {
        const [quizzes] = await this.pool.query(`SELECT * FROM QUIZ WHERE MaQuiz = ?`, [quizId]);
        if (quizzes.length === 0) return null;
        
        const quiz = quizzes[0];
        const [questions] = await this.pool.query(`SELECT MaCauHoi FROM QUIZ_CAUHOI WHERE MaQuiz = ? ORDER BY ThuTu ASC`, [quizId]);
        
        quiz.DanhSachCauHoi = questions.map(q => q.MaCauHoi);
        return quiz;
    }

    async getQuizzesBySubject(subjectId, isStudent = false) {
        let query = `SELECT * FROM QUIZ WHERE MaMonHoc = ? AND IsDeleted = FALSE`;
        if (isStudent) {
            query += ` AND TrangThai = 'CongKhai'`;
        }
        query += ` ORDER BY NgayTao DESC`;
        const [rows] = await this.pool.query(query, [subjectId]);
        return rows;
    }

    async getQuizForStudent(quizId, userId, userRole = 'SinhVien') {
        let query = `SELECT * FROM QUIZ WHERE MaQuiz = ? AND IsDeleted = FALSE`;
        if (userRole === 'SinhVien') {
            query += ` AND TrangThai = 'CongKhai'`;
        }
        const [quizzes] = await this.pool.query(query, [quizId]);
        if (quizzes.length === 0) throw new Error('Không tìm thấy đề thi hoặc đề thi chưa được công khai');
        const quiz = quizzes[0];

        const [res] = await this.pool.query(
            `INSERT INTO KETQUA_QUIZ (MaQuiz, MaND, TrangThai) VALUES (?, ?, 'DangLam')`,
            [quizId, userId]
        );
        const MaKetQua = res.insertId;

        let qQuery = `
            SELECT c.MaCauHoi, c.NoiDung, c.LoaiCauHoi, c.DoKho, c.HinhAnh, c.Diem, qc.ThuTu
            FROM QUIZ_CAUHOI qc
            JOIN NGANHANG_CAUHOI c ON qc.MaCauHoi = c.MaCauHoi
            WHERE qc.MaQuiz = ?
        `;
        if (quiz.DaoCauHoi) {
            qQuery += ` ORDER BY RAND()`;
        } else {
            qQuery += ` ORDER BY qc.ThuTu ASC`;
        }

        const [questions] = await this.pool.query(qQuery, [quizId]);

        for (let q of questions) {
            const [answers] = await this.pool.query(
                `SELECT MaDapAn, NoiDung FROM DAP_AN WHERE MaCauHoi = ?`,
                [q.MaCauHoi]
            );
            if (quiz.DaoCauHoi) {
                answers.sort(() => Math.random() - 0.5);
            }
            q.DapAn = answers;
        }

        return {
            MaKetQua,
            quiz: {
                MaQuiz: quiz.MaQuiz,
                TieuDe: quiz.TieuDe,
                ThoiGianLamBai: quiz.ThoiGianLamBai
            },
            questions
        };
    }

    async submitQuiz(MaKetQua, userId, userAnswers) {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();

            const [attempts] = await conn.query(`SELECT * FROM KETQUA_QUIZ WHERE MaKetQua = ? AND MaND = ?`, [MaKetQua, userId]);
            if (attempts.length === 0) throw new Error('Không tìm thấy kết quả đang làm');
            const attempt = attempts[0];
            if (attempt.TrangThai === 'DaNop') throw new Error('Đề thi này đã được nộp');

            const [questions] = await conn.query(
                `SELECT c.MaCauHoi, c.Diem 
                 FROM QUIZ_CAUHOI qc 
                 JOIN NGANHANG_CAUHOI c ON qc.MaCauHoi = c.MaCauHoi 
                 WHERE qc.MaQuiz = ?`,
                [attempt.MaQuiz]
            );

            let totalPoints = 0;
            let earnedPoints = 0;
            let soCauDung = 0;
            const qMap = {}; 
            for (let q of questions) {
                totalPoints += q.Diem || 1;
                qMap[q.MaCauHoi] = q.Diem || 1;
            }

            for (let ans of userAnswers) {
                if (!qMap[ans.MaCauHoi]) continue; 

                await conn.query(
                    `INSERT INTO CHITIET_KETQUA_QUIZ (MaKetQua, MaCauHoi, MaDapAnDaChon) VALUES (?, ?, ?) 
                     ON DUPLICATE KEY UPDATE MaDapAnDaChon = ?`,
                    [MaKetQua, ans.MaCauHoi, ans.MaDapAn, ans.MaDapAn]
                );

                if (ans.MaDapAn) {
                    const [correctCheck] = await conn.query(`SELECT LaDapAnDung FROM DAP_AN WHERE MaDapAn = ? AND MaCauHoi = ?`, [ans.MaDapAn, ans.MaCauHoi]);
                    if (correctCheck.length > 0 && correctCheck[0].LaDapAnDung) {
                        earnedPoints += qMap[ans.MaCauHoi];
                        soCauDung++;
                    }
                }
            }

            let score100 = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
            score100 = Math.round(score100 * 100) / 100;

            await conn.query(
                `UPDATE KETQUA_QUIZ SET DiemSo = ?, ThoiGianNopBai = CURRENT_TIMESTAMP, TrangThai = 'DaNop' WHERE MaKetQua = ?`,
                [score100, MaKetQua]
            );

            const [feedbacks] = await conn.query(
                `SELECT c.MaCauHoi, c.PhanHoiTuDong, 
                        (SELECT MaDapAn FROM DAP_AN d WHERE d.MaCauHoi = c.MaCauHoi AND d.LaDapAnDung = 1 LIMIT 1) as MaDapAnDung 
                 FROM NGANHANG_CAUHOI c
                 JOIN QUIZ_CAUHOI qc ON c.MaCauHoi = qc.MaCauHoi
                 WHERE qc.MaQuiz = ?`,
                [attempt.MaQuiz]
            );

            const chiTiet = feedbacks.map(fb => {
                const userAns = userAnswers.find(ua => ua.MaCauHoi === fb.MaCauHoi);
                const laDung = userAns && userAns.MaDapAn === fb.MaDapAnDung;
                return {
                    MaCauHoi: fb.MaCauHoi,
                    LaDapAnDung: laDung,
                    PhanHoiTuDong: fb.PhanHoiTuDong,
                    MaDapAnDung: fb.MaDapAnDung,
                    MaDapAnDaChon: userAns ? userAns.MaDapAn : null
                };
            });

            await conn.commit();
            return {
                message: 'Nộp bài thành công',
                DiemSo: score100,
                TongSoCau: questions.length,
                SoCauDung: soCauDung,
                ChiTiet: chiTiet
            };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    async getQuizStats(quizId) {
        const [results] = await this.pool.query(
            `SELECT k.MaKetQua, k.MaND, u.HoTen, u.Email, k.DiemSo, k.ThoiGianBatDau, k.ThoiGianNopBai
             FROM KETQUA_QUIZ k
             JOIN NGUOIDUNG u ON k.MaND = u.MaND
             WHERE k.MaQuiz = ? AND k.TrangThai = 'DaNop' AND u.VaiTro = 'SinhVien'
             ORDER BY k.ThoiGianNopBai DESC`,
            [quizId]
        );
        return results;
    }
    async getQuizById(quizId) {
        const [quizzes] = await this.pool.query(
            `SELECT q.*, (SELECT COUNT(*) FROM QUIZ_CAUHOI qc WHERE qc.MaQuiz = q.MaQuiz) as SoCauHoi 
             FROM QUIZ q 
             WHERE q.MaQuiz = ? AND q.IsDeleted = FALSE`,
            [quizId]
        );
        if (quizzes.length === 0) return null;
        
        const quiz = quizzes[0];
        const [questions] = await this.pool.query(
            `SELECT MaCauHoi FROM QUIZ_CAUHOI WHERE MaQuiz = ? ORDER BY ThuTu ASC`,
            [quizId]
        );
        quiz.DanhSachCauHoi = questions.map(q => q.MaCauHoi);
        
        return quiz;
    }

    async deleteQuestion(id) {
        await this.pool.query(`UPDATE NGANHANG_CAUHOI SET IsDeleted = TRUE WHERE MaCauHoi = ?`, [id]);
        return { message: 'Đã xóa câu hỏi thành công' };
    }

    async updateQuiz(quizId, userId, data) {
        const { TieuDe, MoTa, ThoiGianLamBai, DaoCauHoi, TrangThai, DanhSachCauHoi } = data;
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            
            await conn.query(
                `UPDATE QUIZ SET TieuDe = ?, MoTa = ?, ThoiGianLamBai = ?, DaoCauHoi = ?, TrangThai = ?
                 WHERE MaQuiz = ? AND (MaND_Tao = ? OR ? = (SELECT VaiTro FROM NGUOIDUNG WHERE MaND = ?))`,
                [TieuDe, MoTa, ThoiGianLamBai || 0, DaoCauHoi ? 1 : 0, TrangThai || 'BanNhap', quizId, userId, 'Admin', userId]
            );

            await conn.query(`DELETE FROM QUIZ_CAUHOI WHERE MaQuiz = ?`, [quizId]);

            if (DanhSachCauHoi && Array.isArray(DanhSachCauHoi)) {
                for (let i = 0; i < DanhSachCauHoi.length; i++) {
                    await conn.query(
                        `INSERT INTO QUIZ_CAUHOI (MaQuiz, MaCauHoi, ThuTu) VALUES (?, ?, ?)`,
                        [quizId, DanhSachCauHoi[i], i + 1]
                    );
                }
            }

            await conn.commit();
            return { message: 'Cập nhật đề thi thành công' };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    async deleteQuiz(quizId) {
        await this.pool.query(`UPDATE QUIZ SET IsDeleted = TRUE WHERE MaQuiz = ?`, [quizId]);
        return { message: 'Đã xóa đề thi thành công' };
    }

    async getAllPublishedQuizzes({ page = 1, limit = 10, subjectId, search }) {
        const offset = (page - 1) * limit;
        let query = `
            SELECT q.*, m.TenMonHoc, u.HoTen as NguoiTao, u.AvatarURL as AnhNguoiTao,
            (SELECT COUNT(*) FROM QUIZ_CAUHOI qc WHERE qc.MaQuiz = q.MaQuiz) as SoCauHoi
            FROM QUIZ q
            LEFT JOIN MONHOC m ON q.MaMonHoc = m.MaMonHoc
            LEFT JOIN NGUOIDUNG u ON q.MaND_Tao = u.MaND
            WHERE q.TrangThai = 'CongKhai' AND q.IsDeleted = FALSE
        `;
        const queryParams = [];

        if (subjectId) {
            query += ` AND q.MaMonHoc = ?`;
            queryParams.push(subjectId);
        }

        if (search) {
            query += ` AND q.TieuDe LIKE ?`;
            queryParams.push(`%${search}%`);
        }

        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as subquery`;
        const [countResult] = await this.pool.query(countQuery, queryParams);
        const total = countResult[0].total;

        query += ` ORDER BY q.NgayTao DESC LIMIT ? OFFSET ?`;
        queryParams.push(Number(limit), Number(offset));

        const [quizzes] = await this.pool.query(query, queryParams);

        return {
            quizzes,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getQuizHistory(userId) {
        const query = `
            SELECT kq.MaKetQua, kq.MaQuiz, kq.DiemSo, kq.ThoiGianNopBai,
                   q.TieuDe, m.TenMonHoc
            FROM KETQUA_QUIZ kq
            JOIN QUIZ q ON kq.MaQuiz = q.MaQuiz
            LEFT JOIN MONHOC m ON q.MaMonHoc = m.MaMonHoc
            WHERE kq.MaND = ? AND kq.TrangThai = 'DaNop'
            ORDER BY kq.ThoiGianNopBai DESC
        `;
        const [rows] = await this.pool.query(query, [userId]);
        return rows;
    }

    async getQuizResultDetails(MaKetQua, userId) {
        const [attempts] = await this.pool.query(
            `SELECT kq.*, q.TieuDe 
             FROM KETQUA_QUIZ kq 
             JOIN QUIZ q ON kq.MaQuiz = q.MaQuiz 
             WHERE kq.MaKetQua = ? AND kq.MaND = ?`, 
            [MaKetQua, userId]
        );
        if (attempts.length === 0) throw new Error('Không tìm thấy kết quả hoặc không có quyền truy cập');
        const attempt = attempts[0];

        const [questions] = await this.pool.query(
            `SELECT c.MaCauHoi, c.NoiDung, c.LoaiCauHoi, c.HinhAnh, c.PhanHoiTuDong, c.Diem,
                    ct.MaDapAnDaChon
             FROM CHITIET_KETQUA_QUIZ ct
             JOIN NGANHANG_CAUHOI c ON ct.MaCauHoi = c.MaCauHoi
             WHERE ct.MaKetQua = ?`,
            [MaKetQua]
        );

        let soCauDung = 0;
        for (let q of questions) {
            const [answers] = await this.pool.query(
                `SELECT MaDapAn, NoiDung, LaDapAnDung FROM DAP_AN WHERE MaCauHoi = ?`,
                [q.MaCauHoi]
            );
            
            q.DapAn = answers;
            
            if (q.MaDapAnDaChon) {
                const selectedAns = answers.find(a => a.MaDapAn === q.MaDapAnDaChon);
                if (selectedAns && selectedAns.LaDapAnDung) {
                    soCauDung++;
                    q.LaDapAnDung = true;
                } else {
                    q.LaDapAnDung = false;
                }
            } else {
                q.LaDapAnDung = false;
            }
        }

        return {
            attempt,
            questions,
            TongSoCau: questions.length,
            SoCauDung: soCauDung
        };
    }
}
module.exports = QuizService;
