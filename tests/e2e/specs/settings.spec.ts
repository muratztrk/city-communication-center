import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, API_BASE_URL, MANAGER_EMAIL, authenticateApi, login, logout, selectTenantIfVisible } from './helpers';

// Scenario:
// 1. Admin logs in.
// 2. Settings menu is visible for authorized role.
// 3. Tenant-scoped LDAP settings render before switching to social configuration.
// 4. Social channel configuration surface renders with actionable controls.

test('admin can see and open settings', async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  const settingsButton = page.getByRole('button', { name: '⚙️ Ayarlar' });
  await expect(settingsButton).toBeVisible();
  await settingsButton.click();

  await expect(page.getByRole('heading', { name: '⚙️ Ayarlar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Tenant LDAP ayarları/i })).toBeVisible();
  await expect(page.getByLabel('LDAP giriş ve import açık')).toBeVisible();
  await expect(page.getByLabel('LDAP sunucusu')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Tenant kimlik politikası/i })).toBeVisible();
  await expect(page.getByLabel('Güvenilen iç ağ aralıkları (CIDR)')).toBeVisible();
  await expect(page.getByLabel('Kimlik header adı')).toBeVisible();
  await page.locator('.tab-bar').getByRole('button', { name: '📱 Sosyal Medya' }).click();
  await expect(page).toHaveURL(/tab=social/);
  await expect(page.locator('h3').filter({ hasText: 'X (Twitter)' })).toBeVisible();
  await expect(page.locator('h3').filter({ hasText: 'Instagram' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yapılandır' }).first()).toBeVisible();
});

test('manager cannot see settings navigation', async ({ page }) => {
  await login(page, MANAGER_EMAIL, ADMIN_PASSWORD);

  await expect(page.getByRole('button', { name: '⚙️ Ayarlar' })).toHaveCount(0);

  await logout(page);
  await page.goto('/');
  await selectTenantIfVisible(page);
  await page.getByLabel('Kullanıcı Adı').fill(MANAGER_EMAIL);
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