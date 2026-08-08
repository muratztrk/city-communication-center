import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCheck, FileText, Paperclip, Search, Send, X } from 'lucide-react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import {
  ensureSignalRConnected,
  useSignalR,
  type InternalMessagePayload,
  type InternalMessageTypingPayload,
  type SignalRConnectionState,
} from '../../hooks/useSignalR'
import type { Attachment, InternalConversationDetail, InternalConversationSummary, InternalMessage, UserLookup } from '../../types/platform'
import { SimpleImageAttachmentIcon } from '../ui/SimpleImageAttachmentIcon'
import { SocialConversationMediaPreview } from '../SocialConversationMediaPreview'
import { formatConversationDayDivider } from '../../utils/conversationDayLabel'
import { formatConversationListTime, formatConversationMessageTime } from '../../utils/conversationListTime'
import { getLocale } from '../../utils/localization'
import { TablePagination } from '../ui/table-pagination'
import { ATTACHMENT_FILE_ACCEPT, isAllowedAttachmentFileName } from '../../utils/attachmentAccept'
import { ATTACHMENT_MAX_TOTAL_BYTES } from '../../utils/attachmentLimits'
import { formatStaffSenderLabel } from '../../utils/formatConversationSenderLabel'
import { lowercaseFileExtension } from '../../utils/fileNameDisplay'

const INTERNAL_MESSAGE_FILE_ACCEPT = ATTACHMENT_FILE_ACCEPT
const INTERNAL_MESSAGE_FILE_MAX_SIZE = ATTACHMENT_MAX_TOTAL_BYTES

const CONNECTED_POLL_INTERVAL_MS = 15_000
const DISCONNECTED_POLL_INTERVAL_MS = 3_000
const OPEN_CHAT_POLL_INTERVAL_MS = 1_000
const PAGE_SIZE = 10
const TYPING_NOTIFY_DEBOUNCE_MS = 200
const TYPING_INDICATOR_TTL_MS = 3_000
const TYPING_HEARTBEAT_MS = 1_800
const TYPING_POLL_INTERVAL_MS = 1_000

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
      && (message.attachment?.attachmentId ?? null) === (nextMessage.attachment?.attachmentId ?? null)
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

function InternalMessageAttachmentDisplay({ attachment, isMine }: { attachment: Attachment; isMine: boolean }) {
  const isImage = attachment.contentType.startsWith('image/')
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const displayName = lowercaseFileExtension(attachment.fileName)

  const handleDownload = useCallback(() => {
    void api.downloadAttachment(attachment.attachmentId).then(blob => {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = displayName
      anchor.click()
      URL.revokeObjectURL(url)
    })
  }, [attachment.attachmentId, displayName])

  useEffect(() => {
    if (!isImage) return
    let cancelled = false
    let created: string | null = null
    void api.downloadAttachment(attachment.attachmentId)
      .then(blob => {
        if (cancelled) return
        created = URL.createObjectURL(blob)
        setObjectUrl(created)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [attachment.attachmentId, isImage])

  const chipClass = isMine
    ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'

  return (
    <div className="mt-1 space-y-1">
      {isImage && objectUrl ? (
        <>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className={`block w-full overflow-hidden rounded-lg border ${isMine ? 'border-white/20' : 'border-slate-200'}`}
          >
            <img src={objectUrl} alt={displayName} className="max-h-32 w-full cursor-zoom-in object-contain bg-white/95" />
          </button>
          <SocialConversationMediaPreview
            open={previewOpen}
            objectUrl={objectUrl}
            mime={attachment.contentType}
            filename={displayName}
            onClose={() => setPreviewOpen(false)}
            onDownload={handleDownload}
          />
        </>
      ) : null}
      <button
        type="button"
        className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${chipClass}`}
        onClick={isImage ? () => setPreviewOpen(true) : handleDownload}
      >
        {isImage ? (
          <SimpleImageAttachmentIcon className="size-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <FileText className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">{displayName}</span>
      </button>
    </div>
  )
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
  const pendingSenderLabel = formatStaffSenderLabel(user?.departmentName, user?.displayName)

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
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingFilePreviewUrl, setPendingFilePreviewUrl] = useState<string | null>(null)
  const [pendingPreviewOpen, setPendingPreviewOpen] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const pendingFileClock = useMemo(
    () => (pendingFile ? formatConversationMessageTime(new Date().toISOString(), locale, t) : ''),
    [pendingFile, locale, t],
  )
  const [otherUserTyping, setOtherUserTyping] = useState(false)
  const [signalRState, setSignalRState] = useState<SignalRConnectionState>('disconnected')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const typingNotifyTimerRef = useRef<number | null>(null)
  const typingHeartbeatTimerRef = useRef<number | null>(null)
  const typingIdleTimerRef = useRef<number | null>(null)
  const typingActiveRef = useRef(false)
  const otherTypingTimerRef = useRef<number | null>(null)
  const activeChatRef = useRef(activeChat)
  activeChatRef.current = activeChat

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
    const chat = activeChatRef.current
    if (!chat || normalizeUserId(payload.senderUserId) !== normalizeUserId(chat.otherUserId)) return
    if (payload.isTyping) {
      setOtherUserTyping(true)
      if (otherTypingTimerRef.current) window.clearTimeout(otherTypingTimerRef.current)
      otherTypingTimerRef.current = window.setTimeout(() => {
        setOtherUserTyping(false)
      }, TYPING_INDICATOR_TTL_MS)
      return
    }
    setOtherUserTyping(false)
  }, [])

  const notifyTyping = useCallback((isTyping: boolean, force = false) => {
    const chat = activeChatRef.current
    if (!chat) return
    if (!force && typingActiveRef.current === isTyping) return
    typingActiveRef.current = isTyping
    void ensureSignalRConnected().catch(() => undefined)
    void api.notifyInternalMessageTyping(chat.otherUserId, isTyping).catch(() => {
      // sessizce geç — gösterge kritik değil
    })
  }, [])

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
      if (typingIdleTimerRef.current) window.clearTimeout(typingIdleTimerRef.current)
      clearTypingHeartbeat()
      return
    }

    if (!draft.trim()) {
      if (typingNotifyTimerRef.current) window.clearTimeout(typingNotifyTimerRef.current)
      if (typingIdleTimerRef.current) window.clearTimeout(typingIdleTimerRef.current)
      clearTypingHeartbeat()
      notifyTyping(false)
      return
    }

    if (typingNotifyTimerRef.current) window.clearTimeout(typingNotifyTimerRef.current)
    typingNotifyTimerRef.current = window.setTimeout(() => {
      notifyTyping(true)
      startTypingHeartbeat()
    }, TYPING_NOTIFY_DEBOUNCE_MS)

    if (typingIdleTimerRef.current) window.clearTimeout(typingIdleTimerRef.current)
    typingIdleTimerRef.current = window.setTimeout(() => {
      clearTypingHeartbeat()
      notifyTyping(false)
    }, TYPING_INDICATOR_TTL_MS)

    return () => {
      if (typingNotifyTimerRef.current) window.clearTimeout(typingNotifyTimerRef.current)
      if (typingIdleTimerRef.current) window.clearTimeout(typingIdleTimerRef.current)
    }
  }, [activeChat, clearTypingHeartbeat, draft, notifyTyping, startTypingHeartbeat])

  useEffect(() => () => {
    if (otherTypingTimerRef.current) window.clearTimeout(otherTypingTimerRef.current)
    if (typingNotifyTimerRef.current) window.clearTimeout(typingNotifyTimerRef.current)
    if (typingIdleTimerRef.current) window.clearTimeout(typingIdleTimerRef.current)
    clearTypingHeartbeat()
    if (typingActiveRef.current) {
      typingActiveRef.current = false
      const chat = activeChatRef.current
      if (chat) {
        void api.notifyInternalMessageTyping(chat.otherUserId, false).catch(() => undefined)
      }
    }
  }, [clearTypingHeartbeat])

  useEffect(() => {
    if (!isOpen || !activeChat) return

    let cancelled = false
    const pollTyping = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      try {
        const state = await api.getInternalTypingState(activeChat.otherUserId)
        if (cancelled) return
        if (state.isTyping) {
          setOtherUserTyping(true)
          if (otherTypingTimerRef.current) window.clearTimeout(otherTypingTimerRef.current)
          otherTypingTimerRef.current = window.setTimeout(() => {
            setOtherUserTyping(false)
          }, TYPING_INDICATOR_TTL_MS)
        } else {
          setOtherUserTyping(false)
        }
      } catch {
        // sessizce geç — SignalR veya sonraki poll denenecek
      }
    }

    void pollTyping()
    const timer = window.setInterval(() => {
      void pollTyping()
    }, TYPING_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeChat, isOpen])

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
  }, [chatDetail, pendingFile])

  useEffect(() => {
    if (!pendingFile) {
      setPendingFilePreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(pendingFile)
    setPendingFilePreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [pendingFile])

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
    setPendingFile(null)
    setFileError(null)
    setOtherUserTyping(false)
  }

  const handleSend = async () => {
    const content = draft.trim()
    if (!content || !activeChat || sending) return
    setFileError(null)
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

  const handleSendAttachment = async () => {
    const content = draft.trim()
    const file = pendingFile
    if (!file || !activeChat || sending) return
    if (!isAllowedAttachmentFileName(file.name)) {
      setFileError(t('attachments.errorType', 'Yalnızca resim (JPG, PNG), PDF ve Office dosyaları yüklenebilir.'))
      return
    }
    if (file.size > INTERNAL_MESSAGE_FILE_MAX_SIZE) {
      setFileError(t('attachments.errorSize', 'Dosya boyutu 5 MB\'ı aşamaz.'))
      return
    }
    setFileError(null)
    setSending(true)
    try {
      notifyTyping(false)
      clearTypingHeartbeat()
      const normalizedFileName = lowercaseFileExtension(file.name)
      const result = await api.sendInternalMessage(activeChat.otherUserId, content || normalizedFileName)
      const uploadFile = normalizedFileName === file.name
        ? file
        : new File([file], normalizedFileName, { type: file.type })
      await api.uploadInternalMessageAttachment(result.message.internalMessageId, uploadFile)
      setDraft('')
      setPendingFile(null)
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
        <div className="internal-messages-fab-panel absolute bottom-full right-0 z-10 mb-3 flex h-[min(80dvh,50rem)] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[color:var(--color-background)] shadow-2xl sm:h-[min(74dvh,46rem)]">
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
              <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[color:var(--color-background)] px-3 py-3">
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
                              {formatConversationDayDivider(message.createdAtUtc, locale, t)}
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
                            {message.content && (!message.attachment || message.content !== lowercaseFileExtension(message.attachment.fileName)) ? (
                              <p className="whitespace-pre-wrap break-words text-xs leading-snug">{message.content}</p>
                            ) : null}
                            {message.attachment ? (
                              <InternalMessageAttachmentDisplay attachment={message.attachment} isMine={isMine} />
                            ) : null}
                            <p className={`mt-1.5 flex items-center justify-end gap-1 text-[9px] ${isMine ? 'text-emerald-100' : 'text-slate-400'}`}>
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
                {pendingFile ? (
                  <div className="flex flex-col items-end gap-1">
                    <div className="max-w-[min(72%,28rem)] rounded-xl rounded-tr-sm bg-emerald-700 px-2.5 py-1.5 text-xs text-white shadow-sm ring-1 ring-white/10">
                      {pendingSenderLabel ? (
                        <p className="mb-0.5 text-[11px] font-semibold leading-snug text-white/90">{pendingSenderLabel}</p>
                      ) : null}
                      <div className="flex items-center gap-1.5">
                        {pendingFile.type.startsWith('image/') ? null : (
                          <>
                            <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 truncate font-semibold">{lowercaseFileExtension(pendingFile.name)}</span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setPendingFile(null)
                            setPendingPreviewOpen(false)
                          }}
                          disabled={sending}
                          className={`${pendingFile.type.startsWith('image/') ? '' : 'ml-auto '}inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-60 ${pendingFile.type.startsWith('image/') ? 'ml-auto' : ''}`}
                          aria-label={t('common.dismiss', 'Vazgeç')}
                        >
                          <X className="size-3" aria-hidden="true" />
                        </button>
                      </div>
                      {pendingFile.type.startsWith('image/') && pendingFilePreviewUrl ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setPendingPreviewOpen(true)}
                            className="mt-1.5 block w-full overflow-hidden rounded-lg border border-white/20"
                          >
                            <img
                              src={pendingFilePreviewUrl}
                              alt={pendingFile.name}
                              className="max-h-40 w-full cursor-zoom-in object-contain bg-white/95"
                            />
                          </button>
                          <div className="mt-1 flex items-center gap-1.5">
                            <SimpleImageAttachmentIcon className="size-3.5 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 truncate font-semibold">{lowercaseFileExtension(pendingFile.name)}</span>
                          </div>
                          <SocialConversationMediaPreview
                            open={pendingPreviewOpen}
                            objectUrl={pendingFilePreviewUrl}
                            mime={pendingFile.type || 'image/jpeg'}
                            filename={lowercaseFileExtension(pendingFile.name)}
                            onClose={() => setPendingPreviewOpen(false)}
                            onDownload={() => {
                              const anchor = document.createElement('a')
                              anchor.href = pendingFilePreviewUrl
                              anchor.download = lowercaseFileExtension(pendingFile.name)
                              anchor.click()
                            }}
                          />
                        </>
                      ) : null}
                      <p className="mt-1.5 flex items-baseline justify-end gap-1 text-[9px] text-emerald-100">
                        <span className="font-semibold tracking-wide">{t('whatsapp.pendingBadge', 'Beklemede')}</span>
                        <span aria-hidden="true">·</span>
                        <span>{pendingFileClock}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSendAttachment()}
                      disabled={sending}
                      className="inline-flex h-6 items-center gap-1 rounded-full bg-emerald-600 px-2 text-[10px] font-semibold leading-none text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Send className="size-2.5" aria-hidden="true" />
                      {t('internalMessages.sendAttachment', 'Eki Gönder')}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 space-y-2 border-t border-[var(--color-border)] bg-white px-3 py-2.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={INTERNAL_MESSAGE_FILE_ACCEPT}
                  className="hidden"
                  onChange={event => {
                    const file = event.target.files?.[0] ?? null
                    event.target.value = ''
                    setFileError(null)
                    if (!file) {
                      setPendingFile(null)
                      return
                    }
                    if (!isAllowedAttachmentFileName(file.name)) {
                      setFileError(t('attachments.errorType', 'Yalnızca resim (JPG, PNG), PDF ve Office dosyaları yüklenebilir.'))
                      return
                    }
                    if (file.size > INTERNAL_MESSAGE_FILE_MAX_SIZE) {
                      setFileError(t('attachments.errorSize', 'Dosya boyutu 5 MB\'ı aşamaz.'))
                      return
                    }
                    setPendingFile(file)
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <Paperclip className="size-3 shrink-0 text-emerald-600" aria-hidden="true" />
                  {t('attachments.addFile', 'Dosya ekle')}
                </button>
                {fileError ? <p className="text-xs font-semibold text-red-600">{fileError}</p> : null}
                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void handleSend()
                      }
                    }}
                    placeholder={t('internalMessages.messagePlaceholder', 'Mesaj yazın...')}
                    className="field-input min-h-[2.5rem] max-h-28 min-w-0 flex-1 resize-none overflow-y-auto py-2 text-sm leading-snug"
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
                          <p className="mt-2 line-clamp-1 text-xs text-slate-500">{row.lastMessagePreview}</p>
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
