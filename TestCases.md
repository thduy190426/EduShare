# Test Cases cho Trang Đăng Nhập (Login Page)

Tài liệu này cung cấp toàn bộ thông tin chi tiết để AI Subagent có thể đọc, hiểu và thực hiện kiểm thử tự động (e2e testing) mượt mà trên trình duyệt đối với trang Đăng Nhập.

## 1. Thông tin trang
- **Đường dẫn (URL):** `/pages/auth/login.html`
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
  - Email: `user@example.com` (Một tài khoản hợp lệ đã có trong hệ thống)
  - Password: `Password123!` (Mật khẩu đúng)
- **Cách thao tác (Actions):**
  1. Điều hướng đến `/pages/auth/login.html`
  2. Xóa dữ liệu cũ (clear) và gõ vào `input#loginEmail` giá trị email.
  3. Xóa dữ liệu cũ (clear) và gõ vào `input#loginPassword` giá trị password.
  4. Nhấn click vào `button[type="submit"]`.
- **Đầu ra mong đợi (Outputs):**
  - Chuyển hướng (Redirect) thành công sang trang chủ (ví dụ: `/pages/user/home.html` hoặc tương đương).
  - Hoặc xuất hiện thông báo (SweetAlert2) "Đăng nhập thành công".
  - Có token được lưu vào `localStorage` hoặc `sessionStorage`.

### Test Case 2: Đăng nhập thất bại do bỏ trống trường bắt buộc
- **Luồng hoạt động:** Người dùng không nhập dữ liệu mà nhấn thẳng nút Đăng nhập.
- **Đầu vào (Inputs):**
  - Email: `(trống)`
  - Password: `(trống)`
- **Cách thao tác (Actions):**
  1. Tải trang `/pages/auth/login.html`
  2. Bỏ qua việc nhập liệu.
  3. Nhấn click vào `button[type="submit"]`.
- **Đầu ra mong đợi (Outputs):**
  - Trình duyệt chặn gửi form do thuộc tính `required` trên các ô input.
  - Form không được gửi đi, URL giữ nguyên.

### Test Case 3: Đăng nhập thất bại do sai mật khẩu hoặc tài khoản không tồn tại
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
  - Vẫn ở lại trang `/pages/auth/login.html`.

### Test Case 4: Kiểm tra tính năng Hiển thị/Ẩn mật khẩu (Toggle Password)
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

### Test Case 5: Điều hướng từ trang Đăng nhập sang trang Đăng ký
- **Luồng hoạt động:** Người dùng chưa có tài khoản và nhấn vào nút Đăng ký ngay.
- **Đầu vào (Inputs):** Không cần nhập liệu.
- **Cách thao tác (Actions):**
  1. Click vào liên kết `a[href="register.html"]`.
- **Đầu ra mong đợi (Outputs):**
  - Trình duyệt điều hướng thành công đến trang `/pages/auth/register.html`.

---

# Test Cases cho Trang Đăng Ký (Register Page)

## 1. Thông tin trang
- **Đường dẫn (URL):** `/pages/auth/register.html`
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
  1. Điều hướng đến `/pages/auth/register.html`.
  2. Gõ các thông tin trên vào các input tương ứng.
  3. Click checkbox `#registerAgreeTerms`.
  4. Nhấn `button[type="submit"]`.
- **Đầu ra mong đợi (Outputs):** Thông báo đăng ký thành công, tự động chuyển hướng về trang Đăng nhập (`login.html`).

### Test Case 2: Đăng ký thất bại do mật khẩu không khớp
- **Luồng hoạt động:** Nhập mật khẩu và xác nhận mật khẩu khác nhau.
- **Đầu vào (Inputs):** Mật khẩu: `Pass123!`, Xác nhận: `Pass456!`.
- **Cách thao tác (Actions):** Điền form đầy đủ nhưng cố tình gõ sai ô xác nhận mật khẩu. Nhấn Submit.
- **Đầu ra mong đợi (Outputs):** Báo lỗi "Mật khẩu xác nhận không khớp" tại `#registerMessage` hoặc SweetAlert, form không được gửi đi.

---

# Test Cases cho Trang Đăng tải tài liệu (Upload Document Page)

## 1. Thông tin trang
- **Đường dẫn (URL):** `/pages/document/uploadDocument.html`
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
  1. Điều hướng đến `/pages/document/uploadDocument.html`.
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
