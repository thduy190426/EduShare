import { API_URL } from '../shared/config.js';
import { getToken, decodeJWT, renderPagination } from '../shared/utils.js';
import { makeAdminTablesResizableAndSticky } from '../admin/adminTableUtils.js';
import '../shared/sidebar.js';

document.addEventListener('DOMContentLoaded', () => {
    const token = getToken();
    if (!token) {
        window.location.href = '../auth/login.html';
        return;
    }

    const decoded = decodeJWT(token);
    if (!decoded || !decoded.VaiTro || decoded.VaiTro !== 'Admin') {
        window.location.href = '../guest/guestHome.html';
        return;
    }

    const tabItems = document.querySelectorAll('.tab-item');
    const tabContents = document.querySelectorAll('.tab-content');
    tabItems.forEach(item => {
        item.addEventListener('click', () => {
            tabItems.forEach(t => {
                t.classList.remove('active');
                t.style.borderBottom = 'none';
                t.style.color = 'var(--text-secondary)';
                t.style.fontWeight = '500';
            });
            tabContents.forEach(c => c.style.display = 'none');
            
            item.classList.add('active');
            item.style.borderBottom = '2px solid var(--primary)';
            item.style.color = 'var(--primary)';
            item.style.fontWeight = '600';
            const target = item.getAttribute('data-tab');
            document.getElementById(`tab-${target}`).style.display = 'block';
            
            setTimeout(makeAdminTablesResizableAndSticky, 100);
        });
    });

    const colorPicker = document.getElementById('badge-color-picker');
    const colorInput = document.getElementById('badge-color');
    colorPicker.addEventListener('input', (e) => colorInput.value = e.target.value.toUpperCase());
    colorInput.addEventListener('input', (e) => colorPicker.value = e.target.value);

    let allQuests = [];
    let questsPage = 1;
    const itemsPerPage = 10;
    let allBadges = [];
    let badgesPage = 1;

    fetchQuests();
    fetchBadges();

    const questModal = document.getElementById('quest-modal');
    let currentEditingQuest = null;
    const btnSaveQuest = document.getElementById('btn-save-quest');
    const questFormInputs = document.querySelectorAll('#quest-form input, #quest-form select, #quest-form textarea');
    
    function validateQuestForm() {
        const name = document.getElementById('quest-name').value.trim();
        const type = document.getElementById('quest-type').value;
        const target = document.getElementById('quest-target').value;
        const reward = document.getElementById('quest-reward').value;
        const freq = document.getElementById('quest-frequency').value;
        const status = document.getElementById('quest-status').value;
        const desc = document.getElementById('quest-desc').value.trim();

        const isValid = name !== '' && type !== '' && target !== '' && reward !== '';
        let isChanged = false;

        if (currentEditingQuest) {
            isChanged = name !== currentEditingQuest.TenNV ||
                        type !== currentEditingQuest.LoaiNV ||
                        parseInt(target) !== currentEditingQuest.MucTieu ||
                        parseInt(reward) !== currentEditingQuest.ThuongXu ||
                        freq !== currentEditingQuest.TanSuat ||
                        status !== currentEditingQuest.TrangThai ||
                        desc !== (currentEditingQuest.MoTa || '');
        } else {
            isChanged = name !== ''; 
        }

        if (isValid && isChanged) {
            btnSaveQuest.disabled = false;
            btnSaveQuest.style.opacity = '1';
            btnSaveQuest.style.cursor = 'pointer';
        } else {
            btnSaveQuest.disabled = true;
            btnSaveQuest.style.opacity = '0.5';
            btnSaveQuest.style.cursor = 'not-allowed';
        }
    }

    questFormInputs.forEach(input => {
        input.addEventListener('input', validateQuestForm);
        input.addEventListener('change', validateQuestForm);
    });

    async function fetchQuests() {
        try {
            const res = await fetch(`${API_URL}/admin/quests`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            allQuests = await res.json();
            renderQuests();
        } catch (error) {
            console.error(error);
        }
    }

    function renderQuests() {
        const tbody = document.getElementById('quests-tbody');
        const totalPages = Math.ceil(allQuests.length / itemsPerPage) || 1;
        if (questsPage > totalPages) questsPage = totalPages;

        const data = allQuests.slice((questsPage - 1) * itemsPerPage, questsPage * itemsPerPage);
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Chưa có nhiệm vụ nào.</td></tr>';
            document.getElementById('quests-pagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(quest => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 12px 16px;"><strong>${quest.TenNV}</strong></td>
                <td style="padding: 12px 16px;">${quest.LoaiNV}</td>
                <td style="padding: 12px 16px;">${quest.MucTieu}</td>
                <td style="padding: 12px 16px; color: #D97706; font-weight: 600;">+${quest.ThuongXu} <i class="fa-solid fa-coins"></i></td>
                <td style="padding: 12px 16px;">${quest.TanSuat === 'HangNgay' ? 'Hàng ngày' : quest.TanSuat === 'HangTuan' ? 'Hàng tuần' : 'Một lần'}</td>
                <td style="padding: 12px 16px;">
                    <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background: ${quest.TrangThai === 'HoatDong' ? '#DCFCE7' : '#F3F4F6'}; color: ${quest.TrangThai === 'HoatDong' ? '#166534' : '#4B5563'};">
                        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${quest.TrangThai === 'HoatDong' ? '#10B981' : '#F59E0B'};"></span>
                        ${quest.TrangThai === 'HoatDong' ? 'Hoạt động' : 'Tạm ẩn'}
                    </span>
                </td>
                <td style="padding: 12px 16px;">
                    <button class="btn-edit-quest" data-quest='${JSON.stringify(quest)}' style="background: none; border: none; color: var(--primary); cursor: pointer; margin-right: 10px;" title="Sửa"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-delete-quest" data-id="${quest.MaNV}" style="background: none; border: none; color: var(--danger); cursor: pointer;" title="Xóa"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-edit-quest').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const quest = JSON.parse(e.currentTarget.getAttribute('data-quest'));
                openQuestModal(quest);
            });
        });

        document.querySelectorAll('.btn-delete-quest').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const result = await Swal.fire({
                    title: 'Xóa nhiệm vụ?',
                    text: "Bạn không thể hoàn tác hành động này!",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Xóa',
                    cancelButtonText: 'Hủy',
                    scrollbarPadding: false
                });
                if (result.isConfirmed) {
                    try {
                        const res = await fetch(`${API_URL}/admin/quests/${id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) {
                            Swal.fire({ title: 'Thành công', text: 'Đã xóa nhiệm vụ.', icon: 'success', scrollbarPadding: false });
                            fetchQuests();
                        } else {
                            const errData = await res.json();
                            Swal.fire({ title: 'Lỗi', text: errData.message, icon: 'error', scrollbarPadding: false });
                        }
                    } catch (err) {
                        Swal.fire({ title: 'Lỗi', text: 'Lỗi kết nối mạng.', icon: 'error', scrollbarPadding: false });
                    }
                }
            });
        });

        renderPagination('quests-pagination', totalPages, questsPage, (newPage) => {
            questsPage = newPage;
            renderQuests();
        });

        setTimeout(makeAdminTablesResizableAndSticky, 100);
    }

    const closeQuestModal = () => {
        questModal.classList.add('closing');
        setTimeout(() => {
            questModal.style.display = 'none';
            questModal.classList.remove('closing');
        }, 250);
    };

    document.getElementById('btn-add-quest').addEventListener('click', () => openQuestModal());
    document.getElementById('btn-close-quest-modal').addEventListener('click', closeQuestModal);
    document.getElementById('btn-cancel-quest').addEventListener('click', closeQuestModal);

    function openQuestModal(quest = null) {
        document.getElementById('quest-form').reset();
        currentEditingQuest = quest;
        if (quest) {
            document.getElementById('quest-modal-title').textContent = 'Sửa Nhiệm vụ';
            document.getElementById('quest-id').value = quest.MaNV;
            document.getElementById('quest-name').value = quest.TenNV;
            document.getElementById('quest-type').value = quest.LoaiNV;
            document.getElementById('quest-target').value = quest.MucTieu;
            document.getElementById('quest-reward').value = quest.ThuongXu;
            document.getElementById('quest-frequency').value = quest.TanSuat;
            document.getElementById('quest-status').value = quest.TrangThai;
            document.getElementById('quest-desc').value = quest.MoTa;
        } else {
            document.getElementById('quest-modal-title').textContent = 'Thêm Nhiệm vụ';
            document.getElementById('quest-id').value = '';
        }
        validateQuestForm();
        questModal.style.display = 'flex';
    }

    document.getElementById('quest-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (btnSaveQuest.disabled) return;

        const id = document.getElementById('quest-id').value;
        const body = {
            TenNV: document.getElementById('quest-name').value.trim(),
            LoaiNV: document.getElementById('quest-type').value,
            MucTieu: parseInt(document.getElementById('quest-target').value),
            ThuongXu: parseInt(document.getElementById('quest-reward').value),
            TanSuat: document.getElementById('quest-frequency').value,
            TrangThai: document.getElementById('quest-status').value,
            MoTa: document.getElementById('quest-desc').value.trim()
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/admin/quests/${id}` : `${API_URL}/admin/quests`;

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (res.ok) {
                Swal.fire({ title: 'Thành công', text: data.message, icon: 'success', scrollbarPadding: false });
                closeQuestModal();
                fetchQuests();
            } else {
                Swal.fire({ title: 'Lỗi', text: data.message, icon: 'error', scrollbarPadding: false });
            }
        } catch (err) {
            Swal.fire({ title: 'Lỗi', text: 'Lỗi kết nối mạng.', icon: 'error', scrollbarPadding: false });
        }
    });

    const badgeModal = document.getElementById('badge-modal');
    const btnSaveBadge = document.getElementById('btn-save-badge');
    const badgeFormInputs = document.querySelectorAll('#badge-form input, #badge-form textarea');
    let currentEditingBadge = null;

    function validateBadgeForm() {
        const name = document.getElementById('badge-name').value.trim();
        const icon = document.getElementById('badge-icon').value.trim();
        const color = document.getElementById('badge-color').value.trim();
        const desc = document.getElementById('badge-desc').value.trim();

        const isValid = name !== '' && icon !== '' && color !== '';
        let isChanged = false;

        if (currentEditingBadge) {
            isChanged = name !== currentEditingBadge.TenDanhHieu ||
                        icon !== currentEditingBadge.IconClass ||
                        color !== currentEditingBadge.MauSac ||
                        desc !== (currentEditingBadge.MoTa || '');
        } else {
            isChanged = name !== '' || icon !== '';
        }

        if (isValid && isChanged) {
            btnSaveBadge.disabled = false;
            btnSaveBadge.style.opacity = '1';
            btnSaveBadge.style.cursor = 'pointer';
        } else {
            btnSaveBadge.disabled = true;
            btnSaveBadge.style.opacity = '0.5';
            btnSaveBadge.style.cursor = 'not-allowed';
        }
    }

    badgeFormInputs.forEach(input => {
        input.addEventListener('input', validateBadgeForm);
        input.addEventListener('change', validateBadgeForm);
    });

    async function fetchBadges() {
        try {
            const res = await fetch(`${API_URL}/admin/badges`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            allBadges = await res.json();
            renderBadges();
        } catch (error) {
            console.error(error);
        }
    }

    function renderBadges() {
        const tbody = document.getElementById('badges-tbody');
        const totalPages = Math.ceil(allBadges.length / itemsPerPage) || 1;
        if (badgesPage > totalPages) badgesPage = totalPages;

        const data = allBadges.slice((badgesPage - 1) * itemsPerPage, badgesPage * itemsPerPage);

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Chưa có danh hiệu nào.</td></tr>';
            document.getElementById('badges-pagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(badge => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 12px 16px; font-size: 24px; color: ${badge.MauSac};"><i class="${badge.IconClass}"></i></td>
                <td style="padding: 12px 16px;"><strong>${badge.TenDanhHieu}</strong></td>
                <td style="padding: 12px 16px;"><span style="background: ${badge.MauSac}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${badge.MauSac}</span></td>
                <td style="padding: 12px 16px;">${badge.MoTa}</td>
                <td style="padding: 12px 16px;">
                    <button class="btn-edit-badge" data-badge='${JSON.stringify(badge).replace(/'/g, "&#39;")}' style="background: none; border: none; color: var(--primary); cursor: pointer; margin-right: 10px;" title="Sửa"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-delete-badge" data-id="${badge.MaDanhHieu}" style="background: none; border: none; color: var(--danger); cursor: pointer;" title="Xóa"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-edit-badge').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const badge = JSON.parse(e.currentTarget.getAttribute('data-badge'));
                openBadgeModal(badge);
            });
        });

        document.querySelectorAll('.btn-delete-badge').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const result = await Swal.fire({
                    title: 'Xóa danh hiệu?',
                    text: "Bạn không thể hoàn tác hành động này!",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Xóa',
                    cancelButtonText: 'Hủy',
                    scrollbarPadding: false
                });
                if (result.isConfirmed) {
                    try {
                        const res = await fetch(`${API_URL}/admin/badges/${id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) {
                            Swal.fire({ title: 'Thành công', text: 'Đã xóa danh hiệu.', icon: 'success', scrollbarPadding: false });
                            fetchBadges();
                        } else {
                            const errData = await res.json();
                            Swal.fire({ title: 'Lỗi', text: errData.message, icon: 'error', scrollbarPadding: false });
                        }
                    } catch (err) {
                        Swal.fire({ title: 'Lỗi', text: 'Lỗi kết nối mạng.', icon: 'error', scrollbarPadding: false });
                    }
                }
            });
        });

        renderPagination('badges-pagination', totalPages, badgesPage, (newPage) => {
            badgesPage = newPage;
            renderBadges();
        });

        setTimeout(makeAdminTablesResizableAndSticky, 100);
    }

    const closeBadgeModal = () => {
        badgeModal.classList.add('closing');
        setTimeout(() => {
            badgeModal.style.display = 'none';
            badgeModal.classList.remove('closing');
        }, 250);
    };

    document.getElementById('btn-add-badge').addEventListener('click', () => openBadgeModal());
    document.getElementById('btn-close-badge-modal').addEventListener('click', closeBadgeModal);
    document.getElementById('btn-cancel-badge').addEventListener('click', closeBadgeModal);

    function openBadgeModal(badge = null) {
        document.getElementById('badge-form').reset();
        currentEditingBadge = badge;
        if (badge) {
            document.getElementById('badge-modal-title').textContent = 'Sửa Danh hiệu';
            document.getElementById('badge-id').value = badge.MaDanhHieu;
            document.getElementById('badge-name').value = badge.TenDanhHieu;
            document.getElementById('badge-icon').value = badge.IconClass;
            document.getElementById('badge-color').value = badge.MauSac;
            document.getElementById('badge-color-picker').value = badge.MauSac;
            document.getElementById('badge-desc').value = badge.MoTa;
        } else {
            document.getElementById('badge-modal-title').textContent = 'Thêm Danh hiệu';
            document.getElementById('badge-id').value = '';
            document.getElementById('badge-color').value = '#F59E0B';
            document.getElementById('badge-color-picker').value = '#F59E0B';
        }
        validateBadgeForm();
        badgeModal.style.display = 'flex';
    }

    document.getElementById('badge-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (btnSaveBadge.disabled) return;
        
        const id = document.getElementById('badge-id').value;
        const body = {
            TenDanhHieu: document.getElementById('badge-name').value.trim(),
            IconClass: document.getElementById('badge-icon').value.trim(),
            MauSac: document.getElementById('badge-color').value.trim(),
            MoTa: document.getElementById('badge-desc').value.trim()
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/admin/badges/${id}` : `${API_URL}/admin/badges`;

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (res.ok) {
                Swal.fire({ title: 'Thành công', text: data.message, icon: 'success', scrollbarPadding: false });
                closeBadgeModal();
                fetchBadges();
            } else {
                Swal.fire({ title: 'Lỗi', text: data.message, icon: 'error', scrollbarPadding: false });
            }
        } catch (err) {
            Swal.fire({ title: 'Lỗi', text: 'Lỗi kết nối mạng.', icon: 'error', scrollbarPadding: false });
        }
    });

});
