import type { TFunction } from 'i18next'

export function getRoleLabel(t: TFunction, roleCode: string): string {
  return t(`enum.role.${roleCode}`, { defaultValue: roleCode })
}

export function getTaskStatusLabel(t: TFunction, taskStatus: string): string {
  return t(`enum.taskStatus.${taskStatus}`, { defaultValue: taskStatus })
}

/** Süreç Durum: aktif + süresi geçmiş → `Yapılmakta (Son Tarihi Geçmiş)` (card #1646). */
export function formatOverdueInProgressStatus(t: TFunction): string {
  return `${t('jobs.statusLabel.inProgress', 'Yapılmakta')} (${t('jobs.statusLabel.overdue', 'Son Tarihi Geçmiş')})`
}

function isDueDateOverdue(dueDateUtc: string | null | undefined): boolean {
  return dueDateUtc != null && new Date(dueDateUtc).getTime() < Date.now()
}

// Görev durumunu, görev listesi sekmeleriyle (Bekleyen / Son Tarihi Geçmiş /
// Tamamlanmış / İptal) tutarlı tek bir etiketle gösterir. Ham enum yerine
// kullanıcının gördüğü "durum belirten butonlarla" aynı ifadeleri kullanır.
export function getTaskDisplayStatus(
  t: TFunction,
  task: { currentStatus: string; dueDateUtc: string | null },
): string {
  switch (task.currentStatus) {
    case 'Completed':
      return t('tasks.statusLabel.completed', { defaultValue: 'Tamamlanmış' })
    case 'Cancelled':
      return t('tasks.statusLabel.cancelled', { defaultValue: 'İptal' })
    case 'Rejected':
      return t('tasks.statusLabel.rejected', { defaultValue: 'Reddedildi' })
    case 'RevisionRequested':
      return t('tasks.statusLabel.revisionRequested', { defaultValue: 'Revize İstendi' })
    case 'Assigned':
    case 'InProgress':
      return isDueDateOverdue(task.dueDateUtc)
        ? formatOverdueInProgressStatus(t)
        : t('enum.taskStatus.InProgress', { defaultValue: 'Yapılmakta' })
    default:
      break
  }
  if (isDueDateOverdue(task.dueDateUtc)) {
    return formatOverdueInProgressStatus(t)
  }
  return t('tasks.statusLabel.pending', { defaultValue: 'Bekleyen' })
}

// Gridview "Durum" sütunu arka plan rengi: Tamamlanmış yeşil, İptal/Reddedildi kırmızı,
// Yapılmakta sarı, Son Tarihi Geçmiş turuncu, Bekleyen/diğer nötr (card 663). Renk eşlemesi
// getJobDisplayStatus / getTaskDisplayStatus etiket mantığıyla birebir paralel.
export type GridStatusTone = 'completed' | 'cancelled' | 'rejected' | 'inProgress' | 'overdue' | 'pending' | 'neutral'

function isOverdue(dueDateUtc: string | null | undefined): boolean {
  return dueDateUtc != null && new Date(dueDateUtc).getTime() < Date.now()
}

export function getJobStatusTone(job: { status: string; dueDateUtc: string | null }): GridStatusTone {
  if (job.status === 'Completed') return 'completed'
  if (job.status === 'Cancelled') return 'cancelled'
  if (job.status === 'Rejected') return 'rejected'
  if (job.status === 'RevisionRequested') return 'neutral'
  if (job.status === 'PendingOwnerApproval' || job.status === 'PendingExternalApproval') return 'pending'
  if (isOverdue(job.dueDateUtc)) return 'overdue'
  if (job.status === 'Active') return 'inProgress'
  return 'pending'
}

export function getTaskStatusTone(task: { currentStatus: string; dueDateUtc: string | null }): GridStatusTone {
  switch (task.currentStatus) {
    case 'Completed': return 'completed'
    case 'Cancelled': return 'cancelled'
    case 'Rejected': return 'rejected'
    case 'RevisionRequested': return 'neutral'
    case 'Assigned':
    case 'InProgress':
      return isOverdue(task.dueDateUtc) ? 'overdue' : 'inProgress'
    default: break
  }
  if (isOverdue(task.dueDateUtc)) return 'overdue'
  return 'pending'
}

export function getStatusPillClass(tone: GridStatusTone): string {
  switch (tone) {
    case 'completed': return 'bg-emerald-100 text-emerald-700 ring-emerald-200'
    case 'cancelled':
    case 'rejected': return 'bg-red-100 text-red-700 ring-red-200'
    // "Yapılmakta" chip'i mavi (card #1649); turuncu yalnız süresi geçmiş birleşik etikette.
    case 'inProgress': return 'bg-sky-100 text-sky-700 ring-sky-200'
    case 'overdue': return 'bg-orange-100 text-orange-700 ring-orange-200'
    default: return ''
  }
}

export function getPriorityLabel(t: TFunction, priority: string): string {
  return t(`enum.priority.${priority}`, { defaultValue: priority })
}

// Öncelik renkleri: Normal sarı, Yüksek turuncu, Çok Yüksek kırmızı.
export function getPriorityColorClass(priority: string): string {
  if (priority === 'VeryHigh' || priority === 'Critical') return 'text-red-600'
  if (priority === 'High') return 'text-orange-500'
  if (priority === 'Normal') return 'text-yellow-500'
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
