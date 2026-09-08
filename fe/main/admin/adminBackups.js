import { API_URL } from '../shared/config.js';
import { getToken } from '../shared/utils.js';
import { makeAdminTablesResizableAndSticky } from './adminTableUtils.js';

let initialSettings = {};

document.addEventListener('DOMContentLoaded', () => {
    loadBackups();
    loadSettings();

    document.getElementById('btnCreateBackup').addEventListener('click', createBackup);
    document.getElementById('autoBackupForm').addEventListener('submit', saveSettings);

    const inputs = ['AUTO_BACKUP_ENABLED', 'AUTO_BACKUP_SCHEDULE', 'MAX_BACKUPS_RETAIN'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('change', checkChanges);
        document.getElementById(id).addEventListener('input', checkChanges);
    });
    document.getElementById('btnSaveConfig').disabled = true;
});

function checkChanges() {
    const currentEnabled = document.getElementById('AUTO_BACKUP_ENABLED').value;
    const currentSchedule = document.getElementById('AUTO_BACKUP_SCHEDULE').value;
    const currentMaxRetain = document.getElementById('MAX_BACKUPS_RETAIN').value;

    const isChanged = 
        currentEnabled != initialSettings.AUTO_BACKUP_ENABLED ||
        currentSchedule != initialSettings.AUTO_BACKUP_SCHEDULE ||
        currentMaxRetain != initialSettings.MAX_BACKUPS_RETAIN;

    document.getElementById('btnSaveConfig').disabled = !isChanged;
}

async function loadBackups() {
    const tbody = document.getElementById('backupsTableBody');
    const token = getToken();
    try {
        const response = await fetch(`${API_URL}/admin/backups`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to load backups');
        const data = await response.json();
        
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Chưa có bản sao lưu nào.</td></tr>';
            return;
        }

        data.forEach(backup => {
            const dateObj = new Date(backup.createdAt);
            const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour12: false });
            const dateStr = dateObj.toLocaleDateString('vi-VN');
            const date = `${timeStr} | ${dateStr}`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><i class="fa-solid fa-file-sql text-blue-500 mr-2"></i> ${backup.filename}</td>
                <td>${backup.size}</td>
                <td>${date}</td>
                <td>
                    <button class="btn-delete" onclick="deleteBackup('${backup.filename}')" title="Xóa">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        makeAdminTablesResizableAndSticky();
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Lỗi khi tải danh sách sao lưu.</td></tr>';
        console.error(error);
    }
}

async function createBackup() {
    const btn = document.getElementById('btnCreateBackup');
    const token = getToken();
    
    try {
        const result = await Swal.fire({
            title: 'Tạo bản sao lưu?',
            text: "Hệ thống sẽ tạo bản sao lưu toàn bộ cơ sở dữ liệu ngay bây giờ.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Tạo ngay',
            cancelButtonText: 'Hủy'
        });

        if (result.isConfirmed) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo...';
            
            const response = await fetch(`${API_URL}/admin/backups/create`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            if (!response.ok) throw new Error(data.message || 'Lỗi');
            
            Swal.fire('Thành công!', 'Bản sao lưu đã được tạo.', 'success');
            loadBackups();
        }
    } catch (error) {
        Swal.fire('Lỗi!', error.message || 'Không thể tạo bản sao lưu', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-download"></i> Tạo bản sao lưu (1-Click)';
    }
}

window.deleteBackup = async function(filename) {
    const token = getToken();
    try {
        const result = await Swal.fire({
            title: 'Bạn có chắc chắn?',
            text: `Xóa bản sao lưu "${filename}"? Hành động này không thể hoàn tác!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Xóa ngay'
        });

        if (result.isConfirmed) {
            const response = await fetch(`${API_URL}/admin/backups/${filename}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Lỗi');
            
            Swal.fire('Đã xóa!', 'Bản sao lưu đã bị xóa.', 'success');
            loadBackups();
        }
    } catch (error) {
        Swal.fire('Lỗi!', error.message || 'Không thể xóa file.', 'error');
    }
};

async function loadSettings() {
    const token = getToken();
    try {
        const response = await fetch(`${API_URL}/admin/backups/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return;
        const settings = await response.json();
        
        initialSettings = {
            AUTO_BACKUP_ENABLED: settings.AUTO_BACKUP_ENABLED,
            AUTO_BACKUP_SCHEDULE: settings.AUTO_BACKUP_SCHEDULE,
            MAX_BACKUPS_RETAIN: settings.MAX_BACKUPS_RETAIN
        };
        
        document.getElementById('AUTO_BACKUP_ENABLED').value = settings.AUTO_BACKUP_ENABLED;
        document.getElementById('AUTO_BACKUP_SCHEDULE').value = settings.AUTO_BACKUP_SCHEDULE;
        document.getElementById('MAX_BACKUPS_RETAIN').value = settings.MAX_BACKUPS_RETAIN;
        checkChanges();
    } catch (error) {
        console.error('Lỗi khi tải cài đặt:', error);
    }
}

async function saveSettings(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveConfig');
    const token = getToken();
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
        
        const enabled = document.getElementById('AUTO_BACKUP_ENABLED').value;
        const schedule = document.getElementById('AUTO_BACKUP_SCHEDULE').value;
        const maxRetain = document.getElementById('MAX_BACKUPS_RETAIN').value;
        
        const response = await fetch(`${API_URL}/admin/backups/settings`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                AUTO_BACKUP_ENABLED: parseInt(enabled),
                AUTO_BACKUP_SCHEDULE: schedule,
                MAX_BACKUPS_RETAIN: parseInt(maxRetain)
            })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Lỗi');
        
        initialSettings = {
            AUTO_BACKUP_ENABLED: parseInt(enabled),
            AUTO_BACKUP_SCHEDULE: schedule,
            MAX_BACKUPS_RETAIN: parseInt(maxRetain)
        };
        
        Swal.fire('Thành công', 'Đã lưu cài đặt tự động sao lưu!', 'success');
        checkChanges();
    } catch (error) {
        Swal.fire('Lỗi', error.message || 'Lưu cài đặt thất bại', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-save"></i> Lưu cài đặt';
    }
}
