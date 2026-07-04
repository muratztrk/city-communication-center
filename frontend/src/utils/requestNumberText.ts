export type RequestNumberSource = {
  jobNumber?: number | null
  jobNumberYear?: number | null
  requestType?: string | null
}

export function formatJobDisplayNumberText(job: RequestNumberSource, locale: string): string {
  if (job.jobNumber != null && job.jobNumberYear != null) {
    return `T-${job.jobNumberYear}-${job.jobNumber}`
  }
  const year = job.jobNumberYear ?? new Date().getFullYear()
  return locale.startsWith('tr') ? `T-${year}-Onay Bekleyen` : `T-${year}-Pending Approval`
}
