import type { TFunction } from 'i18next'

export type JobProjectFields = {
  isProject: boolean
  isProjectCreatorRequested?: boolean
  createdByRoleCode?: string | null
}

export function isJobProjectYesLabel(job: JobProjectFields, t: TFunction): boolean {
  return formatJobProjectLabel(job, t) === t('common.yes', 'Evet')
}

export function formatJobProjectLabel(job: JobProjectFields, t: TFunction): string {
  if (job.isProjectCreatorRequested) {
    return t('common.yes', 'Evet')
  }
  return job.isProject ? t('common.yes', 'Evet') : t('common.no', 'Hayır')
}

/** Hayır ise detay popup'ta Proje mi satırı gösterilmez (#2620). */
export function shouldShowJobProjectField(job: JobProjectFields): boolean {
  return job.isProject === true || job.isProjectCreatorRequested === true
}

export function isInternalProjectJob(job: JobProjectFields & { requestType?: string | null }): boolean {
  return job.requestType === 'InternalUnit' && shouldShowJobProjectField(job)
}

/** Birim İçi + proje ise "Proje Sahibi"; aksi halde hedef birim başlığı (#2624). */
export function jobDestinationFieldLabel(
  job: JobProjectFields & { requestType?: string | null },
  t: TFunction,
  options?: { includeAssignee?: boolean; splitLayout?: boolean },
): string {
  if (isInternalProjectJob(job)) {
    return t('jobs.detail.projectOwner', 'Proje Sahibi')
  }
  if (options?.splitLayout) {
    return t('jobs.detail.targetDepartment', 'Talep Yapılan Birim')
  }
  const includeAssignee = options?.includeAssignee !== false
  return includeAssignee && job.requestType !== 'ExternalUnit'
    ? t('jobs.detail.targetDepartmentAssignee', 'Talep Yapılan Birim / Görevi Yapan')
    : t('jobs.detail.targetDepartment', 'Talep Yapılan Birim')
}
