import { useEffect, useLayoutEffect, useRef, useState, useCallback, Fragment, useMemo } from 'react'
import { ArrowDownUp, Check, ClipboardList, ClipboardPlus, FileText, Loader2, MoreVertical, Paperclip, PenLine, Save, Search, Send, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { ScopeChipDateRange } from '../components/ui/scope-chip-date-range'
import { TablePagination } from '../components/ui/table-pagination'
import { CitizenRequestModal } from '../components/CitizenRequestModal'
import type {
  CitizenConversationSummary,
  CitizenConversationDetail,
  CitizenConversationTimelineEntry,
  CitizenConversationTicket,
  Department,
  SocialMessage,
  UserQuickReplyTemplate,
} from '../types/platform'
import { getLocale } from '../utils/localization'
import { conversationSameDay, formatConversationDayDivider } from '../utils/conversationDayLabel'
import { ConversationEntryBubble } from '../components/ConversationEntryBubble'
import { ConfirmDialog, type ConfirmDialogState } from '../components/ui/confirm-dialog'
import { WhatsAppTemplatePicker } from '../components/WhatsAppTemplatePicker'
import { UserQuickReplyAddButton } from '../components/UserQuickReplyDialog'
import { formatConversationDisplayContent } from '../utils/socialConversationContent'
import { formatWhatsAppTicketLabel, isConversationTicketOpen, isUrgentConversationPriority, isWaitingForConversationResponse } from '../utils/whatsappConversationTicket'
import { DETAIL_ICON_PROPS } from '../components/jobs/my-request-detail/detailIcons'
import { matchesPhone, normalizePhone } from '../utils/phoneNormalization'
import { getNeighborhoodsForDistrict, getSavedDistrictId } from '../data/izmir-locations'
import { normalizeTitleCaseField } from '../utils/textNormalization'
import type { WhatsAppMessagePayload } from '../hooks/useSignalR'
import { SingleSelectDropdown } from '../components/ui/single-select-dropdown'
import { stringListSelectOptions } from '../utils/formDropdownOptions'
import { ADDRESS_OPEN_ADDRESS_MAX_LENGTH, ADDRESS_STREET_MAX_LENGTH } from '../utils/addressLimits'

// ─── helpers ────────────────────────────────────────────────────────────────

function formatPhone(phone: string): string {
  // Display E.164 as a readable number (e.g. 905301234567 → +90 530 123 45 67)
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('90')) {
    return `+90 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`
  }
  return `+${digits}`
}

function toLocalPhoneFilterDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('90')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

function formatLocalProfilePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('90')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

/** İsimden baş harfleri çıkarır (en fazla 2). Harf yoksa null döner. */
function getInitials(value: string): string | null {
  const words = value.trim().split(/\s+/).filter(w => /\p{L}/u.test(w))
  if (words.length === 0) return null
  return words.slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function DateDivider({ label, light = false }: { label: string; light?: boolean }) {
  return (
    <div className="flex justify-center py-1.5">
      <span
        className={
          light
            ? 'rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200/80'
            : 'rounded-full bg-black/25 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm'
        }
      >
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

function pickReplyTicket(tickets: CitizenConversationTicket[]): CitizenConversationTicket | undefined {
  const ordered = tickets.slice().reverse()
  const replyableStatuses = new Set(['New', 'Categorized', 'Routed', 'Responded'])
  return ordered.find(ticket => replyableStatuses.has(ticket.status))
    ?? ordered.find(ticket => ticket.status !== 'Closed')
}

function ConversationStatusCounts({
  intake,
  inProgress,
  completed,
  cancelled,
  compact = false,
  onOpenStatusRequests,
}: {
  intake?: number
  inProgress?: number
  completed?: number
  cancelled?: number
  compact?: boolean
  onOpenStatusRequests?: (value: ConversationStatusFilter) => void
}) {
  const { t } = useTranslation()
  const baseClass = compact ? 'text-[10px]' : 'text-[11px]'
  const counts: Array<{ value: ConversationStatusFilter; label: string; count: number; className: string }> = [
    { value: 'intake', label: t('whatsapp.intakeCountShort', 'İşleme Alınan'), count: intake ?? 0, className: 'text-slate-600 hover:bg-slate-200' },
    { value: 'in-progress', label: t('whatsapp.inProgressCount', 'Yapılmakta'), count: inProgress ?? 0, className: 'text-orange-600 hover:bg-orange-100' },
    { value: 'completed', label: t('whatsapp.completedCount', 'Tamamlandı'), count: completed ?? 0, className: 'text-emerald-700 hover:bg-emerald-100' },
    { value: 'cancelled', label: t('whatsapp.cancelledCount', 'İptal'), count: cancelled ?? 0, className: 'text-red-600 hover:bg-red-100' },
  ]
  return (
    <div className={`flex items-center gap-x-0.5 ${baseClass} font-semibold whitespace-nowrap`}>
      {counts.map(item => (
        <button
          key={item.value}
          type="button"
          onClick={event => {
            event.stopPropagation()
            onOpenStatusRequests?.(item.value)
          }}
          className={`shrink-0 rounded-md px-0.5 py-0.5 transition-colors ${item.className}`}
        >
          {item.label}: {item.count}
        </button>
      ))}
    </div>
  )
}

// ─── left panel: conversation list ────────────────────────────────────────────

type ConversationListFilter = 'all' | 'unread'
type ConversationSortOrder = 'newest' | 'oldest'
type ConversationStatusFilter = 'all' | 'intake' | 'in-progress' | 'completed' | 'cancelled'

function isRecentConversationTime(dateStr: string): boolean {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  return diffMin >= 0 && diffMin < 60
}

function ConversationListItem({
  conv,
  selected,
  onClick,
  onOpenStatusRequests,
}: {
  conv: CitizenConversationSummary
  selected: boolean
  onClick: () => void
  onOpenStatusRequests: (value: ConversationStatusFilter) => void
}) {
  const { i18n, t } = useTranslation()
  const locale = getLocale(i18n.language)
  const displayName = conv.citizenName ?? formatPhone(conv.citizenPhone)
  const phoneLabel = formatPhone(conv.citizenPhone)
  const initials = conv.citizenName ? getInitials(conv.citizenName) : null
  const isUrgent = isUrgentConversationPriority(conv.latestTicketPriority)
  const waitingForResponse = isWaitingForConversationResponse(conv)
  const ticketOpen = isConversationTicketOpen(conv)
  const timeLabel = new Date(conv.lastMessageAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const recentTime = isRecentConversationTime(conv.lastMessageAt)
  const responseStatus = waitingForResponse ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
      <span className="size-1.5 rounded-full bg-orange-500" aria-hidden="true" />
      {t('whatsapp.waitingForResponse', 'Yanıt bekliyor')}
    </span>
  ) : !waitingForResponse && ticketOpen ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
      <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      {t('whatsapp.ticketOpen', 'Yanıt verildi')}
    </span>
  ) : !ticketOpen && conv.openTicketCount === 0 && conv.latestTicketStatus ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
      <Check className="size-3" aria-hidden="true" />
      {t('whatsapp.ticketResolved', 'Çözüldü')}
    </span>
  ) : conv.isBlocked ? (
    <span className="inline-flex items-center rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
      {t('whatsapp.blocked')}
    </span>
  ) : null
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onClick()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`group w-full text-left px-3.5 py-3 border-b border-slate-100 transition-colors ${
        selected
          ? 'bg-emerald-50/90'
          : 'bg-white hover:bg-slate-50/80'
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="size-11 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-bold">
            {initials ?? <img src="/icons/whatsapp.webp" alt="" className="size-5" aria-hidden="true" />}
          </div>
          {(isUrgent || waitingForResponse || ticketOpen) && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-white ${
                isUrgent || waitingForResponse ? 'bg-orange-400' : 'bg-emerald-500'
              }`}
              aria-hidden="true"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="font-semibold text-[13px] text-slate-900 truncate">{displayName}</p>
              {isUrgent && (
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide uppercase bg-orange-100 text-orange-700">
                  {t('whatsapp.urgent', 'ACİL')}
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-[11px] font-medium ${recentTime ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {timeLabel}
                </span>
                {conv.unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-emerald-700 text-white text-[10px] font-bold leading-none">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
              {responseStatus ? (
                <div className="flex justify-end">
                  {responseStatus}
                </div>
              ) : null}
            </div>
          </div>

          {conv.citizenName ? (
            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{phoneLabel}</p>
          ) : null}

          <div className="mt-1.5">
            <ConversationStatusCounts
              compact
              intake={conv.intakeCount}
              inProgress={conv.inProgressCount}
              completed={conv.completedCount}
              cancelled={conv.cancelledCount}
              onOpenStatusRequests={onOpenStatusRequests}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ConversationListPanel({
  conversations,
  filtered,
  loading,
  search,
  onSearchChange,
  listFilter,
  onListFilterChange,
  sortOrder,
  onSortOrderChange,
  statusFilter,
  onOpenStatusRequests,
  selectedId,
  onSelect,
}: {
  conversations: CitizenConversationSummary[]
  filtered: CitizenConversationSummary[]
  loading: boolean
  search: string
  onSearchChange: (value: string) => void
  listFilter: ConversationListFilter
  onListFilterChange: (value: ConversationListFilter) => void
  sortOrder: ConversationSortOrder
  onSortOrderChange: (value: ConversationSortOrder) => void
  statusFilter: ConversationStatusFilter
  onOpenStatusRequests: (value: ConversationStatusFilter) => void
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const [conversationPage, setConversationPage] = useState(1)
  const [conversationPageSize, setConversationPageSize] = useState(10)

  const unreadCount = useMemo(
    () => conversations.filter(c => c.unreadCount > 0).length,
    [conversations],
  )

  const filterOptions: { value: ConversationListFilter; label: string; badge?: number }[] = [
    { value: 'all', label: t('whatsapp.listFilter.all', 'Tümü') },
    { value: 'unread', label: t('whatsapp.listFilter.unread', 'Okunmamış'), badge: unreadCount || undefined },
  ]

  const totalCounts = useMemo(
    () => conversations.reduce(
      (acc, conversation) => ({
        intake: acc.intake + (conversation.intakeCount ?? 0),
        inProgress: acc.inProgress + (conversation.inProgressCount ?? 0),
        completed: acc.completed + (conversation.completedCount ?? 0),
        cancelled: acc.cancelled + (conversation.cancelledCount ?? 0),
      }),
      { intake: 0, inProgress: 0, completed: 0, cancelled: 0 },
    ),
    [conversations],
  )

  const totalStatusCount = totalCounts.intake + totalCounts.inProgress + totalCounts.completed + totalCounts.cancelled

  const statusChips: Array<{ value: ConversationStatusFilter; label: string; count: number; className: string }> = [
    { value: 'intake', label: t('whatsapp.intakeCountShort', 'İşleme Alınan'), count: totalCounts.intake, className: 'text-slate-600 hover:bg-slate-200' },
    { value: 'in-progress', label: t('whatsapp.inProgressCount', 'Yapılmakta'), count: totalCounts.inProgress, className: 'text-orange-600 hover:bg-orange-100' },
    { value: 'completed', label: t('whatsapp.completedCount', 'Tamamlandı'), count: totalCounts.completed, className: 'text-emerald-700 hover:bg-emerald-100' },
    { value: 'cancelled', label: t('whatsapp.cancelledCount', 'İptal'), count: totalCounts.cancelled, className: 'text-red-600 hover:bg-red-100' },
  ]
  const totalConversationPages = Math.max(1, Math.ceil(filtered.length / conversationPageSize))
  const currentConversationPage = Math.min(conversationPage, totalConversationPages)
  const pagedFiltered = useMemo(
    () => filtered.slice((currentConversationPage - 1) * conversationPageSize, currentConversationPage * conversationPageSize),
    [currentConversationPage, conversationPageSize, filtered],
  )

  return (
    <div className="flex max-h-[58dvh] w-full shrink-0 flex-col border-b border-[color:var(--color-border)] bg-white shadow-[inset_0_-1px_0_rgba(15,23,42,0.04)] md:max-h-none md:h-full md:min-h-0 md:w-[21.5rem] md:border-b-0 md:border-r md:shadow-[inset_-1px_0_0_rgba(15,23,42,0.04)]">
      <div className="shrink-0 px-4 pt-4 pb-3 space-y-3 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <h2 className="text-base font-bold text-slate-900">{t('whatsapp.conversationsTitle', 'Konuşmalar')}</h2>
            <span className="text-sm font-semibold text-emerald-700">{conversations.length}</span>
          </div>
          <button
            type="button"
            onClick={() => onSortOrderChange(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label={t('whatsapp.sort', 'Sırala')}
          >
            <ArrowDownUp className="size-3.5" aria-hidden="true" />
            {t('whatsapp.sort', 'Sırala')}
          </button>
        </div>

        <div className="flex items-center">
          <button
            type="button"
            onClick={() => onOpenStatusRequests('all')}
            className={`shrink-0 rounded-md px-1 py-0.5 text-[10px] font-bold text-slate-900 transition-colors hover:bg-slate-100 ${statusFilter === 'all' ? 'bg-slate-100 ring-1 ring-slate-200' : ''}`}
          >
            {t('whatsapp.listFilter.all', 'Tümü')}: {totalStatusCount}
          </button>
        </div>

        <div className="flex items-center gap-x-0.5 overflow-hidden whitespace-nowrap">
          {statusChips.map(chip => (
            <button
              key={chip.value}
              type="button"
              onClick={() => onOpenStatusRequests(chip.value)}
              className={`shrink-0 rounded-md px-0.5 py-0.5 text-[10px] font-bold transition-colors ${chip.className} ${statusFilter === chip.value ? 'bg-slate-100 ring-1 ring-slate-200' : ''}`}
            >
              {chip.label}: {chip.count}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={event => {
              setConversationPage(1)
              onSearchChange(event.target.value)
            }}
            placeholder={t('whatsapp.searchPlaceholderExtended', 'Telefon no, vatandaş adı…')}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600/40"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setConversationPage(1)
                onSearchChange('')
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:text-slate-600"
              aria-label={t('common.clear', 'Temizle')}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filterOptions.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setConversationPage(1)
                onListFilterChange(option.value)
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                listFilter === option.value
                  ? 'bg-emerald-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {option.label}
              {option.badge != null && option.badge > 0 ? (
                <span className={`inline-flex min-w-[1rem] h-4 px-1 items-center justify-center rounded-full text-[10px] font-bold ${
                  listFilter === option.value ? 'bg-red-500 text-white' : 'bg-red-500 text-white'
                }`}>
                  {option.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="size-5 animate-spin text-[color:var(--color-primary)]" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-[color:var(--color-muted-foreground)] mt-8 px-4">
            {t('whatsapp.empty')}
          </p>
        ) : (
          pagedFiltered.map(conv => (
            <ConversationListItem
              key={conv.citizenConversationId}
              conv={conv}
              selected={conv.citizenConversationId === selectedId}
              onClick={() => onSelect(conv.citizenConversationId)}
              onOpenStatusRequests={onOpenStatusRequests}
            />
          ))
        )}
      </div>
      <TablePagination
        totalCount={filtered.length}
        pageSize={conversationPageSize}
        currentPage={currentConversationPage}
        onPageSizeChange={size => {
          setConversationPageSize(size)
          setConversationPage(1)
        }}
        onPageChange={setConversationPage}
        pageSizeOptions={[10, 25, 50]}
        className="whatsapp-conversation-pagination"
      />
    </div>
  )
}

// ─── 24h window check ────────────────────────────────────────────────────────

function is24hWindowOpen(lastInboundAt: string | null): boolean {
  if (!lastInboundAt) return false
  const diffMs = Date.now() - new Date(lastInboundAt).getTime()
  return diffMs < 24 * 60 * 60 * 1000
}

// ─── right panel: conversation detail ────────────────────────────────────────

type ConversationProfileDraft = {
  citizenName: string
  citizenPhone: string
  label: string
  neighborhood: string
  street: string
  openAddress: string
}

function createProfileDraft(detail: CitizenConversationDetail | null, fallbackPhone?: string | null, fallbackName?: string | null): ConversationProfileDraft {
  return {
    citizenName: detail?.citizenName ?? fallbackName ?? '',
    citizenPhone: detail?.citizenPhone ?? fallbackPhone ?? '',
    label: detail?.label ?? '',
    neighborhood: detail?.neighborhood ?? '',
    street: detail?.street ?? '',
    openAddress: detail?.openAddress ?? '',
  }
}

function ConversationProfilePanel({
  detail,
  draft,
  saving,
  onDraftChange,
  onSave,
}: {
  detail: CitizenConversationDetail | null
  draft: ConversationProfileDraft
  saving: boolean
  onDraftChange: (patch: Partial<ConversationProfileDraft>) => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(getSavedDistrictId()), [])
  const neighborhoodOptions = useMemo(() => stringListSelectOptions(neighborhoods), [neighborhoods])
  const hasNeighborhood = draft.neighborhood.trim().length > 0

  const fieldClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
  const disabledFieldClass = `${fieldClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`
  const labelClass = 'text-[10px] font-bold uppercase tracking-wide text-slate-500'

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-slate-200 bg-slate-50/80 p-4 lg:flex">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">{t('whatsapp.citizenProfile', 'Vatandaş Bilgileri')}</h3>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !detail}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-700 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {t('common.save', 'Kaydet')}
        </button>
      </div>

      <div className="space-y-3">
        <label className="block space-y-1">
          <span className={labelClass}>{t('whatsapp.citizenName', 'Vatandaş Adı')}</span>
          <input className={fieldClass} value={draft.citizenName} onChange={event => onDraftChange({ citizenName: event.target.value })} />
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>{t('whatsapp.phoneNumber', 'Numara')}</span>
          <input className={disabledFieldClass} value={formatLocalProfilePhone(draft.citizenPhone)} readOnly disabled />
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>{t('whatsapp.label', 'Talep Etiketi')}</span>
          <input className={fieldClass} value={draft.label} onChange={event => onDraftChange({ label: event.target.value })} />
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>{t('address.neighborhood', 'Mahalle')}</span>
          <SingleSelectDropdown
            openUp
            searchable
            options={neighborhoodOptions}
            value={draft.neighborhood}
            onChange={neighborhood => onDraftChange(neighborhood
              ? { neighborhood }
              : { neighborhood: '', street: '', openAddress: '' })}
            placeholder={t('address.neighborhoodPlaceholder', 'Mahalle seçin')}
          />
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>{t('address.street', 'Cadde / Sokak / Bulvar')}</span>
          <input className={disabledFieldClass} maxLength={ADDRESS_STREET_MAX_LENGTH} value={draft.street} onChange={event => onDraftChange({ street: event.target.value })} disabled={!hasNeighborhood} />
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>{t('address.openAddress', 'Açık Adres')}</span>
          <textarea
            rows={4}
            className={`${disabledFieldClass} min-h-[6rem] resize-none`}
            maxLength={ADDRESS_OPEN_ADDRESS_MAX_LENGTH}
            value={draft.openAddress}
            onChange={event => onDraftChange({ openAddress: event.target.value })}
            disabled={!hasNeighborhood}
          />
        </label>
      </div>

    </aside>
  )
}

function ConversationDetail({
  conversationId,
  citizenName,
  citizenPhone,
  userQuickReplies,
  onUserQuickRepliesChanged,
  anchorAtUtc,
  anchorSocialMessageId,
  onReadMarked,
  onOpenCreateRequest,
  onOpenViewRequests,
  onProfileSaved,
}: {
  conversationId: string
  citizenName?: string | null
  citizenPhone?: string | null
  userQuickReplies: UserQuickReplyTemplate[]
  onUserQuickRepliesChanged: () => void
  anchorAtUtc?: string | null
  anchorSocialMessageId?: string | null
  onReadMarked?: () => void
  onOpenCreateRequest: (socialMessageId: string) => void
  onOpenViewRequests: (citizenPhone: string) => void
  onProfileSaved: () => void
}) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const locale = getLocale(i18n.language)
  const dayLabel = (iso: string) => formatConversationDayDivider(iso, locale, t)
  // Beklemedeki mesajı yalnızca Vatandaş Operatörü (veya SystemAdmin) iletebilir — card #1091.
  const canSendPending = user?.role === 'Operator' || user?.role === 'SystemAdmin'
  const [detail, setDetail] = useState<CitizenConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [sendingPendingId, setSendingPendingId] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [sending, setSending] = useState(false)
  const [chatSearch, setChatSearch] = useState('')
  const [showChatSearch, setShowChatSearch] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileDraft, setProfileDraft] = useState<ConversationProfileDraft>(() => createProfileDraft(null, citizenPhone, citizenName))
  const [profileSaving, setProfileSaving] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingFileEditing, setPendingFileEditing] = useState(false)
  const [pendingFilePreviewUrl, setPendingFilePreviewUrl] = useState<string | null>(null)
  const [internalDepartmentId, setInternalDepartmentId] = useState('')
  const [sendingInternal, setSendingInternal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [highlightEntryIndex, setHighlightEntryIndex] = useState<number | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const entryRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const anchorAppliedRef = useRef(false)

  useEffect(() => {
    setProfileDraft(createProfileDraft(detail, citizenPhone, citizenName))
  }, [citizenName, citizenPhone, detail])

  useEffect(() => {
    if (!pendingFile) {
      setPendingFilePreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(pendingFile)
    setPendingFilePreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [pendingFile])

  const updatePinnedToBottom = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    setIsPinnedToBottom(distanceFromBottom <= 80)
  }, [])

  const loadDetail = useCallback(async () => {
    setLoading(true)
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
      if (data.unreadCount > 0) {
        await api.markConversationRead(conversationId)
        onReadMarked?.()
      }
    } catch {
      // Keep the current timeline visible if a background refresh fails.
    }
  }, [conversationId, onReadMarked])

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
    setIsPinnedToBottom(true)
  }, [conversationId, anchorAtUtc, anchorSocialMessageId])

  useLayoutEffect(() => {
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

    if (!anchorAtUtc && isPinnedToBottom) {
      // Görünür kaydırma animasyonu olmadan doğrudan son mesaj konumunda aç (card #1349);
      // ilk açılışta medya yüklendikçe içerik uzadığı için kısa bir süre dibe sabitlenir.
      const firstOpen = !anchorAppliedRef.current
      anchorAppliedRef.current = true
      const pinToBottom = () => {
        const el = scrollContainerRef.current
        if (el) el.scrollTop = el.scrollHeight
      }
      pinToBottom()
      if (firstOpen) {
        const startedAt = performance.now()
        let raf = window.requestAnimationFrame(function tick() {
          pinToBottom()
          if (performance.now() - startedAt < 800) raf = window.requestAnimationFrame(tick)
        })
        return () => window.cancelAnimationFrame(raf)
      }
    }
  }, [anchorAtUtc, anchorSocialMessageId, detail, isPinnedToBottom, loading])

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
    if ((!text && !pendingFile) || sending || !detail) return

    if (!is24hWindowOpen(detail.lastInboundAt ?? null)) {
      setConfirmDialog({
        title: 'Onaylı Şablon Mesajı',
        titleDivider: true,
        message: '24 saat geçtikten sonra vatandaş yeniden mesaj atmadıysa, sadece onaylanmış mesaj şablonu kullanarak konuşmayı yeniden başlatabilirsiniz.',
        hideCancel: true,
        confirmLabel: 'Çıkış',
        onConfirm: () => {},
      })
      return
    }

    const openTicket = pickReplyTicket(detail.tickets)
    if (!openTicket) return

    setSending(true)
    try {
      if (pendingFile) {
        await api.replySocialMessageAttachment(openTicket.socialMessageId, pendingFile, text, true)
      } else {
        await api.replySocialMessage(openTicket.socialMessageId, text, true)
      }
      setReplyText('')
      setPendingFile(null)
      setPendingFileEditing(false)
      setIsPinnedToBottom(true)
      await refreshDetail()
    } finally {
      setSending(false)
    }
  }

  const handleProfileSave = async () => {
    if (!detail || profileSaving) return
    setProfileSaving(true)
    try {
      await api.updateCitizenConversationProfile(detail.citizenConversationId, {
        ...profileDraft,
        citizenName: normalizeTitleCaseField(profileDraft.citizenName) ?? '',
        label: normalizeTitleCaseField(profileDraft.label) ?? '',
        neighborhood: normalizeTitleCaseField(profileDraft.neighborhood) ?? '',
        street: normalizeTitleCaseField(profileDraft.street) ?? '',
        openAddress: normalizeTitleCaseField(profileDraft.openAddress) ?? '',
      })
      await refreshDetail()
      onProfileSaved()
    } finally {
      setProfileSaving(false)
    }
  }

  const handleSendInternal = async () => {
    const text = replyText.trim()
    const targetTicket = detail?.tickets.find(ticket => ticket.departmentId === internalDepartmentId) ?? primaryTicket
    if (!text || !internalDepartmentId || !targetTicket || sendingInternal) return
    setSendingInternal(true)
    try {
      await api.addInternalConversationMessage(targetTicket.socialMessageId, internalDepartmentId, text)
      setReplyText('')
      setIsPinnedToBottom(true)
      await refreshDetail()
    } finally {
      setSendingInternal(false)
    }
  }

  const doSendPending = async (entry: CitizenConversationTimelineEntry) => {
    if (sendingPendingId) return
    setSendingPendingId(entry.entryId)
    try {
      await api.sendPendingConversationEntry(entry.socialMessageId, entry.entryId)
      setIsPinnedToBottom(true)
      await refreshDetail()
    } finally {
      setSendingPendingId(null)
    }
  }

  // "Mesajı Gönder" önce onay pop-up'ı gösterir; onaylanınca vatandaşa iletilir (card #1096).
  const handleSendPending = (entry: CitizenConversationTimelineEntry) => {
    setConfirmDialog({
      title: t('whatsapp.sendPendingConfirmTitle', 'Mesajı Gönder'),
      titleDivider: true,
      message: t('whatsapp.sendPendingConfirmMessage', 'Bu mesaj vatandaşa WhatsApp üzerinden iletilecek. Onaylıyor musunuz?'),
      confirmLabel: t('whatsapp.sendPendingMessage', 'Mesajı Gönder'),
      variant: 'success',
      onConfirm: () => doSendPending(entry),
    })
  }

  const handleEditPending = async (entry: CitizenConversationTimelineEntry, content: string) => {
    await api.editPendingConversationEntry(entry.socialMessageId, entry.entryId, content)
    await refreshDetail()
  }

  const handleShowTerminalNote = (entry: CitizenConversationTimelineEntry) => {
    const isCancelled = entry.relatedJobTerminalStatus === 'Cancelled'
    setConfirmDialog({
      title: isCancelled
        ? t('tasks.detail.cancelNote', 'İptal Notu')
        : t('jobs.detail.completionResultNote', 'Tamamlanma Notu'),
      titleDivider: true,
      titleTone: isCancelled ? 'danger' : 'success',
      message: entry.relatedJobTerminalNote ?? '',
      hideCancel: true,
      confirmLabel: t('common.close', 'Kapat'),
      variant: isCancelled ? 'destructive' : 'success',
      onConfirm: () => {},
    })
  }

  const openTicket = detail ? pickReplyTicket(detail.tickets) : undefined
  const primaryTicket = openTicket ?? detail?.tickets[detail.tickets.length - 1]
  const internalDepartmentOptions = useMemo(() => {
    const activeStatuses = new Set(['Draft', 'PendingOwnerApproval', 'PendingExternalApproval', 'RevisionRequested', 'Active'])
    const options = new Map<string, string>()
    for (const ticket of detail?.tickets ?? []) {
      if (!ticket.jobStatus || !activeStatuses.has(ticket.jobStatus) || !ticket.departmentId || !ticket.departmentName) continue
      options.set(ticket.departmentId, ticket.departmentName)
    }
    return Array.from(options, ([departmentId, name]) => ({ departmentId, name }))
  }, [detail?.tickets])

  useEffect(() => {
    if (!internalDepartmentId) return
    if (!internalDepartmentOptions.some(department => department.departmentId === internalDepartmentId)) {
      setInternalDepartmentId('')
    }
  }, [internalDepartmentId, internalDepartmentOptions])

  const windowOpen = is24hWindowOpen(detail?.lastInboundAt ?? null)
  const hasSelectableTemplates = userQuickReplies.length > 0

  const phoneForHeader = citizenPhone ?? detail?.citizenPhone ?? null
  const headerTitle = citizenName?.trim() || (phoneForHeader ? formatPhone(phoneForHeader) : t('social.conversation', 'Konuşma'))
  const headerInitials = citizenName ? getInitials(citizenName) : null
  const ticketLabel = detail
    ? `Talep Sayısı: ${detail.intakeCount + detail.inProgressCount + detail.completedCount + detail.cancelledCount}`
    : formatWhatsAppTicketLabel(primaryTicket)
  // Header'daki "Görev Sahibi" listesi yalnız Yapılmakta (Job Active) taleplerin görevlilerini
  // gösterir; tamamlanan/iptal edilen taleplerin personel adları düşer (card #1372).
  const taskOwnerLabel = detail?.tickets.reduce<string[]>((owners, ticket) => {
    if (ticket.jobStatus !== 'Active') return owners
    const assigneeName = ticket.jobId ? ticket.assigneeDisplayName?.trim() : null
    if (assigneeName && !owners.includes(assigneeName)) owners.push(assigneeName)
    return owners
  }, []).join(', ') || null
  const showUrgentBadge = isUrgentConversationPriority(primaryTicket?.priority)
  const headerSubtitleParts: string[] = []
  if (citizenName?.trim() && phoneForHeader) {
    headerSubtitleParts.push(formatPhone(phoneForHeader))
  }
  const normalizedChatSearch = chatSearch.trim().toLocaleLowerCase('tr')
  const visibleTimeline = useMemo(() => {
    if (!detail) return []
    if (!normalizedChatSearch) return detail.timeline
    return detail.timeline.filter(entry =>
      formatConversationDisplayContent(entry.content).toLocaleLowerCase('tr').includes(normalizedChatSearch)
      || (entry.senderLabel ?? '').toLocaleLowerCase('tr').includes(normalizedChatSearch),
    )
  }, [detail, normalizedChatSearch])

  return (
    <div className="flex h-full flex-col bg-white text-[color:var(--color-foreground)]">
      <header className="flex shrink-0 items-start gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
          {headerInitials ?? <img src="/icons/whatsapp.webp" alt="" className="size-6" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[15px] font-semibold leading-tight text-slate-900">{headerTitle}</p>
            {showUrgentBadge ? (
              <span className="shrink-0 rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-amber-950">
                ACİL
              </span>
            ) : null}
          </div>
          {headerSubtitleParts.length > 0 ? (
            <p className="truncate text-xs text-slate-500">{headerSubtitleParts.join(' · ')}</p>
          ) : null}
          {ticketLabel ? (
            <p className="mt-1 truncate text-[11px] font-semibold text-slate-600">
              <button
                type="button"
                className="font-bold text-slate-700 underline-offset-2 hover:text-emerald-700 hover:underline"
                onClick={() => phoneForHeader && onOpenViewRequests(phoneForHeader)}
              >
                {ticketLabel}
              </button>
              {taskOwnerLabel ? (
                <>
                  <span className="mx-1 text-slate-400">|</span>
                  <span>{t('tasks.columns.owner', 'Görev Sahibi')}: {taskOwnerLabel}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            aria-label={t('common.search', 'Ara')}
            onClick={() => setShowChatSearch(current => !current)}
            className="flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <Search className="size-4" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label={t('common.more', 'Diğer')}
              onClick={() => setMenuOpen(current => !current)}
              className="flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              <MoreVertical className="size-4" />
            </button>
            {menuOpen ? (
              <div className="dropdown-menu-panel absolute right-0 top-full z-20 mt-1 min-w-[13rem] py-1">
                {primaryTicket ? (
                  <>
                    <button
                      type="button"
                      className="dropdown-menu-item !justify-start gap-2.5"
                      onClick={() => {
                        setMenuOpen(false)
                        onOpenCreateRequest(primaryTicket.socialMessageId)
                      }}
                    >
                      <ClipboardPlus {...DETAIL_ICON_PROPS} className="size-4 text-emerald-600" />
                      {t('nav.createRequest', 'Talep oluştur')}
                    </button>
                    <div className="mx-3 border-t border-slate-200" role="separator" />
                  </>
                ) : null}
                <button
                  type="button"
                  className="dropdown-menu-item !justify-start gap-2.5"
                  onClick={() => {
                    setMenuOpen(false)
                    if (detail) onOpenViewRequests(detail.citizenPhone)
                  }}
                >
                  <ClipboardList {...DETAIL_ICON_PROPS} />
                  {t('whatsapp.viewRequestsByNumber', 'Numaranın Talepleri')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {showChatSearch ? (
            <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2">
              <input
                type="search"
                value={chatSearch}
                onChange={event => setChatSearch(event.target.value)}
                placeholder={t('whatsapp.searchInConversation', 'Konuşmada ara…')}
                className="field-input w-full py-2 text-sm"
              />
            </div>
          ) : null}

          <div
            ref={scrollContainerRef}
            onScroll={updatePinnedToBottom}
            className="whatsapp-chat-bg min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4"
          >
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-5 animate-spin text-[color:var(--color-primary)]" />
              </div>
            ) : !detail || visibleTimeline.length === 0 ? (
              <p className="mt-8 text-center text-sm text-slate-500">
                {normalizedChatSearch ? t('whatsapp.searchNoResults', 'Eşleşen mesaj yok.') : t('social.noMessages', 'Henüz mesaj yok')}
              </p>
            ) : (
              visibleTimeline.map((entry, index) => {
                const previousEntry = index > 0 ? visibleTimeline[index - 1] : null
                const showDivider = index === 0 || (previousEntry && !conversationSameDay(entry.sentAt, previousEntry.sentAt))
                return (
                  <Fragment key={entry.entryId || index}>
                    {showDivider ? <DateDivider light label={dayLabel(entry.sentAt)} /> : null}
                    <div
                      ref={element => {
                        if (element) entryRefs.current.set(index, element)
                        else entryRefs.current.delete(index)
                      }}
                      className={highlightEntryIndex === index ? 'rounded-2xl ring-2 ring-[color:var(--color-primary)] ring-offset-2 ring-offset-[var(--wa-chat-bg)] transition-shadow' : undefined}
                    >
                      <ConversationEntryBubble
                        entry={entry}
                        theme="light"
                        canSendPending={canSendPending}
                        onSendPending={() => handleSendPending(entry)}
                        sendingPending={sendingPendingId === entry.entryId}
                        onEditPending={(_entryId, content) => handleEditPending(entry, content)}
                        onShowTerminalNote={() => handleShowTerminalNote(entry)}
                      />
                    </div>
                  </Fragment>
                )
              })
            )}
            {pendingFile ? (
              <div className="flex flex-col items-end">
                <div className="max-w-[min(72%,28rem)] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white shadow-md ring-1 ring-white/10" style={{ background: 'var(--color-header-from)' }}>
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate font-semibold">{pendingFile.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingFile(null)
                        setPendingFileEditing(false)
                      }}
                      disabled={sending}
                      className="ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 disabled:opacity-60"
                      aria-label={t('common.dismiss', 'Vazgeç')}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  {pendingFile.type.startsWith('image/') && pendingFilePreviewUrl ? (
                    <img
                      src={pendingFilePreviewUrl}
                      alt={pendingFile.name}
                      className="mt-2 max-h-56 w-full rounded-xl border border-white/20 object-contain bg-white/95"
                    />
                  ) : (
                    <div className="mt-2 flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2 text-xs font-semibold text-white/90">
                      <FileText className="size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate">{pendingFile.type || t('attachments.file', 'Dosya')}</span>
                      <span className="shrink-0 text-white/65">{formatFileSize(pendingFile.size)}</span>
                    </div>
                  )}
                  {pendingFileEditing ? (
                    <textarea
                      rows={2}
                      value={replyText}
                      onChange={event => setReplyText(event.target.value)}
                      placeholder={t('whatsapp.attachmentCaptionPlaceholder', 'Ek açıklaması yaz...')}
                      className="mt-2 w-full min-w-[14rem] resize-none rounded-lg bg-white/95 px-2 py-1.5 text-sm leading-snug text-slate-900 outline-none ring-1 ring-white/40"
                    />
                  ) : replyText.trim() ? (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">{replyText.trim()}</p>
                  ) : null}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPendingFileEditing(current => !current)}
                    disabled={sending}
                    className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {t('common.edit', 'Düzenle')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    {t('whatsapp.sendPendingMessage', 'Mesajı Gönder')}
                  </button>
                </div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          {openTicket ? (
            <footer className="shrink-0 space-y-3 border-t border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenCreateRequest(primaryTicket!.socialMessageId)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <ClipboardPlus className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  {t('nav.createRequest', 'Talep oluştur')}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={event => {
                    const file = event.target.files?.[0] ?? null
                    setPendingFile(file)
                    setPendingFileEditing(false)
                    if (file) {
                      setIsPinnedToBottom(true)
                      window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
                    }
                    if (event.target) event.target.value = ''
                  }}
                />
                <WhatsAppTemplatePicker
                  userQuickReplies={userQuickReplies}
                  onSelect={content => setReplyText(content)}
                />
                <UserQuickReplyAddButton onChanged={onUserQuickRepliesChanged} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Paperclip className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  {t('attachments.addFile', 'Dosya ekle')}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={internalDepartmentId}
                  onChange={event => setInternalDepartmentId(event.target.value)}
                  className="h-9 min-w-44 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  aria-label={t('departments.selectDepartment', 'Birim seçin')}
                >
                  <option value="">{t('departments.selectDepartment', 'Birim seçin')}</option>
                  {internalDepartmentOptions.map(department => (
                    <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleSendInternal()}
                  disabled={!replyText.trim() || !internalDepartmentId || sendingInternal}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingInternal ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  {t('whatsapp.sendInternalMessage', 'Kurum İçi İlet')}
                </button>
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
                  disabled={!windowOpen && !hasSelectableTemplates}
                  className="field-input min-h-[3.25rem] max-h-28 flex-1 resize-none bg-slate-50 py-3 text-sm disabled:opacity-50"
                />
                <button
                  type="button"
                  aria-label={t('common.send', 'Gönder')}
                  onClick={() => void handleSend()}
                  disabled={(!replyText.trim() && !pendingFile) || sending}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-header-from)' }}
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </button>
              </div>
            </footer>
          ) : (
            <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500">
              {t('whatsapp.noTickets')}
            </footer>
          )}
        </div>
        <ConversationProfilePanel
          detail={detail}
          draft={profileDraft}
          saving={profileSaving}
          onDraftChange={patch => setProfileDraft(current => ({ ...current, ...patch }))}
          onSave={() => { void handleProfileSave() }}
        />
      </div>
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
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
  const [userQuickReplies, setUserQuickReplies] = useState<UserQuickReplyTemplate[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [requestModalMessage, setRequestModalMessage] = useState<SocialMessage | null>(null)
  const [requestModalEditJobId, setRequestModalEditJobId] = useState<string | null>(null)
  const [requestModalForceNew, setRequestModalForceNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('phone') ?? '')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [listFilter, setListFilter] = useState<ConversationListFilter>('all')
  const [statusFilter] = useState<ConversationStatusFilter>('all')
  const [sortOrder, setSortOrder] = useState<ConversationSortOrder>('newest')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)

  const loadConversations = useCallback(async () => {
    setLoading(true)
    try {
      const [convResult, quickReplyResult, departmentResult] = await Promise.allSettled([
        api.getCitizenConversations(),
        api.getUserQuickReplies(),
        api.getDepartments(),
      ])
      if (convResult.status === 'fulfilled') {
        setConversations(convResult.value)
      }
      if (quickReplyResult.status === 'fulfilled') {
        setUserQuickReplies(quickReplyResult.value)
      }
      if (departmentResult.status === 'fulfilled') {
        setDepartments(departmentResult.value)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const silentRefreshConversations = useCallback(async () => {
    try {
      const data = await api.getCitizenConversations()
      setConversations(data)
    } catch {
      // Ignore background refresh failures.
    }
  }, [])

  const refreshUserQuickReplies = useCallback(async () => {
    try {
      setUserQuickReplies(await api.getUserQuickReplies())
    } catch {
      // Ignore background refresh failures.
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
  const normalizedSearchTicket = search.replace(/\D/g, '')
  const filtered = useMemo(() => {
    const matches = conversations.filter(conversation => {
      const ticketNumber = conversation.latestCitizenRequestNumber?.toString() ?? ''
      const matchesSearch = normalizedSearchPhone.length === 0 && normalizedSearchName.length === 0
        ? true
        : (normalizedSearchPhone.length > 0 && normalizePhone(conversation.citizenPhone).includes(normalizedSearchPhone))
          || (conversation.citizenName ?? '').toLocaleLowerCase('tr').includes(normalizedSearchName)
          || normalizePhone(conversation.citizenPhone).includes(normalizedSearchPhone)
          || (normalizedSearchTicket.length > 0 && ticketNumber.includes(normalizedSearchTicket))
      if (!matchesSearch) return false
      if (filterFrom || filterTo) {
        const date = conversation.lastMessageAt.slice(0, 10)
        if (filterFrom && date < filterFrom.slice(0, 10)) return false
        if (filterTo && date > filterTo.slice(0, 10)) return false
      }
      if (listFilter === 'unread' && conversation.unreadCount <= 0) return false
      if (statusFilter === 'intake' && (conversation.intakeCount ?? 0) <= 0) return false
      if (statusFilter === 'in-progress' && (conversation.inProgressCount ?? 0) <= 0) return false
      if (statusFilter === 'completed' && (conversation.completedCount ?? 0) <= 0) return false
      if (statusFilter === 'cancelled' && (conversation.cancelledCount ?? 0) <= 0) return false
      return true
    })

    return matches.sort((a, b) => {
      const aTime = new Date(a.lastMessageAt).getTime()
      const bTime = new Date(b.lastMessageAt).getTime()
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime
    })
  }, [conversations, filterFrom, filterTo, listFilter, normalizedSearchName, normalizedSearchPhone, normalizedSearchTicket, sortOrder, statusFilter])

  // Sayfa açılışında sağ panel boş kalmasın diye ilk (en üstteki) konuşma otomatik seçilir —
  // tıklandığında açılan görünüm varsayılan olarak gelir. Bir kere tetiklenir; kullanıcının
  // sonraki seçimini veya ?phone= ile hedeflenen seçimi geçersiz kılmaz (card #1441).
  const autoSelectedRef = useRef(false)
  useEffect(() => {
    if (autoSelectedRef.current) return
    if (requestedPhone) { autoSelectedRef.current = true; return }
    if (selectedId) { autoSelectedRef.current = true; return }
    if (filtered.length === 0) return
    autoSelectedRef.current = true
    setSelectedId(filtered[0].citizenConversationId)
  }, [filtered, requestedPhone, selectedId])

  const selectedConv = conversations.find(c => c.citizenConversationId === selectedId) ?? null

  const handleReadMarked = useCallback(() => {
    setConversations(prev =>
      prev.map(c => c.citizenConversationId === selectedId ? { ...c, unreadCount: 0 } : c),
    )
  }, [selectedId])

  useEffect(() => {
    const detail = selectedId
      ? {
          citizenConversationId: selectedId,
          citizenPhone: selectedConv?.citizenPhone ?? '',
        }
      : null
    window.dispatchEvent(new CustomEvent('ccc:whatsapp-active-conversation', { detail }))
    return () => {
      window.dispatchEvent(new CustomEvent('ccc:whatsapp-active-conversation', { detail: null }))
    }
  }, [selectedId, selectedConv?.citizenPhone])

  useEffect(() => {
    function handleIncomingWhatsAppMessage(event: Event) {
      const payload = (event as CustomEvent<WhatsAppMessagePayload>).detail
      if (!selectedId) {
        void silentRefreshConversations()
        return
      }

      const matchesSelected = payload.citizenConversationId === selectedId
        || (selectedConv?.citizenPhone && matchesPhone(payload.citizenPhone, selectedConv.citizenPhone))

      if (matchesSelected) {
        // Birim içi ileti bildirimi diğer ilgili kullanıcıların rozetini sıfırlamasın
        // diye açık konuşmada otomatik markRead atlanır (card #1295).
        if (!payload.isInternal) {
          void api.markConversationRead(selectedId)
            .then(() => handleReadMarked())
            .catch(() => {})
        }
        setDetailRefreshKey(key => key + 1)
        return
      }

      setConversations(prev => prev.map(conversation => (
        conversation.citizenConversationId === payload.citizenConversationId
          ? {
              ...conversation,
              unreadCount: payload.unreadCount,
              lastMessageAt: payload.lastMessageAt,
              lastMessagePreview: payload.messagePreview ?? conversation.lastMessagePreview,
            }
          : conversation
      )))
    }

    window.addEventListener('ccc:whatsapp-message', handleIncomingWhatsAppMessage)
    return () => window.removeEventListener('ccc:whatsapp-message', handleIncomingWhatsAppMessage)
  }, [handleReadMarked, selectedConv?.citizenPhone, selectedId, silentRefreshConversations])

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

  const handleOpenStatusRequests = useCallback((status: ConversationStatusFilter) => {
    const params = new URLSearchParams()
    params.set('channel', 'WhatsApp')
    if (status !== 'all') {
      params.set('requestStatus', status === 'intake' ? 'processing-received' : status)
    }
    navigate(`/social?${params.toString()}`)
  }, [navigate])

  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelectedId(conversationId)
    if (requestedPhone || requestedAt || requestedMessageId) {
      navigate('/whatsapp', { replace: true })
    }
  }, [navigate, requestedAt, requestedMessageId, requestedPhone])

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
              <ScopeChipDateRange
                from={filterFrom}
                to={filterTo}
                onFromChange={setFilterFrom}
                onToChange={setFilterTo}
                fromPlaceholder={t('filters.startDate', 'Başlangıç tarihi')}
                toPlaceholder={t('filters.endDate', 'Bitiş tarihi')}
                forceDown
              />
            </div>
          </div>
        </div>
      </header>

      {/* Split panel layout */}
      <div className="flex flex-1 min-h-0 flex-col overflow-visible rounded-xl border border-[color:var(--color-border)] bg-slate-50 md:min-h-[calc(100dvh-12rem)] md:flex-row md:overflow-hidden">
        {/* Left: conversation list */}
        <ConversationListPanel
          conversations={conversations}
          filtered={filtered}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          listFilter={listFilter}
          onListFilterChange={setListFilter}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          statusFilter={statusFilter}
          onOpenStatusRequests={handleOpenStatusRequests}
          selectedId={selectedId}
          onSelect={handleSelectConversation}
        />

        {/* Right: conversation detail */}
        <div className="min-h-[34rem] flex-1 min-w-0 bg-slate-50 md:min-h-0">
          {selectedId ? (
            <ConversationDetail
              key={`${selectedId}-${detailRefreshKey}-${requestedAt}-${requestedMessageId}`}
              conversationId={selectedId}
              citizenName={selectedConv?.citizenName ?? null}
              citizenPhone={selectedConv?.citizenPhone ?? null}
              userQuickReplies={userQuickReplies}
              onUserQuickRepliesChanged={() => { void refreshUserQuickReplies() }}
              anchorAtUtc={requestedAt || null}
              anchorSocialMessageId={requestedMessageId || null}
              onReadMarked={handleReadMarked}
              onOpenCreateRequest={socialMessageId => { void handleOpenCreateRequest(socialMessageId) }}
              onOpenViewRequests={handleOpenViewRequests}
              onProfileSaved={() => { void loadConversations() }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[color:var(--color-muted-foreground)] gap-3">
              <img src="/icons/whatsapp.webp" alt="" className="size-12 opacity-25" aria-hidden="true" />
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
