import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import type { WhatsAppMessagePayload } from '../../hooks/useSignalR'
import { useSignalR } from '../../hooks/useSignalR'
import type { CitizenConversationSummary } from '../../types/platform'
import { formatConversationDisplayContent } from '../../utils/socialConversationContent'
import { formatConversationListTime } from '../../utils/conversationListTime'
import { getLocale } from '../../utils/localization'
import { formatBadgeCount } from '../../utils/formatScopeChipBadgeCount'
import { getWhatsAppFabUnreadCount, isAutomaticOutboundConversation } from '../../utils/whatsappFabNotification'
import { matchesPhone } from '../../utils/phoneNormalization'
import { WhatsAppConversationModal } from '../WhatsAppConversationModal'
import {
  notifyFloatingChatFabClosed,
  notifyFloatingChatFabOpened,
  subscribeFloatingChatFab,
} from '../../utils/floatingChatFabCoordinator'

const POLL_INTERVAL_MS = 12_000
const DISMISSED_STORAGE_PREFIX = 'ccc:whatsapp-notification-dismissed:'
const MAX_DISMISSED_NOTIFICATIONS = 200

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

function normalizeDisplayName(value?: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr')
}

function sameMessageTime(left?: string | null, right?: string | null): boolean {
  if (!left || !right) return false
  const leftTime = Date.parse(left)
  const rightTime = Date.parse(right)
  if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime)) return leftTime === rightTime
  return left === right
}

function getDismissedStorageKey(userId?: string | null): string {
  return `${DISMISSED_STORAGE_PREFIX}${userId ?? 'anonymous'}`
}

function readDismissedNotifications(storageKey: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    )
  } catch {
    return {}
  }
}

function persistDismissedNotifications(storageKey: string, next: Record<string, string>) {
  try {
    const compact = Object.fromEntries(Object.entries(next).slice(-MAX_DISMISSED_NOTIFICATIONS))
    window.localStorage.setItem(storageKey, JSON.stringify(compact))
    return compact
  } catch {
    return next
  }
}

export function WhatsAppNotificationFab() {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const pulseTimerRef = useRef<number | null>(null)
  const [conversations, setConversations] = useState<CitizenConversationSummary[]>([])
  const [activeConversation, setActiveConversation] = useState<ActiveWhatsAppConversation>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    return subscribeFloatingChatFab(kind => {
      if (kind === 'internal' && isOpen) setIsOpen(false)
    })
  }, [isOpen])

  const toggleOpen = useCallback(() => {
    setIsOpen(current => {
      const next = !current
      if (next) notifyFloatingChatFabOpened('whatsapp')
      else notifyFloatingChatFabClosed('whatsapp')
      return next
    })
  }, [])

  const closePanel = useCallback(() => {
    notifyFloatingChatFabClosed('whatsapp')
    setIsOpen(false)
  }, [])
  const [isPulsing, setIsPulsing] = useState(false)
  const dismissedStorageKey = useMemo(() => getDismissedStorageKey(user?.userId), [user?.userId])
  const currentUserDisplayName = useMemo(() => normalizeDisplayName(user?.displayName), [user?.displayName])
  const [dismissedNotifications, setDismissedNotifications] = useState<Record<string, string>>({})
  const [conversationModal, setConversationModal] = useState<{
    socialMessageId: string
    citizenHandle: string
    citizenPhone: string | null
    citizenName: string | null
  } | null>(null)

  // WhatsApp Konuşmaları sayfasını yalnızca Operatör/SistemYöneticisi yönetir; standart
  // kullanıcı bildirime bastığında sayfaya değil "Yazışmaya Git" modalına yönlenir (card #1477).
  const canManageConversations = useMemo(() => {
    const roles = [user?.role, ...(user?.additionalRoles ?? [])]
    return roles.includes('Operator') || roles.includes('SystemAdmin')
  }, [user])

  const fetchConversations = useCallback(async () => {
    try {
      return await api.getCitizenConversations({ whatsAppOnly: true })
    } catch {
      return null
    }
  }, [])

  // Poll, SignalR ve reconnect tetikleyicileri aynı anda birden fazla fetch başlatabiliyor;
  // sıra numarası olmadan geç dönen eski bir yanıt, konuşma okunduktan sonra gelip
  // unreadCount'u yanlışlıkla eski (okunmamış) haline geri döndürebiliyordu.
  const conversationsFetchSeqRef = useRef(0)
  const refreshConversations = useCallback(async () => {
    const seq = ++conversationsFetchSeqRef.current
    const data = await fetchConversations()
    if (data && conversationsFetchSeqRef.current === seq) {
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

  const rememberDismissedNotification = useCallback((conversationId: string, lastMessageAt?: string | null) => {
    if (!lastMessageAt) return
    setDismissedNotifications(prev => {
      const next = { ...prev, [conversationId]: lastMessageAt }
      return persistDismissedNotifications(dismissedStorageKey, next)
    })
  }, [dismissedStorageKey])

  // Konuşmalar bölümünde bir numaraya tıklayıp konuşma penceresi açıldığında, o numaradaki
  // tüm bildirimler kalıcı olarak temizlenir — sadece "aktif konuşma" filtresine değil,
  // localStorage'a da yazılır ki konuşma değiştirildikten sonra geri gelmesin (card #1515).
  const dismissNotificationsForPhone = useCallback((phone: string) => {
    if (!phone) return
    const matches = conversations.filter(conversation => matchesPhone(conversation.citizenPhone, phone))
    if (matches.length === 0) return
    setDismissedNotifications(prev => {
      const next = { ...prev }
      matches.forEach(conversation => {
        if (conversation.lastMessageAt) next[conversation.citizenConversationId] = conversation.lastMessageAt
      })
      return persistDismissedNotifications(dismissedStorageKey, next)
    })
    setConversations(prev => prev.map(conversation => (
      matchesPhone(conversation.citizenPhone, phone)
        ? { ...conversation, unreadCount: 0, hasPendingOutboundMessage: false }
        : conversation
    )))
  }, [conversations, dismissedStorageKey])

  // Bildirim çanından bir konuşmaya tıklandığında, sebebi ne olursa olsun (okunmamış mesaj
  // veya "BEKLEMEDE" giden mesaj) o konuşma bildirim listesinden hemen kaybolsun (card #1498).
  const dismissConversationNotification = useCallback((conversationId: string, lastMessageAt?: string | null) => {
    rememberDismissedNotification(conversationId, lastMessageAt)
    setConversations(prev => prev.map(conversation => (
      conversation.citizenConversationId === conversationId
        ? { ...conversation, unreadCount: 0, hasPendingOutboundMessage: false }
        : conversation
    )))
  }, [rememberDismissedNotification])

  const isSelfSentPayload = useCallback((payload: WhatsAppMessagePayload) =>
    Boolean(payload.senderUserId) && payload.senderUserId === user?.userId, [user])

  const handleWhatsAppMessage = useCallback((payload: WhatsAppMessagePayload) => {
    const selfSent = isSelfSentPayload(payload)
    if (selfSent) {
      dismissConversationNotification(payload.citizenConversationId, payload.lastMessageAt)
    }

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
    // Teslim durumu güncellemesi (operatörün kendi gönderdiği mesajın iletildi/okundu bilgisi)
    // ve kendi gönderdiğimiz birim içi mesaj bildirim/pulse tetiklemesin (card #1495).
    if (!payload.isStatusUpdate && !selfSent && !payload.isAutomaticOutbound) {
      triggerPulse()
    }
  }, [dismissConversationNotification, isPayloadForActiveConversation, isSelfSentPayload, refreshConversations, triggerPulse, zeroUnreadForConversation])

  useSignalR({
    onWhatsAppMessage: handleWhatsAppMessage,
    onReconnected: refreshConversations,
  })

  useEffect(() => {
    void refreshConversations()
  }, [refreshConversations, location.pathname])

  useEffect(() => {
    setDismissedNotifications(readDismissedNotifications(dismissedStorageKey))
  }, [dismissedStorageKey])

  useEffect(() => {
    const onWindowEvent = (event: Event) => {
      const payload = (event as CustomEvent<WhatsAppMessagePayload>).detail
      const selfSent = isSelfSentPayload(payload)
      if (selfSent) {
        dismissConversationNotification(payload.citizenConversationId, payload.lastMessageAt)
      }

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
      if (!payload.isStatusUpdate && !selfSent && !payload.isAutomaticOutbound && (payload.isInternal || payload.unreadCount > 0)) {
        triggerPulse()
      }
    }
    window.addEventListener('ccc:whatsapp-message', onWindowEvent)
    return () => window.removeEventListener('ccc:whatsapp-message', onWindowEvent)
  }, [dismissConversationNotification, isPayloadForActiveConversation, isSelfSentPayload, refreshConversations, triggerPulse, zeroUnreadForConversation])

  useEffect(() => {
    const onActiveConversationChange = (event: Event) => {
      const detail = (event as CustomEvent<{ citizenConversationId: string; citizenPhone: string } | null>).detail
      setActiveConversation(detail
        ? { id: detail.citizenConversationId, phone: detail.citizenPhone }
        : null)
      if (detail?.citizenPhone) {
        dismissNotificationsForPhone(detail.citizenPhone)
      }
    }
    window.addEventListener('ccc:whatsapp-active-conversation', onActiveConversationChange)
    return () => window.removeEventListener('ccc:whatsapp-active-conversation', onActiveConversationChange)
  }, [dismissNotificationsForPhone])

  useEffect(() => {
    const onComposerEngaged = (event: Event) => {
      const detail = (event as CustomEvent<{ citizenConversationId: string; citizenPhone?: string }>).detail
      if (!detail?.citizenConversationId) return
      const conversation = conversations.find(item => item.citizenConversationId === detail.citizenConversationId)
      dismissConversationNotification(detail.citizenConversationId, conversation?.lastMessageAt)
      if (detail.citizenPhone) {
        dismissNotificationsForPhone(detail.citizenPhone)
      }
    }
    window.addEventListener('ccc:whatsapp-composer-engaged', onComposerEngaged)
    return () => window.removeEventListener('ccc:whatsapp-composer-engaged', onComposerEngaged)
  }, [conversations, dismissConversationNotification, dismissNotificationsForPhone])

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
        if (isAutomaticOutboundConversation(conversation) && !conversation.hasPendingOutboundMessage) return false
        const dismissedAt = dismissedNotifications[conversation.citizenConversationId]
        if (sameMessageTime(dismissedAt, conversation.lastMessageAt)) return false
        // Son mesajı kendimiz yazdıysak (kurum içi ileti veya Beklemede yanıt) bildirimde görünmesin (card #1495/#1499).
        if (currentUserDisplayName
          && conversation.lastStaffSenderDisplayName
          && normalizeDisplayName(conversation.lastStaffSenderDisplayName) === currentUserDisplayName) return false
        // "BEKLEMEDE" durumunda gönderilmemiş giden mesaj varsa, okunmamış mesaj olmasa
        // bile bildirimde görünsün (card #1472).
        if (conversation.unreadCount <= 0 && !conversation.hasPendingOutboundMessage) return false
        const fabUnread = getWhatsAppFabUnreadCount(conversation)
        if (fabUnread <= 0 && !conversation.hasPendingOutboundMessage) return false
        if (location.pathname === '/whatsapp' && activeConversation) {
          if (conversation.citizenConversationId === activeConversation.id) return false
          if (activeConversation.phone && matchesPhone(conversation.citizenPhone, activeConversation.phone)) {
            return false
          }
        }
        return true
      })
      .sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()),
    [activeConversation, conversations, currentUserDisplayName, dismissedNotifications, location.pathname],
  )

  const unreadTotal = useMemo(
    () => unreadConversations.reduce(
      (sum, conversation) => sum + Math.max(
        getWhatsAppFabUnreadCount(conversation),
        conversation.hasPendingOutboundMessage ? 1 : 0,
      ),
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
    closePanel()
    // Tıklanan konuşmanın bildirimi anında kaybolsun; arka plandaki yenilemeyi beklemez (card #1477/#1498).
    dismissConversationNotification(conversation.citizenConversationId, conversation.lastMessageAt)
    void api.markConversationRead(conversation.citizenConversationId).catch(() => {})

    if (canManageConversations) {
      navigate(`/whatsapp?phone=${encodeURIComponent(conversation.citizenPhone)}`)
      return
    }

    if (conversation.latestSocialMessageId) {
      setConversationModal({
        socialMessageId: conversation.latestSocialMessageId,
        citizenHandle: conversation.citizenName ?? conversation.citizenPhone,
        citizenPhone: conversation.citizenPhone,
        citizenName: conversation.citizenName ?? null,
      })
      return
    }

    navigate(`/whatsapp?phone=${encodeURIComponent(conversation.citizenPhone)}`)
  }

  const clearPanelNotifications = useCallback(() => {
    setDismissedNotifications(prev => {
      const next = { ...prev }
      unreadConversations.forEach(conversation => {
        if (conversation.lastMessageAt) {
          next[conversation.citizenConversationId] = conversation.lastMessageAt
        }
      })
      return persistDismissedNotifications(dismissedStorageKey, next)
    })
    const ids = new Set(unreadConversations.map(conversation => conversation.citizenConversationId))
    setConversations(prev => prev.map(conversation => (
      ids.has(conversation.citizenConversationId)
        ? { ...conversation, unreadCount: 0, hasPendingOutboundMessage: false }
        : conversation
    )))
  }, [dismissedStorageKey, unreadConversations])

  const badgeLabel = formatBadgeCount(unreadTotal)

  if (!shouldShowFab) {
    return null
  }

  // Panelin sağ kenarı yanındaki FAB'lara göre CSS'te viewport sınırına hizalanır
  // (cards #1543/#1553); scroll FAB yalnız scroll varsa render edildiği için offset koşulludur.
  return (
    <div className="ccc-floating-fab relative size-12 shrink-0">
        {isOpen ? (
          <div className="whatsapp-notification-fab-panel absolute bottom-full z-20 mb-3 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[color:var(--color-background)] shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[#25D366]/10 px-4 py-3">
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
            <div className="flex shrink-0 flex-col items-center gap-1">
            <button
              type="button"
              className="rounded-full p-1 text-[color:var(--color-muted-foreground)] transition-colors hover:bg-black/5 hover:text-[color:var(--color-foreground)]"
              aria-label={t('common.close', 'Kapat')}
              onClick={closePanel}
            >
              <X className="size-4" />
            </button>
            {unreadConversations.length > 0 ? (
              <button
                type="button"
                className="max-w-[6.5rem] cursor-pointer text-center text-[10px] font-semibold leading-tight text-[color:var(--color-primary)] transition-colors hover:text-[#128C7E] hover:underline"
                onClick={clearPanelNotifications}
              >
                {t('whatsapp.clearNotifications', 'Bildirimi Temizle')}
              </button>
            ) : null}
            </div>
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
                      {conversation.lastStaffSenderDepartment
                        ?? conversation.citizenName
                        ?? formatPhone(conversation.citizenPhone)}
                    </p>
                    <span className="shrink-0 text-[11px] text-[color:var(--color-muted-foreground)]">
                      {formatConversationListTime(conversation.lastMessageAt, locale, t)}
                    </span>
                  </div>
                  {conversation.lastStaffSenderDepartment ? (
                    conversation.lastStaffSenderDisplayName ? (
                      <p className="truncate text-xs text-[color:var(--color-muted-foreground)]">
                        {conversation.lastStaffSenderDisplayName}
                      </p>
                    ) : null
                  ) : conversation.citizenName ? (
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
                  {formatBadgeCount(Math.max(getWhatsAppFabUnreadCount(conversation), conversation.hasPendingOutboundMessage ? 1 : 0))}
                </span>
              </button>
            ))}
          </div>

          <div className="border-t border-[var(--color-border)] bg-slate-50 px-4 py-2">
            <button
              type="button"
              className="text-xs font-semibold text-[color:var(--color-primary)] hover:underline"
              onClick={() => {
                closePanel()
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
          onClick={toggleOpen}
          className={`ccc-floating-fab-btn group relative flex size-12 cursor-pointer items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-shadow duration-300 hover:shadow-xl ${isPulsing ? 'whatsapp-fab-pulse' : ''} ${isOpen ? '' : 'transition-transform hover:scale-110 active:scale-95'}`}
        >
          <span className="absolute inset-0 rounded-full bg-[#25D366]/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden="true" />
          <img src="/icons/whatsapp-fab.png" alt="" className="ccc-floating-fab-icon relative size-6" aria-hidden="true" />
          {unreadTotal > 0 ? (
            <span className={`whatsapp-fab-badge pointer-events-none absolute -right-0.5 -top-0.5 ${badgeLabel.length > 1 ? 'whatsapp-fab-badge--wide' : ''}`}>
              {badgeLabel}
            </span>
          ) : null}
        </button>

        {conversationModal && (
          <WhatsAppConversationModal
            socialMessageId={conversationModal.socialMessageId}
            citizenHandle={conversationModal.citizenHandle}
            citizenPhone={conversationModal.citizenPhone}
            citizenName={conversationModal.citizenName}
            onClose={() => setConversationModal(null)}
          />
        )}
    </div>
  )
}
