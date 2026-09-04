import { useEffect, useRef } from 'react'
import type { CitizenConversationSummary } from '../types/platform'
import { playNewRecordSound } from '../utils/playNewRecordSound'

/** WhatsApp listesinde yeni konuşma veya inbound mesaj (poll) için ses (#3390). */
export function useWhatsAppConversationActivitySound(conversations: CitizenConversationSummary[]): void {
  const initializedRef = useRef(false)
  const previousRef = useRef<Map<string, { lastMessageAt: string; lastMessageDirection?: 'Inbound' | 'Outbound' | null }>>(new Map())

  useEffect(() => {
    const previous = previousRef.current
    let shouldPlay = false

    if (initializedRef.current) {
      for (const conversation of conversations) {
        const prior = previous.get(conversation.citizenConversationId)
        if (!prior) {
          shouldPlay = true
          break
        }
        if (
          conversation.lastMessageAt > prior.lastMessageAt
          && conversation.lastMessageDirection === 'Inbound'
        ) {
          shouldPlay = true
          break
        }
      }
    }

    previousRef.current = new Map(
      conversations.map(conversation => [
        conversation.citizenConversationId,
        {
          lastMessageAt: conversation.lastMessageAt,
          lastMessageDirection: conversation.lastMessageDirection,
        },
      ]),
    )
    initializedRef.current = true

    if (shouldPlay && document.visibilityState === 'visible') {
      playNewRecordSound()
    }
  }, [conversations])
}
