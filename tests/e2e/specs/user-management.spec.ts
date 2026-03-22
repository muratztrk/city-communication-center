import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, apiSearchDirectoryUsers, authenticateApi, login, selectAutocompleteOption, uniqueSuffix } from './helpers';

const PUBLIC_WORKS_DEPARTMENT_ID = '0e29fb34-64da-429e-b7c0-e6016a0c10a7';
const COMMUNICATIONS_DEPARTMENT_ID = '8f7264ff-c1df-48eb-bf39-a6ff42d7e9bc';

// Scenario:
// 1. Admin creates a local user with unique username and password credentials.
// 2. Admin switches to LDAP mode and links an unclaimed directory user.
// 3. Users table reflects source-aware badges for both records.

test('admin can create manual and LDAP users from the users screen', async ({ page, request }) => {
  const manualUsername = `e2e.local.${Date.now()}`;
  const manualDisplayName = uniqueSuffix('E2E Manual User');
  const manualEmail = `e2e.manual.${Date.now()}@tire.bel.tr`;

  const adminSession = await authenticateApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const directoryUsers = await apiSearchDirectoryUsers(request, adminSession, 'e2e.ldap');
  const directoryCandidate = directoryUsers.find(candidate => !candidate.alreadyLinked);

  expect(directoryCandidate).toBeTruthy();

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.getByRole('button', { name: '👥 Kullanıcılar' }).click();
  await expect(page.getByRole('heading', { name: '👥 Kullanıcılar' })).toBeVisible();

  await test.step('Admin creates a manual user', async () => {
    await page.getByRole('button', { name: /yeni kullanıcı/i }).click();
    await page.getByLabel('Kullanıcı Adı').fill(manualUsername);
    await page.getByLabel('Ad Soyad').fill(manualDisplayName);
    await page.getByLabel('E-posta').fill(manualEmail);
    await page.getByLabel('Şifre').fill(ADMIN_PASSWORD);
    await page.getByLabel('Departman').selectOption(PUBLIC_WORKS_DEPARTMENT_ID);
    await page.getByLabel('Rol').selectOption({ label: 'Personel' });
    await page.getByRole('button', { name: 'Oluştur' }).click();

    const row = page.locator('tr', { hasText: manualDisplayName }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText(manualUsername);
    await expect(row).toContainText(manualEmail);
    await expect(row).toContainText('Yerel');
  });

  await test.step('Admin creates an LDAP-linked user from directory search', async () => {
    await page.getByRole('button', { name: /yeni kullanıcı/i }).click();
    await page.getByRole('button', { name: 'LDAP Kullanıcısı' }).click();
    await selectAutocompleteOption(page, 'Dizin kullanıcısı ara', directoryCandidate!.displayName);
    await page.getByLabel('Departman').selectOption(COMMUNICATIONS_DEPARTMENT_ID);
    await page.getByLabel('Rol').selectOption({ label: 'Raporlayıcı' });
    await page.getByRole('button', { name: 'Oluştur' }).click();

    const row = page.locator('tr', { hasText: directoryCandidate!.displayName }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText(directoryCandidate!.username);
    await expect(row).toContainText(directoryCandidate!.email ?? '');
    await expect(row).toContainText('LDAP');
  });
});
