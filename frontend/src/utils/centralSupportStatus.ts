import type { TFunction } from 'i18next'

/** Lumespec destek API durum kodlarını kullanıcıya gösterilecek metne çevirir. */
export function formatCentralSupportStatus(
  status: string | null | undefined,
  t: TFunction,
): string | null {
  const raw = status?.trim()
  if (!raw) {
    return null
  }

  const key = raw.toLowerCase().replace(/[\s-]+/g, '_')
  const translated = t(`support.centralStatus.${key}`, { defaultValue: '' })
  if (translated) {
    return translated
  }

  return raw.replace(/_/g, ' ')
}
