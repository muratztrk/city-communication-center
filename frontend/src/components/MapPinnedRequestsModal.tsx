import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, MapPin, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { CitizenDashboardMapPin } from '../types/platform'
import { Button } from './ui/button'
import { DateCell } from './ui/date-cell'
import { TablePagination } from './ui/table-pagination'
import { TableEmptyStateRows } from './ui/table-empty-state-rows'
import { TruncatedText } from './ui/TruncatedText'
import { StatusPill } from './ui/status-pill'
import { GridStatusLabel } from './ui/GridStatusLabel'
import { DetailModalHeaderBrand } from './branding/DetailModalHeaderBrand'
import { ChannelIcon } from './ui/channel-icon'
import { formatCitizenRequestNumber } from '../utils/citizenRequests'
import { formatJobDisplayNumberText } from '../utils/requestNumberText'
import { formatOverdueInProgressStatus, getLocale, getPriorityColorClass, getPriorityLabel, getStatusPillClass, shouldShowGridPrioritySubline, type GridStatusTone } from '../utils/localization'

interface MapPinnedRequestsModalProps {
  pins: CitizenDashboardMapPin[]
  variant: 'citizen' | 'department'
  onClose: () => void
  onOpenJob: (jobId: string, socialMessageId?: string) => void
  onShowOnMap: (jobId: string) => void
}

function pinStatusLabel(t: TFunction, pin: CitizenDashboardMapPin): string {
  if (pin.displayStatus === 'completed') return t('jobs.statusLabel.completed', 'Tamamlanmış')
  if (pin.displayStatus === 'cancelled') return t('jobs.statusLabel.cancelled', 'İptal')
  if (pin.displayStatus === 'overdue') return formatOverdueInProgressStatus(t)
  if (pin.displayStatus === 'inProgress') return t('jobs.statusLabel.inProgress', 'Yapılmakta')
  if (pin.displayStatus === 'processingReceived') {
    return t('dashboard.chart.citizenProcessingReceived', 'İşleme Alındı')
  }
  if (pin.displayStatus === 'pendingApproval') {
    return t('jobs.statusLabel.pendingApproval', 'Onay Bekleyen')
  }
  return t(`enum.jobStatus.${pin.jobStatus ?? pin.displayStatus}`, { defaultValue: pin.displayStatus })
}

function pinStatusTone(displayStatus: string): GridStatusTone {
  if (displayStatus === 'completed') return 'completed'
  if (displayStatus === 'cancelled') return 'cancelled'
  if (displayStatus === 'overdue') return 'overdue'
  if (displayStatus === 'inProgress') return 'inProgress'
  if (displayStatus === 'processingReceived') return 'processingReceived'
  return 'pendingApproval'
}

/** Vatandaş harita listesi: İşleme Alındı teal, Yapılmakta mavi, Geciken turuncu (#2671). */
function mapListStatusPillClass(displayStatus: string, variant: 'citizen' | 'department'): string {
  if (variant === 'citizen') {
    if (displayStatus === 'processingReceived') return 'bg-teal-600 text-white ring-teal-700'
    if (displayStatus === 'inProgress') return 'bg-sky-500 text-white ring-sky-600'
    if (displayStatus === 'overdue') return 'bg-orange-500 text-white ring-orange-600'
  }
  return getStatusPillClass(pinStatusTone(displayStatus))
}

/** Haritadaki pinlerin standart drilldown grid popup’ı (#2664/#2665). */
export function MapPinnedRequestsModal({ pins, variant, onClose, onOpenJob, onShowOnMap }: MapPinnedRequestsModalProps) {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const isCitizen = variant === 'citizen'

  const rows = useMemo(
    () => [...pins].sort((left, right) => Date.parse(right.createdAtUtc ?? '') - Date.parse(left.createdAtUtc ?? '')),
    [pins],
  )
  const maxPage = Math.max(1, Math.ceil(rows.length / pageSize) || 1)
  const safePage = Math.min(page, maxPage)
  const paged = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const columnCount = isCitizen ? 8 : 8

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
      <div
        className="detail-modal-shell detail-modal-shell--my-request detail-modal-shell--all-requests flex flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="my-request-detail-header detail-modal-header-layout detail-modal-header-mobile detail-modal-header-mobile--actions-grid shrink-0 px-5 py-3.5">
          <div className="detail-modal-header-title min-w-0">
            <h2 className="flex min-w-0 items-start gap-2 text-sm font-bold text-emerald-700">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="block truncate">
                {isCitizen
                  ? t('nav.social', 'Vatandaş Talepleri')
                  : t('departmentRequestMap.ticketsTitle', 'Birim Talep Bilgi Listesi')}
              </span>
            </h2>
          </div>
          <DetailModalHeaderBrand />
          <div className="detail-modal-header-actions detail-modal-header-actions--mobile-grid flex shrink-0 flex-nowrap items-center justify-end gap-2">
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
            <div className="dashboard-drilldown-grid-shell">
              <div className="dashboard-drilldown-table-wrap">
                <table className="data-table data-table--zebra dashboard-drilldown-table">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                      <th>{isCitizen ? t('social.citizenRequestNoHeader', 'Vatandaş Talep No') : t('jobs.columns.requestNo', 'Talep No')}</th>
                      {isCitizen ? <th>{t('social.citizenName', 'Vatandaş Adı')}</th> : null}
                      {isCitizen ? <th className="text-center">{t('jobs.detail.citizenPhone', 'Telefon No')}</th> : null}
                      <th className="text-center">{t('jobs.columns.requestDate', 'Talep Tarihi')}</th>
                      {isCitizen ? <th>{t('social.destination', 'Gittiği Yer')}</th> : (
                        <>
                          <th>{t('jobs.detail.requestLocation', 'Talep Yeri')}</th>
                          <th>{t('social.destination', 'Gittiği Yer')}</th>
                          <th>{t('jobs.columns.title', 'Başlık')}</th>
                        </>
                      )}
                      <th className="grid-col-status text-center">{t('jobs.columns.status', 'Durum')}</th>
                      <th className="text-center">{t('common.actions', 'İşlemler')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((pin, index) => {
                      const statusLabel = pinStatusLabel(t, pin)
                      const statusDate = pin.displayStatus === 'completed' ? pin.completedAtUtc
                        : pin.displayStatus === 'cancelled' ? pin.updatedAtUtc
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
                      const requestNo = isCitizen
                        ? formatCitizenRequestNumber(pin, locale)
                        : pin.jobNumber != null && pin.jobNumberYear != null
                          ? formatJobDisplayNumberText(pin, locale)
                          : '—'
                      return (
                        <tr key={pin.jobId}>
                          <td className="text-center text-xs font-bold text-slate-400 tabular-nums">
                            {(safePage - 1) * pageSize + index + 1}
                          </td>
                          <td className="table-number-cell font-mono text-xs text-slate-600">
                            <div className="table-number-cell__value inline-flex items-center gap-1.5 whitespace-nowrap">
                              {isCitizen && pin.channel ? <ChannelIcon channel={pin.channel} className="size-4 shrink-0" /> : null}
                              <span>{requestNo}</span>
                            </div>
                            {shouldShowGridPrioritySubline(pin.priority) ? (
                              <div className={`table-number-cell__priority font-sans font-bold ${getPriorityColorClass(pin.priority ?? '')}`}>
                                Öncelik:{getPriorityLabel(t, pin.priority ?? '')}
                              </div>
                            ) : null}
                          </td>
                          {isCitizen ? (
                            <td className="max-w-[12rem]">
                              {pin.citizenName?.trim()
                                ? <span className="block truncate">{pin.citizenName}</span>
                                : '—'}
                            </td>
                          ) : null}
                          {isCitizen ? (
                            <td className="text-center text-xs font-semibold text-slate-600">
                              {pin.citizenPhone?.trim() || '—'}
                            </td>
                          ) : null}
                          <td className="text-center"><DateCell value={pin.createdAtUtc} locale={locale} /></td>
                          {isCitizen ? (
                            <td className="max-w-[12rem]">
                              {pin.destinationDepartmentName?.trim()
                                ? <span className="block truncate">{pin.destinationDepartmentName}</span>
                                : '—'}
                            </td>
                          ) : (
                            <>
                              <td className="max-w-[12rem]">
                                {pin.ownerDepartmentName?.trim()
                                  ? <span className="block truncate">{pin.ownerDepartmentName}</span>
                                  : '—'}
                              </td>
                              <td className="max-w-[12rem]">
                                {(pin.destinationDepartmentName ?? pin.departmentName)?.trim()
                                  ? <span className="block truncate">{(pin.destinationDepartmentName ?? pin.departmentName)?.trim()}</span>
                                  : '—'}
                              </td>
                              <td className="font-semibold">
                                <TruncatedText text={pin.title?.trim() || '—'} className="cell-title" />
                              </td>
                            </>
                          )}
                          <td className="grid-col-status text-center">
                            <StatusPill className={mapListStatusPillClass(pin.displayStatus, variant)}>
                              <GridStatusLabel
                                t={t}
                                label={statusLabel}
                                footer={statusDateText
                                  ? <span className={`text-[0.68rem] font-bold ${pin.displayStatus === 'completed' ? 'text-emerald-700' : 'text-red-700'}`}>{statusDateText}</span>
                                  : undefined}
                              />
                            </StatusPill>
                          </td>
                          <td className="actions-cell">
                            <div className="request-actions justify-center">
                              <button
                                type="button"
                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-emerald-700 transition-colors hover:bg-emerald-50"
                                aria-label={t('citizenRequestMap.showOnMap', 'Konum')}
                                title={t('citizenRequestMap.showOnMap', 'Konum')}
                                onClick={() => onShowOnMap(pin.jobId)}
                              >
                                <MapPin className="size-4" strokeWidth={2.25} />
                              </button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => onOpenJob(pin.jobId, pin.socialMessageId ?? undefined)}
                              >
                                {t('jobs.actions.details', 'Detaylar')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {rows.length === 0 ? (
                      <TableEmptyStateRows
                        columnCount={columnCount}
                        message={isCitizen
                          ? t('social.emptyCitizenRequests', 'Henüz vatandaş talebi bulunmuyor')
                          : t('dashboard.chart.noData', 'Grafik verisi bulunamadı.')}
                      />
                    ) : null}
                  </tbody>
                </table>
              </div>
              <TablePagination
                totalCount={rows.length}
                pageSize={pageSize}
                currentPage={safePage}
                onPageSizeChange={size => { setPageSize(size); setPage(1) }}
                onPageChange={setPage}
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
