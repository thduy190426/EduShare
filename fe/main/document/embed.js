document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('id');

    const titleEl = document.getElementById('embed-title');
    const authorEl = document.getElementById('embed-author');
    const edushareLink = document.getElementById('edushare-link');
    const premiumLink = document.getElementById('premium-link');
    const iframeContainer = document.getElementById('iframe-container');
    
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorIndicator = document.getElementById('error-indicator');
    const premiumIndicator = document.getElementById('premium-indicator');
    const errorMessage = document.getElementById('error-message');

    if (!docId) {
        showError('Không tìm thấy mã tài liệu trong URL.');
        return;
    }

    const detailUrl = `documentDetails.html?id=${docId}`;
    edushareLink.href = detailUrl;
    premiumLink.href = detailUrl;

    try {
        const response = await fetch(`${API_URL}/documents/${docId}`);
        const data = await response.json();

        if (response.ok && data.document) {
            renderDocument(data.document);
        } else {
            showError(data.message || 'Không thể tải thông tin tài liệu.');
        }
    } catch (error) {
        console.error('Error fetching document:', error);
        showError('Lỗi kết nối đến máy chủ.');
    }

    function renderDocument(doc) {
        loadingIndicator.style.display = 'none';

        titleEl.textContent = doc.TenTaiLieu || 'Tài liệu không tên';
        titleEl.title = doc.TenTaiLieu || '';
        
        const authorName = doc.AuthorName || (doc.TacGia && doc.TacGia.HoTen) || 'Ẩn danh';
        authorEl.textContent = `Bởi: ${authorName}`;

        const isPremium = doc.LaTaiLieuDocQuyen === 1 || doc.LaTaiLieuDocQuyen === true;

        if (isPremium) {
            premiumIndicator.style.display = 'block';
            return;
        }

        if (!doc.FileURL) {
            showError('Tài liệu chưa được tải lên file hoặc file bị lỗi.');
            return;
        }

        const loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';
        const fullFileUrl = getAssetUrl(doc.FileURL);
        
        let iframeHtml = '';
        if (loaiFile === 'pdf') {
            iframeHtml = `<iframe src="${fullFileUrl}" width="100%" height="100%" style="border: none;"></iframe>`;
        } else if (loaiFile === 'docx' || loaiFile === 'doc' || loaiFile === 'pptx' || loaiFile === 'ppt') {
            const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullFileUrl)}`;
            iframeHtml = `<iframe src="${officeViewerUrl}" width="100%" height="100%" style="border: none;"></iframe>`;
        } else {
            showError(`Không hỗ trợ xem trước định dạng .${loaiFile} qua mã nhúng.`);
            return;
        }

        iframeContainer.innerHTML = iframeHtml;
        iframeContainer.style.display = 'block';
    }

    function showError(msg) {
        loadingIndicator.style.display = 'none';
        premiumIndicator.style.display = 'none';
        iframeContainer.style.display = 'none';
        errorIndicator.style.display = 'block';
        errorMessage.textContent = msg;
    }
});
