import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { AlertCircle, CalendarClock, ChevronDown, Clock, FileText, Loader2, MessageCircle, Search, Send, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
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
import { SocialConversationMediaBubble } from '../components/SocialConversationMediaBubble'
import { formatBracketContent, isPlaceholderBracketContent } from '../utils/socialConversationContent'

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

function formatRelativeTime(dateStr: string, locale: string): string {
  const d = new Date(dateStr)
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return locale.startsWith('tr') ? 'şimdi' : 'now'
  if (diffMin < 60) return locale.startsWith('tr') ? `${diffMin}d önce` : `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return locale.startsWith('tr') ? `${diffH}s önce` : `${diffH}h ago`
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
}

// ─── timeline entry bubble ───────────────────────────────────────────────────

function EntryBubble({ entry }: { entry: CitizenConversationTimelineEntry }) {
  const { i18n } = useTranslation()
  const isInbound = entry.direction === 'Inbound'
  const hasMedia = Boolean(entry.mediaId) && entry.entryId !== '00000000-0000-0000-0000-000000000000'
  const locale = getLocale(i18n.language)

  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
          isInbound
            ? 'bg-white/90 text-slate-800 rounded-tl-sm'
            : 'bg-[color:var(--color-primary)] text-white rounded-tr-sm'
        }`}
      >
        {hasMedia && (
          <div className="mb-1.5">
            <SocialConversationMediaBubble
              key={`${entry.socialMessageId}-${entry.entryId}`}
              socialMessageId={entry.socialMessageId}
              entryId={entry.entryId}
              mediaMimeType={entry.mediaMimeType}
              direction={entry.direction}
            />
          </div>
        )}
        {entry.content && !isPlaceholderBracketContent(entry.content) && (
          <p className="whitespace-pre-wrap break-words leading-snug">{entry.content}</p>
        )}
        {isPlaceholderBracketContent(entry.content) && !hasMedia && (
          <p className="italic opacity-70 text-xs">{formatBracketContent(entry.content)}</p>
        )}
        <p className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isInbound ? 'text-slate-400' : 'text-white/60'}`}>
          <CalendarClock className="size-3 shrink-0" />
          {new Date(entry.sentAt).toLocaleString(locale, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
        </p>
      </div>
    </div>
  )
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

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-[color:var(--color-border)] transition-colors bg-slate-50 hover:bg-slate-100 ${
        selected ? 'bg-slate-100 border-l-2 border-l-[color:var(--color-primary)]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-9 shrink-0 rounded-full bg-[color:var(--color-primary)]/15 flex items-center justify-center">
            <MessageCircle className="size-4 text-[color:var(--color-primary)]" />
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
            {formatRelativeTime(conv.lastMessageAt, locale)}
          </span>
          {conv.unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.2rem] h-5 px-1 rounded-full bg-[color:var(--color-primary)] text-white text-[10px] font-bold">
              {conv.unreadCount}
            </span>
          )}
        </div>
      </div>
      {conv.lastMessagePreview && (
        <p className="mt-1 ml-11 text-xs text-[color:var(--color-muted-foreground)] truncate">
          {conv.lastMessagePreview}
        </p>
      )}
      {conv.isBlocked && (
        <span className="mt-1 ml-11 inline-block text-[10px] font-semibold text-red-500">
          {t('whatsapp.blocked')}
        </span>
      )}
    </button>
  )
}

// ─── right panel: conversation detail ────────────────────────────────────────

// ─── 24h window check ────────────────────────────────────────────────────────

function is24hWindowOpen(lastInboundAt: string | null): boolean {
  if (!lastInboundAt) return false
  const diffMs = Date.now() - new Date(lastInboundAt).getTime()
  return diffMs < 24 * 60 * 60 * 1000
}

// ─── template picker ──────────────────────────────────────────────────────────

function TemplatePicker({
  templates,
  onSelect,
}: {
  templates: WhatsAppMessageTemplate[]
  onSelect: (content: string) => void
}) {
  const [open, setOpen] = useState(false)
  const active = useMemo(() => {
    const filtered = templates.filter(t => t.isActive && (t.channel === 'Genel' || t.channel === 'WhatsApp'))
    const pinnedName = 'KVKK Hoşgeldiniz'
    return [...filtered].sort((left, right) => {
      if (left.name === pinnedName) return -1
      if (right.name === pinnedName) return 1
      return left.name.localeCompare(right.name, 'tr')
    })
  }, [templates])

  if (active.length === 0) return null

  return (
    <div className="relative">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen(v => !v)}
        className="gap-1"
      >
        <FileText className="size-3.5" />
        Şablon
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 z-50 w-64 max-h-64 overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg">
          {active.map(tpl => (
            <button
              key={tpl.templateId}
              type="button"
              onClick={() => { onSelect(tpl.content); setOpen(false) }}
              className="w-full text-left px-3 py-2 hover:bg-[color:var(--color-surface-raised)] transition-colors"
            >
              <p className="text-xs font-semibold text-[color:var(--color-foreground)] truncate">{tpl.name}</p>
              <p className="text-[11px] text-[color:var(--color-muted-foreground)] truncate mt-0.5">{tpl.content}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── right panel: conversation detail ────────────────────────────────────────

function ConversationDetail({
  conversationId,
  templates,
  anchorAtUtc,
  anchorSocialMessageId,
  onReadMarked,
  onOpenCreateRequest,
  onOpenEditRequest,
  onOpenViewRequests,
}: {
  conversationId: string
  templates: WhatsAppMessageTemplate[]
  anchorAtUtc?: string | null
  anchorSocialMessageId?: string | null
  onReadMarked?: () => void
  onOpenCreateRequest: (socialMessageId: string) => void
  onOpenEditRequest: (socialMessageId: string, jobId: string) => void
  onOpenViewRequests: (citizenPhone: string) => void
}) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<CitizenConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [highlightEntryIndex, setHighlightEntryIndex] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const entryRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const anchorAppliedRef = useRef(false)

  const loadDetail = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getCitizenConversationDetail(conversationId)
      setDetail(data)
    } finally {
      setLoading(false)
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
      await loadDetail()
    } finally {
      setSending(false)
    }
  }

  const openTicket = detail?.tickets.slice().reverse().find(t => t.status !== 'Closed')
  const primaryTicket = openTicket ?? detail?.tickets[detail.tickets.length - 1]
  const windowOpen = is24hWindowOpen(detail?.lastInboundAt ?? null)

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Timeline */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
        style={{ background: 'linear-gradient(145deg, var(--color-header-from), var(--color-header-to))' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-5 animate-spin text-[color:var(--color-primary)]" />
          </div>
        ) : !detail || detail.timeline.length === 0 ? (
          <p className="text-center text-sm text-slate-400 mt-8">{t('social.noMessages', 'Henüz mesaj yok')}</p>
        ) : (
          detail.timeline.map((entry, index) => (
            <div
              key={entry.entryId || index}
              ref={element => {
                if (element) entryRefs.current.set(index, element)
                else entryRefs.current.delete(index)
              }}
              className={highlightEntryIndex === index ? 'rounded-2xl ring-2 ring-white/90 ring-offset-2 ring-offset-transparent transition-shadow' : undefined}
            >
              <EntryBubble entry={entry} />
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Linked ticket actions */}
      {detail && primaryTicket && (
        <div className="shrink-0 px-4 py-3.5 border-t border-[color:var(--color-border)] bg-slate-50 space-y-2.5">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <p className="text-sm font-bold text-[color:var(--color-muted-foreground)] shrink-0 underline underline-offset-4 decoration-[color:var(--color-muted-foreground)]">
              {t('whatsapp.tickets')}
            </p>
            {openTicket ? (
              <div className="ml-auto flex items-center justify-end gap-1.5 text-[11px] font-semibold text-right text-slate-900">
                {windowOpen
                  ? <><Clock className="size-3.5 shrink-0" /> 24 saatlik metin veya şablon gönderebilirsiniz</>
                  : <><AlertCircle className="size-3.5 shrink-0" /> 24 saatlik pencere kapalı — yalnızca şablon gönderilebilir</>
                }
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              type="button"
              variant="success"
              onClick={() => primaryTicket.jobId
                ? onOpenEditRequest(primaryTicket.socialMessageId, primaryTicket.jobId)
                : onOpenCreateRequest(primaryTicket.socialMessageId)}
            >
              {t('nav.createRequest', 'Talep Oluştur')}
            </Button>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => onOpenViewRequests(detail.citizenPhone)}
            >
              {t('whatsapp.viewRequestsByNumber', 'Numaranın Oluşturduğu Talepler')}
            </Button>
            <TemplatePicker
              templates={templates}
              onSelect={content => setReplyText(content)}
            />
          </div>
        </div>
      )}

      {/* Reply input */}
      {openTicket ? (
        <div className="shrink-0 border-t border-[color:var(--color-border)] bg-slate-50">
          <div className="flex items-end gap-2 px-3 pt-2.5 pb-2">
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
              placeholder={windowOpen ? t('whatsapp.replyPlaceholder') : 'Şablon seçin…'}
              disabled={!windowOpen && templates.filter(t => t.isActive && (t.channel === 'Genel' || t.channel === 'WhatsApp')).length === 0}
              className="field-input flex-1 resize-none min-h-[2.75rem] max-h-28 py-1.5 text-base disabled:opacity-50"
            />
            <Button
              size="sm"
              onClick={() => void handleSend()}
              disabled={!replyText.trim() || sending}
              className="shrink-0 self-end"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
          {!windowOpen ? (
            <div className="px-3 pb-2">
              <span className="text-[11px] text-amber-600 font-medium">Yalnızca şablon gönderilebilir</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-[color:var(--color-border)] bg-slate-50 shrink-0">
          <p className="text-xs text-[color:var(--color-muted-foreground)] text-center">{t('whatsapp.noTickets')}</p>
        </div>
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

  const handleReadMarked = useCallback(() => {
    setConversations(prev =>
      prev.map(c => c.citizenConversationId === selectedId ? { ...c, unreadCount: 0 } : c),
    )
  }, [selectedId])

  const handleOpenCreateRequest = useCallback(async (socialMessageId: string) => {
    try {
      setRequestModalEditJobId(null)
      setRequestModalMessage(await api.getSocialMessageById(socialMessageId))
    } catch {
      setRequestModalEditJobId(null)
      setRequestModalMessage(null)
    }
  }, [])

  const handleOpenEditRequest = useCallback(async (socialMessageId: string, jobId: string) => {
    try {
      setRequestModalEditJobId(jobId)
      setRequestModalMessage(await api.getSocialMessageById(socialMessageId))
    } catch {
      setRequestModalEditJobId(null)
      setRequestModalMessage(null)
    }
  }, [])

  const handleRequestCreated = useCallback(() => {
    setRequestModalMessage(null)
    setRequestModalEditJobId(null)
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
        <div className="w-80 shrink-0 flex flex-col border-r border-[color:var(--color-border)] bg-slate-50">
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
              templates={templates}
              anchorAtUtc={requestedAt || null}
              anchorSocialMessageId={requestedMessageId || null}
              onReadMarked={handleReadMarked}
              onOpenCreateRequest={socialMessageId => { void handleOpenCreateRequest(socialMessageId) }}
              onOpenEditRequest={(socialMessageId, jobId) => { void handleOpenEditRequest(socialMessageId, jobId) }}
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
          onClose={() => {
            setRequestModalMessage(null)
            setRequestModalEditJobId(null)
          }}
          onCreated={handleRequestCreated}
        />
      ) : null}
    </div>
  )
}
