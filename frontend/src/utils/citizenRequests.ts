import type { TFunction } from 'i18next'
import { isJobDueDateOverdue } from './dateTimePicker'
import { formatOverdueInProgressStatus, type GridStatusTone } from './localization'

export function isCitizenRequestJob(job: { requestType?: string | null; sourceType?: string | null }): boolean {
  return job.requestType === 'Citizen'
    || job.sourceType === 'SocialMessage'
    || job.sourceType === 'CitizenRequest'
    || job.sourceType === 'EDevlet'
}

export function hasCitizenAddress(fields: {
  neighborhood?: string | null
  street?: string | null
  streetNo?: string | null
  openAddress?: string | null
}): boolean {
  return [fields.neighborhood, fields.street, fields.streetNo, fields.openAddress].some(value => Boolean(value?.trim()))
}

/** Vatandaş talebinde konum/oluşturan başlığı (#2627). */
export function requestLocationFieldLabel(
  job: { requestType?: string | null; sourceType?: string | null },
  t: TFunction,
): string {
  return isCitizenRequestJob(job)
    ? t('jobs.detail.requestRouter', 'Talebi Yönlendiren')
    : t('jobs.detail.requestLocationCreator', 'Talep Yeri / Oluşturan')
}

const TERMINAL_TASK_STATUSES = new Set(['Completed', 'Cancelled', 'Rejected'])

/** Açık (terminal olmayan) görev sayısı — Mesaj Onayı reopen sonrası İşleme Alındı için. */
export function countOpenWorkTasks(job: {
  taskCount?: number
  tasks?: { currentStatus?: string }[] | null
}): number {
  if (job.tasks) {
    return job.tasks.filter(task => !TERMINAL_TASK_STATUSES.has(task.currentStatus ?? '')).length
  }
  return job.taskCount ?? 0
}

type CitizenRequestStatusSource = {
  status: string
  dueDateUtc?: string | null
  taskCount?: number
  tasks?: { currentStatus?: string }[]
}

/** Vatandaş talebi henüz onaylanmadı / açık görev yok — gecikse bile İşleme Alındı (#2805). */
export function isCitizenProcessingReceivedState(job: CitizenRequestStatusSource): boolean {
  if (job.status === 'Completed'
    || job.status === 'Cancelled'
    || job.status === 'Rejected'
    || job.status === 'RevisionRequested') {
    return false
  }
  const openTasks = countOpenWorkTasks(job)
  if (job.status === 'PendingExternalApproval') return true
  if (job.status === 'Active' && openTasks === 0) return true
  return false
}

/** Grid Durum: İşleme Alındı + gecikmiş → alt satır `(Geciken)` (#2819). */
export function isCitizenProcessingReceivedOverdue(job: CitizenRequestStatusSource): boolean {
  return isCitizenProcessingReceivedState(job)
    && isJobDueDateOverdue({ status: job.status, dueDateUtc: job.dueDateUtc })
}

export function getCitizenRequestStatusLabel(
  t: TFunction,
  job: CitizenRequestStatusSource,
): string {
  if (job.status === 'Completed') return t('jobs.statusLabel.completed', 'Tamamlanmış')
  if (job.status === 'Cancelled') return t('jobs.statusLabel.cancelled', 'İptal')
  if (job.status === 'Rejected') return t('jobs.statusLabel.rejected', 'Reddedildi')
  if (job.status === 'RevisionRequested') return t('jobs.statusLabel.returned', 'İade Edildi')
  if (isCitizenProcessingReceivedState(job)) {
    return t('social.requestStatus.processingReceived', 'İşleme Alındı')
  }
  if (isJobDueDateOverdue({ status: job.status, dueDateUtc: job.dueDateUtc })) {
    return formatOverdueInProgressStatus(t)
  }

  const taskCount = countOpenWorkTasks(job)
  if (job.status === 'Active' && taskCount > 0) {
    return t('jobs.statusLabel.inProgress', 'Yapılmakta')
  }

  return t('social.requestStatus.processingReceived', 'İşleme Alındı')
}

/** Detay popup: İşleme Alındı + gecikmiş → `İşleme Alındı (Geciken)`; grid/liste `getCitizenRequestStatusLabel` kalır (#2800). */
export function getCitizenRequestDetailStatusLabel(
  t: TFunction,
  job: CitizenRequestStatusSource,
): string {
  if (isCitizenProcessingReceivedState(job)
    && isJobDueDateOverdue({ status: job.status, dueDateUtc: job.dueDateUtc })) {
    return `${t('social.requestStatus.processingReceived', 'İşleme Alındı')} (${t('jobs.statusLabel.overdue', 'Geciken')})`
  }
  return getCitizenRequestStatusLabel(t, job)
}

export function getCitizenRequestStatusTone(job: CitizenRequestStatusSource): GridStatusTone {
  if (job.status === 'Completed') return 'completed'
  if (job.status === 'Cancelled') return 'cancelled'
  if (job.status === 'Rejected') return 'rejected'
  if (job.status === 'RevisionRequested') return 'neutral'
  if (isCitizenProcessingReceivedState(job)) return 'processingReceived'
  if (isJobDueDateOverdue({ status: job.status, dueDateUtc: job.dueDateUtc })) return 'overdue'
  if (job.status === 'Active' && countOpenWorkTasks(job) > 0) return 'inProgress'
  return 'processingReceived'
}

export function formatCitizenRequestNumber(
  message: {
    citizenRequestNumber?: number | null
    citizenRequestNumberYear?: number | null
    receivedAtUtc?: string | null
    createdAtUtc?: string | null
  },
  locale: string,
): string {
  const fallbackDate = message.receivedAtUtc ?? message.createdAtUtc
  const year = message.citizenRequestNumberYear
    ?? (fallbackDate ? new Date(fallbackDate).getFullYear() : new Date().getFullYear())
  if (message.citizenRequestNumber != null) {
    return `VT-${year}-${message.citizenRequestNumber}`
  }
  return locale.startsWith('tr') ? `VT-${year}-Onay Bekleyen` : `VT-${year}-Pending Approval`
}

export function formatCitizenPhoneDisplay(value: string | null | undefined): string {
  if (!value) return '—'
  const digits = value.replace(/\D/g, '')
  const localDigits = digits.length === 12 && digits.startsWith('90')
    ? digits.slice(2)
    : digits.length === 11 && digits.startsWith('0')
      ? digits.slice(1)
      : digits
  if (localDigits.length === 10) {
    return `${localDigits.slice(0, 3)} ${localDigits.slice(3, 6)} ${localDigits.slice(6, 8)} ${localDigits.slice(8)}`
  }
  return value
}

export function shouldShowCitizenTargetApprovalDate(job: {
  requestType?: string | null
  sourceType?: string | null
  createdByRoleCode?: string | null
  status?: string | null
  completedAtUtc?: string | null
  cancelReason?: string | null
  taskCount?: number
  tasks?: { taskId?: string }[]
  departments?: { role: string; approvalStatus?: string | null; decidedAtUtc?: string | null }[]
}): boolean {
  // "Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi" vatandaş ve birim dışı taleplerde
  // görünür; birim içi taleplerde hiç gösterilmez (card #1357).
  if (job.requestType === 'InternalUnit') {
    return false
  }
  if (!isCitizenRequestJob(job) && job.requestType !== 'ExternalUnit') {
    return false
  }
  // Yönetici tarafından oluşturulan birim dışı taleplerde adım onay öncesinde de gri
  // "Onay Bekleyen" olarak durur; hedef yönetici onaylayınca yeşile döner (card #1345).
  if (!isCitizenRequestJob(job) && job.createdByRoleCode === 'Manager') {
    return true
  }
  const target = job.departments?.find(department => department.role === 'Target')
  if (target?.approvalStatus !== 'Approved' || !target.decidedAtUtc) {
    return false
  }
  const taskCount = job.taskCount ?? job.tasks?.length ?? 0
  if (taskCount > 0) return true
  // Mesaj Onayı "Talep Durumunu Değiştir" sonrası Active + (completedAtUtc|cancelReason):
  // görev henüz yok/atanmamış olsa da gerçek hedef onayı timeline + Talep Bilgileri'nde kalsın
  // (card #6a6aecbc / Round 579). Otomatik damga + hiç görev yokken yanlış onaycı gösterme
  // riski yalnızca bu reopen kapsamıyla sınırlı.
  if (!isCitizenRequestJob(job) || job.status !== 'Active') return false
  return Boolean(job.completedAtUtc) || Boolean(job.cancelReason?.trim())
}

export function resolveCitizenWhatsAppPhone(
  job: { citizenPhone?: string | null },
  social?: {
    citizenPhone?: string | null
    citizenHandle?: string | null
    whatsAppPhone?: string | null
  } | null,
): string | null {
  for (const candidate of [job.citizenPhone, social?.citizenPhone, social?.whatsAppPhone, social?.citizenHandle]) {
    const digits = (candidate ?? '').replace(/\D/g, '')
    if (digits.length === 10) return digits
    if (digits.length === 12 && digits.startsWith('90')) return digits.slice(2)
    if (digits.length >= 10) return digits.slice(-10)
  }
  return null
}

export function canShowCitizenWhatsAppConversation(
  job: {
    requestType?: string | null
    sourceType?: string | null
    sourceRefId?: string | null
    citizenPhone?: string | null
  },
  social?: {
    socialMessageId?: string | null
    citizenPhone?: string | null
    citizenHandle?: string | null
    whatsAppPhone?: string | null
    channel?: string | null
  } | null,
): boolean {
  if (!isCitizenRequestJob(job)) return false

  const hasSocialSource = job.sourceType === 'SocialMessage' && Boolean(job.sourceRefId)
  // Flash önleme: SocialMessage kaynağında kanal yüklenmeden Yazışmaya Git gösterme (#2101/#2107).
  if (hasSocialSource && !social?.channel) return false

  const channel = (social?.channel ?? '').toLocaleLowerCase('tr')
  if (channel === 'phone' || channel === 'call' || channel === 'çağrı' || channel === 'cagri') {
    return false
  }
  if (hasSocialSource) return true
  if (social?.socialMessageId) return true
  return resolveCitizenWhatsAppPhone(job, social) != null
}

export function buildWhatsAppConversationUrl(job: {
  sourceType?: string | null
  sourceRefId?: string | null
  citizenPhone?: string | null
  createdAtUtc?: string | null
}, social?: {
  citizenPhone?: string | null
  citizenHandle?: string | null
  whatsAppPhone?: string | null
  socialMessageId?: string | null
} | null): string | null {
  if (!isCitizenRequestJob(job)) return null

  const localDigits = resolveCitizenWhatsAppPhone(job, social)
  const phone = localDigits
    ? (localDigits.length === 10 ? `90${localDigits}` : localDigits)
    : null
  if (!phone) return null

  const params = new URLSearchParams({ phone })
  if (job.sourceType === 'SocialMessage' && job.sourceRefId) {
    params.set('messageId', job.sourceRefId)
  }
  if (job.createdAtUtc) {
    params.set('at', job.createdAtUtc)
  }
  return `/whatsapp?${params.toString()}`
}

export function buildCitizenRequestUrl(options: {
  socialMessageId: string
  editJobId?: string | null
  returnTo?: 'whatsapp' | 'social'
}): string {
  const params = new URLSearchParams({
    kind: 'citizen',
    socialMessageId: options.socialMessageId,
  })
  if (options.editJobId) params.set('editJobId', options.editJobId)
  if (options.returnTo) params.set('returnTo', options.returnTo)
  return `/requests/new?${params.toString()}`
}
