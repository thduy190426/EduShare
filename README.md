<div align="center">
  <h1>EduShare</h1>
  <p><strong>Nền Tảng Chia Sẻ Tài Liệu Học Tập Toàn Diện</strong></p>
  <p>Một dự án hỗ trợ học sinh, sinh viên và giáo viên lưu trữ, chia sẻ và kinh doanh tài liệu học tập.</p>
</div>

---

## 1. Tổng Quan Dự Án (Project Overview)

**EduShare** là một hệ thống ứng dụng web chuyên dụng cho lĩnh vực giáo dục, cho phép người dùng chia sẻ và khai thác kho tài liệu học tập một cách hiệu quả. Dự án được phát triển trên kiến trúc Node.js/Express (Backend) và Vanilla JavaScript (Frontend).

Hệ thống phân chia quyền rõ ràng thành 3 nhóm: **Sinh Viên**, **Giáo Viên** và **Admin**. Điểm nổi bật của EduShare là hệ thống kinh tế vi mô tích hợp (hệ thống Xu), cho phép **Giáo Viên** và **Admin** đóng gói các tài liệu chất lượng cao thành nội dung **PREMIUM**. Người dùng có thể mở khóa thông qua Xu, tạo ra môi trường học tập chia sẻ nhưng vẫn có phần thưởng xứng đáng cho công sức biên soạn.

---

## 2. Các Tính Năng Nổi Bật (Key Features)

### Phân Hệ Người Dùng (User Module)

* **Xác Thực Đa Tầng:** Đăng nhập, đăng ký, khôi phục mật khẩu thông qua JSON Web Token (JWT). Tích hợp xác thực OTP qua Email (sử dụng Mailtrap).
* **Định Danh & Nâng Cấp Giáo Viên (KYC):** Học sinh/Sinh viên có thể tải lên ảnh minh chứng (thẻ giáo viên, chứng chỉ) để gửi yêu cầu nâng cấp tài khoản lên Giáo Viên (GiaoVien) nhằm mở khóa tính năng đăng tài liệu thu phí.
* **Động Cơ Tìm Kiếm Thông Minh:** Tích hợp bộ lọc đa chiều (môn học, phân loại, cấp độ) và tính năng tìm kiếm toàn văn bản (Full-text Search).
* **Quản Lý Nhóm & Tương Tác:**
  * **Đánh Giá & Bình Luận:** Chấm điểm 5 sao và bình luận đa tầng. Đặc biệt: **Tác giả bài viết** có quyền kiểm duyệt (Xóa) và **Ghim** các bình luận nổi bật trên tài liệu của mình.
  * **Mạng Lưới Nhóm Học Tập:** Khởi tạo nhóm kín, chia sẻ mã mời, trao đổi và chia sẻ tài liệu lưu trữ nội bộ cho nhóm.

### Hệ Thống Giao Dịch & Tài Chính (Financial System)

* **Ví Điện Tử (Xu):** Giao diện hiển thị số dư, quản lý và nạp Xu thông qua hệ thống admin duyệt.
* **Thưởng & Mua Bán:** 
  * Sinh viên đăng tài liệu hoàn toàn miễn phí, và sẽ được **thưởng +1 Xu** cho mỗi lượt tải của người khác.
  * Tài liệu PREMIUM do Giáo viên/Admin đăng có thể tự định giá.
* **Giao Dịch An Toàn:** Các nghiệp vụ nhạy cảm như Mua tài liệu, Trừ Xu, Thưởng Xu được bảo vệ hoàn toàn bằng cơ chế **Database Transactions (Row-level lock / FOR UPDATE)**, chống lại hoàn toàn rủi ro Race Condition, trùng lặp giao dịch và hack Xu âm.

### Phân Hệ Quản Trị & Kiểm Duyệt (Admin Dashboard)

* **Bảng Điều Khiển Tổng Quan:** Cung cấp biểu đồ trực quan, số liệu thống kê thời gian thực.
* **Kiểm Duyệt Báo Cáo (Report Moderation):** Hệ thống cho phép người dùng báo cáo tài liệu vi phạm. Admin có quyền xem xét, nếu xóa tài liệu thì hệ thống sẽ **tự động Refund (hoàn tiền)** lại toàn bộ Xu cho những người đã mua, đồng thời thu hồi Xu từ tác giả.
* **Bảo Mật Hệ Thống:** Triển khai **Rate Limiting** nghiêm ngặt cho toàn bộ các luồng quan trọng: Đăng nhập, Gửi OTP, Tải xuống tài liệu, Báo cáo vi phạm (Chống Spam/DDoS). Quét virus trực tiếp cho mọi file upload (thông qua API bên thứ ba).
* **Lưu Trữ Đám Mây:** File upload được đẩy thẳng lên **Cloudinary** để bảo vệ thư mục hệ thống khỏi Path Traversal.

---

## 3. Kiến Trúc & Công Nghệ (Tech Stack)

### Frontend

| Công nghệ | Vai trò |
| :--- | :--- |
| **HTML5 / CSS3** | Cấu trúc và thiết kế giao diện (UI) thân thiện, hiện đại. |
| **Vanilla JavaScript** | Xử lý sự kiện, DOM và giao tiếp Fetch API an toàn (gắn Token). |
| **SweetAlert2** | Hộp thoại thông báo (Alert/Confirm) thân thiện với người dùng. |
| **Chart.js** | Hiển thị biểu đồ thống kê trực quan trên Dashboard Admin. |

### Backend

| Công nghệ | Vai trò |
| :--- | :--- |
| **Node.js & Express.js** | Xây dựng RESTful API, bảo mật với Express-Rate-Limit, CORS. |
| **JWT & Bcrypt** | Mã hóa mật khẩu, tạo phiên đăng nhập Stateless. |
| **Multer & Cloudinary** | Xử lý file bộ nhớ đệm (memoryStorage) và lưu trữ mây hóa. |
| **Nodemailer** | Gửi Email OTP bảo mật trong quá trình quên mật khẩu. |

### Cơ Sở Dữ Liệu

| Công nghệ | Vai trò |
| :--- | :--- |
| **MySQL (v8.0+)** | Hệ quản trị CSDL quan hệ, tương tác bất đồng bộ thông qua thư viện `mysql2/promise`. Các transaction đảm bảo tính ACID. |

---

## 4. Cấu Trúc Mã Nguồn (Directory Structure)

```text
EduShare/
├── be/                       # Thư mục mã nguồn máy chủ (Backend)
│   ├── config/               # Cấu hình biến môi trường
│   ├── middlewares/          # Chứa auth.js và rateLimit.js
│   ├── services/             # Dịch vụ quét virus, mailer
│   ├── server.js             # Entry point Express
│   ├── database.sql          # Script cấu trúc CSDL ban đầu
│   ├── alter_db.js           # Kịch bản cập nhật schema tự động
│   └── *.js                  # Các Routers (users.js, upload.js, admin.js)
│
├── fe/                       # Thư mục giao diện (Frontend)
│   ├── assets/               # Hình ảnh tĩnh
│   ├── css/                  # File StyleSheet 
│   ├── pages/                # Các tệp HTML
│   └── main/                 # Các tệp JavaScript Client-side logic
└── README.md                 # Tài liệu mô tả dự án
```

---

## 5. Hướng Dẫn Cài Đặt (Installation Guide)

### 5.1 Yêu Cầu Môi Trường Tiền Quyết
* **Node.js** bản LTS (Phiên bản >= 16.x).
* **MySQL Server** đang hoạt động (Thường chạy tại cổng 3306).

### 5.2 Khởi Tạo Cơ Sở Dữ Liệu
1. Khởi tạo một cơ sở dữ liệu rỗng trong MySQL (Ví dụ: `edushare_db`).
2. Thực thi toàn bộ script trong tệp `be/database.sql`.
3. Quan trọng: Chạy script bổ sung DB (cập nhật bảng BINHLUAN, BAOCAOVIPHAM, THEODOI...):
   ```bash
   node be/alter_db.js
   ```

### 5.3 Cài Đặt Và Khởi Chạy Backend
1. Di chuyển vào thư mục Backend:
   ```bash
   cd be
   npm install
   ```
2. Thiết lập `.env` ngang hàng với `server.js`:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=YOUR_DB_PASSWORD
   DB_NAME=edushare_db
   JWT_SECRET=YOUR_SECRET_KEY
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```
3. Khởi động máy chủ:
   ```bash
   npm start
   ```

2. Bật Live Server trỏ vào gốc thư mục dự án hoặc trực tiếp vào thư mục `fe/`.
3. Ứng dụng sẽ tự động mở trên trình duyệt (Ví dụ tại địa chỉ: `http://127.0.0.1:5500/fe/pages/guest/guestHome.html`).
4. **Lưu ý Quan Trọng:** Hãy kiểm tra và đảm bảo hằng số `API_URL` được định nghĩa trong các tệp tại thư mục `fe/main/` đang trỏ chính xác về cổng của Backend mà bạn vừa chạy (Mặc định là `:3000`).

---

## 6. Bảng Phụ Lục API (API Endpoints Reference)

Dưới đây là một phần trích lục các Endpoint cốt lõi của Backend:

| Endpoint Route | Phương thức | Chức năng (Mô tả) | Yêu cầu xác thực |
| :--- | :--- | :--- | :--- |
| `/api/users/login` | `POST` | Xác thực thông tin người dùng và cấp Token. | Không |
| `/api/documents/upload` | `POST` | Tiếp nhận và xử lý tệp tài liệu mới. | Có (User) |
| `/api/documents/:id/buy` | `POST` | Thực hiện giao dịch mua tài liệu Premium. | Có (User) |
| `/api/admin/documents/:id/approve`| `PUT` | Phê duyệt quyền xuất bản cho tài liệu. | Có (Admin) |
| `/api/payment/deposit` | `POST` | Đẩy yêu cầu giao dịch nạp Xu. | Có (User) |

---

<div align="center">
  <p><i>Tài liệu được biên soạn phục vụ mục đích phát triển và bảo trì dự án EduShare.</i></p>
</div>
