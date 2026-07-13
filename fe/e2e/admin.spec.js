const { test, expect } = require('@playwright/test');

test.describe('Admin Pages E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Mock user login AS ADMIN
    await page.goto('/pages/auth/login.html');
    await page.evaluate(() => {
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({MaND: 99, VaiTro: 'Admin', HoTen: 'Admin'}))));
      localStorage.setItem('token', 'header.' + payload + '.signature');
    });
  });

  test('Admin Dashboard hiển thị thống kê', async ({ page }) => {
    await page.route('**/api/admin/stats/overview*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: 10,
          documents: 100,
          downloads: 50,
          pendingReports: 5
        })
      });
    });

    await page.goto('/pages/admin/adminDashboard.html');
    await expect(page).toHaveTitle(/Dashboard/i);
    
    // Check nếu load thành công
    const userStat = page.locator('#stat-users');
    await expect(userStat).toHaveText('10', { timeout: 5000 });
  });

  test('Admin Moderation (Duyệt tài liệu)', async ({ page }) => {
    await page.route('**/api/admin/documents/list*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          MaTL: 1, TenTL: 'Tài liệu cần duyệt', NguoiDang: 'Nguyễn Văn A'
        }])
      });
    });

    await page.goto('/pages/admin/adminModeration.html');
    const docName = page.locator('text=Tài liệu cần duyệt').first();
    await expect(docName).toBeVisible({ timeout: 5000 });
  });

});
