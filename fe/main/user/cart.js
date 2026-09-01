import { API_URL } from '../shared/config.js';
import { getToken, getAssetUrl, showToast } from '../shared/utils.js';
import '../shared/sidebar.js'; 

let cartItems = [];
let currentDiscount = 0;
let userBalance = 0;

document.addEventListener('DOMContentLoaded', () => {
    const token = getToken();
    if (!token) {
        window.location.href = '../auth/login.html';
        return;
    }

    fetchCart();
    fetchUserBalance();

    document.getElementById('btn-apply-promo').addEventListener('click', applyPromo);
    document.getElementById('btn-checkout').addEventListener('click', handleCheckout);
});

async function fetchUserBalance() {
    try {
        const res = await fetch(`${API_URL}/users/profile`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.ok) {
            const data = await res.json();
            userBalance = data.SoDuXu || 0;
            document.getElementById('user-balance').textContent = `${userBalance} Xu`;
        }
    } catch (e) {
        console.error('Lỗi tải số dư:', e);
    }
}

async function fetchCart() {
    const listEl = document.getElementById('cart-list');
    listEl.innerHTML = '<div class="loading-spinner"></div>';

    try {
        const res = await fetch(`${API_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        
        if (!res.ok) throw new Error('Không thể tải giỏ hàng');
        
        cartItems = await res.json();
        renderCart();
    } catch (e) {
        console.error(e);
        listEl.innerHTML = '<div class="empty-cart"><i class="fa-solid fa-triangle-exclamation"></i><p>Lỗi khi tải giỏ hàng.</p></div>';
    }
}

function renderCart() {
    const listEl = document.getElementById('cart-list');
    
    if (cartItems.length === 0) {
        listEl.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-cart-arrow-down"></i>
                <p>Giỏ hàng của bạn đang trống</p>
                <a href="../document/searchResults.html" class="btn btn-outline-primary">Khám phá tài liệu ngay</a>
            </div>
        `;
        document.getElementById('btn-checkout').disabled = true;
    } else {
        document.getElementById('btn-checkout').disabled = false;
        let html = '';
        cartItems.forEach(item => {
            const thumbUrl = item.ThumbnailURL ? getAssetUrl(item.ThumbnailURL) : '../../assets/images/doc-placeholder.png';
            html += `
                <div class="cart-item" data-id="${item.MaTL}">
                    <img src="${thumbUrl}" alt="Thumbnail" class="cart-item-img" onerror="this.src='../../assets/images/doc-placeholder.png'">
                    <div class="cart-item-info">
                        <a href="../document/documentDetails.html?id=${item.MaTL}" class="cart-item-title">${item.TenTL}</a>
                        <div class="cart-item-author"><i class="fa-solid fa-user-pen"></i> ${item.TenTacGia}</div>
                        <div class="cart-item-price">${item.GiaXu} Xu</div>
                    </div>
                    <button class="cart-item-remove" onclick="removeCartItem(${item.MaTL})" title="Xóa khỏi giỏ hàng">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
        });
        listEl.innerHTML = html;
    }
    
    updateSummary();
}

window.removeCartItem = async function(maTL) {
    const result = await Swal.fire({
        title: 'Xóa khỏi giỏ hàng?',
        text: 'Bạn có chắc muốn xóa tài liệu này khỏi giỏ hàng?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy'
    });

    if (result.isConfirmed) {
        try {
            const res = await fetch(`${API_URL}/cart/remove/${maTL}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (res.ok) {
                cartItems = cartItems.filter(item => item.MaTL !== maTL);
                renderCart();
                if (typeof window.refreshSidebarBadges === 'function') {
                    window.refreshSidebarBadges();
                }
                showToast('success', 'Đã xóa tài liệu khỏi giỏ hàng');
            } else {
                showToast('error', 'Không thể xóa tài liệu');
            }
        } catch (e) {
            console.error(e);
            showToast('error', 'Lỗi máy chủ');
        }
    }
};

function updateSummary() {
    const count = cartItems.length;
    const subtotal = cartItems.reduce((sum, item) => sum + (item.GiaXu || 0), 0);
    
    document.getElementById('summary-count').textContent = count;
    document.getElementById('summary-subtotal').textContent = `${subtotal} Xu`;
    
    const discountAmount = Math.floor(subtotal * (currentDiscount / 100));
    const finalTotal = subtotal - discountAmount;
    
    if (currentDiscount > 0) {
        document.getElementById('discount-row').style.display = 'flex';
        document.getElementById('summary-discount').textContent = `-${discountAmount} Xu (${currentDiscount}%)`;
    } else {
        document.getElementById('discount-row').style.display = 'none';
    }
    
    document.getElementById('summary-total').textContent = `${finalTotal} Xu`;
    
    const btnCheckout = document.getElementById('btn-checkout');
    if (userBalance < finalTotal) {
        btnCheckout.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right: 8px;"></i> Không đủ số dư';
        btnCheckout.style.backgroundColor = 'var(--danger)';
        btnCheckout.style.borderColor = 'var(--danger)';
    } else {
        btnCheckout.innerHTML = 'Thanh toán ngay';
        btnCheckout.style.backgroundColor = '';
        btnCheckout.style.borderColor = '';
    }
}

async function applyPromo() {
    const promoCode = document.getElementById('promo-input').value.trim();
    if (!promoCode) {
        currentDiscount = 0;
        updateSummary();
        return;
    }

    try {
        const res = await fetch(`${API_URL}/cart/promo/validate?code=${promoCode}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            currentDiscount = data.DiscountPercent || 0;
            showToast('success', `Áp dụng mã giảm ${currentDiscount}% thành công`);
            updateSummary();
        } else {
            const err = await res.json();
            showToast('error', err.message || 'Mã không hợp lệ');
            currentDiscount = 0;
            updateSummary();
        }
    } catch (e) {
        console.error(e);
        showToast('error', 'Lỗi kiểm tra mã');
    }
}

async function handleCheckout() {
    if (cartItems.length === 0) return;

    const promoCode = document.getElementById('promo-input').value.trim();
    const count = cartItems.length;
    
    const result = await Swal.fire({
        title: 'Xác nhận thanh toán',
        text: `Thanh toán giỏ hàng gồm ${count} tài liệu?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Thanh toán',
        cancelButtonText: 'Hủy'
    });

    if (result.isConfirmed) {
        Swal.showLoading();
        try {
            const idempotencyKey = window.generateIdempotencyKey();
            const res = await fetch(`${API_URL}/cart/checkout`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': idempotencyKey
                },
                body: JSON.stringify({ promoCode })
            });
            
            const data = await res.json();
            if (res.ok) {
                await Swal.fire('Thành công!', `Thanh toán thành công. Đã trừ ${data.totalPaid} Xu.`, 'success');
                if (typeof window.refreshSidebarBadges === 'function') {
                    window.refreshSidebarBadges();
                }
                window.location.href = '../document/myDocuments.html?tab=purchased';
            } else {
                Swal.fire('Thất bại', data.message || 'Thanh toán thất bại', 'error');
                if (data.message.includes('Mã khuyến mãi')) {
                    currentDiscount = 0;
                    updateSummary();
                }
            }
        } catch (e) {
            console.error(e);
            Swal.fire('Lỗi', 'Không thể kết nối đến máy chủ', 'error');
        }
    }
}
