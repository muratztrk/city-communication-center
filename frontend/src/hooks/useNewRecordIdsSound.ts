import { useEffect, useRef } from 'react'
import { playNewRecordSound } from '../utils/playNewRecordSound'

/** Kayıt kimlikleri kümesine yeni id eklendiğinde bildirim sesi çalar (#3390). */
export function useNewRecordIdsSound(recordIds: readonly string[]): void {
  const initializedRef = useRef(false)
  const previousIdsRef = useRef<Set<string>>(new Set())
  const idsKey = recordIds.join('\u0001')

  useEffect(() => {
    const currentIds = idsKey.length > 0 ? idsKey.split('\u0001') : []
    const currentSet = new Set(currentIds)

    if (!initializedRef.current) {
      initializedRef.current = true
      previousIdsRef.current = currentSet
      return
    }

    if (document.visibilityState !== 'visible') {
      previousIdsRef.current = currentSet
      return
    }

    const hasNew = currentIds.some(id => !previousIdsRef.current.has(id))
    previousIdsRef.current = currentSet
    if (hasNew) {
      playNewRecordSound()
    }
  }, [idsKey])
}
