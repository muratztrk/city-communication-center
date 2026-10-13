/** destek.lumespec.com DESTEK numarası: Tire-2026-34 (#4196). */
export function formatLumespecSupportTicketNo(request: { centralTicketNo?: string | null }): string {
  const raw = request.centralTicketNo?.trim()
  if (!raw) return '—'
  const match = /^([A-Za-z]+)-(\d{4})-0*(\d+)$/.exec(raw)
  if (!match) return raw
  const prefix = match[1]
  const year = match[2]
  const sequence = match[3]
  const district = prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase()
  return `${district}-${year}-${sequence}`
}
