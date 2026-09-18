import { API_URL } from '../shared/config.js';
import { getToken, decodeJWT } from '../shared/utils.js';
import { loadQuillAndTribute } from '../shared/lazyLoad.js';
document.addEventListener('DOMContentLoaded', async () => {

    const apiClient = {
        get: async (url) => {
            const res = await fetch(`${API_URL}${url}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        post: async (url, data) => {
            const res = await fetch(`${API_URL}${url}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        delete: async (url) => {
            const res = await fetch(`${API_URL}${url}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        put: async (url, data) => {
            const res = await fetch(`${API_URL}${url}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        }
    };
    
    const token = getToken();
    if (!token) {
        Swal.fire('Vui lòng đăng nhập.');
        window.location.href = '../auth/login.html';
        return;
    }
    const decoded = decodeJWT(token);
    if (!decoded || (decoded.VaiTro !== 'GiangVien' && decoded.VaiTro !== 'GiaoVien' && decoded.VaiTro !== 'Admin')) {
        Swal.fire('Bạn không có quyền truy cập trang này.');
        window.location.href = '../auth/login.html';
        return;
    }

    let currentSubjectId = null;
    let questionsCache = [];
    let quizzesCache = [];
    
    let currentPageQuiz = 1;
    const itemsPerPageQuiz = 6;
    let editingQuizId = null;

    const subjectSelect = document.getElementById('subjectSelect');
    try {
        const res = await apiClient.get('/subjects/my');
        subjectSelect.innerHTML = '<option value="">-- Chọn môn học --</option>';
        res.subjects.forEach(sub => {
            subjectSelect.innerHTML += `<option value="${sub.MaMonHoc}">${sub.TenMonHoc}</option>`;
        });
    } catch (err) {
        console.error(err);
        subjectSelect.innerHTML = '<option value="">Lỗi tải danh sách môn học</option>';
    }

    subjectSelect.addEventListener('change', async (e) => {
        currentSubjectId = e.target.value;
        if (currentSubjectId) {
            document.getElementById('quizTabs').style.display = 'block';
            await loadQuestions();
            await loadQuizzes();
        } else {
            document.getElementById('quizTabs').style.display = 'none';
        }
    });

    const loadQuestions = async () => {
        try {
            const res = await apiClient.get(`/quizzes/questions/subject/${currentSubjectId}`);
            questionsCache = res;
        } catch (err) {
            console.error(err);
        }
    };

    const loadQuizzes = async () => {
        try {
            const res = await apiClient.get(`/quizzes/subject/${currentSubjectId}`);
            quizzesCache = res;
            renderQuizzes();
        } catch (err) {
            console.error(err);
        }
    };

    const renderQuizzes = () => {
        const grid = document.getElementById('quizGrid');
        grid.innerHTML = '';
        
        const searchVal = document.getElementById('searchQuiz')?.value.toLowerCase() || '';
        const statusVal = document.getElementById('filterQuizStatus')?.value || '';
        
        const filtered = quizzesCache.filter(q => {
            const matchSearch = q.TieuDe.toLowerCase().includes(searchVal);
            const matchStatus = statusVal ? q.TrangThai === statusVal : true;
            return matchSearch && matchStatus;
        });

        if (filtered.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Không tìm thấy đề thi phù hợp</p>';
            document.getElementById('paginationQuizzes').innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(filtered.length / itemsPerPageQuiz);
        if (currentPageQuiz > totalPages) currentPageQuiz = totalPages;
        if (currentPageQuiz < 1) currentPageQuiz = 1;

        const startIndex = (currentPageQuiz - 1) * itemsPerPageQuiz;
        const endIndex = startIndex + itemsPerPageQuiz;
        const pageItems = filtered.slice(startIndex, endIndex);

        pageItems.forEach(q => {
            const statusBadge = q.TrangThai === 'CongKhai' 
                ? '<span class="quiz-badge public">Công Khai</span>' 
                : '<span class="quiz-badge draft">Bản Nháp</span>';
            
            grid.innerHTML += `
                <div class="quiz-card">
                    <h3 class="quiz-title" title="${q.TieuDe}">${q.TieuDe}</h3>
                    <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1rem; line-height: 1.5; flex-grow: 1;">${q.MoTa || 'Không có mô tả'}</p>
                    <div class="quiz-meta">
                        <span><i class="fa-regular fa-clock"></i> ${q.ThoiGianLamBai === 0 ? 'Vô hạn' : q.ThoiGianLamBai + ' phút'}</span>
                        ${statusBadge}
                    </div>
                    <div class="quiz-actions">
                        <div class="quiz-actions-left">
                            <a href="../quiz/takeQuiz.html?id=${q.MaQuiz}" class="btn btn-primary btn-sm" style="text-decoration: none;"><i class="fa-solid fa-play"></i> Xem thử</a>
                            <button class="btn btn-secondary btn-sm" onclick="editQuiz(${q.MaQuiz})"><i class="fa-solid fa-pen"></i> Sửa</button>
                        </div>
                        <div class="quiz-actions-right">
                            <button class="quiz-btn-icon excel" onclick="exportStats(${q.MaQuiz}, 'xlsx')" title="Xuất Excel"><i class="fa-solid fa-file-excel"></i></button>
                            <button class="quiz-btn-icon csv" onclick="exportStats(${q.MaQuiz}, 'csv')" title="Xuất CSV"><i class="fa-solid fa-file-csv"></i></button>
                            <button class="quiz-btn-icon delete" onclick="deleteQuiz(${q.MaQuiz})" title="Xóa đề thi"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        renderPaginationQuiz(totalPages);
    };

    const renderPaginationQuiz = (totalPages) => {
        const container = document.getElementById('paginationQuizzes');
        if (!container) return;
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let html = `<button ${currentPageQuiz === 1 ? 'disabled' : ''} onclick="changePageQuiz(${currentPageQuiz - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;
        html += `<span>Trang ${currentPageQuiz} / ${totalPages}</span>`;
        html += `<button ${currentPageQuiz === totalPages ? 'disabled' : ''} onclick="changePageQuiz(${currentPageQuiz + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;
        container.innerHTML = html;
    };

    window.changePageQuiz = (newPage) => {
        currentPageQuiz = newPage;
        renderQuizzes();
    };

    document.getElementById('searchQuiz')?.addEventListener('input', () => {
        currentPageQuiz = 1;
        renderQuizzes();
    });
    document.getElementById('filterQuizStatus')?.addEventListener('change', () => {
        currentPageQuiz = 1;
        renderQuizzes();
    });

    window.deleteQuiz = async (id) => {
        const result = await Swal.fire({
            title: 'Xóa đề thi?',
            text: "Bạn có chắc chắn muốn xóa đề thi này không? Hành động này không thể hoàn tác.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: '<i class="fa-solid fa-trash"></i> Xóa',
            cancelButtonText: 'Hủy',
            reverseButtons: true,
            customClass: {
                popup: 'modern-swal-popup'
            }
        });
        
        if (!result.isConfirmed) return;
        
        try {
            await apiClient.delete(`/quizzes/${id}`);
            loadQuizzes();
            Swal.fire({
                toast: true,
                position: 'bottom-end',
                icon: 'success',
                title: 'Đã xóa đề thi thành công',
                showConfirmButton: false,
                timer: 3000
            });
        } catch(err) {
            Swal.fire({
                icon: 'error',
                title: 'Lỗi',
                text: 'Không thể xóa đề thi. ' + err.message
            });
        }
    };

    window.exportStats = (quizId, format) => {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
        window.open(`http://localhost:3000/api/quizzes/${quizId}/export?format=${format}&token=${token}`, '_blank');
    };

    const modalCreateQuiz = document.getElementById('modalCreateQuiz');
    document.getElementById('btnCreateQuiz').addEventListener('click', () => {
        if (!currentSubjectId) return alert('Vui lòng chọn môn học');
        document.getElementById('formCreateQuiz').reset();
        
        editingQuizId = null;
        document.querySelector('#modalCreateQuiz .modal-header h2').innerText = 'Tạo Đề thi mới';

        const tbody = document.querySelector('#tableSelectQuestions tbody');
        tbody.innerHTML = '';
        const difficultyMap = { 'De': 'Dễ', 'TrungBinh': 'Trung bình', 'Kho': 'Khó' };

        questionsCache.forEach(q => {
            const doKhoText = difficultyMap[q.DoKho] || q.DoKho || 'Không xác định';
            tbody.innerHTML += `
                <tr>
                    <td><input type="checkbox" class="chk-question" value="${q.MaCauHoi}"></td>
                    <td>${q.NoiDung}</td>
                    <td>${doKhoText}</td>
                </tr>
            `;
        });

        modalCreateQuiz.classList.add('show');
        document.body.style.overflow = 'hidden';
        validateQuizForm();
    });
    
    let initialQuizState = null;

    const getQuizFormState = () => ({
        title: document.getElementById('quiz_title').value.trim(),
        desc: document.getElementById('quiz_desc').value.trim(),
        time: document.getElementById('quiz_time').value,
        random: document.getElementById('quiz_random').checked,
        status: document.getElementById('quiz_status').value,
        questions: Array.from(document.querySelectorAll('.chk-question:checked')).map(c => c.value).sort().join(',')
    });

    window.editQuiz = async (id) => {
        try {
            const quiz = await apiClient.get(`/quizzes/${id}`);
            if (!quiz) return;
            
            editingQuizId = id;
            
            document.getElementById('quiz_title').value = quiz.TieuDe || '';
            document.getElementById('quiz_desc').value = quiz.MoTa || '';
            document.getElementById('quiz_time').value = quiz.ThoiGianLamBai || 0;
            document.getElementById('quiz_random').checked = !!quiz.DaoCauHoi;
            document.getElementById('quiz_status').value = quiz.TrangThai || 'BanNhap';
            
            const tbody = document.querySelector('#tableSelectQuestions tbody');
            tbody.innerHTML = '';
            const difficultyMap = { 'De': 'Dễ', 'TrungBinh': 'Trung bình', 'Kho': 'Khó' };
            
            const selectedSet = new Set(quiz.DanhSachCauHoi || []);
            
            questionsCache.forEach(q => {
                const doKhoText = difficultyMap[q.DoKho] || q.DoKho || 'Không xác định';
                const isChecked = selectedSet.has(q.MaCauHoi) ? 'checked' : '';
                tbody.innerHTML += `
                    <tr>
                        <td><input type="checkbox" class="chk-question" value="${q.MaCauHoi}" ${isChecked}></td>
                        <td>${q.NoiDung}</td>
                        <td>${doKhoText}</td>
                    </tr>
                `;
            });
            
            modalCreateQuiz.classList.add('show');
            document.body.style.overflow = 'hidden';
            
            document.querySelector('#modalCreateQuiz .modal-header h2').innerText = 'Chỉnh sửa Đề thi';
            
            initialQuizState = getQuizFormState();
            validateQuizForm();
        } catch (err) {
            console.error(err);
            alert('Lỗi: Không thể lấy thông tin đề thi');
        }
    };

    const validateQuizForm = () => {
        const title = document.getElementById('quiz_title').value.trim();
        const selectedQ = document.querySelectorAll('.chk-question:checked').length;
        let isValid = title && selectedQ > 0;
        
        if (isValid && editingQuizId && initialQuizState) {
            const currentState = getQuizFormState();
            isValid = JSON.stringify(currentState) !== JSON.stringify(initialQuizState);
        }
        
        document.getElementById('btnSaveQuiz').disabled = !isValid;
    };

    document.getElementById('quiz_title').addEventListener('input', validateQuizForm);
    document.getElementById('quiz_desc').addEventListener('input', validateQuizForm);
    document.getElementById('quiz_time').addEventListener('input', validateQuizForm);
    document.getElementById('quiz_random').addEventListener('change', validateQuizForm);
    document.getElementById('quiz_status').addEventListener('change', validateQuizForm);

    document.getElementById('tableSelectQuestions').addEventListener('change', (e) => {
        if (e.target.classList.contains('chk-question')) {
            validateQuizForm();
            const total = document.querySelectorAll('.chk-question').length;
            const checked = document.querySelectorAll('.chk-question:checked').length;
            document.getElementById('selectAllQuestions').checked = (total > 0 && total === checked);
        }
    });

    document.getElementById('selectAllQuestions').addEventListener('change', (e) => {
        document.querySelectorAll('.chk-question').forEach(chk => chk.checked = e.target.checked);
        validateQuizForm();
    });

    document.getElementById('btnCloseQuizModal').addEventListener('click', closeQuizModal);
    document.getElementById('btnCancelQuiz').addEventListener('click', closeQuizModal);
    
    function closeQuizModal() {
        modalCreateQuiz.classList.remove('show');
        document.body.style.overflow = 'auto';
        document.querySelector('#modalCreateQuiz .modal-header h2').innerText = 'Tạo Đề thi mới';
        editingQuizId = null;
    }

    document.getElementById('btnSaveQuiz').addEventListener('click', async () => {
        const title = document.getElementById('quiz_title').value.trim();
        if (!title) return alert('Vui lòng nhập tiêu đề');

        const selectedQ = [];
        document.querySelectorAll('.chk-question:checked').forEach(chk => {
            selectedQ.push(Number(chk.value));
        });

        if (selectedQ.length === 0) return alert('Vui lòng chọn ít nhất 1 câu hỏi');

        const payload = {
            MaMonHoc: currentSubjectId,
            TieuDe: title,
            MoTa: document.getElementById('quiz_desc').value,
            ThoiGianLamBai: Number(document.getElementById('quiz_time').value) || 0,
            DaoCauHoi: document.getElementById('quiz_random').checked,
            TrangThai: document.getElementById('quiz_status').value,
            DanhSachCauHoi: selectedQ
        };

        const btnSave = document.getElementById('btnSaveQuiz');
        const oldText = btnSave.innerHTML;
        btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
        btnSave.disabled = true;

        try {
            if (editingQuizId) {
                await apiClient.put(`/quizzes/${editingQuizId}`, payload);
            } else {
                await apiClient.post('/quizzes', payload);
            }
            closeQuizModal();
            loadQuizzes();
        } catch(err) {
            alert('Lỗi: ' + (err.message || 'Không thể lưu đề thi'));
        } finally {
            btnSave.innerHTML = oldText;
            btnSave.disabled = false;
        }
    });

});
