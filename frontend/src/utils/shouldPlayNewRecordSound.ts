import { isNewRecordSoundSuppressed } from './newRecordSoundSuppress'

/** Sayfa yenilemesinde menü rozeti artışı ses tetiklemesin (#4110, #4114). */
const QUIET_PATH_PREFIXES = ['/lumespec-support', '/edevlet/activity-plans']

function isQuietNotificationRoute(): boolean {
  if (typeof window === 'undefined') return false
  const path = window.location.pathname
  return QUIET_PATH_PREFIXES.some(prefix => path.startsWith(prefix))
}

/** Yeni kayıt sesi: oturum açıkken (sekme görünür veya arka planda) çalar (#3390). */
export function shouldPlayNewRecordSound(_isOnTargetPage = true): boolean {
  if (typeof document === 'undefined') return false
  if (isQuietNotificationRoute()) return false
  if (isNewRecordSoundSuppressed()) return false
  return true
}
