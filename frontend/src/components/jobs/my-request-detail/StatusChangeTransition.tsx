import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getTaskStatusLabel } from '../../../utils/localization'
import { formatDateTime, getStatusChangeTextClass } from './format'

interface StatusChangeTransitionProps {
  fromStatus: string
  toStatus: string
  fromAtUtc: string
  toAtUtc: string
  locale: string
}

/** Süreç altı / Görev Bilgileri "Durum Değişikliği" geçiş özeti — Tamamlanmış gibi uzun etiketler tek satıra sığar (card #1621). */
export function StatusChangeTransition({
  fromStatus,
  toStatus,
  fromAtUtc,
  toAtUtc,
  locale,
}: StatusChangeTransitionProps) {
  const { t } = useTranslation()

  return (
    <div className="task-process-status-change__transition">
      <div className="task-process-status-change__side">
        <div className={`task-process-status-change__status ${getStatusChangeTextClass(fromStatus)}`}>
          {getTaskStatusLabel(t, fromStatus)}
        </div>
        <div className="task-process-status-change__date">{formatDateTime(fromAtUtc, locale)}</div>
      </div>
      <ArrowRight className="task-process-status-change__arrow" aria-hidden="true" />
      <div className="task-process-status-change__side">
        <div className={`task-process-status-change__status ${getStatusChangeTextClass(toStatus)}`}>
          {getTaskStatusLabel(t, toStatus)}
        </div>
        <div className="task-process-status-change__date">{formatDateTime(toAtUtc, locale)}</div>
      </div>
    </div>
  )
}
