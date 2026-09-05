/** Yeni kayıt sesi: sekme arka plandayken veya kullanıcı ilgili sayfada değilken (#3390 reopen). */
export function shouldPlayNewRecordSound(isOnTargetPage = true): boolean {
  if (typeof document === 'undefined') return false
  if (document.visibilityState !== 'visible') return true
  return !isOnTargetPage
}
