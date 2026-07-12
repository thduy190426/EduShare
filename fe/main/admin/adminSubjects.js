import { API_URL } from '../shared/config.js';
import { getToken, showToast } from '../shared/utils.js';


const token = getToken();

window.openAddSubjectModal = () => {
    const modal = document.getElementById('addSubjectModal');
    modal.classList.remove('closing');
    modal.querySelector('.modal-container').classList.remove('closing');
    modal.style.display = 'flex';
    validateAddSubjectForm();
};

window.closeAddSubjectModal = () => {
    const modal = document.getElementById('addSubjectModal');
    modal.classList.add('closing');
    modal.querySelector('.modal-container').classList.add('closing');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('closing');
        modal.querySelector('.modal-container').classList.remove('closing');
    }, 200);
};

function validateAddSubjectForm() {
    const nameInput = document.getElementById('input-subject-name');
    const confirmBtn = document.getElementById('btn-add-subject-confirm');
    if (nameInput && confirmBtn) {
        if (nameInput.value.trim() !== '') {
            confirmBtn.disabled = false;
        } else {
            confirmBtn.disabled = true;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        Swal.fire('Vui lòng đăng nhập.');
        window.location.href = '../guest/guestHome.html';
        return;
    }

    const nameInput = document.getElementById('input-subject-name');
    const levelInput = document.getElementById('input-subject-level');
    const descInput = document.getElementById('input-subject-desc');
    
    if (nameInput) nameInput.addEventListener('input', validateAddSubjectForm);
    if (levelInput) levelInput.addEventListener('input', validateAddSubjectForm);
    if (descInput) descInput.addEventListener('input', validateAddSubjectForm);
    
    const editNameInput = document.getElementById('edit-subject-name');
    const editLevelInput = document.getElementById('edit-subject-level');
    const editDescInput = document.getElementById('edit-subject-desc');
    
    if (editNameInput) editNameInput.addEventListener('input', window.validateEditSubjectForm);
    if (editLevelInput) editLevelInput.addEventListener('input', window.validateEditSubjectForm);
    if (editDescInput) editDescInput.addEventListener('input', window.validateEditSubjectForm);

    fetchSubjects();
});

async function fetchSubjects() {
    try {
        const res = await fetch(`${API_URL}/admin/subjects`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 403) {
            Swal.fire('Bạn không có quyền truy cập trang này.');
            window.location.href = '../guest/guestHome.html';
            return;
        }

        const data = await res.json();
        window.subjectsData = data.subjects;
        renderSubjects(data.subjects);
    } catch (err) {
        console.error(err);
    }
}

function renderSubjects(subjects) {
    const tbody = document.getElementById('subject-table-body');
    tbody.innerHTML = '';

    if (subjects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Không có môn học nào.</td></tr>';
        return;
    }

    subjects.forEach(sub => {
        const tr = document.createElement('tr');
        
        const dateObj = new Date(sub.NgayCapNhat || sub.NgayTao || new Date());
        const dateStr = dateObj.toLocaleString('vi-VN');

        tr.innerHTML = `
            <td style="font-weight: 600;">${sub.TenMonHoc}</td>
            <td><span style="background: #F3F4F6; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${sub.CapHoc || 'Khác'}</span></td>
            <td><div style="max-height: 40px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 13px; color: #6B7280;">${sub.MoTa || 'Không có mô tả'}</div></td>
            <td><span style="background: #E0E7FF; color: #4338CA; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 12px;">${sub.SoTaiLieu || 0} tài liệu</span></td>
            <td><span style="font-size: 13px; color: #6B7280;">${dateStr}</span></td>
            <td>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button class="btn-action" style="background: #EEF2FF; color: #4F46E5; width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;" onclick="updateSubject(${sub.MaMonHoc})" title="Sửa">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-action" style="background: #FEF2F2; color: #EF4444; width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;" onclick="deleteSubject(${sub.MaMonHoc})" title="Xóa">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

window.addSubject = async () => {
    const nameInput = document.getElementById('input-subject-name');
    const levelInput = document.getElementById('input-subject-level');
    const descInput = document.getElementById('input-subject-desc');
    
    const tenMonHoc = nameInput.value.trim();
    const capHoc = levelInput.value.trim();
    const moTa = descInput.value.trim();

    if (!tenMonHoc) {
        Swal.fire('Vui lòng nhập tên môn học.');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/subjects`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tenMonHoc, capHoc, moTa })
        });
        
        if (res.ok) {
            showToast('success', 'Thêm môn học thành công!');
            nameInput.value = '';
            levelInput.value = '';
            descInput.value = '';
            fetchSubjects();
            window.closeAddSubjectModal();
        } else {
            const data = await res.json();
            showToast('error', data.message);
        }
    } catch (err) {
        console.error(err);
    }
};

let currentEditSubjectId = null;
let currentEditSubjectData = null;

window.updateSubject = (id) => {
    const sub = window.subjectsData.find(s => s.MaMonHoc === id);
    if (!sub) return;

    currentEditSubjectId = id;
    currentEditSubjectData = sub;

    document.getElementById('edit-subject-name').value = sub.TenMonHoc;
    document.getElementById('edit-subject-level').value = sub.CapHoc || '';
    document.getElementById('edit-subject-desc').value = sub.MoTa || '';

    const modal = document.getElementById('editSubjectModal');
    modal.classList.remove('closing');
    modal.querySelector('.modal-container').classList.remove('closing');
    modal.style.display = 'flex';
    
    window.validateEditSubjectForm();
};

window.closeEditSubjectModal = () => {
    const modal = document.getElementById('editSubjectModal');
    modal.classList.add('closing');
    modal.querySelector('.modal-container').classList.add('closing');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('closing');
        modal.querySelector('.modal-container').classList.remove('closing');
        currentEditSubjectId = null;
        currentEditSubjectData = null;
    }, 200);
};

window.validateEditSubjectForm = () => {
    if (!currentEditSubjectData) return;
    const nameInput = document.getElementById('edit-subject-name');
    const levelInput = document.getElementById('edit-subject-level');
    const descInput = document.getElementById('edit-subject-desc');
    const confirmBtn = document.getElementById('btn-edit-subject-confirm');

    if (nameInput && confirmBtn) {
        const nameVal = nameInput.value.trim();
        const levelVal = levelInput.value.trim();
        const descVal = descInput.value.trim();
        
        const hasChanged = nameVal !== currentEditSubjectData.TenMonHoc || 
                           levelVal !== (currentEditSubjectData.CapHoc || '') ||
                           descVal !== (currentEditSubjectData.MoTa || '');

        if (nameVal !== '' && hasChanged) {
            confirmBtn.disabled = false;
        } else {
            confirmBtn.disabled = true;
        }
    }
};

window.submitEditSubject = async () => {
    if (!currentEditSubjectId) return;
    
    const nameInput = document.getElementById('edit-subject-name');
    const levelInput = document.getElementById('edit-subject-level');
    const descInput = document.getElementById('edit-subject-desc');

    const tenMonHoc = nameInput.value.trim();
    const capHoc = levelInput.value.trim();
    const moTa = descInput.value.trim();

    if (!tenMonHoc) {
        showToast('error', 'Tên môn học không được để trống.');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/subjects/${currentEditSubjectId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tenMonHoc, capHoc, moTa })
        });
        
        if (res.ok) {
            showToast('success', 'Cập nhật môn học thành công!');
            fetchSubjects();
            window.closeEditSubjectModal();
        } else {
            const data = await res.json();
            showToast('error', data.message);
        }
    } catch (err) {
        console.error(err);
    }
};

window.deleteSubject = async (id) => {
    if (!(await Swal.fire({ title: 'Xác nhận xóa vĩnh viễn', text: 'Bạn có chắc chắn muốn xóa cứng môn học này không? Các tài liệu liên quan có thể bị ảnh hưởng và hành động này không thể hoàn tác.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Xóa vĩnh viễn', cancelButtonText: 'Hủy', confirmButtonColor: '#d33' })).isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/admin/subjects/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (res.ok) {
            showToast('success', 'Đã xóa môn học!');
            fetchSubjects();
        } else {
            const data = await res.json();
            showToast('error', data.message);
        }
    } catch (err) {
        console.error(err);
    }
};

