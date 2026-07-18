import { API_URL } from "../shared/config.js";
import { getToken, showToast } from "../shared/utils.js";

document.addEventListener("DOMContentLoaded", () => {
    fetchPackages();
});

async function fetchPackages() {
    try {
        const response = await fetch(`${API_URL}/payment/packages`);
        if (!response.ok) throw new Error("Failed to fetch packages");
        
        const data = await response.json();
        renderPackages(data.packages);
    } catch (error) {
        console.error(error);
        showToast("error", "Không thể tải danh sách gói nạp.");
    }
}

function renderPackages(packages) {
    const container = document.getElementById("packages-container");
    container.innerHTML = "";

    packages.forEach(pkg => {
        const card = document.createElement("div");
        card.className = "package-card";
        card.innerHTML = `
            <div class="loading-overlay">
                <div class="spinner"></div>
            </div>
            <i class="fa-solid fa-coins package-icon"></i>
            <div class="package-coins">${pkg.coins.toLocaleString('vi-VN')} Xu</div>
            <div class="package-price">${pkg.price.toLocaleString('vi-VN')} VNĐ</div>
            <button class="btn-buy" data-id="${pkg.id}">Nạp ngay</button>
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
            body: JSON.stringify({ packageId })
        });

        const data = await response.json();

        if (response.ok && data.qrUrl) {

            document.getElementById("qrCodeImage").src = data.qrUrl;
            document.getElementById("qrAmount").textContent = `${data.amount.toLocaleString('vi-VN')} VNĐ`;
            document.getElementById("qrAddInfo").textContent = data.addInfo;
            
            const modal = document.getElementById("qrModal");
            modal.classList.remove("hide");
            modal.classList.add("show");

            const closeBtn = document.getElementById("btn-close-qr");
            const markBtn = document.getElementById("btn-close-mark");
            
            const closeModal = () => {
                modal.classList.remove("show");
                modal.classList.add("hide");
                setTimeout(() => {
                    modal.classList.remove("hide");
                    document.getElementById("qrCodeImage").src = "";
                }, 200); // Đợi animation kết thúc
            };

            closeBtn.onclick = () => {
                closeModal();
                Swal.fire({
                    icon: 'success',
                    title: 'Đã gửi yêu cầu',
                    text: 'Giao dịch của bạn đang chờ Admin duyệt. Xu sẽ được cộng khi Admin xác nhận.'
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
