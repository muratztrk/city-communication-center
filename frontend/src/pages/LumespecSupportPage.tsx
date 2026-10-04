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
import {
  formatCentralSupportStatus,
  isCentralSupportStatusResolved,
  isCentralSupportStatusWaiting,
} from '../utils/centralSupportStatus'
import type { MySupportRequest } from '../types/platform'

type SupportScope = 'waiting' | 'resolved' | 'all'

const SCOPE_FILTERS: Array<{ value: SupportScope; labelKey: string; fallback: string; chipClass: string }> = [
  { value: 'waiting', labelKey: 'support.scopes.waiting', fallback: 'Çözüm Bekleyen', chipClass: 'scope-chip--in-progress' },
  { value: 'resolved', labelKey: 'support.scopes.resolved', fallback: 'Çözümlendi', chipClass: 'scope-chip--completed' },
  { value: 'all', labelKey: 'support.scopes.all', fallback: 'Tümü', chipClass: 'scope-chip--all' },
]

const COLUMN_COUNT = 8

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

  const rows = useMemo(() => {
    const source = (requestsQuery.data ?? []).map(item => {
      const statusLabel = formatCentralSupportStatus(item.centralStatus, t)
        ?? (item.centralSyncError
          ? t('support.statusSyncFailed', 'Merkeze iletilemedi')
          : t('support.statusPending', 'İşleniyor'))
      return {
        ...item,
        ticketNoText: item.centralTicketNo ?? t('support.localTicket', 'Yerel kayıt'),
        requestDateText: new Date(item.createdAtUtc).toLocaleString(locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        userNameText: userDisplayName,
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
      if (key === 'userName') return row.userNameText
      if (key === 'subject') return row.subject
      if (key === 'message') return row.message
      if (key === 'status') return row.statusLabel
      return ''
    }))

    if (!sortKey) {
      return [...filtered].sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc))
    }
    return sortItems(filtered)
  }, [locale, matchesFilters, requestsQuery.data, scope, sortItems, sortKey, t, userDisplayName])

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
    <div className="page-stack desktop-page-shell">
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
          className="ml-auto shrink-0"
          onClick={() => setCreateOpen(true)}
        >
          {t('support.createRequest', 'Destek Talebi Oluştur')}
        </Button>
      </nav>

      {requestsQuery.isError ? <div className="error">{t('common.error')}</div> : null}

      <section className="section-card desktop-page-fill">
        <div className="table-wrap desktop-panel-scroll">
          <table className="data-table data-table--zebra">
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
                  filterKey="userName"
                  filterValue={filters.userName ?? ''}
                  onFilter={handleFilter}
                  sortKey="userNameText"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('support.columns.userName', 'Kullanıcı Adı')}
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
                  filterKey="message"
                  filterValue={filters.message ?? ''}
                  onFilter={handleFilter}
                  sortKey="message"
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
                <th className="w-28 text-center">{t('common.actions', 'İşlemler')}</th>
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
                    <td className="text-center text-slate-500">{(safePage - 1) * pageSize + index + 1}</td>
                    <td><TruncatedText text={row.ticketNoText} /></td>
                    <td>{row.requestDateText}</td>
                    <td><TruncatedText text={row.userNameText} /></td>
                    <td><TruncatedText text={row.subject} /></td>
                    <td><TruncatedText text={row.message} /></td>
                    <td><TruncatedText text={row.statusLabel} /></td>
                    <td className="text-center">
                      <Button type="button" variant="secondary" size="sm" onClick={() => setDetailItem(row)}>
                        {t('jobs.actions.details', 'Detaylar')}
                      </Button>
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
          onClose={() => setDetailItem(null)}
        />
      ) : null}
    </div>
  )
}
