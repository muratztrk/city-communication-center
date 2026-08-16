import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { animateDeterminateProgress } from '../utils/animateDeterminateProgress'

/**
 * Dosya ekle: tıklanınca bar %0; gerçek yükleme başlayınca yüzde ilerler (#2728).
 * `arm` = seçici açıldı. `holdAtZero` = dosya seçildi, henüz yükleme yok.
 * `start` = yükleme başladı (XHR yoksa determinate animasyon).
 */
export function useLocalFileSelectProgress() {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const cancelRef = useRef<(() => void) | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const armedRef = useRef(false)
  const uploadingRef = useRef(false)
  const focusHideRef = useRef<(() => void) | null>(null)

  const clearFocusListener = () => {
    if (focusHideRef.current) {
      window.removeEventListener('focus', focusHideRef.current)
      focusHideRef.current = null
    }
  }

  const stop = () => {
    cancelRef.current?.()
    cancelRef.current = null
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    clearFocusListener()
    armedRef.current = false
    uploadingRef.current = false
    setVisible(false)
    setProgress(0)
  }

  const arm = () => {
    cancelRef.current?.()
    cancelRef.current = null
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    clearFocusListener()
    armedRef.current = true
    uploadingRef.current = false
    flushSync(() => {
      setVisible(true)
      setProgress(0)
    })
    const onFocus = () => {
      window.setTimeout(() => {
        if (armedRef.current && !uploadingRef.current) {
          armedRef.current = false
          setVisible(false)
          setProgress(0)
        }
      }, 350)
    }
    focusHideRef.current = onFocus
    window.addEventListener('focus', onFocus)
  }

  const holdAtZero = () => {
    cancelRef.current?.()
    cancelRef.current = null
    clearFocusListener()
    armedRef.current = false
    uploadingRef.current = false
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
    clearFocusListener()
    armedRef.current = false
    uploadingRef.current = true
    flushSync(() => {
      setVisible(true)
      setProgress(0)
    })
    cancelRef.current = animateDeterminateProgress(
      setProgress,
      Math.max(bytes / 6000, 400),
      () => {
        hideTimerRef.current = window.setTimeout(() => {
          if (uploadingRef.current) {
            setVisible(false)
            setProgress(0)
            uploadingRef.current = false
          }
          hideTimerRef.current = null
        }, 280)
      },
    )
  }

  const report = (percent: number) => {
    cancelRef.current?.()
    cancelRef.current = null
    clearFocusListener()
    armedRef.current = false
    uploadingRef.current = true
    setVisible(true)
    setProgress(Math.min(100, Math.max(0, Math.round(percent))))
  }

  return { visible, progress, arm, holdAtZero, start, report, stop }
}
