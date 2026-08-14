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
