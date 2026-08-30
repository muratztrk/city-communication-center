import { DateCell } from '../components/ui/date-cell'
import { Search, X } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '../hooks/useSortable'
import { FilterableTh } from '../components/ui/FilterableTh'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateJobs, invalidateSocialMessages } from '../api/cacheInvalidation'
import { RequestTagPicker } from '../components/RequestTagDialog'
import { Button } from '../components/ui/button'
import { StatusPill } from '../components/ui/status-pill'
import { GridStatusLabel } from '../components/ui/GridStatusLabel'
import { ChannelIcon } from '../components/ui/channel-icon'
import { ScopeChipDateRange } from '../components/ui/scope-chip-date-range'
import { ClearPieFilterLink } from '../components/ui/ClearPieFilterLink'
import { SingleSelectDropdown } from '../components/ui/single-select-dropdown'
import type { Department, JobSummary, RequestTag, SocialMessage } from '../types/platform'
import { getLocale, getSocialChannelLabel, getPriorityColorClass, getPriorityLabel, getStatusPillClass, shouldShowGridPrioritySubline } from '../utils/localization'
import { TablePagination } from '../components/ui/table-pagination'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { JobsPage } from './JobsPage'
import { formatCitizenRequestNumber, getCitizenRequestStatusLabel, getCitizenRequestStatusTone, isCitizenInProgressState, isCitizenProcessingReceivedOverdue, isCitizenProcessingReceivedState } from '../utils/citizenRequests'
import { wasJobOverdueWhenClosed } from '../utils/dateTimePicker'

const CHANNEL_BADGE_SEEN_PREFIX = 'ccc-social-channel-badge-seen-'
const BADGE_CHANNELS = ['EDevlet', 'MobileApp'] as const

async function loadCitizenInbox(embedded: boolean) {
  const jobsPromise = api.getJobs('all', null, embedded ? 'Citizen' : undefined)
  if (embedded) {
    const [messageList, jobList] = await Promise.all([
      api.getSocialMessages(),
      jobsPromise,
    ])
    return {
      messageList,
      jobList,
      tagList: [] as RequestTag[],
      departmentList: [] as Department[],
    }
  }

  const [messageList, jobList, tagList, departmentList] = await Promise.all([
    api.getSocialMessages(),
    jobsPromise,
    api.getRequestTags().catch(() => [] as RequestTag[]),
    api.getDepartments().catch(() => [] as Department[]),
  ])
  return { messageList, jobList, tagList, departmentList }
}

function getChannelBadgeSeenAt(channel: string): string | null {
  try {
    return localStorage.getItem(`${CHANNEL_BADGE_SEEN_PREFIX}${channel}`)
  } catch {
    return null
  }
}

function markChannelBadgeSeen(channel: string) {
  try {
    localStorage.setItem(`${CHANNEL_BADGE_SEEN_PREFIX}${channel}`, new Date().toISOString())
  } catch {
    // ignore quota / private mode
  }
}

function isChannelBadgeCandidate(message: SocialMessage): boolean {
  return message.status === 'New' || !message.jobId
}

function countChannelBadge(messages: SocialMessage[], channel: string, seenAt: string | null): number {
  const seenMs = seenAt ? Date.parse(seenAt) : NaN
  return messages.filter(message => {
    if (message.channel !== channel || !isChannelBadgeCandidate(message)) return false
    if (!Number.isFinite(seenMs)) return true
    return Date.parse(message.receivedAtUtc) > seenMs
  }).length
}

function formatDateTime(value: string | null | undefined, locale: string): string {
  if (!value) return locale.startsWith('tr') ? 'Belirsiz' : 'Unspecified'
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCitizenPhoneDisplay(value: string | null | undefined): string {
  if (!value) return '—'
  const digits = value.replace(/\D/g, '')
  const localDigits = digits.length === 12 && digits.startsWith('90')
    ? digits.slice(2)
    : digits.length === 11 && digits.startsWith('0')
      ? digits.slice(1)
      : digits
  if (localDigits.length === 10) {
    return `${localDigits.slice(0, 3)} ${localDigits.slice(3, 6)} ${localDigits.slice(6, 8)} ${localDigits.slice(8)}`
  }
  return value
}

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 12
}

function getSocialMessageCitizenName(message: SocialMessage): string {
  if (message.citizenName?.trim()) return message.citizenName.trim()
  if (looksLikePhone(message.citizenHandle)) return '—'
  return message.citizenHandle.replace(/^@+/, '')
}

function getSocialMessageCitizenPhone(message: SocialMessage): string {
  if (message.citizenPhone?.trim()) return formatCitizenPhoneDisplay(message.citizenPhone)
  if (looksLikePhone(message.citizenHandle)) return formatCitizenPhoneDisplay(message.citizenHandle)
  return '—'
}

function getSocialMessageWhatsAppPhone(message: SocialMessage): string | null {
  const raw = message.citizenPhone?.trim()
    || (looksLikePhone(message.citizenHandle) ? message.citizenHandle.trim() : null)
  if (!raw) return null

  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `90${digits}`
  if (digits.length >= 10) return digits
  return null
}

function getSocialMessageDueDate(message: SocialMessage, linkedJob?: JobSummary): string | null {
  return message.dueDateUtc ?? linkedJob?.dueDateUtc ?? null
}

function getLinkedJobDisplayStatus(t: TFunction, job: JobSummary, dueDateUtc: string | null): string {
  return getCitizenRequestStatusLabel(t, { ...job, dueDateUtc })
}

type SocialRequestStatusFilter = 'all' | 'processing-received' | 'in-progress' | 'completed' | 'cancelled'

const REQUEST_STATUS_FILTERS: { value: SocialRequestStatusFilter; labelKey: string; fallback: string }[] = [
  { value: 'all', labelKey: 'social.requestStatus.all', fallback: 'Tüm Talep Durumları' },
  { value: 'processing-received', labelKey: 'social.requestStatus.processingReceived', fallback: 'İşleme Alındı' },
  { value: 'in-progress', labelKey: 'social.requestStatus.inProgress', fallback: 'Yapılmakta' },
  { value: 'completed', labelKey: 'social.requestStatus.completed', fallback: 'Tamamlanan' },
  { value: 'cancelled', labelKey: 'social.requestStatus.cancelled', fallback: 'İptal' },
]

function parseSocialRequestStatusFilter(value: string | null): SocialRequestStatusFilter {
  if (value != null && REQUEST_STATUS_FILTERS.some(filter => filter.value === value)) {
    return value as SocialRequestStatusFilter
  }
  return 'all'
}

function parseSocialWasOverdueFilter(searchParams: URLSearchParams): boolean {
  return searchParams.get('wasOverdue') === '1' || searchParams.get('requestStatus') === 'overdue'
}

function getSocialMessageStatusKey(job: JobSummary | undefined): Exclude<SocialRequestStatusFilter, 'all'> {
  if (!job) return 'processing-received'

  if (job.status === 'Completed') return 'completed'
  if (job.status === 'Cancelled' || job.status === 'Rejected' || job.status === 'RevisionRequested') return 'cancelled'
  if (job.status === 'Active') return (job.taskCount ?? 0) > 0 ? 'in-progress' : 'processing-received'
  return 'processing-received'
}

function matchesSocialRequestStatusFilter(job: JobSummary | undefined, dueDateUtc: string | null, filter: SocialRequestStatusFilter): boolean {
  if (filter === 'all') return true
  if (!job) return filter === 'processing-received'
  if (filter === 'processing-received') {
    return isCitizenProcessingReceivedState({
      status: job.status,
      dueDateUtc,
      taskCount: job.taskCount,
    })
  }
  if (filter === 'in-progress') {
    return isCitizenInProgressState({
      status: job.status,
      dueDateUtc,
      taskCount: job.taskCount,
    })
  }
  return getSocialMessageStatusKey(job) === filter
}

function matchesSocialWasOverdueFilter(job: JobSummary | undefined, dueDateUtc: string | null): boolean {
  if (!job || !dueDateUtc) return false
  return wasJobOverdueWhenClosed({
    status: job.status,
    dueDateUtc,
    completedAtUtc: job.completedAtUtc,
    updatedAtUtc: job.updatedAtUtc,
  })
}

function canCancelLinkedJob(status: JobSummary['status'] | undefined) {
  return status === 'PendingOwnerApproval'
    || status === 'PendingExternalApproval'
    || status === 'Active'
}

const DEFAULT_CHANNEL_FILTER = ''
const ALL_CHANNELS_FILTER = 'all'

interface SocialMessageScopeFiltersProps {
  searchText: string
  filterFrom: string
  filterTo: string
  onSearch: (value: string) => void
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}

function SocialMessageScopeFilters({ searchText, filterFrom, filterTo, onSearch, onFromChange, onToChange }: SocialMessageScopeFiltersProps) {
  return (
    <div className="scope-chips-filters">
      <div className="scope-chip-search-wrap">
        <Search className="scope-chip-search-icon size-3 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          type="text"
          className="scope-chip-search-input"
          placeholder="Ara..."
          value={searchText}
          onChange={event => onSearch(event.target.value)}
        />
        {searchText && (
          <button type="button" onClick={() => onSearch('')} className="scope-chip-search-clear shrink-0 font-extrabold transition-colors" aria-label="Temizle">
            <X className="size-3.5" strokeWidth={3} />
          </button>
        )}
      </div>
      <ScopeChipDateRange from={filterFrom} to={filterTo} onFromChange={onFromChange} onToChange={onToChange} forceDown />
    </div>
  )
}

export function SocialMessagesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [embeddedChannel, setEmbeddedChannel] = useState(DEFAULT_CHANNEL_FILTER)
  const embeddedRequestStatus: SocialRequestStatusFilter = 'all'
  // Vatandaş Talepleri varsayılanı Tümü; `channel=WhatsApp` vb. URL ile daraltılır (card #1851).
  const channelParam = embedded ? embeddedChannel : searchParams.get('channel')
  const channelFilter = channelParam === null || channelParam === ALL_CHANNELS_FILTER
    ? DEFAULT_CHANNEL_FILTER
    : channelParam
  const requestStatusParam = embedded ? embeddedRequestStatus : searchParams.get('requestStatus')
  const initialRequestStatus = parseSocialRequestStatusFilter(requestStatusParam)
  const initialWasOverdue = embedded ? false : parseSocialWasOverdueFilter(searchParams)
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<SocialMessage[]>([])
  const [jobsById, setJobsById] = useState<Map<string, JobSummary>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelModal, setCancelModal] = useState<{ jobId: string; reason: string; saving: boolean } | null>(null)
  const [detailJobId, setDetailJobId] = useState<string | null>(null)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [searchText, setSearchText] = useState('')
  const [messagesPage, setMessagesPage] = useState(1)
  const [messagesPageSize, setMessagesPageSize] = useState(10)
  const [requestStatusFilter, setRequestStatusFilter] = useState<SocialRequestStatusFilter>(initialRequestStatus)
  const [wasOverdueFilter, setWasOverdueFilter] = useState(initialWasOverdue)
  const [requestTags, setRequestTags] = useState<RequestTag[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [badgeSeenTick, setBadgeSeenTick] = useState(0)
  const [routingMessageId, setRoutingMessageId] = useState<string | null>(null)

  useEffect(() => {
    if (embedded) return
    const nextStatus = searchParams.get('requestStatus')
    setRequestStatusFilter(parseSocialRequestStatusFilter(nextStatus))
    setWasOverdueFilter(parseSocialWasOverdueFilter(searchParams))
    setFilterFrom(searchParams.get('from') ?? '')
    setFilterTo(searchParams.get('to') ?? '')
  }, [embedded, searchParams])

  useEffect(() => {
    let isActive = true

    void loadCitizenInbox(embedded)
      .then(({ messageList, jobList, tagList, departmentList }) => {
        if (!isActive) {
          return
        }

        setMessages(messageList)
        setJobsById(new Map(jobList.map(job => [job.jobId, job])))
        setRequestTags(tagList)
        setDepartments(departmentList)
      })
      .catch(loadError => {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : t('common.error'))
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [embedded, t])

  const reload = async (options?: { quiet?: boolean }) => {
    if (!options?.quiet) {
      setLoading(true)
    }
    setError('')

    try {
      const { messageList, jobList, tagList, departmentList } = await loadCitizenInbox(embedded)

      setMessages(messageList)
      setJobsById(new Map(jobList.map(job => [job.jobId, job])))
      setRequestTags(tagList)
      setDepartments(departmentList)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('common.error'))
    } finally {
      if (!options?.quiet) {
        setLoading(false)
      }
    }
  }

  const handleCategorySelect = async (message: SocialMessage, category: string) => {
    try {
      await api.updateSocialMessage(message.socialMessageId, {
        channel: message.channel,
        citizenHandle: message.citizenHandle,
        content: message.content ?? '',
        category,
        latitude: message.latitude ?? undefined,
        longitude: message.longitude ?? undefined,
      })
      invalidateSocialMessages(queryClient, message.socialMessageId)
      await reload({ quiet: true })
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : t('common.error'))
    }
  }

  const handleCategoryClear = async (message: SocialMessage) => {
    await handleCategorySelect(message, '')
  }

  const handleMobileAppDepartmentAssign = async (message: SocialMessage, departmentId: string) => {
    if (!departmentId) return
    setRoutingMessageId(message.socialMessageId)
    try {
      await api.routeSocialMessage(message.socialMessageId, departmentId)
      invalidateSocialMessages(queryClient, message.socialMessageId)
      await reload({ quiet: true })
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : t('common.error'))
    } finally {
      setRoutingMessageId(null)
    }
  }

  const handleCancelConfirm = async () => {
    if (!cancelModal || !cancelModal.reason.trim()) return
    setCancelModal(current => current ? { ...current, saving: true } : null)
    try {
      await api.cancelJob(cancelModal.jobId, cancelModal.reason.trim())
      invalidateJobs(queryClient, cancelModal.jobId)
      invalidateSocialMessages(queryClient)
      setCancelModal(null)
      await reload()
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : t('common.error'))
      setCancelModal(current => current ? { ...current, saving: false } : null)
    }
  }

  const { sortKey: socialSortKey, sortDir: socialSortDir, toggleSort: toggleSocialSort, sortItems: sortSocial } = useSortable({
    sortKey: 'jobNumber',
    sortDir: 'desc',
  })
  const { filters: socialFilters, setFilter: setSocialFilter, clearFilters: clearSocialFilters, matchesFilters: socialMatchesFilters, hasActiveFilters: hasActiveSocialColumnFilters } = useColumnFilters()

  const displayMessages = useMemo(() => messages.map(message => {
    const linkedJob = message.jobId ? jobsById.get(message.jobId) : undefined
    const dueDateUtc = getSocialMessageDueDate(message, linkedJob)
    return {
      ...message,
      dueDateUtc,
      jobNumber: formatCitizenRequestNumber(message, locale),
      citizenName: getSocialMessageCitizenName(message),
      citizenPhone: getSocialMessageCitizenPhone(message),
      whatsAppPhone: getSocialMessageWhatsAppPhone(message),
      priority: linkedJob?.priority ?? '',
      statusSortText: linkedJob ? getLinkedJobDisplayStatus(t, linkedJob, dueDateUtc) : '',
      labelSortText: message.category ?? '',
    }
  }), [messages, jobsById, locale, t])

  const filteredMessages = useMemo(() => {
    // Varsayılan ve channel=all → Tümü (card #1851).
    let result = displayMessages.filter(message => {
      if (channelFilter) return message.channel === channelFilter
      return true
    })

    if (filterFrom || filterTo) {
      result = result.filter(message => {
        const receivedDate = message.receivedAtUtc.slice(0, 10)
        if (filterFrom && receivedDate < filterFrom.slice(0, 10)) return false
        if (filterTo && receivedDate > filterTo.slice(0, 10)) return false
        return true
      })
    }

    if (searchText.trim()) {
      const query = searchText.toLocaleLowerCase('tr')
      result = result.filter(message => [
        formatCitizenRequestNumber(message, locale),
        message.channel,
        getSocialMessageCitizenName(message),
        getSocialMessageCitizenPhone(message),
        message.citizenHandle,
        message.content,
        message.category,
        message.assignedDepartmentName,
        message.priority,
        message.statusSortText,
        message.labelSortText,
      ].filter(Boolean).join(' ').toLocaleLowerCase('tr').includes(query))
    }

    if (requestStatusFilter !== 'all') {
      result = result.filter(message => {
        const linkedJob = message.jobId ? jobsById.get(message.jobId) : undefined
        return matchesSocialRequestStatusFilter(linkedJob, message.dueDateUtc ?? null, requestStatusFilter)
      })
    }

    if (wasOverdueFilter) {
      result = result.filter(message => {
        const linkedJob = message.jobId ? jobsById.get(message.jobId) : undefined
        return matchesSocialWasOverdueFilter(linkedJob, message.dueDateUtc ?? null)
      })
    }

    return sortSocial(result)
  }, [channelFilter, displayMessages, filterFrom, filterTo, jobsById, locale, requestStatusFilter, searchText, sortSocial, wasOverdueFilter])

  useEffect(() => {
    const phoneParam = searchParams.get('phone')?.trim()
    if (!phoneParam) return
    const digits = phoneParam.replace(/\D/g, '').replace(/^90(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '')
    if (digits) setSocialFilter('citizenPhone', digits)
  }, [searchParams, setSocialFilter])

  const columnFilteredMessages = useMemo(
    () => filteredMessages.filter(m => socialMatchesFilters(m, (key, item) => {
      const row = item as SocialMessage & {
        jobNumber?: string
        citizenPhone?: string
        dueDateUtc?: string | null
        statusSortText?: string
        labelSortText?: string
      }
      if (key === 'citizenPhone') {
        return String(row.citizenPhone ?? '').replace(/\D/g, '').replace(/^90/, '')
      }
      if (key === 'jobNumber') return row.jobNumber ?? formatCitizenRequestNumber(row, locale)
      if (key === 'receivedAtUtc') return formatDateTime(row.receivedAtUtc, locale)
      if (key === 'dueDateUtc') {
        if (!row.dueDateUtc) return locale.startsWith('tr') ? 'İşleme Alındı' : 'Processing Received'
        return formatDateTime(row.dueDateUtc, locale)
      }
      if (key === 'channel') return getSocialChannelLabel(t, row.channel)
      if (key === 'labelSortText') return row.labelSortText ?? row.category ?? ''
      return String((item as Record<string, unknown>)[key] ?? '')
    })),
    [filteredMessages, locale, socialMatchesFilters, t],
  )

  // Sayfa numarası tıklanınca filtre temizliği socialFilters'ı değiştirir; o reset'i atla (#r467).
  const skipPageResetRef = useRef(false)
  useEffect(() => {
    if (skipPageResetRef.current) {
      skipPageResetRef.current = false
      return
    }
    setMessagesPage(1)
  }, [channelFilter, filterFrom, filterTo, requestStatusFilter, searchText, socialFilters, wasOverdueFilter])

  // Sayfa değişince etiket/kolon filtreleri default'a döner (#r461); paging bozulmaz (#r467).
  const handleMessagesPageChange = (page: number) => {
    if (page !== messagesPage) {
      skipPageResetRef.current = true
      clearSocialFilters()
    }
    setMessagesPage(page)
  }

  const handleMessagesPageSizeChange = (size: number) => {
    clearSocialFilters()
    setMessagesPageSize(size)
    setMessagesPage(1)
  }

  const pagedMessages = useMemo(
    () => columnFilteredMessages.slice((messagesPage - 1) * messagesPageSize, messagesPage * messagesPageSize),
    [columnFilteredMessages, messagesPage, messagesPageSize],
  )

  const channelBadgeCounts = useMemo(() => {
    void badgeSeenTick
    return Object.fromEntries(
      BADGE_CHANNELS.map(channel => [
        channel,
        countChannelBadge(messages, channel, getChannelBadgeSeenAt(channel)),
      ]),
    ) as Record<(typeof BADGE_CHANNELS)[number], number>
  }, [badgeSeenTick, messages])

  const channelQuickFilters: { value: string; label: string; badge?: number }[] = [
    { value: '', label: t('nav.socialAll', 'Tümü') },
    { value: 'WhatsApp', label: 'WhatsApp' },
    { value: 'Phone', label: t('nav.socialPhone', 'Çağrı') },
    {
      value: 'EDevlet',
      label: t('settings.citizen.channels.EDevlet', 'e-Devlet'),
      badge: channelBadgeCounts.EDevlet || undefined,
    },
    {
      value: 'MobileApp',
      label: t('settings.citizen.channels.MobileApp', 'Mobil Uygulama'),
      badge: channelBadgeCounts.MobileApp || undefined,
    },
  ]

  const departmentOptions = useMemo(
    () => departments
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name, 'tr'))
      .map(department => ({ value: department.departmentId, label: department.name })),
    [departments],
  )

  const setChannelFilter = (channel: string) => {
    if (channel === 'EDevlet' || channel === 'MobileApp') {
      markChannelBadgeSeen(channel)
      setBadgeSeenTick(tick => tick + 1)
    }
    if (embedded) {
      setEmbeddedChannel(channel)
      return
    }
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('channel', channel || ALL_CHANNELS_FILTER)
    setSearchParams(nextParams)
  }

  if (loading && !embedded) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className={embedded ? 'flex h-full min-h-0 flex-col overflow-hidden' : 'page-stack desktop-page-shell'}>
      {embedded ? null : (
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            {/* Kicker satırı eklendi; banner yüksekliği diğer bölümlerinkiyle aynı olsun (card 635). */}
            <div className="page-kicker">{t('social.title')}</div>
            <h1 className="page-title">{t('nav.social', 'Vatandaş Talepleri')}</h1>
            <p className="page-subtitle">{t('social.subtitle')}</p>
          </div>
          <div className="ml-auto mt-auto shrink-0">
            <SocialMessageScopeFilters
              searchText={searchText}
              filterFrom={filterFrom}
              filterTo={filterTo}
              onSearch={setSearchText}
              onFromChange={setFilterFrom}
              onToChange={setFilterTo}
            />
          </div>
        </div>
      </header>
      )}

      {embedded ? null : (
      <nav className="scope-chips" aria-label={t('social.channelFilterLabel', 'Vatandaş talebi kanal filtreleri')}>
        {channelQuickFilters.map(filter => (
          <button
            key={filter.value || 'all'}
            type="button"
            className={`scope-chip scope-chip--pending${channelFilter === filter.value ? ' active' : ''}`}
            onClick={() => setChannelFilter(filter.value)}
          >
            {filter.value && <ChannelIcon channel={filter.value} className="size-3.5 shrink-0" />}
            {filter.label}
            {filter.badge != null && filter.badge > 0 ? (
              <span className="inline-flex min-w-[1rem] h-4 px-1 items-center justify-center rounded-full text-[10px] font-bold bg-red-500 text-white">
                {filter.badge}
              </span>
            ) : null}
          </button>
        ))}
        <span className="scope-chip-divider" aria-hidden="true">|</span>
        <SingleSelectDropdown
          className="w-auto"
          triggerClassName="scope-chip-year-select scope-chip-status-select w-[11.5rem] min-w-[11.5rem] max-w-[11.5rem]"
          menuScrollClassName="scope-chip-status-menu-scroll"
          options={REQUEST_STATUS_FILTERS.map(filter => ({ value: filter.value, label: t(filter.labelKey, filter.fallback) }))}
          value={requestStatusFilter}
          onChange={value => {
            const nextValue = value as SocialRequestStatusFilter
            setRequestStatusFilter(nextValue)
            const nextParams = new URLSearchParams(searchParams)
            if (nextValue === 'all') nextParams.delete('requestStatus')
            else nextParams.set('requestStatus', nextValue)
            if (nextParams.get('requestStatus') === 'overdue') nextParams.delete('requestStatus')
            if (wasOverdueFilter) nextParams.set('wasOverdue', '1')
            else nextParams.delete('wasOverdue')
            setSearchParams(nextParams)
          }}
          placeholder={t('social.requestStatusFilterLabel', 'Talep durumu filtresi')}
        />
        <label className="ml-3 inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            className="field-checkbox"
            checked={wasOverdueFilter}
            onChange={event => {
              const nextChecked = event.target.checked
              setWasOverdueFilter(nextChecked)
              const nextParams = new URLSearchParams(searchParams)
              if (requestStatusFilter === 'all') nextParams.delete('requestStatus')
              else nextParams.set('requestStatus', requestStatusFilter)
              if (nextParams.get('requestStatus') === 'overdue') nextParams.delete('requestStatus')
              if (nextChecked) nextParams.set('wasOverdue', '1')
              else nextParams.delete('wasOverdue')
              setSearchParams(nextParams)
            }}
          />
          {t('jobs.detail.wasOverdue', 'Gecikti mi?')}
        </label>
        <ClearPieFilterLink hasColumnFilters={hasActiveSocialColumnFilters} onClearColumnFilters={clearSocialFilters} />
      </nav>
      )}

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      <section className={embedded ? 'section-card flex min-h-0 flex-1 flex-col overflow-hidden p-0' : 'section-card desktop-page-fill'}>
        <div className={embedded ? 'dashboard-drilldown-grid-shell flex min-h-0 flex-1 flex-col px-4 pb-3 pt-3' : 'contents'}>
        <div className={embedded ? 'dashboard-drilldown-table-wrap min-h-0 flex-1 overflow-auto' : 'table-wrap desktop-panel-scroll'}>
          <table className={`data-table jobs-table data-table--zebra social-messages-table${embedded ? ' dashboard-drilldown-table' : ''}`}>
            <thead>
              <tr>
                <th className="w-12 text-center">{t('common.rowNo', 'Sıra')}</th>
                <FilterableTh filterKey="jobNumber" filterValue={socialFilters['jobNumber'] ?? ''} onFilter={setSocialFilter} sortKey="jobNumber" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>
                  <span className="inline-flex whitespace-nowrap leading-tight">
                    <span>{t('social.citizenRequestNoHeader', 'Vatandaş Talep No')}</span>
                  </span>
                </FilterableTh>
                <FilterableTh filterKey="citizenName" filterValue={socialFilters['citizenName'] ?? ''} onFilter={setSocialFilter} sortKey="citizenName" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.citizenName', 'Vatandaş Adı')}</FilterableTh>
                <FilterableTh filterKey="citizenPhone" filterValue={socialFilters['citizenPhone'] ?? ''} onFilter={setSocialFilter} sortKey="citizenPhone" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('jobs.detail.citizenPhone', 'Telefon No')}</FilterableTh>
                <FilterableTh filterKey="receivedAtUtc" filterValue={socialFilters['receivedAtUtc'] ?? ''} onFilter={setSocialFilter} sortKey="receivedAtUtc" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>
                  <span className="inline-flex whitespace-nowrap leading-tight">
                    <span>{embedded ? t('jobs.columns.requestDate', 'Talep Tarihi') : t('social.citizenRequestDateHeader', 'Vatandaş Talep Tarihi')}</span>
                  </span>
                </FilterableTh>
                {embedded ? null : (
                <FilterableTh filterKey="assignedDepartmentName" filterValue={socialFilters['assignedDepartmentName'] ?? ''} onFilter={setSocialFilter} sortKey="assignedDepartmentName" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.destination', 'Gittiği Yer')}</FilterableTh>
                )}
                <FilterableTh filterKey="statusSortText" filterValue={socialFilters['statusSortText'] ?? ''} onFilter={setSocialFilter} sortKey="statusSortText" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('jobs.columns.status', 'Durum')}</FilterableTh>
                {embedded ? null : (
                <FilterableTh filterKey="labelSortText" filterValue={socialFilters['labelSortText'] ?? ''} onFilter={setSocialFilter} sortKey="labelSortText" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('whatsapp.label', 'Talep Etiketi')}</FilterableTh>
                )}
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {embedded && loading ? (
                <TableEmptyStateRows
                  columnCount={7}
                  message={t('common.pageLoading', 'Sayfa yükleniyor...')}
                />
              ) : (
                <>
              {pagedMessages.map((message, index) => {
                const linkedJob = message.jobId ? jobsById.get(message.jobId) : undefined

                return (
                <Fragment key={message.socialMessageId}>
                  <tr>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(messagesPage - 1) * messagesPageSize + index + 1}</td>
                    <td className="table-number-cell font-mono text-xs text-slate-500">
                      <div className="table-number-cell__value inline-flex items-center gap-1.5">
                        {message.channel === 'WhatsApp' ? <ChannelIcon channel={message.channel} className="size-4 shrink-0" /> : null}
                        {message.channel !== 'WhatsApp' ? <ChannelIcon channel={message.channel} className="size-4 shrink-0" /> : null}
                        <span>{formatCitizenRequestNumber(message, locale)}</span>
                      </div>
                      {linkedJob && shouldShowGridPrioritySubline(linkedJob.priority) ? (
                        <div className={`table-number-cell__priority font-sans font-bold ${getPriorityColorClass(linkedJob.priority)}`}>
                          Öncelik:{getPriorityLabel(t, linkedJob.priority)}
                        </div>
                      ) : null}
                    </td>
                    <td className="font-semibold">{getSocialMessageCitizenName(message)}</td>
                    <td className="citizen-grid-phone-value text-sm font-semibold text-slate-500 tabular-nums">{getSocialMessageCitizenPhone(message)}</td>
                    <td><DateCell value={message.receivedAtUtc} locale={locale} /></td>
                    {embedded ? null : (
                    <td>
                      {message.channel === 'MobileApp' && !message.assignedDepartmentName ? (
                        <SingleSelectDropdown
                          className="w-full min-w-[10rem]"
                          options={departmentOptions}
                          value=""
                          onChange={value => { void handleMobileAppDepartmentAssign(message, value) }}
                          placeholder={routingMessageId === message.socialMessageId
                            ? t('common.loading')
                            : t('requests.create.targetDepartmentsPlaceholder', 'Birim seçiniz')}
                          disabled={routingMessageId === message.socialMessageId}
                        />
                      ) : (
                        <span className="font-semibold text-slate-700">{message.assignedDepartmentName ?? t('common.none')}</span>
                      )}
                      {linkedJob?.assignedUserDisplayName ? (
                        <span className="grid-stack-secondary mt-0.5 block text-sm font-semibold text-slate-500">{linkedJob.assignedUserDisplayName}</span>
                      ) : null}
                    </td>
                    )}
                    <td className="grid-col-status text-center">
                      {(() => {
                        const dueDateUtc = linkedJob
                          ? (message.dueDateUtc ?? linkedJob.dueDateUtc ?? null)
                          : null
                        const statusLabel = linkedJob
                          ? getLinkedJobDisplayStatus(t, linkedJob, dueDateUtc)
                          : t('social.requestStatus.processingReceived', 'İşleme Alındı')
                        const statusDate = linkedJob?.status === 'Completed' ? linkedJob.completedAtUtc
                          : linkedJob?.status === 'Cancelled' ? linkedJob.updatedAtUtc
                          : null
                        const statusDateText = statusDate
                          ? new Date(statusDate).toLocaleString(locale, {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                          : null
                        return (
                          <StatusPill className={linkedJob
                            ? getStatusPillClass(getCitizenRequestStatusTone({ ...linkedJob, dueDateUtc }))
                            : getStatusPillClass('processingReceived')}>
                            <GridStatusLabel
                              t={t}
                              label={statusLabel}
                              overdueSubline={linkedJob != null && isCitizenProcessingReceivedOverdue({
                                status: linkedJob.status,
                                dueDateUtc: dueDateUtc,
                                taskCount: linkedJob.taskCount ?? 0,
                              })}
                              hideInProgressOverdueSubline={false}
                              footer={statusDateText
                                ? <span className={`text-[0.68rem] font-bold ${linkedJob?.status === 'Completed' ? 'text-emerald-700' : 'text-red-700'}`}>{statusDateText}</span>
                                : undefined}
                            />
                          </StatusPill>
                        )
                      })()}
                    </td>
                    {embedded ? null : (
                    <td className="text-center">
                      <div className="inline-flex w-full justify-center">
                        <RequestTagPicker
                          key={`${message.socialMessageId}-${messagesPage}`}
                          tags={requestTags}
                          selectedName={message.category}
                          emptyLabel={t('whatsapp.requestTagsGridEmpty', 'Etiketler')}
                          onSelect={name => { void handleCategorySelect(message, name) }}
                          onClear={() => { void handleCategoryClear(message) }}
                        />
                      </div>
                    </td>
                    )}
                    <td className="actions-cell">
                      <div className="request-actions justify-center">
                        <Button
                          size="sm"
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            if (message.jobId) setDetailJobId(message.jobId)
                            else navigate(`/requests/new?kind=citizen&socialMessageId=${encodeURIComponent(message.socialMessageId)}`)
                          }}
                        >
                          {t('jobs.actions.details', 'Detaylar')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                </Fragment>
                )
              })}
              {columnFilteredMessages.length === 0 ? (
                <TableEmptyStateRows
                  columnCount={embedded ? 7 : 9}
                  message={embedded
                    ? t('social.emptyCitizenRequests', 'Henüz vatandaş talebi bulunmuyor')
                    : t('social.empty')}
                />
              ) : null}
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className={embedded ? 'shrink-0' : undefined}>
        <TablePagination
          totalCount={columnFilteredMessages.length}
          pageSize={messagesPageSize}
          currentPage={messagesPage}
          onPageSizeChange={handleMessagesPageSizeChange}
          onPageChange={handleMessagesPageChange}
        />
        </div>
        </div>
      </section>

      {detailJobId && (
        <JobsPage
          mode="myRequests"
          fixedScope="mine"
          detailOnly
          detailContextOverride="social"
          notificationJobId={detailJobId}
          onNotificationDetailClose={() => setDetailJobId(null)}
          socialActions={(() => {
            const message = messages.find(item => item.jobId === detailJobId)
            if (!message) return undefined
            const linkedJob = message.jobId ? jobsById.get(message.jobId) : undefined
            const canCancelJob = message.jobId && canCancelLinkedJob(linkedJob?.status)
            const isTargetApproved = !!linkedJob && (linkedJob.taskCount ?? 0) > 0
            const whatsAppPhone = getSocialMessageWhatsAppPhone(message)
            return {
              goToConversation: message.channel === 'WhatsApp' && whatsAppPhone
                ? () => navigate(`/whatsapp?phone=${encodeURIComponent(whatsAppPhone)}&at=${encodeURIComponent(message.receivedAtUtc)}&messageId=${encodeURIComponent(message.socialMessageId)}`)
                : undefined,
              editDisabledTitle: isTargetApproved
                ? t('social.editAfterApprovalDisabled', 'Hedef birim yöneticisi onayladıktan sonra talep düzenlenemez')
                : undefined,
              cancel: canCancelJob
                ? () => setCancelModal({ jobId: message.jobId!, reason: '', saving: false })
                : undefined,
              cancelDisabledTitle: message.jobId
                ? t('jobs.actions.cancelUnavailable', 'Bu kayıt iptal edilemez')
                : t('social.detailsUnavailable', 'Henüz talep oluşturulmadı'),
              onMessageUpdated: patch => {
                setMessages(current => current.map(item =>
                  item.socialMessageId === patch.socialMessageId
                    ? {
                      ...item,
                      category: patch.category,
                      ...(patch.citizenName !== undefined ? { citizenName: patch.citizenName } : {}),
                      ...(patch.citizenPhone !== undefined ? { citizenPhone: patch.citizenPhone } : {}),
                      ...(patch.citizenHandle !== undefined ? { citizenHandle: patch.citizenHandle ?? item.citizenHandle } : {}),
                    }
                    : item))
              },
            }
          })()}
        />
      )}

      {cancelModal && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" role="presentation">
          <section className="form-card page-stack relative w-full max-w-md" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cancel-social-job-dialog-title">
            <button type="button" onClick={() => setCancelModal(null)} aria-label={t('common.close', 'Kapat')} className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
              <X className="size-4" />
            </button>
            <h2 id="cancel-social-job-dialog-title" className="workflow-note-dialog__title">{t('jobs.actions.cancelJob', 'Talebi İptal Et')}</h2>
            <p className="helper-copy text-left" style={{ fontSize: '0.85rem' }}>
              {t('jobs.actions.cancelJobHelp', 'Talebi iptal etmek için neden belirtiniz.')}
            </p>
            <label className="job-field mt-5">
              <span className="job-field-label">{t('tasks.actions.cancelReason', 'İptal Nedeni')} <span className="text-[10px] font-normal text-slate-400">(Max 100 karakter)</span> <span className="text-red-500">*</span></span>
              <textarea
                className="field-textarea workflow-note-dialog__textarea"
                rows={3}
                maxLength={100}
                value={cancelModal.reason}
                onChange={event => setCancelModal(current => current ? { ...current, reason: event.target.value } : null)}
                placeholder={t('tasks.actions.cancelReasonPlaceholder', 'İptal nedenini açıklayınız...')}
                autoFocus
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCancelModal(null)}>
                {t('common.dismiss', 'Vazgeç')}
              </Button>
              <Button type="button" variant="destructive" disabled={cancelModal.saving || !cancelModal.reason.trim()} onClick={() => void handleCancelConfirm()}>
                {cancelModal.saving ? t('common.loading') : t('jobs.actions.cancel', 'İptal Et')}
              </Button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  )
}
