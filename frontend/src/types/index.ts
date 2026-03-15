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
  displayName: string;
  email: string | null;
  roleCode: string;
  isActive: boolean;
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
  assignedDepartmentId?: string | null;
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
