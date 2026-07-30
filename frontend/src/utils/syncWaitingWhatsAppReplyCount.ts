import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import type { CitizenConversationSummary } from '../types/platform'
import { isWaitingForConversationResponse } from './whatsappConversationTicket'

/** Sol menü WhatsApp rozetini listeyle anında senkronlar (card #6a6b6ec6). */
export function syncWaitingWhatsAppReplyCount(
  queryClient: QueryClient,
  conversations: CitizenConversationSummary[],
) {
  const count = conversations.filter(c => isWaitingForConversationResponse(c)).length
  queryClient.setQueryData(queryKeys.conversations.waitingReplyCount(), count)
}
