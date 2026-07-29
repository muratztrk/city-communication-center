import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/** Dashboard pie navigasyonu `fromPie=1` ile geldiyse banner chip satırında gösterilir (#r546/#r550). */
export function ClearPieFilterLink() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  if (searchParams.get('fromPie') !== '1') return null

  return (
    <button
      type="button"
      className="scope-chip-clear-pie shrink-0 text-base font-semibold text-red-600 transition-colors hover:text-red-700 hover:underline"
      onClick={() => navigate(location.pathname, { replace: true })}
    >
      {t('common.clearPieFilter', 'Filtreyi sil')}
    </button>
  )
}
