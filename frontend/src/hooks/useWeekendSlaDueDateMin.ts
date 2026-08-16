import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { weekendSlaDueDateFloor } from '../utils/dateTimePicker'

/** Hafta sonu SLA durduruluyorsa Son Tarih tabanı (Pazartesi mesai + varsayılan SLA) — #2706. */
export function useWeekendSlaDueDateMin(): string | null {
  const { data } = useQuery({
    queryKey: queryKeys.settings.dueDateConstraints(),
    queryFn: () => api.getDueDateConstraints(),
    staleTime: 60_000,
  })
  if (data?.weekendDueDateMinLocal) return data.weekendDueDateMinLocal
  if (data && data.excludeWeekends === false) return null
  return weekendSlaDueDateFloor(true)
}
