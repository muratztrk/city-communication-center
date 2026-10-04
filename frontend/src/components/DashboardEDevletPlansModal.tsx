import { X as XIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { getLocale } from '../utils/localization'
import { DetailModalHeaderBrand } from './branding/DetailModalHeaderBrand'
import { DateCell } from './ui/date-cell'
import { TablePagination } from './ui/table-pagination'
import { TableEmptyStateRows } from './ui/table-empty-state-rows'

type PlansResponse = Awaited<ReturnType<typeof api.getDashboardEDevletPlans>>

interface Props {
  departmentId: string
  departmentName: string
  from?: string
  to?: string
  onClose: () => void
}

// Üst Düzey Yönetici Anasayfa-Birimler: birime tıklanınca o birimin e-Devlet Günlük Faaliyet Planları (#6ac0ccf8).
export function DashboardEDevletPlansModal({ departmentId, departmentName, from, to, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const [data, setData] = useState<PlansResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    let active = true
    api.getDashboardEDevletPlans(departmentId, from, to)
      .then(result => { if (active) setData(result) })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : t('common.error')) })
    return () => { active = false }
  }, [departmentId, from, to, t])

  const rows = useMemo(() => data?.rows ?? [], [data])
  const maxPage = Math.max(1, Math.ceil(rows.length / pageSize) || 1)
  const safePage = Math.min(page, maxPage)
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const displayDepartment = data?.departmentName || departmentName

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={onClose}>
      <section
        className="detail-modal-shell detail-modal-shell--chart-drilldown flex max-h-[min(85dvh,52rem)] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="detail-modal-header-layout detail-modal-header-mobile shrink-0 border-b border-slate-100 px-4 py-2">
          <div className="detail-modal-header-title min-w-0">
            <h2 className="min-w-0 text-sm font-bold text-emerald-700">
              <span className="block truncate">{t('dashboard.charts.edevletActivityPlans', 'e-Devlet Günlük Faaliyet Planları')}</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{displayDepartment}</span>
            </h2>
          </div>
          <DetailModalHeaderBrand />
          <div className="detail-modal-header-actions flex shrink-0 items-center gap-2">
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

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {!data && !error ? <div className="loading">{t('common.loading')}</div> : null}
          {data ? (
            <div className="dashboard-drilldown-grid-shell">
              <div className="dashboard-drilldown-table-wrap">
                <div className="dashboard-drilldown-table-hscroll">
                  <table className="data-table data-table--zebra dashboard-drilldown-table">
                    <thead>
                      <tr>
                        <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                        <th>{t('edevletActivityPlans.columns.planNo', 'Faaliyet No')}</th>
                        <th>{t('edevletActivityPlans.columns.activityType', 'Faaliyet Tipi')}</th>
                        <th>{t('edevletActivityPlans.columns.description', 'Açıklama')}</th>
                        <th>{t('edevletActivityPlans.columns.date', 'Tarih')}</th>
                        <th>{t('edevletActivityPlans.columns.address', 'Adres Bilgisi')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row, index) => (
                        <tr key={row.planId}>
                          <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(safePage - 1) * pageSize + index + 1}</td>
                          <td className="font-mono text-xs text-slate-500">
                            {row.planNumber && row.planNumberYear ? `FN-${row.planNumberYear}-${row.planNumber}` : '—'}
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
                        </tr>
                      ))}
                      {rows.length === 0 ? (
                        <TableEmptyStateRows columnCount={6} message={t('edevletActivityPlans.emptyAll', 'Faaliyet planı bulunmuyor.')} />
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
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
    </div>,
    document.body,
  )
}
