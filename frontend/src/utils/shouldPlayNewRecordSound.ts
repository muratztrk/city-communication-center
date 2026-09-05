import { isNewRecordSoundSuppressed } from './newRecordSoundSuppress'

/** Yeni kayıt sesi: oturum açıkken (sekme görünür veya arka planda) çalar (#3390). */
export function shouldPlayNewRecordSound(_isOnTargetPage = true): boolean {
  if (typeof document === 'undefined') return false
  if (isNewRecordSoundSuppressed()) return false
  return true
}
