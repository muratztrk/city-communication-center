import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { api } from '../api/client'
import type { DashboardChartDrilldownRow, JobDetail, SocialMessage } from '../types/platform'
import { DateCell } from './ui/date-cell'
import { Button } from './ui/button'
import { TablePagination } from './ui/table-pagination'
import { resolveSliceLabel } from '../utils/chartSliceLabel'
import { getAuditStatusLabel, getLocale } from '../utils/localization'
import { getCitizenRequestStatusLabel, isCitizenRequestJob } from '../utils/citizenRequests'
import { ChannelIcon } from './ui/channel-icon'

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
  const [detail, setDetail] = useState<JobDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [citizenSourceMessage, setCitizenSourceMessage] = useState<SocialMessage | null>(null)
  const terminalDateHeader = rows ? resolveTerminalDateHeader(rows, t) : null
  const showTerminalDateColumn = Boolean(terminalDateHeader)
  const drilldownColumnCount = showTerminalDateColumn ? 9 : 8

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
          className="detail-modal-shell flex flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
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
                <div className="dashboard-drilldown-table-wrap">
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
                      <th className="text-center">{t('common.actions', 'İşlemler')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={drilldownColumnCount} className="py-6 text-center text-sm text-slate-500">
                          {t('dashboard.chart.noData', 'Grafik verisi bulunamadı.')}
                        </td>
                      </tr>
                    ) : rows.slice((page - 1) * pageSize, page * pageSize).map((row, index) => (
                      <tr key={row.jobId}>
                        <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(page - 1) * pageSize + index + 1}</td>
                        <td className="table-number-cell font-mono text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            {row.citizenRequestNumber != null && row.sourceChannel ? (
                              <ChannelIcon channel={row.sourceChannel} className="size-4 shrink-0" />
                            ) : null}
                            {formatDrilldownNumber(row)}
                          </span>
                        </td>
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
                    ))}
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

      {(detail || detailLoading || detailError) ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={closeJobDetail}>
          {detail ? (
            <MyRequestDetailModal
              detail={detail}
              title={t('nav.myRequests', 'Taleplerim')}
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
              onPrint={() => window.print()}
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
