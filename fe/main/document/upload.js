import { renderBreadcrumb } from '../shared/utils.js';
import { API_URL } from '../shared/config.js';
import { getAssetUrl, getToken, getAvatar } from '../shared/utils.js';

let maxUploadSizeMB = 20; 

async function fetchUploadSettings() {
    try {
        const response = await fetch(`${API_URL}/settings`);
        if (response.ok) {
            const data = await response.json();
            if (data.MAX_UPLOAD_SIZE_MB) {
                maxUploadSizeMB = parseFloat(data.MAX_UPLOAD_SIZE_MB.giaTri) || 20;
            }
        }
    } catch (e) { console.error('Lỗi tải cấu hình upload', e); }
}
fetchUploadSettings();

document.addEventListener('DOMContentLoaded', () => {
    renderBreadcrumb([{ name: 'Trang chủ', url: '../user/userHome.html' }, { name: 'Đăng tài liệu' }]);

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
    const subjectLevelInfo = createSubjectLevelInfo(subjectSelect);

    let moTaEditor;
    if (typeof Quill !== 'undefined') {
        moTaEditor = new Quill('#moTa-editor', {
            theme: 'snow',
            placeholder: 'Viết mô tả ngắn gọn về nội dung tài liệu...',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link'],
                    ['clean']
                ]
            }
        });
    }

    const checkAndRestoreDraft = () => {
        const draftTitle = localStorage.getItem('draft_upload_title');
        const draftDesc = localStorage.getItem('draft_upload_desc');

        if (draftTitle || draftDesc) {
            Swal.fire({
                title: 'Khôi phục bản nháp?',
                text: 'Bạn có một bản nháp tài liệu chưa đăng tải. Bạn có muốn khôi phục không?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Có, khôi phục',
                cancelButtonText: 'Không, bỏ qua'
            }).then((result) => {
                if (result.isConfirmed) {
                    if (draftTitle && tenTLInput) tenTLInput.value = draftTitle;
                    if (draftDesc && moTaEditor) moTaEditor.root.innerHTML = draftDesc;
                    checkUploadConditions();
                } else {
                    localStorage.removeItem('draft_upload_title');
                    localStorage.removeItem('draft_upload_desc');
                }
            });
        }
    };
    checkAndRestoreDraft();

    if (moTaEditor) {
        moTaEditor.on('text-change', () => {
            localStorage.setItem('draft_upload_desc', moTaEditor.root.innerHTML);
        });
    }

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
    tenTLInput.addEventListener('input', () => {
        localStorage.setItem('draft_upload_title', tenTLInput.value);
        checkUploadConditions();
    });
    subjectSelect.addEventListener('change', () => {
        checkUploadConditions();
        updateSubjectLevelInfo(subjectSelect, subjectLevelInfo);
    });

    loadSubjects(subjectSelect, subjectLevelInfo);

    const token = getToken();
    let isOfficialUser = false;
    let currentUserRole = '';
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            currentUserRole = payload.VaiTro || '';
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

    const premiumFormGroup = document.getElementById('premium-form-group');
    if (isOfficialUser && premiumFormGroup) {
        premiumFormGroup.style.display = 'block';
    }

    const cbPremium = document.getElementById('laTaiLieuDocQuyen');
    const giaXuContainer = document.getElementById('giaXuContainer');
    if (cbPremium && giaXuContainer) {
        cbPremium.addEventListener('change', function() {
            if (this.checked) {
                giaXuContainer.style.display = 'block';
                document.getElementById('giaXu').required = true;
            } else {
                giaXuContainer.style.display = 'none';
                document.getElementById('giaXu').required = false;
            }
        });
    }

    if (currentUserRole === 'GiaoVien') {
        setupSubjectSuggestionUI(subjectSelect, token);
    }

    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
        });
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                fileUpload.files = e.dataTransfer.files;
                const event = new Event('change');
                fileUpload.dispatchEvent(event);
            }
        });
        uploadZone.addEventListener('click', (e) => {
            if (e.target !== fileUpload && !e.target.closest('#btnSelectFile')) {
                fileUpload.click();
            }
        });
    }

    fileUpload.addEventListener('change', function () {
        const file = this.files[0];
        if (file) {

            if (file.size > maxUploadSizeMB * 1024 * 1024) {
                Swal.fire(`Dung lượng file vượt quá giới hạn ${maxUploadSizeMB}MB.`);
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

            const selectedFileType = document.querySelector('input[name="filetype"]:checked')?.value;
            if (selectedFileType) {
                if (selectedFileType === 'pdf' && fileExtension !== 'pdf') {
                    Swal.fire('Bạn đã chọn "Tài liệu PDF" nhưng file tải lên không phải là PDF.');
                    this.value = ''; 
                    return;
                }
                if (selectedFileType === 'docx' && fileExtension !== 'docx') {
                    Swal.fire('Bạn đã chọn "Tài liệu Word" nhưng file tải lên không phải là DOCX.');
                    this.value = ''; 
                    return;
                }
                if (selectedFileType === 'pptx' && fileExtension !== 'pptx') {
                    Swal.fire('Bạn đã chọn "Tài liệu PowerPoint" nhưng file tải lên không phải là PPTX.');
                    this.value = ''; 
                    return;
                }
            }

            if (previewName) previewName.textContent = file.name;
            const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
            if (previewSize) previewSize.textContent = `Kích thước: ${sizeInMB} MB`;

            const fileIconContainer = document.querySelector('#filePreview .file-icon');
            if (fileIconContainer) {
                if (fileExtension === 'pdf') {
                    fileIconContainer.innerHTML = '<i class="fa-solid fa-file-pdf"></i>';
                    fileIconContainer.style.color = '#EF4444';
                } else if (fileExtension === 'docx' || fileExtension === 'doc') {
                    fileIconContainer.innerHTML = '<i class="fa-solid fa-file-word"></i>';
                    fileIconContainer.style.color = '#3B82F6';
                } else if (fileExtension === 'pptx' || fileExtension === 'ppt') {
                    fileIconContainer.innerHTML = '<i class="fa-solid fa-file-powerpoint"></i>';
                    fileIconContainer.style.color = '#F97316';
                } else {
                    fileIconContainer.innerHTML = '<i class="fa-solid fa-file-lines"></i>';
                    fileIconContainer.style.color = 'var(--primary)';
                }
            }

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

async function generatePdfThumbnail(file) {
    if (file.type !== 'application/pdf' && file.name.split('.').pop().toLowerCase() !== 'pdf') return null;
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.0 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        return new Promise(resolve => {
            canvas.toBlob(blob => {
                if (blob) {
                    const thumbFile = new File([blob], file.name.replace('.pdf', '_thumb.webp'), { type: 'image/webp' });
                    resolve(thumbFile);
                } else {
                    resolve(null);
                }
            }, 'image/webp', 0.8);
        });
    } catch(e) {
        console.error('Error generating PDF thumbnail:', e);
        return null;
    }
}

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const tenTL = document.getElementById('tenTL').value.trim();
        const maMonHoc = subjectSelect.value;

        let moTa = '';
        if (moTaEditor) {
            const moTaText = moTaEditor.getText().trim();
            if (moTaText) {
                moTa = moTaEditor.root.innerHTML;
            }
        }

        const file = fileUpload.files[0];

        if (!maMonHoc) {
            Swal.fire('Vui lòng chọn môn học.');
            return;
        }

        if (!file) {
            Swal.fire('Vui lòng chọn file tài liệu đính kèm.');
            return;
        }

        const selectedFileType = document.querySelector('input[name="filetype"]:checked')?.value;
        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (selectedFileType) {
            if (selectedFileType === 'pdf' && fileExtension !== 'pdf') {
                Swal.fire('File tải lên không khớp với loại tài liệu PDF đã chọn.');
                return;
            }
            if (selectedFileType === 'docx' && fileExtension !== 'docx') {
                Swal.fire('File tải lên không khớp với loại tài liệu Word đã chọn.');
                return;
            }
            if (selectedFileType === 'pptx' && fileExtension !== 'pptx') {
                Swal.fire('File tải lên không khớp với loại tài liệu PowerPoint đã chọn.');
                return;
            }
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

        const cbOfficial = document.getElementById('laTaiLieuChinhThuc');
        if (cbOfficial && cbOfficial.checked) {
            formData.append('laTaiLieuChinhThuc', 'true');
        }

        const cbPremium = document.getElementById('laTaiLieuDocQuyen');
        if (cbPremium && cbPremium.checked) {
            formData.append('laTaiLieuDocQuyen', 'true');
            formData.append('giaXu', document.getElementById('giaXu').value);
        }

        const originalBtnContent = btnUpload.innerHTML;
        btnUpload.disabled = true;
        btnUpload.style.opacity = '0.7';
        btnUpload.style.cursor = 'not-allowed';

        try {
            btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang chuẩn bị tải lên...';

            const sigRes = await fetch(`${API_URL}/documents/generate-signature`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!sigRes.ok) throw new Error('Không thể tạo chữ ký bảo mật.');
            const sigData = await sigRes.json();

            const cloudForm = new FormData();
            cloudForm.append('file', file);
            cloudForm.append('api_key', sigData.apiKey);
            cloudForm.append('timestamp', sigData.timestamp);
            cloudForm.append('signature', sigData.signature);
            cloudForm.append('folder', sigData.folder);

            let thumbnailUrl = null;
            btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo ảnh bìa...';
            const thumbnailFile = await generatePdfThumbnail(file);
            if (thumbnailFile) {
                const thumbCloudForm = new FormData();
                thumbCloudForm.append('file', thumbnailFile);
                thumbCloudForm.append('api_key', sigData.apiKey);
                thumbCloudForm.append('timestamp', sigData.timestamp);
                thumbCloudForm.append('signature', sigData.signature);
                thumbCloudForm.append('folder', sigData.folder);

                try {
                    const thumbCloudData = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloudName}/auto/upload`, {
                        method: 'POST',
                        body: thumbCloudForm
                    }).then(res => res.json());
                    thumbnailUrl = thumbCloudData.secure_url;
                } catch(e) { console.error('Lỗi upload thumbnail:', e); }
            }

            btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải lên Cloud...';

            const uploadProgressContainer = document.getElementById('uploadProgressContainer');
            const uploadProgressBar = document.getElementById('uploadProgressBar');
            const uploadProgressPercent = document.getElementById('uploadProgressPercent');
            const uploadProgressText = document.getElementById('uploadProgressText');
            const uploadSpeedText = document.getElementById('uploadSpeedText');
            const uploadSizeText = document.getElementById('uploadSizeText');

            if (uploadProgressContainer) {
                uploadProgressContainer.style.display = 'block';
                uploadProgressBar.style.width = '0%';
                uploadProgressPercent.textContent = '0%';
                uploadProgressText.textContent = 'Đang tải lên máy chủ Cloud...';
                if(uploadSpeedText) uploadSpeedText.textContent = '0 KB/s';
                if(uploadSizeText) uploadSizeText.textContent = '0 MB / 0 MB';
            }

            const cloudData = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `https://api.cloudinary.com/v1_1/${sigData.cloudName}/auto/upload`);

                let lastLoaded = 0;
                let lastTime = Date.now();

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable && uploadProgressContainer) {
                        const percentComplete = Math.round((event.loaded / event.total) * 100);
                        uploadProgressBar.style.width = percentComplete + '%';
                        uploadProgressPercent.textContent = percentComplete + '%';

                        const currentTime = Date.now();
                        const timeDiff = (currentTime - lastTime) / 1000; 
                        if (timeDiff >= 0.5 || percentComplete === 100) { 
                            const loadedDiff = event.loaded - lastLoaded;
                            let speed = loadedDiff / timeDiff; 
                            
                            let speedText = '';
                            if (speed > 1024 * 1024) {
                                speedText = (speed / (1024 * 1024)).toFixed(1) + ' MB/s';
                            } else {
                                speedText = (speed / 1024).toFixed(0) + ' KB/s';
                            }
                            if(uploadSpeedText) uploadSpeedText.textContent = speedText;

                            lastLoaded = event.loaded;
                            lastTime = currentTime;
                        }

                        if (uploadSizeText) {
                            const loadedMB = (event.loaded / (1024 * 1024)).toFixed(2);
                            const totalMB = (event.total / (1024 * 1024)).toFixed(2);
                            uploadSizeText.textContent = `${loadedMB} MB / ${totalMB} MB`;
                        }
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error('Lỗi tải lên máy chủ Cloudinary.'));
                    }
                };

                xhr.onerror = () => reject(new Error('Lỗi kết nối mạng khi tải lên.'));
                xhr.send(cloudForm);
            });

            if (uploadProgressContainer) {
                uploadProgressText.textContent = 'Đang lưu trữ dữ liệu...';
            }

            btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu trữ dữ liệu...';
            formData.append('cloudinaryUrl', cloudData.secure_url);
            formData.append('publicId', cloudData.public_id);
            formData.append('mimeType', file.type);
            formData.append('fileName', file.name);
            if (thumbnailUrl) {
                formData.append('thumbnailUrl', thumbnailUrl);
            }

            const response = await fetch(`${API_URL}/documents/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (uploadProgressContainer) {
                uploadProgressContainer.style.display = 'none';
            }

            if (response.ok) {
                localStorage.removeItem('draft_upload_title');
                localStorage.removeItem('draft_upload_desc');
                await Swal.fire({
                    icon: 'success',
                    title: 'Thành công',
                    text: 'Tải lên tài liệu thành công! Tài liệu đang chờ Admin kiểm duyệt.',
                    confirmButtonText: 'Đồng ý',
                    allowOutsideClick: false
                });
                window.location.href = 'myDocuments.html';
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Tải lên thất bại',
                    text: data.message || 'Tải lên thất bại'
                });
                btnUpload.disabled = false;
                btnUpload.style.opacity = '1';
                btnUpload.style.cursor = 'pointer';
                btnUpload.innerHTML = originalBtnContent;
            }
        } catch (error) {
            console.error('Lỗi khi tải tài liệu:', error);
            if (uploadProgressContainer) {
                uploadProgressContainer.style.display = 'none';
            }
            Swal.fire({
                icon: 'error',
                title: 'Lỗi máy chủ',
                text: 'Đã xảy ra lỗi khi tải tài liệu lên server.'
            });
            btnUpload.disabled = false;
            btnUpload.style.opacity = '1';
            btnUpload.style.cursor = 'pointer';
            btnUpload.innerHTML = originalBtnContent;
        }
    });
});

function createSubjectLevelInfo(subjectSelect) {
    const legacyLevelInput = document.querySelector('input[name="level"]');
    const legacyLevelGroup = legacyLevelInput?.closest('.form-group');
    if (legacyLevelGroup) legacyLevelGroup.remove();

    if (!subjectSelect) return null;

    const infoEl = document.createElement('div');
    infoEl.id = 'subjectLevelInfo';
    infoEl.className = 'subject-level-info';
    infoEl.setAttribute('aria-live', 'polite');
    infoEl.textContent = 'Cấp học sẽ được xác định theo môn học đã chọn.';
    subjectSelect.insertAdjacentElement('afterend', infoEl);
    return infoEl;
}

function updateSubjectLevelInfo(subjectSelect, infoEl) {
    if (!subjectSelect || !infoEl) return;

    const selectedOption = subjectSelect.options[subjectSelect.selectedIndex];
    const level = selectedOption?.dataset.level;
    infoEl.textContent = level
        ? `Cấp học: ${level}`
        : 'Cấp học sẽ được xác định theo môn học đã chọn.';
}

function setupSubjectSuggestionUI(subjectSelect, token) {
    if (!subjectSelect) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'subject-suggestion-entry';
    wrapper.innerHTML = `
        <span>Không tìm thấy môn học phù hợp?</span>
        <button type="button" class="subject-suggestion-button" id="btnOpenSubjectSuggestion">
            <i class="fa-solid fa-lightbulb"></i>
            Đề xuất môn học
        </button>
    `;
    subjectSelect.parentElement.appendChild(wrapper);

    const modal = document.createElement('div');
    modal.className = 'subject-suggestion-modal';
    modal.id = 'subjectSuggestionModal';
    modal.innerHTML = `
        <div class="subject-suggestion-dialog">
            <button type="button" class="subject-suggestion-close" id="btnCloseSubjectSuggestion" aria-label="Đóng">×</button>
            <h3>Đề xuất môn học mới</h3>
            <div class="form-group">
                <label class="form-label"><i class="fa-solid fa-book" style="margin-right: 6px; color: var(--text-secondary);"></i> Tên môn học: <span style="color:var(--danger)">*</span></label>
                <input type="text" id="suggestSubjectName" class="form-control" placeholder="Ví dụ: Lập trình Web nâng cao">
            </div>
            <div class="form-group">
                <label class="form-label"><i class="fa-solid fa-graduation-cap" style="margin-right: 6px; color: var(--text-secondary);"></i> Cấp học:</label>
                <input type="text" id="suggestSubjectLevel" class="form-control" placeholder="Ví dụ: Đại học, THPT...">
            </div>
            <div class="form-group">
                <label class="form-label"><i class="fa-solid fa-circle-info" style="margin-right: 6px; color: var(--text-secondary);"></i> Mô tả môn học:</label>
                <textarea id="suggestSubjectDesc" class="form-control" rows="3" placeholder="Mô tả ngắn nội dung môn học"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label"><i class="fa-solid fa-comment-dots" style="margin-right: 6px; color: var(--text-secondary);"></i> Lý do đề xuất:</label>
                <textarea id="suggestSubjectReason" class="form-control" rows="3" placeholder="Ví dụ: Tôi cần đăng tài liệu cho môn này nhưng hệ thống chưa có"></textarea>
            </div>
            <div class="subject-suggestion-actions">
                <button type="button" class="btn btn-ghost" id="btnCancelSubjectSuggestion"><i class="fa-solid fa-xmark" style="margin-right: 6px;"></i> Hủy</button>
                <button type="button" class="btn btn-primary" id="btnSubmitSubjectSuggestion" disabled style="opacity: 0.6; cursor: not-allowed;"><i class="fa-solid fa-paper-plane" style="margin-right: 6px;"></i> Gửi đề xuất</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const submitBtn = document.getElementById('btnSubmitSubjectSuggestion');
    const nameInput = document.getElementById('suggestSubjectName');
    const levelInput = document.getElementById('suggestSubjectLevel');
    const descInput = document.getElementById('suggestSubjectDesc');
    const reasonInput = document.getElementById('suggestSubjectReason');

    const validateForm = () => {
        const isValid = nameInput.value.trim().length > 0;
        submitBtn.disabled = !isValid;
        submitBtn.style.opacity = isValid ? '1' : '0.6';
        submitBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
    };

    [nameInput, levelInput, descInput, reasonInput].forEach(el => {
        if (el) el.addEventListener('input', validateForm);
    });

    const openModal = () => {
        validateForm();
        modal.classList.add('active');
    };
    const closeModal = () => modal.classList.remove('active');

    document.getElementById('btnOpenSubjectSuggestion')?.addEventListener('click', openModal);
    document.getElementById('btnCloseSubjectSuggestion')?.addEventListener('click', closeModal);
    document.getElementById('btnCancelSubjectSuggestion')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });

    document.getElementById('btnSubmitSubjectSuggestion')?.addEventListener('click', async () => {
        const submitBtn = document.getElementById('btnSubmitSubjectSuggestion');
        const tenMonHoc = document.getElementById('suggestSubjectName').value.trim();
        const capHoc = document.getElementById('suggestSubjectLevel').value.trim();
        const moTa = document.getElementById('suggestSubjectDesc').value.trim();
        const lyDo = document.getElementById('suggestSubjectReason').value.trim();

        if (!tenMonHoc) {
            Swal.fire('Vui lòng nhập tên môn học.');
            return;
        }

        submitBtn.disabled = true;
        try {
            const response = await fetch(`${API_URL}/subjects/suggestions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tenMonHoc, capHoc, moTa, lyDo })
            });
            const data = await response.json();

            if (!response.ok) {
                Swal.fire({
                    icon: 'error',
                    title: 'Đề xuất thất bại',
                    text: data.message || 'Không thể gửi đề xuất.'
                });
                return;
            }

            Swal.fire('Đã gửi đề xuất môn học. Vui lòng chờ Admin duyệt.');
            document.getElementById('suggestSubjectName').value = '';
            document.getElementById('suggestSubjectLevel').value = '';
            document.getElementById('suggestSubjectDesc').value = '';
            document.getElementById('suggestSubjectReason').value = '';
            closeModal();
        } catch (error) {
            console.error('Lỗi gửi đề xuất môn học:', error);
            Swal.fire({
                icon: 'error',
                title: 'Lỗi máy chủ',
                text: 'Đã xảy ra lỗi khi gửi đề xuất môn học.'
            });
        } finally {
            submitBtn.disabled = false;
        }
    });
}

async function loadSubjects(selectEl, subjectLevelInfo = null) {
    if (!selectEl) return;

    selectEl.disabled = true;
    updateSubjectLevelInfo(selectEl, subjectLevelInfo);
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
            option.dataset.level = subject.CapHoc || 'Khác';
            selectEl.appendChild(option);
        });

        if (subjects.length === 0) {
            selectEl.innerHTML = '<option value="" disabled selected>Chưa có môn học</option>';
        }
        updateSubjectLevelInfo(selectEl, subjectLevelInfo);
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
                avatarEl.style.background = 'var(--primary-light)';
                avatarEl.style.color = 'var(--primary)';
            }
        }
    } catch (e) {
        console.error('Lỗi giải mã token:', e);
    }
}
