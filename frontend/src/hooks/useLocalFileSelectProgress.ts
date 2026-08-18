import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { animateDeterminateProgress } from '../utils/animateDeterminateProgress'

/**
 * Dosya ekle progress: butona basınca görünmez; dosya seçildikten veya yükleme
 * başladığında görünür (#2821). `holdAtZero` = seçim sonrası %0. `report` = gerçek
 * yükleme; %100 sonrası kısa gecikmeyle kapanır.
 */
export function useLocalFileSelectProgress() {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const cancelRef = useRef<(() => void) | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const uploadingRef = useRef(false)

  const stop = () => {
    cancelRef.current?.()
    cancelRef.current = null
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    uploadingRef.current = false
    setVisible(false)
    setProgress(0)
  }

  const scheduleHide = () => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
    }
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false)
      setProgress(0)
      uploadingRef.current = false
      hideTimerRef.current = null
    }, 280)
  }

  const holdAtZero = () => {
    cancelRef.current?.()
    cancelRef.current = null
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    uploadingRef.current = true
    flushSync(() => {
      setVisible(true)
      setProgress(0)
    })
  }

  const start = (bytes: number) => {
    cancelRef.current?.()
    cancelRef.current = null
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    uploadingRef.current = true
    flushSync(() => {
      setVisible(true)
      setProgress(0)
    })
    cancelRef.current = animateDeterminateProgress(
      setProgress,
      Math.max(bytes / 6000, 400),
      () => {
        scheduleHide()
      },
    )
  }

  const report = (percent: number) => {
    cancelRef.current?.()
    cancelRef.current = null
    uploadingRef.current = true
    const rounded = Math.min(100, Math.max(0, Math.round(percent)))
    flushSync(() => {
      setVisible(true)
      setProgress(rounded)
    })
    if (rounded >= 100) {
      scheduleHide()
    } else if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  return { visible, progress, holdAtZero, start, report, stop }
}
