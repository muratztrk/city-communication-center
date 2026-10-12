import type { MySupportRequest } from '../types/platform'

/** destek.lumespec.com yönetim panelindeki DESTEK numarası (#4196). */
export function formatLumespecSupportTicketNo(request: MySupportRequest): string {
  return request.centralTicketNo?.trim() || '—'
}
