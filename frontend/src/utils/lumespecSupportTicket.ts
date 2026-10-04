import type { MySupportRequest } from '../types/platform'

/** Oluşturma yılına göre sıra: LUM-2026-1, LUM-2026-2, … (#4109). */
export function buildLumespecSupportTicketDisplayMap(
  requests: readonly MySupportRequest[],
): Map<string, string> {
  const sorted = [...requests].sort((a, b) => a.createdAtUtc.localeCompare(b.createdAtUtc))
  const yearCounters = new Map<number, number>()
  const map = new Map<string, string>()

  for (const request of sorted) {
    const year = new Date(request.createdAtUtc).getFullYear()
    const next = (yearCounters.get(year) ?? 0) + 1
    yearCounters.set(year, next)
    map.set(request.supportRequestId, `LUM-${year}-${next}`)
  }

  return map
}

export function formatLumespecSupportTicketNo(
  request: MySupportRequest,
  displayMap: Map<string, string>,
): string {
  return displayMap.get(request.supportRequestId) ?? '—'
}
