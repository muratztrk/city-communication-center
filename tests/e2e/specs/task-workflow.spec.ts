import { expect, test } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  API_BASE_URL,
  MANAGER_EMAIL,
  STAFF_EMAIL,
  apiGetDepartments,
  authenticateApi,
  apiCreateDepartment,
  apiCreateTask,
  apiGetUsers,
  getApiHeaders,
  login,
  logout,
  openTasksPage,
  uniqueSuffix,
} from './helpers';

// Scenario Set:
// 1. Manual task creation and manager-approved assignment flow.
// 2. Rejection and close branch for approval-required tasks.
// 3. Direct assignment branch when target department has no manager.
// 4. Assignment guardrail when both department and user are cleared.

test('manual task can be created from UI and completed through approval flow', async ({ browser }) => {
  test.setTimeout(90_000);
  const taskTitle = uniqueSuffix('Manual Approval Task');

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(adminPage);

  await test.step('Admin creates a manual task for Fen Isleri', async () => {
    await adminPage.getByRole('button', { name: '+ Yeni Görev' }).click();
    await adminPage.getByPlaceholder('Görev başlığı').fill(taskTitle);
    await adminPage.getByPlaceholder('Görev açıklaması').fill(`${taskTitle} açıklaması`);
    await adminPage.locator('.form-card select').nth(1).selectOption('InternalRequest');
    await adminPage.locator('.form-card select').nth(2).selectOption({ label: 'Fen İşleri Müdürlüğü' });
    await adminPage.getByRole('button', { name: 'Oluştur' }).click();
  });

  const adminTaskRow = adminPage.locator('tr', { hasText: taskTitle }).first();
  await test.step('Admin submits the task for approval', async () => {
    await expect(adminTaskRow).toBeVisible();
    await expect(adminTaskRow).toContainText('Draft');
    await adminTaskRow.getByRole('button', { name: 'Gönder' }).click();
    await expect(adminTaskRow).toContainText('PendingApproval');
  });

  await logout(adminPage);
  await adminContext.close();

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await login(managerPage, MANAGER_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(managerPage);

  const managerTaskRow = managerPage.locator('tr', { hasText: taskTitle }).first();
  await test.step('Manager approves and assigns the task', async () => {
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
  await test.step('Staff completes the approved task', async () => {
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
  await test.step('Manager closes the completed manual task', async () => {
    await closeTaskRow.getByRole('button', { name: 'Kapat' }).click();
    await expect(closeTaskRow).toContainText('Closed');
  });

  await closeContext.close();
});

test('manager can reject and close a task that requires approval', async ({ browser, request }) => {
  test.setTimeout(60_000);
  const adminSession = await authenticateApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const taskTitle = uniqueSuffix('Rejected Task');
  await apiCreateTask(request, adminSession, taskTitle, '0e29fb34-64da-429e-b7c0-e6016a0c10a7');

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(adminPage);

  const adminTaskRow = adminPage.locator('tr', { hasText: taskTitle }).first();
  await test.step('Admin submits task for approval', async () => {
    await adminTaskRow.getByRole('button', { name: 'Gönder' }).click();
    await expect(adminTaskRow).toContainText('PendingApproval');
  });
  await logout(adminPage);
  await adminContext.close();

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await login(managerPage, MANAGER_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(managerPage);

  const managerTaskRow = managerPage.locator('tr', { hasText: taskTitle }).first();
  await test.step('Manager rejects and closes the task', async () => {
    await managerTaskRow.getByRole('button', { name: 'Reddet' }).click();
    await expect(managerTaskRow).toContainText('Rejected');
    await managerTaskRow.getByRole('button', { name: 'Kapat' }).click();
    await expect(managerTaskRow).toContainText('Closed');
  });

  await managerContext.close();
});

test('task is directly assigned when target department has no manager', async ({ browser, request }) => {
  test.setTimeout(60_000);
  const adminSession = await authenticateApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const department = await apiCreateDepartment(request, adminSession, uniqueSuffix('Managersiz Birim'));
  const taskTitle = uniqueSuffix('Direct Assigned Task');
  await apiCreateTask(request, adminSession, taskTitle, department.departmentId);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(adminPage);

  const taskRow = adminPage.locator('tr', { hasText: taskTitle }).first();
  await test.step('Submit bypasses approval for manager-less department', async () => {
    await taskRow.getByRole('button', { name: 'Gönder' }).click();
    await expect(taskRow).toContainText('Assigned');
    await expect(taskRow).not.toContainText('PendingApproval');
  });

  await adminContext.close();
});

test('assignment requires at least one target and shows validation message', async ({ browser, request }) => {
  test.setTimeout(60_000);
  const adminSession = await authenticateApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const taskTitle = uniqueSuffix('Assignment Validation Task');
  await apiCreateTask(request, adminSession, taskTitle, '0e29fb34-64da-429e-b7c0-e6016a0c10a7');

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(adminPage);
  const adminTaskRow = adminPage.locator('tr', { hasText: taskTitle }).first();
  await adminTaskRow.getByRole('button', { name: 'Gönder' }).click();
  await logout(adminPage);
  await adminContext.close();

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await login(managerPage, MANAGER_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(managerPage);

  const managerTaskRow = managerPage.locator('tr', { hasText: taskTitle }).first();
  await managerTaskRow.getByRole('button', { name: 'Onayla' }).click();
  await expect(managerTaskRow).toContainText('Assigned');

  await test.step('Clearing both assignment targets surfaces validation', async () => {
    await managerTaskRow.getByLabel(`Departman seç ${taskTitle}`).selectOption('');
    await managerTaskRow.getByLabel(`Kullanıcı seç ${taskTitle}`).selectOption('');
    await managerTaskRow.getByRole('button', { name: 'Ata' }).click();
    await expect(managerPage.getByText('Hata: En az bir atama hedefi gereklidir.')).toBeVisible();
  });

  await test.step('Manager can still recover by assigning to valid department and user', async () => {
    await managerTaskRow.getByLabel(`Departman seç ${taskTitle}`).selectOption({ label: 'Fen İşleri Müdürlüğü' });
    await managerTaskRow.getByLabel(`Kullanıcı seç ${taskTitle}`).selectOption({ label: 'Emre Çelik' });
    await managerTaskRow.getByRole('button', { name: 'Ata' }).click();
    await expect(managerTaskRow).toContainText('Emre Çelik');
  });

  await managerContext.close();
});

test('assignment user options stay filtered to the selected department', async ({ browser, request }) => {
  test.setTimeout(60_000);
  const adminSession = await authenticateApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const taskTitle = uniqueSuffix('Assignment Filter Task');
  await apiCreateTask(request, adminSession, taskTitle, '0e29fb34-64da-429e-b7c0-e6016a0c10a7');

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(adminPage);

  const adminTaskRow = adminPage.locator('tr', { hasText: taskTitle }).first();
  await adminTaskRow.getByRole('button', { name: 'Gönder' }).click();
  await logout(adminPage);
  await adminContext.close();

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await login(managerPage, MANAGER_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(managerPage);

  const managerTaskRow = managerPage.locator('tr', { hasText: taskTitle }).first();
  await managerTaskRow.getByRole('button', { name: 'Onayla' }).click();
  await expect(managerTaskRow).toContainText('Assigned');

  const departmentSelect = managerTaskRow.getByLabel(`Departman seç ${taskTitle}`);
  const userSelect = managerTaskRow.getByLabel(`Kullanıcı seç ${taskTitle}`);

  await test.step('Fen Isleri secildiginde sadece ayni departmandaki kullanicilar listelenir', async () => {
    await departmentSelect.selectOption({ label: 'Fen İşleri Müdürlüğü' });
    const options = await userSelect.locator('option').allTextContents();

    expect(options).toContain('Zeynep Kara');
    expect(options).toContain('Emre Çelik');
    expect(options).not.toContain('Ali Yıldız');
    expect(options).not.toContain('Sistem Yöneticisi');
  });

  await test.step('Basin Yayin secildiginde liste buna gore yeniden filtrelenir', async () => {
    await departmentSelect.selectOption({ label: 'Basın Yayın Müdürlüğü' });
    const options = await userSelect.locator('option').allTextContents();

    expect(options).toContain('Ali Yıldız');
    expect(options).not.toContain('Emre Çelik');
    expect(options).not.toContain('Zeynep Kara');
  });

  await managerContext.close();
});

test('task form surfaces multiple validation messages from the API', async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(page);

  await page.route('**/api/v1/tasks', async route => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        title: 'One or more validation errors occurred.',
        errors: {
          Title: ['Gorev basligi zorunludur.'],
          Description: ['Gorev aciklamasi zorunludur.'],
        },
      }),
    });
  });

  await page.getByRole('button', { name: '+ Yeni Görev' }).click();
  await page.getByPlaceholder('Görev başlığı').fill(uniqueSuffix('Validation Task'));
  await page.getByRole('button', { name: 'Oluştur' }).click();

  const errorBox = page.locator('.error');
  await expect(errorBox).toContainText('Gorev basligi zorunludur.');
  await expect(errorBox).toContainText('Gorev aciklamasi zorunludur.');
});

test('assignment API rejects a user from a different department', async ({ request }) => {
  test.setTimeout(60_000);

  const adminSession = await authenticateApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const departments = await apiGetDepartments(request, adminSession);
  const users = await apiGetUsers(request, adminSession);

  const publicWorksDepartment = departments.find(department => department.name === 'Fen İşleri Müdürlüğü');
  const communicationsUser = users.find(user => user.email === 'ali.yildiz@tire.bel.tr');

  expect(publicWorksDepartment).toBeTruthy();
  expect(communicationsUser).toBeTruthy();

  const taskTitle = uniqueSuffix('Assignment Mismatch Task');
  const task = await apiCreateTask(request, adminSession, taskTitle, publicWorksDepartment!.departmentId);

  const submitResponse = await request.post(`${API_BASE_URL}/api/v1/tasks/${task.taskId}/submit`, {
    headers: getApiHeaders(adminSession),
    data: { note: 'ready for approval' },
  });
  expect(submitResponse.status()).toBe(204);

  const managerSession = await authenticateApi(request, MANAGER_EMAIL, ADMIN_PASSWORD);
  const approveResponse = await request.post(`${API_BASE_URL}/api/v1/tasks/${task.taskId}/approve`, {
    headers: getApiHeaders(managerSession),
    data: { comment: 'approved' },
  });
  expect(approveResponse.status()).toBe(204);

  const assignResponse = await request.post(`${API_BASE_URL}/api/v1/tasks/${task.taskId}/assign`, {
    headers: getApiHeaders(managerSession),
    data: {
      departmentId: publicWorksDepartment!.departmentId,
      userId: communicationsUser!.userId,
      actionType: 'ManualAssignment',
    },
  });

  expect(assignResponse.status()).toBe(400);
  const errorPayload = await assignResponse.json() as { errors?: Record<string, string[]> };
  expect(errorPayload.errors?.UserId ?? []).toContain('Secilen kullanici secilen departmana ait degil.');
});