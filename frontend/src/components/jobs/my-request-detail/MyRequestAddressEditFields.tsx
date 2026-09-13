import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getNeighborhoodsForDistrict } from '../../../data/izmir-locations'
import { useMunicipalityDistrictId } from '../../../hooks/useMunicipalityDistrictId'
import { AddressCoordinatesField, CbsStreetNoDropdowns } from '../../address/CbsStreetNoDropdowns'
import { SingleSelectDropdown } from '../../ui/single-select-dropdown'
import { stringListSelectOptions } from '../../../utils/formDropdownOptions'
import { ADDRESS_OPEN_ADDRESS_MAX_LENGTH } from '../../../utils/addressLimits'
import { normalizeTitleCaseField } from '../../../utils/textNormalization'
import type { MyRequestEditDraft } from './myRequestEditDraft'

interface MyRequestAddressEditFieldsProps {
  draft: MyRequestEditDraft
  onChange: (patch: Partial<MyRequestEditDraft>) => void
  /** Operatör + Vatandaş Talepleri: Adres Tarifi alt satır, dar menü, küçük placeholder (#3588). */
  operatorSocialLayout?: boolean
}

// Değer kutu genişliğini aşınca alt satıra taşacak kadar satır aç (cards #1359/#1360).
function autoGrowRows(value: string): number {
  return Math.min(4, Math.max(1, Math.ceil((value.length || 1) / 24)))
}

export function MyRequestAddressEditFields({ draft, onChange, operatorSocialLayout = false }: MyRequestAddressEditFieldsProps) {
  const { t } = useTranslation()
  const districtId = useMunicipalityDistrictId()
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(districtId), [districtId])
  const neighborhoodOptions = useMemo(() => stringListSelectOptions(neighborhoods), [neighborhoods])
  const hasNeighborhood = draft.neighborhood.trim().length > 0
  const menuClassName = operatorSocialLayout
    ? 'my-request-edit-neighborhood-menu my-request-edit-neighborhood-menu--compact'
    : 'min-w-full w-max max-w-[20rem] my-request-edit-neighborhood-menu'

  const neighborhoodField = (
    <label className="grid min-w-0 gap-1">
      <span className="text-xs font-semibold text-slate-500">
        {t('address.neighborhoodLabel', 'Mahalle')}
        {hasNeighborhood ? <span className="text-red-500"> *</span> : null}
      </span>
      <SingleSelectDropdown
        openUp
        searchable
        clearable
        className="min-w-0 max-w-full"
        menuClassName={menuClassName}
        menuScrollClassName={operatorSocialLayout ? 'my-request-edit-neighborhood-menu--compact' : 'my-request-edit-neighborhood-menu'}
        matchTriggerWidth={operatorSocialLayout}
        menuWidthExtraPx={0}
        options={neighborhoodOptions}
        value={draft.neighborhood}
        onChange={neighborhood => {
          onChange(neighborhood ? { neighborhood } : { neighborhood, street: '', streetNo: '', openAddress: '' })
        }}
        placeholder={t('address.neighborhoodPlaceholder', 'Mahalle seçin')}
      />
    </label>
  )

  const streetFields = (
    <CbsStreetNoDropdowns
      neighborhood={draft.neighborhood}
      street={draft.street}
      streetNo={draft.streetNo}
      required={hasNeighborhood}
      labelClassName="text-xs font-semibold text-slate-500"
      openUp
      className={`grid min-w-0 gap-2 ${operatorSocialLayout ? 'grid-cols-[minmax(0,1fr)_6.75rem]' : 'grid-cols-[minmax(0,1fr)_4.5rem]'}`}
      streetNoColumnClassName=""
      menuClassName={menuClassName}
      menuScrollClassName={operatorSocialLayout ? 'my-request-edit-neighborhood-menu--compact' : 'my-request-edit-neighborhood-menu'}
      matchTriggerWidth={operatorSocialLayout}
      streetMenuWidthExtraPx={0}
      streetNoMenuWidthExtraPx={0}
      onStreetChange={street => onChange({ street })}
      onStreetNoChange={streetNo => onChange({ streetNo })}
    />
  )

  const openAddressField = (
    <label className="grid min-w-0 gap-1">
      <span className={`text-xs font-semibold text-slate-500${operatorSocialLayout ? ' flex min-h-[2.75rem] items-end gap-1.5' : ''}`}>
        <span className={operatorSocialLayout ? 'whitespace-nowrap' : undefined}>
          {t('address.openAddressLabel', 'Adres Tarifi')}
        </span>
        {operatorSocialLayout ? (
          <span className="shrink-0 font-normal text-slate-400 whitespace-nowrap">
            {t('address.openAddressMaxHint', '(max 400 karakter)')}
          </span>
        ) : hasNeighborhood ? (
          <span className="ml-1 font-normal text-slate-400">{t('address.openAddressMaxHint', '(max 400 karakter)')}</span>
        ) : null}
      </span>
      <textarea
        className={`field-textarea resize-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400${operatorSocialLayout ? ' min-h-[5.5rem] placeholder:text-[0.48rem]' : ' min-h-[2.75rem]'}`}
        placeholder={t('address.openAddressPlaceholder', 'Mevki, daire, kat bilgisi giriniz.')}
        maxLength={ADDRESS_OPEN_ADDRESS_MAX_LENGTH}
        value={draft.openAddress}
        rows={operatorSocialLayout ? Math.max(4, autoGrowRows(draft.openAddress)) : autoGrowRows(draft.openAddress)}
        onChange={e => onChange({ openAddress: e.target.value })}
        onBlur={() => onChange({ openAddress: normalizeTitleCaseField(draft.openAddress) ?? '' })}
        disabled={!hasNeighborhood}
      />
    </label>
  )

  const coordinatesField = (
    <AddressCoordinatesField
      value={draft.coordinates}
      onChange={coordinates => onChange({ coordinates })}
      labelClassName={`text-xs font-semibold text-slate-500${operatorSocialLayout ? ' flex min-h-[2.75rem] items-end' : ''}`}
      inputClassName={operatorSocialLayout ? 'placeholder:!text-[0.70rem]' : undefined}
    />
  )

  return (
    <div className="my-request-edit-fields grid gap-3">
      {operatorSocialLayout ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            {neighborhoodField}
            {streetFields}
          </div>
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
            {openAddressField}
            {coordinatesField}
          </div>
        </>
      ) : (
        <div className="my-request-edit-address-grid grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.2fr)]">
          {neighborhoodField}
          {streetFields}
          {openAddressField}
        </div>
      )}
    </div>
  )
}
