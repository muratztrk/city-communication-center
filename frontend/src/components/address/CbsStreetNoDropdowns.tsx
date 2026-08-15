import { useTranslation } from 'react-i18next'
import { useMunicipalityDistrictId } from '../../hooks/useMunicipalityDistrictId'
import { useIzmirCbsStreetNoCatalog } from '../../hooks/useIzmirCbsStreetNoCatalog'
import { SingleSelectDropdown } from '../ui/single-select-dropdown'

interface CbsStreetNoDropdownsProps {
  neighborhood: string
  street: string
  streetNo: string
  onStreetChange: (street: string) => void
  onStreetNoChange: (streetNo: string) => void
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
  required = false,
  labelClassName = 'text-sm font-semibold text-slate-500',
  openUp = false,
  className = 'address-street-no-row grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2',
}: CbsStreetNoDropdownsProps) {
  const { t } = useTranslation()
  const districtId = useMunicipalityDistrictId()
  const hasNeighborhood = neighborhood.trim().length > 0
  const hasStreet = street.trim().length > 0
  const { streetOptions, doorNoOptions, streetsLoading, doorsLoading } = useIzmirCbsStreetNoCatalog(
    districtId,
    neighborhood,
    street,
    streetNo,
  )

  return (
    <div className={className}>
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
            hasNeighborhood
              ? t('address.streetSelectPlaceholder', 'Cadde / sokak seçiniz')
              : t('address.streetDisabledHint', 'Önce mahalle seçin')
          }
          searchPlaceholder={t('common.search', 'Ara...')}
          disabled={!hasNeighborhood || streetsLoading}
          clearable
        />
      </div>
      <div className="grid w-[7.5rem] min-w-[7.5rem] max-w-[7.5rem] shrink-0 gap-1 overflow-hidden">
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
          placeholder={
            hasStreet
              ? t('address.streetNoSelectPlaceholder', 'No seçiniz')
              : t('address.streetNoDisabledHint', 'Önce cadde / sokak seçin')
          }
          searchPlaceholder={t('common.search', 'Ara...')}
          disabled={!hasStreet || doorsLoading}
          clearable
          className="min-w-0 overflow-hidden"
        />
      </div>
    </div>
  )
}
