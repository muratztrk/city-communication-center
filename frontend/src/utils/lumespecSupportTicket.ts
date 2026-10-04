import type { MySupportRequest } from '../types/platform'

const LUM_TICKET_PATTERN = /^LUM-\d{4}-\d+$/i

/** Merkezden gelen veya yıl içi sıra ile LUM-YYYY-N (#4109). */
export function buildLumespecSupportTicketDisplayMap(
  requests: readonly MySupportRequest[],
): Map<string, string> {
  const sorted = [...requests].sort((a, b) => a.createdAtUtc.localeCompare(b.createdAtUtc))
  const yearCounters = new Map<number, number>()
  const map = new Map<string, string>()

  for (const request of sorted) {
    const central = request.centralTicketNo?.trim()
    if (central && LUM_TICKET_PATTERN.test(central)) {
      map.set(request.supportRequestId, central.toUpperCase())
      continue
    }
    if (central) {
      map.set(request.supportRequestId, central)
      continue
    }

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
  return displayMap.get(request.supportRequestId) ?? request.centralTicketNo?.trim() ?? '—'
}
