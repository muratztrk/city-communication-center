import type { TFunction } from 'i18next'
import { formatJobProjectLabel, type JobProjectFields } from './jobProjectLabel'

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
  return formatJobProjectLabel(job, t)
}
