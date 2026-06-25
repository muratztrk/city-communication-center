import { MapPin, Search, X } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useSortable } from '../hooks/useSortable'
import { FilterableTh } from '../components/ui/FilterableTh'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateSocialMessages } from '../api/cacheInvalidation'
import { Button } from '../components/ui/button'
import { ChannelIcon } from '../components/ui/channel-icon'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { DisabledActionButton } from '../components/ui/DisabledActionButton'
import type { Department, SocialMessage } from '../types/platform'
import { getLocale, getSocialChannelLabel } from '../utils/localization'
import { CitizenRequestModal } from '../components/CitizenRequestModal'
import { TablePagination } from '../components/ui/table-pagination'
import { JobsPage } from './JobsPage'

function hasLocation(message: SocialMessage) {
  return message.latitude != null && message.longitude != null
}

function getLocationMapUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${(longitude - 0.005).toFixed(6)},${(latitude - 0.005).toFixed(6)},${(longitude + 0.005).toFixed(6)},${(latitude + 0.005).toFixed(6)}&layer=mapnik&marker=${latitude},${longitude}`
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

export function SocialMessagesPage() {
  const { t, i18n } = useTranslation()
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // "Talep Oluştur" pop-up'ı için seçilen vatandaş mesajı (card 443).
  const [requestModalMessage, setRequestModalMessage] = useState<SocialMessage | null>(null)
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

  const { sortKey: socialSortKey, sortDir: socialSortDir, toggleSort: toggleSocialSort, sortItems: sortSocial } = useSortable()
  const { filters: socialFilters, setFilter: setSocialFilter, matchesFilters: socialMatchesFilters } = useColumnFilters()

  const filteredMessages = useMemo(() => {
    const showAllChannels = channelParam === ALL_CHANNELS_FILTER
    // Varsayılan görünümde WhatsApp; "Tümü" seçilince tüm kanallar (WhatsApp dahil).
    let result = messages.filter(message => {
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
        formatCitizenRequestNumber(message),
        message.channel,
        message.citizenHandle,
        message.content,
        message.category,
        message.assignedDepartmentName,
      ].filter(Boolean).join(' ').toLocaleLowerCase('tr').includes(query))
    }

    return sortSocial(result)
  }, [channelFilter, channelParam, filterFrom, filterTo, messages, searchText, sortSocial])

  const columnFilteredMessages = useMemo(
    () => filteredMessages.filter(m => socialMatchesFilters(m)),
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
          <table className={`data-table social-messages-table${pagedMessages.length === 0 ? ' data-table--empty' : ''}`}>
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
              {pagedMessages.map((message, index) => (
                <Fragment key={message.socialMessageId}>
                  <tr>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(messagesPage - 1) * messagesPageSize + index + 1}</td>
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
                        {message.channel === 'WhatsApp' ? (
                          <Button
                            size="sm"
                            type="button"
                            className="bg-[#00a6b4] text-white hover:bg-[#00919e]"
                            onClick={() => navigate(`/whatsapp?phone=${encodeURIComponent(message.citizenHandle)}`)}
                          >
                            {t('social.goToConversation', 'Yazışmaya Git')}
                          </Button>
                        ) : null}
                        {message.jobId ? (
                          <DisabledActionButton size="sm" variant="success" hoverTitle={t('social.requestAlreadyCreated', 'Talep zaten oluşturulmuş')}>
                            {t('nav.createRequest', 'Talep Oluştur')}
                          </DisabledActionButton>
                        ) : (
                          <Button size="sm" type="button" variant="success" onClick={() => setRequestModalMessage(message)}>
                            {t('nav.createRequest', 'Talep Oluştur')}
                          </Button>
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

      {/* "Talep Oluştur" → Birim Dışı Talep Oluştur formu (card 443). */}
      {requestModalMessage && (
        <CitizenRequestModal
          message={requestModalMessage}
          departments={departments}
          onClose={() => setRequestModalMessage(null)}
          onCreated={handleRequestCreated}
        />
      )}

      {detailJobId && (
        <JobsPage
          mode="myRequests"
          fixedScope="mine"
          detailOnly
          notificationJobId={detailJobId}
          onNotificationDetailClose={() => setDetailJobId(null)}
        />
      )}
    </div>
  )
}
