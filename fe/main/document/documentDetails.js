import { API_URL } from '../shared/config.js';
import { decodeJWT, escapeHTML, formatRatingSummary, getAssetUrl, getToken, getAvatar, getUserProfileUrl } from '../shared/utils.js';
import { updateSEO } from '../shared/seo.js';
import { getSocket } from '../shared/socketClient.js';

let currentMaTL = null;
const token = getToken();
let hasSubmittedRating = false;
let currentUserMaND = null;
let allComments = [];
let documentOwnerId = null;

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
                currentUserMaND = payload.MaND;
                if (payload.VaiTro === 'GiaoVien' || payload.VaiTro === 'Admin') {
                    const btnVerify = document.getElementById('btn-verify');
                    if (btnVerify) btnVerify.style.display = 'flex';
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
        renderDocumentInfo(data.document, data.hasPurchased);
        updateSEO(data.document.TenTL, data.document.TextSEO || data.document.MoTa);
        
        allComments = data.comments || [];
        documentOwnerId = data.document.MaND_NguoiDang;
        renderComments(allComments, documentOwnerId);

        const socket = getSocket();
        if (socket) {
            socket.emit('join_document', currentMaTL);
            socket.off('new_document_comment');
            socket.on('new_document_comment', (comment) => {
                const exists = allComments.find(c => c.MaBL === comment.MaBL);
                if (!exists) {
                    allComments.push(comment);
                    renderComments(allComments, documentOwnerId);
                }
            });
        }
        fetchRelatedDocuments();
        fetchRelatedGroups();

        const icon = document.getElementById('bookmark-icon');
        const text = document.getElementById('bookmark-text');
        if (data.isBookmarked && icon && text) {
            icon.className = 'fa-solid fa-bookmark';
            text.textContent = 'Đã lưu';
        }

        const ratingHint = document.querySelector('.rating-count');
        if (data.hasRated) {
            lockRatingUI('Cảm ơn bạn đã đánh giá');
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
        listEl.innerHTML = '<div class="related-state" style="text-align: left;">Chưa có tài liệu có liên quan.</div>';
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

        const rating = formatRatingSummary(doc.DiemDanhGia, doc.SoDanhGia);
        const downloads = (doc.SoLuotTai || 0).toLocaleString('vi-VN');
        const officialBadge = doc.LaTaiLieuChinhThuc
            ? '<span class="related-official"><i class="fa-solid fa-check"></i></span>'
            : '';
        const premiumBadge = doc.LaTaiLieuDocQuyen
            ? '<span class="related-official" style="background: #FEF3C7; color: #B45309;"><i class="fa-solid fa-crown" style="color: #F59E0B;"></i></span>'
            : '';

        item.innerHTML = `
            <div class="related-thumb ${thumbClass}">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div class="related-info">
                <div class="related-name">${escapeHTML(doc.TenTL)} ${officialBadge} ${premiumBadge}</div>
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

function renderDocumentInfo(doc, hasPurchased) {
    if (doc.IsDeleted) {
        document.querySelector('.document-header').insertAdjacentHTML('beforebegin', `
            <div style="background-color: #FEF3C7; color: #92400E; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #F59E0B; display: flex; align-items: center; gap: 10px;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.2rem;"></i>
                <div>
                    <strong>Tài liệu này đã bị tác giả hoặc Admin gỡ khỏi hệ thống.</strong><br>
                    <span style="font-size: 0.9em;">Tuy nhiên, bạn vẫn có thể xem và tải xuống vì bạn là Tác giả hoặc đã thanh toán cho tài liệu này trước đó.</span>
                </div>
            </div>
        `);
    }

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
    const ratingHint = document.querySelector('.rating-count');
    if (ratingHint) ratingHint.textContent = `${Number(doc.SoDanhGia || 0).toLocaleString('vi-VN')} lượt đánh giá`;
    updateStarUI(Math.round(avgScore));

    
    document.getElementById('preview-filename').textContent = doc.TenTL || getFileNameFromPath(doc.FileURL);
    let icon = 'fa-file';
    let badgeClass = 'badge-primary';
    let loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';
    if (loaiFile === 'pdf') { icon = 'fa-file-pdf'; badgeClass = 'badge-file-pdf'; }
    else if (loaiFile === 'pptx' || loaiFile === 'ppt') icon = 'fa-chart-column';
    else if (loaiFile === 'docx' || loaiFile === 'doc') icon = 'fa-pen-to-square';
    
    const previewContainer = document.querySelector('.preview-pages');
    if (previewContainer) {
        previewContainer.style.background = '';
        previewContainer.style.border = '';
    }
    if (loaiFile === 'pdf' || (doc.PreviewURL && doc.PreviewURL !== 'null')) {
        let rawUrl = doc.FileURL || doc.PreviewURL;
        if (rawUrl) {
            let fileUrlFull = rawUrl.startsWith('http') ? rawUrl : `${API_URL.replace('/api', '')}${rawUrl}`;
            
            if (loaiFile === 'pdf' && doc.MaTL && rawUrl && rawUrl.includes('uploads/')) {
                fileUrlFull = `${API_URL}/documents/${doc.MaTL}/stream`;
            }
            
            renderPdfToCanvas(fileUrlFull, previewContainer);
            previewContainer.style.width = '100%';
            previewContainer.style.height = 'calc(100% - 44px)';
            previewContainer.style.marginTop = '44px';
            previewContainer.style.boxShadow = 'none';
            previewContainer.style.overflowY = 'auto';
            previewContainer.style.display = 'flex';
            previewContainer.style.flexDirection = 'column';
            previewContainer.style.alignItems = 'center';
            previewContainer.style.gap = '10px';
            previewContainer.style.backgroundColor = '#e5e7eb';
            previewContainer.style.padding = '20px 0';
        } else {
            previewContainer.innerHTML = `
              <i class="fa-solid fa-lock" style="font-size: 64px; color: #F59E0B; margin-bottom: 16px;"></i>
              <p style="color: #6B7280; font-size: 16px; font-weight: 500;">Đây là tài liệu độc quyền.</p>
              <p style="color: #9CA3AF; font-size: 14px; margin-top: 8px;">Bạn cần mua tài liệu này để xem nội dung.</p>
            `;
        }
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

    let isAuthor = false;
    let isPrivileged = false; 
    if (token) {
        try {
            const payload = decodeJWT(token);
            if (payload && payload.MaND === doc.MaND_NguoiDang) isAuthor = true;
            if (payload && (payload.VaiTro === 'Admin' || payload.VaiTro === 'GiaoVien')) isPrivileged = true;
        } catch(e) {}
    }

    if (doc.LaTaiLieuDocQuyen) {
        const premiumBadge = document.createElement('span');
        premiumBadge.className = 'badge';
        premiumBadge.style.backgroundColor = '#FEF3C7';
        premiumBadge.style.color = '#B45309';
        if (isPrivileged) {
            premiumBadge.innerHTML = `<i class="fa-solid fa-crown" style="color: #F59E0B;"></i> PREMIUM`;
        } else {
            premiumBadge.innerHTML = `<i class="fa-solid fa-crown" style="color: #F59E0B;"></i> PREMIUM (${doc.GiaXu || 0} Xu)`;
        }
        badgesContainer.appendChild(premiumBadge);
    }
    
    const btnDownload = document.getElementById('btn-download');
    if (btnDownload) {
        if (doc.LaTaiLieuDocQuyen && !hasPurchased) {
            if (!isAuthor && !isPrivileged) {
                btnDownload.innerHTML = `<span><i class="fa-solid fa-lock"></i></span> Mở khoá (${doc.GiaXu || 0} Xu)`;
                btnDownload.style.backgroundColor = '#F59E0B';
                btnDownload.onclick = async () => {
                    if (!token) return Swal.fire('Vui lòng đăng nhập để mở khoá tài liệu.');
                    
                    const result = await Swal.fire({
                        title: 'Mở khoá tài liệu',
                        html: `Bạn có muốn mở khoá tài liệu <b>${doc.TenTL}</b> với giá <b>${doc.GiaXu} Xu</b> không?`,
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonText: 'Đồng ý',
                        cancelButtonText: 'Hủy'
                    });

                    if (result.isConfirmed) {
                        try {
                            const res = await fetch(`${API_URL}/documents/${doc.MaTL}/buy`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const buyData = await res.json();
                            if (res.ok) {
                                Swal.fire('Thành công', 'Đã mở khoá tài liệu!', 'success');
                                fetchDocumentDetails(); 
                            } else {
                                Swal.fire('Thất bại', buyData.message, 'error');
                            }
                        } catch (err) {
                            console.error(err);
                            Swal.fire('Lỗi máy chủ', 'Không thể xử lý giao dịch lúc này.', 'error');
                        }
                    }
                };
                
                const previewContainer = document.querySelector('.preview-pages');
                if (previewContainer) {
                    previewContainer.innerHTML = `
                      <i class="fa-solid fa-lock" style="font-size: 64px; color: #FCD34D; margin-bottom: 16px;"></i>
                      <p style="color: #92400E; font-size: 16px; font-weight: 500;">Tài liệu PREMIUM đã bị khóa.</p>
                      <p style="color: #B45309; font-size: 14px; margin-top: 8px;">Vui lòng mở khoá để xem trước và tải về.</p>
                    `;
                    previewContainer.style.background = '#FFFBEB';
                    previewContainer.style.border = '1px solid #FDE68A';
                }
            } else {
                btnDownload.innerHTML = `<span><i class="fa-solid fa-download"></i></span> Tải xuống`;
                btnDownload.style.backgroundColor = '';
                btnDownload.onclick = handleDownload;
            }
        } else {
            btnDownload.innerHTML = `<span><i class="fa-solid fa-download"></i></span> Tải xuống`;
            btnDownload.style.backgroundColor = '';
            btnDownload.onclick = handleDownload;
        }
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
            document.getElementById('verify-text').textContent = 'Xác thực';
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

function lockRatingUI(message = 'Cảm ơn bạn đã đánh giá') {
    hasSubmittedRating = true;
    const stars = document.querySelectorAll('#doc-rating-stars i');
    stars.forEach(star => {
        star.style.cursor = 'not-allowed';
        star.style.opacity = '0.75';
    });
    const ratingHint = document.querySelector('.rating-count');
    if (ratingHint) ratingHint.textContent = message;
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



    let isBookmarking = false;
    document.getElementById('btn-bookmark').addEventListener('click', async () => {
        if (!token) return Swal.fire('Vui lòng đăng nhập để lưu tài liệu.');
        if (isBookmarking) return;
        
        isBookmarking = true;
        const btnBookmark = document.getElementById('btn-bookmark');
        btnBookmark.style.pointerEvents = 'none';
        btnBookmark.style.opacity = '0.7';

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
        } finally {
            setTimeout(() => {
                isBookmarking = false;
                btnBookmark.style.pointerEvents = 'auto';
                btnBookmark.style.opacity = '1';
            }, 2000);
        }
    });

    let isReporting = false;
    const btnReport = document.getElementById('btn-report');
    
    btnReport.addEventListener('click', async () => {
        if (!token) return Swal.fire('Vui lòng đăng nhập để báo cáo.');
        if (isReporting) return;
        
        isReporting = true;
        
        const { value: lyDo, isDismissed } = await Swal.fire({
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
        
        if (isDismissed || !lyDo || lyDo.trim() === '') {
            setTimeout(() => {
                isReporting = false;
            }, 1000);
            return;
        }

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
                    const ratingHint = document.querySelector('.rating-count');
                    updateStarUI(Math.round(newScore));
                    lockRatingUI('Cảm ơn bạn đã đánh giá');
                    Swal.fire('Cảm ơn bạn đã đánh giá.');
                } else {
                    Swal.fire(data.message);
                }
            } catch (err) {
                console.error(err);
            }
        });
    });

    const btnSubmitComment = document.getElementById('btn-submit-comment');
    
    let commentEditor;
    if (typeof Quill !== 'undefined' && document.getElementById('comment-editor')) {
        commentEditor = new Quill('#comment-editor', {
            theme: 'snow',
            placeholder: 'Viết bình luận hoặc đặt câu hỏi về tài liệu này...',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link'],
                    ['clean']
                ]
            }
        });
        
        btnSubmitComment.disabled = true;
        btnSubmitComment.style.opacity = '0.5';
        btnSubmitComment.style.cursor = 'not-allowed';

        commentEditor.on('text-change', () => {
            const val = commentEditor.getText().trim();
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
            const noiDung = commentEditor.root.innerHTML;
            submitComment(noiDung, null);
        });
    }
}

async function fetchRelatedGroups() {
    const cardEl = document.getElementById('related-groups-card');
    const listEl = document.getElementById('related-groups-list');
    if (!cardEl || !listEl) return;

    try {
        const response = await fetch(`${API_URL}/documents/${currentMaTL}/related-groups`);
        if (!response.ok) throw new Error('Cannot load related groups');

        const data = await response.json();
        const groups = data.groups || [];
        
        cardEl.style.display = 'block';
        if (groups.length === 0) {
            listEl.innerHTML = '<div style="font-size: 13px; color: var(--text-secondary); text-align: left; padding: 12px 0;">Chưa có nhóm nào có liên quan.</div>';
        } else {
            renderRelatedGroups(groups);
        }
    } catch (error) {
        console.error('Lỗi khi tải nhóm liên quan:', error);
        cardEl.style.display = 'block';
        listEl.innerHTML = '<div style="font-size: 13px; color: var(--danger); text-align: center; padding: 12px 0;">Lỗi khi tải nhóm liên quan.</div>';
    }
}

function renderRelatedGroups(groups) {
    const listEl = document.getElementById('related-groups-list');
    
    listEl.innerHTML = groups.map(group => {
        const avatarHtml = group.AnhBia 
            ? `<img src="${getAssetUrl(group.AnhBia)}" alt="${escapeHTML(group.TenNhom)}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover;">`
            : `<div style="width: 48px; height: 48px; border-radius: 8px; background: var(--primary-light); color: var(--secondary); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">${escapeHTML(group.TenNhom.charAt(0).toUpperCase())}</div>`;
            
        return `
            <a href="../group/groupDetails.html?id=${group.MaNhom}" class="related-item" style="text-decoration: none;">
                <div class="related-thumb" style="width: 48px; height: 48px; overflow: hidden; border-radius: 8px; flex-shrink: 0; border: 1px solid var(--border);">
                    ${avatarHtml}
                </div>
                <div class="related-info" style="display: flex; flex-direction: column; justify-content: center;">
                    <div class="related-name" style="font-weight: 600; font-size: 14px; color: var(--text-primary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                        ${escapeHTML(group.TenNhom)}
                    </div>
                    <div class="related-meta" style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                        <i class="fa-solid fa-users" style="margin-right: 4px;"></i> ${group.SoThanhVien || 0} thành viên
                    </div>
                </div>
            </a>
        `;
    }).join('');
}

function initTribute(element) {
    if (!window.Tribute) return;
    const tribute = new Tribute({
        values: async function (text, cb) {
            try {
                const res = await fetch(`${API_URL}/users/search?q=${text}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                if (!res.ok) return cb([]);
                const users = await res.json();
                cb(users);
            } catch (err) {
                cb([]);
            }
        },
        lookup: 'HoTen',
        fillAttr: 'HoTen',
        selectTemplate: function (item) {
            return `@[${item.original.HoTen}](${item.original.MaND})`;
        },
        menuItemTemplate: function (item) {
            if (item.original.AvatarURL) {
                return `<img src="${getAssetUrl(item.original.AvatarURL)}"> ${item.original.HoTen}`;
            } else {
                const initial = item.original.HoTen ? item.original.HoTen.charAt(0).toUpperCase() : 'U';
                return `<div style="width: 24px; height: 24px; border-radius: 50%; background: #E0E7FF; color: #4F46E5; display: inline-flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px; margin-right: 8px; vertical-align: middle;">${initial}</div> ${item.original.HoTen}`;
            }
        },
        noMatchTemplate: function () {
            return '<span style="visibility: hidden;"></span>';
        }
    });
    tribute.attach(element);
}

let lastCommentTime = 0;
const COMMENT_COOLDOWN_MS = 10000;

async function submitComment(noiDung, maBL_Cha) {
    if (!token) return Swal.fire('Vui lòng đăng nhập để bình luận.');
    if (!noiDung.trim()) return Swal.fire('Vui lòng nhập nội dung.');

    const now = Date.now();
    if (now - lastCommentTime < COMMENT_COOLDOWN_MS) {
        const waitTime = Math.ceil((COMMENT_COOLDOWN_MS - (now - lastCommentTime)) / 1000);
        return Swal.fire('Bình tĩnh nào!', `Bạn bình luận quá nhanh. Vui lòng đợi ${waitTime} giây nữa.`, 'warning');
    }

    let btn;
    let originalHtml = '';
    if (maBL_Cha) {
        btn = document.getElementById(`btn-submit-reply-${maBL_Cha}`);
    } else {
        btn = document.getElementById('btn-submit-comment');
    }

    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
    }

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
            lastCommentTime = Date.now();
            if (typeof Quill !== 'undefined' && document.getElementById('comment-editor')) {
                const qInstance = Quill.find(document.getElementById('comment-editor'));
                if (qInstance) qInstance.setText('');
            }
            fetchDocumentDetails(); 
        } else {
            const data = await res.json();
            if (res.status === 429) {
                Swal.fire('Quá tải', data.message || 'Bạn đã bình luận quá nhiều lần. Vui lòng thử lại sau.', 'warning');
            } else {
                Swal.fire('Thất bại', data.message || 'Có lỗi xảy ra', 'warning');
            }
        }
    } catch (err) {
        console.error(err);
        Swal.fire('Lỗi', 'Không thể kết nối đến máy chủ.', 'error');
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            const replyEditorContainer = maBL_Cha ? document.getElementById(`reply-editor-${maBL_Cha}`) : document.getElementById('comment-editor');
            if (replyEditorContainer) {
                const qInstance = Quill.find(replyEditorContainer);
                if (qInstance) qInstance.setText('');
            }
        }
    }
}


function renderComments(comments, documentOwnerId) {
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

        const isAuthor = Number(comment.MaND) === Number(documentOwnerId);
        const isDocOwner = Number(currentUserMaND) === Number(documentOwnerId);
        const isCommentOwner = Number(comment.MaND) === Number(currentUserMaND);
        const canDelete = isCommentOwner || isDocOwner;
        
        let avatarHtml = `<div class="comment-avatar" style="${isAuthor ? 'background:#FEE2E2; color:#EF4444' : ''}">${userInitial}</div>`;
        
        if (comment.AvatarURL) {
            avatarHtml = `<div class="comment-avatar" style="background:transparent; color:transparent; padding:0;"><img src="${getAssetUrl(comment.AvatarURL)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;"></div>`;
        }

        const authorSuffix = isAuthor ? ' (Tác giả)' : '';
        const pinnedBadge = comment.DaGhim ? `<span style="font-size: 11px; background: #FEF3C7; color: #B45309; padding: 2px 6px; border-radius: 4px; margin-left: 8px;"><i class="fa-solid fa-thumbtack" style="margin-right: 4px;"></i> Đã ghim</span>` : '';
        
        const deleteBtnHtml = canDelete ? `<span class="comment-action delete-btn" data-id="${comment.MaBL}" style="color: #EF4444; margin-left: 12px;"><i class="fa-solid fa-trash-can" style="margin-right: 4px;"></i> Xóa</span>` : '';
        
        let pinBtnHtml = '';
        if (isDocOwner) {
            const pinText = comment.DaGhim ? 'Bỏ ghim' : 'Ghim';
            pinBtnHtml = `<span class="comment-action pin-btn" data-id="${comment.MaBL}" data-pinned="${comment.DaGhim ? '1' : '0'}" style="color: #F59E0B; margin-left: 12px;"><i class="fa-solid fa-thumbtack" style="margin-right: 4px;"></i> ${pinText}</span>`;
        }

        item.innerHTML = `
            ${avatarHtml}
            <div class="comment-content" ${comment.DaGhim ? 'style="border-left: 3px solid #FCD34D; padding-left: 8px;"' : ''}>
              <div class="comment-header">
                <span class="comment-author">${escapeHTML(comment.TenNguoiBinhLuan)}${authorSuffix}</span>
                ${pinnedBadge}
                <span class="comment-time">${dateHtml}</span>
              </div>
              <div class="comment-text">${DOMPurify.sanitize(comment.NoiDung).replace(/@\[(.*?)\]\((\d+)\)/g, '<a href="../user/userProfile.html?id=$2" class="tagged-user">@$1</a>')}</div>
              <div class="comment-actions">
                <span class="comment-action reply-btn" data-id="${comment.MaBL}"><i class="fa-solid fa-reply" style="margin-right: 4px;"></i> Phản hồi</span>
                ${deleteBtnHtml}
                ${pinBtnHtml}
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
              <div class="comment-input-area" style="flex:1; border: 1px solid #CBD5E1; border-radius: 8px; overflow: hidden;">
                <div id="reply-editor-${parentId}" style="background: white; font-family: inherit; font-size: 14px; min-height: 80px; border: none;"></div>
                <div style="display:flex; justify-content: flex-end; gap: 8px; background: white; padding: 8px; border-top: 1px solid #e5e7eb;">
                  <button id="btn-cancel-reply-${parentId}" class="btn-cancel" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #E5E7EB; background: white; color: #4B5563; font-weight: 500; cursor: pointer; transition: all 0.2s;"><i class="fa-solid fa-xmark" style="margin-right: 6px;"></i> Hủy</button>
                  <button id="btn-submit-reply-${parentId}" class="btn-submit" disabled style="opacity:0.5; cursor:not-allowed;"><i class="fa-solid fa-paper-plane" style="margin-right: 6px;"></i> Gửi</button>
                </div>
              </div>
            `;
            
            commentContent.appendChild(formContainer);

            const btnCancelReply = document.getElementById(`btn-cancel-reply-${parentId}`);
            btnCancelReply.addEventListener('mouseover', () => btnCancelReply.style.background = '#F9FAFB');
            btnCancelReply.addEventListener('mouseout', () => btnCancelReply.style.background = 'white');

            const btnSubmitReply = document.getElementById(`btn-submit-reply-${parentId}`);
            
            let replyEditor;
            if (typeof Quill !== 'undefined') {
                replyEditor = new Quill(`#reply-editor-${parentId}`, {
                    theme: 'snow',
                    placeholder: 'Viết phản hồi...',
                    modules: {
                        toolbar: [
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            ['link'],
                            ['clean']
                        ]
                    }
                });
                
                replyEditor.on('text-change', () => {
                    const val = replyEditor.getText().trim();
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
            }

            btnCancelReply.addEventListener('click', () => {
                formContainer.remove();
            });

            btnSubmitReply.addEventListener('click', () => {
                const noiDung = replyEditor ? replyEditor.root.innerHTML : '';
                submitComment(noiDung, parentId);
            });
        });
    });

    const deleteBtns = listEl.querySelectorAll('.delete-btn');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!token) return Swal.fire('Vui lòng đăng nhập.');
            const commentId = e.currentTarget.getAttribute('data-id');
            
            const result = await Swal.fire({
                title: 'Xóa bình luận?',
                text: 'Bạn có chắc chắn muốn xóa bình luận này không?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Xóa',
                cancelButtonText: 'Hủy'
            });

            if (result.isConfirmed) {
                try {
                    const res = await fetch(`${API_URL}/documents/comments/${commentId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (res.ok) {
                        fetchDocumentDetails();
                    } else {
                        const data = await res.json();
                        Swal.fire('Lỗi', data.message, 'error');
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        });
    });

    const pinBtns = listEl.querySelectorAll('.pin-btn');
    pinBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!token) return Swal.fire('Vui lòng đăng nhập.');
            const commentId = e.currentTarget.getAttribute('data-id');
            const isPinned = e.currentTarget.getAttribute('data-pinned') === '1';
            
            const actionText = isPinned ? 'bỏ ghim' : 'ghim';
            
            const result = await Swal.fire({
                title: `${isPinned ? 'Bỏ ghim' : 'Ghim'} bình luận?`,
                text: `Bạn có chắc chắn muốn ${actionText} bình luận này không?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Đồng ý',
                cancelButtonText: 'Hủy'
            });

            if (result.isConfirmed) {
                try {
                    const res = await fetch(`${API_URL}/documents/comments/${commentId}/pin`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (res.ok) {
                        fetchDocumentDetails();
                    } else {
                        const data = await res.json();
                        Swal.fire('Lỗi', data.message, 'error');
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        });
    });
}

async function handleDownload() {
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
}

async function renderPdfToCanvas(url, container) {
    container.innerHTML = '<div style="margin:auto; padding: 20px; color:#6B7280;">Đang tải và xử lý tài liệu (PDF.js)...</div>';
    try {
        if (!window.pdfjsLib) {
            console.error('PDF.js library is not loaded');
            container.innerHTML = '<div style="margin:auto; color:red;">Lỗi tải thư viện đọc PDF.</div>';
            return;
        }
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        container.innerHTML = ''; 
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            
            const containerWidth = container.clientWidth - 40;
            const unscaledViewport = page.getViewport({ scale: 1.0 });
            let scale = containerWidth / unscaledViewport.width;
            if (scale > 1.5) scale = 1.5;
            if (scale < 0.5) scale = 1.0;
            
            const viewport = page.getViewport({ scale });
            
            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-page-canvas';
            canvas.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            canvas.style.marginBottom = '10px';
            canvas.style.maxWidth = '100%';
            
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            container.appendChild(canvas);
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
        }
        
        container.oncontextmenu = e => { e.preventDefault(); return false; };
        container.style.userSelect = 'none';
        container.addEventListener('dragstart', e => e.preventDefault());
        
    } catch (err) {
        console.error('Error rendering PDF:', err);
        container.innerHTML = '<div style="margin:auto; padding:20px; color:#EF4444;">Không thể hiển thị bản xem trước. Bạn có thể tải tài liệu để xem toàn bộ.</div>';
    }
}

if (window.innerWidth <= 768) {
    document.documentElement.classList.add('sidebar-collapsed');
}
