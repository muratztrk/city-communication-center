import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMunicipalityDistrictId } from '../../hooks/useMunicipalityDistrictId'
import { useIzmirCbsStreetNoCatalog } from '../../hooks/useIzmirCbsStreetNoCatalog'
import { SingleSelectDropdown } from '../ui/single-select-dropdown'

const MOBILE_MAX_WIDTH_MQ = '(max-width: 767px)'

interface CbsStreetNoDropdownsProps {
  neighborhood: string
  street: string
  streetNo: string
  onStreetChange: (street: string) => void
  onStreetNoChange: (streetNo: string) => void
  /** No’nun sağında isteğe bağlı koordinat kutusu (#2713). */
  coordinates?: string
  onCoordinatesChange?: (value: string) => void
  required?: boolean
  labelClassName?: string
  openUp?: boolean
  className?: string
}

/** Cadde/Sokak + No: İzmir CBS kademeli dropdown (#2655). */
export function CbsStreetNoDropdowns({
  neighborhood,
  street,
  streetNo,
  onStreetChange,
  onStreetNoChange,
  coordinates,
  onCoordinatesChange,
  required = false,
  labelClassName = 'text-sm font-semibold text-slate-500',
  openUp = false,
  className,
}: CbsStreetNoDropdownsProps) {
  const showCoordinates = typeof onCoordinatesChange === 'function'
  const rowClassName = showCoordinates
    ? 'address-street-no-row grid min-w-0 grid-cols-[minmax(0,1fr)_8.25rem_minmax(8.75rem,11rem)] gap-2'
    : (className ?? 'address-street-no-row grid grid-cols-[minmax(0,1fr)_8.25rem] gap-2')
  const { t } = useTranslation()
  const [isMobile, setIsMobile] = useState(false)
  const districtId = useMunicipalityDistrictId()
  const hasNeighborhood = neighborhood.trim().length > 0
  const hasStreet = street.trim().length > 0
  const { streetOptions, doorNoOptions, streetsLoading, doorsLoading } = useIzmirCbsStreetNoCatalog(
    districtId,
    neighborhood,
    street,
    streetNo,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(MOBILE_MAX_WIDTH_MQ)
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return (
    <div className={rowClassName}>
      <div className="grid min-w-0 gap-1">
        <span className={labelClassName}>
          {t('address.streetLabel', 'Cadde / Sokak')}
          {required && hasNeighborhood ? <span className="text-red-500"> *</span> : null}
        </span>
        <SingleSelectDropdown
          searchable
          openUp={openUp}
          options={streetOptions}
          value={street}
          onChange={nextStreet => {
            onStreetChange(nextStreet)
            onStreetNoChange('')
          }}
          placeholder={
            isMobile
              ? t('address.streetSelectPlaceholderMobile', 'Cadde seçiniz')
              : t('address.streetSelectPlaceholder', 'Cadde / sokak seçiniz')
          }
          searchPlaceholder={t('common.search', 'Ara...')}
          disabled={!hasNeighborhood || streetsLoading}
          clearable
        />
      </div>
      <div className="grid w-[8.25rem] min-w-[8.25rem] max-w-[8.25rem] shrink-0 gap-1 overflow-hidden">
        <span className={labelClassName}>
          {t('address.streetNoLabel', 'No')}
          {required && hasNeighborhood ? <span className="text-red-500"> *</span> : null}
        </span>
        <SingleSelectDropdown
          searchable
          openUp={openUp}
          options={doorNoOptions}
          value={streetNo}
          onChange={onStreetNoChange}
          placeholder={t('address.streetNoSelectPlaceholder', 'No seçiniz')}
          searchPlaceholder={t('common.search', 'Ara...')}
          disabled={!hasStreet || doorsLoading}
          clearable
          className="min-w-0 overflow-hidden"
        />
      </div>
      {showCoordinates ? (
        <div className="grid min-w-0 gap-1">
          <span className={labelClassName}>{t('address.coordinatesLabel', 'Konum Koordinatı')}</span>
          <input
            type="text"
            inputMode="decimal"
            className="field-input min-w-0"
            placeholder={t('address.coordinatesPlaceholder', 'ör. 38.08, 27.73')}
            value={coordinates ?? ''}
            onChange={event => onCoordinatesChange?.(event.target.value)}
          />
        </div>
      ) : null}
    </div>
  )
}
