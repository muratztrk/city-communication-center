export const WHATSAPP_RE_ENGAGEMENT_WARNING =
  'Vatandaş son 24 saat içinde mesaj göndermediği için yalnızca Meta onaylı şablon mesaj gönderilebilir.'

export function isWhatsAppReEngagementError(error: string | null | undefined): boolean {
  return error?.toLocaleLowerCase('tr').includes('re-engagement') ?? false
}

export function formatWhatsAppDeliveryError(error: string | null | undefined): string | null {
  if (!error?.trim()) return null

  const normalized = error.trim()
  const lower = normalized.toLocaleLowerCase('tr')

  if (lower.includes('re-engagement')) {
    return WHATSAPP_RE_ENGAGEMENT_WARNING
  }

  if (lower.includes('phone number is malformed') || lower.includes('malformed')) {
    return 'WhatsApp alıcı telefon numarası geçersiz. Numara uluslararası formatta olmalıdır (ör. 905xxxxxxxxx).'
  }

  try {
    const payload = JSON.parse(normalized) as {
      error?: {
        message?: string
        error_data?: { details?: string }
      }
    }
    const details = payload.error?.error_data?.details?.trim()
    if (details) return details
    const message = payload.error?.message?.trim()
    if (message) return message
  } catch {
    // Plain-text backend errors are shown as-is.
  }

  return normalized
}
