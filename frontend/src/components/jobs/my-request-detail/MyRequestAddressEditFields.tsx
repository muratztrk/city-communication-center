import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getNeighborhoodsForDistrict } from '../../../data/izmir-locations'
import { useMunicipalityDistrictId } from '../../../hooks/useMunicipalityDistrictId'
import { SingleSelectDropdown } from '../../ui/single-select-dropdown'
import { stringListSelectOptions } from '../../../utils/formDropdownOptions'
import { ADDRESS_OPEN_ADDRESS_MAX_LENGTH, ADDRESS_STREET_MAX_LENGTH, ADDRESS_STREET_NO_MAX_LENGTH, normalizeStreetNo } from '../../../utils/addressLimits'
import { normalizeTitleCaseField } from '../../../utils/textNormalization'
import type { MyRequestEditDraft } from './myRequestEditDraft'

interface MyRequestAddressEditFieldsProps {
  draft: MyRequestEditDraft
  onChange: (patch: Partial<MyRequestEditDraft>) => void
}

// Değer kutu genişliğini aşınca alt satıra taşacak kadar satır aç (cards #1359/#1360).
function autoGrowRows(value: string): number {
  return Math.min(4, Math.max(1, Math.ceil((value.length || 1) / 24)))
}

export function MyRequestAddressEditFields({ draft, onChange }: MyRequestAddressEditFieldsProps) {
  const { t } = useTranslation()
  const districtId = useMunicipalityDistrictId()
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(districtId), [districtId])
  const neighborhoodOptions = useMemo(() => stringListSelectOptions(neighborhoods), [neighborhoods])
  const hasNeighborhood = draft.neighborhood.trim().length > 0

  return (
    <div className="my-request-edit-fields grid gap-3">
      <div className="my-request-edit-address-grid grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.2fr)]">
        <label className="grid min-w-0 gap-1">
          <span className="text-xs font-semibold text-slate-500">{t('address.neighborhoodLabel', 'Mahalle')}</span>
          <SingleSelectDropdown
            openUp
            searchable
            className="min-w-0 max-w-full"
            menuClassName="min-w-full w-max max-w-[20rem]"
            menuScrollClassName="my-request-edit-neighborhood-menu"
            options={neighborhoodOptions}
            value={draft.neighborhood}
            onChange={neighborhood => {
              onChange(neighborhood ? { neighborhood } : { neighborhood, street: '', streetNo: '', openAddress: '' })
            }}
            placeholder={t('address.neighborhoodPlaceholder', 'Mahalle seçin')}
          />
        </label>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_4.5rem] gap-2">
          <label className="grid min-w-0 gap-1">
            <span className="text-xs font-semibold text-slate-500">
              {t('address.streetLabel', 'Cadde / Sokak')}
              {hasNeighborhood ? <span className="text-red-500"> *</span> : null}
            </span>
            <textarea
              className="field-textarea min-h-[2.75rem] resize-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              placeholder={t('address.streetPlaceholder', 'ör. Atatürk Caddesi')}
              maxLength={ADDRESS_STREET_MAX_LENGTH}
              value={draft.street}
              rows={autoGrowRows(draft.street)}
              onChange={e => onChange({ street: e.target.value })}
              onBlur={() => onChange({ street: normalizeTitleCaseField(draft.street) ?? '' })}
              disabled={!hasNeighborhood}
              required={hasNeighborhood}
            />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="text-xs font-semibold text-slate-500">
              {t('address.streetNoLabel', 'No')}
              {hasNeighborhood ? <span className="text-red-500"> *</span> : null}
            </span>
            <input
              className="field-input min-h-[2.75rem] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              placeholder={t('address.streetNoPlaceholder', 'ör. 12')}
              maxLength={ADDRESS_STREET_NO_MAX_LENGTH}
              value={draft.streetNo}
              onChange={e => onChange({ streetNo: normalizeStreetNo(e.target.value) })}
              disabled={!hasNeighborhood}
              required={hasNeighborhood}
            />
          </label>
        </div>
        <label className="grid min-w-0 gap-1">
          <span className="text-xs font-semibold text-slate-500">
            {t('address.openAddressLabel', 'Açık Adres')}
            {hasNeighborhood ? (
              <span className="ml-1 font-normal text-slate-400">{t('address.openAddressMaxHint', '(Max 100 karakter)')}</span>
            ) : null}
          </span>
          <textarea
            className="field-textarea min-h-[2.75rem] resize-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            placeholder={t('address.openAddressPlaceholder', 'Mevki, daire, kat bilgisi giriniz.')}
            maxLength={ADDRESS_OPEN_ADDRESS_MAX_LENGTH}
            value={draft.openAddress}
            rows={autoGrowRows(draft.openAddress)}
            onChange={e => onChange({ openAddress: e.target.value })}
            onBlur={() => onChange({ openAddress: normalizeTitleCaseField(draft.openAddress) ?? '' })}
            disabled={!hasNeighborhood}
          />
        </label>
      </div>
    </div>
  )
}
