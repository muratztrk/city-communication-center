import type { JobListScope, TaskListScope } from '../types/platform'

type DateRange = {
  from?: string | null
  to?: string | null
  departmentId?: string | null
  staffTaskType?: string
  departmentTaskType?: string
  myTaskType?: string
  requestTagStatus?: string
}

const normalize = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== ''),
  )

export const queryKeys = {
  all: ['ccc'] as const,
  auditLogs: {
    all: ['ccc', 'audit-logs'] as const,
    list: () => ['ccc', 'audit-logs', 'list'] as const,
    entity: (entityType: string, entityId: string) => ['ccc', 'audit-logs', 'entity', entityType, entityId] as const,
  },
  auth: {
    all: ['ccc', 'auth'] as const,
    me: () => ['ccc', 'auth', 'me'] as const,
    sessionMe: () => ['ccc', 'auth', 'session-me'] as const,
    tenantContext: () => ['ccc', 'auth', 'tenant-context'] as const,
    tenants: () => ['ccc', 'auth', 'tenants'] as const,
  },
  dashboard: {
    all: ['ccc', 'dashboard'] as const,
    snapshot: (range: DateRange = {}) => ['ccc', 'dashboard', 'snapshot', normalize(range)] as const,
    chart: (range: DateRange = {}) => ['ccc', 'dashboard', 'chart', normalize(range)] as const,
    statusCharts: (range: DateRange = {}) => ['ccc', 'dashboard', 'status-charts', normalize(range)] as const,
    citizenChannels: (range: DateRange = {}) => ['ccc', 'dashboard', 'citizen-channels', normalize(range)] as const,
    executive: (range: DateRange = {}) => ['ccc', 'dashboard', 'executive', normalize(range)] as const,
  },
  departments: {
    all: ['ccc', 'departments'] as const,
    list: () => ['ccc', 'departments', 'list'] as const,
    me: (userId?: string | null) => ['ccc', 'departments', 'me', userId ?? 'anonymous'] as const,
  },
  licensing: {
    all: ['ccc', 'licensing'] as const,
    modules: () => ['ccc', 'licensing', 'modules'] as const,
  },
  jobs: {
    all: ['ccc', 'jobs'] as const,
    lists: () => ['ccc', 'jobs', 'list'] as const,
    list: (scope?: JobListScope | string, departmentId?: string | null) =>
      ['ccc', 'jobs', 'list', normalize({ scope, departmentId })] as const,
    detail: (jobId?: string | null) => ['ccc', 'jobs', 'detail', jobId ?? 'none'] as const,
    auditLog: (jobId?: string | null) => ['ccc', 'jobs', 'audit-log', jobId ?? 'none'] as const,
  },
  tasks: {
    all: ['ccc', 'tasks'] as const,
    lists: () => ['ccc', 'tasks', 'list'] as const,
    list: (scope?: TaskListScope | string) => ['ccc', 'tasks', 'list', normalize({ scope })] as const,
    detail: (taskId?: string | null) => ['ccc', 'tasks', 'detail', taskId ?? 'none'] as const,
    auditLog: (taskId?: string | null) => ['ccc', 'tasks', 'audit-log', taskId ?? 'none'] as const,
  },
  users: {
    all: ['ccc', 'users'] as const,
    list: () => ['ccc', 'users', 'list'] as const,
    managementContext: () => ['ccc', 'users', 'management-context'] as const,
    search: (query: string, departmentId?: string | null) =>
      ['ccc', 'users', 'search', normalize({ query: query.trim(), departmentId })] as const,
    directorySearch: (query: string) => ['ccc', 'users', 'directory-search', query.trim()] as const,
  },
  notifications: {
    all: ['ccc', 'notifications'] as const,
    list: () => ['ccc', 'notifications', 'list'] as const,
    unreadCount: () => ['ccc', 'notifications', 'unread-count'] as const,
  },
  reports: {
    all: ['ccc', 'reports'] as const,
    sla: (range: DateRange = {}) => ['ccc', 'reports', 'sla', normalize(range)] as const,
    workload: (range: DateRange = {}) => ['ccc', 'reports', 'workload', normalize(range)] as const,
    socialTrends: (range: DateRange = {}) => ['ccc', 'reports', 'social-trends', normalize(range)] as const,
    citizenMapPins: (range: DateRange = {}) => ['ccc', 'reports', 'citizen-map-pins', normalize(range)] as const,
    departmentMapPins: (range: DateRange = {}) => ['ccc', 'reports', 'department-map-pins', normalize(range)] as const,
  },
  settings: {
    all: ['ccc', 'settings'] as const,
    tenant: (tenantId?: string | null) => ['ccc', 'settings', 'tenant', tenantId ?? 'none'] as const,
    appearance: (tenantId?: string | null) => ['ccc', 'settings', 'appearance', tenantId ?? 'none'] as const,
    ldap: (tenantId?: string | null) => ['ccc', 'settings', 'ldap', tenantId ?? 'none'] as const,
    authenticationPolicy: (tenantId?: string | null) => ['ccc', 'settings', 'authentication-policy', tenantId ?? 'none'] as const,
    workingHours: (tenantId?: string | null) => ['ccc', 'settings', 'working-hours', tenantId ?? 'none'] as const,
    sms: (tenantId?: string | null) => ['ccc', 'settings', 'sms', tenantId ?? 'none'] as const,
    fileStorage: (tenantId?: string | null) => ['ccc', 'settings', 'file-storage', tenantId ?? 'none'] as const,
    syslog: (tenantId?: string | null) => ['ccc', 'settings', 'syslog', tenantId ?? 'none'] as const,
    slaWeekend: (tenantId?: string | null) => ['ccc', 'settings', 'sla-weekend', tenantId ?? 'none'] as const,
    dueDateConstraints: () => ['ccc', 'settings', 'due-date-constraints'] as const,
    internalMessages: (tenantId?: string | null) => ['ccc', 'settings', 'internal-messages', tenantId ?? 'tenant'] as const,
    socialStatus: () => ['ccc', 'settings', 'social-status'] as const,
    routing: () => ['ccc', 'settings', 'routing'] as const,
  },
  socialMessages: {
    all: ['ccc', 'social-messages'] as const,
    list: () => ['ccc', 'social-messages', 'list'] as const,
    detail: (messageId?: string | null) => ['ccc', 'social-messages', 'detail', messageId ?? 'none'] as const,
    conversation: (messageId?: string | null) => ['ccc', 'social-messages', 'conversation', messageId ?? 'none'] as const,
  },
  conversations: {
    all: ['ccc', 'conversations'] as const,
    list: () => ['ccc', 'conversations', 'list'] as const,
    detail: (conversationId?: string | null) => ['ccc', 'conversations', 'detail', conversationId ?? 'none'] as const,
    /** Sidebar "Yanıt bekliyor" badge for WhatsApp Konuşmaları (card #6a6b685d). */
    waitingReplyCount: () => ['ccc', 'conversations', 'waiting-reply-count'] as const,
  },
  whatsappTemplates: {
    all: ['ccc', 'whatsapp-templates'] as const,
    list: () => ['ccc', 'whatsapp-templates', 'list'] as const,
  },
  userQuickReplies: {
    all: ['ccc', 'user-quick-replies'] as const,
    list: () => ['ccc', 'user-quick-replies', 'list'] as const,
  },
  citizenMessageApprovals: {
    all: ['ccc', 'citizen-message-approvals'] as const,
    list: (scope?: string) => ['ccc', 'citizen-message-approvals', 'list', scope ?? 'to-send'] as const,
    pendingCount: () => ['ccc', 'citizen-message-approvals', 'pending-count'] as const,
    /** Sms Onayı nav rozeti — Phone VT Mesaj Onayı Bekleyen (card #6a6b6824). */
    pendingSmsCount: () => ['ccc', 'citizen-message-approvals', 'pending-sms-count'] as const,
  },
  izmirCbs: {
    all: ['ccc', 'izmir-cbs'] as const,
    neighborhoods: (districtId: string) => ['ccc', 'izmir-cbs', 'neighborhoods', districtId] as const,
    streets: (neighborhoodId: string) => ['ccc', 'izmir-cbs', 'streets', neighborhoodId] as const,
    doorNumbers: (streetId: string, neighborhoodId: string) =>
      ['ccc', 'izmir-cbs', 'door-numbers', streetId, neighborhoodId] as const,
    landmarks: (districtId: string) => ['ccc', 'izmir-cbs', 'landmarks', districtId] as const,
    mapReferenceLandmarks: (districtId: string) => ['ccc', 'izmir-cbs', 'map-reference-landmarks', districtId] as const,
  },
}
