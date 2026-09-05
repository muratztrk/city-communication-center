let suppressUntilMs = 0

/** WA talep oluşturma sonrası liste yenilemesinde bildirim sesini sustur (#3390). */
export function suppressNewRecordSound(durationMs = 4000): void {
  suppressUntilMs = Date.now() + durationMs
}

export function isNewRecordSoundSuppressed(): boolean {
  return Date.now() < suppressUntilMs
}
