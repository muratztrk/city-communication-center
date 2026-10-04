import { FileText, X as XIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { getLocale } from '../utils/localization'
import { DetailModalHeaderBrand } from './branding/DetailModalHeaderBrand'
import { EDevletActivityPlanDetailModal } from './EDevletActivityPlanDetailModal'
import { ClearPieFilterLink } from './ui/ClearPieFilterLink'
import { DateCell } from './ui/date-cell'
import { Button } from './ui/button'
import { FilterableTh } from './ui/FilterableTh'
import { TablePagination } from './ui/table-pagination'
import { TableEmptyStateRows } from './ui/table-empty-state-rows'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'

type PlansResponse = Awaited<ReturnType<typeof api.getDashboardEDevletPlans>>

type PlanRowView = PlansResponse['rows'][number] & {
  planNoDisplay: string
  addressDisplay: string
  statusLabel: string
}

interface Props {
  departmentId: string
  departmentName: string
  from?: string
  to?: string
  onClose: () => void
}

function formatPlanNumber(planNumber: number | null | undefined, planNumberYear: number | null | undefined) {
  if (!planNumber || !planNumberYear) return '—'
  return `FN-${planNumberYear}-${planNumber}`
}

// Üst Düzey Yönetici Anasayfa-Birimler: birime tıklanınca o birimin e-Devlet Günlük Faaliyet Planları (#6ac0ccf8).
export function DashboardEDevletPlansModal({ departmentId, departmentName, from, to, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const [data, setData] = useState<PlansResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detailPlan, setDetailPlan] = useState<PlanRowView | null>(null)
  const { sortKey, sortDir, toggleSort, sortItems } = useSortable()
  const { filters, setFilter, matchesFilters, clearFilters, hasActiveFilters } = useColumnFilters()

  useEffect(() => {
    let active = true
    api.getDashboardEDevletPlans(departmentId, from, to)
      .then(result => { if (active) setData(result) })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : t('common.error')) })
    return () => { active = false }
  }, [departmentId, from, to, t])

  const getColumnValue = useCallback((key: string, row: PlanRowView): string => {
    if (key === 'planNo') return row.planNoDisplay
    if (key === 'address') return row.addressDisplay
    if (key === 'createdAtUtc') {
      return new Date(row.createdAtUtc).toLocaleString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    return String((row as unknown as Record<string, unknown>)[key] ?? '')
  }, [locale])

  const rows = useMemo(() => {
    const source: PlanRowView[] = (data?.rows ?? []).map(row => ({
      ...row,
      planNoDisplay: formatPlanNumber(row.planNumber, row.planNumberYear),
      addressDisplay: [row.neighborhood, row.street].filter(Boolean).join(' / '),
      statusLabel: row.status === 'Cancelled'
        ? t('edevletActivityPlans.detail.cancelled', 'Pasif')
        : t('edevletActivityPlans.detail.active', 'Aktif'),
    }))
    const filtered = source.filter(row => matchesFilters(row, getColumnValue))
    if (!sortKey) return filtered
    return sortItems(filtered)
  }, [data?.rows, getColumnValue, matchesFilters, sortItems, sortKey, t])

  const maxPage = Math.max(1, Math.ceil(rows.length / pageSize) || 1)
  const safePage = Math.min(page, maxPage)
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const displayDepartment = data?.departmentName || departmentName
  const columnCount = 7

  const handleFilter = (key: string, value: string) => {
    setFilter(key, value)
    setPage(1)
  }

  const handleSort = (key: string) => {
    toggleSort(key)
    setPage(1)
  }

  return createPortal(
    <>
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={onClose}>
      <section
        className="detail-modal-shell detail-modal-shell--chart-drilldown flex max-h-[min(85dvh,52rem)] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="detail-modal-header-layout detail-modal-header-mobile detail-modal-header-mobile--actions-grid shrink-0 border-b border-slate-100 px-4 py-2">
          <div className="detail-modal-header-title min-w-0">
            <h2 className="min-w-0 text-sm font-bold text-emerald-700">
              <span className="block truncate">{t('dashboard.charts.edevletActivityPlans', 'e-Devlet Günlük Faaliyet Planları')}</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{displayDepartment}</span>
            </h2>
          </div>
          <DetailModalHeaderBrand />
          <div className="detail-modal-header-actions detail-modal-header-actions--mobile-grid flex shrink-0 flex-nowrap items-center gap-2">
            <ClearPieFilterLink
              hasColumnFilters={hasActiveFilters}
              onClearColumnFilters={() => {
                clearFilters()
                setPage(1)
              }}
            />
            <button
              type="button"
              onClick={onClose}
              className="detail-modal-header-close flex size-9 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
              aria-label={t('common.close', 'Kapat')}
            >
              <XIcon className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-start overflow-y-auto p-4">
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {!data && !error ? <div className="loading">{t('common.loading')}</div> : null}
          {data ? (
            <div className="dashboard-drilldown-grid-shell">
              <section className="section-card desktop-page-fill min-h-0">
              <div className="dashboard-drilldown-table-wrap table-wrap desktop-panel-scroll">
                <div className="dashboard-drilldown-table-hscroll">
                  <table className="data-table jobs-table data-table--zebra dashboard-drilldown-table edevlet-plans-table">
                    <thead>
                      <tr>
                        <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                        <FilterableTh filterKey="planNo" filterValue={filters.planNo ?? ''} onFilter={handleFilter} sortKey="planNoDisplay" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
                          {t('edevletActivityPlans.columns.planNo', 'Faaliyet No')}
                        </FilterableTh>
                        <FilterableTh filterKey="activityTypeName" filterValue={filters.activityTypeName ?? ''} onFilter={handleFilter} sortKey="activityTypeName" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
                          {t('edevletActivityPlans.columns.activityType', 'Faaliyet Tipi')}
                        </FilterableTh>
                        <FilterableTh filterKey="description" filterValue={filters.description ?? ''} onFilter={handleFilter} sortKey="description" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
                          {t('edevletActivityPlans.columns.description', 'Açıklama')}
                        </FilterableTh>
                        <FilterableTh filterKey="createdAtUtc" filterValue={filters.createdAtUtc ?? ''} onFilter={handleFilter} sortKey="createdAtUtc" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} allowLetters>
                          {t('edevletActivityPlans.columns.date', 'Tarih')}
                        </FilterableTh>
                        <FilterableTh filterKey="address" filterValue={filters.address ?? ''} onFilter={handleFilter} sortKey="addressDisplay" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
                          {t('edevletActivityPlans.columns.address', 'Adres Bilgisi')}
                        </FilterableTh>
                        <th className="text-center">{t('edevletActivityPlans.columns.actions', 'İşlemler')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row, index) => (
                        <tr key={row.planId}>
                          <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(safePage - 1) * pageSize + index + 1}</td>
                          <td className="table-number-cell font-mono text-xs text-slate-500">
                            <div className="table-number-cell__value">{row.planNoDisplay}</div>
                          </td>
                          <td>{row.activityTypeName}</td>
                          <td className="max-w-xs truncate" title={row.description}>{row.description}</td>
                          <td><DateCell value={row.createdAtUtc} locale={locale} /></td>
                          <td>
                            {row.neighborhood || row.street ? (
                              <>
                                {row.neighborhood ? <div>{row.neighborhood}</div> : null}
                                {row.street ? <div className="text-xs text-slate-500">{row.street}</div> : null}
                              </>
                            ) : '—'}
                          </td>
                          <td className="actions-cell">
                            <div className="flex flex-wrap justify-center gap-2">
                              <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => setDetailPlan(row)}>
                                <FileText className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                                {t('jobs.actions.details', 'Detaylar')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 ? (
                        <TableEmptyStateRows columnCount={columnCount} message={t('edevletActivityPlans.emptyAll', 'Faaliyet planı bulunmuyor.')} />
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
              </section>
              {rows.length > 0 ? (
                <TablePagination
                  totalCount={rows.length}
                  pageSize={pageSize}
                  currentPage={safePage}
                  onPageSizeChange={size => { setPageSize(size); setPage(1) }}
                  onPageChange={setPage}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
    {detailPlan ? (
      <EDevletActivityPlanDetailModal
        planId={detailPlan.planId}
        planNoDisplay={detailPlan.planNoDisplay}
        locale={locale}
        onClose={() => setDetailPlan(null)}
      />
    ) : null}
    </>,
    document.body,
  )
}
