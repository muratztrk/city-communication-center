import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './button'
import { ModalBackdrop } from './modal-backdrop'

/** 1 saat hareketsizlik → kısa uyarı; 60 sn içinde uzatılmazsa logout (#1769 / #r490 / #2003). */
const IDLE_BEFORE_WARNING_MS = 60 * 60_000
const WARNING_COUNTDOWN_SECONDS = 60

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

export function SessionIdleWarning({ onLogout }: SessionIdleWarningProps) {
  const { t } = useTranslation()
  const [isWarningOpen, setIsWarningOpen] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(WARNING_COUNTDOWN_SECONDS)
  const idleTimerRef = useRef<number | null>(null)
  const countdownTimerRef = useRef<number | null>(null)
  const warningOpenRef = useRef(false)
  /** Duvar saati — setTimeout uyku sırasında donduğu için (#2003 / #r528). */
  const lastActivityAtRef = useRef(Date.now())
  const warningOpenedAtRef = useRef<number | null>(null)
  const onLogoutRef = useRef(onLogout)
  onLogoutRef.current = onLogout

  const clearIdleTimer = () => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
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
    clearIdleTimer()
    clearCountdown()
    warningOpenRef.current = false
    warningOpenedAtRef.current = null
    setIsWarningOpen(false)
    onLogoutRef.current()
  }

  /** Uyku/sekme sonrası: gerçek geçen süreye bak (#2003). */
  const reconcileIdleWithWallClock = () => {
    const now = Date.now()
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
    if (now - lastActivityAtRef.current >= IDLE_BEFORE_WARNING_MS) {
      clearIdleTimer()
      openWarning()
    }
  }

  const startIdleTimer = () => {
    clearIdleTimer()
    const remaining = Math.max(0, IDLE_BEFORE_WARNING_MS - (Date.now() - lastActivityAtRef.current))
    idleTimerRef.current = window.setTimeout(() => {
      openWarning()
    }, remaining)
  }

  const resetIdleFromActivity = () => {
    if (warningOpenRef.current) {
      return
    }
    lastActivityAtRef.current = Date.now()
    startIdleTimer()
  }

  const extendSession = () => {
    clearCountdown()
    warningOpenRef.current = false
    warningOpenedAtRef.current = null
    setIsWarningOpen(false)
    setSecondsLeft(WARNING_COUNTDOWN_SECONDS)
    lastActivityAtRef.current = Date.now()
    startIdleTimer()
  }

  const endSession = () => {
    forceLogout()
  }

  useEffect(() => {
    lastActivityAtRef.current = Date.now()
    startIdleTimer()
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, resetIdleFromActivity, { passive: true })
    }
    const onWakeOrVisible = () => {
      if (document.visibilityState === 'hidden') return
      reconcileIdleWithWallClock()
      if (!warningOpenRef.current) {
        startIdleTimer()
      }
    }
    document.addEventListener('visibilitychange', onWakeOrVisible)
    window.addEventListener('focus', onWakeOrVisible)
    window.addEventListener('pageshow', onWakeOrVisible)
    return () => {
      clearIdleTimer()
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
