import type { TFunction } from 'i18next'
import { formatJobProjectLabel, shouldHighlightProjectYes, type JobProjectFields } from './jobProjectLabel'

export function JobProjectValue({
  job,
  t,
}: {
  job: JobProjectFields
  t: TFunction
}) {
  if (shouldHighlightProjectYes(job)) {
    return <span className="font-semibold text-orange-500">{t('common.yes', 'Evet')}</span>
  }
  return formatJobProjectLabel(job, t)
}
