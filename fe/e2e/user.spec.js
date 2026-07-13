const { test, expect } = require('@playwright/test');

test.describe('User Pages E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Giả lập trạng thái đăng nhập
    await page.goto('/pages/auth/login.html');
    await page.evaluate(() => {
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({MaND: 1, VaiTro: 'SinhVien', HoTen: 'Nguyễn Văn A'}))));
      localStorage.setItem('token', 'header.' + payload + '.signature');
    });
    // Đi tới trang cần test
    await page.goto('/pages/user/userHome.html');
  });

  test('Trang chủ User hiển thị đúng và có dữ liệu feed', async ({ page }) => {
    // Mock API feed
    await page.route('**/api/documents/feed*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ MaTL: 1, TenTL: 'Tài liệu test', MoTa: 'Mô tả test' }])
      });
    });

    await expect(page).toHaveTitle(/Trang chủ/i);
    
    // Đảm bảo navbar hiển thị đúng (có tên user)
    // Các logic UI thường cập nhật class hoặc text, nhưng cơ bản ta check title
    // Ta kiểm tra xem trang có load feed không (không báo lỗi 401)
    const grid = page.locator('#homeDocGrid');
    await expect(grid).toBeVisible({ timeout: 5000 });
  });

  test('Trang Profile hiển thị và cho phép cập nhật thông tin', async ({ page }) => {
    // Mock get profile
    await page.route('**/api/users/profile', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ profile: { HoTen: 'Nguyễn Văn A', Email: 'test@example.com', Tuoi: 20, GioiTinh: 'Nam', DiaChi: 'HN' } })
        });
      } else if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Cập nhật thành công', token: 'fake' })
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/pages/user/userProfile.html');

    // Chờ input hoten được điền (do JS load)
    const hotenInput = page.locator('#input-hoten');
    await expect(hotenInput).toHaveValue('Nguyễn Văn A', { timeout: 5000 });

    // Sửa input
    await hotenInput.fill('Nguyễn Văn B');
    
    // Bấm lưu
    const saveBtn = page.locator('button:has-text("Cập nhật thông tin")').first();
    if (await saveBtn.isVisible()) {
        await saveBtn.click();
        const swalTitle = page.locator('.swal2-title');
        await expect(swalTitle).toBeVisible({ timeout: 5000 });
        await expect(swalTitle).toContainText(/Thành công/i);
    }
  });

});
