import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { animateDeterminateProgress } from '../utils/animateDeterminateProgress'

/** Dosya seçilir seçilmez progress boyansın, yükleme başlamadan ilerlesin (#2728). */
export function useLocalFileSelectProgress() {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const cancelRef = useRef<(() => void) | null>(null)
  const hideTimerRef = useRef<number | null>(null)

  const stop = () => {
    cancelRef.current?.()
    cancelRef.current = null
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    setVisible(false)
    setProgress(0)
  }

  const start = (bytes: number) => {
    stop()
    flushSync(() => {
      setVisible(true)
      setProgress(8)
    })
    cancelRef.current = animateDeterminateProgress(
      setProgress,
      bytes / 6000,
      () => {
        hideTimerRef.current = window.setTimeout(() => {
          setVisible(false)
          setProgress(0)
        }, 280)
      },
    )
  }

  return { visible, progress, start, stop }
}
