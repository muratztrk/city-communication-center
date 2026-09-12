import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMunicipalityDistrictId } from '../../hooks/useMunicipalityDistrictId'
import { useIzmirCbsStreetNoCatalog } from '../../hooks/useIzmirCbsStreetNoCatalog'
import { SingleSelectDropdown } from '../ui/single-select-dropdown'

interface AddressCoordinatesFieldProps {
  value: string
  onChange: (value: string) => void
  labelClassName?: string
}

/** Konum Koordinatı: taşan metin ellipsis + 500ms hover tooltip (#2725/#2763). */
export function AddressCoordinatesField({
  value,
  onChange,
  labelClassName = 'text-sm font-semibold text-slate-500',
}: AddressCoordinatesFieldProps) {
  const { t } = useTranslation()
  const [showTip, setShowTip] = useState(false)
  const tipTimerRef = useRef<number>(0)
  const trimmed = value.trim()

  useEffect(() => () => window.clearTimeout(tipTimerRef.current), [])

  return (
    <div className="relative grid min-w-0 gap-1">
      <span className={labelClassName}>{t('address.coordinatesLabel', 'Konum Linki')}</span>
      <input
        type="text"
        inputMode="url"
        className="field-input min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] placeholder:text-[14px]"
        placeholder={t('address.coordinatesPlaceholder', 'Link giriniz...')}
        value={value}
        onChange={event => onChange(event.target.value)}
        onMouseEnter={() => {
          window.clearTimeout(tipTimerRef.current)
          if (!trimmed) return
          tipTimerRef.current = window.setTimeout(() => setShowTip(true), 500)
        }}
        onMouseLeave={() => {
          window.clearTimeout(tipTimerRef.current)
          setShowTip(false)
        }}
      />
      {trimmed && showTip ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-[calc(100%+0.2rem)] z-[80] max-w-[min(24rem,70vw)] break-all rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white shadow-lg"
        >
          {trimmed}
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
  /** Cadde menüsünü sağa (No tarafına) ekstra px genişlet (#2640). */
  streetMenuWidthExtraPx?: number
  /** Cadde açık menü genişliği (ör. Mahalle tetikleyici, #3545). */
  streetMenuWidth?: number
  /** No açık menüyü tetikleyiciden ekstra px genişlet (#3545/#3554). */
  streetNoMenuWidthExtraPx?: number
  streetNoMenuExpand?: 'left' | 'right'
  streetPlaceholder?: string
  streetNoPlaceholder?: string
  triggerClassName?: string
  streetNoColumnClassName?: string
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
  streetMenuWidthExtraPx = 0,
  streetMenuWidth,
  streetNoMenuWidthExtraPx = 0,
  streetNoMenuExpand = 'right',
  streetPlaceholder,
  streetNoPlaceholder,
  triggerClassName,
  streetNoColumnClassName = 'lg:w-[8.25rem] lg:min-w-[8.25rem] lg:max-w-[8.25rem]',
}: CbsStreetNoDropdownsProps) {
  const showCoordinates = typeof onCoordinatesChange === 'function'
  const rowClassName = showCoordinates
    ? 'address-street-no-row address-street-no-row--with-link grid min-w-0 grid-cols-[minmax(0,1.15fr)_6.5rem] gap-2 md:grid-cols-[minmax(0,1.15fr)_6.5rem_minmax(8.75rem,11rem)]'
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
        <span className={`${labelClassName} whitespace-nowrap`}>
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
          matchTriggerWidth={matchTriggerWidth && !streetMenuWidth}
          menuWidth={streetMenuWidth}
          menuWidthExtraPx={streetMenuWidth ? 0 : streetMenuWidthExtraPx}
        />
      </div>
      <div className={`grid min-w-0 w-full max-w-full gap-1 overflow-hidden max-lg:shrink max-lg:basis-full lg:shrink-0 ${streetNoColumnClassName}`}>
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
          menuWidthExtraPx={streetNoMenuWidthExtraPx}
          menuExpand={streetNoMenuExpand}
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
