import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { formatOverdueInProgressStatus } from '../../utils/localization'

function isOverdueStatusLabel(t: TFunction, label: string): boolean {
  const overdueOnly = t('jobs.statusLabel.overdue', 'Geciken')
  return label === formatOverdueInProgressStatus(t) || label === overdueOnly
}

function isPendingApprovalWithOverdueSubline(t: TFunction, label: string, overdueSubline?: boolean): boolean {
  if (!overdueSubline) return false
  return label === t('jobs.statusLabel.pendingApproval', 'Onay Bekleyen')
}

function isProcessingReceivedWithOverdueSubline(t: TFunction, label: string, overdueSubline?: boolean): boolean {
  if (!overdueSubline) return false
  const processingReceived = t('social.requestStatus.processingReceived', 'İşleme Alındı')
  return label === processingReceived
}

function isFlowStatusLabel(t: TFunction, label: string, overdueSubline?: boolean): boolean {
  const processingReceived = t('social.requestStatus.processingReceived', 'İşleme Alındı')
  const inProgress = t('jobs.statusLabel.inProgress', 'Yapılmakta')
  return label === processingReceived
    || label === inProgress
    || isOverdueStatusLabel(t, label)
    || isProcessingReceivedWithOverdueSubline(t, label, overdueSubline)
}

/** Grid Durum hücresi: stacked overdue (cards #1649/#1650/#2574). İşleme Alındı önünde kanal ikonu yok. */
export function GridStatusLabel({
  t,
  label,
  channel: _channel,
  footer,
  align = 'center',
  overdueSubline,
}: {
  t: TFunction
  label: string
  /** @deprecated Durum hücresinde kanal ikonu gösterilmez (#6a6b3e39). */
  channel?: string | null
  footer?: ReactNode
  align?: 'center' | 'start'
  /** İşleme Alındı + gecikmiş VT grid: alt satır `(Geciken)` (#2819). */
  overdueSubline?: boolean
}) {
  const overdueCombined = formatOverdueInProgressStatus(t)
  const alignClass = align === 'start' ? 'items-start text-left' : 'items-center text-center'
  const flowClass = isFlowStatusLabel(t, label, overdueSubline) ? 'grid-status-label--flow-status' : ''

  if (isProcessingReceivedWithOverdueSubline(t, label, overdueSubline)) {
    const overdue = t('jobs.statusLabel.overdue', 'Geciken')
    return (
      <span className={`grid-status-label--processing-received-overdue grid-status-label--flow-status flex flex-col ${alignClass} leading-tight`}>
        <span className="whitespace-nowrap">{label}</span>
        <span className="whitespace-nowrap text-[0.68rem] font-bold">({overdue})</span>
        {footer}
      </span>
    )
  }

  if (isPendingApprovalWithOverdueSubline(t, label, overdueSubline)) {
    const overdue = t('jobs.statusLabel.overdue', 'Geciken')
    return (
      <span className={`grid-status-label--pending-approval-overdue grid-status-label--flow-status flex flex-col ${alignClass} leading-tight`}>
        <span className="whitespace-nowrap">{label}</span>
        <span className="whitespace-nowrap text-[0.68rem] font-bold">({overdue})</span>
        {footer}
      </span>
    )
  }

  if (isOverdueStatusLabel(t, label)) {
    const inProgress = t('jobs.statusLabel.inProgress', 'Yapılmakta')
    const overdue = t('jobs.statusLabel.overdue', 'Geciken')
    return (
      <span className={`grid-status-label--overdue grid-status-label--flow-status flex flex-col ${alignClass} leading-tight`}>
        <span className="whitespace-nowrap">{inProgress}</span>
        <span className="whitespace-nowrap text-[0.68rem] font-bold">({overdue})</span>
        {footer}
      </span>
    )
  }

  return (
    <span className={`inline-flex flex-col ${align === 'start' ? 'items-start' : 'items-center'} leading-tight${flowClass ? ` ${flowClass}` : ''}${footer ? '' : ''}`}>
      <span className="inline-flex items-center gap-1">
        <span>{label === overdueCombined ? overdueCombined : label}</span>
      </span>
      {footer}
    </span>
  )
}
