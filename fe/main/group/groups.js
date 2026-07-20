import { API_URL } from '../shared/config.js';
import { decodeJWT, escapeHTML, formatRatingSummary, getAssetUrl, getToken, getAvatar, getUserProfileUrl } from '../shared/utils.js';

const token = getToken();

window.closeModalWithAnimation = (modal) => {
    if (!modal) return;
    modal.classList.add('closing');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('closing');
    }, 280);
};

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        Swal.fire('Vui lòng đăng nhập để truy cập trang này.').then(() => {
            window.location.href = '../guest/guestHome.html';
        });
        return;
    }

    loadUserProfileNav();

    const path = window.location.pathname;

    if (path.includes('groupList.html')) {
        initGroupList();
    } else if (path.includes('groupDetails.html')) {
        initGroupDetails();
    }
});

function loadUserProfileNav() {
    try {
        const payload = decodeJWT(token);
        if (!payload) return;
        const avatarEl = document.getElementById('navAvatar');
        const nameEl = document.getElementById('navUserName');
        const roleEl = document.getElementById('navUserRole');
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

        if (nameEl && payload.HoTen) {
            nameEl.textContent = payload.HoTen;
        }

        if (roleEl && payload.VaiTro) {
            roleEl.textContent = payload.VaiTro === 'Admin'
                ? 'Quản trị viên'
                : (payload.VaiTro === 'GiaoVien' ? 'Giáo viên' : 'Sinh viên');
            if (payload.VaiTro === 'Admin') {
                roleEl.style.color = 'var(--danger-color, #ef4444)';
                roleEl.style.fontWeight = '600';
            }
        }
    } catch (e) {
        console.error('Lỗi giải mã token:', e);
    }
}
let currentGroupsData = [];
let currentUserId = null;
let currentTab = 'explore';
let subjectsList = [];
let currentGroupInfo = null;
let currentPage = 1;
let currentLimit = 12;
let selectedKickMember = null;
let contextMenuMember = null;
let selectedRemoveDoc = null;
let bookmarkedDocs = new Set();
let currentContextDoc = null;

async function fetchSubjectsForModal() {
    try {
        const res = await fetch(`${API_URL}/documents/subjects`);
        const data = await res.json();
        if (res.ok) {
            subjectsList = data.subjects || [];
            const newSelect = document.getElementById('new-group-subject');
            const editSelect = document.getElementById('edit-group-subject');
            let options = '<option value="">Chọn môn học (Tùy chọn)</option>';
            subjectsList.forEach(s => {
                options += `<option value="${s.MaMonHoc}">${s.TenMonHoc}</option>`;
            });
            if (newSelect) newSelect.innerHTML = options;
            if (editSelect) editSelect.innerHTML = options;
        }
    } catch (err) {
        console.error('Lỗi tải môn học:', err);
    }
}

async function initGroupList() {
    const payload = decodeJWT(token);
    currentUserId = payload ? payload.MaND : null;
    
    await fetchSubjectsForModal();
    await fetchGroups();

    const searchInput = document.getElementById('search-group');
    const filterSelect = document.getElementById('filter-subject');
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (filterSelect) filterSelect.addEventListener('change', applyFilters);

    const tabExplore = document.getElementById('tab-all-groups');
    const tabMyGroups = document.getElementById('tab-my-groups');

    if (tabExplore && tabMyGroups) {
        tabExplore.addEventListener('click', () => {
            currentTab = 'explore';
            tabExplore.classList.add('active');
            tabMyGroups.classList.remove('active');
            fetchGroups();
        });

        tabMyGroups.addEventListener('click', () => {
            currentTab = 'my-groups';
            tabMyGroups.classList.add('active');
            tabExplore.classList.remove('active');
            fetchMyGroups();
        });
    }

    const btnCreate = document.getElementById('btn-create-group');
    const createModal = document.getElementById('createGroupModal');
    const editModal = document.getElementById('editGroupModal');
    
    window.addEventListener('click', (e) => {
        if (e.target === createModal) window.closeModalWithAnimation(createModal);
        if (e.target === editModal) window.closeModalWithAnimation(editModal);
    });
    
    const btnCloseCreate = document.getElementById('btn-close-create-group');
    if (btnCloseCreate) btnCloseCreate.addEventListener('click', () => window.closeModalWithAnimation(createModal));
    const btnCancelCreate = document.getElementById('btn-cancel-create-group');
    if (btnCancelCreate) btnCancelCreate.addEventListener('click', () => window.closeModalWithAnimation(createModal));

    const btnCloseEdit = document.getElementById('btn-close-edit-group');
    if (btnCloseEdit) btnCloseEdit.addEventListener('click', () => window.closeModalWithAnimation(editModal));
    const btnCancelEdit = document.getElementById('btn-cancel-edit-group');
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', () => window.closeModalWithAnimation(editModal));
    
    if (btnCreate && createModal) {
        const checkCreateForm = () => {
            const tenNhom = document.getElementById('new-group-name').value.trim();
            const btnConfirmCreate = document.getElementById('btn-confirm-create-group');
            if (tenNhom) {
                btnConfirmCreate.disabled = false;
                btnConfirmCreate.style.opacity = '1';
                btnConfirmCreate.style.pointerEvents = 'auto';
            } else {
                btnConfirmCreate.disabled = true;
                btnConfirmCreate.style.opacity = '0.6';
                btnConfirmCreate.style.pointerEvents = 'none';
            }
        };

        document.getElementById('new-group-name').addEventListener('input', checkCreateForm);
        document.getElementById('new-group-desc').addEventListener('input', checkCreateForm);
        document.getElementById('new-group-subject').addEventListener('change', checkCreateForm);

        btnCreate.addEventListener('click', () => {
            createModal.style.display = 'flex';
            document.getElementById('new-group-name').value = '';
            document.getElementById('new-group-desc').value = '';
            document.getElementById('new-group-subject').value = '';
            checkCreateForm();
        });

        const btnConfirmCreate = document.getElementById('btn-confirm-create-group');
        btnConfirmCreate.addEventListener('click', async () => {
            const tenNhom = document.getElementById('new-group-name').value.trim();
            const moTa = document.getElementById('new-group-desc').value.trim();
            const maMonHoc = document.getElementById('new-group-subject').value;

            if (!tenNhom) {
                Swal.fire({ icon: 'warning', title: 'Cảnh báo', text: 'Vui lòng nhập tên nhóm' });
                return;
            }
            
            btnConfirmCreate.disabled = true;
            btnConfirmCreate.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:4px;"></i>&nbsp; Đang xử lý...';
            try {
                const res = await fetch(`${API_URL}/groups`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ tenNhom, moTa, maMonHoc: maMonHoc || null })
                });
                
                if (res.ok) {
                    Swal.fire({ icon: 'success', title: 'Thành công', text: 'Tạo nhóm thành công!' });
                    window.closeModalWithAnimation(createModal);
                    if (currentTab === 'explore') fetchGroups();
                    else fetchMyGroups();
                } else {
                    const data = await res.json();
                    Swal.fire({ icon: 'error', title: 'Lỗi', text: data.message });
                }
            } catch (err) {
                console.error(err);
                Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Có lỗi xảy ra' });
            } finally {
                btnConfirmCreate.disabled = false;
                btnConfirmCreate.innerHTML = '<i class="fa-solid fa-check" style="margin-right:4px;"></i> Tạo nhóm';
            }
        });
    }

    const btnConfirmEdit = document.getElementById('btn-confirm-edit-group');
    if (btnConfirmEdit) {
        btnConfirmEdit.addEventListener('click', async () => {
            const id = document.getElementById('edit-group-id').value;
            const tenNhom = document.getElementById('edit-group-name').value.trim();
            const moTa = document.getElementById('edit-group-desc').value.trim();
            const maMonHoc = document.getElementById('edit-group-subject').value;

            if (!tenNhom) {
                Swal.fire({ icon: 'warning', title: 'Cảnh báo', text: 'Vui lòng nhập tên nhóm' });
                return;
            }

            btnConfirmEdit.disabled = true;
            btnConfirmEdit.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:4px;"></i> Đang xử lý...';
            try {
                const res = await fetch(`${API_URL}/groups/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ tenNhom, moTa, maMonHoc: maMonHoc || null })
                });

                if (res.ok) {
                    Swal.fire({ icon: 'success', title: 'Thành công', text: 'Cập nhật nhóm thành công!' });
                    window.closeModalWithAnimation(editModal);
                    if (currentTab === 'explore') fetchGroups();
                    else fetchMyGroups();
                } else {
                    const data = await res.json();
                    Swal.fire({ icon: 'error', title: 'Lỗi', text: data.message });
                }
            } catch (err) {
                console.error(err);
                Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Có lỗi xảy ra' });
            } finally {
                btnConfirmEdit.disabled = false;
                btnConfirmEdit.textContent = 'Cập nhật';
            }
        });
    }
}

window.fetchGroups = async function(page = 1) {
    currentPage = page;
    const titleEl = document.getElementById('main-group-title');
    if (titleEl) titleEl.textContent = 'Tất cả các nhóm';
    const grid = document.getElementById('group-grid');
    if (grid) grid.innerHTML = '<div style="text-align:center; padding:40px; width:100%;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--primary-color);"></i><p style="margin-top:10px; color:var(--text-secondary);">Đang tải danh sách nhóm...</p></div>';
    
    try {
        const res = await fetch(`${API_URL}/groups?page=${page}&limit=${currentLimit}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        currentGroupsData = data.groups || [];
        populateSubjectFilter();
        applyFilters();
        if (data.pagination) renderPagination(data.pagination.totalPages, data.pagination.currentPage, 'window.fetchGroups');
        
        const recSection = document.getElementById('recommended-section');
        if (recSection && page === 1 && currentTab === 'explore') {
            window.fetchRecommendedGroups();
        } else if (recSection) {
            recSection.style.display = 'none';
        }
    } catch (err) {
        console.error('Lỗi lấy dữ liệu fetchGroups:', err);
        if (grid) grid.innerHTML = '<div style="text-align:center; padding:40px; width:100%;"><i class="fa-solid fa-triangle-exclamation fa-2x" style="color:#ef4444;"></i><p style="margin-top:10px; color:var(--text-secondary);">Không thể tải danh sách nhóm. Vui lòng thử lại sau.</p><button class="btn-outline-primary" style="margin-top:10px;" onclick="window.fetchGroups()">Thử lại</button></div>';
    }
}

window.fetchMyGroups = async function(page = 1) {
    currentPage = page;
    const titleEl = document.getElementById('main-group-title');
    if (titleEl) titleEl.textContent = 'Nhóm của tôi';
    const grid = document.getElementById('group-grid');
    if (grid) grid.innerHTML = '<div style="text-align:center; padding:40px; width:100%;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--primary-color);"></i><p style="margin-top:10px; color:var(--text-secondary);">Đang tải nhóm của bạn...</p></div>';

    const recSection = document.getElementById('recommended-section');
    if (recSection) recSection.style.display = 'none';

    try {
        const res = await fetch(`${API_URL}/groups/my-groups?page=${page}&limit=${currentLimit}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        currentGroupsData = data.groups || [];
        populateSubjectFilter();
        applyFilters();
        if (data.pagination) renderPagination(data.pagination.totalPages, data.pagination.currentPage, 'window.fetchMyGroups');
    } catch (err) {
        console.error('Lỗi fetchMyGroups:', err);
        if (grid) grid.innerHTML = '<div style="text-align:center; padding:40px; width:100%;"><i class="fa-solid fa-triangle-exclamation fa-2x" style="color:#ef4444;"></i><p style="margin-top:10px; color:var(--text-secondary);">Không thể tải nhóm của bạn. Vui lòng thử lại sau.</p><button class="btn-outline-primary" style="margin-top:10px;" onclick="window.fetchMyGroups()">Thử lại</button></div>';
    }
}

window.fetchRecommendedGroups = async function() {
    const grid = document.getElementById('recommended-group-grid');
    const section = document.getElementById('recommended-section');
    if (!grid || !section) return;
    
    try {
        const res = await fetch(`${API_URL}/groups/recommended?limit=3`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.groups && data.groups.length > 0) {
            section.style.display = 'block';
            renderGroups(data.groups, 'recommended-group-grid');
        } else {
            section.style.display = 'none';
        }
    } catch (err) {
        console.error('Lỗi lấy nhóm gợi ý:', err);
        section.style.display = 'none';
    }
}

function renderPagination(totalPages, currentPage, fetchFunctionName) {
    const container = document.getElementById('paginationContainer');
    if (!container) return;
    container.innerHTML = '';

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = i === currentPage ? 'btn-primary' : 'btn-outline-primary';
        btn.style.padding = '8px 16px';
        btn.style.height = 'auto';
        if (i !== currentPage) {
            btn.onclick = () => {
                if (fetchFunctionName === 'window.fetchGroups') window.fetchGroups(i);
                else window.fetchMyGroups(i);
            };
        }
        container.appendChild(btn);
    }
}

function populateSubjectFilter() {
    const filterSelect = document.getElementById('filter-subject');
    if (!filterSelect) return;
    
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="">Tất cả môn học</option>';
    
    const sortedSubjects = [...subjectsList].sort((a, b) => a.TenMonHoc.localeCompare(b.TenMonHoc));
    
    sortedSubjects.forEach(subj => {
        const option = document.createElement('option');
        option.value = subj.TenMonHoc;
        option.textContent = subj.TenMonHoc;
        filterSelect.appendChild(option);
    });

    if (Array.from(filterSelect.options).some(opt => opt.value === currentVal)) {
        filterSelect.value = currentVal;
    }
}

function applyFilters() {
    const searchInput = document.getElementById('search-group');
    const filterSelect = document.getElementById('filter-subject');
    
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const subject = filterSelect ? filterSelect.value : '';
    
    const filtered = currentGroupsData.filter(g => {
        const matchQuery = g.TenNhom.toLowerCase().includes(query) || (g.MoTa && g.MoTa.toLowerCase().includes(query));
        const matchSubject = subject === '' || g.TenMonHoc === subject;
        return matchQuery && matchSubject;
    });
    
    renderGroups(filtered, 'group-grid');
}

let editInitialState = {};

window.validateEditGroupForm = () => {
    const btnConfirmEdit = document.getElementById('btn-confirm-edit-group');
    if (!btnConfirmEdit) return;
    
    const tenNhom = document.getElementById('edit-group-name').value.trim();
    const moTa = document.getElementById('edit-group-desc').value.trim();
    const maMonHoc = String(document.getElementById('edit-group-subject').value || '');
    
    const hasChanged = tenNhom !== editInitialState.tenNhom ||
                       moTa !== editInitialState.moTa ||
                       maMonHoc !== editInitialState.maMonHoc;
                       
    const isValid = tenNhom.length > 0;
    
    if (hasChanged && isValid) {
        btnConfirmEdit.disabled = false;
        btnConfirmEdit.style.opacity = '1';
        btnConfirmEdit.style.cursor = 'pointer';
    } else {
        btnConfirmEdit.disabled = true;
        btnConfirmEdit.style.opacity = '0.5';
        btnConfirmEdit.style.cursor = 'not-allowed';
    }
};

window.openEditModal = (id) => {
    const g = currentGroupInfo && String(currentGroupInfo.MaNhom) === String(id)
        ? currentGroupInfo
        : currentGroupsData.find(x => x.MaNhom === id);
    if (!g) return;
    const editGroupId = document.getElementById('edit-group-id');
    if (editGroupId) editGroupId.value = g.MaNhom;
    
    const nameInput = document.getElementById('edit-group-name');
    const descInput = document.getElementById('edit-group-desc');
    const subjectInput = document.getElementById('edit-group-subject');
    
    if (nameInput) nameInput.value = g.TenNhom || '';
    if (descInput) descInput.value = g.MoTa || '';
    if (subjectInput) subjectInput.value = g.MaMonHoc || '';
    
    editInitialState = {
        tenNhom: (g.TenNhom || '').trim(),
        moTa: (g.MoTa || '').trim(),
        maMonHoc: String(g.MaMonHoc || '')
    };
    
    window.validateEditGroupForm();
    
    if (nameInput) {
        nameInput.removeEventListener('input', window.validateEditGroupForm);
        nameInput.addEventListener('input', window.validateEditGroupForm);
    }
    if (descInput) {
        descInput.removeEventListener('input', window.validateEditGroupForm);
        descInput.addEventListener('input', window.validateEditGroupForm);
    }
    if (subjectInput) {
        subjectInput.removeEventListener('change', window.validateEditGroupForm);
        subjectInput.addEventListener('change', window.validateEditGroupForm);
    }
    
    document.getElementById('editGroupModal').style.display = 'flex';
};

window.deleteGroup = async (id) => {
    const result = await Swal.fire({
        title: 'Xác nhận xoá',
        text: 'Bạn có chắc chắn muốn xoá nhóm này không?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xác nhận',
        cancelButtonText: 'Hủy'
    });

    if (result.isConfirmed) {
        try {
            const res = await fetch(`${API_URL}/groups/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                Swal.fire({ icon: 'success', title: 'Thành công', text: 'Nhóm đã được xóa.' });
                if (window.location.pathname.includes('groupDetails.html')) {
                    window.location.href = 'groupList.html';
                } else if (currentTab === 'explore') {
                    fetchGroups();
                } else {
                    fetchMyGroups();
                }
            } else {
                const data = await res.json();
                Swal.fire({ icon: 'error', title: 'Lỗi', text: data.message });
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Có lỗi xảy ra khi xóa nhóm.' });
        }
    }
};

function renderGroups(groups, gridId = 'group-grid') {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';

    if (groups.length === 0) {
        let emptyMessage = currentTab === 'explore' ? 'Không có nhóm nào trong Khám phá.' : 'Bạn chưa tham gia nhóm nào.';
        if (gridId === 'recommended-group-grid') emptyMessage = 'Chưa có nhóm gợi ý phù hợp cho bạn.';
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);"><i class="fa-solid fa-box-open fa-3x" style="color: #cbd5e1; margin-bottom:15px;"></i><p>${emptyMessage}</p></div>`;
        return;
    }

    groups.forEach((g, index) => {
        const div = document.createElement('div');
        div.className = 'group-card';
        div.style.position = 'relative';
        div.style.animationDelay = `${index * 0.04}s`;

        let actionButton = '';
        if (g.IsMember) {
            actionButton = `<button class="btn-primary" style="flex:1;" onclick="window.location.href='groupDetails.html?id=${g.MaNhom}'"><i class="fa-solid fa-arrow-right-to-bracket" style="margin-right: 5px;"></i> Xem nhóm</button>`;
        } else {
            actionButton = `<button class="btn-primary" style="flex:1;" onclick="window.joinGroup(${g.MaNhom}, this)"><i class="fa-solid fa-user-plus" style="margin-right: 5px;"></i> Tham gia</button>`;
        }

        div.innerHTML = `
          <div class="group-header">
            <div class="group-icon"><i class="fa-solid fa-users"></i></div>
            <div class="group-members"><i class="fa-solid fa-user-group"></i> ${g.SoLuongThanhVien || 1}</div>
          </div>
          <div class="group-info">
            <h3 class="group-title">${escapeHTML(g.TenNhom)}</h3>
            <span class="group-subject">${escapeHTML(g.TenMonHoc) || 'Chung'}</span>
            <p class="group-desc">${escapeHTML(g.MoTa) || 'Không có mô tả'}</p>
          </div>
          <div class="group-footer" style="display:flex; gap:10px;">
            ${actionButton}
            <button class="btn-outline-primary" style="flex:1;" onclick="window.location.href='groupDetails.html?id=${g.MaNhom}'"><i class="fa-solid fa-circle-info" style="margin-right: 5px;"></i> Chi tiết</button>
          </div>
        `;
        grid.appendChild(div);
    });
}
window.joinGroup = async (maNhom, btnElement) => {
    if (btnElement) {
        btnElement.disabled = true;
        btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;"></i> Đang xử lý...';
    }
    try {
        const res = await fetch(`${API_URL}/groups/${maNhom}/join`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Thành công', text: 'Tham gia nhóm thành công!' });
            if (window.location.pathname.includes('groupDetails.html')) {
                window.location.reload();
            } else if (currentTab === 'explore') {
                fetchGroups();
            } else {
                fetchMyGroups();
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Lỗi', text: data.message });
        }
    } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Có lỗi xảy ra' });
    } finally {
        if (btnElement) {
            btnElement.disabled = false;
            btnElement.innerHTML = '<i class="fa-solid fa-user-plus" style="margin-right: 5px;"></i> Tham gia';
        }
    }
};



let currentGroupId = null;

async function initGroupDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    currentGroupId = urlParams.get('id');
    
    if (!currentGroupId) {
        Swal.fire('Không tìm thấy ID nhóm!');
        window.location.href = 'groupList.html';
        return;
    }

    const payload = decodeJWT(token);
    currentUserId = payload ? payload.MaND : null;

    await fetchSubjectsForModal();
    await fetchGroupInfo();
    await fetchGroupMembers();
    await fetchBookmarks();
    await fetchGroupDocuments();
    initGroupDetailControls();

    async function fetchBookmarks() {
        if (!token) return;
        try {
            const res = await fetch(`${API_URL}/users/bookmarks`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.documents) {
                    bookmarkedDocs.clear();
                    data.documents.forEach(doc => bookmarkedDocs.add(doc.MaTL));
                }
            }
        } catch (e) {
            console.error('Lỗi tải danh sách bookmarks:', e);
        }
    }

    const btnLeaveGroup = document.getElementById('btn-leave-group');
    if (btnLeaveGroup) {
        btnLeaveGroup.addEventListener('click', async () => {
            document.getElementById('group-menu-content').classList.remove('show');
            
            const executeLeaveGroup = async (newAdminId = null) => {
                try {
                    const bodyData = newAdminId ? JSON.stringify({ newAdminId }) : null;
                    const res = await fetch(`${API_URL}/groups/${currentGroupId}/leave`, {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: bodyData
                    });
                    const data = await res.json();
                    
                    if (res.ok) {
                        await Swal.fire('Thành công', 'Đã rời nhóm', 'success');
                        window.location.href = 'groupList.html';
                    } else {
                        Swal.fire('Lỗi', data.message, 'error');
                    }
                } catch (err) {
                    console.error(err);
                }
            };

            const isGroupAdmin = currentGroupInfo && String(currentUserId) === String(currentGroupInfo.MaND_QuanTri);
            
            if (isGroupAdmin) {
                const otherMembers = (window.currentGroupMembers || []).filter(m => String(m.MaND) !== String(currentUserId));
                if (otherMembers.length > 0) {
                    const selectNewAdmin = document.getElementById('select-new-admin');
                    if (selectNewAdmin) {
                        selectNewAdmin.innerHTML = '<option value="">Chọn thành viên</option>';
                        otherMembers.forEach(m => {
                            const option = document.createElement('option');
                            option.value = m.MaND;
                            option.textContent = m.HoTen;
                            selectNewAdmin.appendChild(option);
                        });
                        const transferAdminModal = document.getElementById('transferAdminModal');
                        if (transferAdminModal) {
                            transferAdminModal.style.display = 'flex';
                            window.executeLeaveGroup = executeLeaveGroup;
                            return;
                        }
                    }
                } else {
                    const message = 'Bạn là thành viên duy nhất. Nhóm sẽ ngừng hoạt động sau khi bạn rời đi.';
                    openLeaveGroupModal(message, () => {
                        executeLeaveGroup();
                    });
                    return;
                }
            } else {
                const message = 'Bạn có chắc chắn muốn rời nhóm này?';
                openLeaveGroupModal(message, () => {
                    executeLeaveGroup();
                });
            }
        });
    }

    function openLeaveGroupModal(message, confirmCallback) {
        const modal = document.getElementById('leaveGroupModal');
        const msgEl = document.getElementById('leave-group-msg');
        if (!modal || !msgEl) return;

        msgEl.textContent = message;
        
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.style.opacity = '1';
            const content = modal.querySelector('.modal-content');
            if (content) content.style.transform = 'scale(1)';
        }, 10);

        const btnConfirm = document.getElementById('btn-confirm-leave-group');
        const btnCancel = document.getElementById('btn-cancel-leave-group');

        const newConfirm = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);

        const newCancel = btnCancel.cloneNode(true);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);

        const closeModal = () => {
            modal.style.opacity = '0';
            const content = modal.querySelector('.modal-content');
            if (content) content.style.transform = 'scale(0.9)';
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        };

        newConfirm.addEventListener('click', async () => {
            newConfirm.disabled = true;
            newConfirm.style.opacity = '0.7';
            newConfirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;"></i> Đang xử lý...';
            
            await confirmCallback();
            
            closeModal();
        });

        newCancel.addEventListener('click', closeModal);
    }

    
    const shareModal = document.getElementById('shareDocModal');
    const selectDoc = document.getElementById('select-doc-to-share');
    const btnConfirmShare = document.getElementById('btn-confirm-share');

    if (document.getElementById('btn-share-doc')) {
        document.getElementById('btn-share-doc').addEventListener('click', async () => {
            if (btnConfirmShare) {
                btnConfirmShare.disabled = true;
                btnConfirmShare.style.opacity = '0.5';
                btnConfirmShare.style.cursor = 'not-allowed';
            }
            shareModal.style.display = 'flex';
            await loadMyDocumentsForShare();
        });
    }

    if (selectDoc) {
        selectDoc.addEventListener('change', () => {
            const maTL = selectDoc.value;
            let alreadyInGroup = false;
            
            if (maTL && window.currentGroupDocs) {
                alreadyInGroup = window.currentGroupDocs.some(d => String(d.MaTL) === String(maTL));
            }

            if (maTL && !alreadyInGroup) {
                btnConfirmShare.disabled = false;
                btnConfirmShare.style.opacity = '1';
                btnConfirmShare.style.cursor = 'pointer';
            } else {
                btnConfirmShare.disabled = true;
                btnConfirmShare.style.opacity = '0.5';
                btnConfirmShare.style.cursor = 'not-allowed';
            }
        });
    }
    
    document.getElementById('btn-cancel-share').addEventListener('click', () => {
        window.closeModalWithAnimation(shareModal);
    });
    
    btnConfirmShare.addEventListener('click', async () => {
        const maTL = selectDoc.value;
        if (!maTL) {
            Swal.fire('Vui lòng chọn tài liệu.');
            return;
        }
        
        try {
            const res = await fetch(`${API_URL}/groups/${currentGroupId}/share-document`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ maTL })
            });
            if (res.ok) {
                Swal.fire('Chia sẻ tài liệu thành công!');
                window.closeModalWithAnimation(shareModal);
                fetchGroupDocuments(); 
            } else {
                const data = await res.json();
                Swal.fire('Lỗi', data.message, 'error');
            }
        } catch (err) {
            console.error(err);
        }
    });

    const transferAdminModal = document.getElementById('transferAdminModal');
    if (transferAdminModal) {
        document.getElementById('btn-close-transfer-admin').addEventListener('click', () => {
            window.closeModalWithAnimation(transferAdminModal);
        });
        document.getElementById('btn-cancel-transfer-admin').addEventListener('click', () => {
            window.closeModalWithAnimation(transferAdminModal);
        });
        document.getElementById('btn-confirm-transfer-admin').addEventListener('click', async () => {
            const newAdminId = document.getElementById('select-new-admin').value;
            if (!newAdminId) {
                Swal.fire('Vui lòng chọn thành viên để chuyển quyền.');
                return;
            }
            if (window.executeLeaveGroup) {
                window.closeModalWithAnimation(transferAdminModal);
                await window.executeLeaveGroup(newAdminId);
            }
        });
        transferAdminModal.addEventListener('click', (e) => {
            if (e.target === transferAdminModal) {
                window.closeModalWithAnimation(transferAdminModal);
            }
        });
    }
}

function initGroupDetailControls() {
    const editModal = document.getElementById('editGroupModal');
    const kickMemberModal = document.getElementById('kickMemberModal');
    const btnEditGroup = document.getElementById('btn-edit-group');
    const btnDeleteGroup = document.getElementById('btn-delete-group');
    const btnCloseEdit = document.getElementById('btn-close-edit-group');
    const btnCancelEdit = document.getElementById('btn-cancel-edit-group');
    const btnConfirmEdit = document.getElementById('btn-confirm-edit-group');
    const btnCloseKickMember = document.getElementById('btn-close-kick-member');
    const btnCancelKickMember = document.getElementById('btn-cancel-kick-member');
    const btnConfirmKickMember = document.getElementById('btn-confirm-kick-member');
    const memberContextMenu = document.getElementById('memberContextMenu');
    const btnContextKickMember = document.getElementById('btn-context-kick-member');
    const btnContextViewProfile = document.getElementById('btn-context-view-profile');
    const memberToggle = document.getElementById('member-list-toggle');
    const memberPanel = document.getElementById('member-panel');
    const btnGroupMenu = document.getElementById('btn-group-menu');
    const groupMenuContent = document.getElementById('group-menu-content');

    if (btnGroupMenu && groupMenuContent) {
        btnGroupMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            groupMenuContent.classList.toggle('show');
        });

        window.addEventListener('click', (e) => {
            if (!btnGroupMenu.contains(e.target) && !groupMenuContent.contains(e.target)) {
                groupMenuContent.classList.remove('show');
            }
            hideMemberContextMenu();
        });
    }

    if (btnContextViewProfile) {
        btnContextViewProfile.addEventListener('click', () => {
            if (contextMenuMember) {
                window.location.href = getUserProfileUrl(contextMenuMember.MaND);
            }
            hideMemberContextMenu();
        });
    }

    if (btnContextKickMember) {
        btnContextKickMember.addEventListener('click', () => {
            if (contextMenuMember) openKickMemberModal(contextMenuMember);
            hideMemberContextMenu();
        });
    }

    if (memberContextMenu) {
        memberContextMenu.addEventListener('click', (e) => e.stopPropagation());
    }

    window.addEventListener('scroll', hideMemberContextMenu, true);
    window.addEventListener('resize', hideMemberContextMenu);

    if (btnEditGroup) {
        btnEditGroup.addEventListener('click', () => window.openEditModal(currentGroupId));
    }

    if (btnDeleteGroup) {
        btnDeleteGroup.addEventListener('click', () => window.deleteGroup(currentGroupId));
    }

    if (btnCloseEdit && editModal) {
        btnCloseEdit.addEventListener('click', () => window.closeModalWithAnimation(editModal));
    }

    if (btnCancelEdit && editModal) {
        btnCancelEdit.addEventListener('click', () => window.closeModalWithAnimation(editModal));
    }

    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) window.closeModalWithAnimation(editModal);
        });
    }

    if (btnCloseKickMember && kickMemberModal) {
        btnCloseKickMember.addEventListener('click', () => window.closeModalWithAnimation(kickMemberModal));
    }

    if (btnCancelKickMember && kickMemberModal) {
        btnCancelKickMember.addEventListener('click', () => window.closeModalWithAnimation(kickMemberModal));
    }

    if (kickMemberModal) {
        kickMemberModal.addEventListener('click', (e) => {
            if (e.target === kickMemberModal) window.closeModalWithAnimation(kickMemberModal);
        });
    }

    if (btnConfirmEdit) {
        btnConfirmEdit.addEventListener('click', async () => {
            const tenNhom = document.getElementById('edit-group-name').value.trim();
            const moTa = document.getElementById('edit-group-desc').value.trim();
            const maMonHoc = document.getElementById('edit-group-subject').value;

            if (!tenNhom) {
                Swal.fire({ icon: 'warning', title: 'Cảnh báo', text: 'Vui lòng nhập tên nhóm' });
                return;
            }

            btnConfirmEdit.disabled = true;
            btnConfirmEdit.textContent = 'Đang lưu...';
            try {
                const res = await fetch(`${API_URL}/groups/${currentGroupId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ tenNhom, moTa, maMonHoc: maMonHoc || null })
                });

                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    Swal.fire({ icon: 'success', title: 'Thành công', text: 'Cập nhật nhóm thành công!' });
                    window.closeModalWithAnimation(editModal);
                    await fetchGroupInfo();
                } else {
                    Swal.fire({ icon: 'error', title: 'Lỗi', text: data.message || 'Không thể cập nhật nhóm' });
                }
            } catch (err) {
                console.error(err);
                Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Có lỗi xảy ra' });
            } finally {
                btnConfirmEdit.disabled = false;
                btnConfirmEdit.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu thay đổi';
            }
        });
    }

    if (btnConfirmKickMember) {
        btnConfirmKickMember.addEventListener('click', async () => {
            if (!selectedKickMember) return;

            const reasonInput = document.getElementById('kick-member-reason');
            const reason = reasonInput.value.trim();
            if (!reason) {
                Swal.fire({ icon: 'warning', title: 'Cảnh báo', text: 'Vui lòng nhập lý do đuổi thành viên.' });
                return;
            }

            btnConfirmKickMember.disabled = true;
            btnConfirmKickMember.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;></i> Đang xử lý';
            try {
                const res = await fetch(`${API_URL}/groups/${currentGroupId}/members/${selectedKickMember.MaND}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ lyDo: reason })
                });
                const data = await res.json().catch(() => ({}));

                if (res.ok) {
                    window.closeModalWithAnimation(kickMemberModal);
                    selectedKickMember = null;
                    reasonInput.value = '';
                    await Swal.fire({
                        icon: 'success',
                        title: 'Thành công',
                        text: `Đã đuổi ${data.removedMember?.HoTen || 'thành viên'} khỏi nhóm.`
                    });
                    await fetchGroupMembers();
                    await fetchGroupInfo();
                } else {
                    Swal.fire({ icon: 'error', title: 'Lỗi', text: data.message || 'Không thể đuổi thành viên.' });
                }
            } catch (err) {
                console.error(err);
                Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Có lỗi xảy ra.' });
            } finally {
                btnConfirmKickMember.disabled = false;
                btnConfirmKickMember.innerHTML = '<i class="fa-solid fa-user-minus"></i> Xác nhận đuổi';
            }
        });
    }

    if (memberToggle && memberPanel) {
        memberToggle.addEventListener('click', () => {
            const expanded = memberToggle.getAttribute('aria-expanded') === 'true';
            memberToggle.setAttribute('aria-expanded', String(!expanded));
            memberPanel.classList.toggle('is-expanded', !expanded);
        });
    }

    const removeDocModal = document.getElementById('removeDocModal');
    const btnCloseRemoveDoc = document.getElementById('btn-close-remove-doc');
    const btnCancelRemoveDoc = document.getElementById('btn-cancel-remove-doc');
    const btnConfirmRemoveDoc = document.getElementById('btn-confirm-remove-doc');

    if (btnCloseRemoveDoc && removeDocModal) {
        btnCloseRemoveDoc.addEventListener('click', () => window.closeModalWithAnimation(removeDocModal));
    }
    if (btnCancelRemoveDoc && removeDocModal) {
        btnCancelRemoveDoc.addEventListener('click', () => window.closeModalWithAnimation(removeDocModal));
    }
    if (removeDocModal) {
        removeDocModal.addEventListener('click', (e) => {
            if (e.target === removeDocModal) window.closeModalWithAnimation(removeDocModal);
        });
    }

    if (btnConfirmRemoveDoc) {
        btnConfirmRemoveDoc.addEventListener('click', async () => {
            if (!selectedRemoveDoc) return;

            const reasonInput = document.getElementById('remove-doc-reason');
            const reason = reasonInput.value.trim();

            btnConfirmRemoveDoc.disabled = true;
            btnConfirmRemoveDoc.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;></i> Đang xử lý';
            try {
                const res = await fetch(`${API_URL}/groups/${currentGroupId}/documents/${selectedRemoveDoc.MaTL}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ lyDo: reason })
                });
                const data = await res.json().catch(() => ({}));

                if (res.ok) {
                    window.closeModalWithAnimation(removeDocModal);
                    selectedRemoveDoc = null;
                    if (reasonInput) reasonInput.value = '';
                    await Swal.fire({
                        icon: 'success',
                        title: 'Thành công',
                        text: `Đã xóa tài liệu khỏi nhóm.`
                    });
                    await fetchGroupDocuments();
                } else {
                    Swal.fire({ icon: 'error', title: 'Lỗi', text: data.message || 'Không thể xóa tài liệu.' });
                }
            } catch (err) {
                console.error(err);
                Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Có lỗi xảy ra.' });
            } finally {
                btnConfirmRemoveDoc.disabled = false;
                btnConfirmRemoveDoc.innerHTML = '<i class="fa-solid fa-trash"></i> Xác nhận xoá';
            }
        });
    }

    window.openRemoveDocModal = (doc) => {
        if (!removeDocModal) return;
        selectedRemoveDoc = doc;
        const msg = document.getElementById('remove-doc-message');
        if (msg) {
            msg.innerHTML = `Bạn sắp xóa tài liệu <strong>${escapeHTML(doc.TenTL)}</strong> khỏi nhóm.`;
        }
        if (document.getElementById('remove-doc-reason')) {
            document.getElementById('remove-doc-reason').value = '';
        }
        removeDocModal.style.display = 'flex';
    };
}

async function fetchGroupInfo() {
    try {
        const res = await fetch(`${API_URL}/groups/${currentGroupId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (!res.ok) {
            Swal.fire('Lỗi', data.message, 'error');
            window.location.href = 'groupList.html';
            return;
        }

        const group = data.group;
        currentGroupInfo = group;
        const isGroupAdmin = currentUserId && String(currentUserId) === String(group.MaND_QuanTri);
        const isMember = data.isMember || isGroupAdmin;
        window.isCurrentMember = isMember;
        
        const btnEditGroup = document.getElementById('btn-edit-group');
        const btnDeleteGroup = document.getElementById('btn-delete-group');
        const btnShareDoc = document.getElementById('btn-share-doc');
        const btnLeaveGroup = document.getElementById('btn-leave-group');
        const groupDropdownMenu = document.getElementById('group-dropdown-menu');
        const btnJoinGroupDetail = document.getElementById('btn-join-group-detail');
        
        if (btnEditGroup) btnEditGroup.style.display = isGroupAdmin ? 'block' : 'none';
        if (btnDeleteGroup) btnDeleteGroup.style.display = isGroupAdmin ? 'block' : 'none';
        if (btnShareDoc) btnShareDoc.style.display = isMember ? 'inline-flex' : 'none';
        if (btnLeaveGroup) btnLeaveGroup.style.display = isMember ? 'block' : 'none';

        if (groupDropdownMenu) groupDropdownMenu.style.display = isMember ? 'block' : 'none';
        if (btnJoinGroupDetail) btnJoinGroupDetail.style.display = isMember ? 'none' : 'inline-flex';

        document.getElementById('group-header-info').innerHTML = `
            <div class="group-icon-lg"><i class="fa-solid fa-users-rectangle"></i></div>
            <div>
              <h1 class="group-title">${escapeHTML(group.TenNhom)}</h1>
              <div class="group-meta">
                <span class="subject-badge">${escapeHTML(group.TenMonHoc) || 'Chung'}</span>
                <span class="js-user-link" data-user-id="${group.MaND_QuanTri || ''}" title="Xem hồ sơ quản trị viên" style="cursor:pointer;"><i class="fa-solid fa-earth-americas"></i> ${escapeHTML(group.TenNguoiQuanTri)}</span>
              </div>
            </div>
        `;
        document.getElementById('group-desc').textContent = group.MoTa || 'Chưa có mô tả.';
        const adminLink = document.querySelector('#group-header-info .js-user-link');
        if (adminLink && adminLink.dataset.userId) {
            adminLink.addEventListener('click', () => {
                window.location.href = getUserProfileUrl(adminLink.dataset.userId);
            });
        }

        const createDate = new Date(group.NgayTao);
        const formattedCreateDate = `${String(createDate.getDate()).padStart(2, '0')}/${String(createDate.getMonth() + 1).padStart(2, '0')}/${createDate.getFullYear()}`;
        document.getElementById('group-date').innerHTML = `<i class="fa-solid fa-calendar" style="margin-right: 6px;"></i> Ngày tạo: ${formattedCreateDate}`;

    } catch (err) {
        console.error(err);
    }
}

async function fetchGroupMembers() {
    try {
        const res = await fetch(`${API_URL}/groups/${currentGroupId}/members`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const members = data.members || [];
        window.currentGroupMembers = members;
        
        const container = document.getElementById('member-list');
        const memberCount = document.getElementById('member-count');
        const isGroupAdmin = currentGroupInfo && String(currentUserId) === String(currentGroupInfo.MaND_QuanTri);
        if (memberCount) memberCount.textContent = `(${members.length})`;
        container.innerHTML = '';
        
        members.forEach(m => {
            const memberDate = new Date(m.NgayThamGia);
            const dateStr = `${String(memberDate.getDate()).padStart(2, '0')}/${String(memberDate.getMonth() + 1).padStart(2, '0')}/${memberDate.getFullYear()}`;
            const initial = m.HoTen.trim().split(' ').pop().charAt(0).toUpperCase();
            const avatarHtml = m.AvatarURL
                ? `<div class="avatar-sm" style="background:transparent; color:transparent;"><img src="${escapeHTML(getAssetUrl(m.AvatarURL))}" alt="${escapeHTML(m.HoTen)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;"></div>`
                : `<div class="avatar-sm">${escapeHTML(initial)}</div>`;
            
            let roleBadge = '';
            if (m.VaiTroTrongNhom === 'QuanTri') {
                roleBadge = '<span class="role-admin">Quản trị viên</span>';
            } else {
                roleBadge = '<span style="font-size: 11px; color: var(--text-secondary); font-weight: 500;">Thành viên</span>';
            }

            const div = document.createElement('div');
            div.className = 'member-item';
            div.style.cursor = 'pointer';
            div.title = 'Mở tuỳ chọn thành viên';
            div.innerHTML = `
                <div class="member-info">
                  ${avatarHtml}
                  <div>
                    <div class="member-name">${escapeHTML(m.HoTen)}</div>
                    <div class="member-role">Tham gia: ${dateStr}</div>
                  </div>
                </div>
                ${roleBadge}
            `;
            div.addEventListener('click', (e) => {
                if (e.button !== 0) return;
                showMemberContextMenu(e, m);
            });
            div.addEventListener('contextmenu', (event) => {
                showMemberContextMenu(event, m);
            });
            container.appendChild(div);
        });

        if (isGroupAdmin) {
            Array.from(container.children).forEach((item, index) => {
                const member = members[index];
                if (!member || String(member.MaND) === String(currentUserId) || member.VaiTroTrongNhom === 'QuanTri') return;

                item.style.cursor = 'pointer';
                item.title = 'Mở tuỳ chọn thành viên';

                const memberInfo = item.querySelector('.member-info');
                const roleBadge = item.querySelector('.role-admin') || item.lastElementChild;
                const originalName = memberInfo?.querySelector('.member-name')?.textContent || member.HoTen;
                const memberDate = new Date(member.NgayThamGia);
                const originalDate = memberInfo?.querySelector('.member-role')?.textContent || `Tham gia: ${String(memberDate.getDate()).padStart(2, '0')}/${String(memberDate.getMonth() + 1).padStart(2, '0')}/${memberDate.getFullYear()}`;
                const memberInitial = member.HoTen.trim().split(' ').pop().charAt(0).toUpperCase();
                const memberAvatarHtml = member.AvatarURL
                    ? `<div class="avatar-sm" style="background:transparent; color:transparent;"><img src="${escapeHTML(getAssetUrl(member.AvatarURL))}" alt="${escapeHTML(member.HoTen)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;"></div>`
                    : `<div class="avatar-sm">${escapeHTML(memberInitial)}</div>`;

                item.innerHTML = `
                    <div class="member-main" title="Mở tuỳ chọn thành viên">
                        <div class="member-info">
                            ${memberAvatarHtml}
                            <div>
                                <div class="member-name">${escapeHTML(originalName)}</div>
                                <div class="member-role">${escapeHTML(originalDate)}</div>
                            </div>
                        </div>
                        <div class="member-meta">
                            ${roleBadge ? roleBadge.outerHTML : '<span style="font-size: 11px; color: var(--text-secondary); font-weight: 500;">Thành viên</span>'}
                        </div>
                    </div>
                    <button class="btn-kick-member" type="button" title="Đuổi thành viên"><i class="fa-solid fa-user-minus"></i></button>
                `;

                item.querySelector('.member-main').addEventListener('click', (e) => {
                    if (e.button !== 0) return;
                    showMemberContextMenu(e, member);
                });
                item.querySelector('.btn-kick-member').addEventListener('click', (event) => {
                    event.stopPropagation();
                    hideInlineKickActions();
                    openKickMemberModal(member);
                });
            });
        }
    } catch (err) {
        console.error(err);
    }
}

function openKickMemberModal(member) {
    const kickMemberModal = document.getElementById('kickMemberModal');
    const messageEl = document.getElementById('kick-member-message');
    const reasonInput = document.getElementById('kick-member-reason');
    if (!kickMemberModal || !messageEl || !reasonInput) return;

    hideInlineKickActions();
    selectedKickMember = member;
    messageEl.innerHTML = `Bạn sắp đuổi <strong>${escapeHTML(member.HoTen)}</strong> khỏi nhóm. Vui lòng nhập lý do để xác nhận thao tác này.`;
    reasonInput.value = '';
    kickMemberModal.style.display = 'flex';
    setTimeout(() => reasonInput.focus(), 50);
}

function hideInlineKickActions() {
    document.querySelectorAll('.member-item.show-kick-action').forEach((item) => {
        item.classList.remove('show-kick-action');
    });
}

function toggleInlineKickAction(targetItem) {
    const shouldOpen = !targetItem.classList.contains('show-kick-action');
    hideInlineKickActions();
    if (shouldOpen) {
        targetItem.classList.add('show-kick-action');
    }
}

function showMemberContextMenu(event, member) {
    const menu = document.getElementById('memberContextMenu');
    if (!menu) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    hideInlineKickActions();
    contextMenuMember = member;

    const btnContextKickMember = document.getElementById('btn-context-kick-member');
    const canKickMember = currentGroupInfo
        && String(currentUserId) === String(currentGroupInfo.MaND_QuanTri)
        && String(member.MaND) !== String(currentUserId)
        && member.VaiTroTrongNhom !== 'QuanTri';
    if (btnContextKickMember) {
        btnContextKickMember.style.display = canKickMember ? 'inline-flex' : 'none';
    }
    
    menu.style.display = 'block';
    
    const menuWidth = menu.offsetWidth || 150;
    const menuHeight = menu.offsetHeight || 50;
    
    let x = event.clientX;
    let y = event.clientY;
    
    if (x + menuWidth > window.innerWidth) {
        x -= menuWidth;
    }
    if (y + menuHeight > window.innerHeight) {
        y -= menuHeight;
    }
    
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.add('is-open');
}

function hideMemberContextMenu() {
    contextMenuMember = null;
    const memberContextMenu = document.getElementById('memberContextMenu');
    if (memberContextMenu) {
        memberContextMenu.classList.remove('is-open');
        memberContextMenu.style.display = 'none';
    }
    hideInlineKickActions();
}

async function fetchGroupDocuments() {
    try {
        const res = await fetch(`${API_URL}/groups/${currentGroupId}/documents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        window.currentGroupDocs = data.documents || [];
        const docs = window.currentGroupDocs;
        
        const grid = document.getElementById('doc-grid');
        
        if (!window.isCurrentMember) {
            document.getElementById('doc-count').textContent = '';
            grid.innerHTML = '<p style="grid-column: 1/-1; padding: 40px 0; color: var(--text-secondary); text-align: center;"><i class="fa-solid fa-lock fa-3x" style="color: #cbd5e1; margin-bottom:15px; display:block;"></i>Vui lòng tham gia nhóm để xem tài liệu trong nhóm này.</p>';
            return;
        }

        document.getElementById('doc-count').textContent = `${docs.length} tài liệu được chia sẻ`;
        grid.innerHTML = '';

        if (docs.length === 0) {
            grid.innerHTML = '<p>Chưa có tài liệu nào trong nhóm.</p>';
            return;
        }

        docs.forEach(doc => {
            const dateStr = new Date(doc.NgayChiaSe).toLocaleDateString('vi-VN');
            const initial = (doc.TenNguoiDang || 'A').trim().split(' ').pop().charAt(0).toUpperCase();
            
            let iconClass = 'fa-file';
            let thumbClass = 'thumb-docx';
            if (doc.LoaiFile === 'PDF') { iconClass = 'fa-file-pdf'; thumbClass = 'thumb-pdf'; }
            
            const officialBadge = doc.LaTaiLieuChinhThuc ? `<div class="badge-official"><i class="fa-solid fa-check"></i> Tài liệu chính thống</div>` : '';
            const premiumBadge = doc.LaTaiLieuDocQuyen ? `<div class="badge-premium" style="position: absolute; top: 12px; left: 12px; z-index: 10; background: #FEF3C7; color: #B45309; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #FDE68A;"><i class="fa-solid fa-crown" style="color: #F59E0B; margin-right: 4px;"></i> PREMIUM (${doc.GiaXu || 0} Xu)</div>` : '';
            
            const userInitial = doc.TenNguoiDang ? escapeHTML(doc.TenNguoiDang).trim().split(' ').pop().charAt(0).toUpperCase() : '?';
            let avatarHtml = `<div class="avatar-sm">${userInitial}</div>`;
            if (doc.AvatarURL) {
                avatarHtml = `<div class="avatar-sm" style="background:transparent; color:transparent;"><img src="${getAssetUrl(doc.AvatarURL)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;"></div>`;
            }

            let thumbHtml = `<i class="fa-solid ${iconClass}"></i>`;
            let previewTarget = null;
            if (doc.PreviewURL) {
                previewTarget = doc.PreviewURL;
            } else if (doc.LoaiFile && doc.LoaiFile.toLowerCase() === 'pdf' && doc.FileURL) {
                previewTarget = doc.FileURL;
            }

            if (previewTarget) {
                const fileUrlFull = previewTarget.startsWith('http') ? previewTarget : `${API_URL.replace('/api', '')}${previewTarget}`;
                thumbHtml = `<iframe src="${fileUrlFull}#toolbar=0&navpanes=0&scrollbar=0&view=Fit" style="position: absolute; top: 0; left: 0; width: calc(100% + 24px); height: calc(100% + 24px); border: none; pointer-events: none;" scrolling="no" tabindex="-1"></iframe>`;
                thumbClass = '';
            }

            let postDateStr = 'Không rõ';
            if (doc.NgayDang) {
                const dateObj = new Date(doc.NgayDang);
                postDateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
            }

            const isGroupAdmin = currentGroupInfo && String(currentUserId) === String(currentGroupInfo.MaND_QuanTri);
            
            const a = document.createElement('a');
            a.href = `../document/documentDetails.html?id=${doc.MaTL}`;
            a.className = `doc-card ${doc.LaTaiLieuChinhThuc ? 'official' : ''}`;
            if (doc.TrangThaiNhom === 'An') {
                a.style.opacity = '0.65';
                a.style.filter = 'grayscale(50%)';
            }
            
            a.innerHTML = `
                <div class="doc-thumb ${thumbClass}">
                    ${thumbHtml}
                    ${officialBadge}
                    ${premiumBadge}
                    ${doc.TrangThaiNhom === 'An' ? '<div class="badge-official" style="background: var(--warning); top: 10px; right: 10px; left: auto;"><i class="fa-solid fa-eye-slash"></i> Đang ẩn</div>' : ''}
                    <div class="bookmark-btn">
                        ${bookmarkedDocs.has(doc.MaTL) 
                            ? '<i class="fa-solid fa-bookmark" style="color: var(--primary);"></i>' 
                            : '<i class="fa-regular fa-bookmark"></i>'}
                    </div>
                </div>
                <div class="doc-content">
                    <div class="doc-meta" style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="doc-meta-item"><i class="fa-solid fa-folder"></i> ${escapeHTML(doc.TenMonHoc) || 'Không có'}</span>
                        <span class="doc-meta-item" style="font-size: 12px; color: var(--text-secondary);"><i class="fa-solid fa-calendar"></i> ${postDateStr}</span>
                    </div>
                    <h3 class="doc-title">${escapeHTML(doc.TenTL)}</h3>
                    <div class="doc-desc">${escapeHTML(doc.MoTa || 'Không có mô tả')}</div>
                    <div class="doc-footer">
                        <div class="doc-author js-author-link" data-user-id="${doc.MaND_NguoiDang || ''}" title="Xem hồ sơ người đăng">
                            ${avatarHtml}
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; display: inline-block; vertical-align: middle;">${escapeHTML(doc.TenNguoiDang) || 'Ẩn danh'}</span>
                        </div>
                        <div class="doc-stats">
                            <span><i class="fa-solid fa-download" style="color: #6B7280; margin-right: 4px;"></i> ${(doc.SoLuotTai || 0).toLocaleString()}</span>
                            <span><i class="fa-solid fa-star" style="color: #F59E0B; margin-right: 4px;"></i> ${formatRatingSummary(doc.DiemDanhGia, doc.SoDanhGia)}</span>
                            <button class="btn-context-menu" type="button" style="background:transparent; border:none; color:#6B7280; cursor:pointer; padding:4px;"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                        </div>
                    </div>
                </div>
            `;
            
            const bookmarkBtn = a.querySelector('.bookmark-btn');
            bookmarkBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const token = getToken();
                if (!token) return Swal.fire('Vui lòng đăng nhập để lưu tài liệu.');

                try {
                    const res = await fetch(`${API_URL}/documents/${doc.MaTL}/bookmark`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (res.ok) {
                        if (data.isBookmarked) {
                            bookmarkedDocs.add(doc.MaTL);
                            bookmarkBtn.innerHTML = '<i class="fa-solid fa-bookmark" style="color: var(--primary);"></i>';
                            Swal.fire({ title: 'Đã lưu tài liệu', icon: 'success', timer: 1500, showConfirmButton: false });
                        } else {
                            bookmarkedDocs.delete(doc.MaTL);
                            bookmarkBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
                            Swal.fire({ title: 'Đã bỏ lưu', icon: 'info', timer: 1500, showConfirmButton: false });
                        }
                    } else {
                        Swal.fire(data.message);
                    }
                } catch (err) {
                    console.error('Lỗi khi lưu bookmark:', err);
                }
            });

            const authorEl = a.querySelector('.js-author-link');
            if (authorEl && authorEl.dataset.userId) {
                authorEl.style.cursor = 'pointer';
                authorEl.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href = getUserProfileUrl(authorEl.dataset.userId);
                });
            }
            
            const btnContextMenu = a.querySelector('.btn-context-menu');
            const showContext = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showDocContextMenu(e, doc, isGroupAdmin);
            };
            
            if (btnContextMenu) btnContextMenu.addEventListener('click', showContext);
            a.addEventListener('contextmenu', showContext);

            grid.appendChild(a);
        });

    } catch (err) {
        console.error(err);
    }
}

function showDocContextMenu(event, doc, isGroupAdmin) {
    const menu = document.getElementById('docContextMenu');
    if (!menu) return;
    
    hideMemberContextMenu();
    hideDocContextMenu();
    
    currentContextDoc = doc;
    
    const btnToggleStatus = document.getElementById('btn-doc-toggle-status');
    const btnRemove = document.getElementById('btn-doc-remove');
    
    if (isGroupAdmin) {
        btnToggleStatus.style.display = 'block';
        btnToggleStatus.innerHTML = doc.TrangThaiNhom === 'Hien' 
            ? '<i class="fa-solid fa-eye-slash" style="margin-right: 8px;"></i> Ẩn tài liệu'
            : '<i class="fa-solid fa-eye" style="margin-right: 8px;"></i> Hiện tài liệu';
        
        btnRemove.style.display = 'block';
    } else {
        btnToggleStatus.style.display = 'none';
        btnRemove.style.display = 'none';
    }

    menu.style.display = 'block';
    
    const menuWidth = menu.offsetWidth || 150;
    const menuHeight = menu.offsetHeight || 120;
    
    let x = event.clientX;
    let y = event.clientY;
    
    if (x + menuWidth > window.innerWidth) x -= menuWidth;
    if (y + menuHeight > window.innerHeight) y -= menuHeight;
    
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
}

function hideDocContextMenu() {
    currentContextDoc = null;
    const menu = document.getElementById('docContextMenu');
    if (menu) menu.style.display = 'none';
}

document.addEventListener('click', () => {
    hideMemberContextMenu();
    hideDocContextMenu();
});

document.addEventListener('DOMContentLoaded', () => {
    const btnDocView = document.getElementById('btn-doc-view');
    const btnDocToggleStatus = document.getElementById('btn-doc-toggle-status');
    const btnDocRemove = document.getElementById('btn-doc-remove');
    
    if (btnDocView) {
        btnDocView.addEventListener('click', () => {
            if (currentContextDoc) {
                window.location.href = `../document/documentDetails.html?id=${currentContextDoc.MaTL}`;
            }
        });
    }
    
    if (btnDocToggleStatus) {
        btnDocToggleStatus.addEventListener('click', async () => {
            if (!currentContextDoc) return;
            try {
                const res = await fetch(`${API_URL}/groups/${currentGroupId}/documents/${currentContextDoc.MaTL}/toggle-status`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok) {
                    Swal.fire({ icon: 'success', title: 'Thành công', text: data.message, timer: 1500, showConfirmButton: false });
                    fetchGroupDocuments();
                } else {
                    Swal.fire('Lỗi', data.message, 'error');
                }
            } catch (err) {
                console.error(err);
                Swal.fire('Lỗi', 'Đã xảy ra lỗi khi cập nhật trạng thái', 'error');
            }
        });
    }
    
    if (btnDocRemove) {
        btnDocRemove.addEventListener('click', () => {
            if (currentContextDoc) {
                window.openRemoveDocModal(currentContextDoc);
            }
        });
    }
});

async function loadMyDocumentsForShare() {
    try {
        const select = document.getElementById('select-doc-to-share');
        select.innerHTML = '<option value="">Đang tải...</option>';

        
        const res = await fetch(`${API_URL}/users/my-documents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const approvedDocuments = (data.documents || []).filter(doc => doc.TrangThaiKiemDuyet === 'DaDuyet');
        
        select.innerHTML = '<option value="">Chọn tài liệu của bạn</option>';
        if (approvedDocuments.length > 0) {
            let hasUnshared = false;
            approvedDocuments.forEach(doc => {
                let isAlreadyShared = false;
                if (window.currentGroupDocs) {
                    isAlreadyShared = window.currentGroupDocs.some(d => String(d.MaTL) === String(doc.MaTL));
                }
                if (!isAlreadyShared) {
                    hasUnshared = true;
                    select.innerHTML += `<option value="${doc.MaTL}">${doc.TenTL}</option>`;
                }
            });
            if (!hasUnshared) {
                select.innerHTML = '<option value="">Tất cả tài liệu của bạn đã được chia sẻ vào nhóm này.</option>';
            }
        } else {
            select.innerHTML = '<option value="">Chưa có tài liệu đã duyệt.</option>';
        }
    } catch (err) {
        console.error(err);
        document.getElementById('select-doc-to-share').innerHTML = '<option value="">Lỗi tải danh sách.</option>';
    }
}
