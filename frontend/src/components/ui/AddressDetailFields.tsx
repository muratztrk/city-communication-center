import { useTranslation } from 'react-i18next'
import { CoordinatesPeekButton } from '../jobs/my-request-detail/CoordinatesPeekButton'

type AddressDetailFieldsProps = {
  neighborhood?: string | null
  street?: string | null
  streetNo?: string | null
  openAddress?: string | null
  coordinates?: string | null
  variant?: 'default' | 'detail-card' | 'my-request' | 'stacked' | 'peek'
}

function displayAddressValue(value: string | null | undefined, emptyValue = '—'): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : emptyValue
}

export function AddressDetailFields({ neighborhood, street, streetNo, openAddress, coordinates, variant = 'default' }: AddressDetailFieldsProps) {
  const { t } = useTranslation()
  const addressDirectionsLabel = t('address.directionsLabel', 'Adres Tarifi')
  const coordinatesLabel = t('address.coordinatesLabel', 'Konum Koordinatı')
  const coordinatesText = coordinates?.trim() ?? ''

  if (variant === 'peek') {
    return (
      <dl className="address-detail-my-request">
        <div className="address-detail-my-request__grid address-detail-my-request__grid--three">
          <div className="address-detail-my-request__item">
            <dt className="address-detail-my-request__label">{t('address.neighborhoodLabel', 'Mahalle')}</dt>
            <dd className="address-detail-my-request__value">{displayAddressValue(neighborhood, '-')}</dd>
          </div>
          <div className="address-detail-my-request__item">
            <dt className="address-detail-my-request__label">{t('address.streetLabel', 'Cadde / Sokak')}</dt>
            <dd className="address-detail-my-request__value">{displayAddressValue(street, '-')}</dd>
          </div>
          <div className="address-detail-my-request__item address-detail-my-request__item--street-no">
            <dt className="address-detail-my-request__label">{t('address.streetNoLabel', 'No')}</dt>
            <dd className="address-detail-my-request__value">{displayAddressValue(streetNo, '-')}</dd>
          </div>
          <div className="address-detail-my-request__item address-detail-my-request__item--directions address-detail-my-request__item--directions-full">
            <dt className="address-detail-my-request__label">{addressDirectionsLabel}</dt>
            <dd className="address-detail-my-request__value">{displayAddressValue(openAddress, '-')}</dd>
          </div>
        </div>
      </dl>
    )
  }

  if (variant === 'my-request' || variant === 'stacked') {
    const allEmpty = ![neighborhood, street, streetNo, openAddress, variant === 'stacked' ? null : coordinates].some(value => value?.trim())
    const stackedClass = allEmpty
      ? 'address-detail-my-request__grid--stacked'
      : 'address-detail-my-request__grid--stacked address-detail-my-request__grid--spaced'
    return (
      <dl className="address-detail-my-request">
        <div className={`address-detail-my-request__grid ${variant === 'stacked' ? stackedClass : `address-detail-my-request__grid--three${allEmpty ? ' address-detail-my-request__grid--empty' : ''}`}`}>
          <div className="address-detail-my-request__item">
            <dt className="address-detail-my-request__label">{t('address.neighborhoodLabel', 'Mahalle')}</dt>
            <dd className="address-detail-my-request__value">{displayAddressValue(neighborhood, '-')}</dd>
          </div>
          <div className="address-detail-my-request__item">
            <dt className="address-detail-my-request__label">{t('address.streetLabel', 'Cadde / Sokak')}</dt>
            <dd className="address-detail-my-request__value">{displayAddressValue(street, '-')}</dd>
          </div>
          <div className="address-detail-my-request__item address-detail-my-request__item--street-no">
            <dt className="address-detail-my-request__label">{t('address.streetNoLabel', 'No')}</dt>
            <dd className="address-detail-my-request__value">{displayAddressValue(streetNo, '-')}</dd>
          </div>
          <div className="address-detail-my-request__item address-detail-my-request__item--directions">
            <dt className="address-detail-my-request__label">{addressDirectionsLabel}</dt>
            <dd className="address-detail-my-request__value">{displayAddressValue(openAddress, '-')}</dd>
          </div>
          {variant === 'my-request' ? (
          <div className="address-detail-my-request__item address-detail-my-request__item--coordinates">
            <dt className="address-detail-my-request__label">{coordinatesLabel}</dt>
            <dd className="address-detail-my-request__value">
              {coordinatesText
                ? <CoordinatesPeekButton value={coordinatesText} />
                : displayAddressValue(null, '-')}
            </dd>
          </div>
          ) : null}
        </div>
      </dl>
    )
  }

  if (variant === 'detail-card') {
    const detailFields = [
      { label: t('address.neighborhoodLabel', 'Mahalle'), value: neighborhood },
      { label: t('address.streetLabel', 'Cadde / Sokak'), value: street },
    { label: t('address.streetNoLabel', 'No'), value: streetNo },
    { label: addressDirectionsLabel, value: openAddress, fullWidth: true },
    { label: coordinatesLabel, value: coordinates },
    ]
    return (
      <dl className="divide-y divide-slate-100">
        {detailFields.map(field => (
          <div
            key={field.label}
            className={`job-detail-field-row job-detail-field-row--detail-card${field.fullWidth ? ' job-detail-field-row--full' : ''}`}
          >
            <dt className="job-detail-field-row__label">{field.label}</dt>
            <dd className="job-detail-field-row__value">
              {field.label === coordinatesLabel && coordinatesText
                ? <CoordinatesPeekButton value={coordinatesText} />
                : displayAddressValue(field.value)}
            </dd>
          </div>
        ))}
      </dl>
    )
  }

  const fields = [
    { label: t('address.neighborhoodLabel', 'Mahalle'), value: neighborhood },
    { label: t('address.streetLabel', 'Cadde / Sokak'), value: street },
    { label: t('address.streetNoLabel', 'No'), value: streetNo },
    { label: addressDirectionsLabel, value: openAddress },
    { label: coordinatesLabel, value: coordinates },
  ]

  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-3">
      {fields.map(field => (
        <div key={field.label}>
          <dt className="mb-1 border-b border-slate-200 pb-1 text-xs font-semibold text-slate-500">{field.label}</dt>
          <dd className="break-words text-sm text-slate-900">
            {field.label === coordinatesLabel && coordinatesText
              ? <CoordinatesPeekButton value={coordinatesText} />
              : displayAddressValue(field.value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}
