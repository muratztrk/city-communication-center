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
  alreadyLinked: boolean;
  existingUserId: string | null;
}

export interface UserManagementContext {
  localUsersEnabled: boolean;
  ldapEnabled: boolean;
}

export interface Task {
  taskId: string;
  tenantId: string;
  title: string;
  description?: string;
  taskType: string;
  sourceType?: string;
  priority: string;
  currentStatus: string;
  targetDepartmentId: string | null;
  assignedDepartmentId: string | null;
  assignedUserId: string | null;
  dueDateUtc: string | null;
}

export interface SocialMessage {
  socialMessageId: string;
  channel: string;
  citizenHandle: string;
  category: string | null;
  status: string;
  assignedDepartmentId: string | null;
  taskId: string | null;
  receivedAtUtc: string;
}

export interface Dashboard {
  openTaskCount: number;
  pendingApprovalCount: number;
  activeSocialMessageCount: number;
  failedNotificationCount: number;
}

export interface Notification {
  notificationId: string;
  taskId: string | null;
  userId: string;
  channel: string;
  deliveryStatus: string;
  message: string;
  sentAtUtc: string | null;
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

export interface TenantLoginContext {
  tenants: TenantLookup[];
  resolvedTenant: TenantLookup | null;
  hideTenantSelector: boolean;
  requireTenantSelection: boolean;
  resolutionMode: string;
  host: string | null;
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

export interface TenantLdapSettings {
  enabled: boolean;
  autoProvisionUsers: boolean;
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
