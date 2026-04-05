import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, login, uniqueSuffix } from './helpers';

// Scenario Set:
// 1. Dashboard metric cards render after login.
// 2. Departments screen shows seeded data and allows creating a new department.
// 3. Users screen renders seeded users with department and role information.

test('dashboard, departments, and users surfaces render with live data', async ({ page }) => {
  const departmentName = uniqueSuffix('E2E Birim');

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await test.step('Dashboard cards render with numeric values', async () => {
    const metricCards = page.locator('.metric-grid .section-card');
    await expect(metricCards).toHaveCount(4);
    await expect(metricCards.nth(0)).toContainText('Acik Gorev');
    await expect(metricCards.nth(1)).toContainText('Onay Bekleyen');
    await expect(metricCards.nth(2)).toContainText('Sosyal Medya Mesaji');
    await expect(metricCards.nth(3)).toContainText('Basarisiz Bildirim');
  });

  await test.step('Departments screen lists seed data and accepts a new department', async () => {
    await page.getByRole('button', { name: 'Departmanlar' }).click();
    await expect(page.getByRole('heading', { name: 'Departmanlar' })).toBeVisible();
    await expect(page.locator('tr', { hasText: /Fen/i }).first()).toBeVisible();

    await page.getByRole('button', { name: '+ Yeni Departman' }).click();
    await page.getByPlaceholder('Departman adi girin').fill(departmentName);
    await page.locator('.form-card select').selectOption('Birim');
    await page.getByRole('button', { name: 'Olustur' }).click();

    await expect(page.locator('tr', { hasText: departmentName }).first()).toBeVisible();
    await expect(page.locator('tr', { hasText: departmentName }).first()).toContainText('Birim');
  });

  await test.step('Users screen renders seeded accounts with department and role badges', async () => {
    await page.getByRole('button', { name: 'Kullanicilar' }).click();
    await expect(page.getByRole('heading', { name: 'Kullanicilar' })).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Sistem Yoneticisi' }).first()).toContainText('Yerel');
    await expect(page.locator('tr', { hasText: 'Zeynep Kara' }).first()).toContainText('Yonetici');
    await expect(page.locator('tr', { hasText: 'Zeynep Kara' }).first()).toContainText(/Fen/i);
    await expect(page.locator('tr', { hasText: /Emre/i }).first()).toContainText('Aktif');
  });
});
