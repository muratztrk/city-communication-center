import type { TFunction } from 'i18next'

export function isCitizenRequestJob(job: { requestType?: string | null; sourceType?: string | null }): boolean {
  return job.requestType === 'Citizen'
    || job.sourceType === 'SocialMessage'
    || job.sourceType === 'CitizenRequest'
    || job.sourceType === 'EDevlet'
}

type CitizenRequestStatusSource = {
  status: string
  dueDateUtc?: string | null
  taskCount?: number
  tasks?: unknown[]
}

export function getCitizenRequestStatusLabel(
  t: TFunction,
  job: CitizenRequestStatusSource,
): string {
  if (job.status === 'Completed') return t('jobs.statusLabel.completed', 'Tamamlanmış')
  if (job.status === 'Cancelled') return t('jobs.statusLabel.cancelled', 'İptal')
  if (job.status === 'Rejected') return t('jobs.statusLabel.rejected', 'Reddedildi')
  if (job.status === 'RevisionRequested') return t('jobs.statusLabel.returned', 'İade Edildi')
  if (job.dueDateUtc != null && new Date(job.dueDateUtc).getTime() < Date.now()) {
    return t('jobs.statusLabel.overdue', 'Son Tarihi Geçmiş')
  }

  const taskCount = job.taskCount ?? job.tasks?.length ?? 0
  if (job.status === 'Active' && taskCount > 0) {
    return t('jobs.statusLabel.inProgress', 'Yapılmakta')
  }

  return t('social.requestStatus.processingReceived', 'İşleme Alındı')
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
  taskCount?: number
  tasks?: { taskId?: string }[]
  departments?: { role: string; approvalStatus?: string | null; decidedAtUtc?: string | null }[]
}): boolean {
  // "Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi" vatandaş ve birim dışı taleplerde
  // gerçek hedef onayından sonra görünür. Yönetici tarafından oluşturulan birim içi aktif taleplerde
  // bekleyen gri adım olarak da gösterilir (card #1345).
  if (job.requestType === 'InternalUnit' && job.createdByRoleCode === 'Manager') {
    return true
  }
  if (!isCitizenRequestJob(job) && job.requestType !== 'ExternalUnit') {
    return false
  }
  const target = job.departments?.find(department => department.role === 'Target')
  if (target?.approvalStatus !== 'Approved' || !target.decidedAtUtc) {
    return false
  }
  const taskCount = job.taskCount ?? job.tasks?.length ?? 0
  return taskCount > 0
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
  social?: { socialMessageId?: string | null; citizenPhone?: string | null; citizenHandle?: string | null; whatsAppPhone?: string | null } | null,
): boolean {
  if (!isCitizenRequestJob(job)) return false
  if (job.sourceType === 'SocialMessage' && job.sourceRefId) return true
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
