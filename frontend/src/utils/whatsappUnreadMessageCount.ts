import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import type { CitizenConversationSummary } from '../types/platform'
import { getWhatsAppFabUnreadCount } from './whatsappFabNotification'

/** Operatör sekme rozeti — konuşma görününce unread düşer (#3531). */
export function getWhatsAppUnreadMessageCount(conversations: CitizenConversationSummary[]): number {
  return conversations.reduce((sum, conversation) => {
    if (conversation.isRelevantToCurrentUser === false) return sum
    return sum + getWhatsAppFabUnreadCount(conversation)
  }, 0)
}

export function syncWhatsAppUnreadMessageCount(
  queryClient: QueryClient,
  conversations: CitizenConversationSummary[],
) {
  queryClient.setQueryData(queryKeys.conversations.unreadMessageCount(), getWhatsAppUnreadMessageCount(conversations))
}
