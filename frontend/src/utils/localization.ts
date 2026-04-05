import type { TFunction } from 'i18next'

export function getRoleLabel(t: TFunction, roleCode: string): string {
  return t(`enum.role.${roleCode}`, { defaultValue: roleCode })
}

export function getTaskTypeLabel(t: TFunction, taskType: string): string {
  return t(`enum.taskType.${taskType}`, { defaultValue: taskType })
}

export function getTaskStatusLabel(t: TFunction, taskStatus: string): string {
  return t(`enum.taskStatus.${taskStatus}`, { defaultValue: taskStatus })
}

export function getPriorityLabel(t: TFunction, priority: string): string {
  return t(`enum.priority.${priority}`, { defaultValue: priority })
}

export function getSocialStatusLabel(t: TFunction, status: string): string {
  return t(`enum.socialStatus.${status}`, { defaultValue: status })
}

export function getSocialChannelLabel(t: TFunction, channel: string): string {
  return t(`enum.socialChannel.${channel}`, { defaultValue: channel })
}

export function getDepartmentTypeLabel(t: TFunction, departmentType: string): string {
  return t(`enum.departmentType.${departmentType}`, { defaultValue: departmentType })
}

export function getAuditActionLabel(t: TFunction, action: string): string {
  return t(`enum.auditAction.${action}`, { defaultValue: action })
}

export function getDeploymentModeLabel(t: TFunction, deploymentMode: string): string {
  return t(`enum.deploymentMode.${deploymentMode}`, { defaultValue: deploymentMode })
}

export function getUserSourceLabel(t: TFunction, userSource: string): string {
  return t(`enum.userSource.${userSource}`, { defaultValue: userSource })
}

export function getLocale(language: string): string {
  return language.startsWith('en') ? 'en-US' : 'tr-TR'
}