import { useEffect, useRef } from 'react'
import type { CitizenConversationSummary } from '../types/platform'
import { playNewRecordSound } from '../utils/playNewRecordSound'
import { shouldPlayNewRecordSound } from '../utils/shouldPlayNewRecordSound'

/** WhatsApp listesinde yeni konuşma veya inbound mesaj (poll) için ses (#3390). */
export function useWhatsAppConversationActivitySound(
  conversations: CitizenConversationSummary[],
  ready = true,
): void {
  const baselineSetRef = useRef(false)
  const previousRef = useRef<Map<string, { lastMessageAt: string; lastMessageDirection?: 'Inbound' | 'Outbound' | null }>>(new Map())

  useEffect(() => {
    if (!ready) return

    const previous = previousRef.current
    let shouldPlay = false

    if (baselineSetRef.current) {
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
    baselineSetRef.current = true

    if (shouldPlay && shouldPlayNewRecordSound(true)) {
      playNewRecordSound()
    }
  }, [conversations, ready])
}
