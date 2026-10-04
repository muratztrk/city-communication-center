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

function normalizeCentralSupportStatusKey(status: string | null | undefined): string {
  return status?.trim().toLowerCase().replace(/[\s-]+/g, '_') ?? ''
}

const RESOLVED_CENTRAL_SUPPORT_STATUSES = new Set(['resolved', 'closed', 'cancelled'])

/** Çözümlendi filtresi — merkezi Lumespec durum kodları. */
export function isCentralSupportStatusResolved(status: string | null | undefined): boolean {
  const key = normalizeCentralSupportStatusKey(status)
  if (!key) return false
  return RESOLVED_CENTRAL_SUPPORT_STATUSES.has(key)
}

/** Çözüm bekleyen — çözümlenmemiş veya henüz merkeze gitmemiş kayıtlar. */
export function isCentralSupportStatusWaiting(status: string | null | undefined): boolean {
  return !isCentralSupportStatusResolved(status)
}
