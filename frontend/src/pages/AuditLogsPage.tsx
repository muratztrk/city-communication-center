import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Search, X as XIcon } from 'lucide-react'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { FilterableTh } from '../components/ui/FilterableTh'
import { ScopeChipDateRange } from '../components/ui/scope-chip-date-range'
import { StatusPill } from '../components/ui/status-pill'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { TablePagination } from '../components/ui/table-pagination'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import type { AuditLog } from '../types/platform'
import { formatAuditNotes, getAuditActionLabel, getLocale } from '../utils/localization'
import type { RoutineTaskEditSnapshot } from '../utils/routineTaskEditHistory'
import { richTextToPlainText } from '../utils/richText'
import type { TFunction } from 'i18next'

/** Ayraç "—" yeşil (card #1809). */
function joinWithGreenDash(parts: string[]): ReactNode {
  if (parts.length === 0) return '—'
  return parts.map((part, index) => (
    <Fragment key={`${index}-${part.slice(0, 24)}`}>
      {index > 0 ? <span className="text-emerald-600"> — </span> : null}
      {part}
    </Fragment>
  ))
}

function formatRoutineEditSnapshot(source: string): string | null {
  const trimmed = source.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const snapshot = JSON.parse(trimmed) as RoutineTaskEditSnapshot
    const bits: string[] = []
    if (snapshot.title?.trim()) bits.push(`Başlık: ${snapshot.title.trim()}`)
    if (snapshot.priority?.trim()) bits.push(`Öncelik: ${snapshot.priority.trim()}`)
    if (snapshot.dueDateUtc) {
      bits.push(`Son tarih: ${new Date(snapshot.dueDateUtc).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })}`)
    }
    const address = [snapshot.neighborhood, snapshot.street, snapshot.openAddress]
      .map(part => part?.trim())
      .filter(Boolean)
      .join(', ')
    if (address) bits.push(`Adres: ${address}`)
    const description = richTextToPlainText(snapshot.description ?? '').trim()
    if (description) {
      bits.push(`Açıklama: ${description.length > 120 ? `${description.slice(0, 117)}…` : description}`)
    }
    const attachmentNames = (snapshot.attachments ?? []).map(item => item.fileName).filter(Boolean)
    if (attachmentNames.length > 0) bits.push(`Ekler: ${attachmentNames.join(', ')}`)
    return bits.length > 0 ? bits.join('; ') : null
  } catch {
    return null
  }
}

/**
 * Detay sütunu, Bildirimler'deki gövdeyle AYNI kalıbı kurar (card #1713 reopen).
 * RoutineTaskEditSnapshot ham JSON göstermez (card #1806).
 */
function buildDetailParts(t: TFunction, log: AuditLog): string[] {
  if (log.entityType !== 'Job' && log.entityType !== 'WorkTask' && log.entityType !== 'Task') {
    const note = log.details ? formatAuditNotes(t, log.details) : null
    return note ? [note] : []
  }

  const source = log.notes?.trim() ? log.notes : (log.details ?? '')
  const parts: string[] = []
  const isDueDate = log.action === 'TaskDueDateUpdated' || log.action === 'JobDueDateUpdated'
  const isTransition = log.action === 'TaskStatusChanged' && (log.details ?? '').includes('->')
  const isRoutineEdit = log.action === 'RoutineTaskEditSnapshot'

  if (isRoutineEdit) {
    if (log.actorDisplayName) parts.push(log.actorDisplayName)
    if (log.entityNumber) parts.push(log.entityNumber)
    if (log.entityTitle) parts.push(log.entityTitle)
    const parsed = formatRoutineEditSnapshot(source)
    if (parsed) parts.push(parsed)
    return parts
  }

  if (isTransition || isDueDate) {
    if (log.entityNumber) parts.push(log.entityNumber)
    if (log.entityTitle) parts.push(log.entityTitle)
    const note = formatAuditNotes(t, isTransition ? (log.details ?? '') : source)
    if (note) parts.push(note)
  } else {
    if (log.actorDisplayName) parts.push(log.actorDisplayName)
    if (log.entityNumber) {
      parts.push(log.entityType === 'Job'
        ? `${t('audit.jobNumberPrefix', 'Talep No')}: ${log.entityNumber}`
        : log.entityNumber)
    }
    if (log.entityTitle) parts.push(log.entityTitle)
    const note = formatAuditNotes(t, source)
    if (note && !note.trim().startsWith('{')) parts.push(note)
  }

  return parts
}

function buildDetailText(t: TFunction, log: AuditLog): string {
  const parts = buildDetailParts(t, log)
  return parts.length > 0 ? parts.join(' — ') : '—'
}

type AuditLogScope = 'system' | 'job' | 'task'

type AuditLogRow = AuditLog & {
  actionLabel: string
  detailText: string
  detailParts: string[]
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
  const [searchText, setSearchText] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

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
        detailParts: buildDetailParts(t, log),
        detailText: buildDetailText(t, log),
        dateText: new Date(log.eventTimeUtc).toLocaleString(locale),
      }))
    const searchNormalized = searchText.trim().toLocaleLowerCase('tr')
    const filtered = rows.filter(row => {
      if (filterFrom) {
        const fromMs = new Date(`${filterFrom}T00:00:00`).getTime()
        if (new Date(row.eventTimeUtc).getTime() < fromMs) return false
      }
      if (filterTo) {
        const toMs = new Date(`${filterTo}T23:59:59.999`).getTime()
        if (new Date(row.eventTimeUtc).getTime() > toMs) return false
      }
      if (searchNormalized) {
        const haystack = [
          row.detailText,
          row.actionLabel,
          row.auditLogId,
          row.actorDisplayName ?? '',
          row.entityNumber ?? '',
          row.entityTitle ?? '',
        ].join(' ').toLocaleLowerCase('tr')
        if (!haystack.includes(searchNormalized)) return false
      }
      return matchesFilters(row, (key, item) => {
        if (key === 'action') return item.actionLabel
        if (key === 'details') return item.detailText
        if (key === 'eventTimeUtc') return item.dateText
        if (key === 'auditLogId') return item.auditLogId
        return String((item as unknown as Record<string, unknown>)[key] ?? '')
      })
    })
    if (!sortKey) {
      return [...filtered].sort((a, b) => b.eventTimeUtc.localeCompare(a.eventTimeUtc))
    }
    return sortItems(filtered)
  }, [activeScope, auditLogsQuery.data, filterFrom, filterTo, locale, matchesFilters, searchText, sortItems, sortKey, t])

  const totalCount = scopedRows.length
  const safePage = Math.min(currentPage, Math.max(1, Math.ceil(totalCount / pageSize) || 1))
  const pagedRows = scopedRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  const scopeLabel = activeScope === 'job'
    ? t('audit.scopes.job')
    : activeScope === 'task'
      ? t('audit.scopes.task')
      : t('audit.scopes.system')

  const setScope = (scope: AuditLogScope) => {
    setSearchParams(scope === 'system' ? {} : { scope }, { replace: true })
    setCurrentPage(1)
  }

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
            <div className="ml-auto mt-auto flex shrink-0 flex-wrap items-end gap-3">
              <div className="scope-chips-filters">
                <div className="scope-chip-search-wrap">
                  <Search className="scope-chip-search-icon size-3 shrink-0 text-slate-400" aria-hidden="true" />
                  <input
                    type="text"
                    className="scope-chip-search-input"
                    placeholder={t('common.search', 'Ara...')}
                    value={searchText}
                    onChange={e => { setSearchText(e.target.value); setCurrentPage(1) }}
                  />
                  {searchText ? (
                    <button
                      type="button"
                      onClick={() => { setSearchText(''); setCurrentPage(1) }}
                      className="scope-chip-search-clear shrink-0 font-extrabold transition-colors"
                      aria-label={t('common.clear', 'Temizle')}
                    >
                      <XIcon className="size-3.5" strokeWidth={3} />
                    </button>
                  ) : null}
                </div>
                <ScopeChipDateRange
                  from={filterFrom}
                  to={filterTo}
                  onFromChange={value => { setFilterFrom(value); setCurrentPage(1) }}
                  onToChange={value => { setFilterTo(value); setCurrentPage(1) }}
                  forceDown
                />
              </div>
            </div>
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
                  <td>
                    <div className="space-y-0.5">
                      <div className="text-[0.7rem] font-semibold text-slate-500">
                        {t('audit.logId', 'Log ID')}: <span className="font-mono text-slate-700" title={log.auditLogId}>{log.auditLogId.slice(0, 8)}</span>
                      </div>
                      <div>{joinWithGreenDash(log.detailParts)}</div>
                    </div>
                  </td>
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
