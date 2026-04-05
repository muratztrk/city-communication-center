import { expect, test, type Locator, type Page } from '@playwright/test';
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
  openTaskScope,
  uniqueSuffix,
} from './helpers';

const PUBLIC_WORKS_DEPARTMENT_ID = '0e29fb34-64da-429e-b7c0-e6016a0c10a7';
const COMMUNICATIONS_DEPARTMENT_ID = '8f7264ff-c1df-48eb-bf39-a6ff42d7e9bc';

async function selectTaskRowUser(page: Page, row: Locator, query: string, optionPattern: RegExp | string = query) {
  const combobox = row.getByRole('combobox').last();
  await combobox.click();
  await combobox.fill(query);

  const option = page.getByRole('option', {
    name: optionPattern instanceof RegExp ? optionPattern : new RegExp(optionPattern, 'i'),
  }).first();
  await expect(option).toBeVisible();
  await option.click();
}

// Scenario Set:
// 1. Manual task creation and manager-approved assignment flow.
// 2. Rejection and close branch for approval-required tasks.
// 3. Department-pool claim flow for staff users.
// 4. Direct assignment branch when target department has no manager.
// 5. Assignment guardrail when both department and user are cleared.

test('manual task can be created from UI and completed through approval flow', async ({ browser }) => {
  test.setTimeout(90_000);
  const taskTitle = uniqueSuffix('Manual Approval Task');

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(adminPage);

  await test.step('Admin creates a manual task for Fen Isleri', async () => {
    await adminPage.getByRole('button', { name: '+ Yeni Gorev' }).click();
    await adminPage.getByPlaceholder('Gorev basligi').fill(taskTitle);
    await adminPage.getByPlaceholder('Gorev aciklamasi').fill(`${taskTitle} aciklamasi`);
    await adminPage.getByLabel('Gorev Turu').selectOption('InternalRequest');
    await adminPage.getByLabel('Hedef Departman').selectOption(PUBLIC_WORKS_DEPARTMENT_ID);
    await adminPage.getByRole('button', { name: 'Olustur' }).click();
  });

  const adminTaskRow = adminPage.locator('tr', { hasText: taskTitle }).first();
  await test.step('Admin submits the task for approval', async () => {
    await expect(adminTaskRow).toBeVisible();
    await expect(adminTaskRow).toContainText('Taslak');
    await adminTaskRow.getByRole('button', { name: 'Gonder' }).click();
    await expect(adminTaskRow).toContainText('Onay Bekliyor');
  });

  await logout(adminPage);
  await adminContext.close();

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await login(managerPage, MANAGER_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(managerPage);
  await openTaskScope(managerPage, 'Onay Bekleyen');

  await test.step('Manager approves and assigns the task', async () => {
    const managerTaskRow = managerPage.locator('tr', { hasText: taskTitle }).first();
    await managerTaskRow.getByRole('button', { name: 'Onayla' }).click();
    await openTaskScope(managerPage, 'Tum Gorevler');
    const assignedTaskRow = managerPage.locator('tr', { hasText: taskTitle }).first();
    await expect(assignedTaskRow).toContainText('Atandi');
    await assignedTaskRow.locator('select.field-select').selectOption(PUBLIC_WORKS_DEPARTMENT_ID);
    await selectTaskRowUser(managerPage, assignedTaskRow, 'Emre', /Emre/i);
    await assignedTaskRow.getByRole('button', { name: 'Ata' }).click();
    await expect(assignedTaskRow).toContainText(/Emre/i);
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
    await expect(staffTaskRow).toContainText('Tamamlandi', { timeout: 10_000 });
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
    await expect(closeTaskRow).toContainText('Kapatildi');
  });

  await closeContext.close();
});

test('manager can reject and close a task that requires approval', async ({ browser, request }) => {
  test.setTimeout(60_000);
  const adminSession = await authenticateApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const taskTitle = uniqueSuffix('Rejected Task');
  await apiCreateTask(request, adminSession, taskTitle, PUBLIC_WORKS_DEPARTMENT_ID);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(adminPage);

  const adminTaskRow = adminPage.locator('tr', { hasText: taskTitle }).first();
  await test.step('Admin submits task for approval', async () => {
    await adminTaskRow.getByRole('button', { name: 'Gonder' }).click();
    await expect(adminTaskRow).toContainText('Onay Bekliyor');
  });
  await logout(adminPage);
  await adminContext.close();

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await login(managerPage, MANAGER_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(managerPage);
  await openTaskScope(managerPage, 'Onay Bekleyen');

  await test.step('Manager rejects and closes the task', async () => {
    const managerTaskRow = managerPage.locator('tr', { hasText: taskTitle }).first();
    await managerTaskRow.getByRole('button', { name: 'Reddet' }).click();
    await openTaskScope(managerPage, 'Tum Gorevler');
    const rejectedTaskRow = managerPage.locator('tr', { hasText: taskTitle }).first();
    await expect(rejectedTaskRow).toContainText('Reddedildi');
    await rejectedTaskRow.getByRole('button', { name: 'Kapat' }).click();
    await expect(rejectedTaskRow).toContainText('Kapatildi');
  });

  await managerContext.close();
});

test('staff can claim a task from the department pool and continue from my tasks', async ({ browser, request }) => {
  test.setTimeout(60_000);
  const adminSession = await authenticateApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const taskTitle = uniqueSuffix('Department Pool Claim Task');
  await apiCreateTask(request, adminSession, taskTitle, PUBLIC_WORKS_DEPARTMENT_ID);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(adminPage);

  const adminTaskRow = adminPage.locator('tr', { hasText: taskTitle }).first();
  await adminTaskRow.getByRole('button', { name: 'Gonder' }).click();
  await logout(adminPage);
  await adminContext.close();

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await login(managerPage, MANAGER_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(managerPage);
  await openTaskScope(managerPage, 'Onay Bekleyen');

  const pendingTaskRow = managerPage.locator('tr', { hasText: taskTitle }).first();
  await pendingTaskRow.getByRole('button', { name: 'Onayla' }).click();
  await logout(managerPage);
  await managerContext.close();

  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await login(staffPage, STAFF_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(staffPage);
  await openTaskScope(staffPage, 'Departman Havuzu');

  await test.step('Staff claims the task from the department pool', async () => {
    const poolTaskRow = staffPage.locator('tr', { hasText: taskTitle }).first();
    await expect(poolTaskRow).toContainText('Departman havuzu');
    await poolTaskRow.getByRole('button', { name: 'Ustlen' }).click();
  });

  await test.step('Claimed task moves into my tasks view', async () => {
    await openTaskScope(staffPage, 'Benim Gorevlerim');
    const myTaskRow = staffPage.locator('tr', { hasText: taskTitle }).first();
    await expect(myTaskRow).toContainText(/Emre/i);
    await expect(myTaskRow.getByRole('button', { name: 'Tamamla' })).toBeVisible();
  });

  await staffContext.close();
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
    await taskRow.getByRole('button', { name: 'Gonder' }).click();
    await expect(taskRow).toContainText('Atandi');
    await expect(taskRow).not.toContainText('Onay Bekliyor');
  });

  await adminContext.close();
});

test('assignment requires at least one target and shows validation message', async ({ browser, request }) => {
  test.setTimeout(60_000);
  const adminSession = await authenticateApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const taskTitle = uniqueSuffix('Assignment Validation Task');
  await apiCreateTask(request, adminSession, taskTitle, PUBLIC_WORKS_DEPARTMENT_ID);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(adminPage);
  const adminTaskRow = adminPage.locator('tr', { hasText: taskTitle }).first();
  await adminTaskRow.getByRole('button', { name: 'Gonder' }).click();
  await logout(adminPage);
  await adminContext.close();

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await login(managerPage, MANAGER_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(managerPage);
  await openTaskScope(managerPage, 'Onay Bekleyen');

  const managerTaskRow = managerPage.locator('tr', { hasText: taskTitle }).first();
  await managerTaskRow.getByRole('button', { name: 'Onayla' }).click();
  await openTaskScope(managerPage, 'Tum Gorevler');

  const assignedTaskRow = managerPage.locator('tr', { hasText: taskTitle }).first();
  await expect(assignedTaskRow).toContainText('Atandi');

  await test.step('Clearing both assignment targets surfaces validation', async () => {
    await assignedTaskRow.locator('select.field-select').selectOption('');
    const assigneeBox = assignedTaskRow.getByRole('combobox').last();
    await assigneeBox.fill('');
    await assigneeBox.press('Escape');
    await assignedTaskRow.getByRole('button', { name: 'Ata' }).click({ force: true });
    await expect(managerPage.getByText(/En az bir atama hedefi gereklidir/i)).toBeVisible();
  });

  await test.step('Manager can still recover by assigning to valid department and user', async () => {
    await assignedTaskRow.locator('select.field-select').selectOption(PUBLIC_WORKS_DEPARTMENT_ID);
    await selectTaskRowUser(managerPage, assignedTaskRow, 'Emre', /Emre/i);
    await assignedTaskRow.getByRole('button', { name: 'Ata' }).click();
    await expect(assignedTaskRow).toContainText(/Emre/i);
  });

  await managerContext.close();
});

test('assignment user options stay filtered to the selected department', async ({ browser, request }) => {
  test.setTimeout(60_000);
  const adminSession = await authenticateApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const taskTitle = uniqueSuffix('Assignment Filter Task');
  await apiCreateTask(request, adminSession, taskTitle, PUBLIC_WORKS_DEPARTMENT_ID);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(adminPage);

  const adminTaskRow = adminPage.locator('tr', { hasText: taskTitle }).first();
  await adminTaskRow.getByRole('button', { name: 'Gonder' }).click();
  await logout(adminPage);
  await adminContext.close();

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await login(managerPage, MANAGER_EMAIL, ADMIN_PASSWORD);
  await openTasksPage(managerPage);
  await openTaskScope(managerPage, 'Onay Bekleyen');

  const managerTaskRow = managerPage.locator('tr', { hasText: taskTitle }).first();
  await managerTaskRow.getByRole('button', { name: 'Onayla' }).click();
  await openTaskScope(managerPage, 'Tum Gorevler');

  const assignedTaskRow = managerPage.locator('tr', { hasText: taskTitle }).first();
  await expect(assignedTaskRow).toContainText('Atandi');

  const departmentSelect = assignedTaskRow.locator('select.field-select');
  const userCombobox = assignedTaskRow.getByRole('combobox').last();

  await test.step('Fen Isleri secildiginde sadece ayni departmandaki kullanicilar listelenir', async () => {
    await departmentSelect.selectOption(PUBLIC_WORKS_DEPARTMENT_ID);
    await userCombobox.click();
    await expect(managerPage.getByRole('option', { name: /Emre/i })).toBeVisible();
    await expect(managerPage.getByRole('option', { name: /Ali/i })).toHaveCount(0);
    await expect(managerPage.getByRole('option', { name: /Sistem Yoneticisi/i })).toHaveCount(0);
  });

  await test.step('Basin Yayin secildiginde liste buna gore yeniden filtrelenir', async () => {
    await departmentSelect.selectOption(COMMUNICATIONS_DEPARTMENT_ID);
    await userCombobox.click();
    await expect(managerPage.getByRole('option', { name: /Ali/i })).toBeVisible();
    await expect(managerPage.getByRole('option', { name: /Emre/i })).toHaveCount(0);
    await expect(managerPage.getByRole('option', { name: /Zeynep/i })).toHaveCount(0);
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

  await page.getByRole('button', { name: '+ Yeni Gorev' }).click();
  await page.getByPlaceholder('Gorev basligi').fill(uniqueSuffix('Validation Task'));
  await page.getByRole('button', { name: 'Olustur' }).click();

  const errorBox = page.locator('.error');
  await expect(errorBox).toContainText('Gorev basligi zorunludur.');
  await expect(errorBox).toContainText('Gorev aciklamasi zorunludur.');
});

test('assignment API rejects a user from a different department', async ({ request }) => {
  test.setTimeout(60_000);

  const adminSession = await authenticateApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const departments = await apiGetDepartments(request, adminSession);
  const users = await apiGetUsers(request, adminSession);

  const publicWorksDepartment = departments.find(department => department.departmentId === PUBLIC_WORKS_DEPARTMENT_ID);
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
