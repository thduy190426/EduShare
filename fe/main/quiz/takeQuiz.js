import { API_URL } from '../shared/config.js';
import { getToken, decodeJWT } from '../shared/utils.js';
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
                body: data ? JSON.stringify(data) : undefined
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

    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id') || urlParams.get('quizId');
    if (!quizId) {
        alert('Không tìm thấy đề thi!');
        window.location.href = '../user/userHome.html';
        return;
    }

    let quizData = null;
    let maKetQua = null;
    let timerInterval = null;
    let endTime = null;
    let isQuizActive = false;
    
    try {
        const quizInfo = await apiClient.get(`/quizzes/${quizId}`);
        document.getElementById('startQuizTitle').textContent = quizInfo.TieuDe || `Đề thi số ${quizId}`;
        
        const runningTitleEl = document.getElementById('runningQuizTitle');
        if (runningTitleEl) runningTitleEl.textContent = quizInfo.TieuDe || `Đề thi số ${quizId}`;

        const descEl = document.getElementById('startQuizDesc');
        if (descEl) descEl.textContent = quizInfo.MoTa || '';
        
        const runningDescEl = document.getElementById('runningQuizDesc');
        if (runningDescEl) runningDescEl.textContent = quizInfo.MoTa || '';
        
        const countEl = document.getElementById('startQuizQuestions');
        if (countEl) countEl.textContent = quizInfo.SoCauHoi || '--';
        
        const timeEl = document.getElementById('startQuizTime');
        if (timeEl) timeEl.textContent = quizInfo.ThoiGianLamBai === 0 ? 'Vô hạn' : `${quizInfo.ThoiGianLamBai} phút`;
    } catch (err) {
        console.error(err);
        document.getElementById('startQuizTitle').textContent = 'Đề thi số ' + quizId;
    }

    document.getElementById('btnStartQuiz').disabled = false;

    document.getElementById('btnStartQuiz').addEventListener('click', async () => {
        document.getElementById('btnStartQuiz').disabled = true;
        document.getElementById('btnStartQuiz').textContent = 'Đang tải...';
        
        try {
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
            }
            
            const res = await apiClient.post(`/quizzes/${quizId}/take`);
            quizData = res;
            maKetQua = res.MaKetQua;
            
            document.getElementById('startScreen').style.display = 'none';
            document.getElementById('quizContainer').style.display = 'block';
            isQuizActive = true;
            document.body.classList.add('quiz-active');
            
            playSound('start'); 
            
            renderQuestions();
            startTimer(res.quiz.ThoiGianLamBai);
            
        } catch (err) {
            alert(err.message || 'Lỗi khi bắt đầu bài thi');
            document.getElementById('btnStartQuiz').disabled = false;
            document.getElementById('btnStartQuiz').textContent = 'Bắt đầu làm bài';
        }
    });

    const renderQuestions = () => {
        const qList = document.getElementById('questionsList');
        const qNav = document.getElementById('questionNav');
        qList.innerHTML = '';
        qNav.innerHTML = '';

        quizData.questions.forEach((q, index) => {
            const qNum = index + 1;

            qNav.innerHTML += `<button type="button" class="nav-btn" onclick="document.getElementById('q${q.MaCauHoi}').scrollIntoView({behavior:'smooth', block:'center'})" id="nav-btn-${q.MaCauHoi}">${qNum}</button>`;

            let answersHtml = '';
            q.DapAn.forEach(ans => {
                answersHtml += `
                    <label class="answer-option">
                        <input type="radio" name="q_${q.MaCauHoi}" value="${ans.MaDapAn}" onchange="markAnswered(${q.MaCauHoi})">
                        <span>${ans.NoiDung}</span>
                    </label>
                `;
            });

            qList.innerHTML += `
                <div class="question-card" id="q${q.MaCauHoi}">
                    <span class="q-points">${q.Diem} điểm</span>
                    <div class="q-title"><span style="font-weight: 700; color: var(--primary);">Câu ${qNum}:</span></div>
                    <div class="q-content-html" style="margin-top: 8px; margin-bottom: 12px; font-size: 1.05rem; line-height: 1.6;">${q.NoiDung}</div>
                    ${q.HinhAnh ? '<div style="text-align: center; margin: 10px 0;"><img src="' + q.HinhAnh + '" alt="Ảnh câu hỏi" style="max-width: 100%; max-height: 300px; border-radius: 8px;"></div>' : ''}
                    <div class="answers-group">
                        ${answersHtml}
                    </div>
                </div>
            `;
        });
    };

    window.markAnswered = (qId) => {
        document.getElementById(`nav-btn-${qId}`).classList.add('answered');
        const opts = document.querySelectorAll(`input[name="q_${qId}"]`);
        opts.forEach(opt => {
            opt.parentElement.classList.remove('selected');
            if (opt.checked) opt.parentElement.classList.add('selected');
        });
    };

    const playSound = (type) => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'start') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.3);
            } else if (type === 'warning') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(400, ctx.currentTime);
                gain.gain.setValueAtTime(0.05, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.2);
                
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'square';
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.frequency.setValueAtTime(400, ctx.currentTime + 0.3);
                gain2.gain.setValueAtTime(0.05, ctx.currentTime + 0.3);
                gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                osc2.start(ctx.currentTime + 0.3);
                osc2.stop(ctx.currentTime + 0.5);
            }
        } catch(e) { console.error('Audio error', e); }
    };

    let warningPlayed = false;

    const startTimer = (minutes) => {
        if (!minutes || minutes <= 0) return; 
        
        const container = document.getElementById('timerContainer');
        const countSpan = document.getElementById('countdown');
        container.style.display = 'flex';

        endTime = Date.now() + minutes * 60000;
        warningPlayed = false;
        
        const updateTimer = () => {
            const now = Date.now();
            const left = endTime - now;
            
            if (left <= 0) {
                clearInterval(timerInterval);
                countSpan.textContent = "00:00";
                alert('Hết giờ làm bài! Hệ thống tự động nộp bài.');
                submitQuiz();
                return;
            }

            const m = Math.floor(left / 60000);
            const s = Math.floor((left % 60000) / 1000);
            countSpan.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

            if (left < 60000) {
                container.classList.add('warning');
                if (!warningPlayed) {
                    playSound('warning');
                    warningPlayed = true;
                }
            }
        };

        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
    };

    document.getElementById('btnSubmitQuiz').addEventListener('click', async () => {
        const totalQuestions = quizData.questions.length;
        let answeredQuestions = 0;
        
        quizData.questions.forEach(q => {
            if (document.querySelector(`input[name="q_${q.MaCauHoi}"]:checked`)) {
                answeredQuestions++;
            }
        });
        
        const unAnswered = totalQuestions - answeredQuestions;
        let confirmText = "Bạn có chắc chắn muốn nộp bài? Bạn sẽ không thể thay đổi đáp án sau khi nộp.";
        let confirmIcon = 'question';
        let confirmColor = '#3b82f6';
        
        if (unAnswered > 0) {
            confirmText = `Bạn còn ${unAnswered} câu hỏi chưa trả lời! Bạn có chắc chắn muốn nộp bài ngay bây giờ không?`;
            confirmIcon = 'warning';
            confirmColor = '#ef4444'; 
        }

        const result = await Swal.fire({
            title: 'Nộp bài?',
            text: confirmText,
            icon: confirmIcon,
            showCancelButton: true,
            confirmButtonColor: confirmColor,
            cancelButtonColor: '#94a3b8',
            confirmButtonText: '<i class="fa-solid fa-paper-plane"></i> Nộp bài',
            cancelButtonText: 'Hủy',
            reverseButtons: true,
            customClass: {
                popup: 'modern-swal-popup'
            }
        });

        if (result.isConfirmed) {
            submitQuiz();
        }
    });

    const submitQuiz = async () => {
        isQuizActive = false;
        document.body.classList.remove('quiz-active');
        clearInterval(timerInterval);
        document.getElementById('btnSubmitQuiz').disabled = true;
        document.getElementById('btnSubmitQuiz').textContent = 'Đang nộp...';

        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(err => console.log(err));
        }

        const answers = [];
        quizData.questions.forEach(q => {
            const selected = document.querySelector(`input[name="q_${q.MaCauHoi}"]:checked`);
            if (selected) {
                answers.push({
                    MaCauHoi: q.MaCauHoi,
                    MaDapAn: Number(selected.value)
                });
            }
        });

        try {
            const result = await apiClient.post(`/quizzes/${quizId}/submit`, {
                MaKetQua: maKetQua,
                answers: answers
            });
            showResult(result);
        } catch (err) {
            alert('Lỗi nộp bài: ' + err.message);
            document.getElementById('btnSubmitQuiz').disabled = false;
            document.getElementById('btnSubmitQuiz').textContent = 'Nộp Bài';
        }
    };

    const showResult = (res) => {
        document.getElementById('timerContainer').style.display = 'none';
        
        document.getElementById('btnSubmitQuiz').style.display = 'none';
        
        document.getElementById('quizContainer').style.display = 'none';

        document.getElementById('resultScreen').style.display = 'block';
        document.getElementById('resultScore').textContent = parseFloat(res.DiemSo).toFixed(1);
        document.getElementById('resultCorrect').textContent = res.SoCauDung;
        document.getElementById('resultTotal').textContent = res.TongSoCau;

        const fbList = document.getElementById('feedbackList');
        if (fbList) fbList.style.display = 'none'; 

        const allInputs = document.querySelectorAll('#questionsList input[type="radio"]');
        allInputs.forEach(input => input.disabled = true);

        res.ChiTiet.forEach((ct, index) => {
            const qCard = document.getElementById(`q${ct.MaCauHoi}`);
            if (!qCard) return;

            const correctOption = qCard.querySelector(`input[value="${ct.MaDapAnDung}"]`);
            if (correctOption) {
                correctOption.parentElement.classList.add('correct-answer');
                correctOption.parentElement.style.backgroundColor = '#dcfce7';
                correctOption.parentElement.style.borderColor = '#22c55e';
                correctOption.parentElement.style.color = '#166534';
            }

            if (ct.MaDapAnDaChon && ct.MaDapAnDaChon !== ct.MaDapAnDung) {
                const wrongOption = qCard.querySelector(`input[value="${ct.MaDapAnDaChon}"]`);
                if (wrongOption) {
                    wrongOption.parentElement.classList.add('wrong-answer');
                    wrongOption.parentElement.style.backgroundColor = '#fee2e2';
                    wrongOption.parentElement.style.borderColor = '#ef4444';
                    wrongOption.parentElement.style.color = '#991b1b';
                }
            }
            
            const navBtn = document.getElementById(`nav-btn-${ct.MaCauHoi}`);
            if (navBtn) {
                navBtn.style.backgroundColor = ct.LaDapAnDung ? '#22c55e' : '#ef4444';
                navBtn.style.color = 'white';
                navBtn.style.borderColor = ct.LaDapAnDung ? '#22c55e' : '#ef4444';
            }

            if (ct.PhanHoiTuDong) {
                const feedbackDiv = document.createElement('div');
                feedbackDiv.className = 'q-feedback-box';
                feedbackDiv.style.marginTop = '15px';
                feedbackDiv.style.padding = '10px 15px';
                feedbackDiv.style.backgroundColor = '#f1f5f9';
                feedbackDiv.style.borderLeft = '4px solid #3b82f6';
                feedbackDiv.style.borderRadius = '0 8px 8px 0';
                feedbackDiv.innerHTML = `<strong><i class="fa-solid fa-lightbulb" style="color:#eab308"></i> Phản hồi:</strong> <span style="color:#334155">${ct.PhanHoiTuDong}</span>`;
                qCard.appendChild(feedbackDiv);
            }
        });
    };

    const btnReviewQuiz = document.getElementById('btnReviewQuiz');
    if (btnReviewQuiz) {
        btnReviewQuiz.addEventListener('click', () => {
            document.getElementById('resultScreen').style.display = 'none';
            document.getElementById('quizContainer').style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    document.addEventListener('fullscreenchange', () => {
        if (isQuizActive && !document.fullscreenElement) {
            Swal.fire({
                title: 'Cảnh báo!',
                text: 'Bạn vừa thoát khỏi chế độ toàn màn hình. Yêu cầu làm bài ở chế độ toàn màn hình để đảm bảo tính minh bạch.',
                icon: 'warning',
                confirmButtonText: '<i class="fa-solid fa-expand"></i> Quay lại toàn màn hình',
                allowOutsideClick: false,
                allowEscapeKey: false,
                confirmButtonColor: '#3b82f6',
                customClass: { popup: 'modern-swal-popup' }
            }).then((result) => {
                if (result.isConfirmed && document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(err => console.log(err));
                }
            });
        }
    });

    window.addEventListener('beforeunload', (e) => {
        if (isQuizActive) {
            e.preventDefault();
            e.returnValue = ''; 
        }
    });
});
