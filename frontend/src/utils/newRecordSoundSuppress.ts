let suppressUntilMs = 0

/** WA talep oluşturma / liste yenilemesinde bildirim sesini sustur (#3390 / #3414). */
export function suppressNewRecordSound(durationMs = 8000): void {
  suppressUntilMs = Date.now() + durationMs
}

export function isNewRecordSoundSuppressed(): boolean {
  return Date.now() < suppressUntilMs
}
