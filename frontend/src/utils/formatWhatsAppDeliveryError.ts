export function formatWhatsAppDeliveryError(error: string | null | undefined): string | null {
  if (!error?.trim()) return null

  const normalized = error.trim()
  const lower = normalized.toLocaleLowerCase('tr')

  if (lower.includes('re-engagement')) {
    return '24 saatlik yanıt penceresi kapalı. Vatandaş son 24 saatte yazmadıysa yalnızca onaylı şablon mesaj gönderilebilir.'
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
