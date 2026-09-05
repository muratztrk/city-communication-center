import { useEffect, useRef } from 'react'
import type { WhatsAppMessagePayload } from './useSignalR'
import { useAuth } from '../context/AuthContext'
import { playNewRecordSound } from '../utils/playNewRecordSound'
import { shouldPlayNewRecordSound } from '../utils/shouldPlayNewRecordSound'

/** Her inbound WA mesajında (konuşma zaten yanıt bekliyor olsa bile) bir kez ses (#3390). */
export function useWhatsAppInboundMessageSound(): void {
  const { user } = useAuth()
  const lastPlayedAtByConversationRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    const onMessage = (event: Event) => {
      const payload = (event as CustomEvent<WhatsAppMessagePayload>).detail
      const selfSent = Boolean(payload.senderUserId) && payload.senderUserId === user?.userId
      if (payload.isStatusUpdate || selfSent || payload.isAutomaticOutbound) return
      const isCitizenInbound = !payload.isInternal
      const isInternalUnread = payload.isInternal && payload.unreadCount > 0
      if (!isCitizenInbound && !isInternalUnread) return
      if (!payload.lastMessageAt) return

      const previousAt = lastPlayedAtByConversationRef.current.get(payload.citizenConversationId)
      if (previousAt === payload.lastMessageAt) return
      if (previousAt && new Date(payload.lastMessageAt).getTime() <= new Date(previousAt).getTime()) return

      lastPlayedAtByConversationRef.current.set(payload.citizenConversationId, payload.lastMessageAt)
      if (shouldPlayNewRecordSound(true)) {
        playNewRecordSound()
      }
    }

    window.addEventListener('ccc:whatsapp-message', onMessage)
    return () => window.removeEventListener('ccc:whatsapp-message', onMessage)
  }, [user?.userId])
}
