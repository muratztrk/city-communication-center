import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, login, uniqueSuffix } from './helpers';

// Scenario Set:
// 1. Dashboard stat cards render after login.
// 2. Departments screen shows seeded data and allows creating a new department.
// 3. Users screen renders seeded users with department and role information.

test('dashboard, departments, and users surfaces render with live data', async ({ page }) => {
  const departmentName = uniqueSuffix('E2E Birim');

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await test.step('Dashboard cards render with numeric values', async () => {
    await expect(page.getByText('Açık Görev')).toBeVisible();
    await expect(page.getByText('Onay Bekleyen')).toBeVisible();
    await expect(page.getByText('Sosyal Medya Mesajı')).toBeVisible();
    await expect(page.getByText('Başarısız Bildirim')).toBeVisible();
    await expect(page.locator('.stat-card .stat-value')).toHaveCount(4);
  });

  await test.step('Departments screen lists seed data and accepts a new department', async () => {
    await page.getByRole('button', { name: '🏢 Departmanlar' }).click();
    await expect(page.getByRole('heading', { name: '🏢 Departmanlar' })).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Fen İşleri Müdürlüğü' }).first()).toBeVisible();

    await page.getByRole('button', { name: '+ Yeni Departman' }).click();
    await page.getByPlaceholder('Departman adı girin').fill(departmentName);
    await page.locator('.form-card select').selectOption('Birim');
    await page.getByRole('button', { name: 'Oluştur' }).click();

    await expect(page.locator('tr', { hasText: departmentName }).first()).toBeVisible();
    await expect(page.locator('tr', { hasText: departmentName }).first()).toContainText('Birim');
  });

  await test.step('Users screen renders seeded accounts with department and role badges', async () => {
    await page.getByRole('button', { name: '👥 Kullanıcılar' }).click();
    await expect(page.getByRole('heading', { name: '👥 Kullanıcılar' })).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Sistem Yöneticisi' }).first()).toContainText('SystemAdmin');
    await expect(page.locator('tr', { hasText: 'Zeynep Kara' }).first()).toContainText('Fen İşleri Müdürlüğü');
    await expect(page.locator('tr', { hasText: 'Emre Çelik' }).first()).toContainText('Aktif');
  });
});