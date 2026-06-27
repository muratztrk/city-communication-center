export function isCitizenRequestJob(job: { requestType?: string | null; sourceType?: string | null }): boolean {
  return job.requestType === 'Citizen'
    || job.sourceType === 'SocialMessage'
    || job.sourceType === 'CitizenRequest'
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
  departments?: { role: string; approvalStatus?: string | null; decidedAtUtc?: string | null }[]
}): boolean {
  if (!isCitizenRequestJob(job)) {
    return job.requestType === 'ExternalUnit'
  }
  const target = job.departments?.find(department => department.role === 'Target')
  return target?.approvalStatus === 'Approved' && Boolean(target.decidedAtUtc)
}

export function buildWhatsAppConversationUrl(job: {
  sourceType?: string | null
  sourceRefId?: string | null
  citizenPhone?: string | null
  createdAtUtc?: string | null
}): string | null {
  if (!isCitizenRequestJob(job)) return null

  const digits = (job.citizenPhone ?? '').replace(/\D/g, '')
  const phone = digits.length === 10
    ? `90${digits}`
    : digits.length >= 10
      ? digits
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
