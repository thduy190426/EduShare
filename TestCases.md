# Môi Trường Kiểm Thử (Base URL)
- **Live Server URL:** `http://127.0.0.1:5501/fe` hoặc `http://127.0.0.1:5501/` (Tùy thuộc vào thư mục gốc đang mở trong Live Server). Tất cả các đường dẫn tương đối (ví dụ `http://127.0.0.1:5501/fe/pages/...`) bên dưới cần được nối với Base URL này khi chạy test.

---

# Test Cases cho Trang Đăng Nhập (Login Page)

Tài liệu này cung cấp toàn bộ thông tin chi tiết để AI Subagent có thể đọc, hiểu và thực hiện kiểm thử tự động (e2e testing) mượt mà trên trình duyệt đối với trang Đăng Nhập.

## 1. Thông tin trang
- **Đường dẫn (URL):** `http://127.0.0.1:5501/fe/pages/auth/login.html`
- **Mục đích:** Người dùng đăng nhập vào hệ thống EduShare.

## 2. Định danh các phần tử (Elements)
Dưới đây là các CSS Selectors quan trọng để AI Subagent tương tác với DOM:
- **Email Input:** `input#loginEmail`
- **Password Input:** `input#loginPassword`
- **Nút Hiển thị/Ẩn mật khẩu (Toggle Password):** `span#toggleLoginPassword`
- **Checkbox Ghi nhớ đăng nhập:** `input#rememberLogin`
- **Nút Đăng nhập (Submit Button):** `button[type="submit"]` hoặc `.btn.btn-primary`
- **Liên kết Quên mật khẩu:** `a.forgot-link`
- **Liên kết Đăng ký:** `a[href="register.html"]`
- **Khu vực hiển thị lỗi (Message):** `div#loginMessage` hoặc popup của SweetAlert2 (class `.swal2-popup`).

---

## 3. Luồng kiểm thử (Test Cases)

### Test Case 1: Đăng nhập thành công với thông tin hợp lệ
- **Luồng hoạt động:** Người dùng nhập đúng email, mật khẩu đã đăng ký và nhấn Đăng nhập.
- **Đầu vào (Inputs):**
  - Email: `duyhoangtran2006@gmail.com` (Một tài khoản hợp lệ đã có trong hệ thống)
  - Password: `Duy1tran!?` (Mật khẩu đúng)
- **Cách thao tác (Actions):**
  1. Điều hướng đến `http://127.0.0.1:5501/fe/pages/auth/login.html`
  2. Đợi trang tải xong, kiểm tra sự tồn tại của `input#loginEmail` và `input#loginPassword`.
  3. Xóa dữ liệu cũ (clear) và gõ vào `input#loginEmail` giá trị email.
  4. Xóa dữ liệu cũ (clear) và gõ vào `input#loginPassword` giá trị password.
  5. Nhấn click vào `button[type="submit"]`.
- **Đầu ra mong đợi (Outputs):**
  - Chuyển hướng (Redirect) thành công sang trang chủ (ví dụ: `http://127.0.0.1:5501/fe/pages/user/userHome.html` hoặc tương đương).
  - Hoặc xuất hiện thông báo (SweetAlert2) "Đăng nhập thành công".
  - Có token được lưu vào `localStorage` hoặc `sessionStorage`.

### Test Case 2: Đăng nhập thất bại do bỏ trống trường bắt buộc
- **Luồng hoạt động:** Người dùng không nhập dữ liệu mà nhấn thẳng nút Đăng nhập.
- **Đầu vào (Inputs):**
  - Email: `(trống)`
  - Password: `(trống)`
- **Cách thao tác (Actions):**
  1. Tải trang `http://127.0.0.1:5501/fe/pages/auth/login.html`
  2. Bỏ qua việc nhập liệu.
  3. Nhấn click vào `button[type="submit"]`.
- **Đầu ra mong đợi (Outputs):**
  - Trình duyệt chặn gửi form do thuộc tính `required` trên các ô input.
  - Form không được gửi đi, URL giữ nguyên.
  - Focus sẽ trỏ về trường đầu tiên bị thiếu dữ liệu.

### Test Case 3: Đăng nhập thất bại do email không đúng định dạng
- **Luồng hoạt động:** Người dùng nhập email không hợp lệ (thiếu @, thiếu domain) và mật khẩu hợp lệ.
- **Đầu vào (Inputs):**
  - Email: `duyhoangtran`
  - Password: `Duy1tran!?`
- **Cách thao tác (Actions):**
  1. Gõ `duyhoangtran` vào `input#loginEmail`.
  2. Gõ `Duy1tran!?` vào `input#loginPassword`.
  3. Nhấn click vào `button[type="submit"]`.
- **Đầu ra mong đợi (Outputs):**
  - Trình duyệt hiển thị tooltip/báo lỗi định dạng email do input có `type="email"`.
  - Không gửi request đến server, URL giữ nguyên.

### Test Case 4: Đăng nhập thất bại do sai mật khẩu hoặc tài khoản không tồn tại
- **Luồng hoạt động:** Người dùng nhập email hợp lệ nhưng sai mật khẩu, hoặc email chưa được đăng ký.
- **Đầu vào (Inputs):**
  - Email: `notexist@example.com` hoặc tài khoản đúng nhưng sai mật khẩu.
  - Password: `WrongPassword123!`
- **Cách thao tác (Actions):**
  1. Gõ `notexist@example.com` vào `input#loginEmail`.
  2. Gõ `WrongPassword123!` vào `input#loginPassword`.
  3. Nhấn click vào `button[type="submit"]`.
- **Đầu ra mong đợi (Outputs):**
  - Xuất hiện thông báo lỗi tại `div#loginMessage` hoặc popup SweetAlert2 với nội dung báo lỗi (ví dụ: "Sai tài khoản hoặc mật khẩu").
  - Vẫn ở lại trang `http://127.0.0.1:5501/fe/pages/auth/login.html`.

### Test Case 5: Kiểm tra tính năng Hiển thị/Ẩn mật khẩu (Toggle Password)
- **Luồng hoạt động:** Người dùng nhấp vào biểu tượng con mắt để xem mật khẩu đang nhập.
- **Đầu vào (Inputs):**
  - Password: `SecretPass456`
- **Cách thao tác (Actions):**
  1. Gõ `SecretPass456` vào `input#loginPassword`.
  2. Kiểm tra thuộc tính `type` của `input#loginPassword` (phải là `password`).
  3. Click vào `span#toggleLoginPassword`.
  4. Kiểm tra lại thuộc tính `type` của `input#loginPassword` (phải là `text`).
  5. Click lại vào `span#toggleLoginPassword`.
  6. Kiểm tra lại thuộc tính `type` (phải trở về `password`).
- **Đầu ra mong đợi (Outputs):**
  - Input mật khẩu chuyển đổi qua lại giữa dạng ẩn (dấu chấm) và dạng chữ rõ ràng mà không mất dữ liệu đang nhập.

### Test Case 6: Kiểm tra chức năng "Ghi nhớ đăng nhập" (Remember Me)
- **Luồng hoạt động:** Người dùng đăng nhập thành công với checkbox Remember Me được chọn.
- **Đầu vào (Inputs):**
  - Email: `duyhoangtran2006@gmail.com`
  - Password: `Duy1tran!?`
  - Remember Me: `checked`
- **Cách thao tác (Actions):**
  1. Nhập thông tin hợp lệ.
  2. Click vào `input#rememberLogin` để tick checkbox.
  3. Nhấn click vào `button[type="submit"]`.
  4. Sau khi đăng nhập thành công, tắt trình duyệt / tải lại trang.
- **Đầu ra mong đợi (Outputs):**
  - Trạng thái đăng nhập được duy trì nhờ token/cookie lưu lâu dài ở `localStorage` (chứ không phải `sessionStorage`).
  - Mở lại trang `http://127.0.0.1:5501/fe/pages/user/userHome.html` không bị bắt đăng nhập lại.

### Test Case 7: Điều hướng từ trang Đăng nhập sang trang Đăng ký và Quên mật khẩu
- **Luồng hoạt động:** Nhấn vào các liên kết điều hướng có sẵn trên trang.
- **Cách thao tác (Actions):**
  1. Click vào liên kết `a[href="register.html"]`.
  2. Kiểm tra điều hướng thành công đến `http://127.0.0.1:5501/fe/pages/auth/register.html`.
  3. Từ `http://127.0.0.1:5501/fe/pages/auth/register.html`, quay lại trang `http://127.0.0.1:5501/fe/pages/auth/login.html`.
  4. Click vào liên kết `a.forgot-link`.
- **Đầu ra mong đợi (Outputs):**
  - Trình duyệt điều hướng thành công đúng URL.

---

# Test Cases cho Trang Đăng Ký (Register Page)

## 1. Thông tin trang
- **Đường dẫn (URL):** `http://127.0.0.1:5501/fe/pages/auth/register.html`
- **Mục đích:** Người dùng tạo tài khoản mới trên EduShare.

## 2. Định danh các phần tử (Elements)
- **Chọn vai trò (Role):** `input[name="role"]` (giá trị: `student` hoặc `teacher`)
- **Họ và tên:** `input#registerName`
- **Email:** `input#registerEmail`
- **Mật khẩu:** `input#registerPassword`
- **Xác nhận mật khẩu:** `input#registerConfirmPassword`
- **Toggle Mật khẩu:** `span#toggleRegisterPassword` và `span#toggleConfirmPassword`
- **Đồng ý điều khoản:** `input#registerAgreeTerms`
- **Nút Đăng ký:** `button[type="submit"]`
- **Khu vực hiển thị lỗi:** `div#registerMessage` hoặc popup `.swal2-popup`

## 3. Luồng kiểm thử (Test Cases)

### Test Case 1: Đăng ký thành công (Sinh viên)
- **Luồng hoạt động:** Nhập đầy đủ và hợp lệ thông tin cho vai trò Sinh viên.
- **Đầu vào (Inputs):** 
  - Họ tên: `Nguyễn Văn A`
  - Email: `nva@example.com`
  - Mật khẩu: `Pass123!`
  - Xác nhận: `Pass123!`
  - Check điều khoản: `true` (checked)
  - Vai trò: `student` (checked default)
- **Cách thao tác (Actions):** 
  1. Điều hướng đến `http://127.0.0.1:5501/fe/pages/auth/register.html`.
  2. Gõ các thông tin trên vào các input tương ứng.
  3. Đảm bảo radio button `input[name="role"][value="student"]` đang được chọn.
  4. Click checkbox `#registerAgreeTerms`.
  5. Nhấn `button[type="submit"]`.
- **Đầu ra mong đợi (Outputs):** 
  - Thông báo đăng ký thành công (SweetAlert2).
  - Tự động chuyển hướng về trang Đăng nhập (`http://127.0.0.1:5501/fe/pages/auth/login.html`).

### Test Case 2: Đăng ký thành công (Giảng viên)
- **Luồng hoạt động:** Nhập đầy đủ và hợp lệ thông tin cho vai trò Giảng viên.
- **Đầu vào (Inputs):** 
  - Họ tên: `Trần Thị B`
  - Email: `ttb@example.com`
  - Mật khẩu: `Pass123!`
  - Xác nhận: `Pass123!`
  - Check điều khoản: `true` (checked)
  - Vai trò: `teacher`
- **Cách thao tác (Actions):** 
  1. Điều hướng đến `http://127.0.0.1:5501/fe/pages/auth/register.html`.
  2. Click chọn `input[name="role"][value="teacher"]`.
  3. Điền đầy đủ thông tin hợp lệ.
  4. Click checkbox `#registerAgreeTerms`.
  5. Nhấn `button[type="submit"]`.
- **Đầu ra mong đợi (Outputs):** 
  - Thông báo đăng ký thành công (SweetAlert2).
  - Tự động chuyển hướng về trang Đăng nhập.

### Test Case 3: Đăng ký thất bại do bỏ trống trường bắt buộc
- **Luồng hoạt động:** Không điền thông tin mà submit form.
- **Đầu vào (Inputs):** Các trường bỏ trống.
- **Cách thao tác (Actions):** Nhấn `button[type="submit"]`.
- **Đầu ra mong đợi (Outputs):** Form bị chặn gửi do `required`, trình duyệt trỏ focus về ô input đầu tiên chưa điền.

### Test Case 4: Đăng ký thất bại do email không hợp lệ hoặc đã tồn tại
- **Luồng hoạt động:** Nhập email đã có trong DB hoặc sai định dạng.
- **Đầu vào (Inputs):** 
  - Email: `duyhoangtran2006@gmail.com` (đã tồn tại)
  - Hoặc Email: `invalid-email-format`
- **Cách thao tác (Actions):** Điền các trường khác hợp lệ, nhập email lỗi và submit.
- **Đầu ra mong đợi (Outputs):** 
  - Nếu sai định dạng: Trình duyệt chặn gửi.
  - Nếu đã tồn tại: API trả về lỗi, xuất hiện SweetAlert2 báo "Email đã được sử dụng".

### Test Case 5: Đăng ký thất bại do mật khẩu không khớp
- **Luồng hoạt động:** Nhập mật khẩu và xác nhận mật khẩu khác nhau.
- **Đầu vào (Inputs):** Mật khẩu: `Pass123!`, Xác nhận: `Pass456!`.
- **Cách thao tác (Actions):** Điền form đầy đủ nhưng cố tình gõ sai ô xác nhận mật khẩu. Nhấn Submit.
- **Đầu ra mong đợi (Outputs):** 
  - Báo lỗi "Mật khẩu xác nhận không khớp" tại `#registerMessage` hoặc SweetAlert, form không được gửi đi.

### Test Case 6: Đăng ký thất bại do mật khẩu không đủ độ mạnh
- **Luồng hoạt động:** Nhập mật khẩu quá ngắn.
- **Đầu vào (Inputs):** Mật khẩu: `123`
- **Cách thao tác (Actions):** Nhập mật khẩu `123`, xác nhận `123`.
- **Đầu ra mong đợi (Outputs):** Hiển thị lỗi mật khẩu phải dài ít nhất 6 ký tự (nếu có validation độ mạnh). Form không được gửi.

### Test Case 7: Đăng ký thất bại do chưa đồng ý điều khoản
- **Luồng hoạt động:** Nhập đúng mọi thông tin nhưng không tick điều khoản.
- **Đầu vào (Inputs):** Bỏ trống `#registerAgreeTerms`.
- **Cách thao tác (Actions):** Nhấn Submit.
- **Đầu ra mong đợi (Outputs):** Báo lỗi yêu cầu phải đồng ý điều khoản, hoặc trình duyệt chặn do required checkbox. Form không được gửi.

### Test Case 8: Kiểm tra tính năng Hiển thị/Ẩn mật khẩu
- **Luồng hoạt động:** Test toggle password trên cả 2 trường mật khẩu.
- **Cách thao tác (Actions):** 
  1. Gõ mật khẩu.
  2. Click `span#toggleRegisterPassword` và `span#toggleConfirmPassword`.
- **Đầu ra mong đợi (Outputs):** Cả 2 trường Input mật khẩu chuyển đổi qua lại giữa `type="password"` và `type="text"` một cách độc lập và chính xác mà không mất dữ liệu.

---

# Test Cases cho Trang Đăng tải tài liệu (Upload Document Page)

## 1. Thông tin trang
- **Đường dẫn (URL):** `http://127.0.0.1:5501/fe/pages/document/uploadDocument.html`
- **Mục đích:** Người dùng (đã đăng nhập) upload file tài liệu mới lên hệ thống.

## 2. Định danh các phần tử (Elements)
- **Tên tài liệu:** `input#tenTL`
- **Môn học:** `select#maMonHoc`
- **Loại file:** `input[name="filetype"]` (radio box)
- **Mô tả:** `textarea#moTa`
- **Tài liệu chính thống (Dành cho GV/Admin):** `input#laTaiLieuChinhThuc`
- **Tệp đính kèm (File input ẩn):** `input#fileUpload`
- **Nút chọn file (Hiển thị):** `button#btnSelectFile`
- **Hiển thị tên file đã chọn:** `div#previewName`
- **Nút đăng tài liệu:** `button[type="submit"]`

## 3. Luồng kiểm thử (Test Cases)

### Test Case 1: Đăng tải tài liệu thành công
- **Luồng hoạt động:** Điền đầy đủ form và đính kèm 1 file PDF hợp lệ, sau đó submit.
- **Đầu vào (Inputs):**
  - Tên: `Tài liệu Giải tích 1`
  - Môn học: Chọn `value` hợp lệ từ `select#maMonHoc`.
  - File: `test_document.pdf` (dung lượng < 20MB).
- **Cách thao tác (Actions):**
  1. Điều hướng đến `http://127.0.0.1:5501/fe/pages/document/uploadDocument.html`.
  2. Gõ "Tài liệu Giải tích 1" vào `#tenTL`.
  3. Chọn option tương ứng từ dropdown `#maMonHoc`.
  4. Dùng lệnh `selectFile('path/to/test_document.pdf', { force: true })` cho `input#fileUpload` (bắt buộc dùng `{ force: true }` vì input này bị ẩn bằng CSS `display: none`).
  5. Xác minh UI hiển thị tên file ở `div#previewName`.
  6. Nhấn `button[type="submit"]`.
- **Đầu ra mong đợi (Outputs):** API báo thành công, hiển thị thông báo SweetAlert2 "Tải lên thành công" và chuyển hướng về trang danh sách tài liệu hoặc chi tiết.

### Test Case 2: Upload file sai định dạng
- **Luồng hoạt động:** Cố tình upload file không thuộc nhóm PDF, DOCX, PPTX (ví dụ file .exe).
- **Đầu vào (Inputs):** File `malware.exe`.
- **Cách thao tác (Actions):** Đính kèm file `malware.exe` vào `input#fileUpload` (dùng force: true).
- **Đầu ra mong đợi (Outputs):** Ngay khi đính kèm hoặc khi ấn submit, hệ thống từ chối và báo lỗi "Chỉ hỗ trợ định dạng PDF, DOCX, PPTX".

---

## 4. Hướng dẫn chung cho AI Subagent
- **Wait / Timeout:** Khi thao tác click Submit liên quan đến API hoặc Upload file (có thể mất thời gian), hãy thêm lệnh `wait` (ví dụ `cy.intercept` chờ API phản hồi).
- **SweetAlert2:** Toàn hệ thống dùng SweetAlert2 để thông báo, popup luôn có class `.swal2-container` / `.swal2-popup`. Hãy dùng CSS selector này để assert các thông báo.
- **Trạng thái ẩn:** Với input file ẩn (`display: none`), AI nhớ dùng tham số `{ force: true }` khi tương tác (đặc biệt trong Cypress) để không bị lỗi element not visible.

---

# Test Cases cho Trang Chủ (User Home Page)

## 1. Thông tin trang
- **Đường dẫn (URL):** `http://127.0.0.1:5501/fe/pages/user/userHome.html`
- **Mục đích:** Trang chính hiển thị sau khi đăng nhập, nơi người dùng có thể tìm kiếm, xem môn học của mình và tài liệu mới.

## 2. Định danh các phần tử (Elements)
- **Thanh tìm kiếm:** `input[placeholder="Tìm kiếm tài liệu, môn học, giáo trình..."]` hoặc `.nav-search input`
- **Nút Thêm môn học:** `button#btn-customize-subjects`
- **Danh sách môn học của tôi:** `div#mySubjectGrid`
- **Danh sách tài liệu mới:** `div#homeDocGrid`
- **Nút Đăng tải tài liệu:** `a[href="../document/uploadDocument.html"]`

## 3. Luồng kiểm thử (Test Cases)

### Test Case 1: Tìm kiếm từ khóa trên thanh Navbar
- **Luồng hoạt động:** Nhập từ khóa vào thanh tìm kiếm trên navbar và nhấn Enter.
- **Đầu vào (Inputs):** Từ khóa: `Toán`
- **Cách thao tác (Actions):**
  1. Điều hướng đến `http://127.0.0.1:5501/fe/pages/user/userHome.html`.
  2. Gõ `Toán` vào `div.nav-search input`.
  3. Nhấn phím `Enter`.
- **Đầu ra mong đợi (Outputs):** Trình duyệt điều hướng sang trang `http://127.0.0.1:5501/fe/pages/document/searchResults.html?q=Toán`.

### Test Case 2: Mở modal thêm môn học
- **Luồng hoạt động:** Người dùng click vào nút Thêm môn học.
- **Cách thao tác (Actions):**
  1. Điều hướng đến `http://127.0.0.1:5501/fe/pages/user/userHome.html`.
  2. Click vào `button#btn-customize-subjects`.
- **Đầu ra mong đợi (Outputs):** Modal có id `addSubjectModal` xuất hiện (display: block/flex).

---

# Test Cases cho Trang Hồ Sơ Cá Nhân (User Profile Page)

## 1. Thông tin trang
- **Đường dẫn (URL):** `http://127.0.0.1:5501/fe/pages/user/userProfile.html`
- **Mục đích:** Xem, chỉnh sửa thông tin cá nhân và quản lý tài liệu cá nhân.

## 2. Định danh các phần tử (Elements)
- **Họ và tên:** `input#input-hoten`
- **Tuổi:** `input#input-tuoi`
- **Giới tính:** `select#input-gioitinh`
- **Địa chỉ:** `input#input-diachi`
- **Nút Lưu thay đổi:** `button#btn-save-profile`
- **Upload Avatar:** `input#input-avatar`
- **Tab Tài liệu của tôi:** `div#tab-my-docs`
- **Tab Tài liệu đã lưu:** `div#tab-bookmarks`

## 3. Luồng kiểm thử (Test Cases)

### Test Case 1: Cập nhật thông tin cá nhân thành công
- **Luồng hoạt động:** Thay đổi các trường thông tin cơ bản và lưu lại.
- **Đầu vào (Inputs):** Họ tên mới: `Nguyễn Văn B`, Tuổi: `22`
- **Cách thao tác (Actions):**
  1. Điều hướng đến `http://127.0.0.1:5501/fe/pages/user/userProfile.html`.
  2. Clear nội dung cũ và gõ `Nguyễn Văn B` vào `#input-hoten`.
  3. Clear nội dung cũ và gõ `22` vào `#input-tuoi`.
  4. Chọn option `Nam` tại `select#input-gioitinh`.
  5. Click `button#btn-save-profile`.
- **Đầu ra mong đợi (Outputs):** Có thông báo thành công (SweetAlert2) và tên trên `#header-name` hiển thị `Nguyễn Văn B`.

---

# Test Cases cho Trang Chi Tiết Tài Liệu (Document Details Page)

## 1. Thông tin trang
- **Đường dẫn (URL):** `http://127.0.0.1:5501/fe/pages/document/documentDetails.html?id=...`
- **Mục đích:** Hiển thị chi tiết một tài liệu, cho phép tải xuống, đánh giá, bình luận.

## 2. Định danh các phần tử (Elements)
- **Nút Tải xuống:** `button#btn-download`
- **Nút Lưu Bookmark:** `button#btn-bookmark`
- **Khu vực đánh giá sao:** `div#doc-rating-stars i.fa-star`
- **Ô nhập bình luận:** `textarea#comment-input`
- **Nút gửi bình luận:** `button#btn-submit-comment`
- **Danh sách bình luận:** `div#comments-list`

## 3. Luồng kiểm thử (Test Cases)

### Test Case 1: Đánh giá tài liệu (Rating)
- **Luồng hoạt động:** Click vào ngôi sao thứ 5 để đánh giá 5 sao.
- **Cách thao tác (Actions):**
  1. Điều hướng đến trang chi tiết tài liệu với tham số id hợp lệ.
  2. Click vào thẻ `i` có `data-val="5"` trong `div#doc-rating-stars`.
- **Đầu ra mong đợi (Outputs):** Thông báo đánh giá thành công và điểm đánh giá tại `#doc-rating-score` được cập nhật.

### Test Case 2: Thêm bình luận
- **Luồng hoạt động:** Nhập nội dung bình luận và gửi.
- **Đầu vào (Inputs):** Nội dung: `Tài liệu rất hay!`
- **Cách thao tác (Actions):**
  1. Gõ `Tài liệu rất hay!` vào `textarea#comment-input`.
  2. Click `button#btn-submit-comment`.
- **Đầu ra mong đợi (Outputs):** Bình luận mới xuất hiện ngay lập tức tại phần đầu của danh sách `#comments-list`.

---

# Test Cases cho Trang Kết Quả Tìm Kiếm (Search Results Page)

## 1. Thông tin trang
- **Đường dẫn (URL):** `http://127.0.0.1:5501/fe/pages/document/searchResults.html`
- **Mục đích:** Lọc và hiển thị danh sách tài liệu theo từ khóa và các tiêu chí khác.

## 2. Định danh các phần tử (Elements)
- **Input tìm kiếm:** `input#searchInput`
- **Sắp xếp theo:** `select#sortSelect`
- **Bộ lọc Loại file:** `input[name="loaiFile"]`
- **Danh sách kết quả:** `div#resultsGrid`

## 3. Luồng kiểm thử (Test Cases)

### Test Case 1: Lọc kết quả theo định dạng PDF
- **Luồng hoạt động:** Chọn bộ lọc loại file là PDF.
- **Cách thao tác (Actions):**
  1. Điều hướng đến `http://127.0.0.1:5501/fe/pages/document/searchResults.html`.
  2. Click vào checkbox `input[name="loaiFile"][value="pdf"]`.
- **Đầu ra mong đợi (Outputs):** Lưới `#resultsGrid` cập nhật và chỉ hiển thị các tài liệu có định dạng PDF.

---

# Test Cases cho Trang Danh Sách Nhóm (Group List Page)

## 1. Thông tin trang
- **Đường dẫn (URL):** `http://127.0.0.1:5501/fe/pages/group/groupList.html`
- **Mục đích:** Hiển thị và tìm kiếm các nhóm học tập, tạo nhóm mới.

## 2. Định danh các phần tử (Elements)
- **Nút Tạo nhóm mới:** `button#btn-create-group`
- **Input Tên nhóm (Modal):** `input#new-group-name`
- **Select Môn học (Modal):** `select#new-group-subject`
- **Nút Xác nhận tạo:** `button#btn-confirm-create-group`
- **Danh sách nhóm:** `div#group-grid`

## 3. Luồng kiểm thử (Test Cases)

### Test Case 1: Tạo nhóm học tập mới
- **Luồng hoạt động:** Mở form, nhập tên nhóm và lưu.
- **Đầu vào (Inputs):** Tên nhóm: `Nhóm học Toán CC`
- **Cách thao tác (Actions):**
  1. Điều hướng đến `http://127.0.0.1:5501/fe/pages/group/groupList.html`.
  2. Click `button#btn-create-group`.
  3. Đợi modal xuất hiện, gõ `Nhóm học Toán CC` vào `input#new-group-name`.
  4. Chọn 1 option hợp lệ tại `select#new-group-subject`.
  5. Click `button#btn-confirm-create-group`.
- **Đầu ra mong đợi (Outputs):** Có thông báo tạo nhóm thành công (SweetAlert2), modal tự đóng và nhóm mới xuất hiện trong `div#group-grid`.
