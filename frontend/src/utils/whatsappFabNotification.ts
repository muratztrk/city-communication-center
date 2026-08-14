import type { CitizenConversationSummary } from '../types/platform'

/** FAB rozet/panel sayacı — otomatik giden son mesajın unread artışını düşer (#2562). */
export function isAutomaticOutboundConversation(conversation: CitizenConversationSummary): boolean {
  if (conversation.lastMessageIsAutomaticOutbound) return true
  const preview = conversation.lastMessagePreview?.toLocaleLowerCase('tr') ?? ''
  return preview.includes('talebinizin durumu')
}

export function getWhatsAppFabUnreadCount(conversation: CitizenConversationSummary): number {
  let count = conversation.unreadCount
  if (isAutomaticOutboundConversation(conversation) && count > 0) {
    count -= 1
  }
  return Math.max(0, count)
}
