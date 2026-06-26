export function isCitizenRequestJob(job: { requestType?: string | null; sourceType?: string | null }): boolean {
  return job.requestType === 'Citizen'
    || job.sourceType === 'SocialMessage'
    || job.sourceType === 'CitizenRequest'
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
