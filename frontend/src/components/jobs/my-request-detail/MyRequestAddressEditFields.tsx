import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getNeighborhoodsForDistrict, getSavedDistrictId } from '../../../data/izmir-locations'
import { SingleSelectDropdown } from '../../ui/single-select-dropdown'
import { stringListSelectOptions } from '../../../utils/formDropdownOptions'
import { ADDRESS_OPEN_ADDRESS_MAX_LENGTH, ADDRESS_STREET_MAX_LENGTH } from '../../../utils/addressLimits'
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
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(getSavedDistrictId()), [])
  const neighborhoodOptions = useMemo(() => stringListSelectOptions(neighborhoods), [neighborhoods])
  const hasNeighborhood = draft.neighborhood.trim().length > 0

  return (
    <div className="my-request-edit-fields grid gap-3">
      {/* Kolonlar min-w-0 ile daralabilir kalır; dar ekranda grid tek kolona iner,
          Mahalle seçimi komşu alanın üstüne binmez (card #1612). */}
      <div className="my-request-edit-address-grid grid grid-cols-3 gap-3">
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
              onChange(neighborhood ? { neighborhood } : { neighborhood, street: '', openAddress: '' })
            }}
            placeholder={t('address.neighborhoodPlaceholder', 'Mahalle seçin')}
          />
        </label>
        <label className="grid min-w-0 gap-1">
          <span className="text-xs font-semibold text-slate-500">
            {t('address.streetLabel', 'Cadde / Sokak / Bulvar')}
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
          <span className="text-xs font-semibold text-slate-500">{t('address.openAddressLabel', 'Açık Adres')}</span>
          <textarea
            className="field-textarea min-h-[2.75rem] resize-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            placeholder={t('address.openAddressPlaceholder', 'Bina no, kat, daire bilgisi giriniz...')}
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
