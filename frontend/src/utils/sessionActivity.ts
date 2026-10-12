/** Cookie ExpireMinutes ile aynı; aktivitede kayar (#3424 / #4194). */
const SESSION_LIFETIME_MS = 540 * 60_000
const LAST_ACTIVITY_KEY = 'ccc_last_activity_at'
const SESSION_DEADLINE_KEY = 'ccc_session_deadline_at'

function writeStoredMs(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // private mode
  }
}

/** Ekrana yansıt otomatik yenilemesi hareketsizlik sayacını kaydırır (#4194). */
export function touchSessionActivity(now = Date.now()) {
  writeStoredMs(LAST_ACTIVITY_KEY, now)
  writeStoredMs(SESSION_DEADLINE_KEY, now + SESSION_LIFETIME_MS)
}

export const sessionActivityKeys = {
  lastActivity: LAST_ACTIVITY_KEY,
  deadline: SESSION_DEADLINE_KEY,
  lifetimeMs: SESSION_LIFETIME_MS,
} as const
