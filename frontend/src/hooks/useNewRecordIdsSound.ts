import { useEffect, useRef } from 'react'
import { playNewRecordSound } from '../utils/playNewRecordSound'
import { shouldPlayNewRecordSound } from '../utils/shouldPlayNewRecordSound'

/** Kayıt kimlikleri kümesine yeni id eklendiğinde bildirim sesi çalar (#3390). */
export function useNewRecordIdsSound(recordIds: readonly string[], ready = true): void {
  const baselineSetRef = useRef(false)
  const previousIdsRef = useRef<Set<string>>(new Set())
  const idsKey = recordIds.join('\u0001')

  useEffect(() => {
    if (!ready) return

    const currentIds = idsKey.length > 0 ? idsKey.split('\u0001') : []
    const currentSet = new Set(currentIds)

    if (!baselineSetRef.current) {
      baselineSetRef.current = true
      previousIdsRef.current = currentSet
      return
    }

    const hasNew = currentIds.some(id => !previousIdsRef.current.has(id))
    previousIdsRef.current = currentSet
    if (hasNew && shouldPlayNewRecordSound(true)) {
      playNewRecordSound()
    }
  }, [idsKey, ready])
}
