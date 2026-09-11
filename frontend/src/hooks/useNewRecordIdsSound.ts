import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { playNewRecordSound } from '../utils/playNewRecordSound'
import { shouldPlayNewRecordSound } from '../utils/shouldPlayNewRecordSound'

type UseNewRecordIdsSoundOptions = {
  /** Sayfaya girildiğinde mevcut kayıtları baz al; önceden gelmiş kayıtlar için ses çalma (#3435). */
  targetPathPrefix?: string
  /** Scope/filtre değişince mevcut satırları yeni sayma (#3540). */
  resetKeys?: readonly unknown[]
}

/** Kayıt kimlikleri kümesine yeni id eklendiğinde bildirim sesi çalar (#3390). */
export function useNewRecordIdsSound(
  recordIds: readonly string[],
  ready = true,
  options?: UseNewRecordIdsSoundOptions,
): void {
  const location = useLocation()
  const targetPathPrefix = options?.targetPathPrefix
  const resetKey = (options?.resetKeys ?? []).map(item => String(item)).join('\u0001')
  const baselineSetRef = useRef(false)
  const previousIdsRef = useRef<Set<string>>(new Set())
  const onTargetPageRef = useRef(false)
  const idsKey = recordIds.join('\u0001')

  useEffect(() => {
    if (!resetKey) return
    baselineSetRef.current = false
    previousIdsRef.current = new Set()
  }, [resetKey])

  useEffect(() => {
    if (!ready) return

    const currentIds = idsKey.length > 0 ? idsKey.split('\u0001') : []
    const currentSet = new Set(currentIds)
    const onTargetPage = !targetPathPrefix || location.pathname.startsWith(targetPathPrefix)

    if (onTargetPage && targetPathPrefix && !onTargetPageRef.current) {
      baselineSetRef.current = true
      previousIdsRef.current = currentSet
      onTargetPageRef.current = true
      return
    }
    if (!onTargetPage && targetPathPrefix) {
      onTargetPageRef.current = false
    }

    if (!baselineSetRef.current) {
      baselineSetRef.current = true
      previousIdsRef.current = currentSet
      return
    }

    const hasNew = currentIds.some(id => !previousIdsRef.current.has(id))
    previousIdsRef.current = currentSet
    if (hasNew && shouldPlayNewRecordSound(onTargetPage)) {
      playNewRecordSound()
    }
  }, [idsKey, ready, location.pathname, targetPathPrefix])
}
