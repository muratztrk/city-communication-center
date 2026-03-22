import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, login, uniqueSuffix } from './helpers';

// Scenario:
// 1. Admin opens routing settings.
// 2. Admin creates a routing rule that targets Fen Isleri.
// 3. Routing test resolves to the expected department.
// 4. Admin deletes the temporary rule to keep the tenant clean.

test('admin can create test and delete an auto-routing rule', async ({ page }) => {
  const ruleName = uniqueSuffix('E2E Routing Rule');
  const keywords = `altyapi-${Date.now()}, bozuk yol`;

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.getByRole('button', { name: '⚙️ Ayarlar' }).click();
  await expect(page.getByRole('heading', { name: '⚙️ Ayarlar' })).toBeVisible();

  await page.getByRole('button', { name: '🔀 Otomatik Yönlendirme' }).click();
  await expect(page).toHaveURL(/tab=routing/);
  await expect(page.getByRole('heading', { name: 'Yönlendirme Kuralları' })).toBeVisible();

  await test.step('Admin creates a new routing rule', async () => {
    await page.getByRole('button', { name: '+ Yeni Kural' }).click();

    await page.getByPlaceholder('Örn: Park Şikayetleri').fill(ruleName);
    await page.locator('select').nth(1).selectOption({ label: 'Fen İşleri Müdürlüğü' });
    await page.locator('input[type="number"]').first().fill('95');
    await page.getByPlaceholder('park, bahçe, ağaç, yeşil alan').fill(keywords);
    await page.getByRole('button', { name: 'Oluştur' }).click();

    await expect(page.getByText('Kural oluşturuldu')).toBeVisible();
    await expect(page.locator('tr', { hasText: ruleName }).first()).toContainText('Fen İşleri Müdürlüğü');
  });

  await test.step('Routing test resolves to the configured department', async () => {
    await page.getByPlaceholder('Test mesajı yazın...').fill(`Vatandaş bildirimi: ${keywords.split(',')[0]} acil müdahale gerekiyor`);
    await page.getByRole('button', { name: 'Test Et' }).click();

    await expect(page.getByText(/Bu mesaj\s+"Fen İşleri Müdürlüğü"\s+departmanına yönlendirilir\./i)).toBeVisible();
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

  await page.getByRole('button', { name: '⚙️ Ayarlar' }).click();
  await expect(page.getByRole('heading', { name: '⚙️ Ayarlar' })).toBeVisible();

  await page.getByRole('button', { name: '🔀 Otomatik Yönlendirme' }).click();
  await expect(page).toHaveURL(/tab=routing/);
  await expect(page.getByRole('heading', { name: 'Yönlendirme Kuralları' })).toBeVisible();

  await test.step('Admin creates the rule that will later be edited', async () => {
    await page.getByRole('button', { name: '+ Yeni Kural' }).click();

    await page.getByPlaceholder('Örn: Park Şikayetleri').fill(ruleName);
    await page.locator('select').nth(1).selectOption({ label: 'Fen İşleri Müdürlüğü' });
    await page.locator('input[type="number"]').first().fill('70');
    await page.getByPlaceholder('park, bahçe, ağaç, yeşil alan').fill(initialKeyword);
    await page.getByRole('button', { name: 'Oluştur' }).click();

    await expect(page.getByText('Kural oluşturuldu')).toBeVisible();
    await expect(page.locator('tr', { hasText: ruleName }).first()).toContainText('Fen İşleri Müdürlüğü');
  });

  await test.step('Admin edits the rule and switches the target department', async () => {
    await page.locator('tr', { hasText: ruleName }).getByRole('button', { name: 'Düzenle' }).click();

    await page.getByPlaceholder('Örn: Park Şikayetleri').fill(updatedRuleName);
    await page.locator('select').nth(1).selectOption({ label: 'Basın Yayın Müdürlüğü' });
    await page.locator('input[type="number"]').first().fill('99');
    await page.getByPlaceholder('park, bahçe, ağaç, yeşil alan').fill(updatedKeyword);
    await page.getByRole('button', { name: 'Kaydet' }).click();

    await expect(page.getByText('Kural güncellendi')).toBeVisible();
    const updatedRow = page.locator('tr', { hasText: updatedRuleName }).first();
    await expect(updatedRow).toContainText('Basın Yayın Müdürlüğü');
    await expect(updatedRow).toContainText('99');
  });

  await test.step('Routing test follows the updated rule', async () => {
    await page.getByPlaceholder('Test mesajı yazın...').fill(`Vatandas bildirimi: ${updatedKeyword} icerigi test edilmeli`);
    await page.getByRole('button', { name: 'Test Et' }).click();

    await expect(page.getByText(/Bu mesaj\s+"Basın Yayın Müdürlüğü"\s+departmanına yönlendirilir\./i)).toBeVisible();
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

  await page.getByRole('button', { name: '⚙️ Ayarlar' }).click();
  await expect(page.getByRole('heading', { name: '⚙️ Ayarlar' })).toBeVisible();

  await page.getByRole('button', { name: '🔀 Otomatik Yönlendirme' }).click();
  await expect(page).toHaveURL(/tab=routing/);
  await expect(page.getByRole('heading', { name: 'Yönlendirme Kuralları' })).toBeVisible();

  const toggleButton = page.getByRole('button', { name: /Aktif|Pasif/ }).first();
  const initialState = (await toggleButton.textContent())?.trim() === 'Aktif';
  const changedToast = initialState ? 'Otomatik yönlendirme kapatıldı' : 'Otomatik yönlendirme açıldı';
  const restoredToast = initialState ? 'Otomatik yönlendirme açıldı' : 'Otomatik yönlendirme kapatıldı';

  await toggleButton.click();
  await expect(page.getByText(changedToast)).toBeVisible();
  await expect(page.getByRole('button', { name: initialState ? 'Pasif' : 'Aktif' }).first()).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/tab=routing/);
  await expect(page.getByRole('heading', { name: 'Yönlendirme Kuralları' })).toBeVisible();
  await expect(page.getByRole('button', { name: initialState ? 'Pasif' : 'Aktif' }).first()).toBeVisible();

  await page.getByRole('button', { name: initialState ? 'Pasif' : 'Aktif' }).first().click();
  await expect(page.getByText(restoredToast)).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/tab=routing/);
  await expect(page.getByRole('heading', { name: 'Yönlendirme Kuralları' })).toBeVisible();
  await expect(page.getByRole('button', { name: initialState ? 'Aktif' : 'Pasif' }).first()).toBeVisible();
});