import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, API_BASE_URL, TIRE_TENANT_ID, prepareTurkishUi, selectTenantIfVisible } from './helpers';

// Scenario:
// 1. Trusted internal requests can complete automatic corporate sign-in.
// 2. External requests trigger step-up verification.
// 3. Direct password grant is blocked on external networks until second factor completes.

test('trusted header sign-in automatically logs in an internal-network user', async ({ page }) => {
  await page.context().setExtraHTTPHeaders({
    'X-Forwarded-For': '10.10.10.55',
    'X-Authenticated-User': 'TIRE\\zeynep.kara',
  });
  await prepareTurkishUi(page);

  await page.goto('/');

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /kontrol paneli/i })).toBeVisible();
  await expect(page.getByText('Zeynep Kara')).toBeVisible();
});

test('external-network login requires second factor and accepts the mock verification code', async ({ page }) => {
  await page.context().setExtraHTTPHeaders({
    'X-Forwarded-For': '203.0.113.15',
  });
  await prepareTurkishUi(page);

  await page.goto('/');
  await selectTenantIfVisible(page, TIRE_TENANT_ID);
  await expect(page.getByText(/doğrulama kodu ile tamamlanacaktır/i)).toBeVisible();

  await page.getByLabel(/kullanıcı adı/i).fill(ADMIN_EMAIL);
  await page.getByLabel('Şifre').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();

  await expect(page.getByRole('heading', { name: 'Doğrulama kodu' })).toBeVisible();
  const mockCode = (await page.locator('.mock-code-value').innerText()).trim();
  expect(mockCode).toMatch(/^\d{6}$/);

  await page.getByLabel('Doğrulama Kodu').fill(mockCode);
  await page.getByRole('button', { name: 'Doğrula' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: /kontrol paneli/i })).toBeVisible();
});

test('password grant blocks external-network sign-in until second factor completes', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/connect/token`, {
    headers: {
      'X-Forwarded-For': '203.0.113.30',
    },
    form: {
      grant_type: 'password',
      username: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      tenant_id: TIRE_TENANT_ID,
    },
  });

  expect(response.status()).toBe(401);

  const payload = await response.json() as { error?: string; error_description?: string };
  expect(payload.error).toBe('invalid_grant');
  expect(payload.error_description).toMatch(/ikinci doğrulama|second-factor/i);
});