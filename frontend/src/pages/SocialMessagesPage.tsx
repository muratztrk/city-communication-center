import { MapPin, Search, X } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '../hooks/useSortable'
import { FilterableTh } from '../components/ui/FilterableTh'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateSocialMessages } from '../api/cacheInvalidation'
import { Button } from '../components/ui/button'
import { ChannelIcon } from '../components/ui/channel-icon'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { RichTextContent } from '../components/ui/RichTextContent'
import type { Department, JobDetail, SocialMessage } from '../types/platform'
import { getLocale, getSocialChannelLabel } from '../utils/localization'
import { CitizenRequestModal } from '../components/CitizenRequestModal'

function hasLocation(message: SocialMessage) {
  return message.latitude != null && message.longitude != null
}

function getLocationMapUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${(longitude - 0.005).toFixed(6)},${(latitude - 0.005).toFixed(6)},${(longitude + 0.005).toFixed(6)},${(latitude + 0.005).toFixed(6)}&layer=mapnik&marker=${latitude},${longitude}`
}

function getJobStatusLabel(t: ReturnType<typeof useTranslation>['t'], status: string): string {
  return t(`enum.jobStatus.${status}`, { defaultValue: status })
}

function formatDateTime(value: string | null, locale: string) {
  if (!value) return locale.startsWith('tr') ? 'Belirsiz' : 'Unspecified'
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDueDateTime(value: string | null, locale: string) {
  if (!value) return locale.startsWith('tr') ? 'Onay Bekleyen' : 'Pending Approval'
  return formatDateTime(value, locale)
}

function formatCitizenRequestNumber(message: SocialMessage) {
  if (message.jobNumber == null) return '—'
  return message.jobNumberYear == null
    ? `VT-${message.jobNumber}`
    : `VT-${message.jobNumberYear}-${message.jobNumber}`
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

function formatJobDestinationsWithAssignees(job: JobDetail): string {
  const roleOrder: Record<string, number> = { Owner: 0, Target: 1, Coordinating: 2 }
  const destinations = [...job.departments]
    .sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9))
    .filter(department => department.role === 'Target' || department.role === 'Coordinating')
  const effectiveDestinations = destinations.length > 0
    ? destinations
    : job.departments.filter(department => department.departmentId === job.ownerDepartmentId)

  return effectiveDestinations
    .map(department => {
      const assignees = [...new Set(
        job.tasks
          .filter(task =>
            task.assignedDepartmentId === department.departmentId
            || task.assignedDepartmentName === department.departmentName)
          .map(task => task.assignedUserDisplayName)
          .filter((name): name is string => Boolean(name)),
      )]
      const departmentName = department.departmentName ?? job.ownerDepartmentName ?? '—'
      return assignees.length > 0 ? `${departmentName} / ${assignees.join(', ')}` : departmentName
    })
    .join(', ') || job.ownerDepartmentName || '—'
}

export function SocialMessagesPage() {
  const { t, i18n } = useTranslation()
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // "Talep Oluştur" pop-up'ı için seçilen vatandaş mesajı (card 443).
  const [requestModalMessage, setRequestModalMessage] = useState<SocialMessage | null>(null)
  const [detailJob, setDetailJob] = useState<JobDetail | null>(null)
  const [detailLoadingJobId, setDetailLoadingJobId] = useState<string | null>(null)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    let isActive = true

    void Promise.all([
      api.getSocialMessages(),
      api.getDepartments(),
    ])
      .then(([messageList, departmentList]) => {
        if (!isActive) {
          return
        }

        setMessages(messageList)
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
  }, [t])

  const reload = async () => {
    setLoading(true)
    setError('')

    try {
      const [messageList, departmentList] = await Promise.all([
        api.getSocialMessages(),
        api.getDepartments(),
      ])

      setMessages(messageList)
      setDepartments(departmentList)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleRequestCreated = () => {
    setRequestModalMessage(null)
    void reload()
    invalidateSocialMessages(queryClient, requestModalMessage?.socialMessageId)
  }

  const openDetail = async (jobId: string) => {
    setDetailLoadingJobId(jobId)
    setError('')
    try {
      setDetailJob(await api.getJobById(jobId))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('common.error'))
    } finally {
      setDetailLoadingJobId(null)
    }
  }

  const { sortKey: socialSortKey, sortDir: socialSortDir, toggleSort: toggleSocialSort, sortItems: sortSocial } = useSortable()

  const { filters: socialFilters, setFilter: setSocialFilter, matchesFilters: socialMatchesFilters } = useColumnFilters()

  const filteredMessages = useMemo(() => {
    // Varsayılan görünümde WhatsApp satırlarını gizle; WhatsApp çipine tıklanınca gridde göster.
    let result = messages.filter(message => channelFilter
      ? message.channel === channelFilter
      : message.channel !== 'WhatsApp')

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
        formatCitizenRequestNumber(message),
        message.channel,
        message.citizenHandle,
        message.content,
        message.category,
        message.assignedDepartmentName,
      ].filter(Boolean).join(' ').toLocaleLowerCase('tr').includes(query))
    }

    return sortSocial(result)
  }, [channelFilter, filterFrom, filterTo, messages, searchText, sortSocial])

  const columnFilteredMessages = useMemo(
    () => filteredMessages.filter(m => socialMatchesFilters(m)),
    [filteredMessages, socialMatchesFilters],
  )

  const channelQuickFilters: { value: string; label: string }[] = [
    { value: 'Phone', label: t('nav.socialPhone', 'Çağrı') },
    { value: 'Instagram', label: 'Instagram' },
    { value: 'Facebook', label: 'Facebook' },
    { value: 'X', label: 'X' },
    { value: 'Email', label: t('nav.socialEmail', 'E-posta') },
    { value: 'WebForm', label: t('nav.socialWebForm', 'Web Formu') },
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
            <div className="page-kicker">{t('nav.social', 'Vatandaş Talepleri')}</div>
            <h1 className="page-title">{t('social.title')}</h1>
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
        {/* WhatsApp butonu gridi WhatsApp kanalına filtreler; konuşma sayfasına yönlendirmez (card 658). */}
        <button
          type="button"
          className={`scope-chip scope-chip--pending${channelFilter === 'WhatsApp' ? ' active' : ''}`}
          onClick={() => setChannelFilter('WhatsApp')}
          title={t('social.channelFilterLabel', 'Vatandaş talebi kanal filtreleri')}
        >
          <ChannelIcon channel="WhatsApp" className="size-3.5 shrink-0" />
          WhatsApp
        </button>
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
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-12 text-center">{t('common.rowNo', 'Sıra')}</th>
                <FilterableTh filterKey="jobNumber" filterValue={socialFilters['jobNumber'] ?? ''} onFilter={setSocialFilter} sortKey="jobNumber" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.citizenRequestNo', 'Vatandaş Talep No')}</FilterableTh>
                <FilterableTh filterKey="channel" filterValue={socialFilters['channel'] ?? ''} onFilter={setSocialFilter} sortKey="channel" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.channel')}</FilterableTh>
                <FilterableTh filterKey="citizenHandle" filterValue={socialFilters['citizenHandle'] ?? ''} onFilter={setSocialFilter} sortKey="citizenHandle" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.sender')}</FilterableTh>
                <FilterableTh filterKey="assignedDepartmentName" filterValue={socialFilters['assignedDepartmentName'] ?? ''} onFilter={setSocialFilter} sortKey="assignedDepartmentName" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.destination', 'Gittiği Yer')}</FilterableTh>
                <FilterableTh filterKey="receivedAtUtc" filterValue={socialFilters['receivedAtUtc'] ?? ''} onFilter={setSocialFilter} sortKey="receivedAtUtc" currentSortKey={socialSortKey} sortDir={socialSortDir} onSort={toggleSocialSort}>{t('social.date')}</FilterableTh>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {columnFilteredMessages.map((message, index) => (
                <Fragment key={message.socialMessageId}>
                  <tr>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{index + 1}</td>
                    <td className="table-number-cell font-mono text-xs text-slate-500">{formatCitizenRequestNumber(message)}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <ChannelIcon channel={message.channel} className="size-4 shrink-0" />
                        <span className="font-medium">{getSocialChannelLabel(t, message.channel)}</span>
                      </span>
                    </td>
                    <td className="font-semibold">@{message.citizenHandle}</td>
                    <td>{message.assignedDepartmentName ?? t('common.none')}</td>
                    <td>{new Date(message.receivedAtUtc).toLocaleString(getLocale(i18n.language))}</td>
                    <td className="actions-cell">
                      <div className="request-actions justify-center">
                        {!message.jobId ? (
                          <Button size="sm" type="button" variant="success" onClick={() => setRequestModalMessage(message)}>
                            {t('nav.createRequest', 'Talep Oluştur')}
                          </Button>
                        ) : message.jobId ? (
                          <Button
                            size="sm"
                            type="button"
                            variant="secondary"
                            disabled={detailLoadingJobId === message.jobId}
                            onClick={() => void openDetail(message.jobId!)}
                          >
                            {t('jobs.actions.details', 'Detaylar')}
                          </Button>
                        ) : (
                          <span className="text-sm text-slate-400">{t('common.none')}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {hasLocation(message) ? (
                    <tr className="bg-slate-50/70">
                      <td colSpan={7}>
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
              ))}
              {columnFilteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">{t('social.empty')}</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* "Talep Oluştur" → Birim Dışı Talep Oluştur formu (card 443). */}
      {requestModalMessage && (
        <CitizenRequestModal
          message={requestModalMessage}
          departments={departments}
          onClose={() => setRequestModalMessage(null)}
          onCreated={handleRequestCreated}
        />
      )}

      {detailJob && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetailJob(null)}
          role="presentation"
        >
          <section
            className="detail-modal-shell flex max-h-[min(85dvh,52rem)] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
              <div className="min-w-0">
                <div className="text-[0.75rem] font-extrabold uppercase tracking-[0.18em] text-slate-600">
                  {t('jobs.detail.requestInfo', 'Talep Detayları')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailJob(null)}
                className="flex size-8 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
                aria-label={t('common.close', 'Kapat')}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <section className="mb-5">
                <div className="mb-2 text-sm font-semibold text-emerald-600">
                  {t('jobs.detail.requestInfo', 'Talep Detayları')}
                </div>
                <div className="grid gap-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
                  <div className="min-w-0 divide-y divide-slate-100">
                    {[
                      {
                        label: 'Talep No',
                        value: detailJob.jobNumber != null && detailJob.jobNumberYear != null
                          ? `T-${detailJob.jobNumberYear}-${detailJob.jobNumber}`
                          : `T-${detailJob.jobNumberYear ?? new Date().getFullYear()}-Onay Bekleyen`,
                      },
                      { label: 'Talep Başlığı', value: detailJob.title },
                      {
                        label: 'Talep Yeri / Oluşturan',
                        value: [detailJob.ownerDepartmentName, detailJob.createdByDisplayName].filter(Boolean).join(' / ') || '—',
                      },
                      {
                        label: 'Gittiği Yer',
                        value: formatJobDestinationsWithAssignees(detailJob),
                      },
                      { label: 'Proje mi', value: detailJob.isProject ? t('common.yes', 'Evet') : t('common.no', 'Hayır') },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-start gap-2 px-3 py-2">
                        <span className="w-36 shrink-0 pt-0.5 text-xs font-semibold text-slate-500">{label}</span>
                        <span className="min-w-0 break-words text-sm text-slate-900">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
                    <div className="divide-y divide-slate-100">
                      {[
                        { label: 'Öncelik', value: detailJob.priority },
                        {
                          label: 'Durum',
                          value: detailJob.status === 'Active'
                            ? 'Yapılmakta Olan'
                            : detailJob.status === 'Completed'
                              ? 'Tamamlanmış'
                              : getJobStatusLabel(t, detailJob.status),
                        },
                        { label: 'Talep Tarihi', value: formatDateTime(detailJob.createdAtUtc, getLocale(i18n.language)) },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-start gap-2 px-3 py-2">
                          <span className="w-28 shrink-0 pt-0.5 text-xs font-semibold text-slate-500">{label}</span>
                          <span className="min-w-0 break-words text-sm text-slate-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
                    <div className="divide-y divide-slate-100">
                      {[
                        { label: 'Son Tarih Bilgisi', value: formatDueDateTime(detailJob.dueDateUtc, getLocale(i18n.language)) },
                        { label: 'Koordineli mi', value: detailJob.isCoordinated ? t('common.yes', 'Evet') : t('common.no', 'Hayır') },
                        { label: 'Kaynak', value: t(`dashboard.sourceType.${detailJob.sourceType}`, detailJob.sourceType) },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-start gap-2 px-3 py-2">
                          <span className="w-28 shrink-0 pt-0.5 text-xs font-semibold text-slate-500">{label}</span>
                          <span className="min-w-0 break-words text-sm text-slate-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('jobs.form.description', 'Açıklama')}
                  </span>
                </div>
                <div className="px-4 py-3">
                  <RichTextContent value={detailJob.description} emptyText={t('common.none')} className="rich-text-content text-sm leading-6 text-slate-900" />
                </div>
              </section>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  )
}
