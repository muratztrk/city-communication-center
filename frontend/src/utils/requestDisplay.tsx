import type { TFunction } from 'i18next'
import { formatJobDisplayNumberText, type RequestNumberSource } from './requestNumberText'

export function RequestNumberWithTypeLabel({
  job,
  t,
  locale,
}: {
  job: RequestNumberSource
  t: TFunction
  locale: string
}) {
  const number = formatJobDisplayNumberText(job, locale)
  const typeLabel = job.requestType === 'InternalUnit'
    ? t('enum.jobRequestType.InternalUnit', 'Birim İçi')
    : job.requestType === 'ExternalUnit'
      ? t('enum.jobRequestType.ExternalUnit', 'Birim Dışı')
      : null

  if (!typeLabel) {
    return <span>{number}</span>
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{number}</span>
      <span className="text-xs font-semibold text-orange-500">({typeLabel})</span>
    </span>
  )
}
