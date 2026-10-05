import type { TFunction } from 'i18next'
import {
  formatCentralSupportStatus,
  isCentralSupportStatusResolved,
  isCentralSupportStatusWaiting,
} from './centralSupportStatus'

export function resolveSupportRequestStatusLabel(
  t: TFunction,
  centralStatus: string | null | undefined,
  centralSyncError: string | null | undefined,
): string {
  if (centralSyncError) {
    return t('support.statusSyncFailed', 'Merkeze iletilemedi')
  }
  const formatted = formatCentralSupportStatus(centralStatus, t)
  if (formatted) return formatted
  return t('support.scopes.waiting', 'Çözüm Bekleyen')
}

export function supportRequestStatusTextClass(
  centralStatus: string | null | undefined,
  centralSyncError: string | null | undefined,
): string {
  if (centralSyncError) return 'font-semibold text-red-600'
  if (isCentralSupportStatusResolved(centralStatus)) return 'font-semibold text-emerald-700'
  if (isCentralSupportStatusWaiting(centralStatus)) return 'font-semibold text-blue-600'
  return 'font-semibold text-slate-700'
}
