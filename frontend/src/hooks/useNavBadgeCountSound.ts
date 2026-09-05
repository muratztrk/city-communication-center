import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { playNewRecordSound } from '../utils/playNewRecordSound'
import { shouldPlayNewRecordSound } from '../utils/shouldPlayNewRecordSound'

/** Sol menü rozeti arttığında, kullanıcı ilgili sayfada değilken bildirim sesi (#3390 reopen). */
export function useNavBadgeCountSound(
  count: number | undefined,
  ready: boolean,
  targetPathPrefix: string,
): void {
  const location = useLocation()
  const baselineSetRef = useRef(false)
  const previousCountRef = useRef(0)

  useEffect(() => {
    if (!ready || count === undefined) return

    const onTargetPage = location.pathname.startsWith(targetPathPrefix)

    if (!baselineSetRef.current) {
      baselineSetRef.current = true
      previousCountRef.current = count
      return
    }

    if (count > previousCountRef.current && shouldPlayNewRecordSound(onTargetPage)) {
      playNewRecordSound()
    }
    previousCountRef.current = count
  }, [count, ready, location.pathname, targetPathPrefix])
}
