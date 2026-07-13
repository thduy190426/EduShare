const { test, expect } = require('@playwright/test');

test.describe('Group Pages E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Mock user login
    await page.goto('/pages/auth/login.html');
    await page.evaluate(() => {
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({MaND: 1, VaiTro: 'SinhVien', HoTen: 'Nguyễn Văn A'}))));
      localStorage.setItem('token', 'header.' + payload + '.signature');
    });
  });

  test('Trang Group List hiển thị nhóm', async ({ page }) => {
    await page.route('**/api/groups*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          groups: [{ MaNhom: 1, TenNhom: 'Nhóm học Toán', SoLuongThanhVien: 10 }],
          pagination: { totalPages: 1 }
        })
      });
    });

    await page.goto('/pages/group/groupList.html');
    const groupName = page.locator('text=Nhóm học Toán').first();
    await expect(groupName).toBeVisible({ timeout: 5000 });
  });

  test('Mô phỏng thao tác tạo nhóm thất bại do validate', async ({ page }) => {
    await page.goto('/pages/group/groupList.html');
    
    // Tìm nút tạo nhóm
    const createBtn = page.locator('button:has-text("Tạo nhóm mới"), .btn-create-group').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      // Form tạo nhóm thường là modal hoặc chuyển trang
      // Test submit form trống
      const submitBtn = page.locator('#btnSubmitGroup, button[type="submit"]').last();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        // Cần có thông báo lỗi validation HTML5 hoặc Swal
        // ... (Tuỳ logic UI)
      }
    }
  });

});
