import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, Printer, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import type { DashboardChartDrilldownRow, JobDetail, SocialMessage } from '../types/platform'
import { Button } from './ui/button'
import { ChannelIcon } from './ui/channel-icon'
import { DateCell } from './ui/date-cell'
import { TablePagination } from './ui/table-pagination'
import { TableEmptyStateRows } from './ui/table-empty-state-rows'
import { DetailModalHeaderBrand } from './branding/DetailModalHeaderBrand'
import { MyRequestDetailModal } from './jobs/my-request-detail/MyRequestDetailModal'
import { formatCitizenPhoneDisplay, formatCitizenRequestNumber, getCitizenRequestStatusLabel, isCitizenRequestJob } from '../utils/citizenRequests'
import { getLocale, getPriorityColorClass, getPriorityLabel, shouldShowGridPrioritySubline } from '../utils/localization'
import { resolveSliceLabel } from '../utils/chartSliceLabel'
import { formatJobDisplayNumberText } from '../utils/requestNumberText'
import { printJobDetail } from '../pages/JobsPage'
import { printDrilldownRows } from './DashboardChartDrilldownModal'

function getDetailStatusClass(status: string): string {
  if (status === 'Completed') return 'text-emerald-600'
  if (status === 'Cancelled' || status === 'Rejected' || status === 'RevisionRequested') return 'text-red-600'
  if (status === 'Active' || status === 'PendingOwnerApproval' || status === 'PendingExternalApproval') return 'text-[#f97316]'
  return 'text-slate-900'
}

interface CitizenChannelMessagesModalProps {
  sliceKey: string
  from?: string
  to?: string
  onClose: () => void
  /** Pie → Detaylar nested başlık (#6a6da49d). */
  jobDetailTitle?: string
}

const CHART_KEY = 'dashboard.citizenChannels.title'

function formatChannelNumber(row: DashboardChartDrilldownRow, locale: string): string {
  if (row.citizenRequestNumber != null && row.citizenRequestNumberYear != null) {
    return formatCitizenRequestNumber({
      citizenRequestNumber: row.citizenRequestNumber,
      citizenRequestNumberYear: row.citizenRequestNumberYear,
    }, locale)
  }
  return formatJobDisplayNumberText(row, locale)
}

/** Anasayfa Vatandaş Talep Kanalları → VT grid popup; veri pie ile aynı BE drilldown (#6a6d0181). */
export function CitizenChannelMessagesModal({
  sliceKey,
  from,
  to,
  jobDetailTitle,
  onClose,
}: CitizenChannelMessagesModalProps) {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const sliceLabel = resolveSliceLabel(sliceKey, t)

  const [rows, setRows] = useState<DashboardChartDrilldownRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detail, setDetail] = useState<JobDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [citizenSourceMessage, setCitizenSourceMessage] = useState<SocialMessage | null>(null)

  useEffect(() => {
    let cancelled = false
    api.getDashboardChartDrilldown(CHART_KEY, sliceKey, from, to)
      .then(response => {
        if (!cancelled) setRows(response.rows)
      })
      .catch(loadError => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('common.error'))
        }
      })
    return () => {
      cancelled = true
    }
  }, [sliceKey, from, to, t])

  const maxPage = Math.max(1, Math.ceil((rows?.length ?? 0) / pageSize) || 1)
  const safePage = Math.min(page, maxPage)
  const paged = (rows ?? []).slice((safePage - 1) * pageSize, safePage * pageSize)

  const loadCitizenSourceMessage = async (jobDetail: JobDetail): Promise<SocialMessage | null> => {
    if (!isCitizenRequestJob(jobDetail)) return null
    if (jobDetail.sourceType === 'SocialMessage' && jobDetail.sourceRefId) {
      try {
        return await api.getSocialMessageById(jobDetail.sourceRefId)
      } catch {
        // reverse JobId link fallback below
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

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
        <div
          className="detail-modal-shell detail-modal-shell--my-request detail-modal-shell--chart-drilldown flex flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
          onClick={event => event.stopPropagation()}
        >
          <div className="my-request-detail-header detail-modal-header-layout detail-modal-header-mobile detail-modal-header-mobile--actions-grid shrink-0 px-5 py-3.5">
            <div className="detail-modal-header-title min-w-0">
              <h2 className="flex min-w-0 items-start gap-2 text-sm font-bold text-emerald-700">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate">{t('dashboard.citizenChannels.title')}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">{sliceLabel}</span>
                </span>
              </h2>
            </div>
            <DetailModalHeaderBrand />
            <div className="detail-modal-header-actions detail-modal-header-actions--mobile-grid flex shrink-0 flex-nowrap items-center justify-end gap-2">
              {rows ? (
                <Button
                  type="button"
                  size="lg"
                  variant="ghost"
                  className="detail-print-action inline-flex items-center gap-1.5 text-[0.95rem] text-slate-700 hover:bg-slate-100"
                  onClick={() => printDrilldownRows(
                    t('dashboard.citizenChannels.title'),
                    sliceLabel,
                    rows,
                    locale,
                    t,
                    {
                      showCitizenColumn: true,
                      showUnitColumn: true,
                      terminalDateLabel: t('jobs.columns.outcomeAt', 'Sonuç Tarihi'),
                      stackRequestNoHeader: true,
                    },
                  )}
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

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-4">
              {error ? (
                <div className="error">{error}</div>
              ) : rows === null ? (
                <div className="loading">{t('common.loading')}</div>
              ) : (
                <div className="dashboard-drilldown-grid-shell">
                  <div className="dashboard-drilldown-table-wrap">
                    <div className="dashboard-drilldown-table-hscroll">
                    <table className="data-table data-table--zebra social-messages-table dashboard-drilldown-table dashboard-drilldown-table--citizen-channels">
                      <thead>
                        <tr>
                          <th className="w-12 text-center">{t('common.rowNo', 'Sıra')}</th>
                          <th>{t('social.citizenRequestNoHeader', 'Vatandaş Talep No')}</th>
                          <th className="dashboard-drilldown-citizen-th text-center">
                            <span className="inline-flex flex-col items-center justify-center leading-tight text-center">
                              <span>{t('social.citizenName', 'Vatandaş Adı')}</span>
                              <span className="text-[0.9em] font-bold uppercase tracking-[0.06em]">
                                {t('citizenMessageApproval.columns.citizenPhone', 'Telefon No')}
                              </span>
                            </span>
                          </th>
                          <th>{t('jobs.columns.requestDate', 'Talep Tarihi')}</th>
                          <th>{t('jobs.columns.unitShort', 'Birim')}</th>
                          <th>{t('whatsapp.label', 'Talep Etiketi')}</th>
                          <th>{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paged.length === 0 ? (
                          <TableEmptyStateRows columnCount={7} message={t('social.empty')} />
                        ) : paged.map((row, index) => (
                          <tr key={row.jobId}>
                            <td className="text-center text-xs font-bold text-slate-400 tabular-nums">
                              {(safePage - 1) * pageSize + index + 1}
                            </td>
                            <td className="table-number-cell font-mono text-xs text-slate-500">
                              <div className="table-number-cell__value inline-flex items-center gap-1.5">
                                {row.sourceChannel ? (
                                  <ChannelIcon channel={row.sourceChannel} className="size-4 shrink-0" />
                                ) : null}
                                <span>{formatChannelNumber(row, locale)}</span>
                              </div>
                              {shouldShowGridPrioritySubline(row.priority) ? (
                                <div className={`table-number-cell__priority font-sans font-bold ${getPriorityColorClass(row.priority!)}`}>
                                  Öncelik:{getPriorityLabel(t, row.priority!)}
                                </div>
                              ) : null}
                            </td>
                            <td className="text-center">
                              <div className="dashboard-drilldown-citizen-stack inline-flex flex-col items-center leading-tight text-center">
                                <div className="font-semibold text-slate-800">{row.citizenName?.trim() || '—'}</div>
                                <div className="dashboard-drilldown-citizen-stack__phone text-xs text-slate-400">
                                  {row.citizenPhone ? formatCitizenPhoneDisplay(row.citizenPhone) : '—'}
                                </div>
                              </div>
                            </td>
                            <td><DateCell value={row.createdAtUtc} locale={locale} /></td>
                            <td>
                              <span className="font-semibold text-slate-700">
                                {row.departmentName ?? t('common.none')}
                              </span>
                            </td>
                            <td className="text-center">
                              <span className="inline-flex min-h-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700">
                                  {row.title?.trim() || t('whatsapp.requestTagsShort', 'Etiket seçiniz')}
                              </span>
                            </td>
                            <td className="actions-cell">
                              <div className="request-actions justify-center">
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="secondary"
                                  onClick={() => { void openJobDetail(row.jobId) }}
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
                  </div>
                  <TablePagination
                    totalCount={rows.length}
                    pageSize={pageSize}
                    currentPage={safePage}
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
      </div>

      {(detail || detailLoading || detailError) ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => {
            setDetail(null)
            setDetailError(null)
            setCitizenSourceMessage(null)
          }}
        >
          {detail ? (
            <MyRequestDetailModal
              detail={detail}
              title={jobDetailTitle ?? t('jobs.taskType.CitizenRequest', 'Vatandaş Talebi')}
              locale={locale}
              detailLoading={detailLoading}
              citizenSourceMessage={citizenSourceMessage}
              detailStatusClass={getDetailStatusClass(detail.status)}
              statusContent={getCitizenRequestStatusLabel(t, detail)}
              canChangeDueDate={false}
              detailDueDateEdit={null}
              onOpenDueDateEdit={() => undefined}
              onCloseDueDateEdit={() => undefined}
              onDueDateChange={() => undefined}
              onDueDateSave={() => undefined}
              onClose={() => {
                setDetail(null)
                setDetailError(null)
                setCitizenSourceMessage(null)
              }}
              onPrint={() => printJobDetail(detail, locale, t, {
                myRequestView: true,
                requestLabel: citizenSourceMessage?.category,
                sourceChannel: citizenSourceMessage?.channel,
              })}
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
