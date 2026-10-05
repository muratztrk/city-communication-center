import type { MySupportRequest } from '../types/platform'
import { getDistrictName, getSavedDistrictId } from '../data/izmir-locations'

/** Kurum ilçesi + yıl + sıra: Tire-2026-1, … (#4140). */
export function buildLumespecSupportTicketDisplayMap(
  requests: readonly MySupportRequest[],
): Map<string, string> {
  const sorted = [...requests].sort((a, b) => a.createdAtUtc.localeCompare(b.createdAtUtc))
  const yearCounters = new Map<number, number>()
  const map = new Map<string, string>()
  const districtLabel = getDistrictName(getSavedDistrictId())

  for (const request of sorted) {
    const year = new Date(request.createdAtUtc).getFullYear()
    const next = (yearCounters.get(year) ?? 0) + 1
    yearCounters.set(year, next)
    map.set(request.supportRequestId, `${districtLabel}-${year}-${next}`)
  }

  return map
}

export function formatLumespecSupportTicketNo(
  request: MySupportRequest,
  displayMap: Map<string, string>,
): string {
  return displayMap.get(request.supportRequestId) ?? '—'
}
