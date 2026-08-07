import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface ClearPieFilterLinkProps {
  /** Sütun başlığı filtreleri aktifse aynı konumda Filtreyi sil göster (#6a75c994). */
  hasColumnFilters?: boolean
  onClearColumnFilters?: () => void
}

/**
 * Dashboard pie (`fromPie=1`) veya grid sütun filtresi aktifken banner chip satırında
 * yanıp sönen kırmızı `Filtreyi sil` (#r546/#2096/#6a75c994).
 */
export function ClearPieFilterLink({
  hasColumnFilters = false,
  onClearColumnFilters,
}: ClearPieFilterLinkProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const fromPie = searchParams.get('fromPie') === '1'
  if (!fromPie && !hasColumnFilters) return null

  return (
    <button
      type="button"
      className="scope-chip scope-chip--clear-pie active shrink-0"
      onClick={() => {
        onClearColumnFilters?.()
        if (fromPie) navigate(location.pathname, { replace: true })
      }}
    >
      {t('common.clearPieFilter', 'Filtreyi sil')}
    </button>
  )
}
