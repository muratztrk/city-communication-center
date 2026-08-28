import i18n from '../i18n'
import { getCachedSocialMediaBlob, getCachedSocialMediaFileName, setCachedSocialMediaBlob } from '../utils/socialMediaBlobCache'

function parseContentDispositionFileName(header: string | null): string | null {
  if (!header?.trim()) return null
  const utfMatch = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim().replace(/^"+|"+$/g, ''))
    } catch {
      return utfMatch[1].trim().replace(/^"+|"+$/g, '')
    }
  }
  const plainMatch = /filename\s*=\s*([^;]+)/i.exec(header)
  if (!plainMatch?.[1]) return null
  return plainMatch[1].trim().replace(/^"+|"+$/g, '') || null
}

function decodeOriginalFileNameHeader(header: string | null): string | null {
  if (!header?.trim()) return null
  try {
    return decodeURIComponent(header.trim())
  } catch {
    return header.trim()
  }
}
import type {
  AuditLog,
  Attachment,
  DashboardSnapshot,
  DashboardChartResponse,
  DashboardChartDrilldownResponse,
  CitizenDashboardMapPinsResponse,
  DashboardStatusChartsResponse,
  Department,
  DepartmentSummary,
  DirectoryUserLookup,
  EntityAuditLogEntry,
  LicenseModuleStatus,
  LicenseModuleKey,
  RoutingConfig,
  RoutingRule,
  RoutingTestResult,
  CitizenAutoReplyTemplates,
  SocialConnectionTestResult,
  SocialMessage,
  SocialConversationEntry,
  SocialSettingsSaveResult,
  SocialSettingsStatus,
  Task,
  TaskDetail,
  TaskListScope,
  JobSummary,
  JobDetail,
  EDevletBasvuruSummary,
  CitizenMessageApprovalRow,
  JobListScope,
  UpdateJobRequest,
  TenantAppearance,
  TenantAppearanceInput,
  TenantLogoKind,
  TenantAuthenticationPolicy,
  TenantLdapSettings,
  TenantSettings,
  User,
  UserLookup,
  UserManagementContext,
  WorkingHoursSettings,
  SmsSettings,
  SmsSettingsUpdate,
  TestSmsResult,
  FileStorageSettings,
  FileStorageSettingsUpdate,
  DatabaseBackupSettings,
  DatabaseBackupSettingsUpdate,
  SyslogSettings,
  SyslogSettingsUpdate,
  SlaWeekendSettings,
  SlaWeekendSettingsUpdate,
  DueDateConstraints,
  InternalMessagesSettings,
  InternalMessagesSettingsUpdate,
  AppNotification,
  CitizenConversationSummary,
  CitizenConversationDetail,
  InternalConversationSummary,
  InternalMessage,
  InternalConversationDetail,
  WhatsAppMessageTemplate,
  WhatsAppTemplatesSyncFromMetaResult,
  UserQuickReplyTemplate,
  RequestTag,
} from '../types/platform'
import { API_BASE } from './config'
import { ensureOk, fetchWithCredentials, getAuthHeaders } from './http'

async function uploadAttachmentWithProgress(url: string, file: File, onProgress?: (percent: number) => void): Promise<Attachment> {
  const formData = new FormData()
  formData.append('file', file)
  const authHeaders = await getAuthHeaders() as Record<string, string>

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', url)
    request.withCredentials = true
    for (const [key, value] of Object.entries(authHeaders)) {
      if (key.toLowerCase() !== 'content-type') request.setRequestHeader(key, value)
    }
    request.upload.onloadstart = () => onProgress?.(5)
    request.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.round((event.loaded / event.total) * 100))
        return
      }
      if (event.loaded > 0) {
        onProgress?.(Math.min(95, Math.round((event.loaded / Math.max(file.size, 1)) * 100)))
      }
    }
    request.onerror = () => reject(new Error(i18n.t('errors.attachmentUploadFailed', 'Failed to upload attachment')))
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(request.responseText || i18n.t('errors.attachmentUploadFailed', 'Failed to upload attachment')))
        return
      }
      try {
        onProgress?.(100)
        resolve(JSON.parse(request.responseText) as Attachment)
      } catch {
        reject(new Error(i18n.t('errors.attachmentUploadFailed', 'Failed to upload attachment')))
      }
    }
    request.send(formData)
  })
}

export const api = {
  async downloadAttachment(attachmentId: string): Promise<Blob> {
    const response = await fetchWithCredentials(`${API_BASE}/attachments/${attachmentId}/download`, {
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.attachmentDownloadFailed', 'Ek indirilemedi'))
    return response.blob()
  },

  async downloadSocialMedia(socialMessageId: string, entryId: string): Promise<{ blob: Blob; fileName: string | null }> {
    const cached = getCachedSocialMediaBlob(socialMessageId, entryId)
    if (cached) {
      return { blob: cached, fileName: getCachedSocialMediaFileName(socialMessageId, entryId) }
    }

    const response = await fetchWithCredentials(
      `${API_BASE}/social/messages/${socialMessageId}/conversation/media/${entryId}`,
      { headers: await getAuthHeaders() },
    )
    await ensureOk(response, i18n.t('whatsapp.mediaLoadFailed', 'Medya indirilemedi'))
    const blob = await response.blob()
    const headerName = decodeOriginalFileNameHeader(response.headers.get('X-Original-File-Name'))
      ?? parseContentDispositionFileName(response.headers.get('Content-Disposition'))
    setCachedSocialMediaBlob(socialMessageId, entryId, blob, headerName)
    return { blob, fileName: headerName?.trim() || null }
  },

  async getMyDepartments(): Promise<DepartmentSummary[]> {
    const response = await fetchWithCredentials(`${API_BASE}/me/departments`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.departmentsLoadFailed', 'Birim bilgileri yüklenemedi'))
    return response.json() as Promise<DepartmentSummary[]>
  },

  async getDueDateConstraints(): Promise<DueDateConstraints> {
    const response = await fetchWithCredentials(`${API_BASE}/me/due-date-constraints`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.dueDateConstraintsLoadFailed', 'Son tarih kısıtları yüklenemedi'))
    return response.json() as Promise<DueDateConstraints>
  },

  async getLicenseModules(): Promise<LicenseModuleStatus[]> {
    const response = await fetchWithCredentials(`${API_BASE}/me/license-modules`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.licenseModulesLoadFailed', 'Lisans modül durumu yüklenemedi'))
    return response.json() as Promise<LicenseModuleStatus[]>
  },

  async updateLicenseModuleToken(module: LicenseModuleKey, token: string): Promise<LicenseModuleStatus> {
    const response = await fetchWithCredentials(`${API_BASE}/me/license-modules/${module}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ token }),
    })
    await ensureOk(response, i18n.t('errors.licenseModuleSaveFailed', 'Lisans kodu kaydedilemedi'))
    return response.json() as Promise<LicenseModuleStatus>
  },

  async setLicenseModuleTestDisabled(module: LicenseModuleKey, disabled: boolean): Promise<LicenseModuleStatus> {
    const response = await fetchWithCredentials(`${API_BASE}/me/license-modules/${module}/test-disabled`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ disabled }),
    })
    await ensureOk(response, i18n.t('errors.licenseModuleTestToggleFailed', 'Lisans test durumu güncellenemedi'))
    return response.json() as Promise<LicenseModuleStatus>
  },

  async changeMyPassword(payload: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/me/change-password`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    await ensureOk(response, i18n.t('errors.passwordChangeFailed', 'Parola değiştirilemedi'))
  },

  // Anonim (giriş öncesi) çağrılır; oturum başlığı gerektirmez.
  async resetLocalUserPassword(payload: { tenantId: string; email: string }): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/auth/reset-local-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': i18n.resolvedLanguage ?? i18n.language ?? 'tr',
      },
      body: JSON.stringify(payload),
    })
    await ensureOk(response, i18n.t('errors.passwordResetFailed', 'Parola sıfırlanamadı'))
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

  async getDashboardStatusCharts(from?: string, to?: string, filters?: { staff: string; department?: string; mine: string; requestTagStatus?: string }): Promise<DashboardStatusChartsResponse> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (filters) {
      params.set('staffTaskType', filters.staff)
      if (filters.department) params.set('departmentTaskType', filters.department)
      params.set('myTaskType', filters.mine)
      if (filters.requestTagStatus) params.set('requestTagStatus', filters.requestTagStatus)
    }
    const qs = params.toString()
    const url = `${API_BASE}/reports/dashboard-status-charts${qs ? `?${qs}` : ''}`
    const response = await fetchWithCredentials(url, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.dashboardLoadFailed'))
    return response.json() as Promise<DashboardStatusChartsResponse>
  },

  async getDashboardChartDrilldown(
    chartKey: string,
    sliceKey: string,
    from?: string,
    to?: string,
    requestTagStatus?: string,
  ): Promise<DashboardChartDrilldownResponse> {
    const params = new URLSearchParams()
    params.set('chartKey', chartKey)
    params.set('sliceKey', sliceKey)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (requestTagStatus) params.set('requestTagStatus', requestTagStatus)
    const response = await fetchWithCredentials(`${API_BASE}/reports/dashboard-chart-drilldown?${params}`, {
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.dashboardLoadFailed'))
    return response.json() as Promise<DashboardChartDrilldownResponse>
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

  async getCitizenDashboardMapPins(from?: string, to?: string): Promise<CitizenDashboardMapPinsResponse> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    const url = `${API_BASE}/reports/dashboard-citizen-map-pins${qs ? `?${qs}` : ''}`
    const response = await fetchWithCredentials(url, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.citizenMapLoadFailed', 'Vatandaş talep haritası yüklenemedi.'))
    return response.json() as Promise<CitizenDashboardMapPinsResponse>
  },

  async getDepartmentDashboardMapPins(from?: string, to?: string): Promise<CitizenDashboardMapPinsResponse> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    const url = `${API_BASE}/reports/dashboard-department-map-pins${qs ? `?${qs}` : ''}`
    const response = await fetchWithCredentials(url, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.departmentMapLoadFailed', 'Birim talep haritası yüklenemedi.'))
    return response.json() as Promise<CitizenDashboardMapPinsResponse>
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
    sourceType?: string
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
        sourceType: payload.sourceType ?? null,
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

  async searchUsers(query: string, departmentId?: string, displayNameOnly = false): Promise<UserLookup[]> {
    const params = new URLSearchParams()

    if (query.trim()) {
      params.set('query', query.trim())
    }

    if (departmentId) {
      params.set('departmentId', departmentId)
    }

    if (displayNameOnly) {
      params.set('displayNameOnly', 'true')
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

  async listDirectoryDepartments(): Promise<string[]> {
    const response = await fetchWithCredentials(`${API_BASE}/users/directory-departments`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.directorySearchFailed'))
    return response.json() as Promise<string[]>
  },

  async listDirectoryUsers(): Promise<DirectoryUserLookup[]> {
    const response = await fetchWithCredentials(`${API_BASE}/users/directory-users`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.directorySearchFailed'))
    return response.json() as Promise<DirectoryUserLookup[]>
  },

  async syncDirectoryUsers(): Promise<{
    updatedCount: number
    unchangedCount: number
    newDirectoryCount: number
    message: string
    updatedUsers?: Array<{
      userId: string
      displayName: string
      changes: Array<{ field: string; oldValue: string | null; newValue: string | null }>
    }>
  }> {
    const response = await fetchWithCredentials(`${API_BASE}/users/sync/ad`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.directorySearchFailed'))
    return response.json()
  },

  async deleteUnusedLdapUsers(): Promise<{ deletedCount: number; message: string }> {
    const response = await fetchWithCredentials(`${API_BASE}/users/ldap/delete-unused`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('common.error'))
    return response.json() as Promise<{ deletedCount: number; message: string }>
  },

  async deleteUnusedLdapDepartments(): Promise<{ deletedCount: number; message: string }> {
    const response = await fetchWithCredentials(`${API_BASE}/departments/ldap/delete-unused`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('common.error'))
    return response.json() as Promise<{ deletedCount: number; message: string }>
  },

  async createUser(payload: {
    username: string | null
    displayName: string
    email: string | null
    password: string | null
    departmentId: string | null
    additionalDepartmentIds?: string[]
    roleCode: string
    additionalRoleCodes?: string[]
    isActive: boolean
    sourceType: string
    externalIdentityId: string | null
    ldapDepartmentName: string | null
    title?: string | null
    phone?: string | null
    mobilePhone?: string | null
    skipManagerQuota?: boolean
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
    additionalRoleCodes?: string[]
    isActive: boolean
    username?: string
    displayName?: string
    email?: string | null
    title?: string | null
    skipManagerQuota?: boolean
    mobilePhone?: string | null
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

  async getIzmirCbsNeighborhoods(districtId: string): Promise<Array<{ id: string; name: string }>> {
    const params = new URLSearchParams({ districtId })
    const response = await fetchWithCredentials(`${API_BASE}/izmir-cbs/neighborhoods?${params}`, {
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('settings.municipalityLocation.catalogLoadFailed', 'İzmir CBS adres listesi yüklenemedi.'))
    return response.json() as Promise<Array<{ id: string; name: string }>>
  },

  async getIzmirCbsStreets(neighborhoodId: string): Promise<Array<{ id: string; name: string }>> {
    const params = new URLSearchParams({ neighborhoodId })
    const response = await fetchWithCredentials(`${API_BASE}/izmir-cbs/streets?${params}`, {
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('settings.municipalityLocation.catalogLoadFailed', 'İzmir CBS adres listesi yüklenemedi.'))
    return response.json() as Promise<Array<{ id: string; name: string }>>
  },

  async getIzmirCbsDoorNumbers(streetId: string, neighborhoodId: string): Promise<Array<{ id: string; name: string }>> {
    const params = new URLSearchParams({ streetId, neighborhoodId })
    const response = await fetchWithCredentials(`${API_BASE}/izmir-cbs/door-numbers?${params}`, {
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('settings.municipalityLocation.catalogLoadFailed', 'İzmir CBS adres listesi yüklenemedi.'))
    return response.json() as Promise<Array<{ id: string; name: string }>>
  },

  async getIzmirCbsPoint(input: {
    districtId: string
    neighborhood?: string | null
    street?: string | null
    streetNo?: string | null
    allowNeighborhoodFallback?: boolean
  }): Promise<{ latitude: number; longitude: number; approximate: boolean } | null> {
    const params = new URLSearchParams({ districtId: input.districtId })
    if (input.neighborhood?.trim()) params.set('neighborhood', input.neighborhood.trim())
    if (input.street?.trim()) params.set('street', input.street.trim())
    if (input.streetNo?.trim()) params.set('streetNo', input.streetNo.trim())
    if (input.allowNeighborhoodFallback) params.set('allowNeighborhoodFallback', 'true')
    const response = await fetchWithCredentials(`${API_BASE}/izmir-cbs/point?${params}`, {
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('settings.municipalityLocation.catalogLoadFailed', 'İzmir CBS adres listesi yüklenemedi.'))
    return response.json() as Promise<{ latitude: number; longitude: number; approximate: boolean } | null>
  },

  async getIzmirCbsNearest(
    districtId: string,
    latitude: number,
    longitude: number,
  ): Promise<{ neighborhood: string; street: string } | null> {
    const params = new URLSearchParams({
      districtId,
      latitude: String(latitude),
      longitude: String(longitude),
    })
    const response = await fetchWithCredentials(`${API_BASE}/izmir-cbs/nearest?${params}`, {
      headers: await getAuthHeaders(),
    })
    if (!response.ok) return null
    return response.json() as Promise<{ neighborhood: string; street: string } | null>
  },

  async getIzmirCbsLandmarks(districtId: string): Promise<Array<{ name: string; category: string; latitude: number; longitude: number; kind?: string }>> {
    const params = new URLSearchParams({ districtId })
    const response = await fetchWithCredentials(`${API_BASE}/izmir-cbs/landmarks?${params}`, {
      headers: await getAuthHeaders(),
    })
    if (!response.ok) return []
    return response.json() as Promise<Array<{ name: string; category: string; latitude: number; longitude: number; kind?: string }>>
  },

  async getIzmirCbsMapReferenceLandmarks(districtId: string): Promise<Array<{ name: string; category: string; latitude: number; longitude: number; kind?: string }>> {
    const params = new URLSearchParams({ districtId })
    const response = await fetchWithCredentials(`${API_BASE}/izmir-cbs/map-reference-landmarks?${params}`, {
      headers: await getAuthHeaders(),
    })
    if (!response.ok) return []
    return response.json() as Promise<Array<{ name: string; category: string; latitude: number; longitude: number; kind?: string }>>
  },

  async resolveMapsAddressFromLink(
    url: string,
    districtId?: string,
  ): Promise<{ latitude: number; longitude: number; neighborhood: string; street: string; streetNo: string } | null> {
    const params = new URLSearchParams({ url })
    if (districtId?.trim()) params.set('districtId', districtId.trim())
    const response = await fetchWithCredentials(`${API_BASE}/maps/address-from-link?${params}`, {
      headers: await getAuthHeaders(),
    })
    if (!response.ok) return null
    const body = await response.json() as {
      latitude?: number
      longitude?: number
      neighborhood?: string
      street?: string
      streetNo?: string
    } | null
    if (body?.latitude == null || body?.longitude == null) return null
    if (!Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)) return null
    return {
      latitude: body.latitude,
      longitude: body.longitude,
      neighborhood: body.neighborhood?.trim() ?? '',
      street: body.street?.trim() ?? '',
      streetNo: body.streetNo?.trim() ?? '',
    }
  },

  async resolveMapsCoordinates(url: string): Promise<{ latitude: number; longitude: number } | null> {
    const params = new URLSearchParams({ url })
    const response = await fetchWithCredentials(`${API_BASE}/maps/coordinates?${params}`, {
      headers: await getAuthHeaders(),
    })
    if (!response.ok) return null
    const body = await response.json() as { latitude?: number; longitude?: number } | null
    if (body?.latitude == null || body?.longitude == null) return null
    if (!Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)) return null
    return { latitude: body.latitude, longitude: body.longitude }
  },

  async fillJobCbsAddressFromCoordinates(jobId: string, districtId: string, streetNo?: string | null): Promise<boolean> {
    const params = new URLSearchParams({ districtId })
    if (streetNo?.trim()) params.set('streetNo', streetNo.trim())
    const response = await fetchWithCredentials(
      `${API_BASE}/jobs/${jobId}/fill-cbs-address-from-coordinates?${params}`,
      { method: 'POST', headers: await getAuthHeaders() },
    )
    return response.ok
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
      recaptchaEnabled: boolean
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

  async uploadTenantLogo(tenantId: string, file: File, kind: TenantLogoKind = 'institution'): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    const authHeaders = await getAuthHeaders() as Record<string, string>
    const headers = Object.fromEntries(
      Object.entries(authHeaders).filter(([key]) => key.toLowerCase() !== 'content-type'),
    )
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/appearance/logo?kind=${kind}`, {
      method: 'POST',
      headers,
      body: formData,
    })
    await ensureOk(response, i18n.t('errors.tenantLogoUploadFailed', 'Logo yüklenemedi'))
    const result = await response.json() as { logoUrl: string }
    return result.logoUrl
  },

  async restorePreviousTenantLogo(tenantId: string, kind: TenantLogoKind = 'institution'): Promise<TenantAppearance> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/appearance/logo/restore-previous?kind=${kind}`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.tenantLogoRestoreFailed', 'Önceki logo geri yüklenemedi.'))
    return response.json() as Promise<TenantAppearance>
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

  async sendTestSms(tenantId: string, phoneNumber: string, text?: string): Promise<TestSmsResult> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/sms-settings/test`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, text: text ?? null }),
    })
    await ensureOk(response, i18n.t('errors.smsSettingsSaveFailed'))
    return response.json() as Promise<TestSmsResult>
  },

  async getFileStorageSettings(tenantId: string): Promise<FileStorageSettings> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/file-storage-settings`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.fileStorageSettingsLoadFailed'))
    return response.json() as Promise<FileStorageSettings>
  },

  async updateFileStorageSettings(tenantId: string, data: FileStorageSettingsUpdate): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/file-storage-settings`, {
      method: 'PUT',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await ensureOk(response, i18n.t('errors.fileStorageSettingsSaveFailed'))
  },

  async testFileStorageConnectivity(tenantId: string, data: {
    nasHost: string | null
    ftpHost: string | null
    ftpPort: number
  }): Promise<{ success: boolean; message: string | null }> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/file-storage-settings/test-connectivity`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await ensureOk(response, i18n.t('errors.fileStorageSettingsLoadFailed'))
    return response.json() as Promise<{ success: boolean; message: string | null }>
  },

  async testFileStorageNasUser(tenantId: string, data: {
    username: string
    password: string
    nasHost?: string | null
    nasShareName?: string | null
    nasProtocol?: string | null
  }): Promise<{ success: boolean; message: string }> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/file-storage-settings/test-nas-user`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await ensureOk(response, i18n.t('errors.fileStorageSettingsLoadFailed'))
    return response.json() as Promise<{ success: boolean; message: string }>
  },

  async getDatabaseBackupSettings(tenantId: string): Promise<DatabaseBackupSettings> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/database-backup-settings`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.databaseBackupSettingsLoadFailed'))
    return response.json() as Promise<DatabaseBackupSettings>
  },

  async updateDatabaseBackupSettings(tenantId: string, data: DatabaseBackupSettingsUpdate): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/database-backup-settings`, {
      method: 'PUT',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await ensureOk(response, i18n.t('errors.databaseBackupSettingsSaveFailed'))
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

  async getInternalMessagesSettings(tenantId?: string): Promise<InternalMessagesSettings> {
    const response = tenantId
      ? await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/internal-messages-settings`, { headers: await getAuthHeaders() })
      : await fetchWithCredentials(`${API_BASE}/internal-messages/settings`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.internalMessagesSettingsLoadFailed', 'Kurum içi mesaj ayarları alınamadı.'))
    return response.json() as Promise<InternalMessagesSettings>
  },

  async updateInternalMessagesSettings(tenantId: string, data: InternalMessagesSettingsUpdate): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/internal-messages-settings`, {
      method: 'PUT',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await ensureOk(response, i18n.t('errors.internalMessagesSettingsSaveFailed', 'Kurum içi mesaj ayarları kaydedilemedi.'))
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
    neighborhood?: string | null
    street?: string | null
    streetNo?: string | null
    openAddress?: string | null
    latitude?: number | null
    longitude?: number | null
  }): Promise<Task> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/routine`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(task),
    })
    await ensureOk(response, i18n.t('errors.taskCreateFailed'))
    return response.json() as Promise<Task>
  },

  async updateRoutineTask(taskId: string, task: {
    title: string
    description: string
    priority: string
    dueDateUtc?: string | null
    notes?: string | null
    neighborhood?: string | null
    street?: string | null
    streetNo?: string | null
    openAddress?: string | null
    latitude?: number | null
    longitude?: number | null
  }): Promise<Task> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/routine/${taskId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(task),
    })
    await ensureOk(response, i18n.t('errors.taskUpdateFailed', 'Görev güncellenemedi.'))
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

  async changeTaskStatus(taskId: string, newStatus: string, reason: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/${taskId}/change-status`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ newStatus, reason }),
    })
    await ensureOk(response, i18n.t('errors.taskStatusChangeFailed'))
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

  async updateTaskDueDate(taskId: string, dueDateUtc: string | null): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/tasks/${taskId}/due-date`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ dueDateUtc }),
    })
    await ensureOk(response, i18n.t('errors.taskUpdateFailed', 'Failed to update task'))
  },

  // Jobs
  async getJobs(scope?: JobListScope, departmentId?: string | null, requestType?: string | null): Promise<JobSummary[]> {
    const params = new URLSearchParams()
    if (scope) params.set('scope', scope)
    if (departmentId) params.set('departmentId', departmentId)
    if (requestType) params.set('requestType', requestType)
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
    neighborhood?: string | null
    street?: string | null
    streetNo?: string | null
    openAddress?: string | null
    locationMapsUrl?: string | null
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

  async approveJobOwner(jobId: string, comment?: string | null, confirmedIsProject?: boolean | null): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs/${jobId}/owner-approval/approve`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ comment: comment || null, confirmedIsProject: confirmedIsProject ?? null }),
    })
    await ensureOk(response, i18n.t('errors.jobApproveFailed', 'Failed to approve job'))
  },

  async approveJobTarget(jobId: string, departmentId: string, comment?: string | null): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs/${jobId}/target-approval/${departmentId}/approve`, {
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

  async forwardJobTarget(jobId: string, targetDepartmentId: string, note: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs/${jobId}/forward-target`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ targetDepartmentId, note }),
    })
    await ensureOk(response, i18n.t('errors.jobForwardFailed', 'Talep yönlendirilemedi'))
  },

  async addJobCoordinatingDepartments(jobId: string, departmentIds: string[]): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs/${jobId}/coordinating-departments`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ departmentIds }),
    })
    await ensureOk(response, i18n.t('errors.jobCoordinationFailed', 'Koordine birimler eklenemedi'))
  },

  async setJobManagerNote(jobId: string, note: string | null): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/jobs/${jobId}/manager-note`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ note }),
    })
    await ensureOk(response, i18n.t('errors.jobManagerNoteFailed', 'Yönetici notu kaydedilemedi'))
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

  async getSocialMessageById(socialMessageId: string): Promise<SocialMessage> {
    const response = await fetchWithCredentials(`${API_BASE}/social/messages/${socialMessageId}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.socialMessageLoadFailed', 'Vatandaş talebi yüklenemedi.'))
    const detail = await response.json() as SocialMessage & { socialMessageId?: string }
    return {
      socialMessageId: detail.socialMessageId ?? socialMessageId,
      channel: detail.channel,
      citizenHandle: detail.citizenHandle,
      content: detail.content ?? null,
      category: detail.category ?? null,
      status: detail.status,
      assignedDepartmentId: detail.assignedDepartmentId ?? null,
      assignedDepartmentName: detail.assignedDepartmentName ?? null,
      jobId: detail.jobId ?? null,
      citizenRequestNumber: detail.citizenRequestNumber ?? null,
      citizenRequestNumberYear: detail.citizenRequestNumberYear ?? null,
      receivedAtUtc: detail.receivedAtUtc,
      updatedAtUtc: detail.updatedAtUtc ?? null,
      latitude: detail.latitude,
      longitude: detail.longitude,
      citizenConversationId: detail.citizenConversationId ?? null,
    }
  },

  async updateSocialMessage(socialMessageId: string, payload: {
    channel: string
    citizenHandle: string
    content: string
    category?: string
    latitude?: number
    longitude?: number
  }): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/social/messages/${socialMessageId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    await ensureOk(response, i18n.t('errors.socialUpdateFailed', 'Vatandaş talebi güncellenemedi.'))
  },

  async createSocialMessage(payload: {
    channel: string
    citizenHandle: string
    content: string
    category?: string
    latitude?: number
    longitude?: number
    citizenConversationId?: string
  }): Promise<string> {
    const response = await fetchWithCredentials(`${API_BASE}/social/messages`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    await ensureOk(response, i18n.t('errors.socialCreateFailed'))
    const data = await response.json() as { socialMessageId?: string }
    if (!data.socialMessageId) {
      throw new Error(i18n.t('errors.socialCreateFailed'))
    }
    return data.socialMessageId
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
      requestType?: string | null
      targetDepartmentIds?: string[]
      isProject?: boolean
      startDateUtc?: string | null
      neighborhood?: string | null
      street?: string | null
      streetNo?: string | null
      openAddress?: string | null
      citizenName?: string | null
      citizenPhone?: string | null
      latitude?: number | null
      longitude?: number | null
      locationMapsUrl?: string | null
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

  async getSocialConversation(socialMessageId: string): Promise<SocialConversationEntry[]> {
    const response = await fetchWithCredentials(`${API_BASE}/social/messages/${socialMessageId}/conversation`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.socialMessagesLoadFailed'))
    return response.json() as Promise<SocialConversationEntry[]>
  },

  async replySocialMessage(
    socialMessageId: string,
    content: string,
    sendImmediately = false,
    options?: {
      whatsAppTemplateId?: string
      whatsAppTemplateName?: string
      whatsAppTemplateLanguage?: string
    },
  ): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/social/messages/${socialMessageId}/reply`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        sendImmediately,
        whatsAppTemplateId: options?.whatsAppTemplateId ?? null,
        whatsAppTemplateName: options?.whatsAppTemplateName ?? null,
        whatsAppTemplateLanguage: options?.whatsAppTemplateLanguage ?? null,
      }),
    })
    await ensureOk(response, i18n.t('errors.socialRouteFailed'))
  },

  async replySocialMessageAttachment(
    socialMessageId: string,
    file: File,
    content: string,
    sendImmediately = false,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    const formData = new FormData()
    formData.append('file', file, file.name)
    formData.append('content', content)
    formData.append('sendImmediately', String(sendImmediately))

    const authHeaders = await getAuthHeaders() as Record<string, string>

    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest()
      request.open('POST', `${API_BASE}/social/messages/${socialMessageId}/reply/attachment`)
      request.withCredentials = true
      for (const [key, value] of Object.entries(authHeaders)) {
        if (key.toLowerCase() !== 'content-type') request.setRequestHeader(key, value)
      }
      request.upload.onloadstart = () => onProgress?.(5)
      request.upload.onprogress = event => {
        if (event.lengthComputable && event.total > 0) {
          onProgress?.(Math.round((event.loaded / event.total) * 100))
          return
        }
        if (event.loaded > 0) {
          onProgress?.(Math.min(95, Math.round((event.loaded / Math.max(file.size, 1)) * 100)))
        }
      }
      request.onerror = () => reject(new Error(i18n.t('errors.socialRouteFailed')))
      request.onload = () => {
        if (request.status < 200 || request.status >= 300) {
          reject(new Error(request.responseText || i18n.t('errors.socialRouteFailed')))
          return
        }
        onProgress?.(100)
        resolve()
      }
      request.send(formData)
    })
  },

  async addInternalConversationMessage(socialMessageId: string, departmentId: string, content: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/social/messages/${socialMessageId}/conversation/internal`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ departmentId, content }),
    })
    await ensureOk(response, i18n.t('errors.socialRouteFailed'))
  },

  // Beklemedeki bir yanıtı vatandaşa iletir (yalnızca Vatandaş Operatörü/SystemAdmin) — card #1091.
  async sendPendingConversationEntry(socialMessageId: string, entryId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/social/messages/${socialMessageId}/conversation/${entryId}/send`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.socialRouteFailed'))
  },

  // Beklemedeki bir yanıtın metnini düzenler (yalnızca Vatandaş Operatörü/SystemAdmin) — card #1094.
  async editPendingConversationEntry(socialMessageId: string, entryId: string, content: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/social/messages/${socialMessageId}/conversation/${entryId}/edit`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    await ensureOk(response, i18n.t('errors.socialRouteFailed'))
  },

  getSocialMediaUrl(socialMessageId: string, entryId: string): string {
    return `${API_BASE}/social/messages/${socialMessageId}/conversation/media/${entryId}`
  },

  async getCitizenConversations(options?: { whatsAppOnly?: boolean }): Promise<CitizenConversationSummary[]> {
    const params = new URLSearchParams()
    if (options?.whatsAppOnly) params.set('whatsAppOnly', 'true')
    const query = params.toString()
    const response = await fetchWithCredentials(
      `${API_BASE}/citizen-conversations${query ? `?${query}` : ''}`,
      { headers: await getAuthHeaders() },
    )
    await ensureOk(response, i18n.t('errors.socialMessagesLoadFailed'))
    return response.json() as Promise<CitizenConversationSummary[]>
  },

  async getCitizenConversationDetail(conversationId: string): Promise<CitizenConversationDetail> {
    const response = await fetchWithCredentials(`${API_BASE}/citizen-conversations/${conversationId}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.socialMessagesLoadFailed'))
    return response.json() as Promise<CitizenConversationDetail>
  },

  async markConversationRead(conversationId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/citizen-conversations/${conversationId}/mark-read`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.socialRouteFailed'))
  },

  async markConversationWaitingReplied(conversationId: string): Promise<void> {
    const response = await fetchWithCredentials(
      `${API_BASE}/citizen-conversations/${conversationId}/mark-waiting-replied`,
      {
        method: 'POST',
        headers: await getAuthHeaders(),
      },
    )
    await ensureOk(response, i18n.t('errors.socialRouteFailed'))
  },

  async getInternalConversations(): Promise<InternalConversationSummary[]> {
    const response = await fetchWithCredentials(`${API_BASE}/internal-messages/conversations`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.internalMessagesLoadFailed', 'Kurum içi mesajlar yüklenemedi.'))
    return response.json() as Promise<InternalConversationSummary[]>
  },

  async getInternalConversationWithUser(otherUserId: string): Promise<InternalConversationDetail> {
    const response = await fetchWithCredentials(`${API_BASE}/internal-messages/conversations/with/${otherUserId}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.internalMessagesLoadFailed', 'Kurum içi mesajlar yüklenemedi.'))
    return response.json() as Promise<InternalConversationDetail>
  },

  async sendInternalMessage(recipientUserId: string, content: string): Promise<{ internalConversationId: string; message: InternalMessage }> {
    const response = await fetchWithCredentials(`${API_BASE}/internal-messages/messages`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientUserId, content }),
    })
    await ensureOk(response, i18n.t('errors.internalMessageSendFailed', 'Mesaj gönderilemedi.'))
    return response.json() as Promise<{ internalConversationId: string; message: InternalMessage }>
  },

  async markInternalConversationRead(internalConversationId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/internal-messages/conversations/${internalConversationId}/read`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.internalMessagesLoadFailed', 'Kurum içi mesajlar yüklenemedi.'))
  },

  async notifyInternalMessageTyping(recipientUserId: string, isTyping: boolean): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/internal-messages/typing`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientUserId, isTyping }),
    })
    await ensureOk(response, i18n.t('errors.internalMessageSendFailed', 'Mesaj gönderilemedi.'))
  },

  async getInternalTypingState(otherUserId: string): Promise<{ isTyping: boolean }> {
    const response = await fetchWithCredentials(`${API_BASE}/internal-messages/typing/${otherUserId}`, {
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.internalMessagesLoadFailed', 'Kurum içi mesajlar yüklenemedi.'))
    return await response.json() as { isTyping: boolean }
  },

  async updateCitizenConversationProfile(conversationId: string, payload: {
    citizenName?: string | null
    citizenPhone?: string | null
    label?: string | null
    neighborhood?: string | null
    street?: string | null
    streetNo?: string | null
    openAddress?: string | null
  }): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/citizen-conversations/${conversationId}/profile`, {
      method: 'PUT',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    await ensureOk(response, i18n.t('errors.socialRouteFailed'))
  },

  async getRequestTags(): Promise<RequestTag[]> {
    const response = await fetchWithCredentials(`${API_BASE}/citizen-conversations/tags`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.genericLoadFailed', 'Veriler yüklenemedi.'))
    return response.json() as Promise<RequestTag[]>
  },

  async createRequestTag(name: string): Promise<RequestTag> {
    const response = await fetchWithCredentials(`${API_BASE}/citizen-conversations/tags`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    await ensureOk(response, i18n.t('errors.genericSaveFailed', 'Kaydedilemedi.'))
    return response.json() as Promise<RequestTag>
  },

  async deleteRequestTag(tagId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/citizen-conversations/tags/${tagId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.genericDeleteFailed', 'Silinemedi.'))
  },

  async getWhatsAppTemplates(): Promise<WhatsAppMessageTemplate[]> {
    const response = await fetchWithCredentials(`${API_BASE}/whatsapp-templates`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.socialSettingsLoadFailed'))
    return response.json() as Promise<WhatsAppMessageTemplate[]>
  },

  async syncWhatsAppTemplatesFromMeta(): Promise<WhatsAppTemplatesSyncFromMetaResult> {
    const response = await fetchWithCredentials(`${API_BASE}/whatsapp-templates/sync-from-meta`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, 'Meta şablonları senkronize edilemedi.')
    return response.json() as Promise<WhatsAppTemplatesSyncFromMetaResult>
  },

  async createWhatsAppTemplate(data: Omit<WhatsAppMessageTemplate, 'templateId'>): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/whatsapp-templates`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await ensureOk(response, i18n.t('errors.socialSettingsSaveFailed'))
  },

  async updateWhatsAppTemplate(templateId: string, data: Omit<WhatsAppMessageTemplate, 'templateId'>): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/whatsapp-templates/${templateId}`, {
      method: 'PUT',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await ensureOk(response, i18n.t('errors.socialSettingsSaveFailed'))
  },

  async deleteWhatsAppTemplate(templateId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/whatsapp-templates/${templateId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.socialSettingsDeleteFailed'))
  },

  async getUserQuickReplies(): Promise<UserQuickReplyTemplate[]> {
    const response = await fetchWithCredentials(`${API_BASE}/me/quick-replies`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.genericLoadFailed', 'Veriler yüklenemedi.'))
    return response.json() as Promise<UserQuickReplyTemplate[]>
  },

  async createUserQuickReply(data: { name: string; content: string }): Promise<UserQuickReplyTemplate> {
    const response = await fetchWithCredentials(`${API_BASE}/me/quick-replies`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await ensureOk(response, i18n.t('errors.genericSaveFailed', 'Kaydedilemedi.'))
    return response.json() as Promise<UserQuickReplyTemplate>
  },

  async updateUserQuickReply(templateId: string, data: { name: string; content: string }): Promise<UserQuickReplyTemplate> {
    const response = await fetchWithCredentials(`${API_BASE}/me/quick-replies/${templateId}`, {
      method: 'PUT',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await ensureOk(response, i18n.t('errors.genericSaveFailed', 'Kaydedilemedi.'))
    return response.json() as Promise<UserQuickReplyTemplate>
  },

  async deleteUserQuickReply(templateId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/me/quick-replies/${templateId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.genericDeleteFailed', 'Silinemedi.'))
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

  async getCitizenAutoReplyTemplates(tenantId: string): Promise<CitizenAutoReplyTemplates> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/citizen-auto-replies`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.settingsLoadFailed'))
    return response.json() as Promise<CitizenAutoReplyTemplates>
  },

  async updateCitizenAutoReplyTemplates(tenantId: string, payload: CitizenAutoReplyTemplates): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/admin/tenants/${tenantId}/citizen-auto-replies`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    await ensureOk(response, i18n.t('errors.settingsSaveFailed'))
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

  async markAllNotificationsRead(): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/notifications/read-all`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, 'Failed to mark all notifications as read')
  },

  async deleteAllNotifications(): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/notifications/clear-all`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('notifications.deleteAllFailed', 'Bildirimler silinemedi'))
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

  async uploadJobAttachment(jobId: string, file: File, onProgress?: (percent: number) => void): Promise<Attachment> {
    return uploadAttachmentWithProgress(`${API_BASE}/attachments/jobs/${jobId}`, file, onProgress)
  },

  async uploadTaskAttachment(taskId: string, file: File, onProgress?: (percent: number) => void): Promise<Attachment> {
    return uploadAttachmentWithProgress(`${API_BASE}/attachments/tasks/${taskId}`, file, onProgress)
  },

  async uploadInternalMessageAttachment(messageId: string, file: File, onProgress?: (percent: number) => void): Promise<Attachment> {
    return uploadAttachmentWithProgress(`${API_BASE}/attachments/internal-messages/${messageId}`, file, onProgress)
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

  async getEDevletActivityTypes(): Promise<Array<{ activityTypeId: string; name: string; sortOrder: number }>> {
    const response = await fetchWithCredentials(`${API_BASE}/edevlet/activity-types`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.edevletActivityTypesLoadFailed', 'Faaliyet tipleri yüklenemedi.'))
    return response.json() as Promise<Array<{ activityTypeId: string; name: string; sortOrder: number }>>
  },

  async createEDevletActivityType(name: string): Promise<{ activityTypeId: string; name: string; sortOrder: number }> {
    const response = await fetchWithCredentials(`${API_BASE}/edevlet/activity-types`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ name }),
    })
    await ensureOk(response, i18n.t('errors.edevletActivityTypeCreateFailed', 'Faaliyet tipi oluşturulamadı.'))
    return response.json() as Promise<{ activityTypeId: string; name: string; sortOrder: number }>
  },

  async updateEDevletActivityType(activityTypeId: string, name: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/edevlet/activity-types/${activityTypeId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ name }),
    })
    await ensureOk(response, i18n.t('errors.edevletActivityTypeUpdateFailed', 'Faaliyet tipi güncellenemedi.'))
  },

  async deleteEDevletActivityType(activityTypeId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/edevlet/activity-types/${activityTypeId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.edevletActivityTypeDeleteFailed', 'Faaliyet tipi silinemedi.'))
  },

  async createEDevletDailyActivityPlan(payload: {
    activityTypeId: string
    description: string
    neighborhood?: string | null
    street?: string | null
    streetNo?: string | null
    openAddress?: string | null
  }): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/edevlet/daily-plans`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    await ensureOk(response, i18n.t('errors.edevletDailyPlanCreateFailed', 'Faaliyet planı kaydedilemedi.'))
  },

  async getEDevletDailyActivityPlans(): Promise<Array<{
    planId: string
    planNumber: number | null
    planNumberYear: number | null
    createdAtUtc: string
    activityTypeName: string
    neighborhood: string | null
    street: string | null
    description: string
    status: string
  }>> {
    const response = await fetchWithCredentials(`${API_BASE}/edevlet/daily-plans`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.edevletDailyPlansLoadFailed', 'Faaliyet planları yüklenemedi.'))
    return response.json() as Promise<Array<{
      planId: string
      planNumber: number | null
      planNumberYear: number | null
      createdAtUtc: string
      activityTypeName: string
      neighborhood: string | null
      street: string | null
      description: string
      status: string
    }>>
  },

  async getEDevletDailyActivityPlan(planId: string): Promise<{
    planId: string
    activityTypeId: string
    activityTypeName: string
    description: string
    neighborhood: string | null
    street: string | null
    openAddress: string | null
    planNumber: number | null
    planNumberYear: number | null
    status: string
    createdAtUtc: string
  }> {
    const response = await fetchWithCredentials(`${API_BASE}/edevlet/daily-plans/${planId}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.edevletDailyPlanLoadFailed', 'Faaliyet planı yüklenemedi.'))
    return response.json() as Promise<{
      planId: string
      activityTypeId: string
      activityTypeName: string
      description: string
      neighborhood: string | null
      street: string | null
      openAddress: string | null
      planNumber: number | null
      planNumberYear: number | null
      status: string
      createdAtUtc: string
    }>
  },

  async updateEDevletDailyActivityPlan(planId: string, payload: {
    activityTypeId: string
    description: string
    neighborhood?: string | null
    street?: string | null
    streetNo?: string | null
    openAddress?: string | null
  }): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/edevlet/daily-plans/${planId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    await ensureOk(response, i18n.t('errors.edevletDailyPlanUpdateFailed', 'Faaliyet planı güncellenemedi.'))
  },

  async cancelEDevletDailyActivityPlan(planId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/edevlet/daily-plans/${planId}/cancel`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.edevletDailyPlanCancelFailed', 'Faaliyet planı iptal edilemedi.'))
  },

  async duplicateEDevletDailyActivityPlan(planId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/edevlet/daily-plans/${planId}/duplicate`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.edevletDailyPlanDuplicateFailed', 'Faaliyet planı oluşturulamadı.'))
  },

  async getEDevletBasvurular(status?: string): Promise<EDevletBasvuruSummary[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : ''
    const response = await fetchWithCredentials(`${API_BASE}/edevlet/basvurular${query}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.edevletBasvurularLoadFailed', 'e-Devlet başvuruları yüklenemedi.'))
    return response.json()
  },

  async convertEDevletBasvuruToJob(basvuruId: string, payload: {
    title: string
    description: string
    ownerDepartmentId: string
    priority: string
    targetDepartmentIds?: string[]
    dueDateUtc?: string | null
    neighborhood?: string | null
    street?: string | null
    streetNo?: string | null
    openAddress?: string | null
    citizenName?: string | null
    citizenPhone?: string | null
  }): Promise<JobSummary> {
    const response = await fetchWithCredentials(`${API_BASE}/edevlet/basvurular/${basvuruId}/convert-to-job`, {
      method: 'POST',
      headers: {
        ...(await getAuthHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    await ensureOk(response, i18n.t('errors.edevletBasvuruConvertFailed', 'e-Devlet başvurusu talebe dönüştürülemedi.'))
    return response.json()
  },

  async getCitizenMessageApprovals(
    scope?: 'to-send' | 'sent' | 'all',
    channel?: 'whatsapp' | 'phone',
  ): Promise<CitizenMessageApprovalRow[]> {
    const params = new URLSearchParams()
    if (scope) params.set('scope', scope)
    if (channel) params.set('channel', channel)
    const query = params.size > 0 ? `?${params.toString()}` : ''
    const response = await fetchWithCredentials(`${API_BASE}/citizen-message-approvals${query}`, { headers: await getAuthHeaders() })
    await ensureOk(response, i18n.t('errors.citizenMessageApprovalsLoadFailed', 'Vatandaşa gönderilecek mesajlar yüklenemedi.'))
    return response.json()
  },

  async editCitizenMessageApprovalNote(jobId: string, note: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/citizen-message-approvals/${jobId}/note`, {
      method: 'POST',
      headers: {
        ...(await getAuthHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note }),
    })
    await ensureOk(response, i18n.t('errors.citizenMessageApprovalNoteSaveFailed', 'Not kaydedilemedi.'))
  },

  async releaseCitizenMessageApproval(jobId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/citizen-message-approvals/${jobId}/release`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.citizenMessageApprovalReleaseFailed', 'Mesaj gönderilemedi.'))
  },

  async reopenCitizenMessageJob(jobId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE}/citizen-message-approvals/${jobId}/reopen-to-in-progress`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    await ensureOk(response, i18n.t('errors.citizenMessageApprovalReopenFailed', 'Talep durumu değiştirilemedi.'))
  },
}
