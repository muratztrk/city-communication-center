import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, API_BASE_URL, MANAGER_EMAIL, TIRE_TENANT_ID, authenticateApi, login, logout } from './helpers';

// Scenario:
// 1. Admin logs in.
// 2. Settings menu is visible for authorized role.
// 3. Social channel configuration surface renders with actionable controls.

test('admin can see and open settings', async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  const settingsButton = page.getByRole('button', { name: '⚙️ Ayarlar' });
  await expect(settingsButton).toBeVisible();
  await settingsButton.click();

  await expect(page.getByRole('heading', { name: /Ayarlar/i })).toBeVisible();
  await expect(page.locator('h3').filter({ hasText: 'X (Twitter)' })).toBeVisible();
  await expect(page.locator('h3').filter({ hasText: 'Instagram' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yapılandır' }).first()).toBeVisible();
});

test('manager cannot see settings navigation', async ({ page }) => {
  await login(page, MANAGER_EMAIL, ADMIN_PASSWORD);

  await expect(page.getByRole('button', { name: '⚙️ Ayarlar' })).toHaveCount(0);

  await logout(page);
  await page.goto('/');
  await page.getByLabel('Belediye').selectOption(TIRE_TENANT_ID);
  await page.getByLabel('Kullanıcı Adı / E-posta').fill(MANAGER_EMAIL);
  await page.getByLabel('Şifre').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await expect(page.getByRole('heading', { name: '📊 Kontrol Paneli' })).toBeVisible();
  await expect(page.getByRole('button', { name: '⚙️ Ayarlar' })).toHaveCount(0);
});

test('manager token cannot access platform admin endpoints', async ({ request }) => {
  const session = await authenticateApi(request, MANAGER_EMAIL, ADMIN_PASSWORD);

  const response = await request.get(`${API_BASE_URL}/api/v1/admin/audit-logs`, {
    headers: {
      Authorization: `Bearer ${session.token}`,
      'X-Tenant-Id': session.tenantId,
    },
  });

  expect(response.status()).toBe(403);
});