import type { TFunction } from 'i18next'

const CLOSED_JOB_STATUSES = new Set(['Completed', 'Cancelled', 'Rejected', 'RevisionRequested'])

/** Onay beklerken veya personel atanmadan «Plana Alındı». Atanınca normal akışa döner. */
export function isOpenPlannedJob(job: {
  plannedAtUtc?: string | null
  status: string
  taskCount?: number | null
}): boolean {
  if (!job.plannedAtUtc) return false
  if (CLOSED_JOB_STATUSES.has(job.status)) return false
  if (job.status === 'Active' && (job.taskCount ?? 0) > 0) return false
  return true
}

export function plannedStatusLabel(t: TFunction, overdue = false): string {
  const label = t('jobs.statusLabel.planned', 'Plana Alındı')
  if (!overdue) return label
  return `${label} (${t('jobs.statusLabel.overdue', 'Geciken')})`
}
