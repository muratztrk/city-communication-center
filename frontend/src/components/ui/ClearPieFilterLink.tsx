import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/** Dashboard pie navigasyonu `fromPie=1` ile geldiyse banner chip satırında gösterilir (#r546). */
export function ClearPieFilterLink() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  if (searchParams.get('fromPie') !== '1') return null

  return (
    <button
      type="button"
      className="scope-chip-clear-pie shrink-0 rounded-md bg-red-600 px-2.5 py-1 text-sm font-semibold text-white transition-colors hover:bg-red-700"
      onClick={() => navigate(location.pathname, { replace: true })}
    >
      {t('common.clearPieFilter', 'Filtreyi sil')}
    </button>
  )
}
