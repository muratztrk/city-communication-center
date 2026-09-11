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
  waitingReplyClearedAtUtc?: string | null
}): boolean {
  if (summary.openTicketCount <= 0) return false
  if (summary.latestTicketStatus === 'Closed') return false
  if (summary.waitingReplyClearedAtUtc) return false
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

export function isWhatsAppTicketChannel(channel?: string | null): boolean {
  return (channel ?? '').toLocaleLowerCase('tr') === 'whatsapp'
}

export function pickReplyTicket(tickets: CitizenConversationTicket[]): CitizenConversationTicket | undefined {
  const ordered = tickets.slice().reverse()
  const replyableStatuses = new Set(['New', 'Categorized', 'Routed', 'Responded'])
  return ordered.find(ticket => replyableStatuses.has(ticket.status))
    ?? ordered.find(ticket => ticket.status !== 'Closed')
}

function isPhoneTicketChannel(channel?: string | null): boolean {
  return (channel ?? '').toLocaleLowerCase('tr') === 'phone'
}

/** WA sayfasında yanıt şablonu Phone VT olmaz — ham WhatsApp thread tercih edilir. */
export function pickReplySocialMessageId(detail: {
  tickets: CitizenConversationTicket[]
  timeline: Array<{ socialMessageId?: string | null }>
}): string | undefined {
  const whatsappTickets = detail.tickets.filter(ticket => isWhatsAppTicketChannel(ticket.channel))
  const ticket = pickReplyTicket(whatsappTickets)
  if (ticket) return ticket.socialMessageId

  const phoneIds = new Set(
    detail.tickets
      .filter(ticket => isPhoneTicketChannel(ticket.channel))
      .map(ticket => ticket.socialMessageId),
  )
  for (let index = detail.timeline.length - 1; index >= 0; index -= 1) {
    const socialMessageId = detail.timeline[index]?.socialMessageId
    if (socialMessageId && !phoneIds.has(socialMessageId)) return socialMessageId
  }
  return undefined
}

export function conversationHasCitizenRequest(detail: {
  tickets: CitizenConversationTicket[]
}): boolean {
  return detail.tickets.some(ticket => Boolean(ticket.jobId || ticket.citizenRequestNumber))
}

/**
 * Talep oluştur çapası: önce WhatsApp thread, yoksa mevcut VT (çağrı dahil).
 * Yanıt hedefi yoktur diye buton kapanmasın — çağrı-önce konuşmada da WA VT açılır.
 */
export function pickCreateRequestSocialMessageId(detail: {
  tickets: CitizenConversationTicket[]
  timeline: Array<{ socialMessageId?: string | null }>
}): string | undefined {
  return pickReplySocialMessageId(detail)
    ?? pickReplyTicket(detail.tickets)?.socialMessageId
    ?? detail.tickets[0]?.socialMessageId
}
