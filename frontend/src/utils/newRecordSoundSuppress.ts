let suppressUntilMs = 0
let muteCount = 0

const WALLBOARD_HEARTBEAT_KEY = 'ccc-wallboard-active-heartbeat'
const WALLBOARD_HEARTBEAT_STALE_MS = 5000

/** Ekrana Yansıt sekmesi açıkken diğer sekmelerde bildirim sesi çalmaz (#4103). */
export function pulseWallboardTabHeartbeat(): void {
  try {
    localStorage.setItem(WALLBOARD_HEARTBEAT_KEY, String(Date.now()))
  } catch {
    // localStorage kapalı ortamlarda sessizce yoksay.
  }
}

export function clearWallboardTabHeartbeat(): void {
  try {
    localStorage.removeItem(WALLBOARD_HEARTBEAT_KEY)
  } catch {
    // ignore
  }
}

function isWallboardOpenInAnotherTab(): boolean {
  try {
    const raw = localStorage.getItem(WALLBOARD_HEARTBEAT_KEY)
    if (!raw) return false
    const at = Number(raw)
    if (!Number.isFinite(at)) return false
    return Date.now() - at < WALLBOARD_HEARTBEAT_STALE_MS
  } catch {
    return false
  }
}

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
  return muteCount > 0 || Date.now() < suppressUntilMs || isWallboardOpenInAnotherTab()
}
