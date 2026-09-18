import { API_URL } from '../shared/config.js';
import { getToken, getRefreshToken } from '../shared/utils.js';
import '../shared/sidebar.js'; 

document.addEventListener('DOMContentLoaded', () => {
    const quizGrid = document.getElementById('quizGrid');
    const subjectFilter = document.getElementById('subjectFilter');
    const searchInput = document.getElementById('quizSearchInput');
    const btnSearch = document.getElementById('btnSearch');
    const paginationEl = document.getElementById('pagination');

    let currentPage = 1;
    let currentLimit = 12;
    let currentSubjectId = '';
    let currentSearch = '';

    const token = getToken();
    if (!token) {
        window.location.href = '../guest/guestHome.html';
        return;
    }

    async function fetchSubjects() {
        try {
            const res = await fetch(`${API_URL}/subjects`);
            if (res.ok) {
                const subjects = await res.json();
                subjects.forEach(sub => {
                    const option = document.createElement('option');
                    option.value = sub.MaMonHoc;
                    option.textContent = sub.TenMonHoc;
                    subjectFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách môn học:', error);
        }
    }

    async function loadQuizzes() {
        showSkeletons();
        try {
            const queryParams = new URLSearchParams({
                page: currentPage,
                limit: currentLimit
            });
            if (currentSubjectId) queryParams.append('subjectId', currentSubjectId);
            if (currentSearch) queryParams.append('search', currentSearch);

            const res = await fetch(`${API_URL}/quizzes/published?${queryParams.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                throw new Error('Lỗi khi tải danh sách bài thi');
            }

            const data = await res.json();
            renderQuizzes(data.quizzes);
            renderPagination(data.pagination);
        } catch (error) {
            console.error(error);
            quizGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger);"></i>
                    <p>Không thể tải danh sách bài thi. Vui lòng thử lại sau.</p>
                </div>
            `;
        }
    }

    function renderQuizzes(quizzes) {
        if (!quizzes || quizzes.length === 0) {
            quizGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-folder-open"></i>
                    <p>Không tìm thấy bài thi nào phù hợp với tìm kiếm của bạn.</p>
                </div>
            `;
            return;
        }

        quizGrid.innerHTML = quizzes.map(quiz => `
            <div class="quiz-card">
                <div class="quiz-subject">${quiz.TenMonHoc || 'Không có môn học'}</div>
                <h3 class="quiz-title">${quiz.TieuDe}</h3>
                <div class="quiz-meta">
                    <div class="quiz-meta-item">
                        <i class="fa-regular fa-clock"></i>
                        <span>${quiz.ThoiGianLamBai > 0 ? quiz.ThoiGianLamBai + ' phút' : 'Không giới hạn'}</span>
                    </div>
                    <div class="quiz-meta-item">
                        <i class="fa-solid fa-list-ol"></i>
                        <span>${quiz.SoCauHoi || 0} câu hỏi</span>
                    </div>
                </div>
                <div class="quiz-author">
                    <img src="${quiz.AnhNguoiTao ? (quiz.AnhNguoiTao.startsWith('http') ? quiz.AnhNguoiTao : API_URL.replace('/api', '') + quiz.AnhNguoiTao) : `https://ui-avatars.com/api/?name=${encodeURIComponent(quiz.NguoiTao || 'A')}&background=random`}" alt="Avatar" class="author-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(quiz.NguoiTao || 'A')}&background=random'">
                    <span>Tạo bởi: <strong>${quiz.NguoiTao || 'Ẩn danh'}</strong></span>
                </div>
                <a href="takeQuiz.html?quizId=${quiz.MaQuiz}" class="btn-take-quiz">
                    <i class="fa-solid fa-play" style="margin-right: 6px;"></i> Làm bài ngay
                </a>
            </div>
        `).join('');
    }

    function renderPagination(pagination) {
        paginationEl.innerHTML = '';
        if (!pagination || pagination.totalPages <= 1) return;

        const { page, totalPages } = pagination;

        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        prevBtn.disabled = page === 1;
        prevBtn.onclick = () => {
            if (page > 1) {
                currentPage--;
                loadQuizzes();
            }
        };
        paginationEl.appendChild(prevBtn);

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-btn ${i === page ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.onclick = () => {
                    currentPage = i;
                    loadQuizzes();
                };
                paginationEl.appendChild(pageBtn);
            } else if (i === page - 2 || i === page + 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.padding = '0 8px';
                dots.style.color = 'var(--text-secondary)';
                paginationEl.appendChild(dots);
            }
        }

        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        nextBtn.disabled = page === totalPages;
        nextBtn.onclick = () => {
            if (page < totalPages) {
                currentPage++;
                loadQuizzes();
            }
        };
        paginationEl.appendChild(nextBtn);
    }

    function showSkeletons() {
        quizGrid.innerHTML = Array(6).fill(`
            <div class="skeleton-quiz-card" style="height: 200px; border-radius: var(--radius); background: #f3f4f6; animation: pulse 1.5s infinite;"></div>
        `).join('');
    }

    btnSearch.addEventListener('click', () => {
        currentPage = 1;
        currentSearch = searchInput.value.trim();
        currentSubjectId = subjectFilter.value;
        loadQuizzes();
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnSearch.click();
        }
    });

    fetchSubjects();
    loadQuizzes();
});
