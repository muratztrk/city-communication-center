import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/** Dashboard pie navigasyonu `fromPie=1` ile geldiyse banner chip satırında gösterilir (#r546/#r550/#2096). */
export function ClearPieFilterLink() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  if (searchParams.get('fromPie') !== '1') return null

  return (
    <button
      type="button"
      className="scope-chip scope-chip--clear-pie active shrink-0"
      onClick={() => navigate(location.pathname, { replace: true })}
    >
      {t('common.clearPieFilter', 'Filtreyi sil')}
    </button>
  )
}
