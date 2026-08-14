import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './button'
import { ModalBackdrop } from './modal-backdrop'
import { isSessionSupersededPending } from '../../api/sessionFlags'
import { restoreSessionFromCookie } from '../../api/auth'

/** 1 saat hareketsizlik → popup yok, direkt logout (#2603). */
const IDLE_LOGOUT_MS = 60 * 60_000
/** Cookie ExpireMinutes ile aynı; aktif kullanıcıya süre dolmadan uyarı (#2603). */
const SESSION_LIFETIME_MS = 480 * 60_000
const WARNING_COUNTDOWN_SECONDS = 60
const LAST_ACTIVITY_KEY = 'ccc_last_activity_at'
const SESSION_DEADLINE_KEY = 'ccc_session_deadline_at'

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
]

interface SessionIdleWarningProps {
  onLogout: () => void
}

function readStoredMs(key: string): number | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function writeStoredMs(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // private mode
  }
}

function ensureSessionDeadline(): number {
  const existing = readStoredMs(SESSION_DEADLINE_KEY)
  if (existing && existing > Date.now()) return existing
  const deadline = Date.now() + SESSION_LIFETIME_MS
  writeStoredMs(SESSION_DEADLINE_KEY, deadline)
  return deadline
}

export function SessionIdleWarning({ onLogout }: SessionIdleWarningProps) {
  const { t } = useTranslation()
  const [isWarningOpen, setIsWarningOpen] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(WARNING_COUNTDOWN_SECONDS)
  const idleTimerRef = useRef<number | null>(null)
  const sessionTimerRef = useRef<number | null>(null)
  const countdownTimerRef = useRef<number | null>(null)
  const warningOpenRef = useRef(false)
  const lastActivityAtRef = useRef(readStoredMs(LAST_ACTIVITY_KEY) ?? Date.now())
  const sessionDeadlineRef = useRef(ensureSessionDeadline())
  const warningOpenedAtRef = useRef<number | null>(null)
  const onLogoutRef = useRef(onLogout)
  onLogoutRef.current = onLogout

  const clearIdleTimer = () => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }

  const clearSessionTimer = () => {
    if (sessionTimerRef.current !== null) {
      window.clearTimeout(sessionTimerRef.current)
      sessionTimerRef.current = null
    }
  }

  const clearCountdown = () => {
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }

  const openWarning = () => {
    if (warningOpenRef.current) return
    warningOpenRef.current = true
    warningOpenedAtRef.current = Date.now()
    setIsWarningOpen(true)
    setSecondsLeft(WARNING_COUNTDOWN_SECONDS)
  }

  const forceLogout = () => {
    if (isSessionSupersededPending()) {
      return
    }
    clearIdleTimer()
    clearSessionTimer()
    clearCountdown()
    warningOpenRef.current = false
    warningOpenedAtRef.current = null
    setIsWarningOpen(false)
    onLogoutRef.current()
  }

  const idleElapsed = () => Date.now() - lastActivityAtRef.current

  const startIdleTimer = () => {
    clearIdleTimer()
    const remaining = Math.max(0, IDLE_LOGOUT_MS - idleElapsed())
    idleTimerRef.current = window.setTimeout(() => {
      forceLogout()
    }, remaining)
  }

  const startSessionWarningTimer = () => {
    clearSessionTimer()
    const untilWarning = sessionDeadlineRef.current - WARNING_COUNTDOWN_SECONDS * 1000 - Date.now()
    sessionTimerRef.current = window.setTimeout(() => {
      if (idleElapsed() >= IDLE_LOGOUT_MS) {
        forceLogout()
        return
      }
      openWarning()
    }, Math.max(0, untilWarning))
  }

  /** Uyku/sekme sonrası: gerçek geçen süreye bak (#2003 / #2603). */
  const reconcileIdleWithWallClock = () => {
    const storedActivity = readStoredMs(LAST_ACTIVITY_KEY)
    if (storedActivity && storedActivity > lastActivityAtRef.current) {
      lastActivityAtRef.current = storedActivity
    }
    const now = Date.now()
    if (now - lastActivityAtRef.current >= IDLE_LOGOUT_MS) {
      forceLogout()
      return
    }
    if (warningOpenRef.current) {
      const openedAt = warningOpenedAtRef.current ?? now
      const elapsedInWarning = now - openedAt
      if (elapsedInWarning >= WARNING_COUNTDOWN_SECONDS * 1000) {
        forceLogout()
        return
      }
      const remaining = Math.max(1, WARNING_COUNTDOWN_SECONDS - Math.floor(elapsedInWarning / 1000))
      setSecondsLeft(remaining)
      return
    }
    if (now >= sessionDeadlineRef.current - WARNING_COUNTDOWN_SECONDS * 1000) {
      openWarning()
    }
  }

  const resetIdleFromActivity = () => {
    if (warningOpenRef.current) {
      return
    }
    const now = Date.now()
    lastActivityAtRef.current = now
    writeStoredMs(LAST_ACTIVITY_KEY, now)
    startIdleTimer()
  }

  const extendSession = () => {
    clearCountdown()
    warningOpenRef.current = false
    warningOpenedAtRef.current = null
    setIsWarningOpen(false)
    setSecondsLeft(WARNING_COUNTDOWN_SECONDS)
    const now = Date.now()
    lastActivityAtRef.current = now
    writeStoredMs(LAST_ACTIVITY_KEY, now)
    sessionDeadlineRef.current = now + SESSION_LIFETIME_MS
    writeStoredMs(SESSION_DEADLINE_KEY, sessionDeadlineRef.current)
    startIdleTimer()
    startSessionWarningTimer()
    void restoreSessionFromCookie()
  }

  const endSession = () => {
    forceLogout()
  }

  useEffect(() => {
    const stored = readStoredMs(LAST_ACTIVITY_KEY)
    if (stored) lastActivityAtRef.current = stored
    else writeStoredMs(LAST_ACTIVITY_KEY, lastActivityAtRef.current)
    sessionDeadlineRef.current = ensureSessionDeadline()
    if (Date.now() - lastActivityAtRef.current >= IDLE_LOGOUT_MS) {
      forceLogout()
      return
    }
    startIdleTimer()
    startSessionWarningTimer()
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, resetIdleFromActivity, { passive: true })
    }
    const onWakeOrVisible = () => {
      if (document.visibilityState === 'hidden') return
      reconcileIdleWithWallClock()
      if (!warningOpenRef.current) {
        startIdleTimer()
        startSessionWarningTimer()
      }
    }
    document.addEventListener('visibilitychange', onWakeOrVisible)
    window.addEventListener('focus', onWakeOrVisible)
    window.addEventListener('pageshow', onWakeOrVisible)
    return () => {
      clearIdleTimer()
      clearSessionTimer()
      clearCountdown()
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, resetIdleFromActivity)
      }
      document.removeEventListener('visibilitychange', onWakeOrVisible)
      window.removeEventListener('focus', onWakeOrVisible)
      window.removeEventListener('pageshow', onWakeOrVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only idle watchers
  }, [])

  useEffect(() => {
    if (!isWarningOpen) {
      clearCountdown()
      return
    }

    countdownTimerRef.current = window.setInterval(() => {
      reconcileIdleWithWallClock()
      if (!warningOpenRef.current) return
      setSecondsLeft(current => {
        if (current <= 1) {
          clearCountdown()
          forceLogout()
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => {
      clearCountdown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- countdown tied to warning open
  }, [isWarningOpen])

  if (!isWarningOpen) {
    return null
  }

  return createPortal(
    <ModalBackdrop>
      <div className="relative w-full max-w-md rounded-[var(--radius-2xl)] bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-50 text-amber-500">
          <AlertCircle className="size-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-950">
          {t('sessionIdle.title', 'Oturum Süreniz Dolmak Üzere!')}
        </h2>
        <p className="mt-3 text-sm text-slate-700">
          {t('sessionIdle.message', 'Oturum süresini uzatmak ister misiniz?')}{' '}
          <span className="font-bold text-slate-950">{secondsLeft}</span>
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button type="button" variant="primary" onClick={extendSession}>
            {t('sessionIdle.extend', 'Evet, şimdi uzat')}
          </Button>
          <Button type="button" variant="destructive" onClick={endSession}>
            {t('sessionIdle.decline', 'Hayır')}
          </Button>
        </div>
      </div>
    </ModalBackdrop>,
    document.body,
  )
}
