import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, API_BASE_URL, TIRE_TENANT_ID, authenticateApi, getApiHeaders, login, prepareTurkishUi, selectTenantIfVisible } from './helpers';

// Scenario:
// 1. Password grant stays compatible with the frontend client.
// 2. Single-tenant installs can resolve the organization context automatically.
// 3. Custom domain mappings can lock login to one tenant.
// 4. Login, invalid credentials, navigation, session restore, and logout remain stable.

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

test('password grant resolves tenant automatically for single-tenant installations', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/connect/token`, {
    form: {
      grant_type: 'password',
      username: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
  });

  expect(response.ok()).toBeTruthy();

  const payload = await response.json() as { access_token?: string; expires_in?: number };
  expect(payload.access_token).toBeTruthy();
  expect(typeof payload.expires_in === 'number' || payload.expires_in === undefined).toBeTruthy();
});

test('single-tenant login hides tenant selection and locks the installation to one organization', async ({ page }) => {
  await prepareTurkishUi(page);
  await page.goto('/');

  await expect(page.getByLabel('Kurum')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /tire belediyesi/i }).first()).toBeVisible();
});

test('tenant context resolves from a configured custom domain without exposing tenant selection', async ({ request }) => {
  const session = await authenticateApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);

  const currentSettingsResponse = await request.get(`${API_BASE_URL}/api/v1/admin/tenants/${TIRE_TENANT_ID}/settings`, {
    headers: getApiHeaders(session),
  });
  expect(currentSettingsResponse.ok()).toBeTruthy();

  const currentSettings = await currentSettingsResponse.json() as {
    displayName: string;
    deploymentMode: string;
    theme: string | null;
    domain: string | null;
    defaultSlaHours: number;
  };

  const configuredDomain = 'portal.tire.bel.tr';
  const updateResponse = await request.put(`${API_BASE_URL}/api/v1/admin/tenants/${TIRE_TENANT_ID}/settings`, {
    headers: getApiHeaders(session),
    data: {
      displayName: currentSettings.displayName,
      deploymentMode: currentSettings.deploymentMode,
      theme: currentSettings.theme,
      domain: configuredDomain,
      defaultSlaHours: currentSettings.defaultSlaHours,
    },
  });
  expect(updateResponse.ok()).toBeTruthy();

  const contextResponse = await request.get(`${API_BASE_URL}/api/v1/auth/tenant-context`, {
    headers: {
      Host: configuredDomain,
    },
  });
  expect(contextResponse.ok()).toBeTruthy();

  const payload = await contextResponse.json() as {
    resolvedTenant?: { tenantId?: string } | null;
    hideTenantSelector?: boolean;
    requireTenantSelection?: boolean;
    resolutionMode?: string;
  };
  expect(payload.resolvedTenant?.tenantId).toBe(TIRE_TENANT_ID);
  expect(payload.hideTenantSelector).toBe(true);
  expect(payload.requireTenantSelection).toBe(false);
  expect(payload.resolutionMode).toBe('CustomDomain');
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
  expect(payload.title).toMatch(/tenant uyumsuzluğu algılandı/i);
  expect(payload.detail).toMatch(/rota üzerindeki tenant bilgisi/i);
});

test('admin login and primary navigation smoke flow', async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.getByRole('button', { name: 'Görevler' }).click();
  await expect(page.getByRole('heading', { name: 'Görevler' })).toBeVisible();

  await page.getByRole('button', { name: 'Sosyal Medya' }).click();
  await expect(page.getByRole('heading', { name: 'Sosyal Medya' })).toBeVisible();

  await page.getByRole('button', { name: 'Departmanlar' }).click();
  await expect(page.getByRole('heading', { name: 'Departmanlar' })).toBeVisible();

  await page.getByRole('button', { name: 'Kullanıcılar' }).click();
  await expect(page.getByRole('heading', { name: 'Kullanıcılar' })).toBeVisible();

  await page.getByRole('button', { name: 'Denetim' }).click();
  await expect(page.getByRole('heading', { name: 'Denetim' })).toBeVisible();
});

test('invalid login shows an authentication error', async ({ page }) => {
  await prepareTurkishUi(page);
  await page.goto('/');
  await selectTenantIfVisible(page);
  await page.getByLabel(/kullanıcı adı/i).fill(ADMIN_EMAIL);
  await page.getByLabel('Şifre').fill('invalid-password');
  await page.getByRole('button', { name: 'Giriş Yap' }).click();

  await expect(page.getByText(/kimlik doğrulama başarısız|geçersiz kullanıcı adı veya şifre/i)).toBeVisible();
});

test('session survives reload and logout clears persisted auth state', async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.reload();
  await expect(page.getByRole('heading', { name: /kontrol paneli/i })).toBeVisible();

  await page.getByRole('button', { name: /çıkış/i }).click();
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