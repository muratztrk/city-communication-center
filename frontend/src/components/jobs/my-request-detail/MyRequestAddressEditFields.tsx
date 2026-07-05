import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getNeighborhoodsForDistrict, getSavedDistrictId } from '../../../data/izmir-locations'
import { SingleSelectDropdown } from '../../ui/single-select-dropdown'
import { stringListSelectOptions } from '../../../utils/formDropdownOptions'
import { ADDRESS_OPEN_ADDRESS_MAX_LENGTH, ADDRESS_STREET_MAX_LENGTH } from '../../../utils/addressLimits'
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
      <div className="grid grid-cols-3 gap-3">
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-slate-500">{t('address.neighborhoodLabel', 'Mahalle')}</span>
          <SingleSelectDropdown
            openUp
            searchable
            menuClassName="min-w-full w-max max-w-[20rem]"
            options={neighborhoodOptions}
            value={draft.neighborhood}
            onChange={neighborhood => {
              onChange(neighborhood ? { neighborhood } : { neighborhood, street: '', openAddress: '' })
            }}
            placeholder={t('address.neighborhoodPlaceholder', 'Mahalle seçin')}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-slate-500">{t('address.streetLabel', 'Cadde / Sokak / Bulvar')}</span>
          <textarea
            className="field-textarea min-h-[2.75rem] resize-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            placeholder={t('address.streetPlaceholder', 'ör. Atatürk Caddesi')}
            maxLength={ADDRESS_STREET_MAX_LENGTH}
            value={draft.street}
            rows={autoGrowRows(draft.street)}
            onChange={e => onChange({ street: e.target.value })}
            disabled={!hasNeighborhood}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-slate-500">{t('address.openAddressLabel', 'Açık Adres')}</span>
          <textarea
            className="field-textarea min-h-[2.75rem] resize-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            placeholder={t('address.openAddressPlaceholder', 'Bina no, kat, daire bilgisi giriniz...')}
            maxLength={ADDRESS_OPEN_ADDRESS_MAX_LENGTH}
            value={draft.openAddress}
            rows={autoGrowRows(draft.openAddress)}
            onChange={e => onChange({ openAddress: e.target.value })}
            disabled={!hasNeighborhood}
          />
        </label>
      </div>
    </div>
  )
}
