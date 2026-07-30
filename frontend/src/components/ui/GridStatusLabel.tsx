import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { formatOverdueInProgressStatus } from '../../utils/localization'

/** Grid Durum hücresi: stacked overdue (cards #1649/#1650). İşleme Alındı önünde kanal ikonu yok (#6a6b3e39). */
export function GridStatusLabel({
  t,
  label,
  channel: _channel,
  footer,
}: {
  t: TFunction
  label: string
  /** @deprecated Durum hücresinde kanal ikonu gösterilmez (#6a6b3e39). */
  channel?: string | null
  footer?: ReactNode
}) {
  const overdueLabel = formatOverdueInProgressStatus(t)

  if (label === overdueLabel) {
    const inProgress = t('jobs.statusLabel.inProgress', 'Yapılmakta')
    const overdue = t('jobs.statusLabel.overdue', 'Son Tarihi Geçmiş')
    return (
      <span className="flex flex-col items-center leading-tight text-center">
        <span className="inline-flex items-center gap-1">
          <span>{inProgress}</span>
        </span>
        <span className="text-[0.68rem] font-bold">({overdue})</span>
        {footer}
      </span>
    )
  }

  return (
    <span className={`inline-flex flex-col items-center leading-tight${footer ? '' : ''}`}>
      <span className="inline-flex items-center gap-1">
        <span>{label}</span>
      </span>
      {footer}
    </span>
  )
}
