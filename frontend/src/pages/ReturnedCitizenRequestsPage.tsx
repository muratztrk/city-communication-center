import { Search, X } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { Button } from '../components/ui/button'
import { ChannelIcon } from '../components/ui/channel-icon'
import { DateCell } from '../components/ui/date-cell'
import { FilterableTh } from '../components/ui/FilterableTh'
import { ScopeChipDateRange } from '../components/ui/scope-chip-date-range'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { TablePagination } from '../components/ui/table-pagination'
import { TruncatedText } from '../components/ui/TruncatedText'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import type { JobListScope, JobSummary, SocialMessage } from '../types/platform'
import { matchesBannerSearch } from '../utils/bannerSearch'
import { formatCitizenPhoneDisplay, formatCitizenRequestNumber } from '../utils/citizenRequests'
import { getLocale } from '../utils/localization'
import { looksLikePhone } from '../utils/phoneDisplay'

const JobsPage = lazy(() => import('./JobsPage').then(module => ({ default: module.JobsPage })))

type ReturnedScope = 'pending' | 'forwarded' | 'all'

const RETURNED_SCOPE_FILTERS: Array<{
  value: ReturnedScope
  labelKey: string
  fallback: string
  chipClass: string
  apiScope: JobListScope | null
}> = [
  { value: 'pending', labelKey: 'returnedCitizenRequests.scope.pending', fallback: 'Bekleyen', chipClass: 'scope-chip--pending', apiScope: 'returned-to-operator' },
  { value: 'forwarded', labelKey: 'returnedCitizenRequests.scope.forwarded', fallback: 'Yönlendirilen', chipClass: 'scope-chip--completed', apiScope: 'returned-forwarded-by-operator' },
  { value: 'all', labelKey: 'returnedCitizenRequests.scope.all', fallback: 'Tümü', chipClass: 'scope-chip--all', apiScope: null },
]

type ReturnedCitizenRequestRow = {
  jobId: string
  displayNumber: string
  citizenName: string
  citizenPhone: string
  title: string
  requestDateUtc: string
  requestDateText: string
  destinationName: string
  returnedReason: string
  channel?: string | null
}

function getSocialMessageCitizenName(message: SocialMessage): string {
  if (message.citizenName?.trim()) return message.citizenName.trim()
  const handle = message.citizenHandle?.trim() ?? ''
  if (!handle || looksLikePhone(handle)) return '—'
  return handle.replace(/^@+/, '') || '—'
}

function getSocialMessageCitizenPhone(message: SocialMessage): string {
  if (message.citizenPhone?.trim()) return formatCitizenPhoneDisplay(message.citizenPhone)
  if (looksLikePhone(message.citizenHandle)) return formatCitizenPhoneDisplay(message.citizenHandle)
  return '—'
}

function resolveDestinationName(job: JobSummary): string {
  return job.returnedFromDepartmentName?.trim() || '—'
}

function toReturnedRow(
  job: JobSummary,
  locale: string,
  socialByJobId: Map<string, SocialMessage>,
): ReturnedCitizenRequestRow {
  const linkedMessage = socialByJobId.get(job.jobId)
  const requestDateUtc = linkedMessage?.receivedAtUtc ?? job.createdAtUtc ?? ''
  const citizenName = job.citizenName?.trim()
    || (linkedMessage ? getSocialMessageCitizenName(linkedMessage) : '—')
  const citizenPhone = job.citizenPhone?.trim()
    ? formatCitizenPhoneDisplay(job.citizenPhone)
    : linkedMessage
      ? getSocialMessageCitizenPhone(linkedMessage)
      : '—'

  return {
    jobId: job.jobId,
    displayNumber: formatCitizenRequestNumber(linkedMessage ?? job, locale),
    citizenName,
    citizenPhone,
    title: job.title?.trim() || '—',
    requestDateUtc,
    requestDateText: requestDateUtc ? new Date(requestDateUtc).toLocaleString(locale) : '—',
    destinationName: resolveDestinationName(job),
    returnedReason: job.returnedToOperatorReason?.trim() || '—',
    channel: linkedMessage?.channel ?? null,
  }
}

export function ReturnedCitizenRequestsPage() {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const [pageSize, setPageSize] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchText, setSearchText] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [scope, setScope] = useState<ReturnedScope>('pending')
  const [detailJobId, setDetailJobId] = useState<string | null>(null)
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)

  const activeScopeFilter = RETURNED_SCOPE_FILTERS.find(filter => filter.value === scope) ?? RETURNED_SCOPE_FILTERS[0]

  const jobsQuery = useQuery({
    queryKey: queryKeys.jobs.returnedCitizenRequests(scope),
    queryFn: async () => {
      if (scope === 'all') {
        const [pending, forwarded] = await Promise.all([
          api.getJobs('returned-to-operator'),
          api.getJobs('returned-forwarded-by-operator'),
        ])
        const byId = new Map<string, JobSummary>()
        for (const job of [...pending, ...forwarded]) {
          byId.set(job.jobId, job)
        }
        return [...byId.values()]
      }
      return api.getJobs(activeScopeFilter.apiScope ?? 'returned-to-operator')
    },
  })

  const socialQuery = useQuery({
    queryKey: queryKeys.socialMessages.list(),
    queryFn: () => api.getSocialMessages(),
    enabled: (jobsQuery.data?.length ?? 0) > 0,
  })

  const socialByJobId = useMemo(() => {
    const map = new Map<string, SocialMessage>()
    for (const message of socialQuery.data ?? []) {
      if (message.jobId) map.set(message.jobId, message)
    }
    return map
  }, [socialQuery.data])

  const { sortKey, sortDir, toggleSort, sortItems } = useSortable()
  const { filters, setFilter, matchesFilters } = useColumnFilters()

  const rows = useMemo(
    () => (jobsQuery.data ?? []).map(job => toReturnedRow(job, locale, socialByJobId)),
    [jobsQuery.data, locale, socialByJobId],
  )

  const getColumnValue = (key: string, row: ReturnedCitizenRequestRow): string => {
    if (key === 'displayNumber') return row.displayNumber
    if (key === 'citizenName') return row.citizenName
    if (key === 'citizenPhone') return row.citizenPhone
    if (key === 'title') return row.title
    if (key === 'requestDateUtc') return row.requestDateText
    if (key === 'destinationName') return row.destinationName
    if (key === 'returnedReason') return row.returnedReason
    return String((row as unknown as Record<string, unknown>)[key] ?? '')
  }

  const filteredRows = useMemo(() => rows.filter(row => {
    if (filterFrom || filterTo) {
      const requestDate = row.requestDateUtc ? row.requestDateUtc.slice(0, 10) : ''
      if (filterFrom && requestDate && requestDate < filterFrom.slice(0, 10)) return false
      if (filterTo && requestDate && requestDate > filterTo.slice(0, 10)) return false
    }
    if (!matchesBannerSearch(searchText, [
      row.displayNumber,
      row.citizenName,
      row.citizenPhone,
      row.title,
      row.destinationName,
      row.returnedReason,
      row.requestDateText,
    ])) {
      return false
    }
    return matchesFilters(row, getColumnValue)
  }), [filterFrom, filterTo, matchesFilters, rows, searchText])

  const sortedRows = useMemo(() => {
    if (!sortKey) {
      return [...filteredRows].sort((a, b) => b.requestDateUtc.localeCompare(a.requestDateUtc))
    }
    return sortItems(filteredRows)
  }, [filteredRows, sortItems, sortKey])

  const totalCount = sortedRows.length
  const safePage = Math.min(currentPage, Math.max(1, Math.ceil(totalCount / pageSize) || 1))
  const pagedRows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  const error = jobsQuery.error
    ? jobsQuery.error instanceof Error ? jobsQuery.error.message : t('common.error')
    : ''

  const handleFilter = (key: string, value: string) => {
    setFilter(key, value)
    setCurrentPage(1)
  }

  const handleSort = (key: string) => {
    toggleSort(key)
    setCurrentPage(1)
  }

  if (jobsQuery.isLoading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{t('returnedCitizenRequests.title', 'İade Edilen Talepler')}</div>
            <h1 className="page-title">{t('nav.returnedCitizenRequests', 'İade Edilen Talepler').replace('\n', ' ')}</h1>
            <p className="page-subtitle">{t('returnedCitizenRequests.subtitle', 'Birimlerden operatöre iade edilen vatandaş talepleri.')}</p>
          </div>
          <div className="ml-auto mt-auto shrink-0">
            <div className="scope-chips-filters">
              <div className="scope-chip-search-wrap">
                <Search className="scope-chip-search-icon size-3 shrink-0 text-slate-400" aria-hidden="true" />
                <input
                  type="text"
                  className="scope-chip-search-input"
                  placeholder={t('common.search', 'Ara...')}
                  value={searchText}
                  onChange={event => {
                    setSearchText(event.target.value)
                    setCurrentPage(1)
                  }}
                />
                {searchText ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchText('')
                      setCurrentPage(1)
                    }}
                    className="scope-chip-search-clear shrink-0 font-extrabold text-red-600 transition-colors hover:text-red-700"
                    aria-label={t('common.clear', 'Temizle')}
                  >
                    <X className="size-3.5" strokeWidth={3} />
                  </button>
                ) : null}
              </div>
              <ScopeChipDateRange
                from={filterFrom}
                to={filterTo}
                onFromChange={value => {
                  setFilterFrom(value)
                  setCurrentPage(1)
                }}
                onToChange={value => {
                  setFilterTo(value)
                  setCurrentPage(1)
                }}
                forceDown
              />
            </div>
          </div>
        </div>
      </header>

      <nav className="scope-chips" aria-label={t('returnedCitizenRequests.title', 'İade Edilen Talepler')}>
        {RETURNED_SCOPE_FILTERS.map(filter => (
          <button
            key={filter.value}
            type="button"
            className={`scope-chip ${filter.chipClass}${filter.value === scope ? ' active' : ''}`}
            onClick={() => {
              setScope(filter.value)
              setCurrentPage(1)
            }}
          >
            {t(filter.labelKey, filter.fallback)}
          </button>
        ))}
      </nav>

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      <section className="section-card desktop-page-fill">
        <div className="table-wrap desktop-panel-scroll">
          <table className="data-table jobs-table data-table--zebra social-messages-table returned-citizen-requests-table">
            <thead>
              <tr>
                <th className="w-12 text-center">{t('common.rowNo', 'Sıra')}</th>
                <FilterableTh
                  filterKey="displayNumber"
                  filterValue={filters.displayNumber ?? ''}
                  onFilter={handleFilter}
                  sortKey="displayNumber"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  <span className="inline-flex whitespace-nowrap leading-tight">
                    <span>{t('returnedCitizenRequests.columns.requestNumber', 'Vatandaş Talep No')}</span>
                  </span>
                </FilterableTh>
                <FilterableTh
                  filterKey="citizenName"
                  filterValue={filters.citizenName ?? ''}
                  onFilter={handleFilter}
                  sortKey="citizenName"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  <span className="inline-flex flex-col gap-1 leading-tight">
                    <span>{t('returnedCitizenRequests.columns.citizenName', 'Vatandaş Adı')}</span>
                    <span className="text-[0.9em] font-bold leading-tight">{t('jobs.detail.citizenPhone', 'Telefon No')}</span>
                  </span>
                </FilterableTh>
                <FilterableTh
                  filterKey="title"
                  filterValue={filters.title ?? ''}
                  onFilter={handleFilter}
                  sortKey="title"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('returnedCitizenRequests.columns.title', 'Başlık')}
                </FilterableTh>
                <FilterableTh
                  filterKey="requestDateUtc"
                  filterValue={filters.requestDateUtc ?? ''}
                  onFilter={handleFilter}
                  sortKey="requestDateUtc"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('returnedCitizenRequests.columns.requestDateShort', 'Talep Tarihi')}
                </FilterableTh>
                <FilterableTh
                  filterKey="destinationName"
                  filterValue={filters.destinationName ?? ''}
                  onFilter={handleFilter}
                  sortKey="destinationName"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('returnedCitizenRequests.columns.destination', 'Geldiği Yer')}
                </FilterableTh>
                <FilterableTh
                  filterKey="returnedReason"
                  filterValue={filters.returnedReason ?? ''}
                  onFilter={handleFilter}
                  sortKey="returnedReason"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('jobs.detail.returnedReason', 'İade Sebebi')}
                </FilterableTh>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row, index) => (
                <tr key={row.jobId}>
                  <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(safePage - 1) * pageSize + index + 1}</td>
                  <td className="table-number-cell font-mono text-xs text-slate-500">
                    <div className="table-number-cell__value inline-flex items-center gap-1.5">
                      {row.channel ? <ChannelIcon channel={row.channel} className="size-3.5 shrink-0" /> : null}
                      <span>{row.displayNumber}</span>
                    </div>
                  </td>
                  <td className="citizen-message-approval-citizen-cell">
                    <div className="font-semibold">{row.citizenName}</div>
                    <div className="citizen-message-approval-phone-value font-medium text-slate-600">{row.citizenPhone}</div>
                  </td>
                  <td className="font-semibold">
                    <TruncatedText text={row.title} className="cell-title" />
                  </td>
                  <td><DateCell value={row.requestDateUtc} locale={locale} /></td>
                  <td><span className="font-semibold text-slate-700">{row.destinationName}</span></td>
                  <td>
                    <TruncatedText text={row.returnedReason} className="cell-title" />
                  </td>
                  <td>
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setDetailJobId(row.jobId)}
                      >
                        {t('jobs.actions.details', 'Detaylar')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 ? (
                <TableEmptyStateRows columnCount={8} message={t('returnedCitizenRequests.empty', 'İade edilmiş talep yok.')} />
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePagination
          totalCount={totalCount}
          pageSize={pageSize}
          currentPage={safePage}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => {
            setPageSize(size)
            setCurrentPage(1)
          }}
        />
      </section>

      {detailJobId ? (
        <Suspense fallback={<div className="loading">{t('common.loading')}</div>}>
          <JobsPage
            key={`${detailJobId}-${detailRefreshKey}`}
            mode="myRequests"
            fixedScope="mine"
            detailOnly
            detailContextOverride="returned"
            notificationJobId={detailJobId}
            onNotificationDetailClose={() => {
              setDetailJobId(null)
              setDetailRefreshKey(current => current + 1)
            }}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
