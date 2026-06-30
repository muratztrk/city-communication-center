import { useTranslation } from 'react-i18next'

type AddressDetailFieldsProps = {
  neighborhood?: string | null
  street?: string | null
  openAddress?: string | null
  variant?: 'default' | 'detail-card'
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

  if (variant === 'detail-card') {
    return (
      <dl className="space-y-3">
        {fields.map(field => (
          <div key={field.label}>
            <dt className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">{field.label}</dt>
            <dd className="break-words text-sm font-semibold text-slate-900">{displayAddressValue(field.value)}</dd>
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
