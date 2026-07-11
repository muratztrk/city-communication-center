import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { invalidateJobs } from '../api/cacheInvalidation'
import { Button } from '../components/ui/button'
import { ScopeChipDateRange } from '../components/ui/scope-chip-date-range'
import { DateCell } from '../components/ui/date-cell'
import { FilterableTh } from '../components/ui/FilterableTh'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { TablePagination } from '../components/ui/table-pagination'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import type { Department, EDevletBasvuruSummary, JobSummary } from '../types/platform'
import { getLocale } from '../utils/localization'

type ConvertForm = {
  title: string
  description: string
  ownerDepartmentId: string
  targetDepartmentId: string
  priority: string
}

type BasvuruScope = 'pending' | 'processed'

type BasvuruRowView = EDevletBasvuruSummary & {
  citizenName: string
}

const EMPTY_FORM: ConvertForm = {
  title: '',
  description: '',
  ownerDepartmentId: '',
  targetDepartmentId: '',
  priority: 'Normal',
}

const SCOPE_FILTERS: Array<{ value: BasvuruScope; labelKey: string; fallback: string; chipClass: string }> = [
  { value: 'pending', labelKey: 'edevletBasvurular.scope.pending', fallback: 'Onay Bekleyen', chipClass: 'scope-chip--approved' },
  { value: 'processed', labelKey: 'edevletBasvurular.scope.processed', fallback: 'İşlenen Başvurular', chipClass: 'scope-chip--all' },
]

const SEARCH_COLUMN_KEYS = ['takipNo', 'createdAtUtc', 'citizenName', 'basvuruTipi', 'mahalleAdi', 'sokakCaddeAdi', 'description'] as const

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

function isPendingScope(scope: BasvuruScope, row: EDevletBasvuruSummary) {
  return scope === 'pending'
    ? row.status === 'PendingReview'
    : row.status !== 'PendingReview'
}

export function EDevletBasvurularPage() {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const scopeParam = searchParams.get('view')
  const scope: BasvuruScope = scopeParam === 'processed' ? 'processed' : 'pending'

  const [rows, setRows] = useState<EDevletBasvuruSummary[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState<EDevletBasvuruSummary | null>(null)
  const [form, setForm] = useState<ConvertForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const { sortKey, sortDir, toggleSort: _toggleSort, sortItems } = useSortable()
  const { filters, setFilter, clearFilters, matchesFilters } = useColumnFilters()

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [basvurular, deptList] = await Promise.all([
        api.getEDevletBasvurular(),
        api.getDepartments(),
      ])
      setRows(basvurular)
      setDepartments(deptList)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic', 'Bir hata oluştu.'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const getColumnValue = useCallback((key: string, row: BasvuruRowView): string => {
    if (key === 'citizenName') return row.citizenName
    if (key === 'createdAtUtc') return formatDateTime(row.createdAtUtc, locale)
    return String((row as unknown as Record<string, unknown>)[key] ?? '')
  }, [locale])

  const scopedRows = useMemo(
    () => rows
      .filter(row => isPendingScope(scope, row))
      .map(row => ({
        ...row,
        citizenName: `${row.citizenFirstName} ${row.citizenLastName}`.trim(),
      })),
    [rows, scope],
  )

  const visibleRows = useMemo(() => {
    let result = scopedRows
    if (filterFrom || filterTo) {
      result = result.filter(row => {
        const date = row.createdAtUtc.slice(0, 10)
        if (filterFrom && date < filterFrom.slice(0, 10)) return false
        if (filterTo && date > filterTo.slice(0, 10)) return false
        return true
      })
    }
    if (searchText.trim()) {
      const query = searchText.toLocaleLowerCase('tr')
      result = result.filter(row =>
        SEARCH_COLUMN_KEYS.some(key => {
          const display = key === 'createdAtUtc'
            ? formatDateTime(row.createdAtUtc, locale)
            : key === 'citizenName'
              ? row.citizenName
              : String(row[key] ?? '')
          return display.toLocaleLowerCase('tr').includes(query)
        }),
      )
    }
    return result
  }, [scopedRows, filterFrom, filterTo, searchText, locale])

  const columnFilteredRows = useMemo(
    () => visibleRows.filter(row => matchesFilters(row, getColumnValue)),
    [visibleRows, matchesFilters, getColumnValue],
  )

  const sortedRows = useMemo(
    () => sortItems(columnFilteredRows),
    [columnFilteredRows, sortItems],
  )

  const paginatedRows = useMemo(
    () => sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sortedRows, currentPage, pageSize],
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [scope, pageSize, filterFrom, filterTo, searchText, filters, sortedRows.length])

  useEffect(() => {
    queueMicrotask(() => {
      setCurrentPage(1)
      clearFilters()
    })
  }, [scope, clearFilters])

  const toggleRowSort = (key: string) => {
    _toggleSort(key)
    setCurrentPage(1)
  }

  const setScope = (nextScope: BasvuruScope) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      if (nextScope === 'pending') {
        next.delete('view')
      } else {
        next.set('view', nextScope)
      }
      return next
    }, { replace: true })
  }

  function openConvert(row: EDevletBasvuruSummary) {
    setSelected(row)
    setForm({
      title: `${row.basvuruTipi} - ${row.takipNo}`,
      description: row.description,
      ownerDepartmentId: departments[0]?.departmentId ?? '',
      targetDepartmentId: '',
      priority: 'Normal',
    })
  }

  async function submitConvert() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const job: JobSummary = await api.convertEDevletBasvuruToJob(selected.basvuruId, {
        title: form.title.trim(),
        description: form.description.trim(),
        ownerDepartmentId: form.ownerDepartmentId,
        priority: form.priority,
        targetDepartmentIds: form.targetDepartmentId ? [form.targetDepartmentId] : [],
      })
      setRows(current => current.filter(row => row.basvuruId !== selected.basvuruId))
      setSelected(null)
      setForm(EMPTY_FORM)
      invalidateJobs(queryClient)
      void job
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic', 'Bir hata oluştu.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{t('edevletBasvurular.kicker', 'e-Devlet entegrasyonu')}</div>
            <h1 className="page-title">{t('nav.edevletBasvurular', 'e-Devlet Talep/Öneri Başvuruları')}</h1>
            <p className="page-subtitle text-base">
              {t('edevletBasvurular.subtitle', 'e-Devlet kapısından gelen başvurular operatör onayından sonra iş akışına alınır.')}
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
              <ScopeChipDateRange
                from={filterFrom}
                to={filterTo}
                onFromChange={setFilterFrom}
                onToChange={setFilterTo}
                fromPlaceholder={t('filters.startDate', 'Başlangıç tarihi')}
                toPlaceholder={t('filters.endDate', 'Bitiş tarihi')}
                forceDown
              />
            </div>
          </div>
        </div>
      </header>

      <nav className="scope-chips" aria-label={t('nav.edevletBasvurular', 'e-Devlet Talep/Öneri Başvuruları')}>
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
            <table className="data-table jobs-table data-table--zebra">
              <thead>
                <tr>
                  <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                  <FilterableTh filterKey="takipNo" filterValue={filters.takipNo ?? ''} onFilter={setFilter} sortKey="takipNo" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleRowSort}>{t('edevletBasvurular.trackingNo', 'Takip No')}</FilterableTh>
                  <FilterableTh filterKey="createdAtUtc" filterValue={filters.createdAtUtc ?? ''} onFilter={setFilter} sortKey="createdAtUtc" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleRowSort}>{t('common.date', 'Tarih')}</FilterableTh>
                  <FilterableTh filterKey="citizenName" filterValue={filters.citizenName ?? ''} onFilter={setFilter} sortKey="citizenName" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleRowSort}>{t('edevletBasvurular.citizen', 'Başvuran')}</FilterableTh>
                  <FilterableTh filterKey="basvuruTipi" filterValue={filters.basvuruTipi ?? ''} onFilter={setFilter} sortKey="basvuruTipi" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleRowSort}>{t('edevletBasvurular.type', 'Tip')}</FilterableTh>
                  <FilterableTh filterKey="mahalleAdi" filterValue={filters.mahalleAdi ?? ''} onFilter={setFilter} sortKey="mahalleAdi" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleRowSort}>{t('edevletActivityPlans.columns.neighborhood', 'Mahalle')}</FilterableTh>
                  <FilterableTh filterKey="sokakCaddeAdi" filterValue={filters.sokakCaddeAdi ?? ''} onFilter={setFilter} sortKey="sokakCaddeAdi" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleRowSort}>{t('edevletActivityPlans.columns.street', 'Cadde/Sokak/Bulvar')}</FilterableTh>
                  <FilterableTh filterKey="description" filterValue={filters.description ?? ''} onFilter={setFilter} sortKey="description" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleRowSort}>{t('edevletBasvurular.summary', 'Açıklama')}</FilterableTh>
                  <th className="text-center">{t('edevletActivityPlans.columns.actions', 'İşlemler')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, index) => (
                  <tr key={row.basvuruId}>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(currentPage - 1) * pageSize + index + 1}</td>
                    <td className="table-number-cell font-mono text-xs text-slate-500">
                      <div className="table-number-cell__value">{row.takipNo}</div>
                    </td>
                    <td><DateCell value={row.createdAtUtc} locale={locale} /></td>
                    <td>{row.citizenName}</td>
                    <td>{row.basvuruTipi}</td>
                    <td>{row.mahalleAdi ?? '—'}</td>
                    <td>{row.sokakCaddeAdi ?? '—'}</td>
                    <td className="max-w-xs truncate" title={row.description}>{row.description}</td>
                    <td className="actions-cell">
                      <div className="flex flex-wrap justify-center gap-2">
                        {row.status === 'PendingReview' ? (
                          <Button type="button" size="sm" onClick={() => openConvert(row)}>
                            {t('edevletBasvurular.convert', 'Talebe Dönüştür')}
                          </Button>
                        ) : row.jobDisplayNumber ? (
                          <span className="text-xs font-medium text-slate-600">{row.jobDisplayNumber}</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedRows.length === 0 ? (
                  <TableEmptyStateRows
                    columnCount={9}
                    message={
                      scope === 'pending'
                        ? t('edevletBasvurular.empty', 'Onay bekleyen e-Devlet başvurusu yok.')
                        : t('edevletBasvurular.emptyProcessed', 'İşlenmiş e-Devlet başvurusu bulunmuyor.')
                    }
                  />
                ) : null}
              </tbody>
            </table>
          </div>
          <TablePagination
            totalCount={sortedRows.length}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageSizeChange={setPageSize}
            onPageChange={setCurrentPage}
          />
        </section>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[color:var(--color-background)] p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{t('edevletBasvurular.convertTitle', 'e-Devlet Başvurusunu Talebe Dönüştür')}</h2>
            <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">{selected.takipNo}</p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span>{t('jobs.fields.title', 'Başlık')}</span>
                <input className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="grid gap-1 text-sm">
                <span>{t('jobs.fields.description', 'Açıklama')} <span className="text-xs font-normal text-slate-400">(max 400 karakter)</span> <span className="text-red-500">*</span></span>
                <textarea className="min-h-28 max-h-28 resize-none overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={400} />
              </label>
              <label className="grid gap-1 text-sm">
                <span>{t('jobs.fields.ownerDepartment', 'Sahip Müdürlük')}</span>
                <select className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2" value={form.ownerDepartmentId} onChange={e => setForm({ ...form, ownerDepartmentId: e.target.value })}>
                  {departments.map(dept => (
                    <option key={dept.departmentId} value={dept.departmentId}>{dept.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span>{t('jobs.fields.targetDepartment', 'Hedef Birim')}</span>
                <select className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2" value={form.targetDepartmentId} onChange={e => setForm({ ...form, targetDepartmentId: e.target.value })}>
                  <option value="">{t('common.optional', 'Opsiyonel')}</option>
                  {departments.filter(dept => dept.departmentId !== form.ownerDepartmentId).map(dept => (
                    <option key={dept.departmentId} value={dept.departmentId}>{dept.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelected(null)} disabled={submitting}>{t('common.cancel', 'İptal')}</Button>
              <Button onClick={() => void submitConvert()} disabled={submitting || !form.title.trim() || !form.description.trim() || !form.ownerDepartmentId}>
                {submitting ? t('common.saving', 'Kaydediliyor...') : t('edevletBasvurular.convertConfirm', 'Talep Oluştur')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
