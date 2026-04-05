import type {
  AuditLog,
  Dashboard,
  Department,
  DirectoryUserLookup,
  RoutingConfig,
  RoutingRule,
  RoutingTestResult,
  SocialConnectionTestResult,
  SocialMessage,
  SocialSettingsSaveResult,
  SocialSettingsStatus,
  Task,
  TenantAuthenticationPolicy,
  TenantLdapSettings,
  TenantSettings,
  User,
  UserLookup,
  UserManagementContext,
} from '../types';
import { getStoredSession, getValidAccessToken } from './auth';
import { API_BASE } from './config';
import i18n from '../i18n';

async function getHeaders(): Promise<HeadersInit> {
  const token = await getValidAccessToken();
  const tenantId = getStoredSession()?.user.tenantId ?? null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept-Language': i18n.resolvedLanguage ?? i18n.language ?? 'tr',
  };

  if (tenantId) {
    headers['X-Tenant-Id'] = tenantId;
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

async function getErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  const responseText = await response.text();
  if (!responseText) {
    return fallbackMessage;
  }

  try {
    const payload = JSON.parse(responseText) as {
      title?: string;
      detail?: string;
      message?: string;
      error?: string;
      error_description?: string;
      errors?: Record<string, string[]>;
    };

    const validationMessages = payload.errors
      ? Object.values(payload.errors).flat().filter(Boolean)
      : [];

    if (validationMessages.length > 0) {
      return Array.from(new Set(validationMessages)).join('\n');
    }

    return payload.detail
      ?? payload.error_description
      ?? payload.message
      ?? payload.error
      ?? payload.title
      ?? fallbackMessage;
  } catch {
    return responseText || fallbackMessage;
  }
}

async function ensureOk(response: Response, fallbackMessage: string): Promise<Response> {
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, fallbackMessage));
  }

  return response;
}

export const api = {
  async getDashboard(): Promise<Dashboard> {
    const res = await fetch(`${API_BASE}/reports/dashboard`, { headers: await getHeaders() });
    await ensureOk(res, i18n.t('errors.dashboardLoadFailed'));
    return res.json();
  },

  async getDepartments(): Promise<Department[]> {
    const res = await fetch(`${API_BASE}/departments`, { headers: await getHeaders() });
    await ensureOk(res, i18n.t('errors.departmentsLoadFailed'));
    return res.json();
  },

  async createDepartment(name: string, departmentType: string): Promise<Department> {
    const res = await fetch(`${API_BASE}/departments`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ name, departmentType }),
    });
    await ensureOk(res, i18n.t('errors.departmentCreateFailed'));
    return res.json();
  },

  async getUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/users`, { headers: await getHeaders() });
    await ensureOk(res, i18n.t('errors.usersLoadFailed'));
    return res.json();
  },

  async getUserManagementContext(): Promise<UserManagementContext> {
    const res = await fetch(`${API_BASE}/users/management-context`, { headers: await getHeaders() });
    await ensureOk(res, i18n.t('errors.userManagementContextLoadFailed'));
    return res.json();
  },

  async searchUsers(query: string, departmentId?: string): Promise<UserLookup[]> {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set('query', query.trim());
    }
    if (departmentId) {
      params.set('departmentId', departmentId);
    }

    const suffix = params.toString();
    const res = await fetch(`${API_BASE}/users/search${suffix ? `?${suffix}` : ''}`, { headers: await getHeaders() });
    await ensureOk(res, i18n.t('errors.userSearchFailed'));
    return res.json();
  },

  async searchDirectoryUsers(query: string): Promise<DirectoryUserLookup[]> {
    const params = new URLSearchParams({ query });
    const res = await fetch(`${API_BASE}/users/directory-search?${params.toString()}`, { headers: await getHeaders() });
    await ensureOk(res, i18n.t('errors.directorySearchFailed'));
    return res.json();
  },

  async createUser(payload: {
    username: string | null;
    displayName: string;
    email: string | null;
    password: string | null;
    departmentId: string;
    roleCode: string;
    isActive: boolean;
    sourceType: string;
    externalIdentityId: string | null;
  }): Promise<User> {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(payload),
    });
    await ensureOk(res, i18n.t('errors.userCreateFailed'));
    return res.json();
  },

  async getTenantSettings(tenantId: string): Promise<TenantSettings> {
    const res = await fetch(`${API_BASE}/admin/tenants/${tenantId}/settings`, { headers: await getHeaders() });
    await ensureOk(res, i18n.t('errors.tenantSettingsLoadFailed'));
    return res.json();
  },

  async updateTenantSettings(tenantId: string, payload: Omit<TenantSettings, 'tenantId' | 'municipalityName' | 'isActive'>): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/tenants/${tenantId}/settings`, {
      method: 'PUT',
      headers: await getHeaders(),
      body: JSON.stringify(payload),
    });
    await ensureOk(res, i18n.t('errors.tenantSettingsSaveFailed'));
  },

  async getTenantLdapSettings(tenantId: string): Promise<TenantLdapSettings> {
    const res = await fetch(`${API_BASE}/admin/tenants/${tenantId}/ldap-settings`, { headers: await getHeaders() });
    await ensureOk(res, i18n.t('errors.tenantLdapSettingsLoadFailed'));
    return res.json();
  },

  async updateTenantLdapSettings(tenantId: string, payload: {
    enabled: boolean;
    autoProvisionUsers: boolean;
    host: string | null;
    port: number;
    useSsl: boolean;
    ignoreCertificateErrors: boolean;
    domain: string | null;
    searchBase: string | null;
    bindDn: string | null;
    userAttribute: string;
    bindPassword: string | null;
    clearBindPassword: boolean;
  }): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/tenants/${tenantId}/ldap-settings`, {
      method: 'PUT',
      headers: await getHeaders(),
      body: JSON.stringify(payload),
    });
    await ensureOk(res, i18n.t('errors.tenantLdapSettingsSaveFailed'));
  },

  async getTenantAuthenticationPolicy(tenantId: string): Promise<TenantAuthenticationPolicy> {
    const res = await fetch(`${API_BASE}/admin/tenants/${tenantId}/authentication-policy`, { headers: await getHeaders() });
    await ensureOk(res, i18n.t('errors.tenantAuthenticationPolicyLoadFailed'));
    return res.json();
  },

  async updateTenantAuthenticationPolicy(tenantId: string, payload: {
    automaticSignInEnabled: boolean;
    automaticSignInMode: string;
    trustedNetworkCidrs: string[];
    trustedProxyCidrs: string[];
    identityHeaderName: string | null;
    requireSecondFactorOutsideTrustedNetwork: boolean;
    secondFactorProvider: string;
    codeLength: number;
    codeTtlSeconds: number;
    allowMockCodePreview: boolean;
    webhookUrl: string | null;
  }): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/tenants/${tenantId}/authentication-policy`, {
      method: 'PUT',
      headers: await getHeaders(),
      body: JSON.stringify(payload),
    });
    await ensureOk(res, i18n.t('errors.tenantAuthenticationPolicySaveFailed'));
  },

  async getTasks(): Promise<Task[]> {
    const res = await fetch(`${API_BASE}/tasks`, { headers: await getHeaders() });
    await ensureOk(res, i18n.t('errors.tasksLoadFailed'));
    return res.json();
  },

  async createTask(task: { title: string; description: string; taskType: string; sourceType: string; priority: string; targetDepartmentId?: string }): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(task),
    });
    await ensureOk(res, i18n.t('errors.taskCreateFailed'));
    return res.json();
  },

  async submitTask(taskId: string, note?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/submit`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ note }),
    });
    await ensureOk(res, i18n.t('errors.taskSubmitFailed'));
  },

  async approveTask(taskId: string, comment?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/approve`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ comment }),
    });
    await ensureOk(res, i18n.t('errors.taskApproveFailed'));
  },

  async rejectTask(taskId: string, comment?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/reject`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ comment }),
    });
    await ensureOk(res, i18n.t('errors.taskRejectFailed'));
  },

  async assignTask(taskId: string, departmentId?: string, userId?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/assign`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ departmentId: departmentId || null, userId: userId || null, actionType: 'Assign' }),
    });
    await ensureOk(res, i18n.t('errors.taskAssignFailed'));
  },

  async completeTask(taskId: string, resultNote?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ resultNote }),
    });
    await ensureOk(res, i18n.t('errors.taskCompleteFailed'));
  },

  async closeTask(taskId: string, closureNote?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/close`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ closureNote }),
    });
    await ensureOk(res, i18n.t('errors.taskCloseFailed'));
  },

  async getSocialMessages(): Promise<SocialMessage[]> {
    const res = await fetch(`${API_BASE}/social/messages`, { headers: await getHeaders() });
    await ensureOk(res, i18n.t('errors.socialMessagesLoadFailed'));
    return res.json();
  },

  async routeSocialMessage(socialMessageId: string, departmentId?: string, userId?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/social/messages/${socialMessageId}/route`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ departmentId: departmentId || null, userId: userId ?? null }),
    });
    await ensureOk(res, i18n.t('errors.socialRouteFailed'));
  },

  async convertSocialMessageToTask(socialMessageId: string, payload: { title: string; description: string; priority: string; dueDateUtc?: string | null }): Promise<void> {
    const res = await fetch(`${API_BASE}/social/messages/${socialMessageId}/convert`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(payload),
    });
    await ensureOk(res, i18n.t('errors.socialConvertFailed'));
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/admin/audit-logs`, { headers: await getHeaders() });
    await ensureOk(res, i18n.t('errors.auditLoadFailed'));
    return res.json();
  },

  async getSocialSettingsStatus(): Promise<SocialSettingsStatus> {
    const res = await fetch(`${API_BASE}/admin/social-settings`, { headers: await getHeaders() });
    await ensureOk(res, i18n.t('errors.socialSettingsLoadFailed'));
    return res.json();
  },

  async saveSocialSettings(channel: 'x' | 'facebook' | 'instagram' | 'whatsapp', payload: object): Promise<SocialSettingsSaveResult> {
    const res = await fetch(`${API_BASE}/admin/social-settings/${channel}`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(payload),
    });
    await ensureOk(res, i18n.t('errors.socialSettingsSaveFailed'));
    return res.json();
  },

  async testSocialSettings(channel: 'x' | 'facebook' | 'instagram' | 'whatsapp'): Promise<SocialConnectionTestResult> {
    const res = await fetch(`${API_BASE}/admin/social-settings/${channel}/test`, {
      method: 'POST',
      headers: await getHeaders(),
    });
    await ensureOk(res, i18n.t('errors.socialSettingsTestFailed'));
    return res.json();
  },

  async deleteSocialSettings(channel: 'x' | 'facebook' | 'instagram' | 'whatsapp'): Promise<SocialSettingsSaveResult> {
    const res = await fetch(`${API_BASE}/admin/social-settings/${channel}`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    await ensureOk(res, i18n.t('errors.socialSettingsDeleteFailed'));
    return res.json();
  },

  async getRoutingConfig(): Promise<RoutingConfig> {
    const res = await fetch(`${API_BASE}/admin/routing`, { headers: await getHeaders() });
    await ensureOk(res, i18n.t('errors.routingLoadFailed'));
    return res.json();
  },

  async toggleAutoRouting(enabled: boolean): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/routing/toggle`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ enabled }),
    });
    await ensureOk(res, i18n.t('errors.routingToggleFailed'));
  },

  async createRoutingRule(payload: { ruleName: string; keywords: string; targetDepartmentId: string; priority: number }): Promise<RoutingRule> {
    const res = await fetch(`${API_BASE}/admin/routing/rules`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(payload),
    });
    await ensureOk(res, i18n.t('errors.routingSaveFailed'));
    return res.json();
  },

  async updateRoutingRule(ruleId: string, payload: { ruleName: string; keywords: string; targetDepartmentId: string; priority: number; isActive: boolean }): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/routing/rules/${ruleId}`, {
      method: 'PUT',
      headers: await getHeaders(),
      body: JSON.stringify(payload),
    });
    await ensureOk(res, i18n.t('errors.routingSaveFailed'));
  },

  async deleteRoutingRule(ruleId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/routing/rules/${ruleId}`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    await ensureOk(res, i18n.t('errors.routingDeleteFailed'));
  },

  async testRouting(messageContent: string): Promise<RoutingTestResult> {
    const res = await fetch(`${API_BASE}/admin/routing/test`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ messageContent }),
    });
    await ensureOk(res, i18n.t('errors.routingTestFailed'));
    return res.json();
  },
};
