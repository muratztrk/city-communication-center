/** Tek oturum supersede: popup kapanana kadar 401 → login atlama (#6a6c805e). */

let sessionSupersededPending = false

export function isSessionSupersededPending(): boolean {
  return sessionSupersededPending
}

export function markSessionSupersededPending(): void {
  sessionSupersededPending = true
}

export function clearSessionSupersededPending(): void {
  sessionSupersededPending = false
}
