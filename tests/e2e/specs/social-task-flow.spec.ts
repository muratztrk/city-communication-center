import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, API_BASE_URL, MANAGER_EMAIL, STAFF_EMAIL, apiGetDepartments, apiGetSocialMessages, authenticateApi, getApiHeaders, login, logout, openSocialMessagesPage, openTasksPage, seedSocialMessage } from './helpers';

// Scenario:
// 1. Admin routes a new social message to Fen Isleri.
// 2. Admin converts the message into a draft task and submits it.
// 3. Department manager approves and assigns the task to staff.
// 4. Staff completes the task.
// 5. Manager closes the task.

test('social message can become an approved assigned completed closed task across multiple users', async ({ browser, request }) => {
  test.setTimeout(90_000);

  const citizenHandle = `e2e.citizen.${Date.now()}`;
  const taskTitle = `E2E Fen Isleri Gorevi ${Date.now()}`;

  await seedSocialMessage(request, citizenHandle);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openSocialMessagesPage(adminPage);

  await test.step('Admin routes and converts the social message', async () => {
    const socialRow = adminPage.locator('tr', { hasText: citizenHandle }).first();
    await expect(socialRow).toBeVisible();
    await socialRow.locator('select').selectOption({ label: 'Fen İşleri Müdürlüğü' });
    await socialRow.getByRole('button', { name: 'Yönlendir' }).click();
    await expect(socialRow).toContainText('Routed');

    await socialRow.getByPlaceholder('Görev başlığı').fill(taskTitle);
    await socialRow.getByRole('button', { name: 'Göreve Çevir' }).click();
    await expect(socialRow).toContainText('Göreve dönüştürüldü');
  });

  await openTasksPage(adminPage);
  const draftTaskRow = adminPage.locator('tr', { hasText: taskTitle }).first();
  await test.step('Admin submits the newly created task', async () => {
    await expect(draftTaskRow).toBeVisible();
    await expect(draftTaskRow).toContainText('Draft');
    await draftTaskRow.getByRole('button', { name: 'Gönder' }).click();
    await expect(draftTaskRow).toContainText('PendingApproval');
  });

  await logout(adminPage);
  await adminContext.close();

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();

  await login(managerPage, MANAGER_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(managerPage);
  const managerTaskRow = managerPage.locator('tr', { hasText: taskTitle }).first();
  await test.step('Manager approves and assigns the task to staff', async () => {
    await expect(managerTaskRow).toBeVisible();
    await managerTaskRow.getByRole('button', { name: 'Onayla' }).click();
    await expect(managerTaskRow).toContainText('Assigned');

    await managerTaskRow.getByLabel(`Departman seç ${taskTitle}`).selectOption({ label: 'Fen İşleri Müdürlüğü' });
    await managerTaskRow.getByLabel(`Kullanıcı seç ${taskTitle}`).selectOption({ label: 'Emre Çelik' });
    await managerTaskRow.getByRole('button', { name: 'Ata' }).click();
    await expect(managerTaskRow).toContainText('Emre Çelik');
  });

  await logout(managerPage);
  await managerContext.close();

  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();

  await login(staffPage, STAFF_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(staffPage);
  const staffTaskRow = staffPage.locator('tr', { hasText: taskTitle }).first();
  await test.step('Assigned staff completes the task', async () => {
    await expect(staffTaskRow).toBeVisible();
    await staffTaskRow.getByRole('button', { name: 'Tamamla' }).click();
    await expect(staffTaskRow).toContainText('Completed', { timeout: 10_000 });
  });

  await logout(staffPage);
  await staffContext.close();

  const closeContext = await browser.newContext();
  const closePage = await closeContext.newPage();

  await login(closePage, MANAGER_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(closePage);
  const closeTaskRow = closePage.locator('tr', { hasText: taskTitle }).first();
  await test.step('Manager closes the completed task', async () => {
    await expect(closeTaskRow).toBeVisible();
    await closeTaskRow.getByRole('button', { name: 'Kapat' }).click();
    await expect(closeTaskRow).toContainText('Closed');
  });

  await closeContext.close();
});

test('social message conversion falls back to citizen handle when title is left blank', async ({ page, request }) => {
  const citizenHandle = `e2e.default.title.${Date.now()}`;
  const expectedTaskTitle = `${citizenHandle} talebi`;

  await seedSocialMessage(request, citizenHandle);

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openSocialMessagesPage(page);

  const socialRow = page.locator('tr', { hasText: citizenHandle }).first();
  await expect(socialRow).toBeVisible();
  await socialRow.locator('select').selectOption({ label: 'Fen İşleri Müdürlüğü' });
  await socialRow.getByRole('button', { name: 'Yönlendir' }).click();
  await expect(socialRow).toContainText('Routed');

  await socialRow.getByRole('button', { name: 'Göreve Çevir' }).click();
  await expect(socialRow).toContainText('Göreve dönüştürüldü');

  await openTasksPage(page);
  await expect(page.locator('tr', { hasText: expectedTaskTitle }).first()).toBeVisible();
});

test('social message conversion is idempotent for the same message', async ({ request }) => {
  const adminSession = await authenticateApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const citizenHandle = `e2e.idempotent.${Date.now()}`;
  const taskTitle = `Idempotent Gorev ${Date.now()}`;

  await seedSocialMessage(request, citizenHandle);

  const departments = await apiGetDepartments(request, adminSession);
  const publicWorksDepartment = departments.find(department => department.name === 'Fen İşleri Müdürlüğü');
  expect(publicWorksDepartment).toBeTruthy();

  const messages = await apiGetSocialMessages(request, adminSession);
  const message = messages.find(candidate => candidate.citizenHandle === citizenHandle);
  expect(message).toBeTruthy();

  const routeResponse = await request.post(`${API_BASE_URL}/api/v1/social/messages/${message!.socialMessageId}/route`, {
    headers: getApiHeaders(adminSession),
    data: {
      departmentId: publicWorksDepartment!.departmentId,
      userId: null,
    },
  });
  expect(routeResponse.ok()).toBeTruthy();

  const firstConvertResponse = await request.post(`${API_BASE_URL}/api/v1/social/messages/${message!.socialMessageId}/convert`, {
    headers: getApiHeaders(adminSession),
    data: {
      title: taskTitle,
      description: `${taskTitle} aciklamasi`,
      priority: 'Normal',
      dueDateUtc: null,
    },
  });
  expect(firstConvertResponse.status()).toBe(201);
  const firstTask = await firstConvertResponse.json() as { taskId: string; title: string };

  const secondConvertResponse = await request.post(`${API_BASE_URL}/api/v1/social/messages/${message!.socialMessageId}/convert`, {
    headers: getApiHeaders(adminSession),
    data: {
      title: `${taskTitle} duplicate`,
      description: 'This should not create a second task',
      priority: 'High',
      dueDateUtc: null,
    },
  });
  expect(secondConvertResponse.status()).toBe(201);
  const secondTask = await secondConvertResponse.json() as { taskId: string; title: string };

  expect(secondTask.taskId).toBe(firstTask.taskId);
  expect(secondTask.title).toBe(firstTask.title);
});