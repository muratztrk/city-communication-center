import type { CitizenConversationTicket } from '../types/platform'

export function formatWhatsAppTicketLabel(ticket: CitizenConversationTicket | null | undefined): string | null {
  if (!ticket) return null
  if (ticket.citizenRequestNumber != null) {
    return `Talep #${ticket.citizenRequestNumber}`
  }
  if (ticket.jobNumber != null && ticket.jobNumberYear != null) {
    return `Talep #${ticket.jobNumber}`
  }
  return null
}

export function isUrgentConversationPriority(priority: string | null | undefined): boolean {
  return priority === 'High' || priority === 'VeryHigh' || priority === 'Critical'
}
