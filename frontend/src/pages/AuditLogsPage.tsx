import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { FilterableTh } from '../components/ui/FilterableTh'
import { StatusPill } from '../components/ui/status-pill'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { TablePagination } from '../components/ui/table-pagination'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import type { AuditLog } from '../types/platform'
import { formatAuditNotes, getAuditActionLabel, getLocale } from '../utils/localization'

type AuditLogScope = 'system' | 'job' | 'task'

type AuditLogRow = AuditLog & {
  actionLabel: string
  detailText: string
  dateText: string
}

function readScope(value: string | null): AuditLogScope {
  return value === 'job' || value === 'task' ? value : 'system'
}

function resolveLogScope(entityType: string): AuditLogScope {
  if (entityType === 'Job') return 'job'
  if (entityType === 'WorkTask' || entityType === 'Task') return 'task'
  return 'system'
}

function getActionTone(action: string) {
  if (action.includes('Created') || action.includes('Approved') || action.includes('Completed')) {
    return 'success' as const
  }

  if (action.includes('Rejected') || action.includes('Deleted') || action.includes('Cancelled')) {
    return 'danger' as const
  }

  if (action.includes('Submitted')) {
    return 'warning' as const
  }

  return 'info' as const
}

export function AuditLogsPage() {
  const { t, i18n } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeScope = readScope(searchParams.get('scope'))
  const [pageSize, setPageSize] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)

  const auditLogsQuery = useQuery({
    queryKey: queryKeys.auditLogs.list(),
    queryFn: () => api.getAuditLogs(),
  })
  const error = auditLogsQuery.error
    ? auditLogsQuery.error instanceof Error ? auditLogsQuery.error.message : t('common.error')
    : ''

  const { sortKey, sortDir, toggleSort, sortItems } = useSortable()
  const { filters, setFilter, matchesFilters } = useColumnFilters()

  const locale = getLocale(i18n.language)

  const scopedRows = useMemo(() => {
    const logs = auditLogsQuery.data ?? []
    const rows: AuditLogRow[] = logs
      .filter(log => resolveLogScope(log.entityType) === activeScope)
      .map(log => ({
        ...log,
        actionLabel: getAuditActionLabel(t, log.action),
        detailText: log.details ? formatAuditNotes(t, log.details) : t('common.none'),
        dateText: new Date(log.eventTimeUtc).toLocaleString(locale),
      }))
    const filtered = rows.filter(row => matchesFilters(row, (key, item) => {
      if (key === 'action') return item.actionLabel
      if (key === 'details') return item.detailText
      if (key === 'eventTimeUtc') return item.dateText
      return String((item as unknown as Record<string, unknown>)[key] ?? '')
    }))
    if (!sortKey) {
      return [...filtered].sort((a, b) => b.eventTimeUtc.localeCompare(a.eventTimeUtc))
    }
    return sortItems(filtered)
  }, [activeScope, auditLogsQuery.data, locale, matchesFilters, sortItems, sortKey, t])

  const totalCount = scopedRows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1)
  const safePage = Math.min(currentPage, totalPages)
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return scopedRows.slice(start, start + pageSize)
  }, [safePage, pageSize, scopedRows])

  const scopeLabel = t(`audit.scopes.${activeScope}`)

  const handleFilter = (key: string, value: string) => {
    setFilter(key, value)
    setCurrentPage(1)
  }

  const handleSort = (key: string) => {
    toggleSort(key)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const setScope = (scope: AuditLogScope) => {
    const next = new URLSearchParams(searchParams)
    next.set('scope', scope)
    setSearchParams(next, { replace: true })
    setCurrentPage(1)
  }

  if (auditLogsQuery.isLoading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className="page-stack desktop-page-shell">
      <section className="section-card p-0">
        <div className="sticky-page-header !rounded-b-none border-0 shadow-none">
          <div className="page-header-row">
            <div className="space-y-1">
              <div className="page-kicker">{scopeLabel}</div>
              <h1 className="page-title">{t('audit.title')}</h1>
              <p className="page-subtitle">{t('audit.subtitle')}</p>
            </div>
            <StatusPill tone="info">{totalCount} {t('audit.recordCount')}</StatusPill>
          </div>
        </div>
        <div className="sticky top-0 z-[12] border-t border-slate-100 bg-white">
          <div className="tab-bar settings-tab-bar audit-log-tab-bar" role="tablist" aria-label={t('audit.title')}>
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === 'system'}
              className={`tab-button ${activeScope === 'system' ? 'active' : ''}`}
              onClick={() => setScope('system')}
            >
              {t('audit.scopes.system')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === 'job'}
              className={`tab-button ${activeScope === 'job' ? 'active' : ''}`}
              onClick={() => setScope('job')}
            >
              {t('audit.scopes.job')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === 'task'}
              className={`tab-button ${activeScope === 'task' ? 'active' : ''}`}
              onClick={() => setScope('task')}
            >
              {t('audit.scopes.task')}
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      <section className="section-card desktop-page-fill">
        <div className="table-wrap desktop-panel-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <FilterableTh
                  filterKey="eventTimeUtc"
                  filterValue={filters.eventTimeUtc ?? ''}
                  onFilter={handleFilter}
                  sortKey="eventTimeUtc"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('audit.date')}
                </FilterableTh>
                <FilterableTh
                  filterKey="action"
                  filterValue={filters.action ?? ''}
                  onFilter={handleFilter}
                  sortKey="actionLabel"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('audit.action')}
                </FilterableTh>
                <FilterableTh
                  filterKey="details"
                  filterValue={filters.details ?? ''}
                  onFilter={handleFilter}
                  sortKey="detailText"
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                >
                  {t('audit.detail')}
                </FilterableTh>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map(log => (
                <tr key={log.auditLogId}>
                  <td>{log.dateText}</td>
                  <td>
                    <StatusPill tone={getActionTone(log.action)}>{log.actionLabel}</StatusPill>
                  </td>
                  <td>{log.detailText}</td>
                </tr>
              ))}
              {pagedRows.length === 0 ? (
                <TableEmptyStateRows columnCount={3} message={t('audit.empty')} />
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePagination
          totalCount={totalCount}
          pageSize={pageSize}
          currentPage={safePage}
          onPageSizeChange={handlePageSizeChange}
          onPageChange={setCurrentPage}
        />
      </section>
    </div>
  )
}
