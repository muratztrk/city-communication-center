import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { api } from '../../api/client'
import type { WhatsAppMessagePayload } from '../../hooks/useSignalR'
import { useSignalR } from '../../hooks/useSignalR'
import type { CitizenConversationSummary } from '../../types/platform'
import { formatConversationDisplayContent } from '../../utils/socialConversationContent'
import { getLocale } from '../../utils/localization'

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('90')) {
    return `+90 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`
  }
  return `+${digits}`
}

function formatRelativeTime(dateStr: string, locale: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diffMin < 1) return locale.startsWith('tr') ? 'şimdi' : 'now'
  if (diffMin < 60) return locale.startsWith('tr') ? `${diffMin}d önce` : `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return locale.startsWith('tr') ? `${diffH}s önce` : `${diffH}h ago`
  return new Date(dateStr).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
}

function upsertConversation(
  current: CitizenConversationSummary[],
  payload: WhatsAppMessagePayload,
): CitizenConversationSummary[] {
  const existingIndex = current.findIndex(item => item.citizenConversationId === payload.citizenConversationId)
  const nextItem: CitizenConversationSummary = {
    citizenConversationId: payload.citizenConversationId,
    citizenPhone: payload.citizenPhone,
    citizenName: payload.citizenName,
    lastMessageAt: payload.lastMessageAt,
    unreadCount: payload.unreadCount,
    isBlocked: existingIndex >= 0 ? current[existingIndex].isBlocked : false,
    lastMessagePreview: payload.messagePreview,
    openTicketCount: existingIndex >= 0 ? current[existingIndex].openTicketCount : 0,
  }

  if (existingIndex >= 0) {
    return [
      nextItem,
      ...current.filter((_, index) => index !== existingIndex),
    ]
  }

  return [nextItem, ...current]
}

export function WhatsAppNotificationFab() {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const navigate = useNavigate()
  const location = useLocation()
  const panelRef = useRef<HTMLDivElement>(null)
  const [conversations, setConversations] = useState<CitizenConversationSummary[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isPulsing, setIsPulsing] = useState(false)

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await api.getCitizenConversations())
    } catch {
      // Keep the last known unread state if refresh fails.
    }
  }, [])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (location.pathname === '/whatsapp') {
      void loadConversations()
    }
  }, [location.pathname, location.search, loadConversations])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadConversations()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [loadConversations])

  const handleWhatsAppMessage = useCallback((payload: WhatsAppMessagePayload) => {
    setConversations(current => upsertConversation(current, payload))
    setIsPulsing(true)
    window.setTimeout(() => setIsPulsing(false), 1800)
  }, [])

  useSignalR({ onWhatsAppMessage: handleWhatsAppMessage })

  const unreadConversations = useMemo(
    () => conversations
      .filter(conversation => conversation.unreadCount > 0)
      .sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()),
    [conversations],
  )

  const unreadTotal = useMemo(
    () => unreadConversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0),
    [unreadConversations],
  )

  useEffect(() => {
    if (!isOpen) return
    void loadConversations()
    function handleClickOutside(event: MouseEvent) {
      if (!panelRef.current) return
      if (panelRef.current.contains(event.target as Node)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, loadConversations])

  const openConversation = (conversation: CitizenConversationSummary) => {
    setIsOpen(false)
    navigate(`/whatsapp?phone=${encodeURIComponent(conversation.citizenPhone)}`)
  }

  return (
    <div ref={panelRef} className="fixed bottom-6 right-5 z-[75]">
      {isOpen ? (
        <div className="mb-3 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[color:var(--color-background)] shadow-2xl">
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
                  <img src="/icons/whatsapp.svg" alt="" className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-[color:var(--color-foreground)]">
                      {conversation.citizenName ?? formatPhone(conversation.citizenPhone)}
                    </p>
                    <span className="shrink-0 text-[11px] text-[color:var(--color-muted-foreground)]">
                      {formatRelativeTime(conversation.lastMessageAt, locale)}
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
                <span className="mt-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[#25D366] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {conversation.unreadCount}
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
        onClick={() => setIsOpen(current => !current)}
        className={`group relative flex size-14 cursor-pointer items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl active:scale-95 ${isPulsing ? 'whatsapp-fab-pulse' : ''}`}
      >
        <span className="absolute inset-0 rounded-full bg-[#25D366]/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:scale-125" aria-hidden="true" />
        <img src="/icons/whatsapp.svg" alt="" className="relative size-7 brightness-0 invert" aria-hidden="true" />
        {unreadTotal > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-[1.35rem] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[11px] font-bold leading-none text-white">
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </span>
        ) : null}
      </button>
    </div>
  )
}
