import { API_URL } from '../shared/config.js';
import { getToken, decodeJWT, formatDate } from '../shared/utils.js';
import '../shared/sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    const token = getToken();
    if (!token) {
        window.location.href = '../auth/login.html';
        return;
    }

    const decoded = decodeJWT(token);
    if (decoded.VaiTro !== 'SinhVien') {
        alert('Chức năng này chỉ dành cho học sinh/sinh viên');
        window.location.href = '../user/userHome.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const resultId = urlParams.get('id');
    if (!resultId) {
        alert('Không tìm thấy kết quả!');
        window.location.href = 'quizHistory.html';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/quizzes/history/${resultId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        document.getElementById('loadingIndicator').style.display = 'none';
        document.getElementById('resultContent').style.display = 'block';

        document.getElementById('quizTitle').textContent = data.attempt.TieuDe;
        document.getElementById('quizScore').textContent = `${data.attempt.DiemSo} / 100`;
        document.getElementById('totalQuestions').textContent = data.TongSoCau;
        document.getElementById('correctAnswers').textContent = `${data.SoCauDung} / ${data.TongSoCau}`;
        document.getElementById('submitTime').textContent = formatDate(data.attempt.ThoiGianNopBai);

        const qList = document.getElementById('questionsList');
        qList.innerHTML = '';

        data.questions.forEach((q, index) => {
            const isCorrect = q.LaDapAnDung;
            const cardClass = isCorrect ? 'correct' : (q.MaDapAnDaChon ? 'incorrect' : '');
            const statusClass = isCorrect ? 'correct' : 'incorrect';
            const statusText = isCorrect ? 'Đúng' : (q.MaDapAnDaChon ? 'Sai' : 'Chưa trả lời');

            let answersHtml = '';
            q.DapAn.forEach(ans => {
                const isSelected = ans.MaDapAn === q.MaDapAnDaChon;
                const isAnsCorrect = !!ans.LaDapAnDung;

                let itemClass = '';
                let iconHtml = '';

                if (isSelected) {
                    itemClass += ' selected ';
                    if (isAnsCorrect) {
                        itemClass += ' correct ';
                        iconHtml = '<i class="fa-solid fa-check"></i>';
                    } else {
                        itemClass += ' incorrect ';
                        iconHtml = '<i class="fa-solid fa-xmark"></i>';
                    }
                } else if (isAnsCorrect) {
                    itemClass += ' correct ';
                    iconHtml = '<i class="fa-solid fa-check"></i>';
                }

                answersHtml += `
                    <div class="answer-item ${itemClass}">
                        <div class="answer-icon">${iconHtml}</div>
                        <div class="answer-text">${ans.NoiDung}</div>
                    </div>
                `;
            });

            let feedbackHtml = '';
            if (q.PhanHoiTuDong) {
                feedbackHtml = `
                    <div class="feedback-box">
                        <h4>Giải thích:</h4>
                        <p>${q.PhanHoiTuDong}</p>
                    </div>
                `;
            }

            const imgHtml = q.HinhAnh ? `<img src="${q.HinhAnh.startsWith('http') ? q.HinhAnh : API_URL.replace('/api', '') + q.HinhAnh}" alt="Question Image" style="max-width: 100%; margin-bottom: 16px; border-radius: 8px;">` : '';

            const qCard = document.createElement('div');
            qCard.className = `question-card ${cardClass}`;
            qCard.innerHTML = `
                <div class="question-header">
                    <span class="question-number">Câu ${index + 1}</span>
                    <span class="question-status ${statusClass}">${statusText}</span>
                </div>
                <div class="question-content">
                    ${q.NoiDung}
                </div>
                ${imgHtml}
                <div class="answers-list">
                    ${answersHtml}
                </div>
                ${feedbackHtml}
            `;

            qList.appendChild(qCard);
        });

    } catch (err) {
        console.error(err);
        alert(err.message || 'Không thể tải chi tiết kết quả');
        window.location.href = 'quizHistory.html';
    }
});
