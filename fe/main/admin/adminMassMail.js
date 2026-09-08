import { API_URL } from '../shared/config.js';
import { getToken, decodeJWT, getAssetUrl } from '../shared/utils.js';

let quill;
let isValidSpecificUser = false;

document.addEventListener('DOMContentLoaded', () => {
    const token = getToken();
    if (!token) {
        window.location.href = '../../pages/auth/login.html';
        return;
    }
    
    const user = decodeJWT(token);
    if (!user || user.VaiTro !== 'Admin') {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi truy cập',
            text: 'Bạn không có quyền truy cập trang này.'
        }).then(() => {
            window.location.href = '../../pages/user/userHome.html';
        });
        return;
    }

    quill = new Quill('#editor-container', {
        theme: 'snow',
        placeholder: 'Soạn nội dung email ở đây...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'align': [] }],
                ['link', 'image'],
                ['clean']
            ]
        }
    });

    const btnSend = document.getElementById('btnSendMail');
    const mailSubject = document.getElementById('mailSubject');
    const mailTarget = document.getElementById('mailTarget');
    const specificUserRow = document.getElementById('specificUserRow');
    const specificUserInfo = document.getElementById('specificUserInfo');
    const specificEmail = document.getElementById('specificEmail');
    const btnCheckEmail = document.getElementById('btnCheckEmail');

    btnSend.disabled = true;

    function validateForm() {
        const subject = mailSubject.value.trim();
        const htmlContent = quill.root.innerHTML;
        const textContent = quill.getText().trim();
        const target = mailTarget.value;
        
        const isSubjectValid = subject.length > 0;
        const isBodyValid = textContent.length > 0 || htmlContent.includes('<img');
        const isTargetValid = target !== 'specific' || isValidSpecificUser;
        
        btnSend.disabled = !(isSubjectValid && isBodyValid && isTargetValid);
    }

    mailTarget.addEventListener('change', () => {
        if (mailTarget.value === 'specific') {
            specificUserRow.style.display = 'flex';
            const email = specificEmail.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            btnCheckEmail.disabled = !emailRegex.test(email);
        } else {
            specificUserRow.style.display = 'none';
            specificUserInfo.style.display = 'none';
            isValidSpecificUser = false;
        }
        validateForm();
    });

    specificEmail.addEventListener('input', () => {
        const email = specificEmail.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        btnCheckEmail.disabled = !emailRegex.test(email);
        
        isValidSpecificUser = false;
        specificUserInfo.style.display = 'none';
        validateForm();
    });

    btnCheckEmail.addEventListener('click', async () => {
        const email = specificEmail.value.trim();
        if (!email) {
            Swal.fire('Lỗi', 'Vui lòng nhập email.', 'warning');
            return;
        }

        const oldText = btnCheckEmail.innerHTML;
        btnCheckEmail.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnCheckEmail.disabled = true;

        try {
            const res = await fetch(`${API_URL}/admin/user-by-email?email=${encodeURIComponent(email)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (res.ok) {
                document.getElementById('specificUserAvatar').src = getAssetUrl(data.AvatarURL) || 'https://via.placeholder.com/50';
                document.getElementById('specificUserName').textContent = data.HoTen;
                document.getElementById('specificUserRole').textContent = `Vai trò: ${data.VaiTro}`;
                
                specificUserInfo.style.display = 'flex';
                isValidSpecificUser = true;
            } else {
                specificUserInfo.style.display = 'none';
                isValidSpecificUser = false;
                Swal.fire('Thất bại', data.message || 'Không tìm thấy người dùng.', 'error');
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Lỗi', 'Không thể kết nối máy chủ.', 'error');
        } finally {
            btnCheckEmail.innerHTML = oldText;
            btnCheckEmail.disabled = false;
            validateForm();
        }
    });

    mailSubject.addEventListener('input', validateForm);
    quill.on('text-change', validateForm);

    document.getElementById('massMailForm').addEventListener('submit', handleSendMail);
});

async function handleSendMail(e) {
    e.preventDefault();
    
    const target = document.getElementById('mailTarget').value;
    const subject = document.getElementById('mailSubject').value.trim();
    const targetEmail = document.getElementById('specificEmail').value.trim();
    
    const htmlContent = quill.root.innerHTML;

    if (!subject) {
        Swal.fire('Lỗi', 'Vui lòng nhập tiêu đề email.', 'warning');
        return;
    }

    if (quill.getText().trim().length === 0 && !htmlContent.includes('<img')) {
        Swal.fire('Lỗi', 'Vui lòng nhập nội dung email.', 'warning');
        return;
    }

    if (target === 'specific' && (!isValidSpecificUser || !targetEmail)) {
        Swal.fire('Lỗi', 'Vui lòng kiểm tra và xác nhận email người dùng hợp lệ.', 'warning');
        return;
    }

    const token = getToken();
    const btnSend = document.getElementById('btnSendMail');
    
    try {
        const result = await Swal.fire({
            title: 'Xác nhận gửi email?',
            text: target === 'specific' ? `Email sẽ được gửi đến ${targetEmail}.` : "Email sẽ được gửi đến tập người dùng đã chọn. Quá trình này có thể mất một lúc.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Gửi ngay',
            cancelButtonText: 'Hủy'
        });

        if (!result.isConfirmed) return;

        btnSend.disabled = true;
        btnSend.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';

        const payload = { target, subject, htmlContent };
        if (target === 'specific') {
            payload.targetEmail = targetEmail;
        }

        const response = await fetch(`${API_URL}/admin/mass-mail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Thành công',
                text: data.message
            }).then(() => {
                document.getElementById('mailSubject').value = '';
                quill.setContents([]);
                if (target === 'specific') {
                    document.getElementById('specificEmail').value = '';
                    document.getElementById('specificUserInfo').style.display = 'none';
                    isValidSpecificUser = false;
                }
            });
        } else {
            throw new Error(data.message || 'Có lỗi xảy ra khi gửi email.');
        }

    } catch (error) {
        console.error('Send mail error:', error);
        Swal.fire('Lỗi!', error.message, 'error');
    } finally {
        btnSend.disabled = false;
        btnSend.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi Email';
    }
}
