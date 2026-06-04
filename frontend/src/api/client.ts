import i18n from '../i18n'
import type {
  AuditLog,
  Attachment,
  DashboardSnapshot,
  DashboardChartResponse,
  Department,
  DepartmentSummary,
  DirectoryUserLookup,
  EntityAuditLogEntry,
  RoutingConfig,
  RoutingRule,
  RoutingTestResult,
  SocialConnectionTestResult,
  SocialMessage,
  SocialSettingsSaveResult,
  SocialSettingsStatus,
  Task,
  TaskDetail,
  TaskListScope,
  JobSummary,
  JobDetail,
  JobListScope,
  UpdateJobRequest,
  TenantAppearance,
  TenantAppearanceInput,
  TenantAuthenticationPolicy,
  TenantLdapSettings,
  TenantSettings,
  User,
  UserLookup,
  UserManagementContext,
  WorkingHoursSettings,
  SmsSettings,
  SmsSettingsUpdate,
  SyslogSettings,
  SyslogSettingsUpdate,
  SlaWeekendSettings,
  SlaWeekendSettingsUpdate,
  AppNotification,
} from '../types/platform'
import { API_BASE } from './config'
import { ensureOk, fetchWithCredentials, getAuthHeaders } from './http'

export const api = {
  async getMyDepartments(): Promise<DepartmentSummary[]> {
    const response = await fetchWithCredentials(`${API_BASE}/me/departments`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.departmentsLoadFailed', 'Birim bilgileri yüklenemedi'))
    return response.json() as Promise<DepartmentSummary[]>
  },

  async getDashboard(from?: string, to?: string): Promise<DashboardSnapshot> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    const url = `${API_BASE}/reports/dashboard${qs ? `?${qs}` : ''}`
    const response = await fetchWithCredentials(url, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.dashboardLoadFailed'))
    return response.json() as Promise<DashboardSnapshot>
  },

  async getDashboardChart(from?: string, to?: string): Promise<DashboardChartResponse> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    const url = `${API_BASE}/reports/dashboard-chart${qs ? `?${qs}` : ''}`
    const response = await fetchWithCredentials(url, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.dashboardLoadFailed'))
    return response.json() as Promise<DashboardChartResponse>
  },

  async getCitizenChannelChart(from?: string, to?: string): Promise<DashboardChartResponse> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    const url = `${API_BASE}/reports/citizen-channels${qs ? `?${qs}` : ''}`
    const response = await fetchWithCredentials(url, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.dashboardLoadFailed'))
    return response.json() as Promise<DashboardChartResponse>
  },

  async getDepartments(): Promise<Department[]> {
    const response = await fetchWithCredentials(`${API_BASE}/departments`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.departmentsLoadFailed'))
    return response.json() as Promise<Department[]>
  },

  async createDepartment(payload: {
    name: string
    departmentType: string
    managerUserId?: string | null
    responsibleUserIds?: string[]
  }): Promise<Department> {
    const response = await fetchWithCredentials(`${API_BASE}/departments`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        name: payload.name,
        departmentType: payload.departmentType,
        parentDepartmentId: null,
        managerUserId: payload.managerUserId ?? null,
        responsibleUserIds: payload.responsibleUserIds ?? [],
      }),
    })

    await ensureOk(response, i18n.t('errors.departmentCreateFailed'))
    return response.json() as Promise<Department>
  },

  async updateDepartment(departmentId: string, payload: {
    name: string
    departmentType: string
    managerUserId?: string | null
    responsibleUserIds?: string[]
  }): Promise<Department> {
    const response = await fetchWithCredentials(`${API_BASE}/departments/${departmentId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        name: payload.name,
        departmentType: payload.departmentType,
        managerUserId: payload.managerUserId ?? null,
        responsibleUserIds: payload.responsibleUserIds ?? [],
      }),
    })

    await ensureOk(response, i18n.t('errors.departmentUpdateFailed'))
    return response.json() as Promise<Department>
  },

  async deleteDepartment(departmentId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/departments/${departmentId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })

    await ensureOk(response, i18n.t('errors.departmentDeleteFailed'))
  },

  async getUsers(): Promise<User[]> {
    const response = await fetchWithCredentials(`${API_BASE}/users`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.usersLoadFailed'))
    return response.json() as Promise<User[]>
  },

  async getUserManagementContext(): Promise<UserManagementContext> {
    const response = await fetchWithCredentials(`${API_BASE}/users/management-context`, { headers: await getAuthHeaders() })
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
    const response = await fetchWithCredentials(`${API_BASE}/users/search${suffix ? `?${suffix}` : ''}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.userSearchFailed'))
    return response.json() as Promise<UserLookup[]>
  },

  async searchDirectoryUsers(query: string): Promise<DirectoryUserLookup[]> {
    const params = new URLSearchParams({ query })
    const response = await fetchWithCredentials(`${API_BASE}/users/directory-search?${params.toString()}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.directorySearchFailed'))
    return response.json() as Promise<DirectoryUserLookup[]>
  },

  async createUser(payload: {
    username: string | null
    displayName: string
    email: string | null
    password: string | null
    departmentId: string | null
    additionalDepartmentIds?: string[]
    roleCode: string
    isActive: boolean
    sourceType: string
    externalIdentityId: string | null
    ldapDepartmentName: string | null
  }): Promise<User> {
    const response = await fetchWithCredentials(`${API_BASE}/users`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.userCreateFailed'))
    return response.json() as Promise<User>
  },

  async updateUser(userId: string, payload: {
    departmentId: string
    additionalDepartmentIds?: string[]
    roleCode: string
    isActive: boolean
  }): Promise<User> {
    const response = await fetchWithCredentials(`${API_BASE}/users/${userId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.userUpdateFailed'))
    return response.json() as Promise<User>
  },

  async deleteUser(userId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/users/${userId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })

    await ensureOk(response, i18n.t('errors.userDeleteFailed'))
  },

  async getTenantSettings(tenantId: string): Promise<TenantSettings> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/settings`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.tenantSettingsLoadFailed'))
    return response.json() as Promise<TenantSettings>
  },

  async updateTenantSettings(
    tenantId: string,
    payload: Omit<TenantSettings, 'tenantId' | 'municipalityName' | 'isActive' | 'rolePageAccessJson'>,
  ): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/settings`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.tenantSettingsSaveFailed'))
  },

  async updateRolePageAccess(tenantId: string, matrixJson: string | null): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/role-page-access`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ matrixJson }),
    })

    await ensureOk(response, i18n.t('errors.tenantSettingsSaveFailed'))
  },

  async getTenantLdapSettings(tenantId: string): Promise<TenantLdapSettings> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/ldap-settings`, { headers: await getAuthHeaders() })
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
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/ldap-settings`, {
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
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/ldap-settings/test-connectivity`, {
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
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/ldap-settings/test-user-credentials`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    await ensureOk(response, i18n.t('errors.tenantLdapSettingsSaveFailed'))
    return response.json()
  },

  async getTenantAuthenticationPolicy(tenantId: string): Promise<TenantAuthenticationPolicy> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/authentication-policy`, {
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
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/authentication-policy`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.tenantAuthenticationPolicySaveFailed'))
  },

  async getTenantAppearance(tenantId: string): Promise<TenantAppearance> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/appearance`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.tenantAppearanceLoadFailed'))
    return response.json() as Promise<TenantAppearance>
  },

  async updateTenantAppearance(tenantId: string, payload: TenantAppearanceInput): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/appearance`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.tenantAppearanceSaveFailed'))
  },

  async getWorkingHours(tenantId: string): Promise<WorkingHoursSettings> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/working-hours`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.workingHoursLoadFailed'))
    return response.json() as Promise<WorkingHoursSettings>
  },

  async updateWorkingHours(tenantId: string, data: WorkingHoursSettings): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/working-hours`, {
      method: 'PUT',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await ensureOk(response, i18n.t('errors.workingHoursSaveFailed'))
  },

  async getSmsSettings(tenantId: string): Promise<SmsSettings> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/sms-settings`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.smsSettingsLoadFailed'))
    return response.json() as Promise<SmsSettings>
  },

  async updateSmsSettings(tenantId: string, data: SmsSettingsUpdate): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/sms-settings`, {
      method: 'PUT',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await ensureOk(response, i18n.t('errors.smsSettingsSaveFailed'))
  },

  async getSyslogSettings(tenantId: string): Promise<SyslogSettings> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/syslog-settings`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.syslogSettingsLoadFailed'))
    return response.json() as Promise<SyslogSettings>
  },

  async updateSyslogSettings(tenantId: string, data: SyslogSettingsUpdate): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/syslog-settings`, {
      method: 'PUT',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await ensureOk(response, i18n.t('errors.syslogSettingsSaveFailed'))
  },

  async getSlaWeekendSettings(tenantId: string): Promise<SlaWeekendSettings> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/sla-weekend-settings`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.slaWeekendSettingsLoadFailed'))
    return response.json() as Promise<SlaWeekendSettings>
  },

  async updateSlaWeekendSettings(tenantId: string, data: SlaWeekendSettingsUpdate): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/sla-weekend-settings`, {
      method: 'PUT',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await ensureOk(response, i18n.t('errors.slaWeekendSettingsSaveFailed'))
  },

  async getTasks(scope?: TaskListScope): Promise<Task[]> {
    const params = new URLSearchParams()

    if (scope) {
      params.set('scope', scope)
    }

    const suffix = params.toString()
    const response = await fetchWithCredentials(`${API_BASE}/tasks${suffix ? `?${suffix}` : ''}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.tasksLoadFailed'))
    return response.json() as Promise<Task[]>
  },

  async getTaskById(taskId: string): Promise<TaskDetail> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/${taskId}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.taskLoadFailed', 'Failed to load task'))
    return response.json() as Promise<TaskDetail>
  },

  async createTask(task: {
    jobId: string
    title: string
    description: string
    priority: string
    startDateUtc?: string | null
    dueDateUtc?: string | null
    estimatedHours?: number | null
    notes?: string | null
    assignedDepartmentId?: string | null
    assignedUserId?: string | null
  }): Promise<Task> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(task),
    })

    await ensureOk(response, i18n.t('errors.taskCreateFailed'))
    return response.json() as Promise<Task>
  },

  async createRoutineTask(task: {
    title: string
    description: string
    priority: string
    dueDateUtc?: string | null
    notes?: string | null
  }): Promise<Task> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/routine`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(task),
    })
    await ensureOk(response, i18n.t('errors.taskCreateFailed'))
    return response.json() as Promise<Task>
  },

  async assignTask(taskId: string, departmentId?: string | null, userId?: string | null): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/${taskId}/assign`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ departmentId: departmentId ?? null, userId: userId ?? null }),
    })
    await ensureOk(response, i18n.t('errors.taskAssignFailed'))
  },

  async claimTask(taskId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/${taskId}/claim`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.taskClaimFailed'))
  },

  async completeTask(taskId: string, resultNote?: string, actualHours?: number | null): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ resultNote, actualHours: actualHours ?? null }),
    })
    await ensureOk(response, i18n.t('errors.taskCompleteFailed'))
  },

  async approveTaskClose(taskId: string, comment?: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/${taskId}/approve-close`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ comment }),
    })
    await ensureOk(response, i18n.t('errors.taskApproveFailed'))
  },

  async rejectTaskClose(taskId: string, comment?: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/${taskId}/reject-close`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ comment }),
    })
    await ensureOk(response, i18n.t('errors.taskRejectFailed'))
  },

  async cancelTask(taskId: string, reason: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/${taskId}/cancel`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ reason }),
    })
    await ensureOk(response, i18n.t('errors.taskSubmitFailed'))
  },

  async requestTaskRevision(taskId: string, reason: string, proposedDueDateUtc?: string | null, targetManagerUserId?: string | null): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/${taskId}/request-revision`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ reason, proposedDueDateUtc: proposedDueDateUtc ?? null, targetManagerUserId: targetManagerUserId ?? null }),
    })
    await ensureOk(response, i18n.t('errors.taskSubmitFailed'))
  },

  async approveTaskRevision(taskId: string, reason?: string, proposedDueDateUtc?: string | null): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/${taskId}/approve-revision`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ reason: reason ?? '', proposedDueDateUtc: proposedDueDateUtc ?? null }),
    })
    await ensureOk(response, i18n.t('errors.taskApproveFailed'))
  },

  async rejectTaskRevision(taskId: string, comment?: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/${taskId}/reject-revision`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ comment }),
    })
    await ensureOk(response, i18n.t('errors.taskRejectFailed'))
  },

  async updateTaskProgress(
    taskId: string,
    payload: { completionPercentage?: number | null; actualHours?: number | null; notes?: string | null },
  ): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/${taskId}/progress`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    await ensureOk(response, i18n.t('errors.taskCompleteFailed'))
  },

  // Jobs
  async getJobs(scope?: JobListScope): Promise<JobSummary[]> {
    const params = new URLSearchParams()
    if (scope) params.set('scope', scope)
    const suffix = params.toString()
    const response = await fetchWithCredentials(`${API_BASE}/jobs${suffix ? `?${suffix}` : ''}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.jobsLoadFailed', 'Failed to load jobs'))
    return response.json() as Promise<JobSummary[]>
  },

  async getJobById(jobId: string): Promise<JobDetail> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs/${jobId}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.jobLoadFailed', 'Failed to load job'))
    return response.json() as Promise<JobDetail>
  },

  async createJob(payload: {
    title: string
    description: string
    ownerDepartmentId: string
    ownerUserIds?: string[]
    priority: string
    requestType?: string | null
    isProject?: boolean
    citizenName?: string | null
    citizenPhone?: string | null
    startDateUtc?: string | null
    dueDateUtc?: string | null
    targetDepartmentIds?: string[]
    sourceType?: string
    sourceRefId?: string | null
    latitude?: number | null
    longitude?: number | null
  }): Promise<JobSummary> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    await ensureOk(response, i18n.t('errors.jobCreateFailed', 'Failed to create job'))
    return response.json() as Promise<JobSummary>
  },

  async cancelJob(jobId: string, reason: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs/${jobId}/cancel`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ reason }),
    })
    await ensureOk(response, i18n.t('errors.jobCancelFailed', 'Failed to cancel job'))
  },

  async returnJob(jobId: string, reason: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs/${jobId}/return`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ reason }),
    })
    await ensureOk(response, i18n.t('errors.jobReturnFailed', 'Failed to return job'))
  },

  async approveJobOwner(jobId: string, comment?: string | null): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs/${jobId}/owner-approval/approve`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ comment: comment || null }),
    })
    await ensureOk(response, i18n.t('errors.jobApproveFailed', 'Failed to approve job'))
  },

  async rejectJobOwner(jobId: string, reason: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs/${jobId}/owner-approval/reject`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ reason }),
    })
    await ensureOk(response, i18n.t('errors.jobRejectFailed', 'Failed to reject job'))
  },

  async approveJobTarget(jobId: string, departmentId: string, comment?: string | null): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs/${jobId}/target-approval/${departmentId}/approve`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ comment: comment || null }),
    })
    await ensureOk(response, i18n.t('errors.jobApproveFailed', 'Failed to approve job'))
  },

  async rejectJobTarget(jobId: string, departmentId: string, reason: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs/${jobId}/target-approval/${departmentId}/reject`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ reason }),
    })
    await ensureOk(response, i18n.t('errors.jobRejectFailed', 'Failed to reject job'))
  },

  async deleteJob(jobId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs/${jobId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.jobDeleteFailed', 'Failed to delete job'))
  },

  async updateJob(jobId: string, data: UpdateJobRequest): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs/${jobId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    })
    await ensureOk(response, i18n.t('errors.jobUpdateFailed', 'Failed to update job'))
  },

  async getSocialMessages(): Promise<SocialMessage[]> {
    const response = await fetchWithCredentials(`${API_BASE}/social/messages`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.socialMessagesLoadFailed'))
    return response.json() as Promise<SocialMessage[]>
  },

  async createSocialMessage(payload: {
    channel: string
    citizenHandle: string
    content: string
    category?: string
    latitude?: number
    longitude?: number
  }): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/social/messages`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    await ensureOk(response, i18n.t('errors.socialCreateFailed'))
  },

  async routeSocialMessage(socialMessageId: string, departmentId?: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/social/messages/${socialMessageId}/route`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ departmentId: departmentId || null }),
    })

    await ensureOk(response, i18n.t('errors.socialRouteFailed'))
  },

  async convertSocialMessageToJob(
    socialMessageId: string,
    payload: {
      title: string
      description: string
      ownerDepartmentId: string
      priority: string
      dueDateUtc?: string | null
    },
  ): Promise<JobSummary> {
    const response = await fetchWithCredentials(`${API_BASE}/social/messages/${socialMessageId}/convert`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.socialConvertFailed'))
    return response.json() as Promise<JobSummary>
  },

  async deleteSocialMessage(socialMessageId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/social/messages/${socialMessageId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.socialDeleteFailed'))
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/audit-logs`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.auditLoadFailed'))
    return response.json() as Promise<AuditLog[]>
  },

  async getSocialSettingsStatus(): Promise<SocialSettingsStatus> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/social-settings`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.socialSettingsLoadFailed'))
    return response.json() as Promise<SocialSettingsStatus>
  },

  async saveSocialSettings(channel: 'x' | 'facebook' | 'instagram' | 'whatsapp' | 'edevlet' | 'email', payload: object): Promise<SocialSettingsSaveResult> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/social-settings/${channel}`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.socialSettingsSaveFailed'))
    return response.json() as Promise<SocialSettingsSaveResult>
  },

  async testSocialSettings(channel: 'x' | 'facebook' | 'instagram' | 'whatsapp' | 'edevlet' | 'email'): Promise<SocialConnectionTestResult> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/social-settings/${channel}/test`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })

    await ensureOk(response, i18n.t('errors.socialSettingsTestFailed'))
    return response.json() as Promise<SocialConnectionTestResult>
  },

  async deleteSocialSettings(channel: 'x' | 'facebook' | 'instagram' | 'whatsapp' | 'edevlet' | 'email'): Promise<SocialSettingsSaveResult> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/social-settings/${channel}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })

    await ensureOk(response, i18n.t('errors.socialSettingsDeleteFailed'))
    return response.json() as Promise<SocialSettingsSaveResult>
  },

  async getRoutingConfig(): Promise<RoutingConfig> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/routing`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.routingLoadFailed'))
    return response.json() as Promise<RoutingConfig>
  },

  async toggleAutoRouting(enabled: boolean): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/routing/toggle`, {
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
    const response = await fetchWithCredentials(`${API_BASE}/admin/routing/rules`, {
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
    const response = await fetchWithCredentials(`${API_BASE}/admin/routing/rules/${ruleId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    await ensureOk(response, i18n.t('errors.routingSaveFailed'))
  },

  async deleteRoutingRule(ruleId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/routing/rules/${ruleId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })

    await ensureOk(response, i18n.t('errors.routingDeleteFailed'))
  },

  async testRouting(messageContent: string): Promise<RoutingTestResult> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/routing/test`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ messageContent }),
    })

    await ensureOk(response, i18n.t('errors.routingTestFailed'))
    return response.json() as Promise<RoutingTestResult>
  },

  async getUnreadNotificationCount(): Promise<number> {
    const response = await fetchWithCredentials(`${API_BASE}/notifications/unread-count`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.notificationsLoadFailed', 'Failed to load notifications'))
    return response.json() as Promise<number>
  },

  async getNotifications(): Promise<AppNotification[]> {
    const response = await fetchWithCredentials(`${API_BASE}/notifications`, { headers: await getAuthHeaders() })
    await ensureOk(response, 'Failed to load notifications')
    return response.json() as Promise<AppNotification[]>
  },

  async markAllNotificationsRead(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => api.markNotificationRead(id)))
  },

  async subscribePush(subscription: { endpoint: string; p256dhKey: string; authKey: string; userAgent?: string }): Promise<{ subscriptionId: string }> {
    const response = await fetchWithCredentials(`${API_BASE}/notifications/push/subscribe`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(subscription),
    })
    await ensureOk(response, 'Failed to subscribe to push notifications')
    return response.json()
  },

  async unsubscribePush(endpoint: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/notifications/push/unsubscribe`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ endpoint }),
    })
    await ensureOk(response, 'Failed to unsubscribe from push notifications')
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, 'Failed to mark notification as read')
  },

  async uploadJobAttachment(jobId: string, file: File): Promise<Attachment> {
    const formData = new FormData()
    formData.append('file', file)
    const authHeaders = await getAuthHeaders() as Record<string, string>
    // Omit Content-Type so the browser sets the multipart boundary automatically
    const uploadHeaders: Record<string, string> = {}
    for (const [key, value] of Object.entries(authHeaders)) {
      if (key.toLowerCase() !== 'content-type') uploadHeaders[key] = value
    }
    const response = await fetchWithCredentials(`${API_BASE}/attachments/jobs/${jobId}`, {
      method: 'POST',
      headers: uploadHeaders,
      body: formData,
    })
    await ensureOk(response, i18n.t('errors.attachmentUploadFailed', 'Failed to upload attachment'))
    return response.json() as Promise<Attachment>
  },

  async uploadTaskAttachment(taskId: string, file: File): Promise<Attachment> {
    const formData = new FormData()
    formData.append('file', file)
    const authHeaders = await getAuthHeaders() as Record<string, string>
    const uploadHeaders: Record<string, string> = {}
    for (const [key, value] of Object.entries(authHeaders)) {
      if (key.toLowerCase() !== 'content-type') uploadHeaders[key] = value
    }
    const response = await fetchWithCredentials(`${API_BASE}/attachments/tasks/${taskId}`, {
      method: 'POST',
      headers: uploadHeaders,
      body: formData,
    })
    await ensureOk(response, i18n.t('errors.attachmentUploadFailed', 'Failed to upload attachment'))
    return response.json() as Promise<Attachment>
  },

  async deleteAttachment(attachmentId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })
    if (!response.ok && response.status !== 204) {
      throw new Error(await response.text())
    }
  },

  async getJobAuditLog(jobId: string): Promise<EntityAuditLogEntry[]> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs/${jobId}/audit-log`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.auditLoadFailed'))
    return response.json() as Promise<EntityAuditLogEntry[]>
  },

  async getTaskAuditLog(taskId: string): Promise<EntityAuditLogEntry[]> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/${taskId}/audit-log`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.auditLoadFailed'))
    return response.json() as Promise<EntityAuditLogEntry[]>
  },
}
