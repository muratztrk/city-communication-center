import { useCallback, useState } from 'react'

export function useColumnFilters() {
  const [filters, setFilters] = useState<Record<string, string>>({})

  const setFilter = useCallback((key: string, value: string) => {
    setFilters(prev => {
      if (!value.trim()) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [key]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [key]: value.trim() }
    })
  }, [])

  const clearFilters = useCallback(() => setFilters({}), [])

  /**
   * Returns true when `item` passes all active column filters.
   * @param item        The data row object.
   * @param getDisplay  Optional override: return the display string for a given key + item.
   *                    Use when the displayed value differs from the raw field (e.g. formatted dates).
   */
  const matchesFilters = useCallback(
    <T extends object>(item: T, getDisplay?: (key: string, item: T) => string): boolean => {
      for (const [key, value] of Object.entries(filters)) {
        const raw = getDisplay
          ? getDisplay(key, item)
          : String((item as Record<string, unknown>)[key] ?? '')
        // Türkçe "İ"/"I" eşleşmesi için tr-locale lowercase (ör. "İptal"/"İade" filtreleri).
        if (!raw.toLocaleLowerCase('tr').includes(value.toLocaleLowerCase('tr'))) return false
      }
      return true
    },
    [filters],
  )

  return { filters, setFilter, clearFilters, matchesFilters }
}
