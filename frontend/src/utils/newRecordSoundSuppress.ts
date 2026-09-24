let suppressUntilMs = 0
let muteCount = 0

/** WA talep oluşturma / liste yenilemesinde bildirim sesini sustur (#3390 / #3414). */
export function suppressNewRecordSound(durationMs = 8000): void {
  suppressUntilMs = Date.now() + durationMs
}

/** Sayfa açıkken bildirim sesini kapat. Dönüş temizliği unmount'ta çağrılır. */
export function muteNewRecordSoundWhileMounted(): () => void {
  muteCount += 1
  return () => {
    muteCount = Math.max(0, muteCount - 1)
  }
}

export function isNewRecordSoundSuppressed(): boolean {
  return muteCount > 0 || Date.now() < suppressUntilMs
}
