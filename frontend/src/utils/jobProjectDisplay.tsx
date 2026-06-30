import type { TFunction } from 'i18next'

type JobProjectFields = {
  isProject: boolean
  isProjectCreatorRequested?: boolean
}

export function formatJobProjectLabel(job: JobProjectFields, t: TFunction): string {
  if (job.isProjectCreatorRequested) {
    return t('common.yes', 'Evet')
  }
  return job.isProject ? t('common.yes', 'Evet') : t('common.no', 'Hayır')
}

export function JobProjectValue({
  job,
  t,
}: {
  job: JobProjectFields
  t: TFunction
}) {
  if (job.isProjectCreatorRequested) {
    return <span className="font-semibold text-orange-500">{t('common.yes', 'Evet')}</span>
  }
  return job.isProject ? t('common.yes', 'Evet') : t('common.no', 'Hayır')
}
