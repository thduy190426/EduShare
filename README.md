# EduShare

**Nền tảng Chia sẻ Tài liệu Học tập, Thi Trắc Nghiệm & Cộng đồng Sinh viên Trực tuyến**

---

## 1. Giới thiệu dự án

EduShare là một nền tảng website giáo dục toàn diện được thiết kế nhằm kết nối sinh viên và giảng viên thông qua việc chia sẻ tài liệu, thi trắc nghiệm (quiz), trao đổi kiến thức và xây dựng cộng đồng học tập. Dự án không chỉ là kho lưu trữ tài liệu đơn thuần mà còn tích hợp hệ thống điểm thưởng (Xu), mua bán tài liệu, thi trắc nghiệm trực tuyến, quản lý nhóm học tập (công khai & riêng tư), trò chuyện thời gian thực (Real-time Chat), và cơ chế kiểm duyệt chặt chẽ, đảm bảo một môi trường học thuật chất lượng cao và minh bạch.

## 2. Mục tiêu cốt lõi

- Xây dựng thư viện điện tử thông minh, dễ dàng tìm kiếm, đánh giá và chia sẻ tài liệu.
- Tích hợp hệ thống Ngân hàng câu hỏi & Thi trắc nghiệm trực tuyến (Quiz) dành cho giảng viên và sinh viên.
- Khuyến khích đóng góp thông qua hệ thống tài chính ảo (Xu), giỏ hàng mua tài liệu Premium và Danh hiệu (Badges).
- Tạo lập các không gian học tập nhóm khép kín và an toàn, hỗ trợ thảo luận nhóm, chia sẻ tài liệu nội bộ.
- Kết nối người dùng thời gian thực (Real-time) qua Chat 1-1, Chat nhóm và Thông báo hệ thống.
- Cung cấp cho Admin/Giảng viên các công cụ kiểm soát, xét duyệt, thống kê mạnh mẽ và minh bạch (Audit Logs).

---

## 3. Kiến trúc & Công nghệ sử dụng

Hệ thống được phát triển theo mô hình **Client - Server (RESTful API)** kết hợp **WebSockets**, đảm bảo bảo mật và hiệu năng.

### Frontend
- **HTML5, CSS3, Vanilla JavaScript**: Giao diện thuần túy, thiết kế responsive, thao tác qua DOM, Fetch API và kiến trúc Optimistic UI.
- **Socket.io Client**: Real-time Chat và Thông báo.
- **Thư viện bên thứ ba**: `SweetAlert2` (Alert), `Chart.js` (Thống kê), `Quill.js` (Rich Text), `Tribute.js` (@Mention), `Google Identity Services`.

### Backend
- **Node.js & Express.js**: Xây dựng RESTful API.
- **Socket.io**: WebSockets server.
- **Bảo mật & Phân quyền**: `jsonwebtoken` (Access/Refresh Token với Redis Blacklisting), `bcrypt` (Mã hoá), `express-rate-limit` + `rate-limit-redis` (Chống DDoS/Spam). Bảo mật 2FA với `speakeasy`.
- **Xử lý File & Tích hợp Cloud**: `multer`, `cloudinary` (Ảnh, PDF), `pdf-parse` (Trích xuất Text).
- **Trợ lý ảo & Tiện ích**: Tích hợp **Google Gemini API** (AI Assistant), **VirusTotal API** (Quét virus), `nodemailer` (OTP Email), `node-cron` (Lên lịch phát thưởng, báo cáo).

### Cơ sở dữ liệu
- **MySQL (v8.0+)**: Xử lý logic qua `mysql2`. Áp dụng **Transactions (ACID)** và **Row-level locking (FOR UPDATE)** cho các luồng mua bán, nạp Xu.
- **Redis (ioredis)**: Caching API (cacheMiddleware), Rate Limiting Stateful, lưu trữ cấu hình hệ thống (Admin Dashboard Summary) và JWT Blacklist để tối ưu hiệu năng và bảo mật.

---

## 4. Cấu trúc thư mục

```text
EduShare/
├── be/                       # Backend 
│   ├── config/               # Cấu hình Database, Cloudinary, Redis
│   ├── middlewares/          # auth.js (JWT), rateLimit.js, cache.js
│   ├── services/             # socket.js, cronJobs.js, virusScanner.js...
│   ├── routes/               # API Router (users, admin, upload, quiz, chat...)
│   ├── server.js             # Entry point
│   └── database.sql          # Schema SQL khởi tạo
│
└── fe/                       # Frontend 
    ├── assets/, css/         # CSS và Assets
    ├── pages/                # Giao diện HTML (chia theo module)
    │   ├── admin/            # Dashboard, Duyệt tài liệu, Phân quyền...
    │   ├── auth/             # Login, Register, OTP...
    │   ├── document/         # Xem, Upload, Tìm kiếm tài liệu...
    │   ├── group/            # Quản lý và Thảo luận Nhóm
    │   ├── quiz/             # Giao diện làm bài Trắc nghiệm
    │   ├── teacher/          # Quản lý Quiz của Giảng viên
    │   └── user/             # Hồ sơ, Nạp Xu, Giỏ hàng...
    └── main/                 # Scripts JS tương ứng với các thư mục pages/
```

---

## 5. Danh sách các tính năng nổi bật (Theo Modules)

### Module Xác thực (Auth) & Người dùng (User)
- Đăng nhập/Đăng ký đa kênh (Email, Google, GitHub). Xác thực 2FA.
- Phân quyền (Role-based): Khách, Sinh Viên, Giảng Viên, Admin (Moderator / SuperAdmin).
- Hồ sơ, Danh hiệu (Badges), Bộ sưu tập tài liệu cá nhân (Collections).
- Nhiệm vụ hàng ngày (Daily Quests) để nhận thưởng Xu.

### Module Tài liệu (Documents)
- Đăng tải tài liệu (Free/Premium). Hỗ trợ kiểm duyệt tự động & Quét Virus.
- Mua tài liệu Premium thông qua Xu. Hỗ trợ **Giỏ hàng (Shopping Cart)** để mua nhiều tài liệu cùng lúc.
- Lọc, tìm kiếm, đánh giá, bình luận (Gắn thẻ @, Edit realtime). Embed tài liệu.

### Module Trắc nghiệm (Quiz)
- Ngân hàng câu hỏi (Tạo, Sửa, Xóa, Phân loại).
- Tạo bài Thi (Quiz): Cấu hình thời gian, ngẫu nhiên câu hỏi.
- Giao diện làm bài: Đếm ngược, tự động chấm điểm, thống kê chi tiết kết quả.

### Module Cộng đồng & Chat (Groups & Realtime Chat)
- Tạo và Quản lý Nhóm học tập (Công khai/Kín). Gắn thẻ @, duyệt thành viên.
- Chat 1-1, Chat Nhóm thời gian thực (Tin nhắn chữ, hình ảnh, file, voice note). Typing indicators.

### Module Quản trị (Admin)
- Dashboard Thống kê (Cache bằng Redis).
- Quản lý duyệt tài liệu, xét duyệt yêu cầu nâng cấp Giảng viên, xử lý vi phạm.
- Cấu hình hệ thống động, Quản lý Promo Code, Nạp xu. Gửi Mass Mail.
- **Audit Logs** và quản lý Backups (Sao lưu MySQL).

---

## 6. Sơ đồ Database (Schema Overview)

Một số bảng chính trong CSDL MySQL `edushare_db`:
- **Người dùng**: `NGUOIDUNG`, `DANHHIEU`, `THONGBAO`
- **Tài liệu**: `TAILIEU`, `BOSUUTAP`, `GIOHANG`, `TAILIEU_DAMUA`, `BINHLUAN`, `DANHGIA`
- **Nhóm & Chat**: `NHOM`, `THANHVIEN_NHOM`, `TINNHAN`, `TINNHAN_NHOM`
- **Quiz**: `NGANHANG_CAUHOI`, `QUIZ`, `QUIZ_CAUHOI`, `KETQUA_QUIZ`
- **Giao dịch**: `GIAODICH_NAPXU`, `LICH_SU_XU`, `PROMO_CODE`

---

## 7. API Endpoints (Tổng quan)

- `/api/auth/*`: Đăng nhập, Đăng ký, OTP, Khôi phục mật khẩu.
- `/api/users/*`: Lấy thông tin cá nhân, Yêu cầu quyền Giảng viên, Nhiệm vụ, Giỏ hàng.
- `/api/upload/*`: Tải file, Quét virus, Lấy metadata tài liệu.
- `/api/admin/*`: Duyệt tài liệu, Quản trị viên xử lý báo cáo, Audit logs, Dashboard.
- `/api/groups/*`: Quản lý nhóm, danh sách thành viên, bài viết.
- `/api/quiz/*`: Ngân hàng câu hỏi, tạo bài thi, nộp bài, xem kết quả.
- `/api/chat/*`: Lấy lịch sử chat, gửi tin nhắn, lấy tin nhắn nhóm.

---

## 8. Hướng dẫn cài đặt & Chạy Local

### Yêu cầu
- Node.js >= 16.x
- MySQL >= 8.0
- Redis >= 5.x (Chạy ngầm ở `localhost:6379`)

### Bước 1: Khởi tạo Database
1. Tạo DB MySQL tên `edushare_db`.
2. Import file `be/database.sql` để tạo bảng cơ bản.
3. Chạy `node be/alter_db.js` để đồng bộ các cấu trúc mới.

### Bước 2: Cài đặt Dependencies Backend
```bash
cd be
npm install
```

### Bước 3: Cấu hình Biến môi trường (`.env`)
Tạo file `be/.env` với nội dung sau:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_DB_PASSWORD
DB_NAME=edushare_db

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=YOUR_REDIS_PASSWORD

# JWT & APIs
JWT_SECRET=YOUR_SECURE_SECRET
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
GOOGLE_CLIENT_ID=xxx
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GEMINI_API_KEY=xxx
VIRUSTOTAL_API_KEY=xxx
NODEMAILER_USER=xxx
NODEMAILER_PASS=xxx
```

### Bước 4: Chạy dự án (Scripts)
- Backend:
  ```bash
  cd be
  npm run dev    # Chạy bằng Nodemon cho môi trường Dev
  # hoặc
  npm start      # Chạy môi trường Production
  ```
- Frontend:
  Dùng **Live Server** (VS Code) mở thư mục `fe` hoặc mở file HTML trực tiếp. Cấu hình IP API tại `fe/main/shared/config.js` nếu cần.

---

## 9. Testing & Troubleshooting

### Testing
- [CẦN BỔ SUNG: Hiện dự án chưa có hệ thống Unit Tests (Jest, Mocha) hay E2E Tests (Cypress). Đề xuất bổ sung trong tương lai].
- Kiểm tra tính toàn vẹn (Testing Manual): Đảm bảo Redis đang chạy (nếu không login/logout sẽ bị lỗi JWT Blacklist timeout).

### Troubleshooting (Lỗi thường gặp)
- **Lỗi `ETIMEDOUT` MySQL khi khởi động**: Đã khắc phục bằng cơ chế `connectWithRetry` trong `server.js`.
- **Lỗi Redis không kết nối được**: Đảm bảo Redis đang mở ở cổng 6379 và điền đúng mật khẩu vào biến `REDIS_PASSWORD`.
- **Lỗi CORS Frontend**: Đảm bảo chạy frontend qua Live Server (localhost), không mở file cứng `file:///` để tính năng fetch Cookie/JWT hoạt động chuẩn.

---

## 10. Deploy & Đóng góp

### Deploy
- Backend: Có thể deploy lên các dịch vụ như Render, Heroku hoặc VPS (cài đặt Nginx reverse proxy).
- Frontend: Cấu hình API path lại trỏ về tên miền thực tế. Deploy lên Vercel, Netlify hoặc cùng thư mục tĩnh với Node.js.
- Database: Cần một VPS có cấu hình MySQL và Redis bảo mật (Mật khẩu phức tạp, không expose port 6379/3306 public).

### Đóng góp (Contributing)
1. Fork repository này.
2. Tạo nhánh tính năng (`git checkout -b feature/AmazingFeature`).
3. Commit thay đổi (`git commit -m 'Thêm AmazingFeature'`).
4. Push lên nhánh (`git push origin feature/AmazingFeature`).
5. Tạo Pull Request để xem xét.

---

## 11. License
Dự án được phân phối dưới giấy phép **MIT License**. Xem file `LICENSE` để biết thêm chi tiết. (Nếu chưa có file LICENSE, bạn toàn quyền phân phối và sửa đổi).