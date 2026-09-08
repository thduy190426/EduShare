import { renderBreadcrumb } from '../shared/utils.js';
import { API_URL } from '../shared/config.js';
import { decodeJWT, escapeHTML, formatRatingSummary, getAssetUrl, getToken, getAvatar, getUserProfileUrl, renderCommentSkeleton, renderDocumentSkeleton } from '../shared/utils.js';
import { updateSEO } from '../shared/seo.js';
import { getSocket } from '../shared/socketClient.js';
import { loadQuillAndTribute } from '../shared/lazyLoad.js';

let currentMaTL = null;
const token = getToken();
let hasSubmittedRating = false;
let currentUserMaND = null;
let currentUserRole = null;
let allComments = [];
let documentOwnerId = null;
let hasDownloadedDoc = false;
let isDownloading = false;
let currentDocMetadata = null;

function checkCommentEligibility() {
    const btnSubmitComment = document.getElementById('btn-submit-comment');
    const placeholder = document.getElementById('comment-placeholder');
    const editorContainer = document.getElementById('comment-editor-container');

    if (!token) return;

    if (currentUserRole === 'SinhVien' && currentUserMaND !== documentOwnerId) {
        if (!hasDownloadedDoc || !hasSubmittedRating) {
            if (placeholder) {
                placeholder.innerHTML = 'Bạn cần tải và đánh giá tài liệu trước khi bình luận.';
                placeholder.style.pointerEvents = 'none';
                placeholder.style.cursor = 'not-allowed';
                placeholder.style.opacity = '0.7';
            }
            if (editorContainer) {
                editorContainer.innerHTML = '';
            }
            if (btnSubmitComment) {
                btnSubmitComment.style.display = 'none';
            }
            const replyBtns = document.querySelectorAll('.reply-btn');
            replyBtns.forEach(btn => btn.style.display = 'none');
        } else {
            if (placeholder && !window.commentEditor) {
                placeholder.innerHTML = 'Viết bình luận hoặc đặt câu hỏi về tài liệu này...';
                placeholder.style.pointerEvents = 'auto';
                placeholder.style.cursor = 'text';
                placeholder.style.opacity = '1';
            }
            if (btnSubmitComment) {
                btnSubmitComment.style.display = 'inline-flex';
            }
            const replyBtns = document.querySelectorAll('.reply-btn');
            replyBtns.forEach(btn => btn.style.display = 'inline-flex');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.more-options-btn');
        const isMenuClick = e.target.closest('.comment-options-menu');
        
        if (isMenuClick) {
            setTimeout(() => {
                document.querySelectorAll('.comment-options-menu').forEach(m => m.style.display = 'none');
            }, 100);
            return;
        }

        if (!btn) {
            document.querySelectorAll('.comment-options-menu').forEach(m => m.style.display = 'none');
            return;
        }

        e.stopPropagation();
        const wrapper = btn.closest('.comment-options-wrapper');
        const menu = wrapper.querySelector('.comment-options-menu');
        const isVisible = menu.style.display === 'flex';
        
        document.querySelectorAll('.comment-options-menu').forEach(m => m.style.display = 'none');
        
        if (!isVisible) {
            menu.style.display = 'flex';
        }
    });

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
                currentUserMaND = payload.MaND || parseInt(payload.nameid);
                currentUserRole = payload.VaiTro || payload.role;
                if (currentUserRole === 'GiaoVien' || currentUserRole === 'Admin') {
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
        currentDocMetadata = data.document;
        renderDocumentInfo(data.document, data.hasPurchased, data.isPremium);
        const bcTitle = document.getElementById('bc-doc-title');
        if (bcTitle && data.document.TenTL) bcTitle.textContent = data.document.TenTL;
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
            socket.off('document_comment_edited');
            socket.on('document_comment_edited', (data) => {
                const comment = allComments.find(c => c.MaBL === data.maBL);
                if (comment) {
                    comment.NoiDung = data.noiDung;
                    comment.DaChinhSua = true;
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
        } else if (token && ratingHint) {
            ratingHint.textContent = 'Bấm vào sao để đánh giá';
        }

        hasDownloadedDoc = data.hasDownloaded;
        checkCommentEligibility();
    } catch (error) {
        console.error(error);
        Swal.fire('Không thể tải chi tiết tài liệu. Tài liệu có thể không tồn tại hoặc chưa được duyệt.');
    }
}

async function fetchRelatedDocuments() {
    const listEl = document.getElementById('related-docs-list');
    if (!listEl) return;

    listEl.innerHTML = renderDocumentSkeleton(3);

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

        const thumbUrl = doc.ThumbnailURL;
        let thumbHtml = `
            <div class="related-thumb ${thumbClass}">
                <i class="fa-solid ${icon}"></i>
            </div>`;
            
        if (thumbUrl) {
            const fullThumbUrl = thumbUrl.startsWith('http') ? thumbUrl : `${API_URL}${thumbUrl}`;
            thumbHtml = `
            <div class="related-thumb" style="padding: 0; overflow: hidden; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                <img src="${fullThumbUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='block';">
                <i class="fa-solid ${icon}" style="font-size: 24px; color: #94a3b8; display: none;"></i>
            </div>`;
        }

        item.innerHTML = `
            ${thumbHtml}
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

function renderDocumentInfo(doc, hasPurchased, isPremium) {
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

    const aiSummaryContainer = document.getElementById('ai-summary-container');
    const aiSummaryContent = document.getElementById('ai-summary-content');
    const aiSummaryGenerateWrapper = document.getElementById('ai-summary-generate-wrapper');

    if (aiSummaryContainer) {
        aiSummaryContainer.style.display = 'block';
        if (doc.TomTatAI) {
            if (aiSummaryContent) {
                aiSummaryContent.textContent = doc.TomTatAI;
                aiSummaryContent.style.display = 'block';
            }
            if (aiSummaryGenerateWrapper) aiSummaryGenerateWrapper.style.display = 'none';
        } else {
            if (aiSummaryContent) aiSummaryContent.style.display = 'none';
            if (aiSummaryGenerateWrapper) aiSummaryGenerateWrapper.style.display = 'block';
        }
    }
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


    let icon = 'fa-file';
    let badgeClass = 'badge-primary';
    let loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';
    if (loaiFile === 'pdf') { icon = 'fa-file-pdf'; badgeClass = 'badge-file-pdf'; }
    else if (loaiFile === 'pptx' || loaiFile === 'ppt') icon = 'fa-chart-column';
    else if (loaiFile === 'docx' || loaiFile === 'doc') icon = 'fa-pen-to-square';

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
        } catch (e) { }
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
    const btnAddCart = document.getElementById('btn-add-cart');
    if (btnDownload) {
        if (doc.LaTaiLieuDocQuyen && !hasPurchased) {
            if (!isAuthor && !isPrivileged) {
                btnDownload.innerHTML = `<span><i class="fa-solid fa-lock"></i></span> Mở khoá (${doc.GiaXu || 0} Xu)`;
                btnDownload.style.backgroundColor = '#F59E0B';
                
                if (btnAddCart) {
                    btnAddCart.style.display = 'flex';
                    btnAddCart.onclick = async () => {
                        if (!token) return Swal.fire('Vui lòng đăng nhập để thêm vào giỏ hàng.');
                        try {
                            const res = await fetch(`${API_URL}/cart/add`, {
                                method: 'POST',
                                headers: { 
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ maTL: doc.MaTL })
                            });
                            const addData = await res.json();
                            if (res.ok) {
                                Swal.fire({
                                    toast: true,
                                    position: 'top-end',
                                    icon: 'success',
                                    title: 'Đã thêm tài liệu vào giỏ hàng',
                                    showConfirmButton: false,
                                    timer: 3000
                                });
                                if (typeof window.refreshSidebarBadges === 'function') {
                                    window.refreshSidebarBadges();
                                }
                            } else {
                                Swal.fire('Thất bại', addData.message, 'error');
                            }
                        } catch (err) {
                            console.error(err);
                            Swal.fire('Lỗi máy chủ', 'Không thể thêm vào giỏ hàng lúc này.', 'error');
                        }
                    };
                }

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
                            const idempotencyKey = window.generateIdempotencyKey();
                            const res = await fetch(`${API_URL}/documents/${doc.MaTL}/buy`, {
                                method: 'POST',
                                headers: { 
                                    'Authorization': `Bearer ${token}`,
                                    'X-Idempotency-Key': idempotencyKey
                                }
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

    const previewContainer = document.getElementById('doc-preview-container');
    const previewContent = document.getElementById('doc-preview-content');
    
    if (previewContainer && previewContent) {
        const loaiFilePreview = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';
        const canPreview = isPremium || hasPurchased || isAuthor || isPrivileged;
        
        if (canPreview && (loaiFilePreview === 'pdf' || loaiFilePreview === 'docx' || loaiFilePreview === 'doc' || loaiFilePreview === 'pptx' || loaiFilePreview === 'ppt') && doc.FileURL) {
            previewContainer.style.display = 'block';
            const fullFileUrl = getAssetUrl(doc.FileURL);
            
            if (loaiFilePreview === 'pdf') {
                previewContent.innerHTML = `<div style="text-align: center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color: var(--primary);"></i><p style="margin-top: 10px; color: var(--text-secondary);">Đang tối ưu hiển thị tài liệu...</p></div>`;
                
                (async () => {
                    try {
                        const { PDFDocument } = window.PDFLib;
                        const res = await fetch(fullFileUrl);
                        if (!res.ok) throw new Error("Fetch failed");
                        const arrayBuffer = await res.arrayBuffer();
                        const pdfDoc = await PDFDocument.load(arrayBuffer);
                        pdfDoc.setTitle(doc.TenTL);
                        const pdfBytes = await pdfDoc.save();
                        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                        const blobUrl = URL.createObjectURL(blob);
                        
                        previewContent.innerHTML = `<iframe src="${blobUrl}" width="100%" height="600px" style="border: none; border-radius: 8px;"></iframe>`;
                    } catch(e) {
                        console.error("Lỗi fix title PDF, dùng bản gốc", e);
                        previewContent.innerHTML = `<iframe src="${fullFileUrl}" width="100%" height="600px" style="border: none; border-radius: 8px;"></iframe>`;
                    }
                })();
            } else {
                const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullFileUrl)}`;
                previewContent.innerHTML = `<iframe src="${officeViewerUrl}" width="100%" height="600px" style="border: none;"></iframe>`;
            }
        } else if (!canPreview && (loaiFilePreview === 'pdf' || loaiFilePreview === 'docx' || loaiFilePreview === 'doc' || loaiFilePreview === 'pptx' || loaiFilePreview === 'ppt')) {
             previewContainer.style.display = 'block';
             if (loaiFilePreview === 'pdf') {
                 const previewUrl = `${API_URL}/documents/${doc.MaTL}/preview-pdf`;
                 previewContent.innerHTML = `
                    <div style="background-color: #FEF3C7; color: #92400E; padding: 12px 16px; font-size: 14px; text-align: center; border-bottom: 1px solid #FDE68A;">
                       <i class="fa-solid fa-eye" style="margin-right: 6px;"></i> Bạn đang xem trước một phần của tài liệu. Hãy nâng cấp Premium để xem toàn bộ nội dung.
                    </div>
                    <iframe src="${previewUrl}" width="100%" height="600px" style="border: none; border-radius: 0 0 8px 8px;"></iframe>
                 `;
             } else {
                 previewContent.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px;">
                        <i class="fa-solid fa-lock" style="font-size: 48px; color: #F59E0B; margin-bottom: 16px;"></i>
                        <h4 style="margin: 0 0 8px 0; color: #1E293B;">Giới hạn xem trước</h4>
                        <p style="color: #64748b; margin: 0;">Tài liệu Word/PowerPoint đang bị giới hạn xem trước. Vui lòng tải xuống để xem rõ toàn bộ nội dung.</p>
                    </div>
                 `;
             }
        } else {
             previewContainer.style.display = 'none';
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
    const btnMoreOptions = document.getElementById('btn-more-options');
    const moreOptionsMenu = document.getElementById('more-options-menu');
    if (btnMoreOptions && moreOptionsMenu) {
        btnMoreOptions.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = moreOptionsMenu.style.display === 'none';
            moreOptionsMenu.style.display = isHidden ? 'flex' : 'none';
        });

        document.addEventListener('click', (e) => {
            if (!btnMoreOptions.contains(e.target) && !moreOptionsMenu.contains(e.target)) {
                moreOptionsMenu.style.display = 'none';
            }
        });
    }
    
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

    const btnShare = document.getElementById('btn-share');
    if (btnShare) {
        btnShare.addEventListener('click', () => {
            const shareUrl = `${API_URL}/documents/share/${currentMaTL}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'success', title: 'Đã copy link chia sẻ!' });
            }).catch(err => {
                console.error('Lỗi khi copy link:', err);
                Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'error', title: 'Không thể copy link.' });
            });
        });
    }

    const btnEmbed = document.getElementById('btn-embed');
    if (btnEmbed) {
        btnEmbed.addEventListener('click', () => {
            const embedUrl = `${window.location.origin}/pages/document/embed.html?id=${currentMaTL}`;
            const iframeCode = `<iframe src="${embedUrl}" width="100%" height="600px" style="border: 1px solid #e2e8f0; border-radius: 8px;"></iframe>`;
            
            Swal.fire({
                title: 'Mã nhúng tài liệu (Embed)',
                html: `
                    <p style="font-size: 14px; text-align: left; color: #64748b; margin-bottom: 8px;">Copy đoạn mã HTML dưới đây và dán vào website của bạn:</p>
                    <textarea id="embed-textarea" readonly style="width: 100%; height: 100px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: monospace; font-size: 13px; resize: none; background: #f8fafc;">${iframeCode}</textarea>
                `,
                showCancelButton: true,
                confirmButtonText: '<i class="fa-solid fa-copy"></i> Copy Mã Nhúng',
                cancelButtonText: 'Đóng',
                confirmButtonColor: '#2563EB',
                preConfirm: () => {
                    const textarea = document.getElementById('embed-textarea');
                    textarea.select();
                    document.execCommand('copy');
                    return true;
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'success', title: 'Đã copy mã nhúng!' });
                }
            });
        });
    }

    const btnGenerateAi = document.getElementById('btn-generate-ai-summary');
    if (btnGenerateAi) {
        btnGenerateAi.addEventListener('click', async () => {
            if (!token) return Swal.fire('Vui lòng đăng nhập để tạo tóm tắt AI.');
            btnGenerateAi.disabled = true;
            btnGenerateAi.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo...';
            try {
                const res = await fetch(`${API_URL}/documents/${currentMaTL}/generate-summary`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok) {
                    Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, icon: 'success', title: 'Tạo thành công!' });
                    fetchDocumentDetails();
                } else {
                    Swal.fire(data.message || 'Lỗi khi tạo tóm tắt.');
                    btnGenerateAi.disabled = false;
                    btnGenerateAi.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Tạo tóm tắt ngay';
                }
            } catch (err) {
                console.error(err);
                Swal.fire('Lỗi máy chủ.');
                btnGenerateAi.disabled = false;
                btnGenerateAi.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Tạo tóm tắt ngay';
            }
        });
    }

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
                    updateStarUI(Math.round(newScore));
                    lockRatingUI('Cảm ơn bạn đã đánh giá');
                    checkCommentEligibility();
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

    window.commentEditor = null;
    const placeholder = document.getElementById('comment-placeholder');

    if (placeholder) {
        placeholder.addEventListener('click', async () => {
            placeholder.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải trình soạn thảo...';
            
            await loadQuillAndTribute();

            const container = document.getElementById('comment-editor-container');
            container.innerHTML = '<div id="comment-editor" style="background: white; font-family: inherit; font-size: 14px; min-height: 80px; border-bottom: none;"></div>';
            
            window.commentEditor = new Quill('#comment-editor', {
                theme: 'snow',
                placeholder: 'Viết bình luận hoặc đặt câu hỏi về tài liệu này...',
                modules: {
                    toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['link'],
                        ['clean']
                    ],
                    keyboard: {
                        bindings: {
                            submit: {
                                key: 'Enter',
                                shiftKey: false,
                                handler: function () {
                                    const val = window.commentEditor.getText().trim();
                                    if (val.length > 0 && val.length <= 1000) {
                                        submitComment(window.commentEditor.root.innerHTML, null);
                                    }
                                    return false;
                                }
                            }
                        }
                    }
                }
            });

            initTribute(window.commentEditor.root);

            window.commentEditor.on('text-change', () => {
                const val = window.commentEditor.getText().trim();
                if (val.length > 0 && val.length <= 1000) {
                    btnSubmitComment.disabled = false;
                    btnSubmitComment.style.opacity = '1';
                    btnSubmitComment.style.cursor = 'pointer';
                } else {
                    btnSubmitComment.disabled = true;
                    btnSubmitComment.style.opacity = '0.5';
                    btnSubmitComment.style.cursor = 'not-allowed';
                }
                if (currentMaTL) {
                    localStorage.setItem(`draft_comment_${currentMaTL}`, window.commentEditor.root.innerHTML);
                }
            });

            if (currentMaTL) {
                const draftKey = `draft_comment_${currentMaTL}`;
                const draftComment = localStorage.getItem(draftKey);
                if (draftComment) {
                    Swal.fire({
                        title: 'Khôi phục bản nháp?',
                        text: 'Bạn có một bình luận chưa gửi. Bạn có muốn khôi phục không?',
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonText: 'Có, khôi phục',
                        cancelButtonText: 'Không, bỏ qua'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            window.commentEditor.root.innerHTML = draftComment;
                            const val = window.commentEditor.getText().trim();
                            if (val.length > 0) {
                                btnSubmitComment.disabled = false;
                                btnSubmitComment.style.opacity = '1';
                                btnSubmitComment.style.cursor = 'pointer';
                            }
                        } else {
                            localStorage.removeItem(draftKey);
                        }
                    });
                }
            }

            btnSubmitComment.addEventListener('click', () => {
                const noiDung = window.commentEditor.root.innerHTML;
                submitComment(noiDung, null);
            });
        });
    }

    const btnCitation = document.getElementById('btn-citation');
    const citationModal = document.getElementById('citationModal');
    const btnCloseCitationModal = document.getElementById('btn-close-citation-modal');
    const citationFormatSelect = document.getElementById('citation-format');
    const citationContent = document.getElementById('citation-content');
    const btnCopyCitation = document.getElementById('btn-copy-citation');

    if (btnCitation && citationModal) {
        btnCitation.addEventListener('click', () => {
            citationModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            requestAnimationFrame(() => {
                citationModal.style.opacity = '1';
                citationModal.querySelector('.modal-content').style.transform = 'scale(1)';
            });
            updateCitationText();
        });

        if (btnCloseCitationModal) {
            btnCloseCitationModal.addEventListener('click', () => {
                closeCitationModal();
            });
        }

        citationModal.addEventListener('click', (e) => {
            if (e.target === citationModal) {
                closeCitationModal();
            }
        });

        if (citationFormatSelect) {
            citationFormatSelect.addEventListener('change', () => {
                updateCitationText();
            });
        }

        if (btnCopyCitation) {
            btnCopyCitation.addEventListener('click', () => {
                if (!citationContent) return;
                const textToCopy = citationContent.textContent;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalText = btnCopyCitation.innerHTML;
                    btnCopyCitation.innerHTML = '<i class="fa-solid fa-check" style="color: #10B981;"></i> Đã copy';
                    setTimeout(() => {
                        btnCopyCitation.innerHTML = originalText;
                    }, 2000);
                });
            });
        }

        function closeCitationModal() {
            citationModal.style.opacity = '0';
            citationModal.querySelector('.modal-content').style.transform = 'scale(0.9)';
            setTimeout(() => {
                citationModal.style.display = 'none';
                document.body.style.overflow = '';
            }, 300);
        }

        function updateCitationText() {
            if (!currentDocMetadata || !citationContent) return;
            const format = citationFormatSelect ? citationFormatSelect.value : 'APA';
            const title = currentDocMetadata.TenTL || '';
            const author = currentDocMetadata.TenNguoiDang || 'Người dùng';
            const year = currentDocMetadata.NgayTao ? new Date(currentDocMetadata.NgayTao).getFullYear() : new Date().getFullYear();
            const url = window.location.href;

            let text = '';
            switch (format) {
                case 'APA':
                    text = `${author}. (${year}). ${title}. EduShare. ${url}`;
                    break;
                case 'MLA':
                    text = `${author}. "${title}." EduShare, ${year}, ${url}.`;
                    break;
                case 'Harvard':
                    text = `${author}, ${year}. ${title}. [trực tuyến] EduShare. Có tại: ${url}.`;
                    break;
                case 'Chicago':
                    text = `${author}. "${title}." EduShare. ${year}. ${url}.`;
                    break;
            }
            citationContent.textContent = text;
        }
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

    const payload = decodeJWT(token);
    const tempMaBL = 'temp-' + Date.now();
    const tempComment = {
        MaBL: tempMaBL,
        MaBL_Cha: maBL_Cha,
        TenNguoiBinhLuan: payload ? (payload.HoTen || 'Bạn') : 'Bạn',
        MaND: currentUserMaND,
        AvatarURL: getAvatar() !== 'null' ? getAvatar() : null,
        NoiDung: noiDung,
        NgayBinhLuan: new Date().toISOString(),
        DaGhim: 0,
        isOptimistic: true
    };
    allComments.push(tempComment);
    renderComments(allComments, documentOwnerId);

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
            if (currentMaTL) {
                localStorage.removeItem(`draft_comment_${currentMaTL}`);
            }
            if (typeof Quill !== 'undefined' && document.getElementById('comment-editor')) {
                const qInstance = Quill.find(document.getElementById('comment-editor'));
                if (qInstance) qInstance.setText('');
            }
            fetchDocumentDetails();
        } else {
            allComments = allComments.filter(c => c.MaBL !== tempMaBL);
            renderComments(allComments, documentOwnerId);
            const data = await res.json();
            if (res.status === 429) {
                Swal.fire('Quá tải', data.message || 'Bạn đã bình luận quá nhiều lần. Vui lòng thử lại sau.', 'warning');
            } else {
                Swal.fire('Thất bại', data.message || 'Có lỗi xảy ra', 'warning');
            }
        }
    } catch (err) {
        console.error(err);
        allComments = allComments.filter(c => c.MaBL !== tempMaBL);
        renderComments(allComments, documentOwnerId);
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
        if (comment.isOptimistic) {
            item.style.opacity = '0.5';
            item.style.pointerEvents = 'none';
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
        const editedBadge = comment.DaChinhSua ? `<span style="font-size: 11px; color: #6B7280; margin-left: 8px;">(Đã chỉnh sửa)</span>` : '';

        const deleteBtnHtml = canDelete ? `<div class="comment-action delete-btn" data-id="${comment.MaBL}" style="color: #EF4444; padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s;"><i class="fa-solid fa-trash-can"></i> Xóa</div>` : '';
        const editBtnHtml = isCommentOwner ? `<span class="comment-action edit-btn" data-id="${comment.MaBL}" style="color: #3B82F6; margin-left: 12px;"><i class="fa-solid fa-pen" style="margin-right: 4px;"></i> Chỉnh sửa</span>` : '';

        let pinBtnHtml = '';
        if (isDocOwner) {
            const pinText = comment.DaGhim ? 'Bỏ ghim' : 'Ghim';
            pinBtnHtml = `<div class="comment-action pin-btn" data-id="${comment.MaBL}" data-pinned="${comment.DaGhim ? '1' : '0'}" style="color: #F59E0B; padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s;"><i class="fa-solid fa-thumbtack"></i> ${pinText}</div>`;
        }

        let moreOptionsHtml = '';
        if (canDelete || isDocOwner) {
            moreOptionsHtml = `
            <div class="comment-options-wrapper" style="position: relative; display: inline-block; margin-left: 12px;">
                <span class="comment-action more-options-btn" style="cursor: pointer; color: #6B7280; display: inline-flex; align-items: center;"><i class="fa-solid fa-ellipsis"></i></span>
                <div class="comment-options-menu" style="display: none; flex-direction: column; position: absolute; left: 0; top: 100%; margin-top: 4px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); min-width: 120px; overflow: hidden; z-index: 50;">
                    ${pinBtnHtml}
                    ${deleteBtnHtml}
                </div>
            </div>
            `;
        }

        item.innerHTML = `
            ${avatarHtml}
            <div class="comment-content" ${comment.DaGhim ? 'style="border-left: 3px solid #FCD34D; padding-left: 8px;"' : ''} id="comment-content-${comment.MaBL}">
              <div class="comment-header">
                <span class="comment-author">${escapeHTML(comment.TenNguoiBinhLuan)}${authorSuffix}</span>
                ${pinnedBadge}
                ${editedBadge}
                <span class="comment-time">${dateHtml}</span>
              </div>
              <div class="comment-text" id="comment-text-${comment.MaBL}">${DOMPurify.sanitize(comment.NoiDung).replace(/@\[(.*?)\]\((\d+)\)/g, '<a href="../user/userProfile.html?id=$2" class="tagged-user">@$1</a>')}</div>
              <div class="comment-actions">
                <span class="comment-action reply-btn" data-id="${comment.MaBL}"><i class="fa-solid fa-reply" style="margin-right: 4px;"></i> Phản hồi</span>
                ${editBtnHtml}
                ${moreOptionsHtml}
              </div>
            </div>
            <div class="comment-edit-form" id="comment-edit-form-${comment.MaBL}" style="display: none; flex: 1; flex-direction: column;">
                <div class="quill-editor" id="quill-edit-${comment.MaBL}" style="min-height: 80px; background: #fff; border-radius: 8px;"></div>
                <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
                    <button class="btn btn-secondary btn-sm" onclick="cancelEditComment(${comment.MaBL})"><i class="fa-solid fa-xmark" style="margin-right: 4px;"></i> Hủy</button>
                    <button id="btn-submit-edit-${comment.MaBL}" class="btn btn-primary btn-sm" onclick="submitEditComment(${comment.MaBL})" disabled style="opacity: 0.5; cursor: not-allowed;"><i class="fa-solid fa-check" style="margin-right: 4px;"></i> Lưu</button>
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
        btn.addEventListener('click', async (e) => {
            await loadQuillAndTribute();
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
                            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                            ['link'],
                            ['clean']
                        ],
                        keyboard: {
                            bindings: {
                                submit: {
                                    key: 'Enter',
                                    shiftKey: false,
                                    handler: function () {
                                        const val = replyEditor.getText().trim();
                                        if (val.length > 0 && val.length <= 1000) {
                                            submitComment(replyEditor.root.innerHTML, parentId);
                                        }
                                        return false;
                                    }
                                }
                            }
                        }
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

    const editBtns = listEl.querySelectorAll('.edit-btn');
    editBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            await loadQuillAndTribute();
            const commentId = e.currentTarget.getAttribute('data-id');
            const contentDiv = document.getElementById(`comment-content-${commentId}`);
            const editFormDiv = document.getElementById(`comment-edit-form-${commentId}`);
            const textDiv = document.getElementById(`comment-text-${commentId}`);

            contentDiv.style.display = 'none';
            editFormDiv.style.display = 'flex';

            if (!window.editCommentEditors) window.editCommentEditors = {};

            if (!window.editCommentEditors[commentId]) {
                const editor = new Quill(`#quill-edit-${commentId}`, {
                    theme: 'snow',
                    modules: {
                        toolbar: [
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                            ['link'],
                            ['clean']
                        ]
                    }
                });
                window.editCommentEditors[commentId] = editor;

                editor.on('text-change', () => {
                    const btn = document.getElementById(`btn-submit-edit-${commentId}`);
                    if (!btn) return;
                    const val = editor.getText().trim();
                    const html = editor.root.innerHTML.trim();
                    const isChanged = html !== editor.originalHtml;
                    if (val.length > 0 && val.length <= 1000 && isChanged) {
                        btn.disabled = false;
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';
                    } else {
                        btn.disabled = true;
                        btn.style.opacity = '0.5';
                        btn.style.cursor = 'not-allowed';
                    }
                });
            }

            const editor = window.editCommentEditors[commentId];
            editor.root.innerHTML = textDiv.innerHTML;
            editor.originalHtml = editor.root.innerHTML.trim();

            const btn = document.getElementById(`btn-submit-edit-${commentId}`);
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        });
    });
}

window.cancelEditComment = function (commentId) {
    const contentDiv = document.getElementById(`comment-content-${commentId}`);
    const editFormDiv = document.getElementById(`comment-edit-form-${commentId}`);
    if (contentDiv && editFormDiv) {
        contentDiv.style.display = 'block';
        editFormDiv.style.display = 'none';
    }
};

window.submitEditComment = async function (commentId) {
    const editor = window.editCommentEditors && window.editCommentEditors[commentId];
    if (!editor) return;

    const noiDung = editor.root.innerHTML.trim();
    if (!noiDung || editor.getText().trim() === '') {
        Swal.fire('Lỗi', 'Nội dung bình luận không được để trống', 'warning');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/documents/comments/${commentId}/edit`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text: noiDung })
        });
        if (res.ok) {
            cancelEditComment(commentId);
            const textDiv = document.getElementById(`comment-text-${commentId}`);
            if (textDiv) textDiv.innerHTML = DOMPurify.sanitize(noiDung).replace(/@\[(.*?)\]\((\d+)\)/g, '<a href="../user/userProfile.html?id=$2" class="tagged-user">@$1</a>');
        } else {
            const data = await res.json();
            Swal.fire('Lỗi', data.message, 'error');
        }
    } catch (err) {
        console.error(err);
        Swal.fire('Lỗi', 'Không thể chỉnh sửa bình luận.', 'error');
    }
};

async function handleDownload() {
    if (!token) {
        Swal.fire('Vui lòng đăng nhập để tải tài liệu.');
        return;
    }

    if (isDownloading) return;
    isDownloading = true;
    const btnDownload = document.getElementById('btn-download');
    const originalDownloadHTML = btnDownload ? btnDownload.innerHTML : '';
    
    if (btnDownload) {
        btnDownload.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i></span> Đang tải...';
        btnDownload.style.pointerEvents = 'none';
        btnDownload.style.opacity = '0.7';
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
            
            hasDownloadedDoc = true;
            checkCommentEligibility();

            if (!hasSubmittedRating && currentUserRole === 'SinhVien' && currentUserMaND !== documentOwnerId) {
                Swal.fire({
                    icon: 'info',
                    title: 'Tải thành công',
                    text: 'Vui lòng đánh giá tài liệu (bấm vào các ngôi sao) để có thể bình luận!'
                });
            }
        } else {
            const errData = await res.json();
            Swal.fire(errData.message || 'Lỗi tải xuống hoặc bạn không có quyền tải.');
        }
    } catch (err) {
        console.error(err);
        Swal.fire('Lỗi kết nối máy chủ.');
    } finally {
        setTimeout(() => {
            isDownloading = false;
            if (btnDownload) {
                btnDownload.innerHTML = originalDownloadHTML;
                btnDownload.style.pointerEvents = 'auto';
                btnDownload.style.opacity = '1';
            }
        }, 5000);
    }
}

if (window.innerWidth <= 768) {
    document.documentElement.classList.add('sidebar-collapsed');
}

document.addEventListener('DOMContentLoaded', () => {
    const btnSaveCollection = document.getElementById('btn-save-collection');
    const modalSaveCol = document.getElementById('save-collection-modal');
    const btnCloseSaveCol = document.getElementById('btn-close-save-collection');
    const colListContainer = document.getElementById('save-collection-list');

    if (btnSaveCollection && modalSaveCol && colListContainer) {
        btnSaveCollection.addEventListener('click', async () => {
            if (!token) return Swal.fire('Vui lòng đăng nhập để sử dụng tính năng này.');
            modalSaveCol.style.display = 'flex';
            modalSaveCol.style.opacity = '1';
            document.body.style.overflow = 'hidden';
            colListContainer.innerHTML = '<p style="text-align: center; color: #64748b; font-size: 14px;">Đang tải...</p>';
            
            try {
                const res = await fetch(`${API_URL}/collections`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const collections = await res.json();
                
                colListContainer.innerHTML = '';
                if (!res.ok) {
                    colListContainer.innerHTML = '<p style="text-align:center;color:red;">Lỗi tải bộ sưu tập.</p>';
                    return;
                }
                
                if (collections.length === 0) {
                    colListContainer.innerHTML = '<p style="text-align:center;color:#64748b;font-size:14px;padding:10px;">Bạn chưa có bộ sưu tập nào.</p>';
                    return;
                }
                
                collections.forEach(col => {
                    const item = document.createElement('div');
                    item.style.padding = '10px';
                    item.style.borderBottom = '1px solid #eee';
                    item.style.display = 'flex';
                    item.style.justifyContent = 'space-between';
                    item.style.alignItems = 'center';
                    
                    item.innerHTML = `
                        <div>
                            <div style="font-weight:500; font-size:14px; color:var(--text-primary);"><i class="fa-solid fa-folder" style="color:var(--primary); margin-right:6px;"></i>${col.TenBST}</div>
                            <div style="font-size:12px; color:#64748b; margin-top:4px;">${col.DocCount} tài liệu</div>
                        </div>
                        <button class="btn-add-to-col" data-id="${col.MaBST}" style="padding:4px 10px; font-size:12px; border-radius:4px; border:1px solid var(--primary); background:transparent; color:var(--primary); cursor:pointer;">Lưu</button>
                    `;
                    
                    const btnAdd = item.querySelector('.btn-add-to-col');
                    btnAdd.addEventListener('click', async () => {
                        btnAdd.disabled = true;
                        btnAdd.innerText = 'Đang lưu...';
                        try {
                            const addRes = await fetch(`${API_URL}/collections/${col.MaBST}/documents`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ maTL: currentMaTL })
                            });
                            
                            const addData = await addRes.json();
                            if (addRes.ok) {
                                btnAdd.style.background = '#10B981';
                                btnAdd.style.color = 'white';
                                btnAdd.style.borderColor = '#10B981';
                                btnAdd.innerText = 'Đã lưu';
                                setTimeout(() => { modalSaveCol.style.display = 'none'; }, 1000);
                            } else {
                                alert(addData.message || 'Lỗi thêm vào bộ sưu tập');
                                btnAdd.disabled = false;
                                btnAdd.innerText = 'Lưu';
                            }
                        } catch (e) {
                            console.error(e);
                            btnAdd.disabled = false;
                            btnAdd.innerText = 'Lưu';
                        }
                    });
                    
                    colListContainer.appendChild(item);
                });
            } catch (err) {
                console.error(err);
                colListContainer.innerHTML = '<p style="text-align:center;color:red;">Lỗi tải bộ sưu tập.</p>';
            }
        });
    }

    if (btnCloseSaveCol) {
        btnCloseSaveCol.addEventListener('click', () => {
            modalSaveCol.style.opacity = '0';
            setTimeout(() => {
                modalSaveCol.style.display = 'none';
                document.body.style.overflow = '';
            }, 300);
        });
    }

    const btnOpenCreateCollection = document.getElementById('btn-open-create-collection');
    const modalCreate = document.getElementById('create-collection-modal');
    const btnCancelCreate = document.getElementById('btn-cancel-collection');
    const btnSubmitCreate = document.getElementById('btn-submit-collection');

    if (btnOpenCreateCollection && modalCreate) {
        const inputName = document.getElementById('input-collection-name');
        
        const validateForm = () => {
            const val = inputName.value.trim();
            if (val) {
                btnSubmitCreate.disabled = false;
                btnSubmitCreate.style.opacity = '1';
                btnSubmitCreate.style.cursor = 'pointer';
            } else {
                btnSubmitCreate.disabled = true;
                btnSubmitCreate.style.opacity = '0.5';
                btnSubmitCreate.style.cursor = 'not-allowed';
            }
        };

        if (inputName) {
            inputName.addEventListener('input', validateForm);
        }

        const closeCreateModal = () => {
            modalCreate.style.opacity = '0';
            setTimeout(() => {
                modalCreate.style.display = 'none';
                document.body.style.overflow = '';
            }, 300);
        };

        btnOpenCreateCollection.addEventListener('click', () => {
            if (inputName) inputName.value = '';
            document.getElementById('input-collection-desc').value = '';
            validateForm();
            
            modalSaveCol.style.opacity = '0';
            setTimeout(() => {
                modalSaveCol.style.display = 'none';
                modalCreate.style.display = 'flex';
                modalCreate.style.opacity = '1';
                document.body.style.overflow = 'hidden';
            }, 300);
        });

        if (btnCancelCreate) {
            btnCancelCreate.addEventListener('click', closeCreateModal);
        }

        if (btnSubmitCreate) {
            btnSubmitCreate.addEventListener('click', async () => {
                const tenBST = document.getElementById('input-collection-name').value;
                const moTa = document.getElementById('input-collection-desc').value;
                if (!tenBST.trim()) return alert('Vui lòng nhập tên bộ sưu tập');

                try {
                    btnSubmitCreate.disabled = true;
                    const res = await fetch(`${API_URL}/collections`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ tenBST, moTa })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        closeCreateModal();
                        setTimeout(() => {
                            if (btnSaveCollection) btnSaveCollection.click();
                        }, 300);
                    } else {
                        alert(data.message || 'Lỗi tạo bộ sưu tập');
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    btnSubmitCreate.disabled = false;
                }
            });
        }
    }
});


document.addEventListener('DOMContentLoaded', () => {
});

const donateInterval = setInterval(() => {
    const btnDonateAuthor = document.getElementById('btn-donate-author');
    if (btnDonateAuthor && typeof documentOwnerId !== 'undefined' && typeof currentUserMaND !== 'undefined') {
        clearInterval(donateInterval);
        
        if (token && currentUserMaND !== documentOwnerId) {
            (async () => {
                try {
                    const res = await fetch(`${API_URL}/users/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.SoDuXu >= 10) {
                            btnDonateAuthor.style.display = 'inline-flex';
                            if (!btnDonateAuthor.dataset.hasListener) {
                                btnDonateAuthor.addEventListener('click', handleDonateXuAuthor);
                                btnDonateAuthor.dataset.hasListener = 'true';
                            }
                        }
                    }
                } catch (e) { console.error(e); }
            })();
        }
    }
}, 500);

async function handleDonateXuAuthor() {
    const { value: formValues } = await Swal.fire({
        title: 'Tặng Xu cho Tác giả',
        html:
            '<input id="swal-input-amount" class="swal2-input" placeholder="Số Xu (tối thiểu 10)" type="number" min="10">' +
            '<textarea id="swal-input-message" class="swal2-textarea" placeholder="Lời nhắn (tùy chọn)"></textarea>' +
            '<div style="font-size: 13px; color: #64748b; margin-top: 10px; text-align: left;">* Phí giao dịch 10% sẽ được trừ vào số Xu người nhận được. Giao dịch từ 500 Xu trở lên cần xác thực OTP.</div>',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Tặng Xu',
        cancelButtonText: 'Hủy',
        preConfirm: () => {
            const amount = document.getElementById('swal-input-amount').value;
            const message = document.getElementById('swal-input-message').value;
            if (!amount || amount < 10) {
                Swal.showValidationMessage('Số Xu tối thiểu là 10');
                return false;
            }
            return { amount: parseInt(amount), message };
        }
    });

    if (formValues) {
        processDonateAuthor(formValues.amount, formValues.message);
    }
}

async function processDonateAuthor(amount, message, otp = null) {
    try {
        const body = { receiverId: documentOwnerId, amount, message };
        if (otp) body.otp = otp;

        const res = await fetch(`${API_URL}/payment/donate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        
        if (res.ok) {
            Swal.fire('Thành công', `Đã tặng thành công ${amount} Xu! Người nhận đã nhận được ${data.receiveAmount} Xu (Trừ ${data.tax} Xu thuế).`, 'success');
        } else if (res.status === 400 && data.requireOTP) {
            const resOtp = await fetch(`${API_URL}/payment/donate/request-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ amount, receiverId: documentOwnerId })
            });
            const dataOtp = await resOtp.json();
            if (resOtp.ok) {
                const { value: otpValue } = await Swal.fire({
                    title: 'Xác thực OTP',
                    text: 'Mã OTP đã được gửi đến email của bạn. Vui lòng nhập mã để tiếp tục (Có hiệu lực 5 phút).',
                    input: 'text',
                    inputPlaceholder: 'Nhập mã OTP',
                    showCancelButton: true,
                    confirmButtonText: 'Xác nhận',
                    preConfirm: (val) => {
                        if (!val) {
                            Swal.showValidationMessage('Vui lòng nhập mã OTP');
                            return false;
                        }
                        return val;
                    }
                });
                if (otpValue) {
                    processDonateAuthor(amount, message, otpValue);
                }
            } else {
                Swal.fire('Lỗi', dataOtp.message || 'Lỗi gửi OTP', 'error');
            }
        } else {
            Swal.fire('Thất bại', data.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (e) {
        console.error(e);
        Swal.fire('Lỗi', 'Không thể kết nối máy chủ', 'error');
    }
}
