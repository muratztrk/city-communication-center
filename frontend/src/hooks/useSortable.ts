import { useCallback, useState } from 'react'

export type SortDir = 'asc' | 'desc'

const ISO_RE = /^\d{4}-\d{2}-\d{2}T/
const REQUEST_NO_RE = /^(?:VT|T)-(\d{4})-(\d+)$/i
const DESC_FIRST_SORT_KEYS = new Set(['jobNumber', 'citizenRequestNumber'])

function parsePrefixedRequestNo(value: string): { year: number; seq: number } | null {
  const match = REQUEST_NO_RE.exec(value.trim())
  if (!match) return null
  return { year: Number(match[1]), seq: Number(match[2]) }
}

function getVal(obj: unknown, key: string): unknown {
  if (obj == null || typeof obj !== 'object') return null
  return (obj as Record<string, unknown>)[key] ?? null
}

function compare(a: unknown, b: unknown, dir: SortDir): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1

  if (typeof a === 'string' && typeof b === 'string') {
    if (ISO_RE.test(a) && ISO_RE.test(b)) {
      const diff = new Date(a).getTime() - new Date(b).getTime()
      return dir === 'asc' ? diff : -diff
    }
    const requestA = parsePrefixedRequestNo(a)
    const requestB = parsePrefixedRequestNo(b)
    if (requestA && requestB) {
      if (requestA.seq !== requestB.seq) {
        const diff = requestA.seq - requestB.seq
        return dir === 'asc' ? diff : -diff
      }
      const yearDiff = requestA.year - requestB.year
      return dir === 'asc' ? yearDiff : -yearDiff
    }
    const diff = a.localeCompare(b, 'tr', { sensitivity: 'base' })
    return dir === 'asc' ? diff : -diff
  }

  if (typeof a === 'number' && typeof b === 'number') {
    return dir === 'asc' ? a - b : b - a
  }

  if (typeof a === 'boolean' && typeof b === 'boolean') {
    if (a === b) return 0
    return dir === 'asc' ? (a ? 1 : -1) : (a ? -1 : 1)
  }

  return 0
}

export function useSortable() {
  const [{ sortKey, sortDir }, setSortState] = useState<{
    sortKey: string | null
    sortDir: SortDir
  }>({
    sortKey: null,
    sortDir: 'asc',
  })

  const toggleSort = useCallback((key: string) => {
    setSortState(current => {
      const firstDir: SortDir = DESC_FIRST_SORT_KEYS.has(key) ? 'desc' : 'asc'
      if (current.sortKey !== key) {
        return { sortKey: key, sortDir: firstDir }
      }
      if (current.sortDir === firstDir) {
        return { sortKey: key, sortDir: firstDir === 'desc' ? 'asc' : 'desc' }
      }
      return { sortKey: null, sortDir: 'asc' }
    })
  }, [])

  const sortItems = useCallback(<T>(items: T[]): T[] => {
    if (!sortKey) return items
    return [...items].sort((a, b) => {
      if (sortKey === 'jobNumber') {
        const rowA = a as { citizenRequestNumber?: number | null; jobNumber?: number | string | null }
        const rowB = b as { citizenRequestNumber?: number | null; jobNumber?: number | string | null }
        const seqA = typeof rowA.citizenRequestNumber === 'number' ? rowA.citizenRequestNumber
          : typeof rowA.jobNumber === 'number' ? rowA.jobNumber : null
        const seqB = typeof rowB.citizenRequestNumber === 'number' ? rowB.citizenRequestNumber
          : typeof rowB.jobNumber === 'number' ? rowB.jobNumber : null
        if (seqA != null && seqB != null && seqA !== seqB) {
          return sortDir === 'asc' ? seqA - seqB : seqB - seqA
        }
      }
      return compare(getVal(a, sortKey), getVal(b, sortKey), sortDir)
    })
  }, [sortKey, sortDir])

  return { sortKey, sortDir, toggleSort, sortItems }
}
