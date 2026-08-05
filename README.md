# EduShare

**Nền tảng Chia sẻ Tài liệu Học tập & Cộng đồng Sinh viên Trực tuyến**

---

## 1. Giới thiệu dự án

EduShare là một nền tảng website giáo dục được thiết kế nhằm kết nối sinh viên và giảng viên thông qua việc chia sẻ tài liệu, trao đổi kiến thức và xây dựng cộng đồng học tập. Dự án không chỉ là kho lưu trữ tài liệu đơn thuần mà còn tích hợp hệ thống điểm thưởng (Xu), quản lý nhóm học tập (công khai & riêng tư), và cơ chế kiểm duyệt chặt chẽ, đảm bảo một môi trường học thuật chất lượng cao và minh bạch.

## 2. Mục tiêu cốt lõi

- Xây dựng thư viện điện tử nơi người dùng có thể dễ dàng tìm kiếm, đánh giá và chia sẻ tài liệu.
- Khuyến khích sự đóng góp thông qua hệ thống tài chính ảo (Xu).
- Tạo lập các không gian học tập nhóm khép kín và an toàn, hỗ trợ thảo luận nhóm, chia sẻ tài liệu nội bộ và tương tác.
- Cung cấp cho Ban quản trị (Admin) các công cụ kiểm soát, xét duyệt, thống kê mạnh mẽ và minh bạch nhờ hệ thống Audit Logs.

---

## 3. Công nghệ sử dụng

Hệ thống được phát triển theo mô hình **Client - Server (RESTful API)**.

### Frontend

- **HTML5 & CSS3** — Giao diện thuần túy, thiết kế responsive theo hướng Mobile-first.
- **Vanilla JavaScript** — Xử lý logic phía Client, gọi API qua Fetch API.
- **Tối ưu hóa SEO** — Tự động cập nhật Meta tags linh hoạt dựa trên văn bản trích xuất tự động từ tài liệu gốc.
- **Thư viện bên thứ ba**:
  - `SweetAlert2`: Xử lý thông báo (Alerts & Toasts).
  - `Chart.js`: Hiển thị biểu đồ thống kê trên Admin Dashboard.
  - `FontAwesome (v6)`: Hệ thống biểu tượng.
  - `Google Identity Services`: Xác thực OAuth2.
  - `Tribute.js`: Tích hợp tính năng nhắc tên (@Username) trong bình luận nhóm.

### Backend

- **Node.js & Express.js** — Nền tảng xây dựng Server và RESTful APIs.
- **Xác thực & Bảo mật**:
  - `jsonwebtoken` (JWT): Quản lý phiên đăng nhập với Access Token & Refresh Token.
  - `bcrypt`: Mã hóa mật khẩu người dùng.
  - `google-auth-library`: Xác minh Google OAuth2 ID Token.
  - `express-rate-limit`: Chống Spam/DDoS trên các luồng quan trọng (Login, Upload, Report).
  - **Bảo mật 2 lớp (2FA)**: Sử dụng `speakeasy` và `qrcode` (Google Authenticator) để bảo vệ tài khoản.
- **Xử lý File & Lưu trữ**:
  - `multer` (MemoryStorage): Nhận file từ Client.
  - `cloudinary`: Lưu trữ tài liệu (PDF, DOCX, PPTX) và hình ảnh (Avatar, Ảnh Bìa) trên đám mây.
  - Tự động trích xuất nội dung văn bản (Text Extraction) phục vụ SEO thông qua `pdf-parse`.
- **Tiện ích khác**:
  - `nodemailer`: Gửi email mã OTP xác thực và khôi phục mật khẩu.
  - Quét virus tự động (VirusTotal API) trước khi lưu tài liệu.
  - Chống trùng lặp tài liệu (Plagiarism Detection) thông qua mã băm SHA-256.

### Cơ sở dữ liệu

- **MySQL (v8.0+)** — Kết nối qua `mysql2/promise`, hỗ trợ:
  - Xử lý bất đồng bộ (Async/Await).
  - **Database Transactions (ACID)**: Khóa khối lệnh đảm bảo tính toàn vẹn dữ liệu trong các luồng giao dịch tài chính (Cộng/Trừ xu), phát thưởng, và thay đổi quyền.
  - **Row-level locking (FOR UPDATE)**: Ngăn chặn triệt để xung đột đồng thời (Race Condition) trong các nghiệp vụ nhạy cảm.

---

## 4. Các tính năng nổi bật

### Người dùng (Sinh viên / Giảng viên)

- **Xác thực đa kênh**: 
  - Đăng nhập/Đăng ký qua Email (kèm OTP) hoặc Google OAuth2. Đăng xuất an toàn hỗ trợ Refresh Tokens.
  - Tùy chọn cài đặt **Xác thực 2 yếu tố (2FA)** bằng Google Authenticator bảo vệ tài sản (Xu).
- **Quản lý tài liệu**: Đăng tải tài liệu Free hoặc Premium. Hệ thống tự động tạo mã băm chống re-upload, quét virus và trích xuất text phục vụ SEO.
- **Nâng cấp Giảng viên**: Gửi yêu cầu kèm minh chứng URL để Admin xét duyệt quyền Giảng viên (Đăng tài liệu chính thức).
- **Hệ thống giao dịch (Xu)**:
  - Nạp Xu qua Admin, nhập mã khuyến mãi (Promo Code).
  - Mua tài liệu Premium bằng Xu; tác giả tự động nhận doanh thu.
  - Lịch sử giao dịch chi tiết, chống trừ tiền âm bằng Transaction bảo mật.
- **Tương tác xã hội**:
  - Đánh giá (Rating 1–5 sao) và Bình luận tài liệu.
  - Theo dõi người dùng khác (Follow/Unfollow) và Đánh dấu lưu tài liệu (Bookmark).
- **Cộng đồng nhóm (Groups)**:
  - Tạo nhóm học tập (Công khai / Riêng tư). Tùy chỉnh ảnh bìa nhóm, giới thiệu nhóm.
  - Quản lý thành viên (Mời, duyệt yêu cầu, thăng quyền phó nhóm/quản trị).
  - Tab Thảo luận: Đăng bài, bình luận, ghim bài. Tích hợp chức năng **Gắn thẻ (@Mention)** để nhắc tên thành viên nhanh chóng.
  - Tab Tài liệu: Chia sẻ tài liệu nội bộ nhóm an toàn (Tích hợp Auto-Moderation bảo vệ không gian nhóm).

### Quản trị viên (Admin)

- **Dashboard thống kê**: Theo dõi doanh thu, số người dùng, tài liệu mới, top đóng góp qua biểu đồ.
- **Kiểm duyệt nội dung**: 
  - Duyệt/Từ chối tài liệu, xử lý báo cáo vi phạm với **Auto-Moderation** (tự động ẩn tài liệu nếu quá 5 report). Hoàn tiền tự động cho người mua nếu tài liệu bị gỡ (Xóa mềm - Soft Delete).
  - Xét duyệt yêu cầu Nâng cấp Giảng viên, Giao dịch nạp xu.
- **Quản lý người dùng**: Khóa/Mở khóa tài khoản, phân quyền với an toàn dữ liệu tuyệt đối (Anti Race-condition).
- **Mã khuyến mãi (Promo Code)**: Tạo, chỉnh sửa và quản lý Promo Code để tặng Xu cho người dùng.
- **Kiểm soát Hệ thống Nâng cao**:
  - **Audit Logs**: Lưu vết (Log) tự động toàn bộ thao tác quan trọng của Quản trị viên để dễ dàng truy vết và quản lý trách nhiệm.
  - **Xuất Báo cáo Kế toán**: Dễ dàng xuất file định dạng Excel/CSV (chuẩn UTF-8 BOM) cho báo cáo Doanh thu hệ thống và Lịch sử nạp xu của người dùng.

---

## 5. Hệ thống các trang giao diện (Frontend Pages)

Dự án sở hữu một hệ thống giao diện vô cùng đồ sộ và hoàn chỉnh, được chia nhỏ thành nhiều phân hệ logic chuyên biệt nhằm đảm bảo trải nghiệm người dùng (UX) tối ưu nhất:

### 1. Phân hệ Khách (Guest & Public Pages)
- **`guestHome.html`**: Trang chủ dành cho khách chưa đăng nhập. Giới thiệu tổng quan và hiển thị tài liệu nổi bật (Trending).
- **`about.html`**: Giới thiệu về sứ mệnh, tầm nhìn và đội ngũ phát triển EduShare.
- **`guide.html`**: Hướng dẫn sử dụng nền tảng cho người mới bắt đầu.
- **`helpCenter.html`**: Trung tâm trợ giúp, bộ câu hỏi thường gặp (FAQ).
- **`blog.html` & `forum.html`**: Khu vực tin tức, blog và diễn đàn trao đổi mở.
- **`contact.html`, `privacy.html`, `terms.html`, `copyright.html`**: Các trang thông tin liên hệ, chính sách bảo mật, điều khoản sử dụng và bản quyền.

### 2. Phân hệ Xác thực (Authentication)
- **`login.html`**: Giao diện đăng nhập bảo mật (hỗ trợ đăng nhập truyền thống và Google OAuth2).
- **`register.html`**: Đăng ký tài khoản thành viên mới.
- **`register-verify.html`**: Form nhập mã xác thực OTP qua Email sau khi đăng ký.
- **`forgot-password.html`**: Luồng quy trình quên và khôi phục mật khẩu.

### 3. Phân hệ Người dùng & Cá nhân hóa (User Module)
- **`userHome.html`**: Trang chủ cá nhân hóa sau khi đăng nhập (Bảng feed tài liệu, gợi ý nhóm, top contributor).
- **`userProfile.html`**: Hồ sơ cá nhân (Cập nhật thông tin, đổi Avatar, yêu cầu cấp quyền Giảng viên).
- **`otherUserProfile.html`**: Xem hồ sơ công khai của các tác giả/người dùng khác.
- **`buyCoins.html`**: Giao diện nạp EduCoin thông qua các cổng thanh toán/ngân hàng.
- **`transactionHistory.html`**: Xem chi tiết lịch sử giao dịch (nạp xu, mua bán tài liệu).
- **`notifications.html`**: Trung tâm quản lý và theo dõi thông báo từ hệ thống.

### 4. Phân hệ Tài liệu (Document Module)
- **`documentDetails.html`**: Giao diện xem chi tiết tài liệu, bình luận, đánh giá, tải xuống miễn phí hoặc mua tài liệu VIP.
- **`myDocuments.html`**: Kho lưu trữ cá nhân (tài liệu đã đăng, đã mua, đã lưu/bookmark và lịch sử tải về).
- **`searchResults.html`**: Trang tìm kiếm tài liệu nâng cao (hỗ trợ lọc theo môn học, cấp học và định dạng tệp).
- **`uploadDocument.html`**: Giao diện đăng tải tài liệu trực quan, thiết lập giá bán và mô tả.

### 5. Phân hệ Nhóm học tập (Group Module)
- **`groupList.html`**: Khám phá, tìm kiếm và tham gia các nhóm học tập trên nền tảng.
- **`groupDetails.html`**: Không gian sinh hoạt chung của nhóm (Thảo luận nội bộ theo luồng, chia sẻ và lưu trữ tài liệu nhóm an toàn).

### 6. Phân hệ Quản trị (Admin Panel)
- **`adminDashboard.html`**: Bảng điều khiển trung tâm với biểu đồ thống kê trực quan.
- **`adminModeration.html`**: Khu vực xét duyệt/từ chối tài liệu mới đăng.
- **`adminUserManagement.html`**: Quản lý danh sách người dùng, cấp quyền, xử lý vi phạm tài khoản.
- **`adminViolationReports.html`**: Xử lý các báo cáo vi phạm tài liệu (Tích hợp tính năng Auto-moderation).
- **`adminGroups.html`**: Quản trị hoạt động của tất cả các nhóm trên nền tảng.
- **`adminPayments.html` / `adminPromos.html`**: Kiểm soát giao dịch nạp rút, phát hành mã khuyến mãi.
- **`adminTeacherRequests.html`**: Xét duyệt hồ sơ xin cấp quyền Giảng viên (Teacher Requests).
- **`adminSubjects.html`**: Quản lý, cấu trúc danh mục môn học hệ thống.

---

## 6. Cấu trúc thư mục

```
EduShare/
├── be/                       # Backend (Node.js / Express.js)
│   ├── config/               # Cấu hình kết nối (Database, Cloudinary)
│   ├── middlewares/          # Middleware bảo mật (auth.js, rateLimit.js)
│   ├── services/             # Các dịch vụ độc lập (virus scan, hash, cron jobs...)
│   ├── server.js             # Entry point của Express.js
│   ├── database.sql          # Schema cơ sở dữ liệu (Bản chuẩn)
│   ├── alter_db.js           # Script thay đổi/nâng cấp cấu trúc CSDL
│   └── *.js                  # Các Router API (users.js, upload.js, admin.js,...)
│
└── fe/                       # Frontend (HTML / CSS / Vanilla JS)
    ├── assets/               # Hình ảnh, biểu tượng tĩnh, CSS chung
    ├── css/                  # StyleSheet theo từng chức năng và layout
    ├── pages/                # Các trang HTML được phân chia theo module (chi tiết tại mục 5)
    └── main/                 # File JS xử lý logic tương ứng cho từng trang
```

---

## 7. Hướng dẫn cài đặt

### Yêu cầu môi trường

- Node.js (LTS >= 16.x)
- MySQL Server (cổng mặc định 3306)

### Bước 1 — Khởi tạo cơ sở dữ liệu

1. Mở MySQL Client hoặc phpMyAdmin, tạo database trống tên `edushare_db`.
2. Import file `be/database.sql` để tạo toàn bộ các bảng, các khóa ngoại và Index mới nhất.
3. Nếu bạn cập nhật từ bản cũ, có thể chạy `node alter_db.js` trong thư mục `be/` để tự động thêm các bảng và cột mới.

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

## 8. Hướng phát triển tiếp theo

- Tích hợp **Socket.io** để đẩy thông báo thời gian thực thay cho cơ chế Polling hiện tại, hoàn thiện Real-time Notification.
- Bổ sung quy trình **Rút tiền (Cashout)** hoặc tích hợp cổng thanh toán tự động (VNPAY/MoMo).
- Chuyển đổi khung giao diện sang **React / Next.js** (SSR) nhằm tối ưu trải nghiệm SPA và tăng trưởng SEO tự nhiên.
- Phát triển Mobile App bằng React Native hoặc Flutter sử dụng lại bộ API hiện có.

## 9. Kiểm thử tự động (Unit Tests)

Hệ thống được tích hợp bộ Unit Tests bao phủ toàn bộ các Module Backend (Sử dụng **Jest** và **Supertest**).
- **Auth API**: Đăng ký, Đăng nhập, 2FA, Khôi phục mật khẩu, Token Refresh.
- **Users Profile**: Cập nhật thông tin cá nhân, Đổi Avatar, Xóa tài khoản.
- **Documents & Uploads**: Tải lên tài liệu, Quét virus (Mocks), Giới hạn tệp.
- **Subjects**: Theo dõi môn học, Quản lý danh mục.
- **Groups**: Tạo nhóm, Cập nhật ảnh bìa, Quản lý thành viên, Thảo luận nội bộ.
- **Notifications**: Thông báo hệ thống, Cập nhật trạng thái đọc.
- **Payments**: Nạp xu (Tạo mã QR giả lập), Quản lý gói nạp, Xử lý giao dịch.
- **Cron Jobs**: Tự động phát thưởng Top Bảng Vàng (Transactions Mocking), Thu dọn Token hết hạn.
- **Admin Controls**: Quản lý Dashboard, Xóa/Khóa Users, Duyệt tài liệu/thanh toán, Xuất Báo Cáo.

Toàn bộ 57 tests hoàn toàn độc lập, có thể chạy song song an toàn nhờ cơ chế **Mocking Database Connections**.