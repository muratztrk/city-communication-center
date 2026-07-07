import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { api } from '../../api/client'
import type { WhatsAppMessagePayload } from '../../hooks/useSignalR'
import { useSignalR } from '../../hooks/useSignalR'
import type { CitizenConversationSummary } from '../../types/platform'
import { formatConversationDisplayContent } from '../../utils/socialConversationContent'
import { formatConversationListTime } from '../../utils/conversationListTime'
import { getLocale } from '../../utils/localization'
import { matchesPhone } from '../../utils/phoneNormalization'

const POLL_INTERVAL_MS = 12_000

type ActiveWhatsAppConversation = {
  id: string
  phone: string
} | null

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('90')) {
    return `+90 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`
  }
  return `+${digits}`
}

function formatBadgeCount(count: number) {
  if (count > 99) return '99+'
  return String(count)
}

export function WhatsAppNotificationFab() {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const navigate = useNavigate()
  const location = useLocation()
  const pulseTimerRef = useRef<number | null>(null)
  const [conversations, setConversations] = useState<CitizenConversationSummary[]>([])
  const [activeConversation, setActiveConversation] = useState<ActiveWhatsAppConversation>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isPulsing, setIsPulsing] = useState(false)

  const fetchConversations = useCallback(async () => {
    try {
      return await api.getCitizenConversations()
    } catch {
      return null
    }
  }, [])

  const refreshConversations = useCallback(async () => {
    const data = await fetchConversations()
    if (data) {
      setConversations(data)
    }
  }, [fetchConversations])

  const triggerPulse = useCallback(() => {
    setIsPulsing(true)
    if (pulseTimerRef.current) {
      window.clearTimeout(pulseTimerRef.current)
    }
    pulseTimerRef.current = window.setTimeout(() => {
      setIsPulsing(false)
      pulseTimerRef.current = null
    }, 1800)
  }, [])

  const isPayloadForActiveConversation = useCallback((payload: WhatsAppMessagePayload) => {
    if (location.pathname !== '/whatsapp' || !activeConversation) return false
    if (payload.citizenConversationId === activeConversation.id) return true
    return Boolean(activeConversation.phone) && matchesPhone(payload.citizenPhone, activeConversation.phone)
  }, [activeConversation, location.pathname])

  const zeroUnreadForConversation = useCallback((conversationId: string) => {
    setConversations(prev => prev.map(conversation => (
      conversation.citizenConversationId === conversationId
        ? { ...conversation, unreadCount: 0 }
        : conversation
    )))
  }, [])

  const handleWhatsAppMessage = useCallback((payload: WhatsAppMessagePayload) => {
    if (isPayloadForActiveConversation(payload)) {
      // Birim içi ileti bildirimi gönderenin açık konuşmasında okundu sayılmaz; diğer
      // ilgili kullanıcıların rozetini sıfırlamamak için markRead atlanır (card #1295).
      if (payload.isInternal || payload.isStatusUpdate) {
        void refreshConversations()
        return
      }
      void api.markConversationRead(payload.citizenConversationId)
        .then(() => zeroUnreadForConversation(payload.citizenConversationId))
        .catch(() => zeroUnreadForConversation(payload.citizenConversationId))
      return
    }

    void refreshConversations()
    triggerPulse()
  }, [isPayloadForActiveConversation, refreshConversations, triggerPulse, zeroUnreadForConversation])

  useSignalR({
    onWhatsAppMessage: handleWhatsAppMessage,
    onReconnected: refreshConversations,
  })

  useEffect(() => {
    let cancelled = false
    void fetchConversations().then(data => {
      if (!cancelled && data) {
        setConversations(data)
      }
    })
    return () => {
      cancelled = true
    }
  }, [fetchConversations, location.pathname])

  useEffect(() => {
    const onWindowEvent = (event: Event) => {
      const payload = (event as CustomEvent<WhatsAppMessagePayload>).detail
      if (isPayloadForActiveConversation(payload)) {
        if (payload.isInternal) {
          void refreshConversations()
          return
        }
        void api.markConversationRead(payload.citizenConversationId)
          .then(() => zeroUnreadForConversation(payload.citizenConversationId))
          .catch(() => zeroUnreadForConversation(payload.citizenConversationId))
        return
      }
      void refreshConversations()
      if (payload.isInternal || payload.unreadCount > 0) {
        triggerPulse()
      }
    }
    window.addEventListener('ccc:whatsapp-message', onWindowEvent)
    return () => window.removeEventListener('ccc:whatsapp-message', onWindowEvent)
  }, [isPayloadForActiveConversation, refreshConversations, triggerPulse, zeroUnreadForConversation])

  useEffect(() => {
    const onActiveConversationChange = (event: Event) => {
      const detail = (event as CustomEvent<{ citizenConversationId: string; citizenPhone: string } | null>).detail
      setActiveConversation(detail
        ? { id: detail.citizenConversationId, phone: detail.citizenPhone }
        : null)
    }
    window.addEventListener('ccc:whatsapp-active-conversation', onActiveConversationChange)
    return () => window.removeEventListener('ccc:whatsapp-active-conversation', onActiveConversationChange)
  }, [])

  useEffect(() => {
    if (document.visibilityState !== 'visible') return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshConversations()
      }
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [refreshConversations])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshConversations()
      }
    }
    const onFocus = () => {
      void refreshConversations()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshConversations])

  useEffect(() => () => {
    if (pulseTimerRef.current) {
      window.clearTimeout(pulseTimerRef.current)
    }
  }, [])

  const unreadConversations = useMemo(
    () => conversations
      .filter(conversation => {
        if (conversation.isRelevantToCurrentUser === false) return false
        // "BEKLEMEDE" durumunda gönderilmemiş giden mesaj varsa, okunmamış mesaj olmasa
        // bile bildirimde görünsün (card #1472).
        if (conversation.unreadCount <= 0 && !conversation.hasPendingOutboundMessage) return false
        if (location.pathname === '/whatsapp' && activeConversation) {
          if (conversation.citizenConversationId === activeConversation.id) return false
          if (activeConversation.phone && matchesPhone(conversation.citizenPhone, activeConversation.phone)) {
            return false
          }
        }
        return true
      })
      .sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()),
    [activeConversation, conversations, location.pathname],
  )

  const unreadTotal = useMemo(
    () => unreadConversations.reduce(
      (sum, conversation) => sum + Math.max(conversation.unreadCount, conversation.hasPendingOutboundMessage ? 1 : 0),
      0,
    ),
    [unreadConversations],
  )

  const hasRelevantConversation = useMemo(
    () => conversations.some(conversation => conversation.isRelevantToCurrentUser !== false),
    [conversations],
  )

  const shouldShowFab = useMemo(
    () => hasRelevantConversation || unreadTotal > 0,
    [hasRelevantConversation, unreadTotal],
  )

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    void fetchConversations().then(data => {
      if (!cancelled && data) {
        setConversations(data)
      }
    })
    return () => {
      cancelled = true
    }
  }, [isOpen, fetchConversations])

  const openConversation = (conversation: CitizenConversationSummary) => {
    setIsOpen(false)
    navigate(`/whatsapp?phone=${encodeURIComponent(conversation.citizenPhone)}`)
  }

  const badgeLabel = formatBadgeCount(unreadTotal)

  if (!shouldShowFab) {
    return null
  }

  return (
    <div className="relative size-14 shrink-0">
        {isOpen ? (
          <div className="absolute bottom-full right-0 mb-3 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[color:var(--color-background)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[#25D366]/10 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[color:var(--color-foreground)]">
                {t('whatsapp.notificationPanelTitle', 'WhatsApp Mesajları')}
              </p>
              <p className="text-xs text-[color:var(--color-muted-foreground)]">
                {unreadTotal > 0
                  ? t('whatsapp.notificationPanelSubtitle', '{{count}} okunmamış mesaj', { count: unreadTotal })
                  : t('whatsapp.notificationPanelEmptyHint', 'Yeni mesaj geldiğinde burada görünür.')}
              </p>
            </div>
            <button
              type="button"
              className="rounded-full p-1 text-[color:var(--color-muted-foreground)] transition-colors hover:bg-black/5 hover:text-[color:var(--color-foreground)]"
              aria-label={t('common.close', 'Kapat')}
              onClick={() => setIsOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {unreadConversations.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
                {t('whatsapp.notificationPanelEmpty', 'Okunmamış WhatsApp mesajı yok.')}
              </p>
            ) : unreadConversations.map(conversation => (
              <button
                key={conversation.citizenConversationId}
                type="button"
                onClick={() => openConversation(conversation)}
                className="flex w-full items-start gap-3 border-b border-[var(--color-border)]/70 px-4 py-3 text-left transition-colors hover:bg-slate-50"
              >
                <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15">
                  <img src="/icons/whatsapp.webp" alt="" className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-[color:var(--color-foreground)]">
                      {conversation.citizenName ?? formatPhone(conversation.citizenPhone)}
                    </p>
                    <span className="shrink-0 text-[11px] text-[color:var(--color-muted-foreground)]">
                      {formatConversationListTime(conversation.lastMessageAt, locale, t)}
                    </span>
                  </div>
                  {conversation.citizenName ? (
                    <p className="truncate text-xs text-[color:var(--color-muted-foreground)]">
                      {formatPhone(conversation.citizenPhone)}
                    </p>
                  ) : null}
                  {conversation.lastMessagePreview ? (
                    <p className="mt-1 line-clamp-2 text-xs text-[color:var(--color-muted-foreground)]">
                      {formatConversationDisplayContent(conversation.lastMessagePreview)}
                    </p>
                  ) : null}
                </div>
                <span className={`whatsapp-fab-badge mt-1 ${conversation.unreadCount > 9 ? 'whatsapp-fab-badge--wide' : ''}`}>
                  {formatBadgeCount(Math.max(conversation.unreadCount, conversation.hasPendingOutboundMessage ? 1 : 0))}
                </span>
              </button>
            ))}
          </div>

          <div className="border-t border-[var(--color-border)] bg-slate-50 px-4 py-2">
            <button
              type="button"
              className="text-xs font-semibold text-[color:var(--color-primary)] hover:underline"
              onClick={() => {
                setIsOpen(false)
                navigate('/whatsapp')
              }}
            >
              {t('whatsapp.openAllConversations', 'Tüm WhatsApp konuşmalarını aç')}
            </button>
          </div>
        </div>
        ) : null}

        <button
          type="button"
          aria-label={t('whatsapp.notificationFabLabel', 'WhatsApp bildirimleri')}
          title={t('whatsapp.notificationFabLabel', 'WhatsApp bildirimleri')}
          aria-expanded={isOpen}
          onClick={() => setIsOpen(current => !current)}
          className={`group relative flex size-14 cursor-pointer items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-shadow duration-300 hover:shadow-xl ${isPulsing ? 'whatsapp-fab-pulse' : ''} ${isOpen ? '' : 'transition-transform hover:scale-110 active:scale-95'}`}
        >
          <span className="absolute inset-0 rounded-full bg-[#25D366]/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden="true" />
          <img src="/icons/whatsapp-fab.png" alt="" className="relative size-8" aria-hidden="true" />
          {unreadTotal > 0 ? (
            <span className={`whatsapp-fab-badge pointer-events-none absolute -right-0.5 -top-0.5 ${badgeLabel.length > 1 ? 'whatsapp-fab-badge--wide' : ''}`}>
              {badgeLabel}
            </span>
          ) : null}
        </button>
    </div>
  )
}
