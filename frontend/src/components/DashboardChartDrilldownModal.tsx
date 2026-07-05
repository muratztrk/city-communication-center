import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { api } from '../api/client'
import type { DashboardChartDrilldownRow } from '../types/platform'
import { DateCell } from './ui/date-cell'
import { TablePagination } from './ui/table-pagination'
import { resolveSliceLabel } from '../utils/chartSliceLabel'
import { getAuditStatusLabel, getLocale } from '../utils/localization'

interface DashboardChartDrilldownModalProps {
  chartKey: string
  sliceKey: string
  from?: string
  to?: string
  onClose: () => void
}

function formatDrilldownNumber(row: DashboardChartDrilldownRow): string {
  if (row.citizenRequestNumber != null && row.citizenRequestNumberYear != null) {
    return `VT-${row.citizenRequestNumberYear}-${row.citizenRequestNumber}`
  }
  if (row.jobNumber != null && row.jobNumberYear != null) {
    return `T-${row.jobNumberYear}-${row.jobNumber}`
  }
  return '—'
}

function isCancelledLike(status: string): boolean {
  return status === 'Cancelled' || status === 'Rejected' || status === 'RevisionRequested'
}

function resolveTerminalDateHeader(rows: DashboardChartDrilldownRow[], t: TFunction): string | null {
  if (rows.some(row => row.status === 'Completed')) {
    return t('jobs.columns.completedAt', 'Tamamlanma Tarihi')
  }
  if (rows.some(row => isCancelledLike(row.status))) {
    return t('jobs.columns.cancelledAt', 'İptal Tarihi')
  }
  return null
}

function getStatusTextClass(status: string): string {
  if (status === 'Completed') return 'font-semibold text-emerald-600'
  if (isCancelledLike(status)) return 'font-semibold text-red-600'
  if (status === 'Active' || status === 'InProgress') return 'font-semibold text-orange-500'
  return ''
}

/**
 * Üst Düzey Yönetici panosunda pie chart dilimine tıklanınca açılan detay popup'ı (card #1343).
 * İçerik shell zoom stacking-context'inden kaçmak için body'ye portallanır.
 */
export function DashboardChartDrilldownModal({ chartKey, sliceKey, from, to, onClose }: DashboardChartDrilldownModalProps) {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const [rows, setRows] = useState<DashboardChartDrilldownRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const terminalDateHeader = rows ? resolveTerminalDateHeader(rows, t) : null
  const showTerminalDateColumn = Boolean(terminalDateHeader)

  // Modal her dilim seçiminde `key` ile yeniden mount edilir; state sıfırlama gerekmez.
  useEffect(() => {
    let cancelled = false
    api.getDashboardChartDrilldown(chartKey, sliceKey, from, to)
      .then(response => {
        if (!cancelled) setRows(response.rows)
      })
      .catch(loadError => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : t('common.error'))
      })
    return () => {
      cancelled = true
    }
  }, [chartKey, sliceKey, from, to, t])

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
      <div
        className="flex max-h-[min(85dvh,52rem)] w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold text-emerald-700">
            <Info className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">
              {t(chartKey)}
              <span className="ml-2 font-semibold text-slate-500">{resolveSliceLabel(sliceKey, t)}</span>
            </span>
          </h2>
          <button
            type="button"
            className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label={t('common.close', 'Kapat')}
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {error ? (
            <div className="error">{error}</div>
          ) : rows === null ? (
            <div className="loading">{t('common.loading')}</div>
          ) : (
            <div className="dashboard-drilldown-grid-shell">
              <table className="data-table data-table--zebra dashboard-drilldown-table">
                <thead>
                  <tr>
                    <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                    <th>{t('jobs.columns.requestNo', 'Talep No')}</th>
                    <th>{t('jobs.columns.requestDate', 'Talep Tarihi')}</th>
                    <th>{t('jobs.columns.title', 'Başlık')}</th>
                    <th>{t('departments.name', 'Müdürlük')}</th>
                    <th>{t('jobs.columns.status', 'Durum')}</th>
                    {showTerminalDateColumn ? <th>{terminalDateHeader}</th> : null}
                    <th>{t('jobs.columns.dueDate', 'Son Tarih')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={showTerminalDateColumn ? 8 : 7} className="py-6 text-center text-sm text-slate-500">
                        {t('dashboard.chart.noData', 'Grafik verisi bulunamadı.')}
                      </td>
                    </tr>
                  ) : rows.slice((page - 1) * pageSize, page * pageSize).map((row, index) => (
                    <tr key={row.jobId}>
                      <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(page - 1) * pageSize + index + 1}</td>
                      <td className="table-number-cell font-mono text-xs text-slate-600">{formatDrilldownNumber(row)}</td>
                      <td><DateCell value={row.createdAtUtc} locale={locale} /></td>
                      <td className="font-semibold">{row.title}</td>
                      <td>{row.departmentName ?? row.neighborhood ?? '—'}</td>
                      <td>
                        <span className={getStatusTextClass(row.status)}>{getAuditStatusLabel(t, row.status)}</span>
                      </td>
                      {showTerminalDateColumn ? (
                        <td>
                          {row.status === 'Completed' || isCancelledLike(row.status) ? (
                            <DateCell
                              value={row.terminalDateUtc}
                              locale={locale}
                              tone={row.status === 'Completed' ? 'success' : 'danger'}
                            />
                          ) : '—'}
                        </td>
                      ) : null}
                      <td>
                        <DateCell
                          value={row.dueDateUtc}
                          locale={locale}
                          emptyLabel={t('dashboard.chart.pendingApproval', 'Onay Bekleyen')}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePagination
                totalCount={rows.length}
                pageSize={pageSize}
                currentPage={page}
                onPageSizeChange={size => {
                  setPageSize(size)
                  setPage(1)
                }}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
