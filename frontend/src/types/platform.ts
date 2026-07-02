export interface DashboardSnapshot {
  openTaskCount: number;
  pendingApprovalCount: number;
  activeSocialMessageCount: number;
  rejectedOrCancelledRequestCount: number;
  unassignedItemCount: number;
  // Manager-specific metrics
  myPendingRequestCount: number;
  outgoingPendingCount: number;
  outgoingInProgressCount: number;
  myPendingTaskCount: number;
  deptPendingTaskCount: number;
  myTotalRequestCount: number;
  incomingTotalCount: number;
  outgoingTotalCount: number;
  deptTotalTaskCount: number;
}

export interface DashboardChartSlice {
  label: string;
  value: number;
  colorHint: string;
}

export interface DashboardChartResponse {
  titleKey: string;
  slices: DashboardChartSlice[];
}

export interface DashboardStatusChartsResponse {
  charts: DashboardChartResponse[];
}

export interface Department {
  departmentId: string;
  tenantId: string;
  name: string;
  departmentType: string;
  parentDepartmentId: string | null;
  managerUserId: string | null;
  responsibleUserIds: string[];
}

export interface User {
  userId: string;
  tenantId: string;
  departmentId: string;
  username: string | null;
  displayName: string;
  email: string | null;
  roleCode: string;
  additionalRoleCodes?: string[] | null;
  isActive: boolean;
  userSource: string;
  title: string | null;
  phone: string | null;
  departments?: DepartmentSummary[] | null;
}

export interface UserLookup {
  userId: string;
  departmentId: string;
  departmentName: string;
  displayName: string;
  email: string | null;
  roleCode: string;
  isActive: boolean;
  userSource: string;
}

export interface DirectoryUserLookup {
  externalIdentityId: string;
  username: string;
  displayName: string;
  email: string | null;
  department: string | null;
  alreadyLinked: boolean;
  existingUserId: string | null;
  title: string | null;
  phone: string | null;
}

export interface UserManagementContext {
  localUsersEnabled: boolean;
  ldapEnabled: boolean;
}

export type TaskListScope = 'all' | 'mine' | 'department' | 'department-pool' | 'pending-approval';

export type TaskCurrentStatus =
  | 'Waiting'
  | 'Assigned'
  | 'InProgress'
  | 'PendingCloseApproval'
  | 'Completed'
  | 'Cancelled'
  | 'Rejected'
  | 'RevisionRequested';

export interface Task {
  taskId: string;
  tenantId: string;
  jobId: string;
  jobTitle: string | null;
  jobRequestType: JobRequestType | null;
  jobSourceType: string | null;
  jobNumber?: number | null;
  jobNumberYear?: number | null;
  title: string;
  description?: string;
  priority: string;
  currentStatus: TaskCurrentStatus;
  assignedDepartmentId: string | null;
  assignedDepartmentName?: string | null;
  assignedUserId: string | null;
  assignedUserDisplayName?: string | null;
  dueDateUtc: string | null;
  startDateUtc?: string | null;
  completedAtUtc?: string | null;
  completionPercentage?: number | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  notes?: string | null;
  revisionReason?: string | null;
  createdByDisplayName?: string | null;
  createdAtUtc?: string;
  ownerDisplayName?: string | null;
  attachments?: Attachment[];
  taskNumber?: number | null;
  taskNumberYear?: number | null;
  ownerDepartmentName?: string | null;
  updatedAtUtc?: string | null;
  createdByRoleCode?: string | null;
  ownerUserId?: string | null;
  assignedAtUtc?: string | null;
  // Bağlı talebin oluşturulma tarihi — "Talep Tarihi" sütunu için (card 629).
  jobCreatedAtUtc?: string | null;
  // Yöneticide bekleyen ek süre talebi var mı — gridview "(Ek süre talebi)" işareti (card 628).
  hasPendingExtraTimeRequest?: boolean;
  // Sonuçlanan en güncel ek süre talebi; Son Tarih altında gösterilir (card 772).
  lastExtraTimeRequestDecision?: 'Approved' | 'Rejected' | null;
  // Görevi atayan yöneticinin adı — talep detayı "Görev Detayları"nda "Atanmış (Yönetici)" (card #709).
  assigningManagerDisplayName?: string | null;
}

export interface TaskDetail {
  taskId: string;
  tenantId: string;
  jobId: string;
  jobTitle: string | null;
  jobRequestType: JobRequestType | null;
  jobSourceType: string | null;
  title: string;
  description: string;
  priority: string;
  currentStatus: TaskCurrentStatus;
  assignedDepartmentId: string | null;
  assignedUserId: string | null;
  startDateUtc: string | null;
  dueDateUtc: string | null;
  completedAtUtc: string | null;
  completionPercentage: number | null;
  estimatedHours: number | null;
  actualHours: number | null;
  notes: string | null;
  revisionReason: string | null;
  createdByDisplayName: string | null;
  createdAtUtc: string;
  approvals: JobApprovalStep[];
  assignmentHistory: AssignmentHistory[];
  ownerDisplayName: string | null;
  attachments: Attachment[];
  assigningManagerDisplayName: string | null;
  assignedDepartmentName: string | null;
  assignedUserDisplayName: string | null;
  taskNumber: number | null;
  taskNumberYear: number | null;
  // Durumu belirleyen son işlemi yapan kullanıcı (iptal eden / tamamlayan) (card 642).
  statusActorDisplayName?: string | null;
  // "Durum Değiştir" ile yapılan durum değişikliklerinin geçmişi (card #2).
  statusChangeHistory?: TaskStatusChangeHistory[] | null;
}

export interface TaskStatusChangeHistory {
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  actorDisplayName: string | null;
  changedAtUtc: string;
}

export interface AssignmentHistory {
  assignmentId: string;
  fromDepartmentId: string | null;
  toDepartmentId: string | null;
  fromUserId: string | null;
  toUserId: string | null;
  actionType: string;
  actionDateUtc: string;
}

export interface Attachment {
  attachmentId: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  url: string;
  uploadedAtUtc: string;
}

export type JobStatus =
  | 'Draft'
  | 'PendingOwnerApproval'
  | 'PendingExternalApproval'
  | 'Active'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled'
  | 'RevisionRequested';

export type JobRequestType = 'InternalUnit' | 'ExternalUnit' | 'Citizen';
export type JobDepartmentRole = 'Owner' | 'Target' | 'Coordinating';
export type JobApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'NotRequired';

export type JobListScope =
  | 'all'
  | 'mine'
  | 'my-department'
  | 'active'
  | 'department-pool'
  | 'pending-approval'
  | 'outgoing-department'
  | 'rejected';

export interface UpdateJobRequest {
  title: string;
  description: string;
  priority: string;
  startDateUtc: string | null;
  dueDateUtc: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isProject?: boolean | null;
  neighborhood?: string | null;
  street?: string | null;
  openAddress?: string | null;
  targetDepartmentIds?: string[] | null;
  citizenName?: string | null;
  citizenPhone?: string | null;
}

export interface JobSummary {
  jobId: string;
  tenantId: string;
  title: string;
  status: JobStatus;
  priority: string;
  requestType: JobRequestType;
  isProject: boolean;
  isProjectCreatorRequested?: boolean;
  isProjectOwnerConfirmed?: boolean;
  citizenName: string | null;
  citizenPhone: string | null;
  ownerDepartmentId: string;
  ownerDepartmentName: string | null;
  startDateUtc: string | null;
  dueDateUtc: string | null;
  completedAtUtc: string | null;
  completionPercentage: number | null;
  isCoordinated: boolean;
  sourceType: string;
  taskCount: number;
  departments: JobDepartmentInfo[];
  createdAtUtc: string;
  jobNumber: number | null;
  jobNumberYear: number | null;
  createdByDisplayName: string | null;
  updatedAtUtc?: string | null;
  assignedUserDisplayName?: string | null;
  createdByRoleCode?: string | null;
  // Vatandaş talebi VT numarası (linkli sosyal mesajdan) — gridde VT- gösterimi (card #1077).
  citizenRequestNumber?: number | null;
  citizenRequestNumberYear?: number | null;
}

export interface JobDepartmentInfo {
  jobDepartmentId: string;
  departmentId: string;
  departmentName: string | null;
  role: JobDepartmentRole;
  approvalStatus: JobApprovalStatus;
  requestedByUserId: string | null;
  approvedByUserId: string | null;
  approvedByDisplayName: string | null;
  requestedAtUtc: string | null;
  decidedAtUtc: string | null;
  rejectReason: string | null;
  notes: string | null;
}

export interface JobApprovalStep {
  approvalId: string;
  subjectType: string;
  subjectId: string;
  approverUserId: string;
  stepOrder: number;
  decision: string;
  decisionDateUtc: string | null;
  comment: string | null;
}

export interface JobDetail {
  jobId: string;
  tenantId: string;
  title: string;
  description: string;
  status: JobStatus;
  priority: string;
  requestType: JobRequestType;
  isProject: boolean;
  isProjectCreatorRequested?: boolean;
  isProjectOwnerConfirmed?: boolean;
  citizenName: string | null;
  citizenPhone: string | null;
  ownerDepartmentId: string;
  ownerDepartmentName: string | null;
  startDateUtc: string | null;
  dueDateUtc: string | null;
  completedAtUtc: string | null;
  completionPercentage: number | null;
  isCoordinated: boolean;
  sourceType: string;
  sourceRefId: string | null;
  cancelReason: string | null;
  latitude?: number | null;
  longitude?: number | null;
  neighborhood?: string | null;
  street?: string | null;
  openAddress?: string | null;
  createdByDisplayName: string | null;
  createdByRoleCode?: string | null;
  createdAtUtc: string;
  jobNumber: number | null;
  jobNumberYear: number | null;
  managerNote?: string | null;
  departments: JobDepartmentInfo[];
  tasks: Task[];
  approvals: JobApprovalStep[];
  attachments: Attachment[];
  // Durumu belirleyen kullanıcı (iptal/tamamlayan/onay bekleyen yönetici) + tamamlama notu (card 643).
  statusActorDisplayName?: string | null;
  completionNote?: string | null;
  // Talebin son güncellenme zamanı — "Talep Detayları"nda iptal tarihi olarak kullanılır (card #715).
  updatedAtUtc?: string | null;
}

export interface SocialConversationEntry {
  entryId: string;
  direction: 'Inbound' | 'Outbound';
  content: string;
  mediaId: string | null;
  mediaMimeType: string | null;
  sentAt: string;
  senderLabel?: string | null;
  deliveryStatus?: 'Pending' | 'Sent' | 'Delivered' | 'Read' | 'Failed' | null;
  deliveryError?: string | null;
  editedAtUtc?: string | null;
}

export interface SocialMessage {
  socialMessageId: string;
  channel: string;
  citizenHandle: string;
  citizenName?: string | null;
  citizenPhone?: string | null;
  content: string | null;
  category: string | null;
  status: string;
  assignedDepartmentId: string | null;
  assignedDepartmentName: string | null;
  jobId: string | null;
  citizenRequestNumber: number | null;
  citizenRequestNumberYear: number | null;
  receivedAtUtc: string;
  updatedAtUtc: string | null;
  dueDateUtc?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CitizenConversationSummary {
  citizenConversationId: string;
  citizenPhone: string;
  citizenName: string | null;
  lastMessageAt: string;
  unreadCount: number;
  isBlocked: boolean;
  lastMessagePreview: string | null;
  openTicketCount: number;
  lastMessageDirection?: 'Inbound' | 'Outbound' | null;
  latestCitizenRequestNumber?: number | null;
  latestCitizenRequestNumberYear?: number | null;
  latestTicketPriority?: string | null;
  latestTicketStatus?: string | null;
  assigneeDisplayName?: string | null;
}

export interface CitizenConversationTimelineEntry {
  entryId: string;
  direction: 'Inbound' | 'Outbound';
  content: string;
  mediaId: string | null;
  mediaMimeType: string | null;
  sentAt: string;
  socialMessageId: string;
  senderLabel?: string | null;
  deliveryStatus?: 'Pending' | 'Sent' | 'Delivered' | 'Read' | 'Failed' | null;
  deliveryError?: string | null;
  editedAtUtc?: string | null;
}

export interface CitizenConversationTicket {
  socialMessageId: string;
  status: string;
  receivedAtUtc: string;
  jobId: string | null;
  category: string | null;
  citizenRequestNumber?: number | null;
  citizenRequestNumberYear?: number | null;
  priority?: string | null;
  jobNumber?: number | null;
  jobNumberYear?: number | null;
}

export interface CitizenConversationDetail {
  citizenConversationId: string;
  citizenPhone: string;
  citizenName: string | null;
  lastMessageAt: string;
  unreadCount: number;
  isBlocked: boolean;
  lastInboundAt: string | null;
  timeline: CitizenConversationTimelineEntry[];
  tickets: CitizenConversationTicket[];
}

export interface WhatsAppMessageTemplate {
  templateId: string;
  name: string;
  content: string;
  isActive: boolean;
  channel: string;
  isGeneral: boolean;
  autoReply: boolean;
  replyDelaySecs: number;
  hasKeyword: boolean;
  queryType: string;
  keywords: string[];
  timedReplyEnabled: boolean;
  timedReplyStartDate: string;
  timedReplyEndDate: string;
  timedReplyStartTime: string;
  timedReplyEndTime: string;
  timedReplyWeekendAllHours: boolean;
  activeDays: string[];
}

export interface UserQuickReplyTemplate {
  templateId: string;
  name: string;
  content: string;
}

export interface AuditLog {
  auditLogId: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: string | null;
  eventTimeUtc: string;
  details: string | null;
}

export interface EntityAuditLogEntry {
  auditLogId: string;
  action: string;
  actorDisplayName: string;
  departmentName: string | null;
  statusAtEvent: string | null;
  notes: string | null;
  eventTimeUtc: string;
}

export interface TenantLookup {
  tenantId: string;
  municipalityName: string;
  displayName: string;
  deploymentMode: string;
  domain: string | null;
}

export interface TenantAppearance {
  themePreset: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  neutralColor: string;
  surfaceColor: string;
  backgroundColor: string;
  headerGradientFrom: string;
  headerGradientTo: string;
  sidebarBackgroundColor: string;
  sidebarForegroundColor: string;
  logoUrl?: string | null;
  loginBackgroundImageUrl?: string | null;
  isCustomized: boolean;
}

export type TenantAppearanceInput = Omit<TenantAppearance, 'isCustomized'>;

export interface TenantLoginContext {
  tenants: TenantLookup[];
  resolvedTenant: TenantLookup | null;
  hideTenantSelector: boolean;
  requireTenantSelection: boolean;
  resolutionMode: string;
  host: string | null;
  appearance: TenantAppearance | null;
}

export interface TenantLdapSettings {
  enabled: boolean;
  host: string | null;
  port: number;
  useSsl: boolean;
  ignoreCertificateErrors: boolean;
  domain: string | null;
  searchBase: string | null;
  bindDn: string | null;
  hasBindPassword: boolean;
  userAttribute: string;
  canAuthenticate: boolean;
  canSearch: boolean;
}

export interface TenantAuthenticationPolicy {
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
  canAttemptAutomaticSignIn: boolean;
  canIssueSecondFactor: boolean;
}

export interface InteractiveAuthenticationGrant {
  username: string;
  password: string;
}

export interface StartInteractiveAuthenticationResult {
  status: string;
  isTrustedNetwork: boolean;
  secondFactorRequiredOnSuccess: boolean;
  automaticSignInMode: string | null;
  authenticationMode: string | null;
  challengeId: string | null;
  deliveryDestination: string | null;
  message: string | null;
  expiresAtUtc: string | null;
  grant: InteractiveAuthenticationGrant | null;
  mockCodePreview: string | null;
  challengeWithNegotiate: boolean;
}

export interface VerifyInteractiveAuthenticationResult {
  status: string;
  authenticationMode: string | null;
  message: string | null;
  expiresAtUtc: string | null;
  grant: InteractiveAuthenticationGrant | null;
  mockCodePreview: string | null;
}

export interface DepartmentSummary {
  departmentId: string;
  name: string;
  departmentType: string;
  isPrimary: boolean;
}

export interface AuthUser {
  userId: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  additionalRoles?: string[];
  tenantId: string;
  tenantName: string;
  departmentId: string;
  departmentName?: string;
  userSource?: string;
}

export interface AuthSession {
  accessToken: string | null;
  expiresAt: number | null;
  user: AuthUser;
}

export interface TenantSettings {
  tenantId: string;
  municipalityName: string;
  displayName: string;
  deploymentMode: string;
  isActive: boolean;
  theme: string | null;
  domain: string | null;
  defaultSlaHours: number;
  rolePageAccessJson: string | null;
}

export interface SocialChannelStatus {
  configured: boolean;
  hasPrimaryCredential: boolean;
  hasSecondaryCredential: boolean;
}

export interface SocialSettingsStatus {
  x: SocialChannelStatus;
  facebook: SocialChannelStatus;
  instagram: SocialChannelStatus;
  whatsApp: SocialChannelStatus;
  eDevlet: SocialChannelStatus;
  email: SocialChannelStatus;
  whatsAppPublic?: {
    businessAccountId?: string | null;
    phoneNumberId?: string | null;
    webhookVerifyToken?: string | null;
  } | null;
}

export interface SocialSettingsSaveResult {
  message: string;
  configured: boolean;
}

export interface SocialConnectionTestResult {
  channel: string;
  connected: boolean;
  message: string;
}

export interface RoutingRule {
  ruleId: string;
  ruleName: string;
  keywords: string;
  targetDepartmentId: string;
  targetDepartmentName: string;
  priority: number;
  isActive: boolean;
}

export interface RoutingConfig {
  autoRoutingEnabled: boolean;
  rules: RoutingRule[];
}

export interface RoutingTestResult {
  targetDepartmentId: string | null;
  targetDepartmentName: string | null;
}

export interface CitizenAutoReplyTemplates {
  processingReceived: string;
  inProgress: string;
  completed: string;
}

export interface WorkingHoursDaySchedule { day: number; from: string | null; to: string | null }
export interface WorkingHoursDepartmentOverride { departmentId: string; departmentName: string | null; isAlwaysOpen: boolean; schedule: WorkingHoursDaySchedule[] }
export interface WorkingHoursSchedule { isAlwaysOpen: boolean; schedule: WorkingHoursDaySchedule[] }
export interface WorkingHoursSettings { default: WorkingHoursSchedule; departmentOverrides: WorkingHoursDepartmentOverride[] }

export type SmsProvider = 'NetGSM' | 'Iletimerkezi' | 'Verimor' | 'Custom';

export interface SmsSettings {
  isEnabled: boolean;
  provider: SmsProvider;
  apiUrl: string | null;
  username: string | null;
  hasPassword: boolean;
  originator: string | null;
}

export interface SmsSettingsUpdate {
  isEnabled: boolean;
  provider: SmsProvider;
  apiUrl: string | null;
  username: string | null;
  password: string | null;
  clearPassword: boolean;
  originator: string | null;
}


export type SyslogFormat = 'Syslog' | 'CEF'
export type SyslogTransport = 'UDP' | 'TCP'

export interface SyslogSettings {
  isEnabled: boolean
  host: string | null
  port: number
  format: SyslogFormat
  transport: SyslogTransport
}

export interface SyslogSettingsUpdate {
  isEnabled: boolean
  host: string | null
  port: number
  format: SyslogFormat
  transport: SyslogTransport
}

export interface FileStorageSettings {
  nasHost: string | null;
  nasShareName: string | null;
  nasProtocol: 'SMB/CIFS' | 'NFS';
  nasUsername: string | null;
  nasHasPassword: boolean;
  ftpHost: string | null;
  ftpPort: number;
  ftpPath: string | null;
  ftpProtocol: 'FTP' | 'FTPS' | 'SFTP';
  ftpUsername: string | null;
  ftpHasPassword: boolean;
}

export interface FileStorageSettingsUpdate {
  nasHost: string | null;
  nasShareName: string | null;
  nasProtocol: 'SMB/CIFS' | 'NFS';
  nasUsername: string | null;
  nasPassword: string | null;
  clearNasPassword: boolean;
  ftpHost: string | null;
  ftpPort: number;
  ftpPath: string | null;
  ftpProtocol: 'FTP' | 'FTPS' | 'SFTP';
  ftpUsername: string | null;
  ftpPassword: string | null;
  clearFtpPassword: boolean;
}

export interface SlaWeekendSettings {
  excludeWeekends: boolean
  exemptDepartmentIds: string[]
}

export interface SlaWeekendSettingsUpdate {
  excludeWeekends: boolean
  exemptDepartmentIds: string[]
}

export interface EDevletBasvuruSummary {
  basvuruId: string
  takipNo: string
  citizenFirstName: string
  citizenLastName: string
  basvuruTipi: string
  description: string
  mahalleAdi: string | null
  sokakCaddeAdi: string | null
  status: string
  createdAtUtc: string
  jobId: string | null
  jobDisplayNumber: string | null
}

export interface AppNotification {
  notificationId: string
  taskId: string | null
  userId: string | null
  channel: string
  deliveryStatus: string
  title: string
  message: string
  isRead: boolean
  actionUrl: string | null
  sentAtUtc: string | null
  // AuditLog'dan türetilen akış satırı: tek tek okunamaz, "Hepsini okundu yap" ile temizlenir (card 634).
  isHistorical?: boolean
  // Talebi Reporter oluşturmuşsa turuncu birim adı; Operator'ın vatandaş talebiyse turuncu "Vatandaş Talebi" etiketi (cards #1072/#1078/#1087).
  titleTag?: string | null
}
