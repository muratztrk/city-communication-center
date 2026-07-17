import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { ChannelIcon } from './channel-icon'
import { formatOverdueInProgressStatus } from '../../utils/localization'

/** Grid Durum hücresi: stacked overdue + opsiyonel kanal ikonu (cards #1649/#1650). */
export function GridStatusLabel({
  t,
  label,
  channel,
  footer,
}: {
  t: TFunction
  label: string
  channel?: string | null
  footer?: ReactNode
}) {
  const overdueLabel = formatOverdueInProgressStatus(t)
  const processingLabel = t('social.requestStatus.processingReceived', 'İşleme Alındı')
  const showChannel = Boolean(channel) && label === processingLabel

  if (label === overdueLabel) {
    const inProgress = t('jobs.statusLabel.inProgress', 'Yapılmakta')
    const overdue = t('jobs.statusLabel.overdue', 'Son Tarihi Geçmiş')
    return (
      <span className="flex flex-col items-center leading-tight text-center">
        <span className="inline-flex items-center gap-1">
          {showChannel ? <ChannelIcon channel={channel!} className="size-3.5 shrink-0" /> : null}
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
        {showChannel ? <ChannelIcon channel={channel!} className="size-3.5 shrink-0" /> : null}
        <span>{label}</span>
      </span>
      {footer}
    </span>
  )
}
