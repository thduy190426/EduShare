# EduShare

**Nền tảng Chia sẻ Tài liệu Học tập & Cộng đồng Sinh viên Trực tuyến**

---

## 1. Giới thiệu dự án

EduShare là một nền tảng website giáo dục được thiết kế nhằm kết nối sinh viên và giảng viên thông qua việc chia sẻ tài liệu, trao đổi kiến thức và xây dựng cộng đồng học tập. Dự án không chỉ là kho lưu trữ tài liệu đơn thuần mà còn tích hợp hệ thống điểm thưởng (Xu), quản lý nhóm, và cơ chế kiểm duyệt chặt chẽ, đảm bảo một môi trường học thuật chất lượng cao và minh bạch.

## 2. Mục tiêu cốt lõi

- Xây dựng thư viện điện tử nơi người dùng có thể dễ dàng tìm kiếm, đánh giá và chia sẻ tài liệu.
- Khuyến khích sự đóng góp thông qua hệ thống tài chính ảo (Xu).
- Tạo lập các không gian học tập nhóm khép kín và an toàn.
- Cung cấp cho Ban quản trị (Admin) các công cụ kiểm soát và thống kê mạnh mẽ.

---

## 3. Công nghệ sử dụng

Hệ thống được phát triển theo mô hình **Client - Server (RESTful API)**.

### Frontend

- **HTML5 & CSS3** — Giao diện thuần túy, thiết kế responsive theo hướng Mobile-first.
- **Vanilla JavaScript** — Xử lý logic phía Client, gọi API qua Fetch API.
- **Thư viện bên thứ ba**:
  - SweetAlert2: Xử lý thông báo (Alerts & Toasts).
  - Chart.js: Hiển thị biểu đồ thống kê trên Admin Dashboard.
  - FontAwesome (v6): Hệ thống biểu tượng.
  - Google Identity Services: Xác thực OAuth2.

### Backend

- **Node.js & Express.js** — Nền tảng xây dựng Server và RESTful APIs.
- **Xác thực & Bảo mật**:
  - `jsonwebtoken` (JWT): Quản lý phiên đăng nhập (Stateless) với Access Token & Refresh Token.
  - `bcrypt`: Mã hóa mật khẩu người dùng.
  - `google-auth-library`: Xác minh Google OAuth2 ID Token.
  - `express-rate-limit`: Chống Spam/DDoS trên các luồng quan trọng (Login, Upload, Report).
- **Xử lý File & Lưu trữ**:
  - `multer` (MemoryStorage): Nhận file từ Client.
  - `cloudinary`: Lưu trữ tài liệu (PDF, DOCX, PPTX) và hình ảnh (Avatar, Bìa) trên đám mây.
- **Tiện ích khác**:
  - `nodemailer`: Gửi email mã OTP xác thực và khôi phục mật khẩu.
  - Quét virus tự động trước khi lưu tài liệu.
  - Chống trùng lặp tài liệu (Plagiarism Detection) thông qua mã băm SHA-256.

### Cơ sở dữ liệu

- **MySQL (v8.0+)** — Kết nối qua `mysql2/promise`, hỗ trợ xử lý bất đồng bộ và Database Transactions (Row-level locking) để đảm bảo tính ACID khi giao dịch Xu.

---

## 4. Các tính năng nổi bật

### Người dùng (Sinh viên / Giảng viên)

- **Xác thực đa kênh**: Đăng nhập/Đăng ký qua Email (kèm OTP) hoặc Google OAuth2.
- **Quản lý tài liệu**: Đăng tải tài liệu Free hoặc Premium. Hệ thống tự động tạo mã băm chống re-upload và quét virus.
- **Hệ thống giao dịch (Xu)**:
  - Nạp Xu qua Admin, nhập mã khuyến mãi (Promo Code).
  - Mua tài liệu Premium bằng Xu; tác giả tự động nhận doanh thu.
  - Lịch sử giao dịch chi tiết, chống trừ tiền âm bằng Transaction.
- **Tương tác xã hội**:
  - Đánh giá (Rating 1–5 sao) và Bình luận tài liệu (hỗ trợ Ghim bình luận).
  - Theo dõi người dùng khác (Follow/Unfollow).
  - Đánh dấu lưu tài liệu (Bookmark).
- **Cộng đồng nhóm (Groups)**: Tạo nhóm học tập kín, mời thành viên, duyệt yêu cầu tham gia, chia sẻ tài liệu nội bộ.

### Quản trị viên (Admin)

- **Dashboard thống kê**: Theo dõi doanh thu, số người dùng, tài liệu mới, top đóng góp qua biểu đồ.
- **Kiểm duyệt nội dung**: Duyệt/Từ chối tài liệu, xử lý báo cáo vi phạm. Hoàn tiền (Refund) tự động cho người mua nếu tài liệu bị gỡ.
- **Quản lý người dùng**: Khóa/Mở khóa tài khoản (Bulk actions), xét duyệt yêu cầu nâng cấp lên Giảng viên.
- **Mã khuyến mãi**: Tạo và quản lý Promo Code để tặng Xu cho người dùng.

---

## 5. Cấu trúc thư mục

```
EduShare/
├── be/                       # Backend (Node.js / Express.js)
│   ├── config/               # Cấu hình kết nối (Database, Cloudinary)
│   ├── middlewares/          # Middleware bảo mật (auth.js, rateLimit.js)
│   ├── services/             # Các dịch vụ độc lập (virus scan, hash,...)
│   ├── server.js             # Entry point của Express.js
│   ├── database.sql          # Schema cơ sở dữ liệu gốc
│   ├── migrate_hash.js       # Script nâng cấp CSDL (thêm cột Hash)
│   └── *.js                  # Các Router (users.js, upload.js, admin.js,...)
│
└── fe/                       # Frontend (HTML / CSS / Vanilla JS)
    ├── assets/               # Hình ảnh, biểu tượng tĩnh
    ├── css/                  # StyleSheet theo từng chức năng
    ├── pages/                # Các trang HTML (auth, admin, user, document)
    └── main/                 # File JS xử lý logic cho từng trang
```

---

## 6. Hướng dẫn cài đặt

### Yêu cầu môi trường

- Node.js (LTS >= 16.x)
- MySQL Server (cổng mặc định 3306)

### Bước 1 — Khởi tạo cơ sở dữ liệu

1. Mở MySQL Client hoặc phpMyAdmin, tạo database trống tên `edushare_db`.
2. Import file `be/database.sql` để tạo các bảng cơ bản.
3. Chạy script nâng cấp cấu trúc (thêm cột Hash chống trùng lặp):

```bash
cd be
node migrate_hash.js
```

### Bước 2 — Cấu hình môi trường (Backend)

Cài đặt các gói phụ thuộc:

```bash
cd be
npm install
```

Tạo file `.env` nằm cùng cấp với `server.js` và điền thông tin thực tế:

```env
PORT=3000

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_DB_PASSWORD
DB_NAME=edushare_db

# JWT
JWT_SECRET=YOUR_VERY_SECURE_SECRET_KEY

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google OAuth2
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

> **Lưu ý**: Không commit file `.env` lên Git. Hãy thêm `.env` vào `.gitignore`.

### Bước 3 — Khởi động Backend

```bash
# Đứng ở thư mục be/
npm start
```

Server chạy tại: `http://localhost:3000`

### Bước 4 — Khởi động Frontend

- Dùng tiện ích **Live Server** (VSCode) để phục vụ thư mục `fe/`.
- Hoặc mở trực tiếp file `fe/pages/guest/guestHome.html` trên trình duyệt.
- Đảm bảo biến `API_URL` trong các file thuộc `fe/main/` trỏ đúng về Backend: `http://localhost:3000/api`.

---


## 7. Hướng phát triển tiếp theo

- Tích hợp **Socket.io** để đẩy thông báo thời gian thực thay cho cơ chế Polling.
- Xây dựng khu vực "Bảng tin thảo luận" (Group Feed) ngay bên trong mỗi Nhóm học tập.
- Chuyển sang **Next.js** (SSR) để tối ưu SEO cho các trang chi tiết tài liệu.