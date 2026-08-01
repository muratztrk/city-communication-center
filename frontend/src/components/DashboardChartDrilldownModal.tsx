import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, Printer, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { api } from '../api/client'
import type { DashboardChartDrilldownRow, JobDetail, SocialMessage } from '../types/platform'
import { DateCell } from './ui/date-cell'
import { Button } from './ui/button'
import { TablePagination } from './ui/table-pagination'
import { TableEmptyStateRows } from './ui/table-empty-state-rows'
import { StatusPill } from './ui/status-pill'
import { GridStatusLabel } from './ui/GridStatusLabel'
import { DueDatePill } from './ui/due-date-pill'
import { DetailModalHeaderBrand } from './branding/DetailModalHeaderBrand'
import { resolveSliceLabel } from '../utils/chartSliceLabel'
import { getAuditStatusLabel, getJobStatusTone, getLocale, getPriorityColorClass, getPriorityLabel, getStatusPillClass } from '../utils/localization'
import { formatCitizenPhoneDisplay, getCitizenRequestStatusLabel, isCitizenRequestJob } from '../utils/citizenRequests'
import { formatJobDisplayNumberText } from '../utils/requestNumberText'
import { ChannelIcon } from './ui/channel-icon'
import { TruncatedText } from './ui/TruncatedText'
import { MyRequestDetailModal } from './jobs/my-request-detail/MyRequestDetailModal'
import { printHtmlDocument } from '../utils/printDocument'
import { printJobDetail } from '../pages/JobsPage'

interface DashboardChartDrilldownModalProps {
  chartKey: string
  sliceKey: string
  from?: string
  to?: string
  requestTagStatus?: string
  onClose: () => void
  /** Pie → Detaylar nested başlık (#6a6da49d / #6a6da519). */
  jobDetailTitle?: string
}

const PRINTABLE_CHART_KEYS = new Set([
  'dashboard.charts.requestTags',
  'dashboard.charts.neighborhoodCompletedRequests',
  'dashboard.charts.neighborhoodInProgressRequests',
  'dashboard.charts.neighborhoodProcessingRequests',
])

/** Anasayfa - Birimler pie drilldown: Son Tarih sütunu yok (#2097). */
const HIDE_DUE_DATE_CHART_KEYS = new Set([
  ...PRINTABLE_CHART_KEYS,
  'dashboard.charts.myRequests',
  'dashboard.charts.incomingRequests',
  'dashboard.charts.outgoingRequests',
  'dashboard.charts.requestPriorityAll',
  'dashboard.charts.requestPriority',
  'dashboard.charts.staffTasks',
  'dashboard.charts.departmentTasks',
  'dashboard.charts.myTasks',
  'dashboard.charts.citizenRequests',
  'dashboard.charts.externalRequestCreators',
  'dashboard.charts.externalRequestPending',
  'dashboard.charts.externalRequestFulfillers',
])

const NEIGHBORHOOD_CHART_KEYS = new Set([
  'dashboard.charts.neighborhoodCompletedRequests',
  'dashboard.charts.neighborhoodInProgressRequests',
  'dashboard.charts.neighborhoodProcessingRequests',
])

/** Mahalle + Talep Etiketi + birim-dışı pie'lar: Durum=StatusPill; terminal tarih alt satır (#r545/#2068). */
const EXTERNAL_UNIT_CHART_KEYS = new Set([
  'dashboard.charts.externalRequestCreators',
  'dashboard.charts.externalRequestPending',
  'dashboard.charts.externalRequestFulfillers',
])

const TALEPLERIM_STATUS_STYLE_CHART_KEYS = new Set([
  ...NEIGHBORHOOD_CHART_KEYS,
  'dashboard.charts.requestTags',
  'dashboard.charts.citizenRequests',
  ...EXTERNAL_UNIT_CHART_KEYS,
])

/** Birim sütunu tek satır + overflow tooltip (#6a62fe79). Talep Etiketi → Vatandaş Adı (#6a6c9fed). */
const TRUNCATE_UNIT_CHART_KEYS = new Set([
  ...EXTERNAL_UNIT_CHART_KEYS,
  ...NEIGHBORHOOD_CHART_KEYS,
  'dashboard.charts.citizenRequests',
])

function formatDrilldownNumber(row: DashboardChartDrilldownRow, locale: string): string {
  if (row.citizenRequestNumber != null && row.citizenRequestNumberYear != null) {
    return `VT-${row.citizenRequestNumberYear}-${row.citizenRequestNumber}`
  }
  return formatJobDisplayNumberText(row, locale)
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

function getDetailStatusClass(status: string): string {
  if (status === 'Completed') return 'text-emerald-600'
  if (status === 'Cancelled' || status === 'Rejected' || status === 'RevisionRequested') return 'text-red-600'
  if (status === 'Active' || status === 'PendingOwnerApproval' || status === 'PendingExternalApproval') return 'text-[#f97316]'
  return 'text-slate-900'
}

function getDetailStatusLabel(t: TFunction, detail: JobDetail): string {
  if (isCitizenRequestJob(detail)) {
    return getCitizenRequestStatusLabel(t, detail)
  }
  if (detail.status === 'Active') return t('jobs.statusLabel.inProgress', 'Yapılmakta')
  if (detail.status === 'Completed') return t('jobs.statusLabel.completed', 'Tamamlanmış')
  if (detail.status === 'Cancelled') return t('jobs.statusLabel.cancelled', 'İptal')
  if (detail.status === 'Rejected') return t('jobs.statusLabel.rejected', 'Reddedildi')
  if (detail.status === 'RevisionRequested') return t('jobs.statusLabel.returned', 'İade Edildi')
  return t(`enum.jobStatus.${detail.status}`, { defaultValue: detail.status })
}

function getDrilldownStatusLabel(t: TFunction, row: DashboardChartDrilldownRow): string {
  if (row.citizenRequestNumber != null) {
    const normalizedStatus = row.status === 'PendingExternalApproval' ? 'Active' : row.status
    return getCitizenRequestStatusLabel(t, {
      status: normalizedStatus,
      taskCount: normalizedStatus === 'Active' || normalizedStatus === 'Completed' ? 1 : 0,
      dueDateUtc: row.dueDateUtc,
    })
  }
  if (row.status === 'Completed') return t('jobs.statusLabel.completed', 'Tamamlanmış')
  if (row.status === 'Cancelled') return t('jobs.statusLabel.cancelled', 'İptal')
  if (row.status === 'Rejected') return t('jobs.statusLabel.rejected', 'Reddedildi')
  if (row.status === 'RevisionRequested') return t('jobs.statusLabel.returned', 'İade Edildi')
  if (row.status === 'Active') return t('jobs.statusLabel.inProgress', 'Yapılmakta')
  if (row.status === 'PendingOwnerApproval' || row.status === 'PendingExternalApproval') {
    return t('jobs.statusLabel.pendingApproval', 'Onay Bekleyen')
  }
  return getAuditStatusLabel(t, row.status)
}

function getDrilldownStatusPillClass(row: DashboardChartDrilldownRow): string {
  if (row.citizenRequestNumber != null) {
    const normalizedStatus = row.status === 'PendingExternalApproval' ? 'Active' : row.status
    return getStatusPillClass(getJobStatusTone({ status: normalizedStatus, dueDateUtc: row.dueDateUtc }))
  }
  return getStatusPillClass(getJobStatusTone({ status: row.status, dueDateUtc: row.dueDateUtc }))
}

function printDrilldownRows(
  chartTitle: string,
  sliceLabel: string,
  rows: DashboardChartDrilldownRow[],
  locale: string,
  t: TFunction,
  options?: {
    showCitizenColumn?: boolean
    showUnitColumn?: boolean
    /** Mahalle pie yazdır: Sonuç Tarihi. */
    terminalDateLabel?: string
    /** Mahalle yazdır: Vatandaş / Talep No iki satır (#6a6d8e2f). */
    stackRequestNoHeader?: boolean
  },
) {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // Yazdır: Talep / Sonuç Tarihi — saat yok (#6a6da028).
  const formatDate = (value: string | null | undefined) => {
    if (!value) return '—'
    return new Date(value).toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }
  const showCitizen = options?.showCitizenColumn === true
  const showUnit = options?.showUnitColumn !== false
  const stackRequestNo = options?.stackRequestNoHeader === true
  const terminalHeader = options?.terminalDateLabel
    ?? t('jobs.columns.outcomeAt', 'Sonuç Tarihi')
  const requestNoHeaderHtml = stackRequestNo
    ? `<div class="request-no-stack"><div>${escape(t('dashboard.citizen', 'Vatandaş'))}</div><div class="request-no-sub">${escape(t('jobs.columns.requestNo', 'Talep No'))}</div></div>`
    : escape(t('social.citizenRequestNo', 'Vatandaş Talep No'))
  const rowsHtml = rows.map((row, index) => {
    const status = getDrilldownStatusLabel(t, row)
    const name = row.citizenName?.trim() || '—'
    const phone = row.citizenPhone ? formatCitizenPhoneDisplay(row.citizenPhone) : '—'
    const unitCell = row.departmentName ?? row.neighborhood ?? '—'
    return `<tr>
      <td class="col-seq">${index + 1}</td>
      <td class="col-no">${escape(formatDrilldownNumber(row, locale))}</td>
      ${showCitizen ? `<td class="col-citizen"><div class="citizen-stack"><div class="citizen-name">${escape(name)}</div><div class="citizen-phone">${escape(phone)}</div></div></td>` : ''}
      <td class="col-date">${escape(formatDate(row.createdAtUtc))}</td>
      <td class="col-title">${escape(row.title?.trim() || '—')}</td>
      ${showUnit ? `<td class="col-dept">${escape(unitCell)}</td>` : ''}
      <td class="col-status"><span class="status-cell">${escape(status)}</span></td>
      <td class="col-completed">${escape(formatDate(row.terminalDateUtc))}</td>
    </tr>`
  }).join('')

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(chartTitle)}</title>
    <style>
      @page{margin:12mm}
      body{font-family:system-ui,sans-serif;padding:22px;color:#0f172a}
      h1{font-size:17px;margin:0 0 4px}
      p{margin:0 0 14px;color:#64748b;font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed}
      th,td{border:1px solid #cbd5e1;padding:6px 7px;text-align:center;vertical-align:middle}
      th{background:#f1f5f9;white-space:nowrap}
      th.col-title,td.col-title{white-space:normal;text-align:center;word-break:break-word;overflow-wrap:anywhere}
      th.col-date,td.col-date,th.col-status,td.col-status,th.col-completed,td.col-completed{text-align:center !important}
      /* Yazdır Durum: hücre ortası (#6a6db2e2 — sağa kaymasın). */
      th.col-status,td.col-status{text-align:center !important;padding-left:6px;padding-right:6px}
      td.col-status .status-cell{display:inline-block;width:100%;text-align:center}
      th.col-citizen .citizen-stack,td.col-citizen .citizen-stack,th.col-no .request-no-stack{display:flex;flex-direction:column;align-items:center;gap:2px;line-height:1.2}
      /* Yazdır: Telefon No title-case (uppercase değil) (#6a6d92e8). */
      th.col-citizen .citizen-phone{font-size:0.9em;font-weight:700;letter-spacing:0.02em}
      th.col-no .request-no-sub{font-size:0.9em;font-weight:700}
      td.col-citizen .citizen-name{font-weight:600}
      td.col-citizen .citizen-phone{font-size:10px;color:#64748b}
      .col-seq{width:4%}
      .col-no{width:11%;white-space:nowrap}
      .col-title{width:18%}
      .col-date{width:12%;white-space:nowrap}
      .col-citizen{width:14%}
      .col-dept{width:13%}
      .col-status{width:12%}
      .col-completed{width:14%;white-space:nowrap}
      th.col-completed,td.col-completed{padding:6px 7px}
      .footer{margin-top:14px;font-size:10px;color:#64748b}
    </style></head><body>
    <h1>${escape(chartTitle)}</h1>
    <p>${escape(sliceLabel)}</p>
    <table><thead><tr>
      <th class="col-seq">${escape(t('common.number', 'Sıra'))}</th>
      <th class="col-no">${requestNoHeaderHtml}</th>
      ${showCitizen ? `<th class="col-citizen"><div class="citizen-stack"><div>${escape(t('social.citizenName', 'Vatandaş Adı'))}</div><div class="citizen-phone">${escape(t('citizenMessageApproval.columns.citizenPhone', 'Telefon No'))}</div></div></th>` : ''}
      <th class="col-date">${escape(t('jobs.columns.requestDate', 'Talep Tarihi'))}</th>
      <th class="col-title">${escape(t('jobs.columns.title', 'Başlık'))}</th>
      ${showUnit ? `<th class="col-dept">${escape(t('jobs.columns.unitShort', 'Birim'))}</th>` : ''}
      <th class="col-status">${escape(t('jobs.columns.status', 'Durum'))}</th>
      <th class="col-completed">${escape(terminalHeader)}</th>
    </tr></thead><tbody>${rowsHtml}</tbody></table>
    <div class="footer">Yazdırma tarihi: ${new Date().toLocaleString(locale)}</div>
    </body></html>`

  printHtmlDocument(html)
}

/**
 * Üst Düzey Yönetici panosunda pie chart dilimine tıklanınca açılan detay popup'ı (card #1343 / #r542).
 * İçerik shell zoom stacking-context'inden kaçmak için body'ye portallanır.
 */
export function DashboardChartDrilldownModal({ chartKey, sliceKey, from, to, requestTagStatus, onClose, jobDetailTitle }: DashboardChartDrilldownModalProps) {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const [rows, setRows] = useState<DashboardChartDrilldownRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detail, setDetail] = useState<JobDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [citizenSourceMessage, setCitizenSourceMessage] = useState<SocialMessage | null>(null)
  const terminalDateHeader = rows ? resolveTerminalDateHeader(rows, t) : null
  const hideDueDateColumn = HIDE_DUE_DATE_CHART_KEYS.has(chartKey)
  const useTaleplerimStatusStyle = TALEPLERIM_STATUS_STYLE_CHART_KEYS.has(chartKey)
  // Giden talepler gibi: Tamamlanmış/İptal tarihi Durum pill altında — ayrı sütun yok (#2068).
  // Yazdırma HTML'inde Tamamlanma Tarihi sütunu korunur.
  const showTerminalDateColumn = !useTaleplerimStatusStyle
    && (hideDueDateColumn || Boolean(terminalDateHeader))
  const terminalColumnHeader = hideDueDateColumn
    ? t('jobs.columns.completedAt', 'Tamamlanma Tarihi')
    : (terminalDateHeader ?? t('jobs.columns.completedAt', 'Tamamlanma Tarihi'))
  const showPrint = PRINTABLE_CHART_KEYS.has(chartKey)
  const isRequestTagsChart = chartKey === 'dashboard.charts.requestTags'
  const isCitizenRequestsChart = chartKey === 'dashboard.charts.citizenRequests'
  const isNeighborhoodChart = NEIGHBORHOOD_CHART_KEYS.has(chartKey)
  const isExternalUnitChart = EXTERNAL_UNIT_CHART_KEYS.has(chartKey)
  const truncateUnitColumn = TRUNCATE_UNIT_CHART_KEYS.has(chartKey)
  // Anasayfa - Vatandaş pie popup'larında kolon başlığı her zaman VT (#6a6cff28).
  const useCitizenRequestNoHeader = isCitizenRequestsChart || isRequestTagsChart || isNeighborhoodChart
  const requestNoColumnLabel = useCitizenRequestNoHeader
    ? t('social.citizenRequestNo', 'Vatandaş Talep No')
    : t('jobs.columns.requestNo', 'Talep No')
  // VT No sonrası Vatandaş Adı / Telefon No (#6a6d9411).
  const showCitizenColumn = isCitizenRequestsChart || isRequestTagsChart || isNeighborhoodChart
  const showUnitColumn = !isRequestTagsChart
  const unitColumnLabel = !showUnitColumn
    ? null
    : (isNeighborhoodChart || isExternalUnitChart || isCitizenRequestsChart
      ? t('jobs.columns.unitShort', 'Birim')
      : t('departments.name', 'Müdürlük'))
  const chartTitle = t(chartKey)
  const sliceLabel = resolveSliceLabel(sliceKey, t)
  const drilldownColumnCount = 6
    + (showCitizenColumn ? 1 : 0)
    + (showUnitColumn ? 1 : 0)
    + (showTerminalDateColumn ? 1 : 0)
    + (hideDueDateColumn ? 0 : 1)

  useEffect(() => {
    let cancelled = false
    api.getDashboardChartDrilldown(chartKey, sliceKey, from, to, requestTagStatus)
      .then(response => {
        if (!cancelled) setRows(response.rows)
      })
      .catch(loadError => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : t('common.error'))
      })
    return () => {
      cancelled = true
    }
  }, [chartKey, sliceKey, from, to, requestTagStatus, t])

  const loadCitizenSourceMessage = async (jobDetail: JobDetail): Promise<SocialMessage | null> => {
    if (!isCitizenRequestJob(jobDetail)) return null
    if (jobDetail.sourceType === 'SocialMessage' && jobDetail.sourceRefId) {
      try {
        return await api.getSocialMessageById(jobDetail.sourceRefId)
      } catch {
        // Some historical VT jobs only have the reverse SocialMessage.JobId link.
      }
    }
    try {
      const messages = await api.getSocialMessages()
      return messages.find(message => message.jobId === jobDetail.jobId) ?? null
    } catch {
      return null
    }
  }

  const openJobDetail = async (jobId: string) => {
    setDetail(null)
    setDetailLoading(true)
    setDetailError(null)
    setCitizenSourceMessage(null)
    try {
      const jobDetail = await api.getJobById(jobId)
      setDetail(jobDetail)
      setCitizenSourceMessage(await loadCitizenSourceMessage(jobDetail))
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : t('common.error'))
    } finally {
      setDetailLoading(false)
    }
  }

  const closeJobDetail = () => {
    setDetail(null)
    setDetailError(null)
    setCitizenSourceMessage(null)
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
        <div
          className="detail-modal-shell detail-modal-shell--my-request flex flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
          onClick={event => event.stopPropagation()}
        >
          <div className="my-request-detail-header detail-modal-header-layout detail-modal-header-mobile detail-modal-header-mobile--actions-grid shrink-0 px-5 py-3.5">
            <div className="detail-modal-header-title min-w-0">
              <h2 className="flex min-w-0 items-start gap-2 text-sm font-bold text-emerald-700">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate">{chartTitle}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">{sliceLabel}</span>
                </span>
              </h2>
            </div>
            <DetailModalHeaderBrand />
            <div className="detail-modal-header-actions detail-modal-header-actions--mobile-grid flex shrink-0 flex-nowrap items-center justify-end gap-2">
              {showPrint && rows ? (
                <Button
                  type="button"
                  size="lg"
                  variant="ghost"
                  className="detail-print-action inline-flex items-center gap-1.5 text-[0.95rem] text-slate-700 hover:bg-slate-100"
                  onClick={() => printDrilldownRows(chartTitle, sliceLabel, rows, locale, t, {
                    showCitizenColumn,
                    showUnitColumn,
                    // Yazdır: Tamamlanma Tarihi → Sonuç Tarihi (#6a6da028).
                    terminalDateLabel: t('jobs.columns.outcomeAt', 'Sonuç Tarihi'),
                    stackRequestNoHeader: isNeighborhoodChart,
                  })}
                  aria-label={t('common.print', 'Yazdır')}
                >
                  <Printer className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                  {t('common.print', 'Yazdır')}
                </Button>
              ) : null}
              <button
                type="button"
                className="detail-modal-header-close flex size-9 items-center justify-center rounded-full bg-transparent text-slate-400 shadow-none transition-colors hover:bg-red-50 hover:text-red-600 active:scale-95"
                aria-label={t('common.close', 'Kapat')}
                onClick={onClose}
              >
                <X className="size-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
            <div className="pt-4">
            {error ? (
              <div className="error">{error}</div>
            ) : rows === null ? (
              <div className="loading">{t('common.loading')}</div>
            ) : (
              <div className="dashboard-drilldown-grid-shell">
                <div className="dashboard-drilldown-table-wrap">
                <table className={`data-table data-table--zebra dashboard-drilldown-table${isCitizenRequestsChart ? ' dashboard-drilldown-table--citizen' : ''}${isRequestTagsChart ? ' dashboard-drilldown-table--request-tags' : ''}`}>
                  <thead>
                    <tr>
                      <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                      <th>{requestNoColumnLabel}</th>
                      {showCitizenColumn ? (
                        <th className="dashboard-drilldown-citizen-th text-center">
                          <span className="inline-flex flex-col items-center justify-center leading-tight text-center">
                            <span>{t('social.citizenName', 'Vatandaş Adı')}</span>
                            <span className="text-[0.9em] font-bold uppercase tracking-[0.06em]">
                              {t('citizenMessageApproval.columns.citizenPhone', 'Telefon No')}
                            </span>
                          </span>
                        </th>
                      ) : null}
                      <th className="text-center">{t('jobs.columns.requestDate', 'Talep Tarihi')}</th>
                      <th>{t('jobs.columns.title', 'Başlık')}</th>
                      {showUnitColumn && unitColumnLabel ? <th>{unitColumnLabel}</th> : null}
                      <th className="grid-col-status text-center">{t('jobs.columns.status', 'Durum')}</th>
                      {showTerminalDateColumn ? <th className="text-center">{terminalColumnHeader}</th> : null}
                      {!hideDueDateColumn ? <th className="text-center">{t('jobs.columns.dueDate', 'Son Tarih')}</th> : null}
                      <th className="text-center">{t('common.actions', 'İşlemler')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <TableEmptyStateRows
                        columnCount={drilldownColumnCount}
                        message={t('dashboard.chart.noData', 'Grafik verisi bulunamadı.')}
                      />
                    ) : rows.slice((page - 1) * pageSize, page * pageSize).map((row, index) => {
                      const statusLabel = getDrilldownStatusLabel(t, row)
                      const statusDate = (useTaleplerimStatusStyle || !showTerminalDateColumn)
                        && (row.status === 'Completed' || isCancelledLike(row.status))
                        ? row.terminalDateUtc
                        : null
                      const statusDateText = statusDate
                        ? new Date(statusDate).toLocaleString(locale, {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        : null
                      return (
                      <tr key={row.jobId}>
                        <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(page - 1) * pageSize + index + 1}</td>
                        <td className="table-number-cell font-mono text-xs text-slate-600">
                          <div className="table-number-cell__value inline-flex items-center gap-1.5 whitespace-nowrap">
                            {row.citizenRequestNumber != null && row.sourceChannel ? (
                              <ChannelIcon channel={row.sourceChannel} className="size-4 shrink-0" />
                            ) : null}
                            {formatDrilldownNumber(row, locale)}
                          </div>
                          {row.priority ? (
                            <div className={`table-number-cell__priority font-sans font-bold ${getPriorityColorClass(row.priority)}`}>
                              (Öncelik:{getPriorityLabel(t, row.priority)})
                            </div>
                          ) : null}
                        </td>
                        {showCitizenColumn ? (
                          <td className="text-center">
                            <div className="dashboard-drilldown-citizen-stack inline-flex flex-col items-center leading-tight text-center">
                              <div className="font-semibold text-slate-800">{row.citizenName?.trim() || '—'}</div>
                              <div className="dashboard-drilldown-citizen-stack__phone text-xs text-slate-400">
                                {row.citizenPhone ? formatCitizenPhoneDisplay(row.citizenPhone) : '—'}
                              </div>
                            </div>
                          </td>
                        ) : null}
                        <td className="text-center"><DateCell value={row.createdAtUtc} locale={locale} /></td>
                        <td className="font-semibold">
                          <TruncatedText text={row.title?.trim() || '—'} className="cell-title" />
                        </td>
                        {showUnitColumn ? (
                          <td className={truncateUnitColumn ? 'max-w-[12rem]' : undefined}>
                            {truncateUnitColumn ? (
                              (row.departmentName ?? row.neighborhood) ? (
                                <span className="block truncate">{row.departmentName ?? row.neighborhood}</span>
                              ) : '—'
                            ) : (row.departmentName ?? row.neighborhood ?? '—')}
                          </td>
                        ) : null}
                        <td className="grid-col-status text-center">
                          {useTaleplerimStatusStyle ? (
                            <StatusPill className={getDrilldownStatusPillClass(row)}>
                              <GridStatusLabel
                                t={t}
                                label={statusLabel}
                                channel={row.sourceChannel}
                                footer={statusDateText
                                  ? <span className={`text-[0.68rem] font-bold ${row.status === 'Completed' ? 'text-emerald-700' : 'text-red-700'}`}>{statusDateText}</span>
                                  : undefined}
                              />
                            </StatusPill>
                          ) : (
                            <span className={row.status === 'Completed' ? 'font-semibold text-emerald-600' : isCancelledLike(row.status) ? 'font-semibold text-red-600' : row.status === 'Active' || row.status === 'InProgress' ? 'font-semibold text-orange-500' : ''}>
                              {statusLabel}
                            </span>
                          )}
                        </td>
                        {showTerminalDateColumn ? (
                          <td className="text-center">
                            {row.status === 'Completed' || isCancelledLike(row.status) ? (
                              <DateCell
                                value={row.terminalDateUtc}
                                locale={locale}
                                tone={row.status === 'Completed' ? 'success' : 'danger'}
                              />
                            ) : '—'}
                          </td>
                        ) : null}
                        {!hideDueDateColumn ? (
                          <td className="text-center">
                            {useTaleplerimStatusStyle ? (
                              <DueDatePill
                                value={row.dueDateUtc}
                                completedAtUtc={row.status === 'Completed' ? row.terminalDateUtc : null}
                                locale={locale}
                                emptyLabel={t('dashboard.chart.pendingApproval', 'Onay Bekleyen')}
                              />
                            ) : (
                              <DateCell
                                value={row.dueDateUtc}
                                locale={locale}
                                emptyLabel={t('dashboard.chart.pendingApproval', 'Onay Bekleyen')}
                              />
                            )}
                          </td>
                        ) : null}
                        <td className="actions-cell">
                          <div className="request-actions justify-center">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={detailLoading}
                              onClick={() => void openJobDetail(row.jobId)}
                            >
                              {t('jobs.actions.details', 'Detaylar')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
                <TablePagination
                  totalCount={rows.length}
                  pageSize={pageSize}
                  currentPage={page}
                  onPageSizeChange={setPageSize}
                  onPageChange={setPage}
                />
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {(detail || detailLoading || detailError) ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={closeJobDetail}>
          {detail ? (
            <MyRequestDetailModal
              detail={detail}
              title={jobDetailTitle ?? t('nav.myRequests', 'Taleplerim')}
              locale={locale}
              detailLoading={detailLoading}
              citizenSourceMessage={citizenSourceMessage}
              detailStatusClass={getDetailStatusClass(detail.status)}
              statusContent={getDetailStatusLabel(t, detail)}
              canChangeDueDate={false}
              detailDueDateEdit={null}
              onOpenDueDateEdit={() => undefined}
              onCloseDueDateEdit={() => undefined}
              onDueDateChange={() => undefined}
              onDueDateSave={() => undefined}
              onClose={closeJobDetail}
              onPrint={() => printJobDetail(detail, locale, t, { myRequestView: true })}
              showManagerNoteColumn={false}
              canEditManagerNote={false}
              canManageCoordination={false}
              managerNoteDraft=""
              managerNoteEditing={false}
              managerNoteSaved={false}
              managerNoteSaving={false}
              onManagerNoteDraftChange={() => undefined}
              onManagerNoteEditStart={() => undefined}
              onManagerNoteSave={() => undefined}
              onManagerNoteDeleteConfirm={() => undefined}
              setConfirmDialog={() => undefined}
              canEditJobAttachments={false}
              showAttachmentLockNotice={false}
              attachmentLockText=""
              attachmentUploading={false}
              onAttachmentUpload={async () => undefined}
              onAttachmentDelete={async () => undefined}
              onDownloadTaskAttachment={() => undefined}
              /* Vatandaş Talep Bilgisi nested boyutu (#6a6da278). */
              shellClassName="detail-modal-shell--citizen-directory-nested"
            />
          ) : (
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
              {detailLoading ? <div className="loading">{t('common.loading')}</div> : null}
              {detailError ? <div className="error">{detailError}</div> : null}
            </div>
          )}
        </div>
      ) : null}
    </>,
    document.body,
  )
}
