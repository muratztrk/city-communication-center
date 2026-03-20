import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, API_BASE_URL, TIRE_TENANT_ID, authenticateApi } from './helpers';

// Scenario:
// 1. Admin logs in with password grant backed UI.
// 2. Core navigation entries open without rendering errors.
// 3. Invalid credentials still surface a visible login failure.

async function login(page: Parameters<typeof test>[0]['page']) {
  await page.goto('/');
  await page.getByLabel('Belediye').selectOption(TIRE_TENANT_ID);
  await page.getByLabel('Kullanıcı Adı / E-posta').fill(ADMIN_EMAIL);
  await page.getByLabel('Şifre').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await expect(page.getByRole('heading', { name: '📊 Kontrol Paneli' })).toBeVisible();
}

test('password grant token contract stays compatible with the frontend client', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/connect/token`, {
    form: {
      grant_type: 'password',
      username: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      tenant_id: TIRE_TENANT_ID,
    },
  });

  expect(response.ok()).toBeTruthy();

  const payload = await response.json() as { access_token?: string; expires_in?: number };
  expect(payload.access_token).toBeTruthy();
  expect(typeof payload.expires_in === 'number' || payload.expires_in === undefined).toBeTruthy();
});

test('password grant rejects requests without tenant selection', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/connect/token`, {
    form: {
      grant_type: 'password',
      username: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
  });

  expect(response.ok()).toBeFalsy();

  const payload = await response.json() as { error?: string; error_description?: string };
  expect(payload.error).toBe('invalid_request');
  expect(payload.error_description).toMatch(/belediye seçimi gereklidir/i);
});

test('tenant protected endpoints reject route and tenant context mismatches', async ({ request }) => {
  const session = await authenticateApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const mismatchedTenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const response = await request.get(`${API_BASE_URL}/api/v1/admin/tenants/${mismatchedTenantId}/settings`, {
    headers: {
      Authorization: `Bearer ${session.token}`,
      'X-Tenant-Id': session.tenantId,
    },
  });

  expect(response.status()).toBe(403);

  const payload = await response.json() as { title?: string; detail?: string };
  expect(payload.title).toMatch(/tenant uyumsuzlugu algilandi/i);
  expect(payload.detail).toMatch(/rota uzerindeki tenant bilgisi/i);
});

test('admin login and primary navigation smoke flow', async ({ page }) => {
  await login(page);

  await page.getByRole('button', { name: '📋 Görevler' }).click();
  await expect(page.getByRole('heading', { name: '📋 Görevler' })).toBeVisible();

  await page.getByRole('button', { name: '📱 Sosyal Medya' }).click();
  await expect(page.getByRole('heading', { name: '📱 Sosyal Medya Mesajları' })).toBeVisible();

  await page.getByRole('button', { name: '🏢 Departmanlar' }).click();
  await expect(page.getByRole('heading', { name: '🏢 Departmanlar' })).toBeVisible();

  await page.getByRole('button', { name: '👥 Kullanıcılar' }).click();
  await expect(page.getByRole('heading', { name: '👥 Kullanıcılar' })).toBeVisible();

  await page.getByRole('button', { name: '📜 Denetim' }).click();
  await expect(page.getByRole('heading', { name: '📜 Denetim Kayıtları' })).toBeVisible();
});

test('invalid login shows an authentication error', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Belediye').selectOption(TIRE_TENANT_ID);
  await page.getByLabel('Kullanıcı Adı / E-posta').fill(ADMIN_EMAIL);
  await page.getByLabel('Şifre').fill('invalid-password');
  await page.getByRole('button', { name: 'Giriş Yap' }).click();

  await expect(page.getByText(/kimlik doğrulama başarısız|geçersiz kullanıcı adı veya şifre/i)).toBeVisible();
});

test('session survives reload and logout clears persisted auth state', async ({ page }) => {
  await login(page);

  await page.reload();
  await expect(page.getByRole('heading', { name: '📊 Kontrol Paneli' })).toBeVisible();

  await page.getByRole('button', { name: '🚪 Çıkış' }).click();
  await expect(page.getByRole('button', { name: 'Giriş Yap' })).toBeVisible();

  const storageState = await page.evaluate(() => ({
    token: localStorage.getItem('ccc_token'),
    expiresAt: localStorage.getItem('ccc_token_expires_at'),
    user: localStorage.getItem('ccc_user'),
  }));

  expect(storageState.token).toBeNull();
  expect(storageState.expiresAt).toBeNull();
  expect(storageState.user).toBeNull();
});