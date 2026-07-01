import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getNeighborhoodsForDistrict, getSavedDistrictId } from '../../../data/izmir-locations'
import type { MyRequestEditDraft } from './myRequestEditDraft'

interface MyRequestAddressEditFieldsProps {
  draft: MyRequestEditDraft
  onChange: (patch: Partial<MyRequestEditDraft>) => void
}

export function MyRequestAddressEditFields({ draft, onChange }: MyRequestAddressEditFieldsProps) {
  const { t } = useTranslation()
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(getSavedDistrictId()), [])

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-slate-500">{t('address.neighborhoodLabel', 'Mahalle')}</span>
          <select
            className="field-select"
            value={draft.neighborhood}
            onChange={e => onChange({ neighborhood: e.target.value })}
          >
            <option value="">{t('address.neighborhoodPlaceholder', 'Mahalle seçin')}</option>
            {neighborhoods.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-slate-500">{t('address.streetShortLabel', 'Cadde / Sokak')}</span>
          <input
            className="field-input"
            placeholder={t('address.streetPlaceholder', 'ör. Atatürk Caddesi')}
            value={draft.street}
            onChange={e => onChange({ street: e.target.value })}
          />
        </label>
      </div>
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-slate-500">{t('address.openAddressLabel', 'Açık Adres')}</span>
        <textarea
          className="field-textarea min-h-[5.5rem] resize-none"
          placeholder={t('address.openAddressPlaceholder', 'Bina no, kat, daire bilgisi giriniz...')}
          value={draft.openAddress}
          onChange={e => onChange({ openAddress: e.target.value })}
        />
      </label>
    </div>
  )
}
