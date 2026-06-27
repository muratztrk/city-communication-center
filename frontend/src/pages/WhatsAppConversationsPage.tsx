import { useEffect, useRef, useState, useCallback, Fragment, useMemo } from 'react'
import { AlertCircle, Link2, Loader2, MessageCircle, MoreVertical, Search, Send, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { CitizenRequestModal } from '../components/CitizenRequestModal'
import type {
  CitizenConversationSummary,
  CitizenConversationDetail,
  CitizenConversationTimelineEntry,
  Department,
  SocialMessage,
  WhatsAppMessageTemplate,
} from '../types/platform'
import { getLocale } from '../utils/localization'
import { formatConversationListTime } from '../utils/conversationListTime'
import { conversationSameDay, formatConversationDayDivider } from '../utils/conversationDayLabel'
import { ConversationEntryBubble } from '../components/ConversationEntryBubble'
import { WhatsAppTemplatePicker } from '../components/WhatsAppTemplatePicker'
import { formatConversationDisplayContent } from '../utils/socialConversationContent'
import { formatWhatsAppTicketLabel, isUrgentConversationPriority } from '../utils/whatsappConversationTicket'

// ─── helpers ────────────────────────────────────────────────────────────────

function formatPhone(phone: string): string {
  // Display E.164 as a readable number (e.g. 905301234567 → +90 530 123 45 67)
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('90')) {
    return `+90 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`
  }
  return `+${digits}`
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^0(?=5\d{9}$)/, '90')
}

function toLocalPhoneFilterDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('90')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

/** İsimden baş harfleri çıkarır (en fazla 2). Harf yoksa null döner. */
function getInitials(value: string): string | null {
  const words = value.trim().split(/\s+/).filter(w => /\p{L}/u.test(w))
  if (words.length === 0) return null
  return words.slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-1.5">
      <span className="rounded-full bg-black/25 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
        {label}
      </span>
    </div>
  )
}

function findClosestTimelineEntryIndex(
  timeline: CitizenConversationTimelineEntry[],
  anchorAtUtc: string,
  anchorSocialMessageId?: string | null,
): number {
  if (anchorSocialMessageId) {
    const exactIndex = timeline.findIndex(entry => entry.socialMessageId === anchorSocialMessageId)
    if (exactIndex >= 0) return exactIndex
  }

  const anchorTime = new Date(anchorAtUtc).getTime()
  if (Number.isNaN(anchorTime) || timeline.length === 0) {
    return Math.max(timeline.length - 1, 0)
  }

  let bestIndex = 0
  let bestDiff = Number.POSITIVE_INFINITY
  for (let index = 0; index < timeline.length; index += 1) {
    const diff = Math.abs(new Date(timeline[index].sentAt).getTime() - anchorTime)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIndex = index
    }
  }
  return bestIndex
}

// ─── left panel: conversation list item ──────────────────────────────────────

function ConversationListItem({
  conv,
  selected,
  onClick,
}: {
  conv: CitizenConversationSummary
  selected: boolean
  onClick: () => void
}) {
  const { i18n, t } = useTranslation()
  const locale = getLocale(i18n.language)
  const initials = conv.citizenName ? getInitials(conv.citizenName) : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-[color:var(--color-border)] transition-colors ${
        selected
          ? 'bg-[color:var(--color-primary)]/[0.08] border-l-[3px] border-l-[color:var(--color-primary)]'
          : 'bg-white hover:bg-slate-50 border-l-[3px] border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 shrink-0 rounded-full bg-[color:var(--color-primary)]/15 flex items-center justify-center text-[color:var(--color-primary)] text-xs font-bold">
            {initials ?? <MessageCircle className="size-4" />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-[color:var(--color-foreground)] truncate">
              {conv.citizenName ?? formatPhone(conv.citizenPhone)}
            </p>
            {conv.citizenName && (
              <p className="text-xs text-[color:var(--color-muted-foreground)] truncate">
                {formatPhone(conv.citizenPhone)}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[11px] text-[color:var(--color-muted-foreground)]">
            {formatConversationListTime(conv.lastMessageAt, locale, t)}
          </span>
          {conv.unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.2rem] h-5 px-1 rounded-full bg-[color:var(--color-primary)] text-white text-[10px] font-bold">
              {conv.unreadCount}
            </span>
          )}
        </div>
      </div>
      {conv.lastMessagePreview && (
        <p className="mt-1 ml-[2.875rem] text-xs text-[color:var(--color-muted-foreground)] truncate">
          {formatConversationDisplayContent(conv.lastMessagePreview)}
        </p>
      )}
      {conv.isBlocked && (
        <span className="mt-1 ml-[2.875rem] inline-block text-[10px] font-semibold text-red-500">
          {t('whatsapp.blocked')}
        </span>
      )}
    </button>
  )
}

// ─── 24h window check ────────────────────────────────────────────────────────

function is24hWindowOpen(lastInboundAt: string | null): boolean {
  if (!lastInboundAt) return false
  const diffMs = Date.now() - new Date(lastInboundAt).getTime()
  return diffMs < 24 * 60 * 60 * 1000
}

// ─── right panel: conversation detail ────────────────────────────────────────

function ConversationDetail({
  conversationId,
  citizenName,
  citizenPhone,
  templates,
  anchorAtUtc,
  anchorSocialMessageId,
  onReadMarked,
  onOpenCreateRequest,
  onOpenViewRequests,
}: {
  conversationId: string
  citizenName?: string | null
  citizenPhone?: string | null
  templates: WhatsAppMessageTemplate[]
  anchorAtUtc?: string | null
  anchorSocialMessageId?: string | null
  onReadMarked?: () => void
  onOpenCreateRequest: (socialMessageId: string) => void
  onOpenViewRequests: (citizenPhone: string) => void
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const locale = getLocale(i18n.language)
  const dayLabel = (iso: string) => formatConversationDayDivider(iso, locale, t)
  const [detail, setDetail] = useState<CitizenConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [chatSearch, setChatSearch] = useState('')
  const [showChatSearch, setShowChatSearch] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [highlightEntryIndex, setHighlightEntryIndex] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const entryRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const anchorAppliedRef = useRef(false)

  const loadDetail = useCallback(async () => {
    setLoading(true)
    setDetail(null)
    try {
      const data = await api.getCitizenConversationDetail(conversationId)
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  const refreshDetail = useCallback(async () => {
    try {
      const data = await api.getCitizenConversationDetail(conversationId)
      setDetail(data)
    } catch {
      // Keep the current timeline visible if a background refresh fails.
    }
  }, [conversationId])

  useEffect(() => {
    void loadDetail()
    // Mark as read when conversation is opened
    api.markConversationRead(conversationId)
      .then(() => onReadMarked?.())
      .catch(() => {})
  }, [conversationId, loadDetail, onReadMarked])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshDetail()
    }, 8000)
    return () => window.clearInterval(intervalId)
  }, [refreshDetail])

  useEffect(() => {
    anchorAppliedRef.current = false
    entryRefs.current.clear()
  }, [conversationId, anchorAtUtc, anchorSocialMessageId])

  useEffect(() => {
    if (loading || !detail || detail.timeline.length === 0) return

    if (anchorAtUtc && !anchorAppliedRef.current) {
      const targetIndex = findClosestTimelineEntryIndex(detail.timeline, anchorAtUtc, anchorSocialMessageId)
      const targetElement = entryRefs.current.get(targetIndex)
      if (targetElement) {
        anchorAppliedRef.current = true
        window.setTimeout(() => {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setHighlightEntryIndex(targetIndex)
          window.setTimeout(() => setHighlightEntryIndex(null), 2500)
        }, 50)
        return
      }
    }

    if (!anchorAtUtc) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [anchorAtUtc, anchorSocialMessageId, detail, loading])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [menuOpen])

  const handleSend = async () => {
    const text = replyText.trim()
    if (!text || sending || !detail) return

    // Find the most recent open SocialMessage to reply to
    const openTicket = detail.tickets
      .slice()
      .reverse()
      .find(t => t.status !== 'Closed')
    if (!openTicket) return

    setSending(true)
    try {
      await api.replySocialMessage(openTicket.socialMessageId, text)
      setReplyText('')
      await refreshDetail()
    } finally {
      setSending(false)
    }
  }

  const openTicket = detail?.tickets.slice().reverse().find(t => t.status !== 'Closed')
  const primaryTicket = openTicket ?? detail?.tickets[detail.tickets.length - 1]
  const windowOpen = is24hWindowOpen(detail?.lastInboundAt ?? null)
  const activeTemplates = templates.filter(t => t.isActive && (t.channel === 'Genel' || t.channel === 'WhatsApp'))

  const phoneForHeader = citizenPhone ?? detail?.citizenPhone ?? null
  const headerTitle = citizenName?.trim() || (phoneForHeader ? formatPhone(phoneForHeader) : t('social.conversation', 'Konuşma'))
  const headerInitials = citizenName ? getInitials(citizenName) : null
  const ticketLabel = formatWhatsAppTicketLabel(primaryTicket)
  const showUrgentBadge = isUrgentConversationPriority(primaryTicket?.priority)
  const normalizedChatSearch = chatSearch.trim().toLocaleLowerCase('tr')
  const visibleTimeline = useMemo(() => {
    if (!detail) return []
    if (!normalizedChatSearch) return detail.timeline
    return detail.timeline.filter(entry =>
      formatConversationDisplayContent(entry.content).toLocaleLowerCase('tr').includes(normalizedChatSearch)
      || (entry.senderLabel ?? '').toLocaleLowerCase('tr').includes(normalizedChatSearch),
    )
  }, [detail, normalizedChatSearch])

  const handleLinkTicket = () => {
    if (primaryTicket?.jobId) {
      navigate(`/jobs?jobId=${encodeURIComponent(primaryTicket.jobId)}`)
      return
    }
    if (primaryTicket) {
      onOpenCreateRequest(primaryTicket.socialMessageId)
    }
  }

  return (
    <div className="flex h-full flex-col text-white" style={{ backgroundColor: 'var(--color-header-from)' }}>
      <header className="flex shrink-0 items-start gap-3 border-b border-white/10 px-4 py-3">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold"
          style={{ color: 'var(--color-header-from)' }}
        >
          {headerInitials ?? <MessageCircle className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[15px] font-semibold leading-tight">{headerTitle}</p>
            {showUrgentBadge ? (
              <span className="shrink-0 rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-amber-950">
                ACİL
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-white/70">
            {phoneForHeader ? formatPhone(phoneForHeader) : t('whatsapp.title', 'WhatsApp')}
            {ticketLabel ? ` · ${ticketLabel}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {primaryTicket ? (
            <button
              type="button"
              onClick={handleLinkTicket}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-white/25 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              <Link2 className="size-3.5" />
              {primaryTicket.jobId ? t('whatsapp.openLinkedRequest', 'Talebe git') : t('whatsapp.linkToRequest', 'Talebe bağla')}
            </button>
          ) : null}
          <button
            type="button"
            aria-label={t('common.search', 'Ara')}
            onClick={() => setShowChatSearch(current => !current)}
            className="flex size-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Search className="size-4" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label={t('common.more', 'Diğer')}
              onClick={() => setMenuOpen(current => !current)}
              className="flex size-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <MoreVertical className="size-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[12rem] overflow-hidden rounded-xl border border-white/10 bg-[#0f3d2d] py-1 shadow-xl">
                {primaryTicket ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10"
                    onClick={() => {
                      setMenuOpen(false)
                      onOpenCreateRequest(primaryTicket.socialMessageId)
                    }}
                  >
                    {t('nav.createRequest', 'Talep oluştur')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10"
                  onClick={() => {
                    setMenuOpen(false)
                    if (detail) onOpenViewRequests(detail.citizenPhone)
                  }}
                >
                  {t('whatsapp.viewRequestsByNumber', 'Numaranın talepleri')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {showChatSearch ? (
        <div className="shrink-0 border-b border-white/10 px-4 py-2">
          <input
            type="search"
            value={chatSearch}
            onChange={event => setChatSearch(event.target.value)}
            placeholder={t('whatsapp.searchInConversation', 'Konuşmada ara…')}
            className="w-full rounded-xl border border-white/15 bg-black/15 px-3 py-2 text-sm text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
      ) : null}

      <div
        className="min-h-0 flex-1 overflow-y-auto space-y-2.5 px-4 py-4"
        style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--color-header-from) 88%, #000), color-mix(in srgb, var(--color-header-to) 92%, #000))' }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-white/80" />
          </div>
        ) : !detail || visibleTimeline.length === 0 ? (
          <p className="mt-8 text-center text-sm text-white/70">
            {normalizedChatSearch ? t('whatsapp.searchNoResults', 'Eşleşen mesaj yok.') : t('social.noMessages', 'Henüz mesaj yok')}
          </p>
        ) : (
          visibleTimeline.map((entry, index) => {
            const previousEntry = index > 0 ? visibleTimeline[index - 1] : null
            const showDivider = index === 0 || (previousEntry && !conversationSameDay(entry.sentAt, previousEntry.sentAt))
            return (
              <Fragment key={entry.entryId || index}>
                {showDivider ? <DateDivider label={dayLabel(entry.sentAt)} /> : null}
                <div
                  ref={element => {
                    if (element) entryRefs.current.set(index, element)
                    else entryRefs.current.delete(index)
                  }}
                  className={highlightEntryIndex === index ? 'rounded-2xl ring-2 ring-white/90 ring-offset-2 ring-offset-transparent transition-shadow' : undefined}
                >
                  <ConversationEntryBubble entry={entry} />
                </div>
              </Fragment>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {openTicket ? (
        <footer className="shrink-0 space-y-3 border-t border-white/10 px-4 py-3">
          {!windowOpen ? (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
              <AlertCircle className="size-3.5 shrink-0" />
              24 saatlik pencere kapalı — yalnızca şablon gönderilebilir
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenCreateRequest(primaryTicket!.socialMessageId)}
              className="inline-flex h-9 items-center rounded-full border border-white/30 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              {t('nav.createRequest', 'Talep oluştur')}
            </button>
            <WhatsAppTemplatePicker
              templates={templates}
              tone="on-dark"
              onSelect={content => setReplyText(content)}
            />
          </div>
          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSend()
                }
              }}
              placeholder={windowOpen ? t('whatsapp.replyPlaceholder', 'Yanıt yaz…') : 'Şablon seçin…'}
              disabled={!windowOpen && activeTemplates.length === 0}
              className="min-h-[3.25rem] max-h-28 flex-1 resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-white/15 disabled:opacity-50"
            />
            <button
              type="button"
              aria-label={t('common.send', 'Gönder')}
              onClick={() => void handleSend()}
              disabled={!replyText.trim() || sending}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[color:var(--color-header-from)] shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </div>
        </footer>
      ) : (
        <footer className="shrink-0 border-t border-white/10 px-4 py-4 text-center text-xs text-white/65">
          {t('whatsapp.noTickets')}
        </footer>
      )}
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export function WhatsAppConversationsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedPhone = searchParams.get('phone') ?? ''
  const requestedAt = searchParams.get('at') ?? ''
  const requestedMessageId = searchParams.get('messageId') ?? ''
  const [conversations, setConversations] = useState<CitizenConversationSummary[]>([])
  const [templates, setTemplates] = useState<WhatsAppMessageTemplate[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [requestModalMessage, setRequestModalMessage] = useState<SocialMessage | null>(null)
  const [requestModalEditJobId, setRequestModalEditJobId] = useState<string | null>(null)
  const [requestModalForceNew, setRequestModalForceNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('phone') ?? '')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)

  const loadConversations = useCallback(async () => {
    setLoading(true)
    try {
      const [convResult, tplResult, departmentResult] = await Promise.allSettled([
        api.getCitizenConversations(),
        api.getWhatsAppTemplates(),
        api.getDepartments(),
      ])
      if (convResult.status === 'fulfilled') {
        setConversations(convResult.value)
      }
      if (tplResult.status === 'fulfilled') {
        setTemplates(tplResult.value)
      }
      if (departmentResult.status === 'fulfilled') {
        setDepartments(departmentResult.value)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    setSearch(requestedPhone)
  }, [requestedPhone])

  useEffect(() => {
    if (!requestedPhone) return
    const requestedDigits = normalizePhone(requestedPhone)
    const matchingConversation = conversations.find(conversation => normalizePhone(conversation.citizenPhone) === requestedDigits)
    setSelectedId(matchingConversation?.citizenConversationId ?? null)
  }, [conversations, requestedPhone])

  const normalizedSearchPhone = normalizePhone(search)
  const normalizedSearchName = search.toLocaleLowerCase('tr')
  const filtered = conversations.filter(conversation => {
    const matchesSearch = normalizedSearchPhone.length === 0 && normalizedSearchName.length === 0
      ? true
      : (normalizedSearchPhone.length > 0 && normalizePhone(conversation.citizenPhone).includes(normalizedSearchPhone))
        || (conversation.citizenName ?? '').toLocaleLowerCase('tr').includes(normalizedSearchName)
        || normalizePhone(conversation.citizenPhone).includes(normalizedSearchPhone)
    if (!matchesSearch) return false
    if (filterFrom || filterTo) {
      const date = conversation.lastMessageAt.slice(0, 10)
      if (filterFrom && date < filterFrom.slice(0, 10)) return false
      if (filterTo && date > filterTo.slice(0, 10)) return false
    }
    return true
  })

  const selectedConv = conversations.find(c => c.citizenConversationId === selectedId) ?? null

  const handleReadMarked = useCallback(() => {
    setConversations(prev =>
      prev.map(c => c.citizenConversationId === selectedId ? { ...c, unreadCount: 0 } : c),
    )
  }, [selectedId])

  const enrichMessageWithConversation = useCallback((message: SocialMessage, conversationId: string | null): SocialMessage => {
    const conversation = conversations.find(item => item.citizenConversationId === conversationId)
    if (!conversation) return message
    return {
      ...message,
      citizenName: conversation.citizenName ?? message.citizenName ?? null,
      citizenPhone: conversation.citizenPhone ?? message.citizenPhone ?? null,
    }
  }, [conversations])

  const handleOpenCreateRequest = useCallback(async (socialMessageId: string) => {
    try {
      setRequestModalEditJobId(null)
      setRequestModalForceNew(true)
      const message = await api.getSocialMessageById(socialMessageId)
      setRequestModalMessage(enrichMessageWithConversation(message, selectedId))
    } catch {
      setRequestModalEditJobId(null)
      setRequestModalForceNew(false)
      setRequestModalMessage(null)
    }
  }, [enrichMessageWithConversation, selectedId])

  const handleRequestCreated = useCallback(() => {
    setRequestModalMessage(null)
    setRequestModalEditJobId(null)
    setRequestModalForceNew(false)
    void loadConversations()
    setDetailRefreshKey(key => key + 1)
  }, [loadConversations])

  const handleOpenViewRequests = useCallback((citizenPhone: string) => {
    const digits = toLocalPhoneFilterDigits(citizenPhone)
    if (!digits) return
    navigate(`/social?phone=${encodeURIComponent(digits)}`)
  }, [navigate])

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{t('nav.social', 'Vatandaş Talepleri')}</div>
            <h1 className="page-title">{t('whatsapp.title')}</h1>
            <p className="page-subtitle">{t('whatsapp.subtitle')}</p>
          </div>
          <div className="ml-auto mt-auto shrink-0">
            <div className="scope-chips-filters">
              <div className="scope-chip-search-wrap">
                <Search className="scope-chip-search-icon size-3 shrink-0 text-slate-400" aria-hidden="true" />
                <input
                  type="text"
                  className="scope-chip-search-input"
                  placeholder={t('whatsapp.searchPlaceholder', 'Telefon no bul…')}
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
                {search ? (
                  <button type="button" onClick={() => setSearch('')} className="scope-chip-search-clear shrink-0 font-extrabold transition-colors" aria-label={t('common.clear', 'Temizle')}>
                    <X className="size-3.5" strokeWidth={3} />
                  </button>
                ) : null}
              </div>
              <DateTimePicker value={filterFrom} onChange={setFilterFrom} placeholder={t('filters.startDate', 'Başlangıç tarihi')} className="scope-chip-date" forceDown />
              <span className="text-xs text-white/60">–</span>
              <DateTimePicker value={filterTo} onChange={setFilterTo} placeholder={t('filters.endDate', 'Bitiş tarihi')} className="scope-chip-date" forceDown />
            </div>
          </div>
        </div>
      </header>

      {/* Split panel layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-slate-50">
        {/* Left: conversation list */}
        <div className="w-80 shrink-0 flex flex-col border-r border-[color:var(--color-border)] bg-white">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="size-5 animate-spin text-[color:var(--color-primary)]" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-[color:var(--color-muted-foreground)] mt-8 px-4">
                {t('whatsapp.empty')}
              </p>
            ) : (
              filtered.map(conv => (
                <ConversationListItem
                  key={conv.citizenConversationId}
                  conv={conv}
                  selected={conv.citizenConversationId === selectedId}
                  onClick={() => setSelectedId(conv.citizenConversationId)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: conversation detail */}
        <div className="flex-1 min-w-0 bg-slate-50">
          {selectedId ? (
            <ConversationDetail
              key={`${selectedId}-${detailRefreshKey}-${requestedAt}-${requestedMessageId}`}
              conversationId={selectedId}
              citizenName={selectedConv?.citizenName ?? null}
              citizenPhone={selectedConv?.citizenPhone ?? null}
              templates={templates}
              anchorAtUtc={requestedAt || null}
              anchorSocialMessageId={requestedMessageId || null}
              onReadMarked={handleReadMarked}
              onOpenCreateRequest={socialMessageId => { void handleOpenCreateRequest(socialMessageId) }}
              onOpenViewRequests={handleOpenViewRequests}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[color:var(--color-muted-foreground)] gap-3">
              <MessageCircle className="size-12 opacity-20" />
              <p className="text-sm">{t('whatsapp.emptyDetail')}</p>
            </div>
          )}
        </div>
      </div>

      {requestModalMessage ? (
        <CitizenRequestModal
          message={requestModalMessage}
          departments={departments}
          editJobId={requestModalEditJobId}
          forceNewRequest={requestModalForceNew}
          citizenConversationId={selectedId}
          onClose={() => {
            setRequestModalMessage(null)
            setRequestModalEditJobId(null)
            setRequestModalForceNew(false)
          }}
          onCreated={handleRequestCreated}
        />
      ) : null}
    </div>
  )
}
