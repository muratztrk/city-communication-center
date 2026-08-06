import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCheck, Search, Send, X } from 'lucide-react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import {
  ensureSignalRConnected,
  useSignalR,
  type InternalMessagePayload,
  type InternalMessageTypingPayload,
  type SignalRConnectionState,
} from '../../hooks/useSignalR'
import type { InternalConversationDetail, InternalConversationSummary, InternalMessage, UserLookup } from '../../types/platform'
import { formatConversationListTime, formatConversationMessageTime } from '../../utils/conversationListTime'
import { getLocale } from '../../utils/localization'
import { TablePagination } from '../ui/table-pagination'

const CONNECTED_POLL_INTERVAL_MS = 15_000
const DISCONNECTED_POLL_INTERVAL_MS = 3_000
const OPEN_CHAT_POLL_INTERVAL_MS = 1_000
const PAGE_SIZE = 10
const TYPING_NOTIFY_DEBOUNCE_MS = 350
const TYPING_INDICATOR_TTL_MS = 3_000
const TYPING_HEARTBEAT_MS = 2_000

function normalizeUserId(userId: string) {
  return userId.trim().toLowerCase()
}

interface MessageRow {
  otherUserId: string
  displayName: string
  departmentName: string | null
  /** Ünvan — birimin altında ayrı satır (#r505/#r506). */
  title: string | null
  /** Personel aramasında gösterilir; konuşma listesinde yok (#r504). */
  phone: string | null
  internalConversationId: string | null
  lastMessagePreview: string | null
  lastMessageAtUtc: string | null
  lastMessageSenderUserId: string | null
  unreadCount: number
}

function toRow(conversation: InternalConversationSummary): MessageRow {
  return {
    otherUserId: conversation.otherUserId,
    displayName: conversation.otherUserDisplayName,
    departmentName: conversation.otherUserDepartmentName,
    title: conversation.otherUserTitle?.trim() || null,
    phone: null,
    internalConversationId: conversation.internalConversationId,
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageAtUtc: conversation.lastMessageAtUtc,
    lastMessageSenderUserId: conversation.lastMessageSenderUserId,
    unreadCount: conversation.unreadCount,
  }
}

function formatBadgeCount(count: number) {
  return count > 99 ? '99+' : String(count)
}

function areConversationDetailsEqual(left: InternalConversationDetail | null, right: InternalConversationDetail) {
  if (!left
    || left.internalConversationId !== right.internalConversationId
    || left.otherUserId !== right.otherUserId
    || left.otherUserDisplayName !== right.otherUserDisplayName
    || left.otherUserDepartmentName !== right.otherUserDepartmentName
    || left.otherUserTitle !== right.otherUserTitle
    || left.messages.length !== right.messages.length) {
    return false
  }

  return left.messages.every((message, index) => {
    const nextMessage = right.messages[index]
    return message.internalMessageId === nextMessage.internalMessageId
      && message.senderUserId === nextMessage.senderUserId
      && message.content === nextMessage.content
      && message.createdAtUtc === nextMessage.createdAtUtc
      && message.readAtUtc === nextMessage.readAtUtc
  })
}

function getInitials(displayName: string) {
  // Telefon / tire parçalarını atla — "Ramazan Amaç – 1122" → RA (R421).
  const parts = displayName
    .trim()
    .split(/[\s–—-]+/)
    .map(part => part.trim())
    .filter(part => part.length > 0 && /[^\d]/.test(part) && !/^\d+$/.test(part))
  if (parts.length === 0) return '—'
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? (parts[1]?.[0] ?? '') : ''
  return `${first}${second}`.toLocaleUpperCase('tr')
}

function isSameCalendarDay(left: string, right: string) {
  const a = new Date(left)
  const b = new Date(right)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatMessageDay(dateUtc: string, locale: string) {
  return new Date(dateUtc).toLocaleDateString(locale, { day: 'numeric', month: 'long' })
}

function InternalMessagesIcon() {
  return (
    <svg viewBox="0 0 50 48" className="relative size-6" aria-hidden="true">
      <path
        d="M10 7h28c6 0 10 4 10 10v12c0 6-4 10-10 10h-5l9 7-16-7H10C4 39 1 35 1 29V17C1 11 4 7 10 7Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  )
}

export function InternalMessagesFab() {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const { user } = useAuth()
  const currentUserId = user?.userId ?? null

  const [isOpen, setIsOpen] = useState(false)
  const [conversations, setConversations] = useState<InternalConversationSummary[]>([])
  const [search, setSearch] = useState('')
  const [userResults, setUserResults] = useState<UserLookup[]>([])
  const [listFilter, setListFilter] = useState<'all' | 'waiting'>('all')
  const [page, setPage] = useState(1)
  const [activeChat, setActiveChat] = useState<{
    otherUserId: string
    displayName: string
    departmentName: string | null
    title: string | null
  } | null>(null)
  const [chatDetail, setChatDetail] = useState<InternalConversationDetail | null>(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [otherUserTyping, setOtherUserTyping] = useState(false)
  const [signalRState, setSignalRState] = useState<SignalRConnectionState>('disconnected')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const typingNotifyTimerRef = useRef<number | null>(null)
  const typingHeartbeatTimerRef = useRef<number | null>(null)
  const typingActiveRef = useRef(false)
  const otherTypingTimerRef = useRef<number | null>(null)

  const refreshConversations = useCallback(async () => {
    try {
      const data = await api.getInternalConversations()
      setConversations(data)
    } catch {
      // sessizce geç — bir sonraki poll'da tekrar denenir
    }
  }, [])

  useEffect(() => {
    void refreshConversations()
  }, [refreshConversations])

  useEffect(() => {
    const pollInterval = signalRState === 'connected'
      ? CONNECTED_POLL_INTERVAL_MS
      : DISCONNECTED_POLL_INTERVAL_MS
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshConversations()
    }, pollInterval)
    return () => window.clearInterval(timer)
  }, [refreshConversations, signalRState])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      void ensureSignalRConnected()
      void refreshConversations()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refreshConversations])

  const openConversationById = useCallback(async (conversationId: string) => {
    try {
      await api.markInternalConversationRead(conversationId)
      setConversations(prev => prev.map(c => (c.internalConversationId === conversationId ? { ...c, unreadCount: 0 } : c)))
    } catch {
      // yoksay
    }
  }, [])

  const loadChat = useCallback(async (otherUserId: string) => {
    setChatLoading(true)
    try {
      const detail = await api.getInternalConversationWithUser(otherUserId)
      setChatDetail(detail)
      setActiveChat(current => current && current.otherUserId === otherUserId
        ? {
            ...current,
            displayName: detail.otherUserDisplayName || current.displayName,
            departmentName: detail.otherUserDepartmentName ?? current.departmentName,
            title: detail.otherUserTitle?.trim() || current.title,
          }
        : current)
      if (detail.internalConversationId) {
        void openConversationById(detail.internalConversationId)
      }
    } catch {
      setChatDetail(null)
    } finally {
      setChatLoading(false)
    }
  }, [openConversationById])

  const handleInternalMessage = useCallback((payload: InternalMessagePayload) => {
    if (!payload.isReadReceipt && payload.senderUserId === activeChat?.otherUserId) {
      setOtherUserTyping(false)
    }

    // Rozet, API yanıtını beklemeden anında güncellenir (card #1608): konuşma listedeyse
    // unreadCount iyimser artırılır; refreshConversations hemen ardından sunucu doğrusunu getirir.
    // Açık sohbetin mesajı loadChat/markRead ile zaten okunacağı için artırılmaz.
    if (!payload.isReadReceipt
      && payload.senderUserId !== currentUserId
      && chatDetail?.internalConversationId !== payload.internalConversationId) {
      setConversations(prev => prev.map(conversation =>
        conversation.internalConversationId === payload.internalConversationId
          ? {
              ...conversation,
              unreadCount: conversation.unreadCount + 1,
              lastMessagePreview: payload.messagePreview,
              lastMessageSenderUserId: payload.senderUserId,
              lastMessageAtUtc: payload.createdAtUtc,
            }
          : conversation))
    }

    void refreshConversations()

    if (payload.isReadReceipt) {
      setChatDetail(current => {
        if (!currentUserId || current?.internalConversationId !== payload.internalConversationId) return current

        let changed = false
        const messages = current.messages.map(message => {
          if (message.senderUserId !== currentUserId || message.readAtUtc) return message
          changed = true
          return { ...message, readAtUtc: payload.createdAtUtc }
        })

        return changed ? { ...current, messages } : current
      })
      return
    }

    if (activeChat) {
      void loadChat(activeChat.otherUserId)
    }
  }, [activeChat, chatDetail?.internalConversationId, currentUserId, loadChat, refreshConversations])

  const handleInternalMessageTyping = useCallback((payload: InternalMessageTypingPayload) => {
    if (!activeChat || normalizeUserId(payload.senderUserId) !== normalizeUserId(activeChat.otherUserId)) return
    if (payload.isTyping) {
      setOtherUserTyping(true)
      if (otherTypingTimerRef.current) window.clearTimeout(otherTypingTimerRef.current)
      otherTypingTimerRef.current = window.setTimeout(() => {
        setOtherUserTyping(false)
      }, TYPING_INDICATOR_TTL_MS)
      return
    }
    setOtherUserTyping(false)
  }, [activeChat])

  const notifyTyping = useCallback((isTyping: boolean, force = false) => {
    if (!activeChat) return
    if (!force && typingActiveRef.current === isTyping) return
    typingActiveRef.current = isTyping
    void api.notifyInternalMessageTyping(activeChat.otherUserId, isTyping).catch(() => {
      // sessizce geç — gösterge kritik değil
    })
  }, [activeChat])

  const clearTypingHeartbeat = useCallback(() => {
    if (typingHeartbeatTimerRef.current) {
      window.clearInterval(typingHeartbeatTimerRef.current)
      typingHeartbeatTimerRef.current = null
    }
  }, [])

  const startTypingHeartbeat = useCallback(() => {
    clearTypingHeartbeat()
    typingHeartbeatTimerRef.current = window.setInterval(() => {
      notifyTyping(true, true)
    }, TYPING_HEARTBEAT_MS)
  }, [clearTypingHeartbeat, notifyTyping])

  useSignalR({
    onInternalMessage: handleInternalMessage,
    onInternalMessageTyping: handleInternalMessageTyping,
    onReconnected: refreshConversations,
    onConnectionStateChange: setSignalRState,
  })

  useEffect(() => {
    if (!activeChat) {
      setOtherUserTyping(false)
      typingActiveRef.current = false
      clearTypingHeartbeat()
      return
    }

    if (!draft.trim()) {
      if (typingNotifyTimerRef.current) window.clearTimeout(typingNotifyTimerRef.current)
      clearTypingHeartbeat()
      notifyTyping(false)
      return
    }

    if (typingNotifyTimerRef.current) window.clearTimeout(typingNotifyTimerRef.current)
    typingNotifyTimerRef.current = window.setTimeout(() => {
      notifyTyping(true)
      startTypingHeartbeat()
    }, TYPING_NOTIFY_DEBOUNCE_MS)

    return () => {
      if (typingNotifyTimerRef.current) window.clearTimeout(typingNotifyTimerRef.current)
    }
  }, [activeChat, clearTypingHeartbeat, draft, notifyTyping, startTypingHeartbeat])

  useEffect(() => () => {
    if (otherTypingTimerRef.current) window.clearTimeout(otherTypingTimerRef.current)
    if (typingNotifyTimerRef.current) window.clearTimeout(typingNotifyTimerRef.current)
    clearTypingHeartbeat()
  }, [clearTypingHeartbeat])

  useEffect(() => {
    if (!isOpen || !activeChat) return

    let cancelled = false
    let refreshing = false
    const refreshOpenChat = async () => {
      if (refreshing || document.visibilityState !== 'visible') return

      refreshing = true
      try {
        const detail = await api.getInternalConversationWithUser(activeChat.otherUserId)
        if (cancelled) return

        setChatDetail(current => areConversationDetailsEqual(current, detail) ? current : detail)
        if (currentUserId
          && detail.internalConversationId
          && detail.messages.some(message => message.senderUserId !== currentUserId && !message.readAtUtc)) {
          void openConversationById(detail.internalConversationId)
        }
      } catch {
        // SignalR yeniden bağlanırken açık konuşma bir sonraki kısa poll'da tekrar eşitlenir.
      } finally {
        refreshing = false
      }
    }

    const timer = window.setInterval(() => {
      void refreshOpenChat()
    }, OPEN_CHAT_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeChat, currentUserId, isOpen, openConversationById])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chatDetail])

  // Arama en az 3 karakter; personel adına contains (TR); 300ms debounce (card #1812).
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed.length < 3) {
      setUserResults([])
      return
    }
    const timer = window.setTimeout(() => {
      void api.searchUsers(trimmed).then(setUserResults).catch(() => setUserResults([]))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const rows = useMemo<MessageRow[]>(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr')
    if (!normalizedSearch || normalizedSearch.length < 3) {
      return conversations.map(toRow)
    }
    const merged = new Map<string, MessageRow>()
    conversations
      .filter(c => c.otherUserDisplayName.toLocaleLowerCase('tr').includes(normalizedSearch))
      .forEach(c => merged.set(c.otherUserId, toRow(c)))
    userResults
      .filter(u => u.userId !== currentUserId)
      .forEach(u => {
        const existing = merged.get(u.userId)
        if (existing) {
          // Konuşma satırına dahili + ünvan bilgisini ekle (#r504/#r505).
          merged.set(u.userId, {
            ...existing,
            phone: u.phone?.trim() || existing.phone,
            title: u.title?.trim() || existing.title,
            departmentName: existing.departmentName || u.departmentName || null,
          })
          return
        }
        merged.set(u.userId, {
          otherUserId: u.userId,
          displayName: u.displayName,
          departmentName: u.departmentName || null,
          title: u.title?.trim() || null,
          phone: u.phone?.trim() || null,
          internalConversationId: null,
          lastMessagePreview: null,
          lastMessageAtUtc: null,
          lastMessageSenderUserId: null,
          unreadCount: 0,
        })
      })
    return Array.from(merged.values())
  }, [conversations, currentUserId, search, userResults])

  const filteredRows = useMemo(() => {
    const base = listFilter === 'waiting'
      ? rows.filter(row => row.lastMessageSenderUserId != null && row.lastMessageSenderUserId !== currentUserId)
      : rows
    return base.sort((a, b) => {
      if (!a.lastMessageAtUtc && !b.lastMessageAtUtc) return a.displayName.localeCompare(b.displayName, 'tr')
      if (!a.lastMessageAtUtc) return 1
      if (!b.lastMessageAtUtc) return -1
      return new Date(b.lastMessageAtUtc).getTime() - new Date(a.lastMessageAtUtc).getTime()
    })
  }, [currentUserId, listFilter, rows])

  const totalUnread = useMemo(() => conversations.reduce((sum, c) => sum + c.unreadCount, 0), [conversations])

  const currentPage = Math.min(page, Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE)))
  const pagedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const isPersonnelSearch = search.trim().length >= 3
  const missingExtensionLabel = t('search.extensionMissing', 'Dahili No Yok')

  const openRow = (row: MessageRow) => {
    setActiveChat({
      otherUserId: row.otherUserId,
      displayName: row.displayName,
      departmentName: row.departmentName,
      title: row.title,
    })
    setChatDetail(null)
    if (row.internalConversationId) {
      void openConversationById(row.internalConversationId)
    }
    void loadChat(row.otherUserId)
  }

  const closePanel = () => {
    notifyTyping(false)
    clearTypingHeartbeat()
    setIsOpen(false)
    setActiveChat(null)
    setChatDetail(null)
    setSearch('')
    setDraft('')
    setOtherUserTyping(false)
  }

  const handleSend = async () => {
    const content = draft.trim()
    if (!content || !activeChat || sending) return
    setSending(true)
    try {
      notifyTyping(false)
      clearTypingHeartbeat()
      await api.sendInternalMessage(activeChat.otherUserId, content)
      setDraft('')
      await loadChat(activeChat.otherUserId)
      void refreshConversations()
    } catch {
      // hata durumunda draft korunur, kullanıcı tekrar deneyebilir
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="ccc-floating-fab internal-messages-fab relative size-12 shrink-0">
      {isOpen ? (
        <div className="internal-messages-fab-panel absolute bottom-full right-0 z-10 mb-3 flex h-[min(78dvh,48rem)] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[color:var(--color-background)] shadow-2xl sm:h-[min(66dvh,42rem)]">
          <div className={`flex items-start justify-between gap-2 border-b border-[var(--color-border)] bg-emerald-700/10 py-3 pr-4 ${activeChat ? 'pl-3' : 'pl-4'}`}>
            {activeChat ? (
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      notifyTyping(false)
                      clearTypingHeartbeat()
                      setActiveChat(null)
                      setChatDetail(null)
                      setOtherUserTyping(false)
                    }}
                    className="inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-[10px] font-bold leading-none text-teal-700 transition-colors hover:bg-teal-50 hover:text-teal-800"
                    aria-label={t('common.back', 'Geri')}
                  >
                    <span aria-hidden="true" className="text-xs leading-none">←</span>
                    <span>{t('common.back', 'Geri')}</span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-right text-[10px] font-semibold text-teal-700">
                      {t('internalMessages.panelTitle', 'Kurum İçi Mesajlar')}
                    </span>
                    <button
                      type="button"
                      className="rounded-full p-1 text-[color:var(--color-muted-foreground)] transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label={t('common.close', 'Kapat')}
                      onClick={closePanel}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="flex min-w-0 items-start gap-1.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">
                    {getInitials(activeChat.displayName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold leading-tight text-[color:var(--color-foreground)]">{activeChat.displayName}</p>
                    {/* Tam panel genişliği — sağ etiket üst satırda; truncate yok (#r510). */}
                    <p className="mt-0.5 break-words text-xs leading-snug text-[color:var(--color-muted-foreground)]">
                      {activeChat.departmentName?.trim() || '—'}
                      {activeChat.title?.trim() ? (
                        <>
                          {' - '}
                          <span className="font-mono text-slate-500">{activeChat.title.trim()}</span>
                        </>
                      ) : null}
                    </p>
                    {otherUserTyping ? (
                      <div className="internal-messages-typing-indicator mt-1" role="status" aria-live="polite">
                        <span>{t('internalMessages.typing', 'Yazıyor')}</span>
                        <span className="internal-messages-typing-dots" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex min-w-0 flex-1 items-start">
                  <p className="truncate text-sm font-bold text-[color:var(--color-foreground)]">{t('internalMessages.panelTitle', 'Kurum İçi Mesajlar')}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full p-1 text-[color:var(--color-muted-foreground)] transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label={t('common.close', 'Kapat')}
                  onClick={closePanel}
                >
                  <X className="size-4" />
                </button>
              </>
            )}
          </div>

          {activeChat ? (
            <>
              <div ref={scrollRef} className="whatsapp-chat-bg min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {chatLoading && !chatDetail ? (
                  <p className="mt-8 text-center text-sm text-slate-400">{t('common.loading')}</p>
                ) : (chatDetail?.messages.length ?? 0) === 0 ? (
                  <p className="mt-8 text-center text-sm text-slate-400">
                    {t('internalMessages.noMessages', 'Henüz mesaj yok. İlk mesajı gönderin.')}
                  </p>
                ) : (
                  chatDetail?.messages.map((message: InternalMessage, index) => {
                    const isMine = message.senderUserId === currentUserId
                    const senderName = isMine ? (user?.displayName ?? '—') : activeChat.displayName
                    const senderDepartment = isMine ? (user?.departmentName ?? '—') : (activeChat.departmentName ?? '—')
                    const showDaySeparator = index === 0 || !isSameCalendarDay(chatDetail.messages[index - 1].createdAtUtc, message.createdAtUtc)
                    return (
                      <div key={message.internalMessageId}>
                        {showDaySeparator ? (
                          <div className="my-3 flex justify-center">
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                              {formatMessageDay(message.createdAtUtc, locale)}
                            </span>
                          </div>
                        ) : null}
                        <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[min(72%,28rem)] rounded-xl px-2.5 py-1.5 text-xs leading-snug shadow-sm ${
                              isMine ? 'rounded-tr-sm bg-emerald-700 text-white ring-1 ring-white/10' : 'rounded-tl-sm bg-white text-slate-800 ring-1 ring-black/[0.04]'
                            }`}
                          >
                            <p className={`mb-0.5 text-[11px] font-semibold leading-snug ${isMine ? 'text-white/90' : 'text-slate-900'}`}>
                              {senderName} <span className="mx-0.5 inline-block size-[2px] translate-y-[-0.08em] rounded-full bg-current align-middle opacity-70" aria-hidden="true" /> {senderDepartment}
                            </p>
                            <p className="whitespace-pre-wrap break-words text-xs leading-snug">{message.content}</p>
                            <p className={`mt-0.5 flex items-center justify-end gap-1 text-[9px] ${isMine ? 'text-emerald-100' : 'text-slate-400'}`}>
                              {isMine ? (
                                <span className={`inline-flex items-center gap-0.5 ${message.readAtUtc ? 'text-sky-300' : 'text-emerald-100'}`}>
                                  <CheckCheck className="size-3" aria-hidden="true" />
                                  <span>{message.readAtUtc ? 'Okundu' : 'İletildi'}</span>
                                  <span className="mx-0.5 inline-block size-[2px] rounded-full bg-current align-middle opacity-70" aria-hidden="true" />
                                </span>
                              ) : null}
                              <span>{formatConversationMessageTime(message.createdAtUtc, locale, t)}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2 border-t border-[var(--color-border)] bg-white px-3 py-2.5">
                <input
                  type="text"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleSend()
                    }
                  }}
                  placeholder={t('internalMessages.messagePlaceholder', 'Mesaj yazın...')}
                  className="field-input flex-1 py-2 text-sm"
                  disabled={sending}
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending || !draft.trim()}
                  aria-label={t('common.send', 'Gönder')}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="shrink-0 space-y-2 border-b border-slate-100 bg-[color:var(--color-background)] px-3 pb-2 pt-2.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" aria-hidden="true" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => { setPage(1); setSearch(e.target.value) }}
                    placeholder={t('internalMessages.searchPlaceholder', 'Personel adı...')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600/40 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => { setPage(1); setSearch('') }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:text-slate-600"
                      aria-label={t('common.clear', 'Temizle')}
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setPage(1); setListFilter('all') }}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      listFilter === 'all' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {t('whatsapp.listFilter.all', 'Tümü')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPage(1); setListFilter('waiting') }}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      listFilter === 'waiting' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {t('internalMessages.waitingFilter', 'Yanıt Bekliyor')}
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--color-background)]">
                {pagedRows.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">
                    {search
                      ? t('internalMessages.noSearchResults', 'Eşleşen personel bulunamadı.')
                      : t('internalMessages.noConversations', 'Henüz kurum içi mesajınız yok.')}
                  </p>
                ) : pagedRows.map(row => {
                  const isWaiting = row.lastMessageSenderUserId != null && row.lastMessageSenderUserId !== currentUserId
                  const hasStatus = Boolean(row.lastMessageAtUtc)
                  return (
                    <button
                      key={row.otherUserId}
                      type="button"
                      onClick={() => openRow(row)}
                      className="flex w-full items-start gap-3 border-b border-[var(--color-border)]/70 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="relative mt-0.5 shrink-0">
                        <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                          {getInitials(row.displayName)}
                        </div>
                        {hasStatus ? (
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-white ${
                              isWaiting ? 'bg-orange-400' : 'bg-emerald-500'
                            }`}
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-[color:var(--color-foreground)]">
                            {isPersonnelSearch
                              ? `${row.displayName} - ${row.phone?.trim() || missingExtensionLabel}`
                              : row.displayName}
                          </p>
                          {row.lastMessageAtUtc ? (
                            <span className="shrink-0 text-[11px] text-[color:var(--color-muted-foreground)]">
                              {formatConversationListTime(row.lastMessageAtUtc, locale, t)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-[color:var(--color-muted-foreground)]">
                              {row.departmentName?.trim() || '—'}
                            </p>
                            {row.title?.trim() ? (
                              <p className="truncate font-mono text-xs text-slate-500">
                                {row.title.trim()}
                              </p>
                            ) : null}
                          </div>
                          {hasStatus ? (
                            <span className={`inline-flex shrink-0 items-center gap-1 pt-0.5 text-[10px] font-semibold ${isWaiting ? 'text-orange-700' : 'text-emerald-700'}`}>
                              <span className={`size-1.5 rounded-full ${isWaiting ? 'bg-orange-500' : 'bg-emerald-500'}`} aria-hidden="true" />
                              {isWaiting
                                ? t('internalMessages.waitingReply', 'Yanıt bekliyor')
                                : t('internalMessages.replied', 'Yanıt verildi')}
                            </span>
                          ) : null}
                        </div>
                        {row.lastMessagePreview ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{row.lastMessagePreview}</p>
                        ) : null}
                      </div>
                      {row.unreadCount > 0 ? (
                        <span className="whatsapp-fab-badge mt-1">{formatBadgeCount(row.unreadCount)}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              <div className="shrink-0 border-t border-[var(--color-border)]">
                <TablePagination
                  className="internal-messages-pagination"
                  totalCount={filteredRows.length}
                  pageSize={PAGE_SIZE}
                  currentPage={currentPage}
                  onPageSizeChange={() => {}}
                  onPageChange={setPage}
                  pageSizeOptions={[PAGE_SIZE]}
                />
              </div>
            </>
          )}
        </div>
      ) : null}

      <button
        type="button"
        aria-label={t('internalMessages.fabLabel', 'Kurum İçi Mesajlar')}
        title={t('internalMessages.fabLabel', 'Kurum İçi Mesajlar')}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(current => !current)}
        className={`ccc-floating-fab-btn group relative flex size-12 cursor-pointer items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg transition-shadow duration-300 hover:shadow-xl ${isOpen ? '' : 'transition-transform hover:scale-110 active:scale-95'}`}
      >
        <span className="absolute inset-0 rounded-full bg-emerald-700/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden="true" />
        <InternalMessagesIcon />
        {totalUnread > 0 ? (
          <span className={`whatsapp-fab-badge pointer-events-none absolute -right-0.5 -top-0.5 ${formatBadgeCount(totalUnread).length > 1 ? 'whatsapp-fab-badge--wide' : ''}`}>
            {formatBadgeCount(totalUnread)}
          </span>
        ) : null}
      </button>
    </div>
  )
}
