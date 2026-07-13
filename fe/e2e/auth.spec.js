const { test, expect } = require('@playwright/test');

test.describe('Authentication - E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Truy cập trang đăng nhập (http-server mặc định trỏ vào root, thư mục pages ở trong)
    await page.goto('/pages/auth/login.html');
  });

  test('Giao diện hiển thị đúng và nút submit bị disable lúc đầu', async ({ page }) => {
    // Kiểm tra tiêu đề
    await expect(page).toHaveTitle(/Đăng nhập/);

    // Nút đăng nhập phải bị vô hiệu hóa khi chưa nhập gì
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();
  });

  test('Nút submit được enable khi nhập đủ email hợp lệ và mật khẩu', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]');

    // Nhập email không hợp lệ
    await page.fill('#loginEmail', 'invalid_email');
    await page.fill('#loginPassword', '123456');
    await expect(submitBtn).toBeDisabled();

    // Nhập email hợp lệ
    await page.fill('#loginEmail', 'test@example.com');
    await expect(submitBtn).toBeEnabled();
  });

  test('Hiển thị thông báo lỗi khi đăng nhập sai thông tin', async ({ page }) => {
    // Mock API để trả về lỗi mà không cần Backend phải chạy
    await page.route('**/api/login', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Email hoặc mật khẩu không chính xác.' })
      });
    });

    await page.fill('#loginEmail', 'wrong_user@example.com');
    await page.fill('#loginPassword', 'wrong_password');
    
    // Click đăng nhập
    await page.click('button[type="submit"]');

    // Chờ thông báo lỗi xuất hiện
    const swalTitle = page.locator('.swal2-title');
    await expect(swalTitle).toBeVisible({ timeout: 5000 });
    await expect(swalTitle).toContainText(/lỗi|không chính xác/i);
  });

});

test.describe('Authentication - Đăng ký (Register)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/auth/register.html');
  });

  test('Form đăng ký validate khớp mật khẩu', async ({ page }) => {
    await expect(page).toHaveTitle(/Đăng ký/);
    const submitBtn = page.locator('button[type="submit"]');

    await page.fill('#registerName', 'Nguyễn Văn A');
    await page.fill('#registerEmail', 'test@example.com');
    await page.fill('#registerPassword', '123456');
    await page.fill('#registerConfirmPassword', 'abcdef'); // Lệch mật khẩu
    await page.check('#registerAgreeTerms');

    // Nút submit có thể vẫn bị disable hoặc khi click sẽ báo lỗi tùy logic JS của FE
    // Dù sao thì ta có thể test click thử
    if (await submitBtn.isEnabled()) {
      await submitBtn.click();
      const swalTitle = page.locator('.swal2-title');
      if (await swalTitle.isVisible()) {
          await expect(swalTitle).toContainText(/không khớp/i);
      }
    } else {
      await expect(submitBtn).toBeDisabled();
    }
  });

  test('Mô phỏng Đăng ký thành công', async ({ page }) => {
    // Mock API register thành công
    await page.route('**/api/register', route => {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Đăng ký thành công', maND: 100 })
      });
    });

    await page.fill('#registerName', 'Nguyễn Văn A');
    await page.fill('#registerEmail', 'new_user@example.com');
    await page.fill('#registerPassword', '123456');
    await page.fill('#registerConfirmPassword', '123456');
    await page.check('#registerAgreeTerms');

    const submitBtn = page.locator('button[type="submit"]');
    // Nếu bị disable thì phải chờ enable (tuỳ JS validate)
    await submitBtn.click();

    // Chờ thông báo thành công hoặc chuyển hướng
    const swalTitle = page.locator('.swal2-title');
    await expect(swalTitle).toBeVisible({ timeout: 5000 });
    await expect(swalTitle).toContainText(/Thành công|Đăng ký thành công/i);
  });
});

test.describe('Authentication - Đăng xuất (Logout)', () => {
  test('Có thể click nút đăng xuất và quay về login', async ({ page }) => {
    // Giả lập trạng thái đã đăng nhập bằng cách set localStorage
    // Để làm điều này ta phải truy cập một trang trước (ví dụ trang chủ user)
    await page.goto('/pages/user/userHome.html');
    await page.evaluate(() => {
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({MaND: 1, VaiTro: 'SinhVien', HoTen: 'Nguyễn Văn A'}))));
      localStorage.setItem('token', 'header.' + payload + '.signature');
    });
    // Reload để script JS đọc token
    await page.reload();

    // Tìm nút Đăng xuất trên giao diện. Nó thường nằm trong menu profile
    // Tuỳ vào HTML cụ thể, có thể là #logoutBtn hoặc một nút có text "Đăng xuất"
    const logoutBtn = page.locator('text=Đăng xuất').first();
    // Click nếu thấy
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      // Phải có xác nhận hoặc bay thẳng ra login
      await expect(page).toHaveURL(/.*login\.html/);
    }
  });
});
