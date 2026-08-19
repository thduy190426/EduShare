import { renderBreadcrumb } from '../shared/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    renderBreadcrumb([{ name: 'Trang chủ', url: 'userHome.html' }, { name: 'Kết quả thanh toán' }]);


    const urlParams = new URLSearchParams(window.location.search);

    const amountStr = urlParams.get('vnp_Amount');
    const orderInfo = urlParams.get('vnp_OrderInfo') || urlParams.get('orderId') || 'GD_' + Math.floor(Math.random() * 100000000);
    const bankCode = urlParams.get('vnp_BankCode') || 'N/A';

    const amountEl = document.getElementById('txAmount');
    const orderInfoEl = document.getElementById('txOrderInfo');
    const bankCodeEl = document.getElementById('txBankCode');
    const dateEl = document.getElementById('txDate');

    if (amountEl && amountStr) {

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
