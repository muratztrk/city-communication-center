import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCheck, Search, Send, X } from 'lucide-react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import {
  ensureSignalRConnected,
  useSignalR,
  type InternalMessagePayload,
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

interface MessageRow {
  otherUserId: string
  displayName: string
  departmentName: string | null
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
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  return `${parts[0][0] ?? ''}${parts.length > 1 ? parts[parts.length - 1][0] ?? '' : ''}`.toLocaleUpperCase('tr')
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
  const [activeChat, setActiveChat] = useState<{ otherUserId: string; displayName: string; departmentName: string | null } | null>(null)
  const [chatDetail, setChatDetail] = useState<InternalConversationDetail | null>(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [signalRState, setSignalRState] = useState<SignalRConnectionState>('disconnected')
  const scrollRef = useRef<HTMLDivElement | null>(null)

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
  }, [activeChat, currentUserId, loadChat, refreshConversations])

  useSignalR({
    onInternalMessage: handleInternalMessage,
    onReconnected: refreshConversations,
    onConnectionStateChange: setSignalRState,
  })

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

  // Arama personel adına göre "contains" eşleşir (Türkçe locale-lowercase); sonuçlar 300ms debounce ile çekilir.
  useEffect(() => {
    const trimmed = search.trim()
    if (!trimmed) {
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
    if (!normalizedSearch) {
      return conversations.map(toRow)
    }
    const merged = new Map<string, MessageRow>()
    conversations
      .filter(c => c.otherUserDisplayName.toLocaleLowerCase('tr').includes(normalizedSearch))
      .forEach(c => merged.set(c.otherUserId, toRow(c)))
    userResults
      .filter(u => u.userId !== currentUserId)
      .forEach(u => {
        if (!merged.has(u.userId)) {
          merged.set(u.userId, {
            otherUserId: u.userId,
            displayName: u.displayName,
            departmentName: u.departmentName,
            internalConversationId: null,
            lastMessagePreview: null,
            lastMessageAtUtc: null,
            lastMessageSenderUserId: null,
            unreadCount: 0,
          })
        }
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

  const openRow = (row: MessageRow) => {
    setActiveChat({ otherUserId: row.otherUserId, displayName: row.displayName, departmentName: row.departmentName })
    setChatDetail(null)
    if (row.internalConversationId) {
      void openConversationById(row.internalConversationId)
    }
    void loadChat(row.otherUserId)
  }

  const closePanel = () => {
    setIsOpen(false)
    setActiveChat(null)
    setChatDetail(null)
    setSearch('')
    setDraft('')
  }

  const handleSend = async () => {
    const content = draft.trim()
    if (!content || !activeChat || sending) return
    setSending(true)
    try {
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
    <div className="relative size-14 shrink-0">
      {isOpen ? (
        <div className="internal-messages-fab-panel absolute bottom-full right-0 z-10 mb-3 flex h-[min(66dvh,42rem)] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[color:var(--color-background)] shadow-2xl">
          <div className={`flex items-start justify-between gap-2 border-b border-[var(--color-border)] bg-emerald-700/10 py-3 pr-4 ${activeChat ? 'pl-3' : 'pl-4'}`}>
              <div className={`min-w-0 flex-1 ${activeChat ? 'flex flex-col gap-1' : 'flex items-start'}`}>
                {activeChat ? (
                  <>
                  <button
                    type="button"
                    onClick={() => { setActiveChat(null); setChatDetail(null) }}
                    className="inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-[10px] font-bold leading-none text-teal-700 transition-colors hover:bg-teal-50 hover:text-teal-800"
                    aria-label={t('common.back', 'Geri')}
                  >
                    <span aria-hidden="true" className="text-xs leading-none">←</span>
                    <span>{t('common.back', 'Geri')}</span>
                  </button>
                  <div className="flex min-w-0 items-start gap-1.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">
                      {getInitials(activeChat.displayName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold leading-tight text-[color:var(--color-foreground)]">{activeChat.displayName}</p>
                      <p className="mt-0.5 truncate text-xs text-[color:var(--color-muted-foreground)]">{activeChat.departmentName ?? '—'}</p>
                    </div>
                  </div>
                  </>
                ) : (
                  <p className="truncate text-sm font-bold text-[color:var(--color-foreground)]">{t('internalMessages.panelTitle', 'Kurum İçi Mesajlar')}</p>
                )}
            </div>
            {activeChat ? (
              <span className="mt-0.5 shrink-0 text-right text-[10px] font-semibold text-teal-700">
                {t('internalMessages.panelTitle', 'Kurum İçi Mesajlar')}
              </span>
            ) : null}
            <button
              type="button"
              className="rounded-full p-1 text-[color:var(--color-muted-foreground)] transition-colors hover:bg-red-50 hover:text-red-600"
              aria-label={t('common.close', 'Kapat')}
              onClick={closePanel}
            >
              <X className="size-4" />
            </button>
          </div>

          {activeChat ? (
            <>
              <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 px-3 py-3">
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
              <div className="shrink-0 space-y-2 border-b border-slate-100 px-3 pb-2 pt-2.5">
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

              <div className="min-h-0 flex-1 overflow-y-auto">
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
                          <p className="truncate text-sm font-semibold text-[color:var(--color-foreground)]">{row.displayName}</p>
                          {row.lastMessageAtUtc ? (
                            <span className="shrink-0 text-[11px] text-[color:var(--color-muted-foreground)]">
                              {formatConversationListTime(row.lastMessageAtUtc, locale, t)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex min-w-0 items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-xs text-[color:var(--color-muted-foreground)]">{row.departmentName ?? '—'}</p>
                          {hasStatus ? (
                            <span className={`inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold ${isWaiting ? 'text-orange-700' : 'text-emerald-700'}`}>
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
        className={`group relative flex size-14 cursor-pointer items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg transition-shadow duration-300 hover:shadow-xl ${isOpen ? '' : 'transition-transform hover:scale-110 active:scale-95'}`}
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
