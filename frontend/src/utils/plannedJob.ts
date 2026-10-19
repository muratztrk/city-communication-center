import type { TFunction } from 'i18next'

const CLOSED_JOB_STATUSES = new Set(['Completed', 'Cancelled', 'Rejected', 'RevisionRequested'])

/** Onay beklerken veya personel atanmadan «Plana Alındı». Atanınca normal akışa döner. */
export function isOpenPlannedJob(job: {
  plannedAtUtc?: string | null
  status: string
  taskCount?: number | null
  tasks?: readonly unknown[] | null
}): boolean {
  if (!job.plannedAtUtc) return false
  if (CLOSED_JOB_STATUSES.has(job.status)) return false
  const taskCount = job.taskCount ?? job.tasks?.length ?? 0
  if (job.status === 'Active' && taskCount > 0) return false
  return true
}

export function plannedStatusLabel(t: TFunction, overdue = false): string {
  const label = t('jobs.statusLabel.planned', 'Plana Alındı')
  if (!overdue) return label
  return `${label} (${t('jobs.statusLabel.overdue', 'Geciken')})`
}

/** Açık plana alınmış talebin Durum değeri. Plana alan adı parantez içinde (#6ad5a516). */
export function formatOpenPlannedStatusLabel(
  t: TFunction,
  job: {
    plannedAtUtc?: string | null
    status: string
    taskCount?: number | null
    plannedByDisplayName?: string | null
  },
  overdue = false,
): string | null {
  if (!isOpenPlannedJob(job)) return null
  const label = plannedStatusLabel(t, overdue)
  const name = job.plannedByDisplayName?.trim()
  return name ? `${label} (${name})` : label
}
