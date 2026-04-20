import i18n from '../i18n'
import type {
  AuditLog,
  DashboardSnapshot,
  DashboardChartResponse,
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
  TaskListScope,
  TenantAppearance,
  TenantAppearanceInput,
  TenantAuthenticationPolicy,
  TenantLdapSettings,
  TenantSettings,
  User,
  UserLookup,
  UserManagementContext,
  ProjectSummary,
  ProjectDetail,
} from '../types/platform'
import { API_BASE } from './config'
import { ensureOk, getAuthHeaders } from './http'

export const api = {
  async getDashboard(): Promise<DashboardSnapshot> {
    const response = await fetch(`${API_BASE}/reports/dashboard`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.dashboardLoadFailed'))
    return response.json() as Promise<DashboardSnapshot>
  },

  async getDashboardChart(): Promise<DashboardChartResponse> {
    const response = await fetch(`${API_BASE}/reports/dashboard-chart`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.dashboardLoadFailed'))
    return response.json() as Promise<DashboardChartResponse>
  },

  async getDepartments(): Promise<Department[]> {
    const response = await fetch(`${API_BASE}/departments`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.departmentsLoadFailed'))
    return response.json() as Promise<Department[]>
  },

  async createDepartment(name: string, departmentType: string): Promise<Department> {
    const response = await fetch(`${API_BASE}/departments`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ name, departmentType }),
    })

    await ensureOk(response, i18n.t('errors.departmentCreateFailed'))
    return response.json() as Promise<Department>
  },

  async updateDepartment(departmentId: string, name: string, departmentType: string): Promise<Department> {
    const response = await fetch(`${API_BASE}/departments/${departmentId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ name, departmentType }),
    })

    await ensureOk(response, i18n.t('errors.departmentUpdateFailed'))
    return response.json() as Promise<Department>
  },

  async deleteDepartment(departmentId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/departments/${departmentId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })

    await ensureOk(response, i18n.t('errors.departmentDeleteFailed'))
  },

  async getUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE}/users`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.usersLoadFailed'))
    return response.json() as Promise<User[]>
  },

  async getUserManagementContext(): Promise<UserManagementContext> {
    const response = await fetch(`${API_BASE}/users/management-context`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.userManagementContextLoadFailed'))
    return response.json() as Promise<UserManagementContext>
  },

  async searchUsers(query: string, departmentId?: string): Promise<UserLookup[]> {
    const params = new URLSearchParams()

    if (query.trim()) {
      params.set('query', query.trim())
    }

    if (departmentId) {
      params.set('departmentId', departmentId)
    }

    const suffix = params.toString()
    const response = await fetch(`${API_BASE}/users/search${suffix ? `?${suffix}` : ''}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.userSearchFailed'))
    return response.json() as Promise<UserLookup[]>
  },

  async searchDirectoryUsers(query: string): Promise<DirectoryUserLookup[]> {
    const params = new URLSearchParams({ query })
    const response = await fetch(`${API_BASE}/users/directory-search?${params.toString()}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.directorySearchFailed'))
    return response.json() as Promise<DirectoryUserLookup[]>
  },

  async createUser(payload: {
    username: string | null
    displayName: string
    email: string | null
    password: string | null
    departmentId: string | null
    roleCode: string
    isActive: boolean
    sourceType: string
    externalIdentityId: string | null
    ldapDepartmentName: string | null
  }): Promise<User> {
    const response = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.userCreateFailed'))
    return response.json() as Promise<User>
  },

  async updateUser(userId: string, payload: {
    departmentId: string
    roleCode: string
    isActive: boolean
  }): Promise<User> {
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.userUpdateFailed'))
    return response.json() as Promise<User>
  },

  async deleteUser(userId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })

    await ensureOk(response, i18n.t('errors.userDeleteFailed'))
  },

  async getTenantSettings(tenantId: string): Promise<TenantSettings> {
    const response = await fetch(`${API_BASE}/admin/tenants/${tenantId}/settings`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.tenantSettingsLoadFailed'))
    return response.json() as Promise<TenantSettings>
  },

  async updateTenantSettings(
    tenantId: string,
    payload: Omit<TenantSettings, 'tenantId' | 'municipalityName' | 'isActive'>,
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/admin/tenants/${tenantId}/settings`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.tenantSettingsSaveFailed'))
  },

  async getTenantLdapSettings(tenantId: string): Promise<TenantLdapSettings> {
    const response = await fetch(`${API_BASE}/admin/tenants/${tenantId}/ldap-settings`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.tenantLdapSettingsLoadFailed'))
    return response.json() as Promise<TenantLdapSettings>
  },

  async updateTenantLdapSettings(
    tenantId: string,
    payload: {
      enabled: boolean
      host: string | null
      port: number
      useSsl: boolean
      ignoreCertificateErrors: boolean
      domain: string | null
      searchBase: string | null
      bindDn: string | null
      userAttribute: string
      bindPassword: string | null
      clearBindPassword: boolean
    },
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/admin/tenants/${tenantId}/ldap-settings`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.tenantLdapSettingsSaveFailed'))
  },

  async testLdapConnectivity(
    tenantId: string,
    payload: {
      host: string | null
      port: number
      useSsl: boolean
      ignoreCertificateErrors: boolean
      domain: string | null
      searchBase: string | null
      bindDn: string | null
      bindPassword: string | null
    },
  ): Promise<{ success: boolean; message: string | null }> {
    const response = await fetch(`${API_BASE}/admin/tenants/${tenantId}/ldap-settings/test-connectivity`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    await ensureOk(response, i18n.t('errors.tenantLdapSettingsSaveFailed'))
    return response.json()
  },

  async testLdapUserCredentials(
    tenantId: string,
    payload: { username: string; password: string },
  ): Promise<{ success: boolean; displayName: string | null; email: string | null; message: string | null }> {
    const response = await fetch(`${API_BASE}/admin/tenants/${tenantId}/ldap-settings/test-user-credentials`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    await ensureOk(response, i18n.t('errors.tenantLdapSettingsSaveFailed'))
    return response.json()
  },

  async getTenantAuthenticationPolicy(tenantId: string): Promise<TenantAuthenticationPolicy> {
    const response = await fetch(`${API_BASE}/admin/tenants/${tenantId}/authentication-policy`, {
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.tenantAuthenticationPolicyLoadFailed'))
    return response.json() as Promise<TenantAuthenticationPolicy>
  },

  async updateTenantAuthenticationPolicy(
    tenantId: string,
    payload: {
      automaticSignInEnabled: boolean
      automaticSignInMode: string
      trustedNetworkCidrs: string[]
      trustedProxyCidrs: string[]
      identityHeaderName: string | null
      requireSecondFactorOutsideTrustedNetwork: boolean
      secondFactorProvider: string
      codeLength: number
      codeTtlSeconds: number
      allowMockCodePreview: boolean
      webhookUrl: string | null
    },
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/admin/tenants/${tenantId}/authentication-policy`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.tenantAuthenticationPolicySaveFailed'))
  },

  async getTenantAppearance(tenantId: string): Promise<TenantAppearance> {
    const response = await fetch(`${API_BASE}/admin/tenants/${tenantId}/appearance`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.tenantAppearanceLoadFailed'))
    return response.json() as Promise<TenantAppearance>
  },

  async updateTenantAppearance(tenantId: string, payload: TenantAppearanceInput): Promise<void> {
    const response = await fetch(`${API_BASE}/admin/tenants/${tenantId}/appearance`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.tenantAppearanceSaveFailed'))
  },

  async getTasks(scope?: TaskListScope): Promise<Task[]> {
    const params = new URLSearchParams()

    if (scope) {
      params.set('scope', scope)
    }

    const suffix = params.toString()
    const response = await fetch(`${API_BASE}/tasks${suffix ? `?${suffix}` : ''}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.tasksLoadFailed'))
    return response.json() as Promise<Task[]>
  },

  async createTask(task: {
    title: string
    description: string
    taskType: string
    sourceType: string
    priority: string
    targetDepartmentId?: string
  }): Promise<Task> {
    const response = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(task),
    })

    await ensureOk(response, i18n.t('errors.taskCreateFailed'))
    return response.json() as Promise<Task>
  },

  async submitTask(taskId: string, note?: string): Promise<void> {
    const response = await fetch(`${API_BASE}/tasks/${taskId}/submit`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ note }),
    })

    await ensureOk(response, i18n.t('errors.taskSubmitFailed'))
  },

  async approveTask(taskId: string, comment?: string): Promise<void> {
    const response = await fetch(`${API_BASE}/tasks/${taskId}/approve`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ comment }),
    })

    await ensureOk(response, i18n.t('errors.taskApproveFailed'))
  },

  async rejectTask(taskId: string, comment?: string): Promise<void> {
    const response = await fetch(`${API_BASE}/tasks/${taskId}/reject`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ comment }),
    })

    await ensureOk(response, i18n.t('errors.taskRejectFailed'))
  },

  async assignTask(taskId: string, departmentId?: string, userId?: string): Promise<void> {
    const response = await fetch(`${API_BASE}/tasks/${taskId}/assign`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        departmentId: departmentId || null,
        userId: userId || null,
        actionType: 'Assign',
      }),
    })

    await ensureOk(response, i18n.t('errors.taskAssignFailed'))
  },

  async claimTask(taskId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/tasks/${taskId}/claim`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })

    await ensureOk(response, i18n.t('errors.taskClaimFailed'))
  },

  async completeTask(taskId: string, resultNote?: string): Promise<void> {
    const response = await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ resultNote }),
    })

    await ensureOk(response, i18n.t('errors.taskCompleteFailed'))
  },

  async closeTask(taskId: string, closureNote?: string): Promise<void> {
    const response = await fetch(`${API_BASE}/tasks/${taskId}/close`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ closureNote }),
    })

    await ensureOk(response, i18n.t('errors.taskCloseFailed'))
  },

  async getSocialMessages(): Promise<SocialMessage[]> {
    const response = await fetch(`${API_BASE}/social/messages`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.socialMessagesLoadFailed'))
    return response.json() as Promise<SocialMessage[]>
  },

  async routeSocialMessage(socialMessageId: string, departmentId?: string): Promise<void> {
    const response = await fetch(`${API_BASE}/social/messages/${socialMessageId}/route`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ departmentId: departmentId || null }),
    })

    await ensureOk(response, i18n.t('errors.socialRouteFailed'))
  },

  async convertSocialMessageToTask(
    socialMessageId: string,
    payload: { title: string; description: string; priority: string; dueDateUtc?: string | null },
  ): Promise<Task> {
    const response = await fetch(`${API_BASE}/social/messages/${socialMessageId}/convert`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.socialConvertFailed'))
    return response.json() as Promise<Task>
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const response = await fetch(`${API_BASE}/admin/audit-logs`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.auditLoadFailed'))
    return response.json() as Promise<AuditLog[]>
  },

  async getSocialSettingsStatus(): Promise<SocialSettingsStatus> {
    const response = await fetch(`${API_BASE}/admin/social-settings`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.socialSettingsLoadFailed'))
    return response.json() as Promise<SocialSettingsStatus>
  },

  async saveSocialSettings(channel: 'x' | 'facebook' | 'instagram' | 'whatsapp', payload: object): Promise<SocialSettingsSaveResult> {
    const response = await fetch(`${API_BASE}/admin/social-settings/${channel}`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.socialSettingsSaveFailed'))
    return response.json() as Promise<SocialSettingsSaveResult>
  },

  async testSocialSettings(channel: 'x' | 'facebook' | 'instagram' | 'whatsapp'): Promise<SocialConnectionTestResult> {
    const response = await fetch(`${API_BASE}/admin/social-settings/${channel}/test`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })

    await ensureOk(response, i18n.t('errors.socialSettingsTestFailed'))
    return response.json() as Promise<SocialConnectionTestResult>
  },

  async deleteSocialSettings(channel: 'x' | 'facebook' | 'instagram' | 'whatsapp'): Promise<SocialSettingsSaveResult> {
    const response = await fetch(`${API_BASE}/admin/social-settings/${channel}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })

    await ensureOk(response, i18n.t('errors.socialSettingsDeleteFailed'))
    return response.json() as Promise<SocialSettingsSaveResult>
  },

  async getRoutingConfig(): Promise<RoutingConfig> {
    const response = await fetch(`${API_BASE}/admin/routing`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.routingLoadFailed'))
    return response.json() as Promise<RoutingConfig>
  },

  async toggleAutoRouting(enabled: boolean): Promise<void> {
    const response = await fetch(`${API_BASE}/admin/routing/toggle`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ enabled }),
    })

    await ensureOk(response, i18n.t('errors.routingToggleFailed'))
  },

  async createRoutingRule(payload: {
    ruleName: string
    keywords: string
    targetDepartmentId: string
    priority: number
  }): Promise<RoutingRule> {
    const response = await fetch(`${API_BASE}/admin/routing/rules`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.routingSaveFailed'))
    return response.json() as Promise<RoutingRule>
  },

  async updateRoutingRule(
    ruleId: string,
    payload: { ruleName: string; keywords: string; targetDepartmentId: string; priority: number; isActive: boolean },
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/admin/routing/rules/${ruleId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.routingSaveFailed'))
  },

  async deleteRoutingRule(ruleId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/admin/routing/rules/${ruleId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })

    await ensureOk(response, i18n.t('errors.routingDeleteFailed'))
  },

  async testRouting(messageContent: string): Promise<RoutingTestResult> {
    const response = await fetch(`${API_BASE}/admin/routing/test`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ messageContent }),
    })

    await ensureOk(response, i18n.t('errors.routingTestFailed'))
    return response.json() as Promise<RoutingTestResult>
  },

  async getProjects(projectType?: 'Directorate' | 'Coordinated'): Promise<ProjectSummary[]> {
    const params = projectType ? `?projectType=${projectType}` : ''
    const response = await fetch(`${API_BASE}/projects${params}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.projectsLoadFailed', 'Failed to load projects'))
    return response.json() as Promise<ProjectSummary[]>
  },

  async getProjectById(projectId: string): Promise<ProjectDetail> {
    const response = await fetch(`${API_BASE}/projects/${projectId}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.projectLoadFailed', 'Failed to load project'))
    return response.json() as Promise<ProjectDetail>
  },

  async createDirectorateProject(payload: {
    title: string; description: string; ownerDepartmentId: string;
    stages: { title: string; description?: string; displayOrder: number; responsibleDepartmentId?: string }[]
  }): Promise<ProjectSummary> {
    const response = await fetch(`${API_BASE}/projects/directorate`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ ...payload, projectType: 'Directorate' }),
    })
    await ensureOk(response, i18n.t('errors.projectCreateFailed', 'Failed to create project'))
    return response.json() as Promise<ProjectSummary>
  },

  async createCoordinatedProject(payload: {
    title: string; description: string; ownerDepartmentId: string; departmentIds: string[];
    stages: { title: string; description?: string; displayOrder: number; responsibleDepartmentId?: string }[]
  }): Promise<ProjectSummary> {
    const response = await fetch(`${API_BASE}/projects/coordinated`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ ...payload, projectType: 'Coordinated' }),
    })
    await ensureOk(response, i18n.t('errors.projectCreateFailed', 'Failed to create project'))
    return response.json() as Promise<ProjectSummary>
  },

  async approveProject(projectId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/projects/${projectId}/approve`, {
      method: 'POST', headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.projectApproveFailed', 'Failed to approve project'))
  },

  async rejectProject(projectId: string, comment?: string): Promise<void> {
    const response = await fetch(`${API_BASE}/projects/${projectId}/reject`, {
      method: 'POST', headers: await getAuthHeaders(),
      body: JSON.stringify({ comment }),
    })
    await ensureOk(response, i18n.t('errors.projectRejectFailed', 'Failed to reject project'))
  },

  async updateProjectStatus(projectId: string, status: string): Promise<void> {
    const response = await fetch(`${API_BASE}/projects/${projectId}/status`, {
      method: 'PUT', headers: await getAuthHeaders(),
      body: JSON.stringify({ status }),
    })
    await ensureOk(response, i18n.t('errors.projectUpdateFailed', 'Failed to update project'))
  },

  async updateStageStatus(stageId: string, status: string): Promise<void> {
    const response = await fetch(`${API_BASE}/projects/stages/${stageId}/status`, {
      method: 'PUT', headers: await getAuthHeaders(),
      body: JSON.stringify({ status }),
    })
    await ensureOk(response, i18n.t('errors.projectUpdateFailed', 'Failed to update stage'))
  },

  async addProjectMember(projectId: string, userId: string, departmentId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/projects/${projectId}/members`, {
      method: 'POST', headers: await getAuthHeaders(),
      body: JSON.stringify({ userId, departmentId }),
    })
    await ensureOk(response, i18n.t('errors.projectUpdateFailed', 'Failed to add member'))
  },

  async approveDepartmentJoin(projectDepartmentId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/projects/departments/${projectDepartmentId}/approve`, {
      method: 'POST', headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.projectApproveFailed', 'Failed to approve department'))
  },

  async rejectDepartmentJoin(projectDepartmentId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/projects/departments/${projectDepartmentId}/reject`, {
      method: 'POST', headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.projectRejectFailed', 'Failed to reject department'))
  },

  async getUnreadNotificationCount(): Promise<number> {
    const response = await fetch(`${API_BASE}/notifications/unread-count`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.notificationsLoadFailed', 'Failed to load notifications'))
    return response.json() as Promise<number>
  },

  async subscribePush(subscription: { endpoint: string; p256dhKey: string; authKey: string; userAgent?: string }): Promise<{ subscriptionId: string }> {
    const response = await fetch(`${API_BASE}/notifications/push/subscribe`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(subscription),
    })
    await ensureOk(response, 'Failed to subscribe to push notifications')
    return response.json()
  },

  async unsubscribePush(endpoint: string): Promise<void> {
    const response = await fetch(`${API_BASE}/notifications/push/unsubscribe`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ endpoint }),
    })
    await ensureOk(response, 'Failed to unsubscribe from push notifications')
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, 'Failed to mark notification as read')
  },
}
