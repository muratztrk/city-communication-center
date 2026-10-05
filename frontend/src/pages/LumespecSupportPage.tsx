import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/button'
import { FilterableTh } from '../components/ui/FilterableTh'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { TablePagination } from '../components/ui/table-pagination'
import { TruncatedText } from '../components/ui/TruncatedText'
import { SupportRequestDialog } from '../components/layout/SupportRequestDialog'
import { SupportRequestDetailModal } from '../components/support/SupportRequestDetailModal'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import { getLocale } from '../utils/localization'
import { muteNewRecordSoundWhileMounted } from '../utils/newRecordSoundSuppress'
import { DateTimeText } from '../components/ui/date-time-text'
import { StatusPill } from '../components/ui/status-pill'
import { buildLumespecSupportTicketDisplayMap, formatLumespecSupportTicketNo } from '../utils/lumespecSupportTicket'
import {
  isCentralSupportStatusResolved,
  isCentralSupportStatusWaiting,
} from '../utils/centralSupportStatus'
import { resolveSupportRequestStatusLabel } from '../utils/supportRequestStatus'
import type { MySupportRequest } from '../types/platform'

type SupportScope = 'waiting' | 'resolved' | 'all'

const SCOPE_FILTERS: Array<{ value: SupportScope; labelKey: string; fallback: string; chipClass: string }> = [
  { value: 'waiting', labelKey: 'support.scopes.waiting', fallback: 'Çözüm Bekleyen', chipClass: 'scope-chip--in-progress' },
  { value: 'resolved', labelKey: 'support.scopes.resolved', fallback: 'Çözümlendi', chipClass: 'scope-chip--completed' },
  { value: 'all', labelKey: 'support.scopes.all', fallback: 'Tümü', chipClass: 'scope-chip--all' },
]

const COLUMN_COUNT = 7

export function LumespecSupportPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const locale = getLocale(i18n.language)
  const userDisplayName = user?.displayName?.trim() || '—'

  const [scope, setScope] = useState<SupportScope>('waiting')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<MySupportRequest | null>(null)
  const [pageSize, setPageSize] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)
  const { filters, setFilter, matchesFilters } = useColumnFilters()
  const { sortKey, sortDir, toggleSort, sortItems } = useSortable()

  useEffect(() => muteNewRecordSoundWhileMounted(), [])

  const requestsQuery = useQuery({
    queryKey: queryKeys.supportRequests.mine(),
    queryFn: () => api.getMySupportRequests(),
  })

  const ticketDisplayMap = useMemo(
    () => buildLumespecSupportTicketDisplayMap(requestsQuery.data ?? []),
    [requestsQuery.data],
  )

  const rows = useMemo(() => {
    const source = (requestsQuery.data ?? []).map(item => {
      const statusLabel = resolveSupportRequestStatusLabel(t, item.centralStatus, item.centralSyncError)
      return {
        ...item,
        ticketNoText: formatLumespecSupportTicketNo(item, ticketDisplayMap),
        requestDateText: new Date(item.createdAtUtc).toLocaleString(locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        descriptionText: item.message,
        statusLabel,
      }
    })

    const scoped = source.filter(item => {
      if (scope === 'waiting') return isCentralSupportStatusWaiting(item.centralStatus)
      if (scope === 'resolved') return isCentralSupportStatusResolved(item.centralStatus)
      return true
    })

    const filtered = scoped.filter(item => matchesFilters(item, (key, row) => {
      if (key === 'ticketNo') return row.ticketNoText
      if (key === 'requestDate') return row.requestDateText
      if (key === 'subject') return row.subject
      if (key === 'description') return row.descriptionText
      if (key === 'status') return row.statusLabel
      return ''
    }))

    if (!sortKey) {
      return [...filtered].sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc))
    }
    return sortItems(filtered)
  }, [locale, matchesFilters, requestsQuery.data, scope, sortItems, sortKey, t, ticketDisplayMap])

  const totalCount = rows.length
  const safePage = Math.min(currentPage, Math.max(1, Math.ceil(totalCount / pageSize) || 1))
  const pagedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize)

  const activeScope = SCOPE_FILTERS.find(filter => filter.value === scope) ?? SCOPE_FILTERS[0]

  const handleFilter = (key: string, value: string) => {
    setFilter(key, value)
    setCurrentPage(1)
  }

  const handleSort = (key: string) => {
    toggleSort(key)
    setCurrentPage(1)
  }

  return (
    <div className="page-stack desktop-page-shell lumespec-support-page">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{t(activeScope.labelKey, activeScope.fallback)}</div>
            <h1 className="page-title">{t('support.pageTitle', 'Lumespec Destek')}</h1>
            <p className="page-subtitle">
              {t('support.pageSubtitle', 'Merkezi destek taleplerinizi görüntüleyin ve yeni talep oluşturun.')}
            </p>
          </div>
        </div>
      </header>

      <nav className="scope-chips flex flex-wrap items-center gap-2" aria-label={t('support.scopeFilterLabel', 'Destek talebi filtreleri')}>
        {SCOPE_FILTERS.map(filter => (
          <button
            key={filter.value}
            type="button"
            className={`scope-chip ${filter.chipClass}${scope === filter.value ? ' active' : ''}`}
            onClick={() => {
              setScope(filter.value)
              setCurrentPage(1)
            }}
          >
            {t(filter.labelKey, filter.fallback)}
          </button>
        ))}
        <Button
          type="button"
          variant="primary"
          className="lumespec-support-create-btn ml-auto shrink-0"
          onClick={() => setCreateOpen(true)}
        >
          {t('support.createRequest', 'Destek Talebi Oluştur')}
        </Button>
      </nav>

      {requestsQuery.isError ? <div className="error">{t('common.error')}</div> : null}

      <section className="section-card desktop-page-fill">
        <div className="table-wrap desktop-panel-scroll">
          <table className="data-table jobs-table data-table--zebra lumespec-support-table">
            <thead>
              <tr>
                <th className="w-12 text-center">{t('common.rowNo', 'Sıra')}</th>
                <FilterableTh
                  filterKey="ticketNo"
                  filterValue={filters.ticketNo ?? ''}
                  onFilter={handleFilter}
                  sortKey="ticketNoText"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('support.columns.ticketNo', 'Destek No')}
                </FilterableTh>
                <FilterableTh
                  filterKey="requestDate"
                  filterValue={filters.requestDate ?? ''}
                  onFilter={handleFilter}
                  sortKey="requestDateText"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('support.columns.requestDate', 'Talep Tarihi')}
                </FilterableTh>
                <FilterableTh
                  filterKey="subject"
                  filterValue={filters.subject ?? ''}
                  onFilter={handleFilter}
                  sortKey="subject"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('support.columns.subject', 'Konu')}
                </FilterableTh>
                <FilterableTh
                  filterKey="description"
                  filterValue={filters.description ?? ''}
                  onFilter={handleFilter}
                  sortKey="descriptionText"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('support.columns.message', 'Açıklama')}
                </FilterableTh>
                <FilterableTh
                  filterKey="status"
                  filterValue={filters.status ?? ''}
                  onFilter={handleFilter}
                  sortKey="statusLabel"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('support.columns.status', 'Talep Durumu')}
                </FilterableTh>
                <th className="text-center">{t('common.actions', 'İşlemler')}</th>
              </tr>
            </thead>
            <tbody>
              {requestsQuery.isLoading ? (
                <TableEmptyStateRows columnCount={COLUMN_COUNT} message={t('common.loading', 'Yükleniyor...')} />
              ) : pagedRows.length === 0 ? (
                <TableEmptyStateRows columnCount={COLUMN_COUNT} message={t('support.empty', 'Kayıt bulunamadı.')} />
              ) : (
                pagedRows.map((row, index) => (
                  <tr key={row.supportRequestId}>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(safePage - 1) * pageSize + index + 1}</td>
                    <td><TruncatedText text={row.ticketNoText} /></td>
                    <td><DateTimeText value={row.createdAtUtc} locale={locale} /></td>
                    <td><TruncatedText text={row.subject} /></td>
                    <td><TruncatedText text={row.descriptionText} /></td>
                    <td>
                      <StatusPill
                        tone={row.centralSyncError ? 'danger' : isCentralSupportStatusResolved(row.centralStatus) ? 'success' : 'info'}
                        className={!row.centralSyncError && !isCentralSupportStatusResolved(row.centralStatus) ? '!bg-sky-100 !text-sky-700 !ring-sky-200' : undefined}
                      >
                        {row.statusLabel}
                      </StatusPill>
                    </td>
                    <td className="actions-cell">
                      <div className="request-actions justify-center">
                        <Button type="button" variant="secondary" size="sm" onClick={() => setDetailItem(row)}>
                          {t('jobs.actions.details', 'Detaylar')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={safePage}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => {
            setPageSize(size)
            setCurrentPage(1)
          }}
        />
      </section>

      <SupportRequestDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        variant="createOnly"
      />
      {detailItem ? (
        <SupportRequestDetailModal
          item={detailItem}
          userDisplayName={userDisplayName}
          ticketDisplayNo={formatLumespecSupportTicketNo(detailItem, ticketDisplayMap)}
          onClose={() => setDetailItem(null)}
        />
      ) : null}
    </div>
  )
}
