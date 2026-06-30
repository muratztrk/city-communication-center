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
