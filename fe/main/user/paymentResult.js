// fe/main/user/paymentResult.js
document.addEventListener('DOMContentLoaded', () => {
    // Trích xuất các tham số query URL (Ví dụ từ VNPAY)
    const urlParams = new URLSearchParams(window.location.search);
    
    // Các param cơ bản của VNPAY
    const amountStr = urlParams.get('vnp_Amount');
    const orderInfo = urlParams.get('vnp_OrderInfo') || urlParams.get('orderId') || 'GD_' + Math.floor(Math.random() * 100000000);
    const bankCode = urlParams.get('vnp_BankCode') || 'N/A';
    
    // Ánh xạ vào giao diện nếu các thẻ tồn tại
    const amountEl = document.getElementById('txAmount');
    const orderInfoEl = document.getElementById('txOrderInfo');
    const bankCodeEl = document.getElementById('txBankCode');
    const dateEl = document.getElementById('txDate');

    if (amountEl && amountStr) {
        // VNPAY gửi số tiền được nhân lên 100 lần
        const amount = parseInt(amountStr, 10) / 100;
        amountEl.textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    }

    if (orderInfoEl) {
        orderInfoEl.textContent = orderInfo;
    }

    if (bankCodeEl) {
        bankCodeEl.textContent = bankCode;
    }

    if (dateEl) {
        const now = new Date();
        const options = { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' };
        dateEl.textContent = now.toLocaleDateString('vi-VN', options);
    }
});
