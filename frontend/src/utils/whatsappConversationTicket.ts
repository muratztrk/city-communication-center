import type { CitizenConversationTicket } from '../types/platform'

export function formatWhatsAppTicketLabel(ticket: CitizenConversationTicket | null | undefined): string | null {
  if (!ticket) return null
  if (ticket.citizenRequestNumber != null) {
    return `Talep Sayısı: ${ticket.citizenRequestNumber}`
  }
  if (ticket.jobNumber != null && ticket.jobNumberYear != null) {
    return `Talep Sayısı: ${ticket.jobNumber}`
  }
  return null
}

export function formatWhatsAppSummaryTicketLabel(summary: {
  latestCitizenRequestNumber?: number | null
} | null | undefined): string | null {
  if (!summary?.latestCitizenRequestNumber) return null
  return `Talep Sayısı: ${summary.latestCitizenRequestNumber}`
}

export function isWaitingForConversationResponse(summary: {
  lastMessageDirection?: 'Inbound' | 'Outbound' | null
  openTicketCount: number
  latestTicketStatus?: string | null
}): boolean {
  if (summary.openTicketCount <= 0) return false
  if (summary.latestTicketStatus === 'Closed') return false
  return summary.lastMessageDirection === 'Inbound'
}

export function isConversationTicketOpen(summary: {
  openTicketCount: number
  latestTicketStatus?: string | null
}): boolean {
  return summary.openTicketCount > 0 && summary.latestTicketStatus !== 'Closed'
}

export function isUrgentConversationPriority(priority: string | null | undefined): boolean {
  return priority === 'High' || priority === 'VeryHigh' || priority === 'Critical'
}
