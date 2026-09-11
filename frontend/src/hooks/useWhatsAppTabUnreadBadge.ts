import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { applyWhatsAppTabBadge, clearWhatsAppTabBadge } from '../utils/whatsappTabBadge'
import { getWhatsAppUnreadMessageCount } from '../utils/whatsappUnreadMessageCount'

/** Vatandaş Talep Operatörü: sekmede yeni WA mesajı rozeti (#3531). */
export function useWhatsAppTabUnreadBadge(enabled: boolean): void {
  const queryClient = useQueryClient()
  const unreadQuery = useQuery({
    queryKey: queryKeys.conversations.unreadMessageCount(),
    queryFn: async () => {
      const conversations = await api.getCitizenConversations({ whatsAppOnly: true })
      return getWhatsAppUnreadMessageCount(conversations)
    },
    enabled,
    refetchInterval: 15_000,
    staleTime: 5_000,
  })
  const count = enabled ? (unreadQuery.data ?? 0) : 0

  useEffect(() => {
    if (!enabled) {
      clearWhatsAppTabBadge()
      return
    }
    applyWhatsAppTabBadge(count)
    return () => {
      clearWhatsAppTabBadge()
    }
  }, [count, enabled])

  useEffect(() => {
    if (!enabled) return
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.unreadMessageCount() })
    }
    window.addEventListener('ccc:whatsapp-message', invalidate)
    window.addEventListener('ccc:whatsapp-active-conversation', invalidate)
    return () => {
      window.removeEventListener('ccc:whatsapp-message', invalidate)
      window.removeEventListener('ccc:whatsapp-active-conversation', invalidate)
    }
  }, [enabled, queryClient])
}
