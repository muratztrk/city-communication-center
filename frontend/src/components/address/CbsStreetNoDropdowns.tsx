import { useTranslation } from 'react-i18next'
import { useMunicipalityDistrictId } from '../../hooks/useMunicipalityDistrictId'
import { useIzmirCbsStreetNoCatalog } from '../../hooks/useIzmirCbsStreetNoCatalog'
import { SingleSelectDropdown } from '../ui/single-select-dropdown'

interface AddressCoordinatesFieldProps {
  value: string
  onChange: (value: string) => void
  labelClassName?: string
}

/** Konum Koordinatı: taşan metin ellipsis + hover tooltip (#2725). */
export function AddressCoordinatesField({
  value,
  onChange,
  labelClassName = 'text-sm font-semibold text-slate-500',
}: AddressCoordinatesFieldProps) {
  const { t } = useTranslation()
  return (
    <div className="group relative grid min-w-0 gap-1">
      <span className={labelClassName}>{t('address.coordinatesLabel', 'Konum Koordinatı')}</span>
      <input
        type="text"
        inputMode="url"
        className="field-input min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12px]"
        placeholder={t('address.coordinatesPlaceholder', 'Link giriniz...')}
        value={value}
        title={value.trim() || undefined}
        onChange={event => onChange(event.target.value)}
      />
      {value.trim() ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-[calc(100%+0.2rem)] z-[80] hidden max-w-[min(24rem,70vw)] break-all rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white shadow-lg group-hover:block"
        >
          {value.trim()}
        </span>
      ) : null}
    </div>
  )
}

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
  /** Cadde/No menü satır punto (ör. WA mahalle menüsü ile aynı). */
  menuScrollClassName?: string
  /** Açılan panel kök sınıfı (arama kutusu punto vb.). */
  menuClassName?: string
  /** Panel tetikleyici ile aynı genişlik ve sol hiza (#2640). */
  matchTriggerWidth?: boolean
  streetPlaceholder?: string
  streetNoPlaceholder?: string
  triggerClassName?: string
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
  menuScrollClassName,
  menuClassName,
  matchTriggerWidth = false,
  streetPlaceholder,
  streetNoPlaceholder,
  triggerClassName,
}: CbsStreetNoDropdownsProps) {
  const showCoordinates = typeof onCoordinatesChange === 'function'
  const rowClassName = showCoordinates
    ? 'address-street-no-row grid min-w-0 grid-cols-[minmax(0,1fr)_8.25rem_minmax(8.75rem,11rem)] gap-2'
    : (className ?? 'address-street-no-row grid grid-cols-[minmax(0,1fr)_8.25rem] gap-2')
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
          placeholder={streetPlaceholder ?? t('address.streetSelectPlaceholder', 'Cadde seçiniz')}
          searchPlaceholder={t('common.search', 'Ara...')}
          disabled={!hasNeighborhood || streetsLoading}
          clearable
          triggerClassName={triggerClassName}
          menuScrollClassName={menuScrollClassName}
          menuClassName={menuClassName}
          matchTriggerWidth={matchTriggerWidth}
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
          placeholder={streetNoPlaceholder ?? t('address.streetNoSelectPlaceholder', 'No seçiniz')}
          searchPlaceholder={t('common.search', 'Ara...')}
          disabled={!hasStreet || doorsLoading}
          clearable
          className="min-w-0 overflow-hidden"
          triggerClassName={triggerClassName}
          menuScrollClassName={menuScrollClassName}
          menuClassName={menuClassName}
          matchTriggerWidth={matchTriggerWidth}
        />
      </div>
      {showCoordinates ? (
        <AddressCoordinatesField
          value={coordinates ?? ''}
          onChange={value => onCoordinatesChange?.(value)}
          labelClassName={labelClassName}
        />
      ) : null}
    </div>
  )
}
