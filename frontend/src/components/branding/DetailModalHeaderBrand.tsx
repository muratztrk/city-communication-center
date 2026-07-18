import { useAuth } from '../../context/AuthContext'
import { useTenantTheme } from '../../context/ThemeContext'
import { MunicipalitySeal } from './MunicipalitySeal'

/** Detay popup başlık satırı ortası — sol menü logosu, küçültülmüş (card #1683). */
export function DetailModalHeaderBrand() {
  const { user } = useAuth()
  const { appearance } = useTenantTheme()
  const institutionName = user?.tenantName || 'Tire Belediyesi'
  const logoUrl = appearance.logoUrl?.trim() || null

  return (
    <div className="detail-modal-header-brand" aria-hidden="true">
      <MunicipalitySeal
        bare
        alt={`${institutionName} logo`}
        src={logoUrl}
        className="detail-modal-header-brand__img"
      />
    </div>
  )
}
