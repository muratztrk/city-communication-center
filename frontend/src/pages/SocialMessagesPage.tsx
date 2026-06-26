import { DateCell } from '../components/ui/date-cell'
import { MapPin, Search, X } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
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
import { Button } from '../components/ui/button'
import { ChannelIcon } from '../components/ui/channel-icon'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { DisabledActionButton } from '../components/ui/DisabledActionButton'
import type { Department, JobSummary, SocialMessage } from '../types/platform'
import { getLocale, getSocialChannelLabel, getPriorityColorClass, getPriorityLabel, getStatusPillClass, getJobStatusTone } from '../utils/localization'
import { StatusPill } from '../components/ui/status-pill'
import { CitizenRequestModal } from '../components/CitizenRequestModal'
import { TablePagination } from '../components/ui/table-pagination'
import { JobsPage } from './JobsPage'

function hasLocation(message: SocialMessage) {
  return message.latitude != null && message.longitude != null
}

function getLocationMapUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${(longitude - 0.005).toFixed(6)},${(latitude - 0.005).toFixed(6)},${(longitude + 0.005).toFixed(6)},${(latitude + 0.005).toFixed(6)}&layer=mapnik&marker=${latitude},${longitude}`
}

function formatCitizenRequestNumber(message: SocialMessage, locale: string) {
  const year = message.citizenRequestNumberYear ?? new Date(message.receivedAtUtc).getFullYear()
  if (message.citizenRequestNumber != null) {
    return `VT-${year}-${message.citizenRequestNumber}`
  }
  return locale.startsWith('tr') ? `VT-${year}-Onay Bekleyen` : `VT-${year}-Pending Approval`
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

function getSocialMessageLastDate(message: SocialMessage) {
  return message.updatedAtUtc ?? message.receivedAtUtc
}

function getLinkedJobDisplayStatus(t: TFunction, job: JobSummary): string {
  if (job.status === 'Completed') return t('jobs.statusLabel.completed', 'Tamamlanmış')
  if (job.status === 'Cancelled') return t('jobs.statusLabel.cancelled', 'İptal')
  if (job.status === 'Rejected') return t('jobs.statusLabel.rejected', 'Reddedildi')
  if (job.status === 'RevisionRequested') return t('jobs.statusLabel.returned', 'İade Edildi')
  if (job.dueDateUtc != null && new Date(job.dueDateUtc).getTime() < Date.now()) {
    return t('jobs.statusLabel.overdue', 'Son Tarihi Geçmiş')
  }
  if (job.status === 'Active') return t('jobs.statusLabel.inProgress', 'Yapılmakta')
  return t('jobs.statusLabel.pending', 'Bekleyen')
}

function canCancelLinkedJob(status: JobSummary['status'] | undefined) {
  return status === 'PendingOwnerApproval'
    || status === 'PendingExternalApproval'
    || status === 'Active'
}

const DEFAULT_CHANNEL_FILTER = 'WhatsApp'
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
      <DateTimePicker value={filterFrom} onChange={onFromChange} placeholder="Başlangıç tarihi" className="scope-chip-date" forceDown />
      <span className="text-xs text-slate-400">–</span>
      <DateTimePicker value={filterTo} onChange={onToChange} placeholder="Bitiş tarihi" className="scope-chip-date" forceDown />
    </div>
  )
}

export function SocialMessagesPage() {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // The citizen-request inbox opens on WhatsApp, while an explicit `channel=all`
  // keeps the All chip available as a distinct user-selected state.
  const channelParam = searchParams.get('channel')
  const channelFilter = channelParam === null
    ? DEFAULT_CHANNEL_FILTER
    : channelParam === ALL_CHANNELS_FILTER ? '' : channelParam
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<SocialMessage[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [jobsById, setJobsById] = useState<Map<string, JobSummary>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestModalMessage, setRequestModalMessage] = useState<SocialMessage | null>(null)
  const [requestModalEditJobId, setRequestModalEditJobId] = useState<string | null>(null)
  const [cancelModal, setCancelModal] = useState<{ jobId: string; reason: string; saving: boolean } | null>(null)
  const [detailJobId, setDetailJobId] = useState<string | null>(null)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [searchText, setSearchText] = useState('')
  const [messagesPage, setMessagesPage] = useState(1)
  const [messagesPageSize, setMessagesPageSize] = useState(10)

  useEffect(() => {
    let isActive = true

    void Promise.all([
      api.getSocialMessages(),
      api.getDepartments(),
      api.getJobs('all'),
    ])
      .then(([messageList, departmentList, jobList]) => {
        if (!isActive) {
          return
        }

        setMessages(messageList)
        setDepartments(departmentList)
        setJobsById(new Map(jobList.map(job => [job.jobId, job])))
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
  }, [t])

  const reload = async () => {
    setLoading(true)
    setError('')

    try {
      const [messageList, departmentList, jobList] = await Promise.all([
        api.getSocialMessages(),
        api.getDepartments(),
        api.getJobs('all'),
      ])

      setMessages(messageList)
      setDepartments(departmentList)
      setJobsById(new Map(jobList.map(job => [job.jobId, job])))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleRequestCreated = () => {
    setRequestModalMessage(null)
    setRequestModalEditJobId(null)
    void reload()
    invalidateSocialMessages(queryClient, requestModalMessage?.socialMessageId)
  }

  const openRequestModal = (message: SocialMessage) => {
    setRequestModalEditJobId(message.jobId)
    setRequestModalMessage(message)
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

  const { sortKey: socialSortKey, sortDir: socialSortDir, toggleSort: toggleSocialSort, sortItems: sortSocial } = useSortable()
  const { filters: socialFilters, setFilter: setSocialFilter, matchesFilters: socialMatchesFilters } = useColumnFilters()

  const displayMessages = useMemo(() => messages.map(message => {
    const linkedJob = message.jobId ? jobsById.get(message.jobId) : undefined
    return {
      ...message,
      citizenName: getSocialMessageCitizenName(message),
      citizenPhone: getSocialMessageCitizenPhone(message),
      whatsAppPhone: getSocialMessageWhatsAppPhone(message),
      priority: linkedJob?.priority ?? '',
      statusSortText: linkedJob ? getLinkedJobDisplayStatus(t, linkedJob) : '',
    }
  }), [messages, jobsById, t])

  const filteredMessages = useMemo(() => {
    const showAllChannels = channelParam === ALL_CHANNELS_FILTER
    // Varsayılan görünümde WhatsApp; "Tümü" seçilince tüm kanallar (WhatsApp dahil).
    let result = displayMessages.filter(message => {
      if (channelFilter) return message.channel === channelFilter
      if (showAllChannels) return true
      return message.channel !== 'WhatsApp'
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
      ].filter(Boolean).join(' ').toLocaleLowerCase('tr').includes(query))
    }

    return sortSocial(result)
  }, [channelFilter, channelParam, displayMessages, filterFrom, filterTo, locale, searchText, sortSocial])

  useEffect(() => {
    const phoneParam = searchParams.get('phone')?.trim()
    if (!phoneParam) return
    const digits = phoneParam.replace(/\D/g, '').replace(/^90(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '')
    if (digits) setSocialFilter('citizenPhone', digits)
  }, [searchParams, setSocialFilter])

  const columnFilteredMessages = useMemo(
    () => filteredMessages.filter(m => socialMatchesFilters(m, (key, item) => {
      if (key === 'citizenPhone') {
        return String((item as Record<string, unknown>).citizenPhone ?? '').replace(/\D/g, '').replace(/^90/, '')
      }
      return String((item as Record<string, unknown>)[key] ?? '')
    })),
    [filteredMessages, socialMatchesFilters],
  )

  useEffect(() => {
    setMessagesPage(1)
  }, [channelFilter, filterFrom, filterTo, searchText, socialFilters])

  const pagedMessages = useMemo(
    () => columnFilteredMessages.slice((messagesPage - 1) * messagesPageSize, messagesPage * messagesPageSize),
    [columnFilteredMessages, messagesPage, messagesPageSize],
  )

  const channelQuickFilters: { value: string; label: string }[] = [
    { value: 'WhatsApp', label: 'WhatsApp' },
    { value: 'Phone', label: t('nav.socialPhone', 'Çağrı') },
    { value: 'Instagram', label: 'Instagram' },
    { value: 'Facebook', label: 'Facebook' },
    { value: 'X', label: 'X' },
    { value: 'Email', label: t('nav.socialEmail', 'E-posta') },
    { value: 'WebForm', label: t('nav.socialWebForm', 'Web Formu') },
    { value: 'EDevlet', label: t('settings.citizen.channels.EDevlet', 'e-Devlet') },
    { value: '', label: t('nav.socialAll', 'Tümü') },
  ]

  const setChannelFilter = (channel: string) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('channel', channel || ALL_CHANNELS_FILTER)
    setSearchParams(nextParams)
  }

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className="page-stack desktop-page-shell">
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
          </button>
        ))}
      </nav>

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      <section className="section-card desktop-page-fill">
        <div className="table-wrap desktop-panel-scroll">
          <table className={`data-table jobs-table data-table--zebra social-messages-table${pagedMessages.length === 0 ? ' data-table--empty' : ''}`}>
            <thead>
              <tr>
                <th className="w-12 text-center">{t('common.rowNo', 'Sıra')}</th>
                <FilterableTh filterKey="jobNumber" filterValue={socialFilters['jobNumber'] ?? ''} onFilter={setSocialFilter} sortKey="jobNumber" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.citizenRequestNo', 'Vatandaş Talep No')}</FilterableTh>
                <FilterableTh filterKey="receivedAtUtc" filterValue={socialFilters['receivedAtUtc'] ?? ''} onFilter={setSocialFilter} sortKey="receivedAtUtc" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.citizenRequestDate', 'Vatandaş Talep Tarihi')}</FilterableTh>
                <FilterableTh filterKey="channel" filterValue={socialFilters['channel'] ?? ''} onFilter={setSocialFilter} sortKey="channel" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.channel')}</FilterableTh>
                <FilterableTh filterKey="citizenPhone" filterValue={socialFilters['citizenPhone'] ?? ''} onFilter={setSocialFilter} sortKey="citizenPhone" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.citizenPhone', 'Telefon Numarası')}</FilterableTh>
                <FilterableTh filterKey="citizenName" filterValue={socialFilters['citizenName'] ?? ''} onFilter={setSocialFilter} sortKey="citizenName" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.citizenName', 'Vatandaş İsmi')}</FilterableTh>
                <FilterableTh filterKey="assignedDepartmentName" filterValue={socialFilters['assignedDepartmentName'] ?? ''} onFilter={setSocialFilter} sortKey="assignedDepartmentName" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.destination', 'Gittiği Yer')}</FilterableTh>
                <FilterableTh filterKey="updatedAtUtc" filterValue={socialFilters['updatedAtUtc'] ?? ''} onFilter={setSocialFilter} sortKey="updatedAtUtc" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.lastDate', 'Son Tarih')}</FilterableTh>
                <FilterableTh filterKey="statusSortText" filterValue={socialFilters['statusSortText'] ?? ''} onFilter={setSocialFilter} sortKey="statusSortText" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('jobs.columns.status', 'Durum')}</FilterableTh>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedMessages.map((message, index) => {
                const linkedJob = message.jobId ? jobsById.get(message.jobId) : undefined
                const canCancelJob = message.jobId && canCancelLinkedJob(linkedJob?.status)

                return (
                <Fragment key={message.socialMessageId}>
                  <tr>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(messagesPage - 1) * messagesPageSize + index + 1}</td>
                    <td className="table-number-cell font-mono text-xs text-slate-500">
                      <div className="table-number-cell__value">{formatCitizenRequestNumber(message, locale)}</div>
                      {linkedJob ? (
                        <div className={`table-number-cell__priority font-sans font-bold ${getPriorityColorClass(linkedJob.priority)}`}>
                          (Öncelik:{getPriorityLabel(t, linkedJob.priority)})
                        </div>
                      ) : null}
                    </td>
                    <td><DateCell value={message.receivedAtUtc} locale={locale} /></td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <ChannelIcon channel={message.channel} className="size-4 shrink-0" />
                        <span className="font-medium">{getSocialChannelLabel(t, message.channel)}</span>
                      </span>
                    </td>
                    <td className="font-semibold">{message.citizenPhone}</td>
                    <td className="font-semibold">{message.citizenName}</td>
                    <td>{message.assignedDepartmentName ?? t('common.none')}</td>
                    <td><DateCell value={getSocialMessageLastDate(message)} locale={locale} /></td>
                    <td>
                      {linkedJob ? (
                        <StatusPill className={getStatusPillClass(getJobStatusTone(linkedJob))}>
                          {getLinkedJobDisplayStatus(t, linkedJob)}
                        </StatusPill>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="actions-cell">
                      <div className="request-actions justify-center">
                        {message.jobId ? (
                          <Button
                            size="sm"
                            type="button"
                            variant="secondary"
                            onClick={() => setDetailJobId(message.jobId!)}
                          >
                            {t('jobs.actions.details', 'Detaylar')}
                          </Button>
                        ) : (
                          <DisabledActionButton size="sm" variant="secondary" hoverTitle={t('social.detailsUnavailable', 'Henüz talep oluşturulmadı')}>
                            {t('jobs.actions.details', 'Detaylar')}
                          </DisabledActionButton>
                        )}
                        {message.channel === 'WhatsApp' && message.whatsAppPhone ? (
                          <Button
                            size="sm"
                            type="button"
                            className="bg-[#007985] text-white hover:bg-[#006570]"
                            onClick={() => navigate(
                              `/whatsapp?phone=${encodeURIComponent(message.whatsAppPhone!)}&at=${encodeURIComponent(message.receivedAtUtc)}&messageId=${encodeURIComponent(message.socialMessageId)}`,
                            )}
                          >
                            {t('social.goToConversation', 'Yazışmaya Git')}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          type="button"
                          variant="success"
                          onClick={() => openRequestModal(message)}
                        >
                          {message.jobId
                            ? t('social.editRequest', 'Talep Düzenle')
                            : t('nav.createRequest', 'Talep Oluştur')}
                        </Button>
                        {canCancelJob ? (
                          <Button
                            size="sm"
                            type="button"
                            variant="destructive"
                            onClick={() => setCancelModal({ jobId: message.jobId!, reason: '', saving: false })}
                          >
                            {t('jobs.actions.cancel', 'İptal Et')}
                          </Button>
                        ) : (
                          <DisabledActionButton
                            size="sm"
                            variant="destructive"
                            hoverTitle={message.jobId
                              ? t('jobs.actions.cancelUnavailable', 'Bu kayıt iptal edilemez')
                              : t('social.detailsUnavailable', 'Henüz talep oluşturulmadı')}
                          >
                            {t('jobs.actions.cancel', 'İptal Et')}
                          </DisabledActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                  {hasLocation(message) ? (
                    <tr className="bg-slate-50/70">
                      <td colSpan={9}>
                        <section className="grid gap-2">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                            <MapPin className="size-4 text-[color:var(--color-primary)]" />
                            {t('location.mapSectionTitle', 'Konum')}
                            <span className="font-semibold normal-case tracking-normal text-slate-500">
                              {message.latitude!.toFixed(6)}, {message.longitude!.toFixed(6)}
                            </span>
                          </div>
                          <iframe
                            src={getLocationMapUrl(message.latitude!, message.longitude!)}
                            className="h-52 w-full rounded-xl border border-slate-200"
                            title={t('location.mapTitle', 'Konum Haritası')}
                          />
                        </section>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
                )
              })}
              {columnFilteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state text-center">{t('social.empty')}</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePagination
          totalCount={columnFilteredMessages.length}
          pageSize={messagesPageSize}
          currentPage={messagesPage}
          onPageSizeChange={setMessagesPageSize}
          onPageChange={setMessagesPage}
        />
      </section>

      {requestModalMessage && (
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
      )}

      {detailJobId && (
        <JobsPage
          mode="myRequests"
          fixedScope="mine"
          detailOnly
          detailContextOverride="social"
          notificationJobId={detailJobId}
          onNotificationDetailClose={() => setDetailJobId(null)}
        />
      )}

      {cancelModal && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={() => setCancelModal(null)} role="presentation">
          <section className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cancel-social-job-dialog-title">
            <button type="button" onClick={() => setCancelModal(null)} aria-label={t('common.close', 'Kapat')} className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
              <X className="size-4" />
            </button>
            <h2 id="cancel-social-job-dialog-title" className="mb-3 border-b border-slate-200 pb-2 pr-8 text-base font-semibold text-slate-950">{t('jobs.actions.cancelJob', 'Talebi İptal Et')}</h2>
            <p className="mt-2 text-base font-medium leading-6 text-slate-700">{t('jobs.actions.cancelJobHelp', 'Talebi iptal etmek için neden belirtiniz.')}</p>
            <label className="job-field mt-5">
              <span className="job-field-label">{t('tasks.actions.cancelReason', 'İptal Nedeni')}</span>
              <textarea
                className="field-textarea"
                rows={3}
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
