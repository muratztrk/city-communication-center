import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { FilterableTh } from '../components/ui/FilterableTh'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { TablePagination } from '../components/ui/table-pagination'
import { TruncatedText } from '../components/ui/TruncatedText'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import type { JobSummary } from '../types/platform'
import { formatCitizenRequestNumber } from '../utils/citizenRequests'
import { matchesBannerSearch } from '../utils/bannerSearch'
import { getLocale } from '../utils/localization'

type ReturnedCitizenRequestRow = {
  jobId: string
  displayNumber: string
  title: string
  returnedFromDepartmentName: string
  returnReason: string
  returnedAtText: string
  returnedAtUtc: string | null
}

function toReturnedRow(job: JobSummary, locale: string): ReturnedCitizenRequestRow {
  const returnedAtUtc = job.returnedToOperatorAtUtc ?? null
  return {
    jobId: job.jobId,
    displayNumber: formatCitizenRequestNumber(job, locale),
    title: job.title,
    returnedFromDepartmentName: job.returnedFromDepartmentName?.trim() || '—',
    returnReason: job.returnedToOperatorReason?.trim() || '—',
    returnedAtText: returnedAtUtc ? new Date(returnedAtUtc).toLocaleString(locale) : '—',
    returnedAtUtc,
  }
}

export function ReturnedCitizenRequestsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const locale = getLocale(i18n.language)
  const [pageSize, setPageSize] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchText, setSearchText] = useState('')

  const jobsQuery = useQuery({
    queryKey: queryKeys.jobs.list('returned-to-operator'),
    queryFn: () => api.getJobs('returned-to-operator'),
  })

  const { sortKey, sortDir, toggleSort, sortItems } = useSortable()
  const { filters, setFilter, matchesFilters } = useColumnFilters()

  const rows = useMemo(
    () => (jobsQuery.data ?? []).map(job => toReturnedRow(job, locale)),
    [jobsQuery.data, locale],
  )

  const getColumnValue = (key: string, row: ReturnedCitizenRequestRow): string => {
    if (key === 'displayNumber') return row.displayNumber
    if (key === 'returnedFromDepartmentName') return row.returnedFromDepartmentName
    if (key === 'returnReason') return row.returnReason
    if (key === 'returnedAtUtc') return row.returnedAtText
    return String((row as unknown as Record<string, unknown>)[key] ?? '')
  }

  const filteredRows = useMemo(() => {
    const searchNormalized = searchText.trim()
    return rows.filter(row => {
      if (searchNormalized && !matchesBannerSearch(
        searchNormalized,
        ['displayNumber', 'title', 'returnedFromDepartmentName', 'returnReason', 'returnedAtText'].map(key => getColumnValue(key, row)),
      )) {
        return false
      }
      return matchesFilters(row, getColumnValue)
    })
  }, [matchesFilters, rows, searchText])

  const sortedRows = useMemo(() => {
    if (!sortKey) {
      return [...filteredRows].sort((a, b) => (b.returnedAtUtc ?? '').localeCompare(a.returnedAtUtc ?? ''))
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

  const openDetail = (jobId: string) => {
    navigate(`/request-details?context=returned&jobId=${encodeURIComponent(jobId)}`)
  }

  return (
    <div className="page-stack desktop-page-fill">
      <section className="section-card">
        <div className="section-header">
          <div>
            <h1 className="page-title">{t('returnedCitizenRequests.title', 'Operatöre İade Edilen Talepler')}</h1>
            <p className="helper-copy">{t('returnedCitizenRequests.subtitle', 'Birimlerden operatöre iade edilen vatandaş talepleri.')}</p>
          </div>
        </div>
      </section>

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      <section className="section-card desktop-page-fill">
        <div className="table-toolbar">
          <label className="search-field">
            <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchText}
              onChange={event => {
                setSearchText(event.target.value)
                setCurrentPage(1)
              }}
              placeholder={t('common.search', 'Ara...')}
            />
          </label>
        </div>

        <div className="table-wrap desktop-panel-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <FilterableTh
                  filterKey="displayNumber"
                  filterValue={filters.displayNumber ?? ''}
                  onFilter={handleFilter}
                  sortKey="displayNumber"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('returnedCitizenRequests.columns.requestNumber', 'Talep No')}
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
                  filterKey="returnedFromDepartmentName"
                  filterValue={filters.returnedFromDepartmentName ?? ''}
                  onFilter={handleFilter}
                  sortKey="returnedFromDepartmentName"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('returnedCitizenRequests.columns.returnedFromDepartment', 'İade Eden Birim')}
                </FilterableTh>
                <FilterableTh
                  filterKey="returnReason"
                  filterValue={filters.returnReason ?? ''}
                  onFilter={handleFilter}
                  sortKey="returnReason"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('returnedCitizenRequests.columns.reason', 'İade Sebebi')}
                </FilterableTh>
                <FilterableTh
                  filterKey="returnedAtUtc"
                  filterValue={filters.returnedAtUtc ?? ''}
                  onFilter={handleFilter}
                  sortKey="returnedAtUtc"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('returnedCitizenRequests.columns.returnedAt', 'İade Tarihi')}
                </FilterableTh>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map(row => (
                <tr
                  key={row.jobId}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => openDetail(row.jobId)}
                >
                  <td className="font-semibold text-slate-700">{row.displayNumber}</td>
                  <td><TruncatedText text={row.title} /></td>
                  <td>{row.returnedFromDepartmentName}</td>
                  <td className="max-w-[18rem]"><TruncatedText text={row.returnReason} /></td>
                  <td>{row.returnedAtText}</td>
                </tr>
              ))}
              {sortedRows.length === 0 && !jobsQuery.isLoading ? (
                <TableEmptyStateRows columnCount={5} message={t('returnedCitizenRequests.empty', 'Operatöre iade edilmiş talep yok.')} />
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
    </div>
  )
}
