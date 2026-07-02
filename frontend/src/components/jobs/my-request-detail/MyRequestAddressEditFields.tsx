import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getNeighborhoodsForDistrict, getSavedDistrictId } from '../../../data/izmir-locations'
import { SingleSelectDropdown } from '../../ui/single-select-dropdown'
import { stringListSelectOptions } from '../../../utils/formDropdownOptions'
import type { MyRequestEditDraft } from './myRequestEditDraft'

interface MyRequestAddressEditFieldsProps {
  draft: MyRequestEditDraft
  onChange: (patch: Partial<MyRequestEditDraft>) => void
}

export function MyRequestAddressEditFields({ draft, onChange }: MyRequestAddressEditFieldsProps) {
  const { t } = useTranslation()
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(getSavedDistrictId()), [])
  const neighborhoodOptions = useMemo(() => stringListSelectOptions(neighborhoods), [neighborhoods])
  const hasNeighborhood = draft.neighborhood.trim().length > 0

  return (
    <div className="my-request-edit-fields grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-slate-500">{t('address.neighborhoodLabel', 'Mahalle')}</span>
          <SingleSelectDropdown
            openUp
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
          <input
            className="field-input disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            placeholder={t('address.streetPlaceholder', 'ör. Atatürk Caddesi')}
            value={draft.street}
            onChange={e => onChange({ street: e.target.value })}
            disabled={!hasNeighborhood}
          />
        </label>
      </div>
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-slate-500">{t('address.openAddressLabel', 'Açık Adres')}</span>
        <textarea
          className="field-textarea min-h-[5.5rem] resize-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          placeholder={t('address.openAddressPlaceholder', 'Bina no, kat, daire bilgisi giriniz...')}
          value={draft.openAddress}
          onChange={e => onChange({ openAddress: e.target.value })}
          disabled={!hasNeighborhood}
        />
      </label>
    </div>
  )
}
