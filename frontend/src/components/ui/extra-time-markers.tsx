import { useTranslation } from 'react-i18next'

interface GridExtraTimeMarkersProps {
  hasPending?: boolean
  lastDecision?: string | null
}

// Grid tarih/durum hücresi altında ek süre talebi işaretleri: bekleyen amber "(Ek süre talebi)",
// onaylanan yeşil, reddedilen kırmızı. Görev ve talep gridlerinde aynı görünüm kullanılır
// (cards 628/772/#1385/#1388).
export function GridExtraTimeMarkers({ hasPending, lastDecision }: GridExtraTimeMarkersProps) {
  const { t } = useTranslation()
  if (!hasPending && !lastDecision) return null
  return (
    <>
      {hasPending && (
        <div className="mt-1 text-xs font-bold text-amber-500">
          {t('tasks.actions.extraTimePendingMarker', '(Ek süre talebi)')}
        </div>
      )}
      {lastDecision === 'Approved' && (
        <div className="mt-1 text-xs font-bold text-emerald-600">
          {t('tasks.actions.extraTimeApproved', 'Ek süre talebi onaylandı')}
        </div>
      )}
      {lastDecision === 'Rejected' && (
        <div className="mt-1 text-xs font-bold text-red-600">
          {t('tasks.actions.extraTimeRejected', 'Ek süre talebi reddedildi')}
        </div>
      )}
    </>
  )
}
