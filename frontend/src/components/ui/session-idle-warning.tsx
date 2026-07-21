import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './button'
import { ModalBackdrop } from './modal-backdrop'

/** 1 saat hareketsizlik → uyarı; 300 sn geri sayım sonrası logout (card #1769 reopen). */
const IDLE_BEFORE_WARNING_MS = 60 * 60_000
const WARNING_COUNTDOWN_SECONDS = 300

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

  const startIdleTimer = () => {
    clearIdleTimer()
    idleTimerRef.current = window.setTimeout(() => {
      warningOpenRef.current = true
      setIsWarningOpen(true)
      setSecondsLeft(WARNING_COUNTDOWN_SECONDS)
    }, IDLE_BEFORE_WARNING_MS)
  }

  const resetIdleFromActivity = () => {
    if (warningOpenRef.current) {
      return
    }
    startIdleTimer()
  }

  const extendSession = () => {
    clearCountdown()
    warningOpenRef.current = false
    setIsWarningOpen(false)
    setSecondsLeft(WARNING_COUNTDOWN_SECONDS)
    startIdleTimer()
  }

  const endSession = () => {
    clearIdleTimer()
    clearCountdown()
    warningOpenRef.current = false
    setIsWarningOpen(false)
    onLogout()
  }

  useEffect(() => {
    startIdleTimer()
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, resetIdleFromActivity, { passive: true })
    }
    return () => {
      clearIdleTimer()
      clearCountdown()
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, resetIdleFromActivity)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only idle watchers
  }, [])

  useEffect(() => {
    if (!isWarningOpen) {
      clearCountdown()
      return
    }

    countdownTimerRef.current = window.setInterval(() => {
      setSecondsLeft(current => {
        if (current <= 1) {
          clearCountdown()
          warningOpenRef.current = false
          setIsWarningOpen(false)
          onLogout()
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => {
      clearCountdown()
    }
  }, [isWarningOpen, onLogout])

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
