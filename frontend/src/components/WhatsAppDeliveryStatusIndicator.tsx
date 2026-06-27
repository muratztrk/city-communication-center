import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type WhatsAppDeliveryStatusValue = 'Sent' | 'Delivered' | 'Read' | 'Failed'

interface WhatsAppDeliveryStatusIndicatorProps {
  status?: string | null
  error?: string | null
  variant?: 'light' | 'dark'
}

export function WhatsAppDeliveryStatusIndicator({
  status,
  error,
  variant = 'dark',
}: WhatsAppDeliveryStatusIndicatorProps) {
  const { t } = useTranslation()
  if (!status) return null

  const baseClass = variant === 'dark' ? 'text-white/70' : 'text-slate-400'
  const readClass = variant === 'dark' ? 'text-sky-200' : 'text-sky-500'
  const failClass = variant === 'dark' ? 'text-red-200' : 'text-red-600'

  if (status === 'Failed') {
    return (
      <span
        className={`inline-flex items-center gap-0.5 ${failClass}`}
        title={error ?? t('whatsapp.delivery.failed', 'İletilemedi')}
      >
        <AlertCircle className="size-3 shrink-0" />
        <span>{t('whatsapp.delivery.failed', 'İletilemedi')}</span>
      </span>
    )
  }

  if (status === 'Read') {
    return (
      <span className={`inline-flex items-center gap-0.5 ${readClass}`} title={t('whatsapp.delivery.read', 'Okundu')}>
        <CheckCheck className="size-3 shrink-0" />
        <span>{t('whatsapp.delivery.read', 'Okundu')}</span>
      </span>
    )
  }

  if (status === 'Delivered') {
    return (
      <span className={`inline-flex items-center gap-0.5 ${baseClass}`} title={t('whatsapp.delivery.delivered', 'İletildi')}>
        <CheckCheck className="size-3 shrink-0" />
        <span>{t('whatsapp.delivery.delivered', 'İletildi')}</span>
      </span>
    )
  }

  if (status === 'Sent') {
    return (
      <span className={`inline-flex items-center gap-0.5 ${baseClass}`} title={t('whatsapp.delivery.sent', 'Gönderildi')}>
        <Check className="size-3 shrink-0" />
        <span>{t('whatsapp.delivery.sent', 'Gönderildi')}</span>
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-0.5 ${baseClass}`}>
      <Clock className="size-3 shrink-0" />
    </span>
  )
}
