import { Pencil, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { ConfirmDialog, type ConfirmDialogState } from '../components/ui/confirm-dialog'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { DateCell } from '../components/ui/date-cell'
import { FilterableTh } from '../components/ui/FilterableTh'
import { TablePagination } from '../components/ui/table-pagination'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import { getLocale } from '../utils/localization'

interface ActivityPlanRow {
  planId: string
  planNumber: number | null
  planNumberYear: number | null
  createdAtUtc: string
  activityTypeName: string
  neighborhood: string | null
  street: string | null
  description: string
  status: string
}

type PlanRowView = ActivityPlanRow & {
  planNoDisplay: string
}

type PlanScope = 'daily' | 'past'

const SCOPE_FILTERS: Array<{ value: PlanScope; labelKey: string; fallback: string; chipClass: string }> = [
  { value: 'daily', labelKey: 'edevletActivityPlans.scope.daily', fallback: 'Günlük Faaliyetler', chipClass: 'scope-chip--approved' },
  { value: 'past', labelKey: 'edevletActivityPlans.scope.past', fallback: 'Geçmiş Faaliyet', chipClass: 'scope-chip--all' },
]

const SEARCH_COLUMN_KEYS = ['planNoDisplay', 'createdAtUtc', 'activityTypeName', 'neighborhood', 'street', 'description'] as const

function formatPlanNumber(planNumber: number | null, planNumberYear: number | null) {
  if (!planNumber || !planNumberYear) return '—'
  return `FN-${planNumberYear}-${planNumber}`
}

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return ''
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isSameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function isPlanInScope(createdAtUtc: string, scope: PlanScope) {
  const created = new Date(createdAtUtc)
  const isToday = isSameLocalDay(created, new Date())
  return scope === 'daily' ? isToday : !isToday
}

export function EDevletActivityPlansListPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const locale = getLocale(i18n.language)
  const scopeParam = searchParams.get('view')
  const scope: PlanScope = scopeParam === 'past' ? 'past' : 'daily'
  const [plans, setPlans] = useState<ActivityPlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [searchText, setSearchText] = useState('')

  const { sortKey: plansSortKey, sortDir: plansSortDir, toggleSort: _togglePlansSort, sortItems: sortPlans } = useSortable()
  const { filters: planFilters, setFilter: setPlanFilter, clearFilters: clearPlanFilters, matchesFilters: planMatchesFilters } = useColumnFilters()

  const loadPlans = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPlans(await api.getEDevletDailyActivityPlans())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadPlans()
  }, [loadPlans])

  const getColumnValue = useCallback((key: string, plan: PlanRowView): string => {
    if (key === 'planNo') return plan.planNoDisplay
    if (key === 'createdAtUtc') return formatDateTime(plan.createdAtUtc, locale)
    return String((plan as unknown as Record<string, unknown>)[key] ?? '')
  }, [locale])

  const scopedPlans = useMemo(
    () => plans
      .filter(plan => isPlanInScope(plan.createdAtUtc, scope))
      .map(plan => ({
        ...plan,
        planNoDisplay: formatPlanNumber(plan.planNumber, plan.planNumberYear),
      })),
    [plans, scope],
  )

  const visiblePlans = useMemo(() => {
    let result = scopedPlans
    if (filterFrom || filterTo) {
      result = result.filter(plan => {
        const date = plan.createdAtUtc.slice(0, 10)
        if (filterFrom && date < filterFrom.slice(0, 10)) return false
        if (filterTo && date > filterTo.slice(0, 10)) return false
        return true
      })
    }
    if (searchText.trim()) {
      const query = searchText.toLocaleLowerCase('tr')
      result = result.filter(plan =>
        SEARCH_COLUMN_KEYS.some(key => {
          const display = key === 'planNoDisplay'
            ? plan.planNoDisplay
            : key === 'createdAtUtc'
              ? formatDateTime(plan.createdAtUtc, locale)
              : String(plan[key] ?? '')
          return display.toLocaleLowerCase('tr').includes(query)
        }),
      )
    }
    return result
  }, [scopedPlans, filterFrom, filterTo, searchText, locale])

  const columnFilteredPlans = useMemo(
    () => visiblePlans.filter(plan => planMatchesFilters(plan, getColumnValue)),
    [visiblePlans, planMatchesFilters, getColumnValue],
  )

  const sortedPlans = useMemo(
    () => sortPlans(columnFilteredPlans),
    [columnFilteredPlans, sortPlans],
  )

  const paginatedPlans = useMemo(
    () => sortedPlans.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sortedPlans, currentPage, pageSize],
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [scope, pageSize, filterFrom, filterTo, searchText, planFilters, sortedPlans.length])

  useEffect(() => {
    queueMicrotask(() => {
      setCurrentPage(1)
      clearPlanFilters()
    })
  }, [scope, clearPlanFilters])

  const togglePlansSort = (key: string) => {
    _togglePlansSort(key)
    setCurrentPage(1)
  }

  const setScope = (nextScope: PlanScope) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      if (nextScope === 'daily') {
        next.delete('view')
      } else {
        next.set('view', nextScope)
      }
      return next
    }, { replace: true })
  }

  const handleCancel = (plan: ActivityPlanRow) => {
    setConfirmDialog({
      title: t('edevletActivityPlans.cancelTitle', 'Faaliyet Planını İptal Et'),
      message: t('edevletActivityPlans.cancelConfirm', 'Bu faaliyet planını iptal etmek istediğinize emin misiniz?'),
      confirmLabel: t('edevletActivityPlans.cancelAction', 'İptal Et'),
      cancelLabel: t('common.back', 'Geri'),
      variant: 'destructive',
      onConfirm: () => {
        void (async () => {
          try {
            await api.cancelEDevletDailyActivityPlan(plan.planId)
            await loadPlans()
          } catch (err) {
            setError(err instanceof Error ? err.message : t('common.error'))
          }
        })()
      },
    })
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{t('edevletActivityPlans.kicker', 'e-Devlet entegrasyonu')}</div>
            <h1 className="page-title">{t('edevletActivityPlans.title', 'e-Devlet Günlük Faaliyet Planları Listesi')}</h1>
            <p className="page-subtitle text-base">
              {t('edevletActivityPlans.subtitle', 'Biriminize ait günlük faaliyet planlarını görüntüleyin ve yönetin.')}
            </p>
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
                  onChange={event => setSearchText(event.target.value)}
                />
                {searchText ? (
                  <button type="button" onClick={() => setSearchText('')} className="scope-chip-search-clear shrink-0 font-extrabold transition-colors" aria-label={t('common.clear', 'Temizle')}>
                    <X className="size-3.5" strokeWidth={3} />
                  </button>
                ) : null}
              </div>
              <DateTimePicker value={filterFrom} onChange={setFilterFrom} placeholder={t('filters.startDate', 'Başlangıç tarihi')} className="scope-chip-date" forceDown />
              <span className="text-xs text-white/60">–</span>
              <DateTimePicker value={filterTo} onChange={setFilterTo} placeholder={t('filters.endDate', 'Bitiş tarihi')} className="scope-chip-date" forceDown />
            </div>
          </div>
        </div>
      </header>

      <nav className="scope-chips" aria-label={t('edevletActivityPlans.title', 'e-Devlet Günlük Faaliyet Planları Listesi')}>
        {SCOPE_FILTERS.map(filter => (
          <button
            key={filter.value}
            type="button"
            className={`scope-chip ${filter.chipClass}${filter.value === scope ? ' active' : ''}`}
            onClick={() => setScope(filter.value)}
          >
            {t(filter.labelKey, filter.fallback)}
          </button>
        ))}
      </nav>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : (
        <section className="section-card desktop-page-fill">
          <div className="table-wrap desktop-panel-scroll">
            <table className={`data-table jobs-table data-table--zebra${paginatedPlans.length === 0 ? ' data-table--empty' : ''}`}>
              <thead>
                <tr>
                  <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                  <FilterableTh filterKey="planNo" filterValue={planFilters['planNo'] ?? ''} onFilter={setPlanFilter} sortKey="planNoDisplay" currentSortKey={plansSortKey} sortDir={plansSortDir} onSort={togglePlansSort}>{t('edevletActivityPlans.columns.planNo', 'Faaliyet No')}</FilterableTh>
                  <FilterableTh filterKey="createdAtUtc" filterValue={planFilters['createdAtUtc'] ?? ''} onFilter={setPlanFilter} sortKey="createdAtUtc" currentSortKey={plansSortKey} sortDir={plansSortDir} onSort={togglePlansSort}>{t('edevletActivityPlans.columns.date', 'Tarih')}</FilterableTh>
                  <FilterableTh filterKey="activityTypeName" filterValue={planFilters['activityTypeName'] ?? ''} onFilter={setPlanFilter} sortKey="activityTypeName" currentSortKey={plansSortKey} sortDir={plansSortDir} onSort={togglePlansSort}>{t('edevletActivityPlans.columns.activityType', 'Faaliyet Tipi')}</FilterableTh>
                  <FilterableTh filterKey="neighborhood" filterValue={planFilters['neighborhood'] ?? ''} onFilter={setPlanFilter} sortKey="neighborhood" currentSortKey={plansSortKey} sortDir={plansSortDir} onSort={togglePlansSort}>{t('edevletActivityPlans.columns.neighborhood', 'Mahalle')}</FilterableTh>
                  <FilterableTh filterKey="street" filterValue={planFilters['street'] ?? ''} onFilter={setPlanFilter} sortKey="street" currentSortKey={plansSortKey} sortDir={plansSortDir} onSort={togglePlansSort}>{t('edevletActivityPlans.columns.street', 'Cadde/Sokak/Bulvar')}</FilterableTh>
                  <FilterableTh filterKey="description" filterValue={planFilters['description'] ?? ''} onFilter={setPlanFilter} sortKey="description" currentSortKey={plansSortKey} sortDir={plansSortDir} onSort={togglePlansSort}>{t('edevletActivityPlans.columns.description', 'Açıklama')}</FilterableTh>
                  <th className="text-center">{t('edevletActivityPlans.columns.actions', 'İşlemler')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPlans.map((plan, index) => {
                  const isCancelled = plan.status === 'Cancelled'
                  return (
                    <tr key={plan.planId}>
                      <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(currentPage - 1) * pageSize + index + 1}</td>
                      <td className="table-number-cell font-mono text-xs text-slate-500">
                        <div className="table-number-cell__value">{plan.planNoDisplay}</div>
                      </td>
                      <td><DateCell value={plan.createdAtUtc} locale={locale} /></td>
                      <td>{plan.activityTypeName}</td>
                      <td>{plan.neighborhood ?? '—'}</td>
                      <td>{plan.street ?? '—'}</td>
                      <td className="max-w-xs truncate" title={plan.description}>{plan.description}</td>
                      <td className="actions-cell">
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="gap-1.5"
                            disabled={isCancelled}
                            onClick={() => navigate(`/edevlet/activity-plan?planId=${plan.planId}`)}
                          >
                            <Pencil className="size-3.5" />
                            {t('common.edit', 'Düzenle')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={isCancelled}
                            onClick={() => handleCancel(plan)}
                          >
                            {t('edevletActivityPlans.cancelAction', 'İptal Et')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {sortedPlans.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        {scope === 'daily'
                          ? t('edevletActivityPlans.emptyDaily', 'Bugün oluşturulmuş faaliyet planı bulunmuyor.')
                          : t('edevletActivityPlans.emptyPast', 'Geçmiş faaliyet planı bulunmuyor.')}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <TablePagination
            totalCount={sortedPlans.length}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageSizeChange={setPageSize}
            onPageChange={setCurrentPage}
          />
        </section>
      )}

      {confirmDialog ? <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} /> : null}
    </div>
  )
}
