import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { Button } from '../components/ui/button'
import { ChannelIcon } from '../components/ui/channel-icon'
import { DateCell } from '../components/ui/date-cell'
import { FilterableTh } from '../components/ui/FilterableTh'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { TablePagination } from '../components/ui/table-pagination'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import type { JobSummary, SocialMessage } from '../types/platform'
import { formatCitizenPhoneDisplay, formatCitizenRequestNumber } from '../utils/citizenRequests'
import { getLocale } from '../utils/localization'
import { looksLikePhone } from '../utils/phoneDisplay'
import { JobsPage } from './JobsPage'

type ReturnedCitizenRequestRow = {
  jobId: string
  displayNumber: string
  citizenName: string
  citizenPhone: string
  requestDateUtc: string
  requestDateText: string
  destinationName: string
  labelText: string
  channel?: string | null
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

function resolveDestinationName(job: JobSummary): string {
  const targetDepartment = job.departments?.find(department => department.role === 'Target')
  return targetDepartment?.departmentName?.trim()
    || job.returnedFromDepartmentName?.trim()
    || '—'
}

function toReturnedRow(
  job: JobSummary,
  locale: string,
  socialByJobId: Map<string, SocialMessage>,
): ReturnedCitizenRequestRow {
  const linkedMessage = socialByJobId.get(job.jobId)
  const requestDateUtc = linkedMessage?.receivedAtUtc ?? job.createdAtUtc
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
    requestDateUtc,
    requestDateText: requestDateUtc ? new Date(requestDateUtc).toLocaleString(locale) : '—',
    destinationName: resolveDestinationName(job),
    labelText: linkedMessage?.category?.trim() || '—',
    channel: linkedMessage?.channel ?? null,
  }
}

export function ReturnedCitizenRequestsPage() {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const [pageSize, setPageSize] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)
  const [detailJobId, setDetailJobId] = useState<string | null>(null)
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)

  const jobsQuery = useQuery({
    queryKey: queryKeys.jobs.list('returned-to-operator'),
    queryFn: () => api.getJobs('returned-to-operator'),
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
    if (key === 'requestDateUtc') return row.requestDateText
    if (key === 'destinationName') return row.destinationName
    if (key === 'labelText') return row.labelText
    return String((row as unknown as Record<string, unknown>)[key] ?? '')
  }

  const filteredRows = useMemo(
    () => rows.filter(row => matchesFilters(row, getColumnValue)),
    [matchesFilters, rows],
  )

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
        </div>
      </header>

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      <section className="section-card desktop-page-fill">
        <div className="table-wrap desktop-panel-scroll">
          <table className="data-table jobs-table data-table--zebra social-messages-table">
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
                  {t('returnedCitizenRequests.columns.citizenName', 'Vatandaş Adı')}
                </FilterableTh>
                <FilterableTh
                  filterKey="citizenPhone"
                  filterValue={filters.citizenPhone ?? ''}
                  onFilter={handleFilter}
                  sortKey="citizenPhone"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('jobs.detail.citizenPhone', 'Telefon No')}
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
                  <span className="inline-flex whitespace-nowrap leading-tight">
                    <span>{t('returnedCitizenRequests.columns.requestDate', 'Vatandaş Talep Tarihi')}</span>
                  </span>
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
                  filterKey="labelText"
                  filterValue={filters.labelText ?? ''}
                  onFilter={handleFilter}
                  sortKey="labelText"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('whatsapp.label', 'Talep Etiketi')}
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
                  <td className="font-semibold">{row.citizenName}</td>
                  <td className="citizen-grid-phone-value text-sm font-semibold text-slate-500 tabular-nums">{row.citizenPhone}</td>
                  <td><DateCell value={row.requestDateUtc} locale={locale} /></td>
                  <td><span className="font-semibold text-slate-700">{row.destinationName}</span></td>
                  <td>{row.labelText}</td>
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
      ) : null}
    </div>
  )
}
