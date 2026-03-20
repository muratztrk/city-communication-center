import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const TIRE_TENANT_ID = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e';
export const API_BASE_URL = process.env.CCC_API_BASE_URL ?? 'http://localhost:5000';
export const ADMIN_EMAIL = 'admin@tire.bel.tr';
export const MANAGER_EMAIL = 'zeynep.kara@tire.bel.tr';
export const STAFF_EMAIL = 'emre.celik@tire.bel.tr';
export const ADMIN_PASSWORD = process.env.CCC_INITIAL_PASSWORD ?? '';

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

export async function login(page: Page, username: string, password: string) {
  await page.goto('/');
  await page.getByLabel('Belediye').selectOption(TIRE_TENANT_ID);
  await page.getByLabel('Kullanıcı Adı / E-posta').fill(username);
  await page.getByLabel('Şifre').fill(password);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await expect(page.getByRole('heading', { name: '📊 Kontrol Paneli' })).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: '🚪 Çıkış' }).click();
  await expect(page.getByRole('button', { name: 'Giriş Yap' })).toBeVisible();
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

  expect(response.ok()).toBeTruthy();
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
      description: `${title} açıklaması`,
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
  await page.getByRole('button', { name: '📋 Görevler' }).click();
  await expect(page.getByRole('heading', { name: '📋 Görevler' })).toBeVisible();
}

export async function openSocialMessagesPage(page: Page) {
  await page.getByRole('button', { name: '📱 Sosyal Medya' }).click();
  await expect(page.getByRole('heading', { name: '📱 Sosyal Medya Mesajları' })).toBeVisible();
}