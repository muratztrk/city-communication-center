import type { CitizenConversationSummary } from '../types/platform'

/** FAB rozet/panel sayacı — otomatik giden son mesajın unread artışını düşer (#2562). */
export function getWhatsAppFabUnreadCount(conversation: CitizenConversationSummary): number {
  let count = conversation.unreadCount
  if (conversation.lastMessageIsAutomaticOutbound && count > 0) {
    count -= 1
  }
  return Math.max(0, count)
}
