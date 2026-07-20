<div align="center">
  <h1>EduShare</h1>
  <p><strong>Nền Tảng Chia Sẻ Tài Liệu Học Tập Toàn Diện</strong></p>
  <p>Một dự án hỗ trợ học sinh, sinh viên và giáo viên lưu trữ, chia sẻ và kinh doanh tài liệu học tập.</p>
</div>

---

## 1. Tổng Quan Dự Án (Project Overview)

**EduShare** là một hệ thống ứng dụng web chuyên dụng cho lĩnh vực giáo dục, cho phép người dùng chia sẻ và khai thác kho tài liệu học tập một cách hiệu quả. Dự án được phát triển trên kiến trúc Node.js/Express (Backend) và Vanilla JavaScript (Frontend).

Điểm nổi bật của EduShare là hệ thống kinh tế vi mô tích hợp (hệ thống Xu), cho phép người dùng đóng gói các tài liệu chất lượng cao thành nội dung **PREMIUM**. Người dùng khác có thể mở khóa thông qua Xu, tạo ra môi trường học tập chia sẻ nhưng vẫn có tính cạnh tranh và phần thưởng xứng đáng cho công sức biên soạn của tác giả.

---

## 2. Các Tính Năng Nổi Bật (Key Features)

### Phân Hệ Người Dùng (User Module)

* **Xác Thực Đa Tầng:** Đăng nhập, đăng ký, khôi phục mật khẩu thông qua JSON Web Token (JWT).
* **Động Cơ Tìm Kiếm Thông Minh:** Tích hợp bộ lọc đa chiều (môn học, phân loại định dạng file, cấp độ học) và tính năng tìm kiếm toàn văn bản (Full-text Search).
* **Xử Lý Tài Liệu Phức Hợp:** Tự động nhận diện định dạng (PDF, DOCX, PPTX). Đặc biệt, hệ thống hỗ trợ cơ chế tự động chuyển đổi file PPTX sang file PDF để hiển thị xem trước (preview) trực tiếp trên trình duyệt mà không cần tải về.
* **Hệ Sinh Thái Tương Tác:**
  * **Đánh Giá & Phản Hồi:** Cho phép chấm điểm chất lượng (Rating 5 sao) và hệ thống bình luận đa tầng (Nested Comments).
  * **Quản Lý Cá Nhân:** Lưu tài liệu yêu thích (Bookmark), quản lý lịch sử tải xuống.
  * **Mạng Lưới Nhóm Học Tập:** Khởi tạo nhóm kín, chia sẻ mã mời, trao đổi và chia sẻ tài liệu lưu trữ nội bộ cho nhóm.

### Hệ Thống Giao Dịch & Tài Chính (Financial System)

* **Ví Điện Tử (Xu):** Giao diện hiển thị số dư hiện tại, chức năng khởi tạo yêu cầu nạp tiền.
* **Tài Liệu PREMIUM:** Cho phép người dùng tự do định giá cho tài liệu khi tải lên, cơ chế chuyển Xu tự động từ người mua sang ví của người bán.
* **Lịch Sử Giao Dịch:** Kiểm kê và truy xuất lịch sử thu/chi, lịch sử nạp Xu minh bạch.

### Phân Hệ Quản Trị Hệ Thống (Admin Dashboard)

* **Bảng Điều Khiển Tổng Quan:** Cung cấp biểu đồ trực quan, số liệu thống kê thời gian thực về lượng truy cập, số dư, số lượng tài liệu và luồng giao dịch.
* **Quản Trị Nội Dung:** Xét duyệt, ẩn/hiện các tài liệu vi phạm. Đặc quyền xác minh các tài liệu là "Chính Thống" (Official) để tăng độ uy tín.
* **Quản Trị Giao Dịch:** Phê duyệt hoặc từ chối các biên lai, yêu cầu nạp Xu của thành viên.
* **Quản Lý Phân Mục:** Phê duyệt các môn học mới do người dùng đề xuất, hệ thống hóa danh mục học tập.

---

## 3. Kiến Trúc & Công Nghệ (Tech Stack)

Hệ thống được thiết kế theo mô hình Client-Server chặt chẽ. Dưới đây là các công nghệ cốt lõi cấu thành dự án:

### Frontend

| Công nghệ | Vai trò |
| :--- | :--- |
| **HTML5 / CSS3** | Cấu trúc và thiết kế giao diện (UI) đáp ứng tiêu chuẩn. |
| **Vanilla JavaScript** | Xử lý sự kiện, tương tác DOM động và giao tiếp với máy chủ (Fetch API). |
| **SweetAlert2** | Cải thiện trải nghiệm người dùng (UX) thông qua các hộp thoại thông báo hiện đại. |
| **Chart.js** | Hiển thị các biểu đồ thống kê trực quan trên Dashboard. |

### Backend

| Công nghệ | Vai trò |
| :--- | :--- |
| **Node.js & Express.js** | Nền tảng xây dựng RESTful API và xử lý luồng logic nghiệp vụ. |
| **JWT & Bcrypt** | Mã hóa mật khẩu, tạo và xác thực phiên đăng nhập an toàn không trạng thái (Stateless). |
| **Multer** | Xử lý quá trình nhận file (Multipart form-data) từ phía Client. |
| **LibreOffice Convert** | Tích hợp thư viện để gọi LibreOffice xử lý render (PDF hóa) tài liệu bản trình bày. |

### Cơ Sở Dữ Liệu

| Công nghệ | Vai trò |
| :--- | :--- |
| **MySQL (v8.0+)** | Hệ quản trị CSDL quan hệ, tương tác bất đồng bộ thông qua thư viện `mysql2/promise`. |

---

## 4. Cấu Trúc Mã Nguồn (Directory Structure)

Mã nguồn được phân tách minh bạch giữa tầng xử lý Backend (`/be`) và tầng giao diện Frontend (`/fe`).

```text
EduShare/
├── be/                       # Thư mục mã nguồn máy chủ (Backend)
│   ├── config/               # Cấu hình biến môi trường và thiết lập kết nối CSDL
│   ├── middlewares/          # Các tầng trung gian (Xác thực JWT, Phân quyền Admin)
│   ├── public/uploads/       # Vùng lưu trữ vật lý của tài liệu do người dùng đăng tải
│   ├── tests/                # Tệp kịch bản kiểm thử (Unit Tests)
│   ├── server.js             # Entry point khởi tạo máy chủ Express
│   ├── database.sql          # Script cấu trúc CSDL ban đầu (DDL & DML)
│   └── *.js                  # Các tệp điều hướng Router (users.js, upload.js...)
│
├── fe/                       # Thư mục giao diện (Frontend)
│   ├── assets/               # Hình ảnh tĩnh, tài nguyên đa phương tiện tĩnh
│   ├── css/                  # Toàn bộ StyleSheet được phân tách theo từng module
│   ├── pages/                # Các tệp HTML tĩnh thiết lập cấu trúc View
│   └── main/                 # Các tệp JavaScript thực thi logic Client-side
└── README.md                 # Tài liệu mô tả dự án
```

---

## 5. Hướng Dẫn Cài Đặt (Installation Guide)

Vui lòng tuân thủ chặt chẽ các bước dưới đây để triển khai và chạy thử dự án trên môi trường cục bộ (Local).

### 5.1 Yêu Cầu Môi Trường Tiền Quyết

* **Node.js** bản LTS (Phiên bản >= 16.x).
* **MySQL Server** đang hoạt động (Thường chạy tại cổng 3306).
* **LibreOffice** đã được cài đặt trên máy và khai báo biến môi trường (PATH) để hệ thống Backend có thể gọi lệnh convert.

### 5.2 Khởi Tạo Cơ Sở Dữ Liệu

1. Khởi tạo một cơ sở dữ liệu rỗng trong MySQL (Ví dụ đặt tên là: `edushare_db`).
2. Mở MySQL Console hoặc công cụ quản trị GUI (DBeaver, Navicat, phpMyAdmin) và thực thi toàn bộ script trong tệp `be/database.sql` để khởi tạo cấu trúc bảng.
3. Chạy script để cập nhật bổ sung cấu trúc (nếu có):

   ```bash
   node be/alter_db.js
   ```

### 5.3 Cài Đặt Và Khởi Chạy Backend

1. Di chuyển vào thư mục Backend:

   ```bash
   cd be
   ```

2. Cài đặt các thư viện Node.js cần thiết:

   ```bash
   npm install
   ```

3. Tạo tệp `.env` nằm ngang hàng với tệp `server.js` và thiết lập các thông số môi trường thực tế của bạn:

   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=YOUR_DB_PASSWORD
   DB_NAME=edushare_db
   JWT_SECRET=YOUR_SECURE_RANDOM_SECRET_KEY
   ```

4. Khởi động máy chủ:

   ```bash
   npm start
   ```

   > Nếu thiết lập đúng, Terminal sẽ thông báo Server khởi chạy thành công tại địa chỉ `http://localhost:3000`.

### 5.4 Cài Đặt Và Khởi Chạy Frontend

Dự án áp dụng mô hình thuần HTML/CSS/JS, do vậy không yêu cầu quy trình Build/Bundle phức tạp như React hay Vue.

1. Khuyến nghị sử dụng **Live Server** (extension trên VSCode) hoặc ứng dụng máy chủ tĩnh tương tự.
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
