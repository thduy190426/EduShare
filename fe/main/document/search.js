import { API_URL } from '../shared/config.js';
import { decodeJWT, escapeHTML, stripHTML, formatRatingSummary, getAssetUrl, getToken, getAvatar, getUserProfileUrl, renderDocumentSkeleton } from '../shared/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const levelSelect = document.getElementById('levelSelect');
    const subjectSelect = document.getElementById('subjectSelect');
    const ratingSelect = document.getElementById('ratingSelect');
    const fileTypeCheckboxes = document.querySelectorAll('input[name="loaiFile"]');
    const officialOnly = document.getElementById('officialOnly');
    const fromDate = document.getElementById('fromDate');
    const toDate = document.getElementById('toDate');
    const authorInput = document.getElementById('authorInput');
    const subjectSearch = document.getElementById('subjectSearch');
    const activeFilters = document.getElementById('activeFilters');
    const btnClearFilter = document.getElementById('btnClearFilter');
    const resultsGrid = document.getElementById('resultsGrid');
    const resultsHeader = document.getElementById('resultsHeader');
    const paginationContainer = document.getElementById('paginationContainer');
    const initialParams = new URLSearchParams(window.location.search);
    const initialSubjectIds = (initialParams.get('maMonHoc') || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);

    if (searchInput) {
        const queryParam = initialParams.get('q');
        if (queryParam) {
            searchInput.value = queryParam;
        }
    }

    let currentPage = 1;
    let totalPages = 1;
    let isLoading = false;
    let hasMore = true;
    let debounceTimer = null;
    let bookmarkedDocs = new Set();
    let isInitialLoaded = false;
    let observer = null;

    const sentinelEl = document.getElementById('infiniteScrollSentinel');
    const scrollSpinner = document.getElementById('scrollSpinner');
    const scrollEndMessage = document.getElementById('scrollEndMessage');

    setupInfiniteScroll();

    function setupInfiniteScroll() {
        if (!sentinelEl) return;
        observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (entry.isIntersecting && !isLoading && hasMore && isInitialLoaded) {
                fetchDocuments(currentPage + 1, true);
            }
        }, {
            rootMargin: '250px',
            threshold: 0.1
        });
        observer.observe(sentinelEl);
    }

    loadUserProfileNav();

    function loadUserProfileNav() {
        const token = getToken();
        if (!token) {
            window.location.href = '../auth/login.html';
            return;
        }
        try {
            const payload = decodeJWT(token);
            if (!payload) return;
            const avatarEl = document.getElementById('navAvatar');
            if (avatarEl && payload.HoTen) {
                const savedAvatar = getAvatar();
                if (savedAvatar && savedAvatar !== 'null') {
                    avatarEl.innerHTML = `<img loading="lazy" src="${getAssetUrl(savedAvatar)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
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

    async function fetchBookmarks() {
        const token = getToken();
        if (!token) return;
        try {
            const res = await fetch(`${API_URL}/users/bookmarks`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.documents) {
                    data.documents.forEach(doc => bookmarkedDocs.add(doc.MaTL));
                }
            }
        } catch (e) {
            console.error('Lỗi tải danh sách bookmarks:', e);
        }
    }

    Promise.all([loadSubjectFilters(), fetchBookmarks(), loadLevelFilters()]).then(() => {
        checkFilterState();
        fetchDocuments(1);
    });

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(debounceTimer);
                currentPage = 1;
                fetchDocuments(1);
            }
        });
        searchInput.addEventListener('input', () => {
            checkFilterState();
            handleDebouncedFilterChange();
        });
    }

    function checkFilterState() {
        if (!btnClearFilter) return;

        let isDefault = true;

        if (searchInput && searchInput.value.trim() !== '') isDefault = false;
        if (sortSelect && sortSelect.value !== 'MoiNhat') isDefault = false;
        if (levelSelect && levelSelect.value !== '') isDefault = false;
        if (subjectSelect && subjectSelect.value !== '') isDefault = false;
        if (ratingSelect && ratingSelect.value !== '') isDefault = false;
        if (officialOnly && officialOnly.checked) isDefault = false;
        if (fromDate && fromDate.value !== '') isDefault = false;
        if (toDate && toDate.value !== '') isDefault = false;
        if (authorInput && authorInput.value.trim() !== '') isDefault = false;

        const hasFile = Array.from(fileTypeCheckboxes).some(cb => cb.checked);
        if (hasFile) isDefault = false;

        if (isDefault) {
            btnClearFilter.disabled = true;
            btnClearFilter.style.opacity = '0.5';
            btnClearFilter.style.cursor = 'not-allowed';
        } else {
            btnClearFilter.disabled = false;
            btnClearFilter.style.opacity = '1';
            btnClearFilter.style.cursor = 'pointer';
        }
    }

    const handleFilterChange = () => {
        currentPage = 1;
        hasMore = true;
        checkFilterState();
        fetchDocuments(1, false);
    };

    const handleDebouncedFilterChange = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(handleFilterChange, 350);
    };

    if (sortSelect) sortSelect.addEventListener('change', handleFilterChange);
    if (ratingSelect) ratingSelect.addEventListener('change', handleFilterChange);
    if (levelSelect) levelSelect.addEventListener('change', handleFilterChange);

    fileTypeCheckboxes.forEach(cb => cb.addEventListener('change', handleFilterChange));
    if (officialOnly) officialOnly.addEventListener('change', handleFilterChange);
    if (fromDate) fromDate.addEventListener('change', handleFilterChange);
    if (toDate) toDate.addEventListener('change', handleFilterChange);
    if (authorInput) authorInput.addEventListener('input', handleDebouncedFilterChange);
    if (subjectSearch) {
        subjectSearch.addEventListener('input', () => {
            filterSubjectOptions();
            checkFilterState();
        });
    }

    if (btnClearFilter) {
        btnClearFilter.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (sortSelect) sortSelect.value = 'MoiNhat';
            if (levelSelect) levelSelect.value = '';
            if (subjectSelect) subjectSelect.value = '';
            if (ratingSelect) ratingSelect.value = '';
            if (officialOnly) officialOnly.checked = false;
            if (fromDate) fromDate.value = '';
            if (toDate) toDate.value = '';
            if (authorInput) authorInput.value = '';
            fileTypeCheckboxes.forEach(cb => cb.checked = false);
            handleFilterChange();
        });
    }

    function renderActiveFilters() {
        if (!activeFilters) return;

        const chips = [];
        if (subjectSelect && subjectSelect.value) {
            const label = subjectSelect.options[subjectSelect.selectedIndex].text;
            chips.push({ type: 'subject', value: subjectSelect.value, label });
        }
        if (ratingSelect && ratingSelect.value) {
            const label = ratingSelect.options[ratingSelect.selectedIndex].text;
            chips.push({ type: 'rating', value: ratingSelect.value, label });
        }

        Array.from(fileTypeCheckboxes).filter(cb => cb.checked).forEach(cb => {
            chips.push({ type: 'file', value: cb.value, label: cb.value.toUpperCase() });
        });

        if (officialOnly && officialOnly.checked) chips.push({ type: 'official', label: 'Chính thống' });
        if (levelSelect && levelSelect.value) chips.push({ type: 'level', value: levelSelect.value, label: `Cấp bậc: ${levelSelect.value}` });
        if (fromDate && fromDate.value) chips.push({ type: 'fromDate', label: `Từ ${fromDate.value}` });
        if (toDate && toDate.value) chips.push({ type: 'toDate', label: `Đến ${toDate.value}` });
        if (authorInput && authorInput.value.trim()) chips.push({ type: 'author', label: `Người đăng: ${authorInput.value.trim()}` });

        activeFilters.innerHTML = chips.map(chip => `
            <button class="active-filter-chip" type="button" data-type="${chip.type}" data-value="${chip.value || ''}">
                <span>${escapeHTML(chip.label)}</span>
                <i class="fa-solid fa-xmark"></i>
            </button>
        `).join('');

        activeFilters.style.display = chips.length ? 'flex' : 'none';
    }

    if (activeFilters) {
        activeFilters.addEventListener('click', (event) => {
            const chip = event.target.closest('.active-filter-chip');
            if (!chip) return;

            const type = chip.dataset.type;
            const value = chip.dataset.value;

            if (type === 'subject') {
                if (subjectSelect) subjectSelect.value = '';
            } else if (type === 'rating') {
                if (ratingSelect) ratingSelect.value = '';
            } else if (type === 'file') {
                const checkbox = Array.from(fileTypeCheckboxes).find(cb => cb.value === value);
                if (checkbox) checkbox.checked = false;
            } else if (type === 'level' && levelSelect) {
                levelSelect.value = '';
            } else if (type === 'official' && officialOnly) {
                officialOnly.checked = false;
            } else if (type === 'fromDate' && fromDate) {
                fromDate.value = '';
            } else if (type === 'toDate' && toDate) {
                toDate.value = '';
            } else if (type === 'author' && authorInput) {
                authorInput.value = '';
            }

            handleFilterChange();
        });
    }

    async function loadSubjectFilters() {
        if (!subjectSelect) return;

        try {
            const response = await fetch(`${API_URL}/documents/subjects`);
            if (!response.ok) throw new Error('Cannot load subjects');

            const data = await response.json();
            const subjects = data.subjects || [];

            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject.MaMonHoc;
                option.textContent = subject.TenMonHoc;
                subjectSelect.appendChild(option);
            });

            if (initialSubjectIds.length > 0) {
                subjectSelect.value = initialSubjectIds[0];
            }
            subjectSelect.addEventListener('change', handleFilterChange);
        } catch (error) {
            console.error('Lỗi tải môn học:', error);
        }
    }

    async function loadLevelFilters() {
        if (!levelSelect) return;
        try {
            const response = await fetch(`${API_URL}/documents/levels`);
            if (response.ok) {
                const data = await response.json();
                const levels = data.levels || [];
                levelSelect.innerHTML = '<option value="">Tất cả cấp bậc</option>';
                levels.forEach(level => {
                    const option = document.createElement('option');
                    option.value = level;
                    option.textContent = level;
                    levelSelect.appendChild(option);
                });
                const initialLevel = initialParams.get('capHoc');
                if (initialLevel) levelSelect.value = initialLevel;
            }
        } catch (error) {
            console.error('Lỗi tải cấp bậc:', error);
        }
    }

    async function fetchDocuments(page = 1, isAppend = false) {
        if (isLoading) return;
        isLoading = true;
        currentPage = page;

        if (scrollSpinner && isAppend) scrollSpinner.style.display = 'flex';
        if (scrollEndMessage) scrollEndMessage.style.display = 'none';
        if (!isAppend && resultsGrid) {
            resultsGrid.innerHTML = renderDocumentSkeleton(6);
        }

        const queryParams = new URLSearchParams();

        if (searchInput && searchInput.value.trim() !== '') {
            queryParams.append('tuKhoa', searchInput.value.trim());
        }

        if (sortSelect && sortSelect.value) {
            queryParams.append('sapXep', sortSelect.value);
        }

        if (levelSelect && levelSelect.value) {
            queryParams.append('capHoc', levelSelect.value);
        }

        if (subjectSelect && subjectSelect.value) {
            queryParams.append('maMonHoc', subjectSelect.value);
        }
        if (ratingSelect && ratingSelect.value) {
            queryParams.append('danhGia', ratingSelect.value);
        }

        const selectedFiles = Array.from(fileTypeCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
        if (selectedFiles.length > 0) {
            queryParams.append('loaiFile', selectedFiles.join(','));
        }

        if (officialOnly && officialOnly.checked) {
            queryParams.append('chinhThuc', 'true');
        }

        if (fromDate && fromDate.value) {
            queryParams.append('tuNgay', fromDate.value);
        }

        if (toDate && toDate.value) {
            queryParams.append('denNgay', toDate.value);
        }

        if (authorInput && authorInput.value.trim() !== '') {
            queryParams.append('nguoiDang', authorInput.value.trim());
        }

        queryParams.append('trang', page);
        renderActiveFilters();

        try {
            const response = await fetch(`${API_URL}/documents/search?${queryParams.toString()}`);
            if (!response.ok) throw new Error('Lỗi khi fetch dữ liệu');

            const data = await response.json();
            renderResults(data, isAppend);
        } catch (error) {
            console.error('Search error:', error);
            if (resultsGrid && !isAppend) {
                resultsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--danger);">Đã xảy ra lỗi khi tìm kiếm dữ liệu.</div>';
            }
        } finally {
            isLoading = false;
            if (scrollSpinner) scrollSpinner.style.display = 'none';
        }
    }

    function renderResults(data, isAppend = false) {
        const { documents, totalPages: totalP, totalRecords } = data;
        totalPages = totalP || 1;

        if (resultsHeader && !isAppend) {
            if (searchInput && searchInput.value.trim() !== '') {
                resultsHeader.style.display = 'block';
                resultsHeader.innerHTML = `<h1 class="results-count">Tìm thấy <strong>${totalRecords}</strong> kết quả cho "${escapeHTML(searchInput.value.trim())}"</h1>`;
            } else {
                resultsHeader.style.display = 'none';
            }
        }

        if (resultsGrid) {
            if (!isAppend) {
                resultsGrid.innerHTML = '';
            }

            if (documents.length === 0) {
                if (!isAppend) {
                    resultsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #6b7280; font-size: 16px;">Không tìm thấy tài liệu phù hợp.</div>';
                }
                hasMore = false;
            } else {
                documents.forEach(doc => {
                    const card = document.createElement('a');
                    card.href = `documentDetails.html?id=${doc.MaTL}`;
                    card.className = `doc-card ${doc.LaTaiLieuChinhThuc ? 'official' : ''}`;

                    let icon = 'fa-file';
                    let thumbClass = '';
                    let loaiFile = doc.LoaiFile ? doc.LoaiFile.toLowerCase() : '';

                    if (loaiFile === 'pdf') { icon = 'fa-file-pdf'; thumbClass = 'thumb-pdf'; }
                    else if (loaiFile === 'pptx' || loaiFile === 'ppt') { icon = 'fa-chart-column'; thumbClass = 'thumb-pptx'; }
                    else if (loaiFile === 'docx' || loaiFile === 'doc') { icon = 'fa-pen-to-square'; thumbClass = 'thumb-docx'; }

                    const officialBadge = doc.LaTaiLieuChinhThuc ? `<div class="badge-official"><i class="fa-solid fa-check"></i> Tài liệu chính thống</div>` : '';
                    const premiumBadge = doc.LaTaiLieuDocQuyen ? `<div class="badge-premium" style="position: absolute; top: 12px; left: 12px; z-index: 10; background: #FEF3C7; color: #B45309; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #FDE68A;"><i class="fa-solid fa-crown" style="color: #F59E0B; margin-right: 4px;"></i> PREMIUM (${doc.GiaXu || 0} Xu)</div>` : '';

                    const userInitial = doc.TenNguoiDang ? escapeHTML(doc.TenNguoiDang).trim().split(' ').pop().charAt(0).toUpperCase() : '?';
                    let avatarHtml = `<div class="avatar-sm">${userInitial}</div>`;
                    if (doc.AvatarURL) {
                        avatarHtml = `<div class="avatar-sm" style="background:transparent; color:transparent;"><img loading="lazy" src="${getAssetUrl(doc.AvatarURL)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;"></div>`;
                    }

                    let thumbHtml = `<i class="fa-solid ${icon}"></i>`;

                    if (doc.ThumbnailURL) {
                        const thumbUrlFull = getAssetUrl(doc.ThumbnailURL);
                        thumbHtml = `<img src="${thumbUrlFull}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; border: none; pointer-events: none;" loading="lazy" alt="Preview">`;
                        thumbClass = '';
                    } else {
                        let previewTarget = null;
                        if (doc.PreviewURL) {
                            previewTarget = doc.PreviewURL;
                        } else if (loaiFile === 'pdf' && doc.FileURL) {
                            previewTarget = doc.FileURL;
                        }

                        if (previewTarget) {
                            thumbHtml = `
                                <iframe
                                    src="${getAssetUrl(previewTarget)}#toolbar=0&navpanes=0&scrollbar=0&view=FitH"
                                    style="position: absolute; top: 0; left: 0; width: calc(100% + 24px); height: calc(100% + 24px); border: none; pointer-events: none;"
                                    scrolling="no"
                                    tabindex="-1"
                                    loading="lazy">
                                </iframe>`;
                            thumbClass = '';
                        }
                    }

                    let dateStr = 'Không rõ';
                    if (doc.NgayDang) {
                        const dateObj = new Date(doc.NgayDang);
                        dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
                    }

                    const isBookmarked = bookmarkedDocs.has(doc.MaTL);

                    card.innerHTML = `
                        <div class="doc-thumb ${thumbClass}">
                            ${officialBadge}
                            ${premiumBadge}
                            ${thumbHtml}
                            <button class="bookmark-btn ${isBookmarked ? 'active' : ''}" type="button" data-id="${doc.MaTL}">
                                <i class="${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
                            </button>
                        </div>
                        <div class="doc-content">
                            <div class="doc-meta" style="display: flex; justify-content: space-between; align-items: center;">
                                <span class="doc-meta-item" style="max-width: 65%;"><span><i class="fa-solid fa-folder" style="flex-shrink: 0;"></i></span> <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(doc.TenMonHoc || 'Không xác định')}">${escapeHTML(doc.TenMonHoc || 'Không xác định')}</span></span>
                                <span class="doc-meta-item" style="font-size: 12px; color: var(--text-secondary);"><i class="fa-solid fa-calendar"></i> ${dateStr}</span>
                            </div>
                            <h3 class="doc-title">${escapeHTML(doc.TenTL)}</h3>
                            <div class="doc-desc">${escapeHTML(stripHTML(doc.MoTa) || 'Không có mô tả')}</div>
                            <div class="doc-footer">
                                <div class="doc-author js-author-link" data-user-id="${doc.MaND || ''}" title="Xem hồ sơ người đăng">
                                    ${avatarHtml}
                                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; display: inline-block; vertical-align: middle;">${escapeHTML(doc.TenNguoiDang || 'Ẩn danh')}</span>
                                </div>
                                <div class="doc-stats">
                                    <span><i class="fa-solid fa-download" style="color: #6B7280; margin-right: 4px;"></i> ${(doc.SoLuotTai || 0).toLocaleString()}</span>
                                    <span><i class="fa-solid fa-star" style="color: #F59E0B; margin-right: 4px;"></i> ${formatRatingSummary(doc.DiemDanhGia, doc.SoDanhGia)}</span>
                                </div>
                            </div>
                        </div>
                    `;

                    const bookmarkBtn = card.querySelector('.bookmark-btn');
                    let isBookmarkProcessing = false;
                    bookmarkBtn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isBookmarkProcessing) return;

                        const token = getToken();
                        if (!token) {
                            Toast.fire({ icon: 'warning', title: 'Vui lòng đăng nhập để lưu tài liệu' });
                            return;
                        }

                        isBookmarkProcessing = true;
                        const originalHtml = bookmarkBtn.innerHTML;
                        bookmarkBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                        bookmarkBtn.style.pointerEvents = 'none';
                        bookmarkBtn.style.opacity = '0.7';

                        try {
                            const response = await fetch(`${API_URL}/documents/${doc.MaTL}/bookmark`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (response.ok) {
                                const bData = await response.json();
                                if (bData.isBookmarked) {
                                    bookmarkedDocs.add(doc.MaTL);
                                    bookmarkBtn.classList.add('active');
                                    bookmarkBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
                                    Toast.fire({ icon: 'success', title: 'Đã lưu tài liệu' });
                                } else {
                                    bookmarkedDocs.delete(doc.MaTL);
                                    bookmarkBtn.classList.remove('active');
                                    bookmarkBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
                                    Toast.fire({ icon: 'info', title: 'Đã bỏ lưu tài liệu' });
                                }
                            } else {
                                bookmarkBtn.innerHTML = originalHtml;
                            }
                        } catch (err) {
                            console.error('Lỗi khi lưu bookmark:', err);
                            bookmarkBtn.innerHTML = originalHtml;
                        } finally {
                            isBookmarkProcessing = false;
                            bookmarkBtn.style.pointerEvents = 'auto';
                            bookmarkBtn.style.opacity = '1';
                        }
                    });

                    const authorEl = card.querySelector('.js-author-link');
                    if (authorEl && authorEl.dataset.userId) {
                        authorEl.style.cursor = 'pointer';
                        authorEl.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.location.href = getUserProfileUrl(authorEl.dataset.userId);
                        });
                    }

                    resultsGrid.appendChild(card);
                });
            }
        }

        hasMore = currentPage < totalPages;
        isInitialLoaded = true;

        if (!hasMore && scrollEndMessage && (documents.length > 0 || isAppend)) {
            scrollEndMessage.style.display = 'block';
        } else if (scrollEndMessage) {
            scrollEndMessage.style.display = 'none';
        }

        if (observer && sentinelEl && hasMore) {
            observer.unobserve(sentinelEl);
            setTimeout(() => observer.observe(sentinelEl), 100);
        }
    }
});
