import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { playNewRecordSound } from '../utils/playNewRecordSound'
import { shouldPlayNewRecordSound } from '../utils/shouldPlayNewRecordSound'

/** Sol menü rozeti arttığında bildirim sesi (#3390). Sayfaya girildiğinde mevcut rozet baz alınır. */
export function useNavBadgeCountSound(
  count: number | undefined,
  ready: boolean,
  targetPathPrefix: string,
  options?: { playOnTargetPage?: boolean },
): void {
  const playOnTargetPage = options?.playOnTargetPage ?? true
  const location = useLocation()
  const baselineSetRef = useRef(false)
  const previousCountRef = useRef(0)
  const onTargetPageRef = useRef(false)

  useEffect(() => {
    if (!ready || count === undefined) return

    const onTargetPage = location.pathname.startsWith(targetPathPrefix)

    if (onTargetPage && !onTargetPageRef.current) {
      baselineSetRef.current = true
      previousCountRef.current = count
      onTargetPageRef.current = true
      return
    }
    if (!onTargetPage) {
      onTargetPageRef.current = false
    }

    if (!baselineSetRef.current) {
      baselineSetRef.current = true
      previousCountRef.current = count
      return
    }

    if (count > previousCountRef.current && shouldPlayNewRecordSound(onTargetPage)) {
      if (!onTargetPage || playOnTargetPage) {
        playNewRecordSound()
      }
    }
    previousCountRef.current = count
  }, [count, ready, location.pathname, targetPathPrefix])
}
