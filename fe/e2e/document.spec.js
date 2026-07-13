const { test, expect } = require('@playwright/test');

test.describe('Document Pages E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Mock user login
    await page.goto('/pages/auth/login.html');
    await page.evaluate(() => {
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({MaND: 1, VaiTro: 'SinhVien', HoTen: 'Nguyễn Văn A'}))));
      localStorage.setItem('token', 'header.' + payload + '.signature');
    });
  });

  test('Trang Upload Document render form đầy đủ', async ({ page }) => {
    await page.goto('/pages/document/uploadDocument.html');
    await expect(page).toHaveTitle(/Đăng tải tài liệu/i);
    
    // Check form fields
    await expect(page.locator('#tenTL')).toBeVisible();
    await expect(page.locator('#fileUpload')).toBeAttached(); // Vì input[type=file] có display:none nên dùng toBeAttached hoặc kiểm tra button #btnSelectFile
    await expect(page.locator('#btnSelectFile')).toBeVisible();
  });

  test('Trang Search Results xử lý tìm kiếm', async ({ page }) => {
    // Mock API search
    await page.route('**/api/documents/search*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          documents: [{ MaTL: 1, TenTL: 'Toán Cao Cấp', MoTa: '...' }],
          pagination: { totalPages: 1, currentPage: 1 }
        })
      });
    });

    await page.goto('/pages/document/searchResults.html?q=Toan');
    await expect(page).toHaveTitle(/Kết quả tìm kiếm/);

    const docCard = page.locator('text=Toán Cao Cấp').first();
    await expect(docCard).toBeVisible({ timeout: 5000 });
  });

  test('Trang My Documents hiển thị tài liệu cá nhân', async ({ page }) => {
    await page.route('**/api/documents/my', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ MaTL: 2, TenTL: 'Tài liệu của tôi' }])
      });
    });

    await page.goto('/pages/document/myDocuments.html');
    const myDoc = page.locator('text=Tài liệu của tôi').first();
    await expect(myDoc).toBeVisible({ timeout: 5000 });
  });

});
