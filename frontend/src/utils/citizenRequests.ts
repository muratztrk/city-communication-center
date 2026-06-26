export function isCitizenRequestJob(job: { requestType?: string | null; sourceType?: string | null }): boolean {
  return job.requestType === 'Citizen'
    || job.sourceType === 'SocialMessage'
    || job.sourceType === 'CitizenRequest'
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
