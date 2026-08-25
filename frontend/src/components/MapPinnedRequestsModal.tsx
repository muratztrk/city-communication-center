import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { CitizenDashboardMapPin } from '../types/platform'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import { Button } from './ui/button'
import { DateCell } from './ui/date-cell'
import { FilterableTh } from './ui/FilterableTh'
import { TablePagination } from './ui/table-pagination'
import { TableEmptyStateRows } from './ui/table-empty-state-rows'
import { TruncatedText } from './ui/TruncatedText'
import { StatusPill } from './ui/status-pill'
import { GridStatusLabel } from './ui/GridStatusLabel'
import { DetailModalHeaderBrand } from './branding/DetailModalHeaderBrand'
import { ClearPieFilterLink } from './ui/ClearPieFilterLink'
import { ChannelIcon } from './ui/channel-icon'
import { formatCitizenRequestNumber } from '../utils/citizenRequests'
import { formatJobDisplayNumberText } from '../utils/requestNumberText'
import { formatOverdueInProgressStatus, getLocale, getPriorityColorClass, getPriorityLabel, getStatusPillClass, shouldShowGridPrioritySubline, type GridStatusTone } from '../utils/localization'
import { isJobDueDateOverdue } from '../utils/dateTimePicker'

interface MapPinnedRequestsModalProps {
  pins: CitizenDashboardMapPin[]
  variant: 'citizen' | 'department'
  located?: boolean
  onClose: () => void
  onOpenJob: (jobId: string, socialMessageId?: string) => void
  onShowOnMap: (jobId: string) => void
}

function pinStatusLabel(t: TFunction, pin: CitizenDashboardMapPin, variant: 'citizen' | 'department'): string {
  if (pin.displayStatus === 'completed') return t('jobs.statusLabel.completed', 'Tamamlanmış')
  if (pin.displayStatus === 'cancelled') return t('jobs.statusLabel.cancelled', 'İptal')
  if (pin.displayStatus === 'overdue') {
    return variant === 'citizen'
      ? t('citizenRequestMap.legend.overdue', 'Geciken')
      : formatOverdueInProgressStatus(t)
  }
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

/** Harita listesi Durum: Yapılmakta Görevlerim ile aynı açık mavi (#2699). */
function mapListStatusPillClass(displayStatus: string, variant: 'citizen' | 'department'): string {
  if (displayStatus === 'inProgress') return getStatusPillClass('inProgress')
  if (variant === 'citizen') {
    if (displayStatus === 'processingReceived') return 'bg-teal-600 text-white ring-teal-700'
    if (displayStatus === 'overdue') return 'bg-orange-500 text-white ring-orange-600'
  }
  return getStatusPillClass(pinStatusTone(displayStatus))
}

/** Haritadaki pinlerin standart drilldown grid popup’ı (#2664/#2665/#2678). */
type MapListRow = CitizenDashboardMapPin & {
  requestNoText: string
  destinationText: string
  ownerLocationText: string
  titleText: string
  statusSortText: string
}

/** Harita listesi Konum: uzun ince damla pin (#2700). */
function LocationPinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 36" className={className} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 1.2C6.7 1.2 2.4 5.5 2.4 10.8c0 7.4 9.6 23 9.6 23s9.6-15.6 9.6-23C21.6 5.5 17.3 1.2 12 1.2z"
      />
      <circle cx="12" cy="11" r="3.6" fill="#fff" />
    </svg>
  )
}

function formatMapDate(value: string | undefined, locale: string): string {
  if (!value) return ''
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return ''
  return time.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MapPinnedRequestsModal({ pins, variant, located = true, onClose, onOpenJob, onShowOnMap }: MapPinnedRequestsModalProps) {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const isCitizen = variant === 'citizen'
  const { sortKey, sortDir, toggleSort, sortItems } = useSortable()
  const { filters, setFilter, matchesFilters, clearFilters, hasActiveFilters } = useColumnFilters()

  const decorated = useMemo<MapListRow[]>(() => pins.map(pin => ({
    ...pin,
    requestNoText: isCitizen
      ? formatCitizenRequestNumber(pin, locale)
      : pin.jobNumber != null && pin.jobNumberYear != null
        ? formatJobDisplayNumberText(pin, locale)
        : '',
    destinationText: (pin.destinationDepartmentName ?? pin.departmentName ?? '').trim(),
    ownerLocationText: (pin.ownerDepartmentName ?? '').trim(),
    titleText: (pin.title ?? '').trim(),
    statusSortText: pinStatusLabel(t, pin, variant),
   })), [isCitizen, locale, pins, t, variant])

  const rows = useMemo(() => {
    const filtered = decorated.filter(row => matchesFilters(row, (key, item) => {
      if (key === 'jobNumber') return item.requestNoText
      if (key === 'createdAtUtc') return formatMapDate(item.createdAtUtc, locale)
      if (key === 'citizenPhone') {
        return String(item.citizenPhone ?? '').replace(/\D/g, '').replace(/^90/, '')
      }
      return String((item as unknown as Record<string, unknown>)[key] ?? '')
    }))
    if (!sortKey) {
      return [...filtered].sort((left, right) => Date.parse(right.createdAtUtc ?? '') - Date.parse(left.createdAtUtc ?? ''))
    }
    return sortItems(filtered)
  }, [decorated, locale, matchesFilters, sortItems, sortKey])

  function handleFilter(key: string, value: string) {
    setFilter(key, value)
    setPage(1)
  }

  function handleSort(key: string) {
    toggleSort(key)
    setPage(1)
  }

  const maxPage = Math.max(1, Math.ceil(rows.length / pageSize) || 1)
  const safePage = Math.min(page, maxPage)
  const paged = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const columnCount = isCitizen ? 7 : 8

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
      <div
        className="detail-modal-shell detail-modal-shell--my-request detail-modal-shell--all-requests flex flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="my-request-detail-header detail-modal-header-layout detail-modal-header-mobile detail-modal-header-mobile--actions-grid shrink-0 px-5 py-3.5">
          <div className="detail-modal-header-title min-w-0">
            <h2 className="map-list-modal-title flex min-w-0 items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="block truncate">
                {isCitizen
                  ? (located
                    ? t('nav.social', 'Vatandaş Talepleri')
                    : t('citizenRequestMap.unlocatedListTitle', 'Harita Konumu Olmayan Talepler'))
                  : (located
                    ? t('departmentRequestMap.locatedListTitle', 'Konum Bilgisi Olan Birim Talepleri')
                    : t('citizenRequestMap.unlocatedListTitle', 'Harita Konumu Olmayan Talepler'))}
              </span>
            </h2>
          </div>
          <DetailModalHeaderBrand />
          <div className="detail-modal-header-actions detail-modal-header-actions--mobile-grid flex shrink-0 flex-nowrap items-center justify-end gap-2">
            <ClearPieFilterLink
              hasColumnFilters={hasActiveFilters}
              onClearColumnFilters={() => {
                clearFilters()
                setPage(1)
              }}
            />
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
                      <FilterableTh
                        filterKey="jobNumber"
                        filterValue={filters.jobNumber ?? ''}
                        onFilter={handleFilter}
                        sortKey="jobNumber"
                        currentSortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                      >
                        {isCitizen ? t('social.citizenRequestNoHeader', 'Vatandaş Talep No') : t('jobs.columns.requestNo', 'Talep No')}
                      </FilterableTh>
                      {isCitizen ? (
                        <FilterableTh
                          filterKey="citizenName"
                          filterValue={filters.citizenName ?? ''}
                          onFilter={handleFilter}
                          sortKey="citizenName"
                          currentSortKey={sortKey}
                          sortDir={sortDir}
                          onSort={handleSort}
                        >
                          {t('social.citizenName', 'Vatandaş Adı')}
                        </FilterableTh>
                      ) : null}
                      {isCitizen ? (
                        <FilterableTh
                          className="text-center"
                          filterKey="citizenPhone"
                          filterValue={filters.citizenPhone ?? ''}
                          onFilter={handleFilter}
                          sortKey="citizenPhone"
                          currentSortKey={sortKey}
                          sortDir={sortDir}
                          onSort={handleSort}
                        >
                          {t('jobs.detail.citizenPhone', 'Telefon No')}
                        </FilterableTh>
                      ) : null}
                      <FilterableTh
                        className="text-center"
                        filterKey="createdAtUtc"
                        filterValue={filters.createdAtUtc ?? ''}
                        onFilter={handleFilter}
                        sortKey="createdAtUtc"
                        currentSortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                        allowLetters
                      >
                        {t('jobs.columns.requestDate', 'Talep Tarihi')}
                      </FilterableTh>
                      {isCitizen ? null : (
                        <>
                          <FilterableTh
                            filterKey="ownerLocationText"
                            filterValue={filters.ownerLocationText ?? ''}
                            onFilter={handleFilter}
                            sortKey="ownerLocationText"
                            currentSortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                          >
                            {t('jobs.detail.requestLocation', 'Talep Yeri')}
                          </FilterableTh>
                          <FilterableTh
                            filterKey="destinationText"
                            filterValue={filters.destinationText ?? ''}
                            onFilter={handleFilter}
                            sortKey="destinationText"
                            currentSortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                          >
                            {t('social.destination', 'Gittiği Yer')}
                          </FilterableTh>
                          <FilterableTh
                            filterKey="titleText"
                            filterValue={filters.titleText ?? ''}
                            onFilter={handleFilter}
                            sortKey="titleText"
                            currentSortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                          >
                            {t('jobs.columns.title', 'Başlık')}
                          </FilterableTh>
                        </>
                      )}
                      <FilterableTh
                        className="grid-col-status text-center"
                        filterKey="statusSortText"
                        filterValue={filters.statusSortText ?? ''}
                        onFilter={handleFilter}
                        sortKey="statusSortText"
                        currentSortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                      >
                        {t('jobs.columns.status', 'Durum')}
                      </FilterableTh>
                      <th className="text-center">{t('common.actions', 'İşlemler')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((pin, index) => {
                      const statusLabel = pinStatusLabel(t, pin, variant)
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
                      const requestNo = pin.requestNoText || '—'
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
                                ? <span className="block truncate text-sm font-semibold text-slate-800">{pin.citizenName}</span>
                                : '—'}
                            </td>
                          ) : null}
                          {isCitizen ? (
                            <td className="text-center text-sm font-semibold text-slate-700">
                              {pin.citizenPhone?.trim() || '—'}
                            </td>
                          ) : null}
                          <td className="text-center"><DateCell value={pin.createdAtUtc} locale={locale} /></td>
                          {isCitizen ? null : (
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
                                overdueSubline={variant === 'citizen'
                                  && pin.displayStatus === 'processingReceived'
                                  && isJobDueDateOverdue({ status: pin.jobStatus ?? 'Active', dueDateUtc: pin.dueDateUtc })}
                                footer={statusDateText
                                  ? <span className={`text-[0.68rem] font-bold ${pin.displayStatus === 'completed' ? 'text-emerald-700' : 'text-red-700'}`}>{statusDateText}</span>
                                  : undefined}
                              />
                            </StatusPill>
                          </td>
                          <td className="actions-cell">
                            <div className="request-actions map-list-request-actions justify-center">
                              {located ? (
                              <button
                                type="button"
                                className="map-list-location-btn inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-700"
                                aria-label={t('citizenRequestMap.showOnMap', 'Konum')}
                                title={t('citizenRequestMap.showOnMap', 'Konum')}
                                onClick={() => onShowOnMap(pin.jobId)}
                              >
                                <LocationPinIcon className="h-4 w-2.5" />
                              </button>
                              ) : null}
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
