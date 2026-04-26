export interface DashboardSnapshot {
  openTaskCount: number;
  pendingApprovalCount: number;
  activeSocialMessageCount: number;
  rejectedOrCancelledRequestCount: number;
  unassignedItemCount: number;
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

export interface Department {
  departmentId: string;
  tenantId: string;
  name: string;
  departmentType: string;
  parentDepartmentId: string | null;
  managerUserId: string | null;
}

export interface User {
  userId: string;
  tenantId: string;
  departmentId: string;
  username: string | null;
  displayName: string;
  email: string | null;
  roleCode: string;
  isActive: boolean;
  userSource: string;
  title: string | null;
  phone: string | null;
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

export type TaskListScope = 'all' | 'mine' | 'department-pool' | 'pending-approval';

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

export type JobStatus =
  | 'Draft'
  | 'PendingOwnerApproval'
  | 'PendingExternalApproval'
  | 'Active'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled';

export type JobRequestType = 'InternalUnit' | 'ExternalUnit' | 'Citizen';
export type JobDepartmentRole = 'Owner' | 'Target' | 'Support' | 'Coordinating';
export type JobApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'NotRequired';

export type JobListScope =
  | 'all'
  | 'mine'
  | 'my-department'
  | 'active'
  | 'department-pool'
  | 'pending-approval'
  | 'rejected';

export interface JobSummary {
  jobId: string;
  tenantId: string;
  title: string;
  status: JobStatus;
  priority: string;
  requestType: JobRequestType;
  isProject: boolean;
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
}

export interface JobDepartmentInfo {
  jobDepartmentId: string;
  departmentId: string;
  departmentName: string | null;
  role: JobDepartmentRole;
  approvalStatus: JobApprovalStatus;
  requestedByUserId: string | null;
  approvedByUserId: string | null;
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
  createdByDisplayName: string | null;
  createdAtUtc: string;
  departments: JobDepartmentInfo[];
  tasks: Task[];
  approvals: JobApprovalStep[];
}

export interface SocialMessage {
  socialMessageId: string;
  channel: string;
  citizenHandle: string;
  category: string | null;
  status: string;
  assignedDepartmentId: string | null;
  jobId: string | null;
  receivedAtUtc: string;
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

export interface AuthUser {
  userId: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  tenantId: string;
  tenantName: string;
  departmentId: string;
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
