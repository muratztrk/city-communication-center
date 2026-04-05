import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, login, uniqueSuffix } from './helpers';

const PUBLIC_WORKS_DEPARTMENT_ID = '0e29fb34-64da-429e-b7c0-e6016a0c10a7';
const COMMUNICATIONS_DEPARTMENT_ID = '8f7264ff-c1df-48eb-bf39-a6ff42d7e9bc';

// Scenario:
// 1. Admin opens routing settings.
// 2. Admin creates a routing rule that targets Fen Isleri.
// 3. Routing test resolves to the expected department.
// 4. Admin deletes the temporary rule to keep the tenant clean.

test('admin can create test and delete an auto-routing rule', async ({ page }) => {
  const ruleName = uniqueSuffix('E2E Routing Rule');
  const keywords = `altyapi-${Date.now()}, bozuk yol`;

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.getByRole('button', { name: 'Ayarlar' }).click();
  await expect(page.getByRole('heading', { name: 'Ayarlar', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Otomatik Yonlendirme' }).click();
  await expect(page).toHaveURL(/tab=routing/);
  await expect(page.getByRole('heading', { name: 'Yonlendirme Kurallari' })).toBeVisible();

  await test.step('Admin creates a new routing rule', async () => {
    await page.getByRole('button', { name: '+ Yeni Kural' }).click();

    await page.getByPlaceholder('Orn: Park Sikayetleri').fill(ruleName);
    await page.getByLabel('Hedef Departman').selectOption(PUBLIC_WORKS_DEPARTMENT_ID);
    await page.locator('input[type="number"]').first().fill('95');
    await page.getByPlaceholder('park, bahce, agac, yesil alan').fill(keywords);
    await page.getByRole('button', { name: 'Olustur' }).click();

    await expect(page.getByText('Kural olusturuldu')).toBeVisible();
    await expect(page.locator('tr', { hasText: ruleName }).first()).toContainText(/Fen/i);
  });

  await test.step('Routing test resolves to the configured department', async () => {
    await page.getByPlaceholder('Test mesaji yazin...').fill(`Vatandas bildirimi: ${keywords.split(',')[0]} acil mudahale gerekiyor`);
    await page.getByRole('button', { name: 'Test Et' }).click();

    await expect(page.getByText(/yonlendirilir\./i).last()).toContainText(/Fen/i);
  });

  await test.step('Admin deletes the temporary routing rule', async () => {
    page.once('dialog', dialog => dialog.accept());
    await page.locator('tr', { hasText: ruleName }).getByRole('button', { name: 'Sil' }).click();

    await expect(page.getByText('Kural silindi')).toBeVisible();
    await expect(page.locator('tr', { hasText: ruleName })).toHaveCount(0);
  });
});

test('admin can edit an auto-routing rule and updated routing takes effect', async ({ page }) => {
  const ruleName = uniqueSuffix('E2E Editable Rule');
  const updatedRuleName = `${ruleName} Guncel`;
  const initialKeyword = `park-${Date.now()}`;
  const updatedKeyword = `basin-${Date.now()}`;

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.getByRole('button', { name: 'Ayarlar' }).click();
  await expect(page.getByRole('heading', { name: 'Ayarlar', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Otomatik Yonlendirme' }).click();
  await expect(page).toHaveURL(/tab=routing/);
  await expect(page.getByRole('heading', { name: 'Yonlendirme Kurallari' })).toBeVisible();

  await test.step('Admin creates the rule that will later be edited', async () => {
    await page.getByRole('button', { name: '+ Yeni Kural' }).click();
    await page.getByPlaceholder('Orn: Park Sikayetleri').fill(ruleName);
    await page.getByLabel('Hedef Departman').selectOption(PUBLIC_WORKS_DEPARTMENT_ID);
    await page.locator('input[type="number"]').first().fill('70');
    await page.getByPlaceholder('park, bahce, agac, yesil alan').fill(initialKeyword);
    await page.getByRole('button', { name: 'Olustur' }).click();

    await expect(page.getByText('Kural olusturuldu')).toBeVisible();
  });

  await test.step('Admin edits the rule and switches the target department', async () => {
    await page.locator('tr', { hasText: ruleName }).getByRole('button', { name: 'Duzenle' }).click();
    await page.getByPlaceholder('Orn: Park Sikayetleri').fill(updatedRuleName);
    await page.getByLabel('Hedef Departman').selectOption(COMMUNICATIONS_DEPARTMENT_ID);
    await page.locator('input[type="number"]').first().fill('99');
    await page.getByPlaceholder('park, bahce, agac, yesil alan').fill(updatedKeyword);
    await page.getByRole('button', { name: 'Kaydet' }).click();

    await expect(page.getByText('Kural guncellendi')).toBeVisible();
    const updatedRow = page.locator('tr', { hasText: updatedRuleName }).first();
    await expect(updatedRow).toContainText(/Bas|Yay/i);
    await expect(updatedRow).toContainText('99');
  });

  await test.step('Routing test follows the updated rule', async () => {
    await page.getByPlaceholder('Test mesaji yazin...').fill(`Vatandas bildirimi: ${updatedKeyword} icerigi test edilmeli`);
    await page.getByRole('button', { name: 'Test Et' }).click();

    await expect(page.getByText(/yonlendirilir\./i).last()).toContainText(/Bas|Yay/i);
  });

  await test.step('Admin deletes the edited rule', async () => {
    page.once('dialog', dialog => dialog.accept());
    await page.locator('tr', { hasText: updatedRuleName }).getByRole('button', { name: 'Sil' }).click();

    await expect(page.getByText('Kural silindi')).toBeVisible();
    await expect(page.locator('tr', { hasText: updatedRuleName })).toHaveCount(0);
  });
});

test('auto-routing toggle persists after reload and can be restored', async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.getByRole('button', { name: 'Ayarlar' }).click();
  await expect(page.getByRole('heading', { name: 'Ayarlar', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Otomatik Yonlendirme' }).click();
  await expect(page).toHaveURL(/tab=routing/);
  await expect(page.getByRole('heading', { name: 'Yonlendirme Kurallari' })).toBeVisible();

  const toggleButton = page.getByRole('button', { name: /Aktif|Pasif/ }).first();
  const initialState = (await toggleButton.textContent())?.trim() === 'Aktif';
  const changedToast = initialState ? 'Otomatik yonlendirme kapatildi' : 'Otomatik yonlendirme acildi';
  const restoredToast = initialState ? 'Otomatik yonlendirme acildi' : 'Otomatik yonlendirme kapatildi';

  await toggleButton.click();
  await expect(page.getByText(changedToast)).toBeVisible();
  await expect(page.getByRole('button', { name: initialState ? 'Pasif' : 'Aktif' }).first()).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/tab=routing/);
  await expect(page.getByRole('button', { name: initialState ? 'Pasif' : 'Aktif' }).first()).toBeVisible();

  await page.getByRole('button', { name: initialState ? 'Pasif' : 'Aktif' }).first().click();
  await expect(page.getByText(restoredToast)).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/tab=routing/);
  await expect(page.getByRole('button', { name: initialState ? 'Aktif' : 'Pasif' }).first()).toBeVisible();
});