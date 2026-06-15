import { useCallback, useState } from 'react'

export type SortDir = 'asc' | 'desc'

const ISO_RE = /^\d{4}-\d{2}-\d{2}T/

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
      if (current.sortKey !== key) {
        return { sortKey: key, sortDir: 'asc' }
      }
      if (current.sortDir === 'asc') {
        return { sortKey: key, sortDir: 'desc' }
      }
      return { sortKey: null, sortDir: 'asc' }
    })
  }, [])

  const sortItems = useCallback(<T>(items: T[]): T[] => {
    if (!sortKey) return items
    return [...items].sort((a, b) => compare(getVal(a, sortKey), getVal(b, sortKey), sortDir))
  }, [sortKey, sortDir])

  return { sortKey, sortDir, toggleSort, sortItems }
}
