import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, API_BASE_URL, MANAGER_EMAIL, authenticateApi, login } from './helpers';

// Scenario:
// 1. Admin logs in.
// 2. Settings menu is visible for the authorized role.
// 3. LDAP section explains explicit admin onboarding and does not expose auto-provision controls.
// 4. Auth-policy and social configuration surfaces remain reachable.

test('admin can see and open settings', async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  const settingsButton = page.getByRole('button', { name: 'Ayarlar' });
  await expect(settingsButton).toBeVisible();
  await settingsButton.click();

  await expect(page.getByRole('heading', { name: 'Ayarlar', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'LDAP Ayarlari' })).toBeVisible();
  await expect(page.getByLabel('LDAP giris ve admin import acik')).toBeVisible();
  await expect(page.getByText(/LDAP onboarding login ekraninda degil/i)).toBeVisible();
  await expect(page.getByText(/otomatik kullanici olusturma devre disi/i)).toHaveCount(0);
  await expect(page.getByText(/auto.?provision/i)).toHaveCount(0);
  await expect(page.getByLabel('LDAP sunucusu')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kimlik Politikasi' })).toBeVisible();
  await expect(page.getByLabel('Guvenilen ic ag araliklari (CIDR)')).toBeVisible();

  const automaticMode = page.getByLabel('Otomatik Giris Modu');
  await expect(automaticMode).toBeVisible();
  if ((await automaticMode.inputValue()) === 'TrustedHeader') {
    await expect(page.getByLabel('Kimlik header adi')).toBeVisible();
  }

  await page.locator('.tab-bar').getByRole('button', { name: 'Sosyal Medya' }).click();
  await expect(page).toHaveURL(/tab=social/);
  await expect(page.locator('h3').filter({ hasText: 'X (Twitter)' })).toBeVisible();
  await expect(page.locator('h3').filter({ hasText: 'Instagram' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yapilandir' }).first()).toBeVisible();
});

test('manager cannot see settings navigation', async ({ page }) => {
  await login(page, MANAGER_EMAIL, ADMIN_PASSWORD);
  await expect(page.getByRole('button', { name: 'Ayarlar' })).toHaveCount(0);
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
