import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import type { DashboardChartDrilldownRow } from '../types/platform'
import { StatusPill } from './ui/status-pill'
import { DateCell } from './ui/date-cell'
import { TablePagination } from './ui/table-pagination'
import { resolveSliceLabel } from '../utils/chartSliceLabel'
import { getAuditStatusLabel, getJobStatusTone, getLocale, getStatusPillClass } from '../utils/localization'

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
        className="flex max-h-[min(85dvh,52rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <h2 className="min-w-0 text-sm font-bold text-slate-900">
            {t(chartKey)}
            <span className="ml-2 font-semibold text-slate-500">{resolveSliceLabel(sliceKey, t)}</span>
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
            <>
            <table className="data-table data-table--zebra">
              <thead>
                <tr>
                  <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                  <th>{t('jobs.columns.requestNo', 'Talep No')}</th>
                  <th>{t('jobs.columns.requestDate', 'Talep Tarihi')}</th>
                  <th>{t('jobs.columns.title', 'Başlık')}</th>
                  <th>{t('departments.name', 'Müdürlük')}</th>
                  <th>{t('jobs.columns.status', 'Durum')}</th>
                  <th>{t('jobs.columns.dueDate', 'Son Tarih')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-slate-500">
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
                      <StatusPill className={getStatusPillClass(getJobStatusTone({ status: row.status, dueDateUtc: row.dueDateUtc }))}>
                        {getAuditStatusLabel(t, row.status)}
                      </StatusPill>
                    </td>
                    <td><DateCell value={row.dueDateUtc} locale={locale} /></td>
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
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
