import { useTranslation } from 'react-i18next'
import { buildGoogleMapsEmbedUrl } from '../../utils/googleMaps'
import { cn } from '../../lib/cn'

type GoogleMapsEmbedProps = {
  latitude: number
  longitude: number
  className?: string
  title?: string
}

/** Read-only Google Maps Embed for a lat/lng pin; shows config warning when key is missing. */
export function GoogleMapsEmbed({ latitude, longitude, className, title }: GoogleMapsEmbedProps) {
  const { t } = useTranslation()
  const src = buildGoogleMapsEmbedUrl(latitude, longitude)
  const mapTitle = title ?? t('location.mapTitle', 'Konum Haritası')

  if (!src) {
    return (
      <div className={cn('flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-600', className)}>
        {t('location.mapNotConfigured', 'Harita yapılandırılmadı. Google Maps API anahtarı gerekli.')}
      </div>
    )
  }

  return (
    <iframe
      src={src}
      className={cn('h-64 w-full', className)}
      title={mapTitle}
      allowFullScreen
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  )
}
