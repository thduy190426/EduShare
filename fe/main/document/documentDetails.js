import { API_URL } from '../shared/config.js';
import { decodeJWT, escapeHTML, getAssetUrl, getToken, getAvatar, getUserProfileUrl } from '../shared/utils.js';

let currentMaTL = null;
const token = getToken();
let hasSubmittedRating = false;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentMaTL = urlParams.get('id');

    if (!currentMaTL) {
        Swal.fire('Không tìm thấy tài liệu.');
        window.location.href = '../guest/guestHome.html';
        return;
    }

    
    if (token) {
        try {
            const payload = decodeJWT(token);
            if (payload) {
                if (payload.VaiTro === 'GiaoVien' || payload.VaiTro === 'Admin') {
                    const btnVerify = document.getElementById('btn-verify');
                    if (btnVerify) btnVerify.style.display = 'block'; 
                }
                
                const navUserName = document.getElementById('navUserName');
                const navAvatar = document.getElementById('navAvatar');
                const commentAvatar = document.querySelector('.comment-avatar');
                
                if (navUserName) navUserName.textContent = payload.HoTen || 'Người dùng';
                
                const savedAvatar = getAvatar();
                if (savedAvatar && savedAvatar !== 'null') {
                    const imgHtml = `<img src="${getAssetUrl(savedAvatar)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                    if (navAvatar) {
                        navAvatar.innerHTML = imgHtml;
                        navAvatar.style.backgroundColor = 'transparent';
                        navAvatar.style.color = 'transparent';
                    }
                    if (commentAvatar) {
                        commentAvatar.innerHTML = imgHtml;
                        commentAvatar.style.backgroundColor = 'transparent';
                        commentAvatar.style.color = 'transparent';
                    }
                } else {
                    const initial = (payload.HoTen || 'U').trim().split(' ').pop().charAt(0).toUpperCase();
                    if (navAvatar) {
                        navAvatar.textContent = initial;
                        navAvatar.style.backgroundColor = 'var(--primary-light)';
                        navAvatar.style.color = 'var(--primary)';
                    }
                    if (commentAvatar) {
                        commentAvatar.textContent = initial;
                        commentAvatar.style.backgroundColor = 'var(--primary-light)';
                        commentAvatar.style.color = 'var(--primary)';
                    }
                }
            }
        } catch (e) {
            console.error('Lỗi parse token:', e);
        }
    } else {
        const userProfileNav = document.getElementById('userProfileNav');
        if (userProfileNav) userProfileNav.style.display = 'none';
        
        const commentForm = document.querySelector('.comment-form');
        if (commentForm) commentForm.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding:10px;">Vui lòng <a href="../auth/login.html" style="color:var(--primary); font-weight:600;">đăng nhập</a> để bình luận.</p>';
    }

    fetchDocumentDetails();
    setupEventListeners();
});

async function fetchDocumentDetails() {
    try {
        const response = await fetch(`${API_URL}/documents/${currentMaTL}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!response.ok) {
            throw new Error('Lỗi khi tải chi tiết tài liệu');
        }

        const data = await response.json();
        renderDocumentInfo(data.document);
        renderComments(data.comments);
        fetchRelatedDocuments();

        const icon = document.getElementById('bookmark-icon');
        const text = document.getElementById('bookmark-text');
        if (data.isBookmarked && icon && text) {
            icon.className = 'fa-solid fa-bookmark';
            text.textContent = 'Đã lưu Bookmark';
        }

        const ratingHint = document.querySelector('.rating-count');
        if (data.hasRated) {
            lockRatingUI();
        } else if (token && !data.hasDownloaded && ratingHint) {
            ratingHint.textContent = 'Tải tài liệu xuống trước khi đánh giá';
        }
    } catch (error) {
        console.error(error);
        Swal.fire('Không thể tải chi tiết tài liệu. Tài liệu có thể không tồn tại hoặc chưa được duyệt.');
    }
}

async function fetchRelatedDocuments() {
    const listEl = document.getElementById('related-docs-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="related-state">Đang tải tải liệu có liên quan...</div>';

    try {
        const response = await fetch(`${API_URL}/documents/${currentMaTL}/related?limit=5`);
        if (!response.ok) throw new Error('Cannot load related documents');

        const data = await response.json();
        renderRelatedDocuments(data.documents || []);
    } catch (error) {
        console.error('Lỗi khi tải tài liệu liên quan:', error);
        listEl.innerHTML = '<div class="related-state related-error">Không thể tải tài liệu có liên quan.</div>';
    }
}

function renderRelatedDocuments(documents) {
    const listEl = document.getElementById('related-docs-list');
    if (!listEl) return;

    if (documents.length === 0) {
        listEl.innerHTML = '<div class="related-state">Chưa có tài liệu có liên quan.</div>';
        return;
    }

    listEl.innerHTML = '';
    documents.forEach(doc => {
        const item = document.createElement('a');
        item.className = 'related-item';
        item.href = `documentDetails.html?id=${doc.MaTL}`;

        const loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';
        let icon = 'fa-file';
        let thumbClass = '';
        if (loaiFile === 'pdf') {
            icon = 'fa-file-pdf';
            thumbClass = 'related-thumb-pdf';
        } else if (loaiFile === 'pptx' || loaiFile === 'ppt') {
            icon = 'fa-chart-column';
            thumbClass = 'related-thumb-ppt';
        } else if (loaiFile === 'docx' || loaiFile === 'doc') {
            icon = 'fa-pen-to-square';
            thumbClass = 'related-thumb-doc';
        }

        const rating = parseFloat(doc.DiemDanhGia || 0).toFixed(1);
        const downloads = (doc.SoLuotTai || 0).toLocaleString('vi-VN');
        const officialBadge = doc.LaTaiLieuChinhThuc
            ? '<span class="related-official"><i class="fa-solid fa-check"></i></span>'
            : '';

        item.innerHTML = `
            <div class="related-thumb ${thumbClass}">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div class="related-info">
                <div class="related-name">${escapeHTML(doc.TenTL)} ${officialBadge}</div>
                <div class="related-meta">${escapeHTML(doc.TenMonHoc || 'Không có môn học')}</div>
                <div class="related-stats">
                    <span><i class="fa-solid fa-download"></i> ${downloads}</span>
                    <span><i class="fa-solid fa-star"></i> ${rating}</span>
                </div>
            </div>
        `;

        listEl.appendChild(item);
    });
}

function renderDocumentInfo(doc) {
    document.getElementById('doc-title').textContent = doc.TenTL;
    const authorNameEl = document.getElementById('doc-author-name');
    const authorProfileUrl = getUserProfileUrl(doc.MaND_NguoiDang);
    authorNameEl.textContent = doc.TenNguoiDang;
    if (authorProfileUrl) {
        authorNameEl.style.cursor = 'pointer';
        authorNameEl.title = 'Xem hồ sơ người đăng';
        authorNameEl.onclick = () => {
            window.location.href = authorProfileUrl;
        };
    }
    const authorAvatarEl = document.getElementById('doc-author-avatar');
    if (authorProfileUrl) {
        authorAvatarEl.style.cursor = 'pointer';
        authorAvatarEl.title = 'Xem hồ sơ người đăng';
        authorAvatarEl.onclick = () => {
            window.location.href = authorProfileUrl;
        };
    }
    if (doc.AvatarURL) {
        authorAvatarEl.innerHTML = `<img src="${getAssetUrl(doc.AvatarURL)}" alt="${doc.TenNguoiDang}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        authorAvatarEl.style.backgroundColor = 'transparent';
    } else {
        authorAvatarEl.innerHTML = doc.TenNguoiDang.trim().split(' ').pop().charAt(0).toUpperCase();
        authorAvatarEl.style.backgroundColor = 'var(--primary-light)';
        authorAvatarEl.style.color = 'var(--primary)';
    }
    
    
    const dateObj = new Date(doc.NgayDang);
    const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;
    const dateOnlyStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
    const dateHtml = `<i class="fa-regular fa-clock" style="margin-right:4px;"></i>${timeStr} <span style="margin: 0 4px; color: #D1D5DB;">|</span> <i class="fa-regular fa-calendar" style="margin-right:4px;"></i>${dateOnlyStr}`;
    document.getElementById('doc-author-date').innerHTML = `Đăng tải: ${dateHtml}`;

    document.getElementById('doc-views').textContent = (doc.SoLuotXem || 0).toLocaleString();
    document.getElementById('doc-downloads').textContent = (doc.SoLuotTai || 0).toLocaleString();
    
    
    const avgScore = doc.DiemDanhGia ? parseFloat(doc.DiemDanhGia).toFixed(1) : '0.0';
    document.getElementById('doc-rating-score').textContent = avgScore;
    updateStarUI(Math.round(avgScore));

    
    document.getElementById('preview-filename').textContent = doc.TenTL || getFileNameFromPath(doc.FileURL);
    let icon = 'fa-file';
    let badgeClass = 'badge-primary';
    let loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';
    if (loaiFile === 'pdf') { icon = 'fa-file-pdf'; badgeClass = 'badge-file-pdf'; }
    else if (loaiFile === 'pptx' || loaiFile === 'ppt') icon = 'fa-chart-column';
    else if (loaiFile === 'docx' || loaiFile === 'doc') icon = 'fa-pen-to-square';
    
    const previewContainer = document.querySelector('.preview-pages');
    if (loaiFile === 'pdf') {
        const fileUrlFull = `http://localhost:3000${doc.FileURL}`;
        previewContainer.innerHTML = `<iframe src="${fileUrlFull}#toolbar=0" style="width: 100%; height: 100%; border: none;"></iframe>`;
        previewContainer.style.width = '100%';
        previewContainer.style.height = 'calc(100% - 44px)';
        previewContainer.style.marginTop = '44px';
        previewContainer.style.boxShadow = 'none';
    } else {
        previewContainer.innerHTML = `
          <i class="fa-solid ${icon}" style="font-size: 64px; color: #9CA3AF; margin-bottom: 16px;"></i>
          <p style="color: #6B7280; font-size: 16px; font-weight: 500;">Chưa hỗ trợ xem trước trực tiếp định dạng này.</p>
          <p style="color: #9CA3AF; font-size: 14px; margin-top: 8px;">Vui lòng tải xuống để xem chi tiết.</p>
        `;
    }

    
    const badgesContainer = document.getElementById('doc-badges');
    badgesContainer.innerHTML = '';
    
    
    const fileBadge = document.createElement('span');
    fileBadge.className = `badge ${badgeClass}`;
    fileBadge.innerHTML = `<i class="fa-solid ${icon}"></i> ${doc.LoaiFile.toUpperCase()}`;
    badgesContainer.appendChild(fileBadge);

    
    const subjectBadge = document.createElement('span');
    subjectBadge.className = 'badge badge-primary';
    subjectBadge.innerHTML = `<i class="fa-solid fa-folder"></i> ${doc.TenMonHoc}`;
    badgesContainer.appendChild(subjectBadge);

    
    if (doc.LaTaiLieuChinhThuc) {
        const officialBadge = document.createElement('span');
        officialBadge.className = 'badge badge-official';
        officialBadge.innerHTML = `<i class="fa-solid fa-check"></i> Tài liệu chính thống`;
        badgesContainer.appendChild(officialBadge);
    }
    
    
    const btnVerify = document.getElementById('btn-verify');
    if (btnVerify && btnVerify.style.display !== 'none') {
        const verifyIcon = document.getElementById('verify-icon');
        if (doc.LaTaiLieuChinhThuc) {
            btnVerify.style.backgroundColor = '#D1FAE5'; 
            btnVerify.style.color = '#065F46'; 
            btnVerify.style.borderColor = '#34D399';
            document.getElementById('verify-text').textContent = 'Đã xác thực';
            if (verifyIcon) verifyIcon.className = 'fa-solid fa-circle-check';
        } else {
            btnVerify.style.backgroundColor = '#F3F4F6'; 
            btnVerify.style.color = '#374151';
            btnVerify.style.borderColor = '#D1D5DB';
            document.getElementById('verify-text').textContent = 'Xác thực chất lượng';
            if (verifyIcon) verifyIcon.className = 'fa-solid fa-certificate';
        }
    }
}

function getFileNameFromPath(filePath) {
    if (!filePath) return '';
    return filePath.split(/[\\/]/).pop();
}

function updateStarUI(score) {
    const stars = document.querySelectorAll('#doc-rating-stars i');
    stars.forEach(star => {
        const val = parseInt(star.getAttribute('data-val'));
        if (val <= score) {
            star.className = 'fa-solid fa-star';
            star.style.color = '#F59E0B';
        } else {
            star.className = 'fa-regular fa-star';
            star.style.color = '#D1D5DB';
        }
    });
}

function lockRatingUI() {
    hasSubmittedRating = true;
    const stars = document.querySelectorAll('#doc-rating-stars i');
    stars.forEach(star => {
        star.style.cursor = 'not-allowed';
        star.style.opacity = '0.75';
    });
    const ratingHint = document.querySelector('.rating-count');
    if (ratingHint) ratingHint.textContent = 'Bạn đã đánh giá tài liệu này.';
}

function setupEventListeners() {
    
    const btnVerify = document.getElementById('btn-verify');
    if (btnVerify) {
        btnVerify.addEventListener('click', async () => {
            if (!token) return Swal.fire('Vui lòng đăng nhập.');
            try {
                const res = await fetch(`${API_URL}/documents/${currentMaTL}/verify`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok) {
                    Swal.fire(data.message);
                    fetchDocumentDetails(); 
                } else {
                    Swal.fire(data.message);
                }
            } catch (err) {
                console.error(err);
                Swal.fire('Lỗi xác thực.');
            }
        });
    }

    
    document.getElementById('btn-download').addEventListener('click', async () => {
        if (!token) {
            Swal.fire('Vui lòng đăng nhập để tải tài liệu.');
            return;
        }
        try {
            const res = await fetch(`${API_URL}/documents/${currentMaTL}/download`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                
                let fileName = `Tailieu_${currentMaTL}`;
                const downloadFileName = res.headers.get('x-download-filename');
                if (downloadFileName) {
                    fileName = decodeURIComponent(downloadFileName);
                }
                const disposition = res.headers.get('content-disposition');
                if (!downloadFileName && disposition && disposition.indexOf('filename=') !== -1) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) { 
                        fileName = matches[1].replace(/['"]/g, '');
                    }
                }
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                
                const countEl = document.getElementById('doc-downloads');
                countEl.textContent = (parseInt(countEl.textContent.replace(/,/g, '')) + 1).toLocaleString();
                const ratingHint = document.querySelector('.rating-count');
                if (ratingHint && !hasSubmittedRating) {
                    ratingHint.textContent = 'Bấm vào sao để đánh giá.';
                }
            } else {
                const errData = await res.json();
                Swal.fire(errData.message || 'Lỗi tải xuống hoặc bạn không có quyền tải.');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Lỗi kết nối máy chủ.');
        }
    });

    
    document.getElementById('btn-bookmark').addEventListener('click', async () => {
        if (!token) return Swal.fire('Vui lòng đăng nhập để lưu tài liệu.');
        try {
            const res = await fetch(`${API_URL}/documents/${currentMaTL}/bookmark`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                const icon = document.getElementById('bookmark-icon');
                const text = document.getElementById('bookmark-text');
                if (data.isBookmarked) {
                    icon.className = 'fa-solid fa-bookmark';
                    text.textContent = 'Đã lưu Bookmark';
                } else {
                    icon.className = 'fa-regular fa-bookmark';
                    text.textContent = 'Lưu vào Bookmark';
                }
            } else {
                Swal.fire(data.message);
            }
        } catch (err) {
            console.error(err);
        }
    });

    let isReporting = false;
    const btnReport = document.getElementById('btn-report');
    
    btnReport.addEventListener('click', async () => {
        if (!token) return Swal.fire('Vui lòng đăng nhập để báo cáo.');
        if (isReporting) return;
        
        const { value: lyDo } = await Swal.fire({
            title: 'Báo cáo vi phạm',
            input: 'textarea',
            inputLabel: 'Nhập lý do báo cáo vi phạm:',
            inputPlaceholder: 'Nhập chi tiết lỗi hoặc vi phạm...',
            showCancelButton: true,
            confirmButtonText: 'Gửi báo cáo',
            cancelButtonText: 'Hủy',
            inputValidator: (value) => {
                if (!value || value.trim() === '') {
                    return 'Vui lòng nhập lý do báo cáo!';
                }
            }
        });
        if (!lyDo || lyDo.trim() === '') return;

        isReporting = true;
        const originalHtml = btnReport.innerHTML;
        btnReport.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i></span> Đang gửi...';
        btnReport.style.pointerEvents = 'none';
        btnReport.style.opacity = '0.7';

        try {
            const res = await fetch(`${API_URL}/documents/${currentMaTL}/report`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ lyDo })
            });
            const data = await res.json();
            
            if (res.ok) {
                Swal.fire({ icon: 'success', title: data.message || 'Đã gửi báo cáo thành công.' });
                btnReport.innerHTML = '<span><i class="fa-solid fa-flag"></i></span> Đã báo cáo';
                btnReport.style.backgroundColor = '#F3F4F6';
                btnReport.style.color = '#9CA3AF';
                btnReport.style.borderColor = '#D1D5DB';
                btnReport.disabled = true;
            } else if (res.status === 409) {
                Swal.fire({ icon: 'info', title: data.message || 'Bạn đã báo cáo vi phạm tài liệu này rồi.' });
                btnReport.innerHTML = '<span><i class="fa-solid fa-flag"></i></span> Đã báo cáo';
                btnReport.style.backgroundColor = '#F3F4F6';
                btnReport.style.color = '#9CA3AF';
                btnReport.style.borderColor = '#D1D5DB';
                btnReport.disabled = true;
            } else {
                Swal.fire({ icon: 'error', title: data.message || 'Thao tác thất bại.' });
                isReporting = false;
                btnReport.innerHTML = originalHtml;
                btnReport.style.pointerEvents = 'auto';
                btnReport.style.opacity = '1';
            }
        } catch (err) {
            console.error(err);
            Swal.fire({ icon: 'error', title: 'Lỗi kết nối tới máy chủ.' });
            isReporting = false;
            btnReport.innerHTML = originalHtml;
            btnReport.style.pointerEvents = 'auto';
            btnReport.style.opacity = '1';
        }
    });

    
    const stars = document.querySelectorAll('#doc-rating-stars i');
    stars.forEach(star => {
        star.addEventListener('click', async (e) => {
            if (!token) return Swal.fire('Vui lòng đăng nhập để đánh giá.');
            if (hasSubmittedRating) return Swal.fire('Bạn đã đánh giá tài liệu này rồi.');
            const val = parseInt(e.target.getAttribute('data-val'));
            try {
                const res = await fetch(`${API_URL}/documents/${currentMaTL}/rate`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ soSao: val })
                });
                const data = await res.json();
                if (res.ok) {
                    const newScore = parseFloat(data.average).toFixed(1);
                    document.getElementById('doc-rating-score').textContent = newScore;
                    updateStarUI(Math.round(newScore));
                    lockRatingUI();
                    Swal.fire('Cảm ơn bạn đã đánh giá.');
                } else {
                    Swal.fire(data.message);
                }
            } catch (err) {
                console.error(err);
            }
        });
    });

    const commentInput = document.getElementById('comment-input');
    const btnSubmitComment = document.getElementById('btn-submit-comment');
    
    if (commentInput && btnSubmitComment) {
        btnSubmitComment.disabled = true;
        btnSubmitComment.style.opacity = '0.5';
        btnSubmitComment.style.cursor = 'not-allowed';

        commentInput.addEventListener('input', () => {
            const val = commentInput.value.trim();
            if (val.length > 0 && val.length <= 1000) {
                btnSubmitComment.disabled = false;
                btnSubmitComment.style.opacity = '1';
                btnSubmitComment.style.cursor = 'pointer';
            } else {
                btnSubmitComment.disabled = true;
                btnSubmitComment.style.opacity = '0.5';
                btnSubmitComment.style.cursor = 'not-allowed';
            }
        });

        btnSubmitComment.addEventListener('click', () => {
            const noiDung = commentInput.value;
            submitComment(noiDung, null);
        });
    }
}

async function submitComment(noiDung, maBL_Cha) {
    if (!token) return Swal.fire('Vui lòng đăng nhập để bình luận.');
    if (!noiDung.trim()) return Swal.fire('Vui lòng nhập nội dung.');

    try {
        const res = await fetch(`${API_URL}/documents/${currentMaTL}/comments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ noiDung, maBL_Cha })
        });
        
        if (res.ok) {
            const inputEl = document.getElementById('comment-input');
            if (inputEl) {
                inputEl.value = '';
                inputEl.dispatchEvent(new Event('input'));
            }
            fetchDocumentDetails(); 
        } else {
            const data = await res.json();
            Swal.fire(data.message);
        }
    } catch (err) {
        console.error(err);
    }
}


function renderComments(comments) {
    const listEl = document.getElementById('comments-list');
    listEl.innerHTML = '';
    
    
    const commentMap = {};
    const rootComments = [];

    comments.forEach(c => {
        if (!c.MaBL_Cha) {
            rootComments.push(c);
        } else {
            if (!commentMap[c.MaBL_Cha]) commentMap[c.MaBL_Cha] = [];
            commentMap[c.MaBL_Cha].push(c);
        }
    });

    
    const buildCommentNode = (comment, depth) => {
        const item = document.createElement('div');
        item.className = `comment-item ${depth > 0 ? 'reply' : ''}`;
        if (depth > 0) {
            item.style.marginLeft = `${depth * 40}px`; 
        }

        const dateObj = new Date(comment.NgayBinhLuan);
        const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;
        const dateOnlyStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
        const dateHtml = `<i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${timeStr} <span style="margin: 0 4px; color: #D1D5DB;">|</span> <i class="fa-regular fa-calendar" style="margin-right: 4px;"></i>${dateOnlyStr}`;
        const userInitial = escapeHTML(comment.TenNguoiBinhLuan).trim().split(' ').pop().charAt(0).toUpperCase();

        const isAuthor = comment.VaiTro === 'GiaoVien' || comment.VaiTro === 'Admin';
        let avatarHtml = `<div class="comment-avatar" style="${isAuthor ? 'background:#FEE2E2; color:#EF4444' : ''}">${userInitial}</div>`;
        
        if (comment.AvatarURL) {
            avatarHtml = `<div class="comment-avatar" style="background:transparent; color:transparent; padding:0;"><img src="${getAssetUrl(comment.AvatarURL)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;"></div>`;
        }

        const authorSuffix = isAuthor ? ' (Tác giả/Admin)' : '';

        item.innerHTML = `
            ${avatarHtml}
            <div class="comment-content">
              <div class="comment-header">
                <span class="comment-author">${escapeHTML(comment.TenNguoiBinhLuan)}${authorSuffix}</span>
                <span class="comment-time">${dateHtml}</span>
              </div>
              <div class="comment-text">${escapeHTML(comment.NoiDung)}</div>
              <div class="comment-actions">
                <span class="comment-action reply-btn" data-id="${comment.MaBL}">Phản hồi</span>
              </div>
            </div>
        `;

        listEl.appendChild(item);

        
        if (commentMap[comment.MaBL]) {
            commentMap[comment.MaBL].forEach(child => buildCommentNode(child, depth + 1));
        }
    };

    rootComments.forEach(c => buildCommentNode(c, 0));

    
    const replyBtns = listEl.querySelectorAll('.reply-btn');
    replyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const parentId = e.currentTarget.getAttribute('data-id');
            const commentContent = e.currentTarget.closest('.comment-content');
            
            document.querySelectorAll('.inline-reply-form').forEach(form => form.remove());
            
            const commentAvatarEl = document.querySelector('.comment-form .comment-avatar');
            const avatarHtml = commentAvatarEl ? commentAvatarEl.innerHTML : 'U';
            const avatarStyle = commentAvatarEl ? (commentAvatarEl.getAttribute('style') || '') : '';

            const formContainer = document.createElement('div');
            formContainer.className = 'comment-form inline-reply-form';
            formContainer.style.marginTop = '16px';
            formContainer.style.padding = '0';
            formContainer.style.border = 'none';

            formContainer.innerHTML = `
              <div class="comment-avatar" style="${avatarStyle}">${avatarHtml}</div>
              <div class="comment-input-area" style="flex:1;">
                <textarea id="reply-input-${parentId}" class="comment-textarea" placeholder="Viết phản hồi..."></textarea>
                <div style="display:flex; justify-content: flex-end; gap: 8px;">
                  <button id="btn-cancel-reply-${parentId}" class="btn-cancel" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #E5E7EB; background: white; color: #4B5563; font-weight: 500; cursor: pointer; transition: all 0.2s;"><i class="fa-solid fa-xmark" style="margin-right: 6px;"></i> Hủy</button>
                  <button id="btn-submit-reply-${parentId}" class="btn-submit" disabled style="opacity:0.5; cursor:not-allowed;"><i class="fa-solid fa-paper-plane" style="margin-right: 6px;"></i> Gửi phản hồi</button>
                </div>
              </div>
            `;
            
            commentContent.appendChild(formContainer);

            const btnCancelReply = document.getElementById(`btn-cancel-reply-${parentId}`);
            btnCancelReply.addEventListener('mouseover', () => btnCancelReply.style.background = '#F9FAFB');
            btnCancelReply.addEventListener('mouseout', () => btnCancelReply.style.background = 'white');

            const replyInput = document.getElementById(`reply-input-${parentId}`);
            const btnSubmitReply = document.getElementById(`btn-submit-reply-${parentId}`);

            replyInput.focus();

            replyInput.addEventListener('input', () => {
                const val = replyInput.value.trim();
                if (val.length > 0 && val.length <= 1000) {
                    btnSubmitReply.disabled = false;
                    btnSubmitReply.style.opacity = '1';
                    btnSubmitReply.style.cursor = 'pointer';
                } else {
                    btnSubmitReply.disabled = true;
                    btnSubmitReply.style.opacity = '0.5';
                    btnSubmitReply.style.cursor = 'not-allowed';
                }
            });

            btnSubmitReply.addEventListener('click', () => {
                const noiDung = replyInput.value;
                submitComment(noiDung, parentId);
            });

            btnCancelReply.addEventListener('click', () => {
                formContainer.remove();
            });
        });
    });
}
