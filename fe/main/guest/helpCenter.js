const faqs = [
    {
        id: 1,
        category: 'account',
        question: 'Làm thế nào để đăng ký tài khoản mới?',
        answer: 'Bạn có thể nhấn vào nút "Đăng ký" ở góc trên bên phải màn hình. Điền đầy đủ thông tin (Họ tên, Email, Mật khẩu) và xác nhận qua email để hoàn tất việc tạo tài khoản.'
    },
    {
        id: 2,
        category: 'account',
        question: 'Tôi quên mật khẩu, làm cách nào để lấy lại?',
        answer: 'Tại trang đăng nhập, hãy nhấn vào liên kết "Quên mật khẩu". Nhập email bạn đã dùng để đăng ký, hệ thống sẽ gửi một mã hoặc liên kết để bạn đặt lại mật khẩu mới.'
    },
    {
        id: 3,
        category: 'document',
        question: 'Quy trình kiểm duyệt tài liệu mất bao lâu?',
        answer: 'Thông thường, các tài liệu tải lên sẽ được kiểm duyệt viên xem xét trong vòng 1-2 ngày làm việc. Bạn sẽ nhận được thông báo ngay khi tài liệu được duyệt hoặc bị từ chối kèm lý do.'
    },
    {
        id: 4,
        category: 'document',
        question: 'Tại sao tài liệu của tôi bị từ chối?',
        answer: 'Tài liệu có thể bị từ chối nếu vi phạm bản quyền, nội dung không phù hợp, định dạng file bị hỏng, hoặc chất lượng nội dung quá kém. Bạn có thể kiểm tra lý do cụ thể trong phần thông báo.'
    },
    {
        id: 5,
        category: 'coin',
        question: 'EduCoin là gì và làm sao để kiếm thêm?',
        answer: 'EduCoin (Xu) là đơn vị tiền tệ ảo trong EduShare. Bạn có thể kiếm xu bằng cách chia sẻ tài liệu hữu ích, người khác tải tài liệu của bạn, hoặc thông qua việc mua xu/nạp xu bằng tiền thật.'
    },
    {
        id: 6,
        category: 'coin',
        question: 'Tôi nạp xu nhưng chưa thấy cộng vào tài khoản?',
        answer: 'Hệ thống đôi khi cần vài phút để đồng bộ giao dịch. Vui lòng đợi từ 5-10 phút. Nếu xu vẫn chưa được cộng, hãy gửi yêu cầu hỗ trợ kèm theo mã giao dịch để chúng tôi kiểm tra.'
    },
    {
        id: 7,
        category: 'group',
        question: 'Làm thế nào để tạo một nhóm học tập?',
        answer: 'Trong mục "Nhóm học tập", nhấn vào nút "Tạo nhóm mới". Bạn cần điền tên nhóm, chọn môn học và cài đặt quyền riêng tư. Hãy chắc chắn tuân thủ quy định cộng đồng khi tạo nhóm.'
    },
    {
        id: 8,
        category: 'policy',
        question: 'Làm sao để báo cáo tài liệu vi phạm bản quyền?',
        answer: 'Tại trang chi tiết của tài liệu, bạn có thể nhấn vào nút "Báo cáo vi phạm" (biểu tượng cờ). Hãy chọn lý do "Vi phạm bản quyền" và cung cấp bằng chứng để Admin xử lý nhanh chóng.'
    }
];

document.addEventListener('DOMContentLoaded', () => {
    const faqContainer = document.getElementById('faq-list');
    const searchInput = document.getElementById('help-search-input');
    const categoryCards = document.querySelectorAll('.category-card');
    const noFaqMsg = document.getElementById('no-faq-msg');
    const supportForm = document.getElementById('support-form');

    let currentFilterCategory = null;
    let currentSearchQuery = '';

    function renderFaqs() {
        faqContainer.innerHTML = '';
        
        const filteredFaqs = faqs.filter(faq => {
            const matchesSearch = faq.question.toLowerCase().includes(currentSearchQuery) || 
                                  faq.answer.toLowerCase().includes(currentSearchQuery);
            const matchesCategory = currentFilterCategory ? faq.category === currentFilterCategory : true;
            return matchesSearch && matchesCategory;
        });

        if (filteredFaqs.length === 0) {
            noFaqMsg.style.display = 'block';
        } else {
            noFaqMsg.style.display = 'none';
            filteredFaqs.forEach(faq => {
                const item = document.createElement('div');
                item.className = 'faq-item';
                item.innerHTML = `
                    <div class="faq-question">
                        <span>${faq.question}</span>
                        <i class="fa-solid fa-chevron-down"></i>
                    </div>
                    <div class="faq-answer">
                        ${faq.answer}
                    </div>
                `;
                
                item.querySelector('.faq-question').addEventListener('click', () => {
                    const isActive = item.classList.contains('active');
                    document.querySelectorAll('.faq-item').forEach(el => el.classList.remove('active'));
                    if (!isActive) {
                        item.classList.add('active');
                    }
                });

                faqContainer.appendChild(item);
            });
        }
    }

    renderFaqs();

    if (searchInput) {
        let helpSearchTimer = null;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(helpSearchTimer);
            helpSearchTimer = setTimeout(() => {
                currentSearchQuery = e.target.value.toLowerCase().trim();
                renderFaqs();
                
                if (currentSearchQuery !== '') {
                    categoryCards.forEach(card => card.classList.remove('active'));
                    currentFilterCategory = null;
                }
            }, 500);
        });
    }

    categoryCards.forEach(card => {
        card.addEventListener('click', () => {
            const category = card.getAttribute('data-category');
            
            if (card.classList.contains('active')) {
                card.classList.remove('active');
                currentFilterCategory = null;
            } else {
                categoryCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                currentFilterCategory = category;
                
                if (searchInput) {
                    searchInput.value = '';
                    currentSearchQuery = '';
                }
            }
            
            renderFaqs();
            
            document.querySelector('.help-faq').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    if (supportForm) {
        supportForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = document.getElementById('contact-name').value;
            const email = document.getElementById('contact-email').value;
            const topic = document.getElementById('contact-topic').value;
            const message = document.getElementById('contact-message').value;

            if (!name || !email || !topic || !message) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Thiếu thông tin',
                    text: 'Vui lòng điền đầy đủ các trường bắt buộc.'
                });
                return;
            }

            const btn = supportForm.querySelector('.btn-submit-support');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';
            btn.disabled = true;

            setTimeout(() => {
                Swal.fire({
                    icon: 'success',
                    title: 'Gửi thành công!',
                    text: 'Yêu cầu của bạn đã được ghi nhận. Đội ngũ hỗ trợ sẽ liên hệ với bạn qua email trong thời gian sớm nhất.',
                    confirmButtonColor: 'var(--primary)'
                });
                supportForm.reset();
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 1000);
        });
    }
});