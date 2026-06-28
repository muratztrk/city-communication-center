import type { TFunction } from 'i18next'

type ExternalUnitStatusSource = {
  requestType?: string | null
  status: string
  taskCount?: number
  tasks?: unknown[] | null
}

function externalTaskCount(job: ExternalUnitStatusSource): number {
  return job.taskCount ?? job.tasks?.length ?? 0
}

export function isExternalUnitJob(job: { requestType?: string | null }): boolean {
  return job.requestType === 'ExternalUnit'
}

export function getExternalUnitOwnerDisplayStatus(
  t: TFunction,
  job: ExternalUnitStatusSource,
): string | null {
  if (!isExternalUnitJob(job)) return null
  const taskCount = externalTaskCount(job)
  if ((job.status === 'Active' || job.status === 'PendingExternalApproval') && taskCount === 0) {
    return t('social.requestStatus.processingReceived', 'İşleme Alındı')
  }
  return null
}

export function getExternalUnitTargetDisplayStatus(
  t: TFunction,
  job: ExternalUnitStatusSource,
): string | null {
  if (!isExternalUnitJob(job)) return null
  const taskCount = externalTaskCount(job)
  if (job.status === 'PendingExternalApproval' || (job.status === 'Active' && taskCount === 0)) {
    return t('jobs.statusLabel.pendingApproval', 'Onay Bekleyen')
  }
  return null
}
