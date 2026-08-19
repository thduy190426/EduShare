# EduShare

**Nền tảng Chia sẻ Tài liệu Học tập & Cộng đồng Sinh viên Trực tuyến**

---

## 1. Giới thiệu dự án

EduShare là một nền tảng website giáo dục toàn diện được thiết kế nhằm kết nối sinh viên và giảng viên thông qua việc chia sẻ tài liệu, trao đổi kiến thức và xây dựng cộng đồng học tập. Dự án không chỉ là kho lưu trữ tài liệu đơn thuần mà còn tích hợp hệ thống điểm thưởng (Xu), quản lý nhóm học tập (công khai & riêng tư), trò chuyện thời gian thực (Real-time Chat), và cơ chế kiểm duyệt chặt chẽ, đảm bảo một môi trường học thuật chất lượng cao và minh bạch.

## 2. Mục tiêu cốt lõi

- Xây dựng thư viện điện tử nơi người dùng có thể dễ dàng tìm kiếm, đánh giá và chia sẻ tài liệu.
- Khuyến khích sự đóng góp thông qua hệ thống tài chính ảo (Xu) và hệ thống Danh hiệu (Badges).
- Tạo lập các không gian học tập nhóm khép kín và an toàn, hỗ trợ thảo luận nhóm, chia sẻ tài liệu nội bộ và tương tác.
- Kết nối người dùng theo thời gian thực (Real-time) qua hệ thống Chat và Thông báo.
- Cung cấp cho Ban quản trị (Admin) các công cụ kiểm soát, xét duyệt, thống kê mạnh mẽ và minh bạch nhờ hệ thống Audit Logs.

---

## 3. Công nghệ sử dụng

Hệ thống được phát triển theo mô hình **Client - Server (RESTful API)** kết hợp **WebSockets**.

### Frontend

- **HTML5 & CSS3** — Giao diện thuần túy, thiết kế responsive theo hướng Mobile-first.
- **Vanilla JavaScript** — Xử lý logic phía Client, gọi API qua Fetch API, kết hợp kỹ thuật **Optimistic UI** (Phản hồi tức thì) cho trải nghiệm mượt mà.
- **Tối ưu hóa SEO** — Tự động cập nhật Meta tags linh hoạt dựa trên văn bản trích xuất tự động từ tài liệu gốc.
- **Socket.io Client** — Kết nối thời gian thực cho tính năng Chat 1-1, Chat nhóm và Thông báo hệ thống.
- **Thư viện bên thứ ba**:
  - `SweetAlert2`: Xử lý thông báo (Alerts & Toasts).
  - `Chart.js`: Hiển thị biểu đồ thống kê trên Admin Dashboard.
  - `FontAwesome (v6)`: Hệ thống biểu tượng.
  - `Google Identity Services`: Xác thực OAuth2.
  - `Tribute.js`: Tích hợp tính năng nhắc tên (@Username) trong bình luận nhóm.
  - `Quill.js` & `DOMPurify`: Trình soạn thảo văn bản phong phú (Rich Text Editor) và làm sạch HTML an toàn.

### Backend

- **Node.js & Express.js** — Nền tảng xây dựng Server và RESTful APIs.
- **Socket.io** — Máy chủ WebSocket xử lý kết nối hai chiều thời gian thực (Real-time).
- **Xác thực & Bảo mật**:
  - `jsonwebtoken` (JWT): Quản lý phiên đăng nhập với Access Token & Refresh Token.
  - `bcrypt`: Mã hóa mật khẩu người dùng.
  - `google-auth-library`: Xác minh Google OAuth2 ID Token.
  - `express-rate-limit`: Chống Spam/DDoS trên các luồng quan trọng (Login, Upload, Report).
  - **Bảo mật 2 lớp (2FA)**: Sử dụng `speakeasy` và `qrcode` (Google Authenticator) để bảo vệ tài khoản.
- **Xử lý File & Lưu trữ**:
  - `multer` (MemoryStorage): Nhận file từ Client.
  - `cloudinary`: Lưu trữ tài liệu (PDF, DOCX, PPTX), ảnh gửi qua Chat và hình ảnh (Avatar, Ảnh Bìa) trên đám mây.
  - Tự động trích xuất nội dung văn bản (Text Extraction) phục vụ SEO thông qua `pdf-parse`.
- **Tiện ích & Tự động hóa**:
  - `node-cron`: Chạy ngầm các tác vụ tự động (Phát thưởng Top đóng góp hàng tháng, dọn dẹp Token hết hạn).
  - `nodemailer`: Gửi email mã OTP xác thực và khôi phục mật khẩu.
  - Quét virus tự động (VirusTotal API) trước khi lưu tài liệu.
  - Chống trùng lặp tài liệu (Plagiarism Detection) thông qua mã băm SHA-256.

### Cơ sở dữ liệu

- **MySQL (v8.0+)** — Kết nối qua `mysql2/promise`, hỗ trợ:
  - Xử lý bất đồng bộ (Async/Await).
  - **Database Transactions (ACID)**: Khóa khối lệnh đảm bảo tính toàn vẹn dữ liệu trong các luồng giao dịch tài chính (Cộng/Trừ xu), phát thưởng tự động qua Cron Jobs, và thay đổi quyền.
  - **Row-level locking (FOR UPDATE)**: Ngăn chặn triệt để xung đột đồng thời (Race Condition) trong các nghiệp vụ nhạy cảm.

---

## 4. Các tính năng nổi bật

### Người dùng (Sinh viên / Giảng viên)

- **Xác thực đa kênh & Bảo mật**: 
  - Đăng nhập/Đăng ký qua Email (kèm OTP) hoặc Google OAuth2. Đăng xuất an toàn hỗ trợ Refresh Tokens.
  - Cơ chế **Ghi nhớ đăng nhập (Remember Me)**.
  - Tùy chọn cài đặt **Xác thực 2 yếu tố (2FA)** bảo vệ tài sản (Xu).
- **Quản lý tài liệu**: Đăng tải tài liệu Free hoặc Premium. Hệ thống tự động tạo mã băm chống re-upload, quét virus và trích xuất text phục vụ SEO.
- **Nâng cấp Giảng viên**: Gửi yêu cầu kèm minh chứng URL để Admin xét duyệt quyền Giảng viên (Đăng tài liệu không cần chờ duyệt).
- **Hệ thống giao dịch (Xu) & Danh hiệu (Badges)**:
  - Nạp Xu qua Admin, nhập mã khuyến mãi (Promo Code).
  - Mua tài liệu Premium bằng Xu; tác giả tự động nhận doanh thu. Lịch sử giao dịch chi tiết, Transaction bảo mật.
  - **Hệ thống Danh hiệu (Badges)**: Người dùng có thể được Admin trao tặng các danh hiệu đặc biệt (hiển thị công khai trên Profile) khi có những đóng góp xuất sắc.
- **Tương tác xã hội & Thông báo Real-time**:
  - Đánh giá (Rating 1–5 sao) và Bình luận tài liệu (Hỗ trợ Optimistic UI, ghim bình luận, trả lời, và **chỉnh sửa bình luận Real-time**).
  - Theo dõi người dùng khác (Follow/Unfollow) và Đánh dấu lưu tài liệu (Bookmark).
  - **Thông báo thời gian thực**: Sử dụng Socket.io, người dùng nhận được thông báo ngay lập tức khi có người bình luận, nhắc tên, tài liệu được duyệt/mua, hoặc được nhận thưởng/danh hiệu.
- **Cộng đồng nhóm (Groups)**:
  - Tạo nhóm học tập (Công khai / Riêng tư). Tùy chỉnh ảnh bìa, mô tả nhóm.
  - Quản lý thành viên: Duyệt yêu cầu, thăng quyền quản trị/phó nhóm, mời/xóa thành viên.
  - Tab Thảo luận: Đăng bài, bình luận, ghim bài. Tích hợp chức năng **Gắn thẻ (@Mention)** để nhắc tên.
  - Tab Tài liệu: Chia sẻ tài liệu nội bộ nhóm an toàn (Auto-Moderation bảo vệ nhóm).
- **Hệ thống Trò chuyện (Real-time Chat)**:
  - Khung Chat Widget nổi bật, luôn hiển thị nhờ Socket.io, hỗ trợ chat 1-1 và chat Nhóm thời gian thực mọi lúc mọi nơi.
  - Trạng thái trực tuyến (Online/Offline), trạng thái đang nhập chữ (Typing Indicator).
  - Hỗ trợ gửi **Tin nhắn văn bản**, đính kèm **hình ảnh/file**, **Trả lời (Reply)**, **Chỉnh sửa/Thu hồi tin nhắn**, và đặc biệt hỗ trợ gửi **Tin nhắn thoại (Voice Notes)** thu âm trực tiếp.

### Quản trị viên (Admin)

- **Dashboard thống kê**: Theo dõi doanh thu, số người dùng, tài liệu mới, top đóng góp qua biểu đồ (Chart.js).
- **Kiểm duyệt nội dung**: 
  - Duyệt/Từ chối tài liệu, xử lý báo cáo vi phạm với **Auto-Moderation** (tự động ẩn tài liệu nếu quá 5 report).
  - Hoàn tiền tự động cho người mua nếu tài liệu bị gỡ (Xóa mềm - Soft Delete).
  - Xét duyệt yêu cầu Nâng cấp Giảng viên, Giao dịch nạp xu.
- **Quản lý Danh hiệu (Badges)**: Xem xét hồ sơ và trao tặng/thu hồi Danh hiệu cho bất kỳ người dùng nào trong hệ thống.
- **Hệ thống Cron Jobs Tự động**: Tự động chạy ngầm vào đầu tháng để tổng kết và phát thưởng Xu cho Top Bảng Vàng (Người dùng có lượt đóng góp và lượt tải nhiều nhất).
- **Cấu hình hệ thống động**: Tùy chỉnh các tham số cốt lõi từ giao diện web: tỷ giá nạp Xu - VNĐ, giới hạn đăng tải, bật/tắt tính năng đăng ký, duyệt nhóm.
- **Mã khuyến mãi (Promo Code)** & **Quản lý Gói Nạp (Packages)**: Tạo, chỉnh sửa các gói nạp và mã quà tặng người dùng.
- **Kiểm soát Hệ thống Nâng cao**:
  - **Audit Logs**: Lưu vết (Log) tự động toàn bộ thao tác quan trọng của Quản trị viên để dễ dàng truy vết và quản lý trách nhiệm.
  - **Xuất Báo cáo Kế toán**: Dễ dàng xuất file định dạng Excel/CSV (chuẩn UTF-8 BOM) cho báo cáo Doanh thu hệ thống và Lịch sử nạp xu.

---

## 5. Hệ thống các trang giao diện (Frontend Pages)

Dự án sở hữu một hệ thống giao diện vô cùng đồ sộ, được chia nhỏ thành nhiều phân hệ logic chuyên biệt (tất cả đều tích hợp Real-time Chat Widget):

### 1. Phân hệ Khách (Guest & Public Pages)
- **`guestHome.html`**: Trang chủ dành cho khách chưa đăng nhập. Giới thiệu tổng quan và hiển thị tài liệu nổi bật (Trending).
- **`about.html`**: Giới thiệu sứ mệnh, tầm nhìn.
- **`guide.html`**: Hướng dẫn sử dụng nền tảng cho người mới.
- **`helpCenter.html`**: Trung tâm trợ giúp (FAQ).
- **`blog.html` & `forum.html`**: Khu vực tin tức, blog và diễn đàn trao đổi mở.
- **`contact.html`, `privacy.html`, `terms.html`, `copyright.html`**: Các trang thông tin, pháp lý.

### 2. Phân hệ Xác thực (Authentication)
- **`login.html`**: Đăng nhập bảo mật (hỗ trợ Google OAuth2).
- **`register.html`**: Đăng ký tài khoản thành viên mới.
- **`register-verify.html`**: Form nhập mã xác thực OTP qua Email.
- **`forgot-password.html`**: Luồng quy trình quên và khôi phục mật khẩu.

### 3. Phân hệ Người dùng & Cá nhân hóa (User Module)
- **`userHome.html`**: Trang chủ cá nhân hóa sau khi đăng nhập (Bảng feed tài liệu, gợi ý nhóm, top contributor).
- **`userProfile.html`**: Hồ sơ cá nhân (Cập nhật thông tin, đổi Avatar, yêu cầu cấp quyền Giảng viên, xem Danh hiệu).
- **`otherUserProfile.html`**: Xem hồ sơ công khai của các tác giả/người dùng khác.
- **`buyCoins.html`**: Giao diện chọn gói nạp EduCoin và thanh toán.
- **`payment-success.html` / `payment-failed.html`**: Các trang điều hướng (Callback) kết quả thanh toán.
- **`transactionHistory.html`**: Xem chi tiết lịch sử giao dịch (nạp xu, mua bán tài liệu).
- **`notifications.html`**: Trung tâm quản lý thông báo hệ thống (Real-time).

### 4. Phân hệ Tài liệu (Document Module)
- **`documentDetails.html`**: Xem chi tiết tài liệu, bình luận, đánh giá, tải xuống miễn phí hoặc mua tài liệu VIP.
- **`myDocuments.html`**: Kho lưu trữ cá nhân (tài liệu đã đăng, đã mua, đã lưu/bookmark).
- **`searchResults.html`**: Trang tìm kiếm tài liệu nâng cao (lọc theo môn học, định dạng).
- **`uploadDocument.html`**: Giao diện đăng tải tài liệu trực quan.

### 5. Phân hệ Nhóm học tập (Group Module)
- **`groupList.html`**: Khám phá, tìm kiếm và tham gia nhóm.
- **`groupDetails.html`**: Không gian sinh hoạt chung của nhóm (Thảo luận nội bộ, chia sẻ tài liệu nhóm an toàn).

### 6. Phân hệ Quản trị (Admin Panel)
- **`adminDashboard.html`**: Bảng điều khiển trung tâm với biểu đồ thống kê.
- **`adminModeration.html`**: Khu vực xét duyệt/từ chối tài liệu mới đăng.
- **`adminUserManagement.html`**: Quản lý người dùng, cấp quyền Danh hiệu, xử lý vi phạm tài khoản.
- **`adminViolationReports.html`**: Xử lý báo cáo vi phạm.
- **`adminGroups.html`**: Quản trị hoạt động của tất cả các nhóm.
- **`adminPayments.html` / `adminPromos.html` / `adminPackages.html`**: Kiểm soát giao dịch nạp rút, phát hành mã khuyến mãi, thiết lập gói nạp.
- **`adminTeacherRequests.html`**: Xét duyệt hồ sơ xin cấp quyền Giảng viên.
- **`adminSubjects.html`**: Quản lý danh mục môn học.
- **`adminAuditLogs.html`**: Giao diện Nhật ký hoạt động (Audit Logs), truy vết toàn bộ thao tác của Admin.
- **`adminSettings.html`**: Cấu hình hệ thống động.

---

## 6. Cấu trúc thư mục

```
EduShare/
├── be/                       # Backend (Node.js / Express.js / Socket.io)
│   ├── config/               # Cấu hình kết nối (Database, Cloudinary)
│   ├── middlewares/          # Middleware bảo mật (auth.js, rateLimit.js)
│   ├── services/             # Các dịch vụ độc lập (socket.js, cronJobs.js, virusScanner.js...)
│   ├── server.js             # Entry point của Server
│   ├── database.sql          # Schema cơ sở dữ liệu (Bản chuẩn)
│   ├── alter_db.js           # Script thay đổi/nâng cấp cấu trúc CSDL
│   └── *.js                  # Các Router API (users.js, upload.js, admin.js, badges.js, chat.js,...)
│
└── fe/                       # Frontend (HTML / CSS / Vanilla JS)
    ├── assets/               # Hình ảnh, biểu tượng tĩnh
    ├── css/                  # StyleSheet theo từng chức năng, layout, chatWidget
    ├── pages/                # Các trang HTML được phân chia theo module (chi tiết tại mục 5)
    └── main/                 # File JS xử lý logic tương ứng:
        ├── shared/           # Logic dùng chung (chatWidget.js, socketClient.js, config.js, utils.js)
        ├── admin/            # Logic các trang quản trị
        ├── auth/             # Logic đăng nhập, đăng ký
        └── ...
```

---

## 7. Hướng dẫn cài đặt

### Yêu cầu môi trường

- Node.js (LTS >= 16.x)
- MySQL Server (cổng mặc định 3306)

### Bước 1 — Khởi tạo cơ sở dữ liệu

1. Mở MySQL Client hoặc phpMyAdmin, tạo database trống tên `edushare_db`.
2. Import file `be/database.sql` để tạo toàn bộ các bảng, khóa ngoại và Index mới nhất.
3. Chạy `node be/alter_db.js` để tự động cập nhật các bảng mới (nếu có cập nhật tính năng mới).

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

# VirusTotal
VIRUSTOTAL_API_KEY=your_api_key_here

# Nodemailer (Gửi Email OTP)
NODEMAILER_USER=your_email@gmail.com
NODEMAILER_PASS=your_app_password
```

### Bước 3 — Khởi động Backend

```bash
# Đứng ở thư mục be/
npm start
```
Server chạy tại: `http://localhost:3000`.

### Bước 4 — Khởi động Frontend

- Dùng tiện ích **Live Server** (VSCode) để phục vụ thư mục `fe/`.
- Hoặc mở trực tiếp file `fe/pages/guest/guestHome.html` trên trình duyệt.
- Đảm bảo biến `API_URL` trong file `fe/main/shared/config.js` hoặc `socketClient.js` trỏ đúng về Backend.

---

## 8. Hướng phát triển tiếp theo

- Bổ sung quy trình **Rút tiền (Cashout)** hoặc tích hợp cổng thanh toán tự động (VNPAY/MoMo).
- Chuyển đổi khung giao diện sang **React / Next.js** (SSR) nhằm tối ưu trải nghiệm SPA và tăng trưởng SEO tự nhiên.
- Phát triển Mobile App bằng React Native hoặc Flutter sử dụng lại bộ API hiện có.
- Tích hợp **AI (Gemini/ChatGPT)** để tự động tóm tắt nội dung tài liệu PDF/DOCX, hỗ trợ sinh viên học nhanh.

## 9. Kiểm thử tự động (Unit Tests)

Hệ thống được tích hợp bộ Unit Tests bao phủ toàn bộ các Module Backend (Sử dụng **Jest** và **Supertest**).
- **Auth API**: Đăng ký, Đăng nhập, 2FA, Khôi phục mật khẩu, Token Refresh.
- **Users Profile**: Cập nhật thông tin cá nhân, Đổi Avatar, Xóa tài khoản, Cấp/Thu hồi Danh hiệu.
- **Documents & Uploads**: Tải lên tài liệu, Quét virus (Mocks), Giới hạn tệp.
- **Subjects & Groups**: Theo dõi môn học, Quản lý nhóm, Thành viên.
- **Real-time (Sockets)**: Kiểm thử logic các sự kiện phát thông báo và tin nhắn qua Socket.io.
- **Cron Jobs**: Kiểm thử luồng phát thưởng Top Bảng Vàng (Mocking).
- **Admin Controls**: Quản lý Dashboard, Xóa/Khóa Users, Duyệt tài liệu, Gói nạp.

Toàn bộ tests chạy hoàn toàn độc lập nhờ cơ chế **Mocking Database Connections**. Cú pháp chạy test:
```bash
npm test
```