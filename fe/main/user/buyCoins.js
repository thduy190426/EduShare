import { renderBreadcrumb } from '../shared/utils.js';
import { API_URL } from "../shared/config.js";
import { getToken, showToast } from "../shared/utils.js";

let activePromo = null;
let promoDiscount = 0;
let currentPackages = [];

document.addEventListener("DOMContentLoaded", () => {
    renderBreadcrumb([{ name: 'Trang chủ', url: 'userHome.html' }, { name: 'Nạp xu' }]);

    fetchPackages();
    setupPromoCode();
    fetchFlashSale();
});

async function fetchFlashSale() {
    try {
        const response = await fetch(`${API_URL}/payment/flash-sale`);
        if (response.ok) {
            const data = await response.json();
            if (data) {
                const bannerEl = document.getElementById('fomo-banner');
                if (bannerEl) bannerEl.style.display = 'flex';
                
                const codeEl = document.getElementById('fomo-promo-code');
                if (codeEl) codeEl.textContent = data.Code;
                
                const discountEl = document.getElementById('fomo-promo-discount');
                if (discountEl) discountEl.textContent = data.DiscountPercent;
                
                if (data.NgayHetHan) {
                    startFomoTimer(new Date(data.NgayHetHan).getTime());
                }
            } else {
                const bannerEl = document.getElementById('fomo-banner');
                if (bannerEl) bannerEl.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('Error fetching flash sale:', err);
    }
}

function startFomoTimer(targetTime) {
    const hoursEl = document.getElementById('fomo-hours');
    const minutesEl = document.getElementById('fomo-minutes');
    const secondsEl = document.getElementById('fomo-seconds');
    const bannerEl = document.getElementById('fomo-banner');

    if (!hoursEl || !minutesEl || !secondsEl) return;

    if (window.fomoInterval) clearInterval(window.fomoInterval);

    const updateTimer = () => {
        const currentTime = new Date().getTime();
        const diff = parseInt(targetTime) - currentTime;

        if (diff <= 0) {
            hoursEl.textContent = '00';
            minutesEl.textContent = '00';
            secondsEl.textContent = '00';
            if (bannerEl) bannerEl.style.opacity = '0.5';
            if (window.fomoInterval) clearInterval(window.fomoInterval);
            return;
        }

        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        hoursEl.textContent = hours.toString().padStart(2, '0');
        minutesEl.textContent = minutes.toString().padStart(2, '0');
        secondsEl.textContent = seconds.toString().padStart(2, '0');
    };

    updateTimer();
    window.fomoInterval = setInterval(updateTimer, 1000);
}

function setupPromoCode() {
    const btnApply = document.getElementById("btn-apply-promo");
    const inputCode = document.getElementById("promo-code-input");

    if (btnApply && inputCode) {
        inputCode.addEventListener("input", (e) => {
            if (e.target.value.trim().length > 0) {
                btnApply.disabled = false;
            } else {
                btnApply.disabled = true;
            }
        });

        btnApply.addEventListener("click", async () => {
            const code = inputCode.value.trim().toUpperCase();
            if (!code) {
                activePromo = null;
                promoDiscount = 0;
                renderPackages(currentPackages);
                return;
            }

            const originalText = btnApply.innerHTML;
            btnApply.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
            btnApply.disabled = true;

            try {
                const token = getToken();
                const res = await fetch(`${API_URL}/payment/promos/validate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ code })
                });

                const data = await res.json();

                if (res.ok) {
                    activePromo = code;
                    promoDiscount = data.discountPercent / 100;
                    showToast("success", `Đã áp dụng mã ${code} (Tặng ${data.discountPercent}% Xu)`);
                } else {
                    activePromo = null;
                    promoDiscount = 0;
                    showToast("error", data.message || "Mã ưu đãi không hợp lệ.");
                }
            } catch (err) {
                console.error(err);
                activePromo = null;
                promoDiscount = 0;
                showToast("error", "Lỗi kết nối máy chủ.");
            } finally {
                btnApply.innerHTML = originalText;
                btnApply.disabled = false;
                renderPackages(currentPackages);
            }
        });
    }
}

async function fetchPackages() {
    try {
        const response = await fetch(`${API_URL}/payment/packages`);
        if (!response.ok) throw new Error("Failed to fetch packages");

        const data = await response.json();
        currentPackages = data.packages || [];
        renderPackages(currentPackages);
    } catch (error) {
        console.error(error);
        showToast("error", "Không thể tải danh sách gói nạp.");
    }
}

function renderPackages(packages) {
    const container = document.getElementById("packages-container");
    container.innerHTML = "";

    packages.forEach((pkg, index) => {
        const baseCoins = pkg.price / 100;
        let finalCoins = pkg.coins;

        if (promoDiscount > 0) {
            finalCoins = Math.floor(finalCoins * (1 + promoDiscount));
        }

        let discountHtml = "";

        if (finalCoins > baseCoins) {
            const bonus = finalCoins - baseCoins;
            const percent = Math.round((bonus / baseCoins) * 100);
            discountHtml = `<div class="package-discount">Tặng ${percent}%</div>`;
        }

        const card = document.createElement("div");
        card.className = "package-card" + (index === 2 || index === 3 ? " popular" : "");
        card.innerHTML = `
            ${discountHtml}
            <div class="loading-overlay">
                <div class="spinner"></div>
            </div>
            <i class="fa-solid fa-coins package-icon"></i>
            <div class="package-coins">${finalCoins.toLocaleString('vi-VN')} Xu</div>
            <div class="package-price">${pkg.price.toLocaleString('vi-VN')} VNĐ</div>
            <button class="btn-buy" data-id="${pkg.id}"><i class="fa-solid fa-wallet" style="margin-right: 6px;"></i>Nạp ngay</button>
        `;

        card.querySelector(".btn-buy").addEventListener("click", () => handleBuy(pkg.id, card));
        container.appendChild(card);
    });
}

async function handleBuy(packageId, cardElement) {
    const token = getToken();
    if (!token) {
        Swal.fire("Vui lòng đăng nhập để nạp xu.");
        return;
    }

    cardElement.classList.add("loading");

    try {
        const response = await fetch(`${API_URL}/payment/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ packageId, promoCode: activePromo })
        });

        const data = await response.json();

                if (response.ok && data.qrUrl) {
            document.getElementById("qrCodeImage").src = data.qrUrl;
            document.getElementById("qrAmount").textContent = `${data.amount.toLocaleString('vi-VN')} VNĐ`;
            document.getElementById("qrAddInfo").textContent = data.addInfo;

            const modal = document.getElementById("qrModal");
            modal.classList.remove("hide");
            modal.classList.add("show");
            document.body.style.overflow = "hidden";

            const closeBtn = document.getElementById("btn-close-qr");
            const markBtn = document.getElementById("btn-close-mark");

            const closeModal = () => {
                modal.classList.remove("show");
                modal.classList.add("hide");
                document.body.style.overflow = "auto";
                setTimeout(() => {
                    modal.classList.remove("hide");
                    document.getElementById("qrCodeImage").src = "";
                }, 200);
            };

            closeBtn.onclick = () => {
                closeModal();
                Swal.fire({
                    icon: 'success',
                    title: 'Đã gửi yêu cầu',
                    text: 'Giao dịch của bạn đang chờ Admin duyệt. Xu sẽ được cộng khi Admin xác nhận.',
                    confirmButtonText: 'Đồng ý'
                }).then(() => {
                    window.location.href = 'userProfile.html';
                });
            };

            if (markBtn) {
                markBtn.onclick = () => {
                    closeModal();
                };
            }
        } else {
            showToast("error", data.message || "Không thể tạo giao dịch.");
        }
    } catch (error) {
        console.error(error);
        showToast("error", "Lỗi kết nối máy chủ.");
    } finally {
        cardElement.classList.remove("loading");
    }
}

