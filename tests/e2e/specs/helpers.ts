import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

export const TIRE_TENANT_ID = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e';
export const API_BASE_URL = process.env.CCC_API_BASE_URL ?? 'http://localhost:15000';
export const ADMIN_EMAIL = 'admin';
export const MANAGER_EMAIL = 'zeynep.kara';
export const STAFF_EMAIL = 'emre.celik';

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(name + ' must be set before running Playwright tests.');
  }

  return value;
}

export const ADMIN_PASSWORD = readRequiredEnv('CCC_INITIAL_PASSWORD');

export interface ApiSession {
  token: string;
  tenantId: string;
}

export interface DepartmentSummary {
  departmentId: string;
  tenantId: string;
  name: string;
  departmentType: string;
  parentDepartmentId: string | null;
  managerUserId: string | null;
}

export interface UserSummary {
  userId: string;
  tenantId: string;
  departmentId: string;
  displayName: string;
  email: string | null;
  roleCode: string;
  isActive: boolean;
  userSource: string;
}

export interface SocialMessageSummary {
  socialMessageId: string;
  channel: string;
  citizenHandle: string;
  category: string | null;
  status: string;
  assignedDepartmentId: string | null;
  taskId: string | null;
  receivedAtUtc: string;
}

export function uniqueSuffix(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export async function prepareTurkishUi(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('ccc_language', 'tr');
  });
}

export async function selectTenantIfVisible(page: Page, tenantId = TIRE_TENANT_ID) {
  const tenantSelect = page.locator('#tenant');
  if (await tenantSelect.count() === 0) {
    return;
  }

  await expect(tenantSelect).toBeVisible();
  await tenantSelect.selectOption(tenantId);
}

export async function login(page: Page, username: string, password: string) {
  await prepareTurkishUi(page);
  await page.goto('/');

  const usernameInput = page.locator('#username');
  const passwordInput = page.locator('#password');
  const submitButton = page.getByRole('button', { name: /giris yap/i });

  await expect(usernameInput).toBeVisible({ timeout: 15_000 });
  await expect(passwordInput).toBeVisible();
  await expect(submitButton).toBeVisible();

  await selectTenantIfVisible(page);
  await usernameInput.fill(username);
  await passwordInput.fill(password);
  await expect(submitButton).toBeEnabled();
  await passwordInput.press('Enter');

  const codeInput = page.getByLabel(/dogrulama kodu/i);
  if (await codeInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
    const mockCode = (await page.locator('.mock-code-value').innerText()).trim();
    await codeInput.fill(mockCode);
    await page.getByRole('button', { name: /dogrula/i }).click();
  }

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page.locator('main .page-title')).toContainText(/kontrol paneli|dashboard/i);
}

export async function selectAutocompleteOption(scope: Page | Locator, label: string, query: string, optionText = query) {
  const combobox = scope.getByRole('combobox', { name: label });
  await combobox.click();
  await combobox.fill(query);

  const option = scope.getByRole('option', { name: new RegExp(optionText, 'i') }).first();
  await expect(option).toBeVisible();
  await option.click();
}

export async function logout(page: Page) {
  const logoutButton = page.getByRole('button', { name: /cikis/i });
  await logoutButton.scrollIntoViewIfNeeded();
  await logoutButton.dispatchEvent('click');
  await expect(page.getByRole('button', { name: /giris yap/i })).toBeVisible();
}

export async function authenticateApi(request: APIRequestContext, username: string, password: string): Promise<ApiSession> {
  const response = await request.post(`${API_BASE_URL}/connect/token`, {
    form: {
      grant_type: 'password',
      username,
      password,
      tenant_id: TIRE_TENANT_ID,
    },
  });

  if (!response.ok()) {
    throw new Error(`Token request failed with ${response.status()}: ${await response.text()}`);
  }

  const payload = await response.json() as { access_token: string };

  return {
    token: payload.access_token,
    tenantId: TIRE_TENANT_ID,
  };
}

export function getApiHeaders(session: ApiSession): Record<string, string> {
  return {
    Authorization: `Bearer ${session.token}`,
    'Content-Type': 'application/json',
    'X-Tenant-Id': session.tenantId,
  };
}

export async function apiCreateTask(request: APIRequestContext, session: ApiSession, title: string, targetDepartmentId?: string) {
  const response = await request.post(`${API_BASE_URL}/api/v1/tasks`, {
    headers: getApiHeaders(session),
    data: {
      title,
      description: `${title} aciklamasi`,
      taskType: 'InternalRequest',
      sourceType: 'Manual',
      sourceRefId: null,
      targetDepartmentId: targetDepartmentId ?? null,
      priority: 'Normal',
      dueDateUtc: null,
    },
  });

  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{ taskId: string }>;
}

export async function apiCreateDepartment(request: APIRequestContext, session: ApiSession, name: string) {
  const response = await request.post(`${API_BASE_URL}/api/v1/departments`, {
    headers: getApiHeaders(session),
    data: {
      name,
      departmentType: 'Birim',
    },
  });

  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{ departmentId: string; name: string }>;
}

export async function apiGetDepartments(request: APIRequestContext, session: ApiSession) {
  const response = await request.get(`${API_BASE_URL}/api/v1/departments`, {
    headers: getApiHeaders(session),
  });

  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<DepartmentSummary[]>;
}

export async function apiGetUsers(request: APIRequestContext, session: ApiSession) {
  const response = await request.get(`${API_BASE_URL}/api/v1/users`, {
    headers: getApiHeaders(session),
  });

  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<UserSummary[]>;
}

export async function apiSearchDirectoryUsers(request: APIRequestContext, session: ApiSession, query: string) {
  const response = await request.get(`${API_BASE_URL}/api/v1/users/directory-search?query=${encodeURIComponent(query)}`, {
    headers: getApiHeaders(session),
  });

  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<Array<{
    externalIdentityId: string;
    username: string;
    displayName: string;
    email: string | null;
    alreadyLinked: boolean;
    existingUserId: string | null;
  }>>;
}

export async function apiGetSocialMessages(request: APIRequestContext, session: ApiSession) {
  const response = await request.get(`${API_BASE_URL}/api/v1/social/messages`, {
    headers: getApiHeaders(session),
  });

  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<SocialMessageSummary[]>;
}

export async function seedSocialMessage(request: APIRequestContext, citizenHandle: string) {
  const response = await request.post(`${API_BASE_URL}/api/v1/social/webhooks/instagram`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': TIRE_TENANT_ID,
    },
    data: {
      externalMessageId: uniqueSuffix('e2e-instagram'),
      citizenHandle,
      content: uniqueSuffix('E2E sosyal mesaj'),
      channel: 'Instagram',
      receivedAtUtc: new Date().toISOString(),
    },
  });

  expect(response.ok()).toBeTruthy();
}

export async function openTasksPage(page: Page) {
  await page.goto('/tasks');
  await expect(page).toHaveURL(/\/tasks/);
  await expect(page.locator('h1')).toContainText(/gorevler/i);
}

export async function openTaskScope(page: Page, name: string) {
  const scopeTab = page.getByRole('tab', { name, exact: true });
  await expect(scopeTab).toBeVisible();
  await scopeTab.click();
  await expect(scopeTab).toHaveAttribute('aria-selected', 'true');
}

export async function openSocialMessagesPage(page: Page) {
  await page.goto('/social');
  await expect(page).toHaveURL(/\/social/);
  await expect(page.locator('h1')).toContainText(/sosyal medya|sosyal/i);
}
