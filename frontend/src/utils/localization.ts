import type { TFunction } from 'i18next'

export function getRoleLabel(t: TFunction, roleCode: string): string {
  return t(`enum.role.${roleCode}`, { defaultValue: roleCode })
}

export function getTaskStatusLabel(t: TFunction, taskStatus: string): string {
  return t(`enum.taskStatus.${taskStatus}`, { defaultValue: taskStatus })
}

export function getPriorityLabel(t: TFunction, priority: string): string {
  return t(`enum.priority.${priority}`, { defaultValue: priority })
}

// Öncelik renkleri: Normal sarı, Yüksek turuncu, Çok Yüksek kırmızı.
export function getPriorityColorClass(priority: string): string {
  if (priority === 'VeryHigh' || priority === 'Critical') return 'text-red-600'
  if (priority === 'High') return 'text-orange-500'
  if (priority === 'Normal') return 'bg-yellow-400 text-white rounded px-1'
  return 'text-slate-400'
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

export function getAuditStatusLabel(t: TFunction, status: string): string {
  return t(`enum.jobStatus.${status}`, {
    defaultValue: t(`enum.taskStatus.${status}`, { defaultValue: status }),
  })
}

function getAuditNoteKeyLabel(t: TFunction, key: string): string {
  return t(`enum.auditLog.noteKeys.${key}`, { defaultValue: key })
}

function formatAuditNoteValue(t: TFunction, key: string, value: string): string {
  if (key === 'Status') return getAuditStatusLabel(t, value)
  return value
}

export function formatAuditNotes(t: TFunction, notes: string): string {
  const trimmedNotes = notes.trim()
  if (!trimmedNotes) return trimmedNotes

  const parts = trimmedNotes.split(/,\s*/)
  const keyValueParts = parts
    .map(part => part.match(/^([A-Za-z][A-Za-z0-9]*)=(.*)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))

  if (keyValueParts.length === parts.length) {
    return keyValueParts
      .map(match => {
        const [, key, rawValue] = match
        return `${getAuditNoteKeyLabel(t, key)}: ${formatAuditNoteValue(t, key, rawValue)}`
      })
      .join(', ')
  }

  if (trimmedNotes.startsWith('Assigned to: ')) {
    return `${t('enum.auditLog.notePhrases.assignedTo', { defaultValue: 'Atanan' })}: ${trimmedNotes.slice('Assigned to: '.length)}`
  }

  if (trimmedNotes.startsWith('Assigned to user ')) {
    return `${t('enum.auditLog.notePhrases.assignedToUser', { defaultValue: 'Atanan kullanıcı' })}: ${trimmedNotes.slice('Assigned to user '.length)}`
  }

  if (trimmedNotes === 'Unassigned (pool)') {
    return t('enum.auditLog.notePhrases.unassignedPool', { defaultValue: 'Atanmamış (havuz)' })
  }

  if (trimmedNotes.startsWith('Title updated: ')) {
    return `${t('enum.auditLog.notePhrases.titleUpdated', { defaultValue: 'Başlık güncellendi' })}: ${trimmedNotes.slice('Title updated: '.length)}`
  }

  const deletedJobMatch = trimmedNotes.match(/^Job '(.+)' deleted\.$/)
  if (deletedJobMatch) {
    return t('enum.auditLog.notePhrases.jobDeleted', {
      title: deletedJobMatch[1],
      defaultValue: `'${deletedJobMatch[1]}' talebi silindi.`,
    })
  }

  return trimmedNotes
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
