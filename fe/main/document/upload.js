import { API_URL } from '../shared/config.js';
import { getAssetUrl, getToken, getAvatar } from '../shared/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    loadUserProfileNav();
    const uploadForm = document.getElementById('uploadForm');
    const fileUpload = document.getElementById('fileUpload');
    const filePreview = document.getElementById('filePreview');
    const uploadZone = document.querySelector('.upload-zone');
    const previewName = document.getElementById('previewName');
    const previewSize = document.getElementById('previewSize');
    const btnRemoveFile = document.getElementById('btnRemoveFile');
    const subjectSelect = document.getElementById('maMonHoc');
    const tenTLInput = document.getElementById('tenTL');
    const btnUpload = uploadForm.querySelector('button[type="submit"]');

    function checkUploadConditions() {
        const tenTL = tenTLInput.value.trim();
        const maMonHoc = subjectSelect.value;
        const file = fileUpload.files[0];

        if (tenTL && maMonHoc && file) {
            btnUpload.disabled = false;
            btnUpload.style.opacity = '1';
            btnUpload.style.cursor = 'pointer';
        } else {
            btnUpload.disabled = true;
            btnUpload.style.opacity = '0.6';
            btnUpload.style.cursor = 'not-allowed';
        }
    }
    
    if (uploadZone) {
        uploadZone.style.display = 'flex';
    }
    
    checkUploadConditions();
    tenTLInput.addEventListener('input', checkUploadConditions);
    subjectSelect.addEventListener('change', checkUploadConditions);

    loadSubjects(subjectSelect);

    const token = getToken();
    let isOfficialUser = false;
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.VaiTro === 'GiaoVien' || payload.VaiTro === 'Admin') {
                isOfficialUser = true;
            }
        } catch (e) {
            console.error('Lỗi parse token', e);
        }
    }

    const officialFormGroup = document.getElementById('official-form-group');
    if (isOfficialUser && officialFormGroup) {
        officialFormGroup.style.display = 'block';
    }

    
    fileUpload.addEventListener('change', function () {
        const file = this.files[0];
        if (file) {
            
            if (file.size > 20 * 1024 * 1024) {
                Swal.fire('Dung lượng file vượt quá giới hạn 20MB.');
                this.value = ''; 
                return;
            }

            
            const validExtensions = ['pdf', 'docx', 'pptx'];
            const fileExtension = file.name.split('.').pop().toLowerCase();
            if (!validExtensions.includes(fileExtension)) {
                Swal.fire('Chỉ cho phép định dạng PDF, DOCX, PPTX.');
                this.value = ''; 
                return;
            }

            
            if (previewName) previewName.textContent = file.name;
            const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
            if (previewSize) previewSize.textContent = `Kích thước: ${sizeInMB} MB`;

            const btnSelectFile = document.getElementById('btnSelectFile');
            if (btnSelectFile && !filePreview) {
                btnSelectFile.innerHTML = `<i class="fa-solid fa-file-circle-check" style="margin-right: 8px;"></i>Đã chọn: ${file.name} - Đổi file`;
            }

            if (uploadZone && filePreview) {
                uploadZone.style.display = 'none';
                filePreview.style.display = 'flex';
            }
        } else {
            const btnSelectFile = document.getElementById('btnSelectFile');
            if (btnSelectFile && !filePreview) {
                btnSelectFile.innerHTML = `<i class="fa-solid fa-folder-open" style="margin-right: 8px;"></i>Chọn file từ máy tính`;
            }
        }
        checkUploadConditions();
    });

    if (btnRemoveFile) {
        btnRemoveFile.addEventListener('click', () => {
            fileUpload.value = '';
            if (filePreview) filePreview.style.display = 'none';
            if (uploadZone) uploadZone.style.display = 'flex';
            checkUploadConditions();
        });
    }

    
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const tenTL = document.getElementById('tenTL').value.trim();
        const maMonHoc = subjectSelect.value;
        const moTa = document.getElementById('moTa').value.trim();
        const file = fileUpload.files[0];

        if (!maMonHoc) {
            Swal.fire('Vui lòng chọn môn học.');
            return;
        }

        if (!file) {
            Swal.fire('Vui lòng chọn file tài liệu đính kèm.');
            return;
        }

        
        const token = getToken();
        if (!token) {
            Swal.fire('Bạn chưa đăng nhập. Vui lòng đăng nhập lại.');
            window.location.href = '../auth/login.html';
            return;
        }

        
        const formData = new FormData();
        formData.append('tenTL', tenTL);
        formData.append('maMonHoc', maMonHoc);
        formData.append('moTa', moTa);
        formData.append('fileUpload', file);

        const cbOfficial = document.getElementById('laTaiLieuChinhThuc');
        if (cbOfficial && cbOfficial.checked) {
            formData.append('laTaiLieuChinhThuc', 'true');
        }

        try {
            
            const response = await fetch(`${API_URL}/documents/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                Swal.fire('Tải lên tài liệu thành công! Tài liệu đang chờ kiểm duyệt.');
                window.location.href = 'myDocuments.html';
            } else {
                Swal.fire(`Lỗi: ${data.message || 'Tải lên thất bại'}`);
            }
        } catch (error) {
            console.error('Lỗi khi tải tài liệu:', error);
            Swal.fire('Đã xảy ra lỗi khi tải tài liệu lên server.');
        }
    });
});

async function loadSubjects(selectEl) {
    if (!selectEl) return;

    selectEl.disabled = true;
    selectEl.innerHTML = '<option value="" disabled selected>Đang tải môn học...</option>';

    try {
        const response = await fetch(`${API_URL}/documents/subjects`);
        if (!response.ok) throw new Error('Cannot load subjects');

        const data = await response.json();
        const subjects = data.subjects || [];

        selectEl.innerHTML = '<option value="" disabled selected>Chọn môn học</option>';
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.MaMonHoc;
            option.textContent = subject.TenMonHoc;
            selectEl.appendChild(option);
        });

        if (subjects.length === 0) {
            selectEl.innerHTML = '<option value="" disabled selected>Chưa có môn học</option>';
        }
    } catch (error) {
        console.error('Lỗi tải môn học:', error);
        selectEl.innerHTML = '<option value="" disabled selected>Không thể tải môn học</option>';
    } finally {
        selectEl.disabled = false;
    }
}

function loadUserProfileNav() {
    const token = getToken();
    if (!token) {
        window.location.href = '../auth/login.html';
        return;
    }
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload) return;
        const avatarEl = document.getElementById('navAvatar');
        
        if (avatarEl && payload.HoTen) {
            const savedAvatar = getAvatar();
            if (savedAvatar && savedAvatar !== 'null') {
                avatarEl.innerHTML = `<img src="${getAssetUrl(savedAvatar)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                avatarEl.style.background = 'transparent';
                avatarEl.style.color = 'transparent';
            } else {
                avatarEl.textContent = payload.HoTen.trim().split(' ').pop().charAt(0).toUpperCase();
            }
        }
    } catch (e) {
        console.error('Lỗi giải mã token:', e);
    }
}
