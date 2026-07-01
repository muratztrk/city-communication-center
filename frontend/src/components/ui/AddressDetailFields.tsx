import { useTranslation } from 'react-i18next'

type AddressDetailFieldsProps = {
  neighborhood?: string | null
  street?: string | null
  openAddress?: string | null
  variant?: 'default' | 'detail-card' | 'my-request'
}

function displayAddressValue(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '—'
}

export function AddressDetailFields({ neighborhood, street, openAddress, variant = 'default' }: AddressDetailFieldsProps) {
  const { t } = useTranslation()
  const fields = [
    { label: t('address.neighborhoodLabel', 'Mahalle'), value: neighborhood },
    { label: t('address.streetLabel', 'Cadde / Sokak / Bulvar'), value: street },
    { label: t('address.openAddressLabel', 'Açık Adres'), value: openAddress },
  ]

  if (variant === 'my-request') {
    return (
      <dl className="address-detail-my-request">
        <div className="address-detail-my-request__grid">
          <div className="address-detail-my-request__item">
            <dt className="address-detail-my-request__label">{t('address.neighborhoodLabel', 'Mahalle')}</dt>
            <dd className="address-detail-my-request__value">{displayAddressValue(neighborhood)}</dd>
          </div>
          <div className="address-detail-my-request__item">
            <dt className="address-detail-my-request__label">{t('address.streetShortLabel', 'Cadde / Sokak')}</dt>
            <dd className="address-detail-my-request__value">{displayAddressValue(street)}</dd>
          </div>
        </div>
        <div className="address-detail-my-request__item address-detail-my-request__item--full">
          <dt className="address-detail-my-request__label">{t('address.openAddressLabel', 'Açık Adres')}</dt>
          <dd className="address-detail-my-request__value">{displayAddressValue(openAddress)}</dd>
        </div>
      </dl>
    )
  }

  if (variant === 'detail-card') {
    return (
      <dl className="divide-y divide-slate-100">
        {fields.map(field => (
          <div key={field.label} className="job-detail-field-row job-detail-field-row--detail-card">
            <dt className="job-detail-field-row__label">{field.label}</dt>
            <dd className="job-detail-field-row__value">{displayAddressValue(field.value)}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-3">
      {fields.map(field => (
        <div key={field.label}>
          <dt className="mb-1 border-b border-slate-200 pb-1 text-xs font-semibold text-slate-500">{field.label}</dt>
          <dd className="break-words text-sm text-slate-900">{displayAddressValue(field.value)}</dd>
        </div>
      ))}
    </dl>
  )
}
