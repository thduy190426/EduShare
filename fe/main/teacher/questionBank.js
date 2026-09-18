import { API_URL } from '../shared/config.js';
import { getToken, decodeJWT } from '../shared/utils.js';
import { loadQuillAndTribute } from '../shared/lazyLoad.js';
import { makeAdminTablesResizableAndSticky } from '../admin/adminTableUtils.js';

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
    let editingQuestionId = null;
    let currentQuestionImage = null;
    let initialFormState = null;
    
    let currentPageQ = 1;
    const itemsPerPageQ = 10;
    let qContentEditor = null;

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
            document.getElementById('questionBankContainer').style.display = 'block';
            await loadQuestions();
        } else {
            document.getElementById('questionBankContainer').style.display = 'none';
        }
    });

    const loadQuestions = async () => {
        try {
            const res = await apiClient.get(`/quizzes/questions/subject/${currentSubjectId}`);
            questionsCache = res;
            renderQuestions();
        } catch (err) {
            console.error(err);
        }
    };

    const renderQuestions = () => {
        const tbody = document.querySelector('#tableQuestions tbody');
        tbody.innerHTML = '';
        
        const searchVal = document.getElementById('searchQuestion')?.value.toLowerCase() || '';
        const diffVal = document.getElementById('filterQDifficulty')?.value || '';
        
        const filtered = questionsCache.filter(q => {
            const matchSearch = q.NoiDung.toLowerCase().includes(searchVal);
            const matchDiff = diffVal ? q.DoKho === diffVal : true;
            return matchSearch && matchDiff;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Không tìm thấy câu hỏi phù hợp</td></tr>';
            document.getElementById('paginationQuestions').innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(filtered.length / itemsPerPageQ);
        if (currentPageQ > totalPages) currentPageQ = totalPages;
        if (currentPageQ < 1) currentPageQ = 1;

        const startIndex = (currentPageQ - 1) * itemsPerPageQ;
        const endIndex = startIndex + itemsPerPageQ;
        const pageItems = filtered.slice(startIndex, endIndex);

        const difficultyMap = { 'De': 'Dễ', 'TrungBinh': 'Trung bình', 'Kho': 'Khó' };

        pageItems.forEach(q => {
            const doKhoText = difficultyMap[q.DoKho] || q.DoKho || 'Không xác định';
            const plainContent = q.NoiDung ? q.NoiDung.replace(/<[^>]*>?/gm, '').substring(0, 80) : '';
            tbody.innerHTML += `
                <tr>
                    <td>#${q.MaCauHoi}</td>
                    <td>${q.HinhAnh ? '<i class="fa-solid fa-image text-primary" title="Có ảnh đính kèm"></i> ' : ''}${plainContent}${plainContent.length === 80 ? '...' : ''}</td>
                    <td>${q.LoaiCauHoi === 'TracNghiem' ? 'Nhiều lựa chọn' : 'Đúng/Sai'}</td>
                    <td><span class="quiz-badge" style="background: #e2e8f0; color: #1e293b;">${doKhoText}</span></td>
                    <td>${q.Diem}</td>
                    <td>
                        <button class="btn-icon edit" title="Sửa" onclick="editQuestion(${q.MaCauHoi})"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon delete" title="Xóa" onclick="deleteQuestion(${q.MaCauHoi})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        
        renderPaginationQ(totalPages);
    };

    const renderPaginationQ = (totalPages) => {
        const container = document.getElementById('paginationQuestions');
        if (!container) return;
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let html = `<button ${currentPageQ === 1 ? 'disabled' : ''} onclick="changePageQ(${currentPageQ - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;
        html += `<span>Trang ${currentPageQ} / ${totalPages}</span>`;
        html += `<button ${currentPageQ === totalPages ? 'disabled' : ''} onclick="changePageQ(${currentPageQ + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;
        container.innerHTML = html;
    };

    window.changePageQ = (newPage) => {
        currentPageQ = newPage;
        renderQuestions();
    };

    document.getElementById('searchQuestion')?.addEventListener('input', () => {
        currentPageQ = 1;
        renderQuestions();
    });
    document.getElementById('filterQDifficulty')?.addEventListener('change', () => {
        currentPageQ = 1;
        renderQuestions();
    });

    window.deleteQuestion = async (id) => {
        const result = await Swal.fire({
            title: 'Xóa câu hỏi?',
            text: "Bạn có chắc chắn muốn xóa câu hỏi này không? (Sẽ chỉ ẩn đi đối với đề thi cũ)",
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
            await apiClient.delete(`/quizzes/questions/${id}`);
            await loadQuestions();
            Swal.fire({
                toast: true,
                position: 'bottom-end',
                icon: 'success',
                title: 'Đã xóa câu hỏi thành công',
                showConfirmButton: false,
                timer: 3000
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Lỗi',
                text: 'Không thể xóa câu hỏi. ' + err.message
            });
        }
    };

    window.editQuestion = async (id) => {
        const q = questionsCache.find(x => x.MaCauHoi === id);
        if (!q) return;

        editingQuestionId = id;
        currentQuestionImage = q.HinhAnh || null;
        
        let questionData = q;
        try {
            questionData = await apiClient.get(`/quizzes/questions/${id}`);
        } catch (e) {
            console.error('Không thể tải chi tiết câu hỏi', e);
        }

        document.getElementById('formCreateQuestion').reset();
        if(document.getElementById('q_image_preview')) { 
            if (currentQuestionImage) {
                document.getElementById('q_image_preview').src = currentQuestionImage; 
                document.getElementById('q_image_preview').style.display = 'block'; 
            } else {
                document.getElementById('q_image_preview').src = ''; 
                document.getElementById('q_image_preview').style.display = 'none'; 
            }
        }
        if (!qContentEditor) {
            try {
                await loadQuillAndTribute();
                qContentEditor = new Quill('#q_content_editor', {
                    theme: 'snow',
                    placeholder: 'Nhập nội dung câu hỏi tại đây...',
                    modules: {
                        toolbar: [
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            ['link'],
                            ['clean']
                        ]
                    }
                });
                qContentEditor.on('text-change', () => {
                    document.getElementById('q_content').value = qContentEditor.root.innerHTML;
                    validateQuestionForm();
                });
            } catch (err) {
                console.error('Failed to load Quill:', err);
            }
        }
        
        if (qContentEditor) {
            qContentEditor.root.innerHTML = questionData.NoiDung || '';
        }
        document.getElementById('q_content').value = questionData.NoiDung || '';
        document.getElementById('q_type').value = questionData.LoaiCauHoi || 'TracNghiem';
        document.getElementById('q_difficulty').value = questionData.DoKho || 'De';
        document.getElementById('q_points').value = questionData.Diem || 1;
        document.getElementById('q_feedback').value = questionData.PhanHoiTuDong || '';

        document.getElementById('answersList').innerHTML = '';
        if (questionData.DapAn && questionData.DapAn.length > 0) {
            questionData.DapAn.forEach(ans => {
                addAnswerRow(ans.LaDapAnDung, ans.NoiDung);
            });
        } else {
            addAnswerRow(true); 
            addAnswerRow(false);
        }

        initialFormState = getQuestionFormState();
        validateQuestionForm();
        modalCreateQuestion.classList.add('show');
        document.body.style.overflow = 'hidden';
    };

    const modalCreateQuestion = document.getElementById('modalCreateQuestion');
    document.getElementById('btnCreateQuestion').addEventListener('click', async () => {
        if (!currentSubjectId) return alert('Vui lòng chọn môn học');
        if (!qContentEditor) {
            try {
                await loadQuillAndTribute();
                qContentEditor = new Quill('#q_content_editor', {
                    theme: 'snow',
                    placeholder: 'Nhập nội dung câu hỏi tại đây...',
                    modules: {
                        toolbar: [
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            ['link'],
                            ['clean']
                        ]
                    }
                });
                qContentEditor.on('text-change', () => {
                    document.getElementById('q_content').value = qContentEditor.root.innerHTML;
                    validateQuestionForm();
                });
            } catch (err) {
                console.error('Failed to load Quill:', err);
            }
        }
        editingQuestionId = null;
        currentQuestionImage = null;
        document.getElementById('formCreateQuestion').reset();
        if(qContentEditor) qContentEditor.setContents([]);
        document.getElementById('q_content').value = '';
        if(document.getElementById('q_image_preview')) { document.getElementById('q_image_preview').src = ''; document.getElementById('q_image_preview').style.display = 'none'; }
        document.getElementById('answersList').innerHTML = '';
        initialFormState = null;
        addAnswerRow(true); 
        addAnswerRow(false);
        initialFormState = getQuestionFormState();
        validateQuestionForm();
        modalCreateQuestion.classList.add('show');
        document.body.style.overflow = 'hidden';
    });

    
    const qImageInput = document.getElementById('q_image');
    const qImagePreview = document.getElementById('q_image_preview');
    if (qImageInput) {
        qImageInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    qImagePreview.src = e.target.result;
                    qImagePreview.style.display = 'block';
                }
                reader.readAsDataURL(file);
            } else {
                qImagePreview.src = '';
                qImagePreview.style.display = 'none';
            }
        });
    }

    document.getElementById('btnCloseQuestionModal').addEventListener('click', closeQuestionModal);
    document.getElementById('btnCancelQuestion').addEventListener('click', closeQuestionModal);
    
    function closeQuestionModal() {
        modalCreateQuestion.classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    let answerCounter = 0;
    const addAnswerRow = (isCorrect = false, text = '') => {
        answerCounter++;
        const div = document.createElement('div');
        div.className = 'answer-row';
        div.innerHTML = `
            <input type="radio" name="correct_answer" value="${answerCounter}" ${isCorrect ? 'checked' : ''}>
            <input type="text" class="form-control ans-text" placeholder="Nhập đáp án..." required>
            <button type="button" class="btn-icon delete" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
        `;
        if (text) div.querySelector('.ans-text').value = text;
        document.getElementById('answersList').appendChild(div);
        validateQuestionForm();
    };

    document.getElementById('btnAddAnswer').addEventListener('click', () => addAnswerRow());

    
    const getQuestionFormState = () => {
        const content = document.getElementById('q_content').value.trim();
        const type = document.getElementById('q_type').value;
        const difficulty = document.getElementById('q_difficulty').value;
        const points = document.getElementById('q_points').value;
        const feedback = document.getElementById('q_feedback').value.trim();
        
        const imageInput = document.getElementById('q_image');
        const image = imageInput && imageInput.files.length > 0 ? imageInput.files[0].name : '';
        
        const answers = [];
        document.querySelectorAll('.answer-row').forEach(row => {
            const radio = row.querySelector('input[type="radio"]');
            answers.push({
                text: row.querySelector('.ans-text').value.trim(),
                isCorrect: radio ? radio.checked : false
            });
        });
        
        return JSON.stringify({ content, type, difficulty, points, feedback, image, answers });
    };

    const validateQuestionForm = () => {
        const btnSave = document.getElementById('btnSaveQuestion');
        const content = document.getElementById('q_content').value.trim();
        let isValid = true;
        if (qContentEditor) {
            const textContent = qContentEditor.getText().trim();
            const htmlContent = qContentEditor.root.innerHTML;
            if (textContent.length === 0 && !htmlContent.includes('<img')) {
                isValid = false;
            }
        } else {
            isValid = content.length > 0;
        }
        
        const ansRows = document.querySelectorAll('.answer-row');
        if (ansRows.length < 2) isValid = false;
        
        let hasCorrect = false;
        ansRows.forEach(row => {
            const text = row.querySelector('.ans-text').value.trim();
            const isCorrect = row.querySelector('input[type="radio"]').checked;
            if (text === '') isValid = false;
            if (isCorrect) hasCorrect = true;
        });
        
        if (!hasCorrect) isValid = false;

        let isChanged = true;
        if (initialFormState !== null) {
            isChanged = (getQuestionFormState() !== initialFormState);
        }

        btnSave.disabled = !(isValid && isChanged);
    };
    document.getElementById('formCreateQuestion').addEventListener('input', validateQuestionForm);
    document.getElementById('formCreateQuestion').addEventListener('change', validateQuestionForm);

    document.getElementById('btnSaveQuestion').addEventListener('click', async () => {
        const content = document.getElementById('q_content').value.trim();
        if (!content) return alert('Vui lòng nhập nội dung câu hỏi');

        const answers = [];
        const ansRows = document.querySelectorAll('.answer-row');
        ansRows.forEach(row => {
            const text = row.querySelector('.ans-text').value.trim();
            const isCorrect = row.querySelector('input[type="radio"]').checked;
            if (text) {
                answers.push({ NoiDung: text, LaDapAnDung: isCorrect });
            }
        });

        if (answers.length < 2) return alert('Cần ít nhất 2 đáp án');
        if (!answers.some(a => a.LaDapAnDung)) return alert('Vui lòng chọn ít nhất 1 đáp án đúng');
        
        const btnSave = document.getElementById('btnSaveQuestion');
        const oldText = btnSave.innerHTML;
        btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
        btnSave.disabled = true;

        let uploadedImageUrl = currentQuestionImage;
        const qImageInputElem = document.getElementById('q_image');
        if (qImageInputElem && qImageInputElem.files.length > 0) {
            const formData = new FormData();
            formData.append('image', qImageInputElem.files[0]);
            try {
                const uploadRes = await fetch(`${API_URL}/users/upload-image`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                if (!uploadRes.ok) throw new Error('Lỗi upload ảnh');
                const uploadData = await uploadRes.json();
                uploadedImageUrl = uploadData.url || uploadData.secure_url;
            } catch(e) {
                alert('Không thể tải ảnh lên. Vui lòng thử lại.');
                btnSave.innerHTML = oldText;
                btnSave.disabled = false;
                return;
            }
        }

        const payload = {
            MaMonHoc: currentSubjectId,
            NoiDung: content,
            LoaiCauHoi: document.getElementById('q_type').value,
            DoKho: document.getElementById('q_difficulty').value,
            Diem: document.getElementById('q_points').value,
            PhanHoiTuDong: document.getElementById('q_feedback').value,
            DapAn: answers,
            HinhAnh: uploadedImageUrl
        };

        try {
            if (editingQuestionId) {
                await apiClient.put(`/quizzes/questions/${editingQuestionId}`, payload);
            } else {
                await apiClient.post('/quizzes/questions', payload);
            }
            closeQuestionModal();
            loadQuestions();
        } catch (err) {
            alert('Lỗi: ' + (err.message || 'Không thể lưu câu hỏi'));
        } finally {
            btnSave.innerHTML = oldText;
            btnSave.disabled = false;
        }
    });

    makeAdminTablesResizableAndSticky();
});
