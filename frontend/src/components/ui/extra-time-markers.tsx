import { useTranslation } from 'react-i18next'

interface GridExtraTimeMarkersProps {
  hasPending?: boolean
  lastDecision?: string | null
  inline?: boolean
  // Görev gridlerinde (Birimdeki Görevler/Personelimin Görevleri/Görevlerim) bekleyen işaret
  // "Yeni" rozetiyle aynı yanıp sönme efektini alır (card #1404, 3. reopen).
  blink?: boolean
}

// Grid tarih/durum hücresi altında ek süre talebi işaretleri: bekleyen amber "(Ek süre talebi)",
// onaylanan yeşil, reddedilen kırmızı. Görev ve talep gridlerinde aynı görünüm kullanılır
// (cards 628/772/#1385/#1388).
export function GridExtraTimeMarkers({ hasPending, lastDecision, inline = false, blink = false }: GridExtraTimeMarkersProps) {
  const { t } = useTranslation()
  if (!hasPending && !lastDecision) return null
  const Marker = inline ? 'span' : 'div'
  const markerClassName = inline ? 'text-xs font-bold' : 'mt-1 text-xs font-bold'
  return (
    <>
      {hasPending && (
        <Marker className={`${markerClassName} text-amber-500${blink ? ' extra-time-pending-blink' : ''}`}>
          {t('tasks.actions.extraTimePendingMarker', '(Ek süre talebi)')}
        </Marker>
      )}
      {lastDecision === 'Approved' && (
        <Marker className={`${markerClassName} text-emerald-600`}>
          {t('tasks.actions.extraTimeApproved', 'Ek süre talebi onaylandı')}
        </Marker>
      )}
      {lastDecision === 'Rejected' && (
        <Marker className={`${markerClassName} text-red-600`}>
          {t('tasks.actions.extraTimeRejected', 'Ek süre talebi reddedildi')}
        </Marker>
      )}
    </>
  )
}
