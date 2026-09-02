import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { api } from '../api/client'
import type { JobDetail, JobSummary } from '../types/platform'
import { Button } from './ui/button'
import { DateCell } from './ui/date-cell'
import { FilterableTh } from './ui/FilterableTh'
import { TablePagination } from './ui/table-pagination'
import { TableEmptyStateRows } from './ui/table-empty-state-rows'
import { TruncatedText } from './ui/TruncatedText'
import { StatusPill } from './ui/status-pill'
import { GridStatusLabel } from './ui/GridStatusLabel'
import { DetailModalHeaderBrand } from './branding/DetailModalHeaderBrand'
import { MyRequestDetailModal } from './jobs/my-request-detail/MyRequestDetailModal'
import { isCitizenRequestJob } from '../utils/citizenRequests'
import { isJobDueDateOverdue } from '../utils/dateTimePicker'
import { formatJobDisplayNumberText } from '../utils/requestNumberText'
import {
  formatOverdueInProgressStatus,
  getJobStatusTone,
  getLocale,
  getPriorityColorClass,
  getPriorityLabel,
  getStatusPillClass,
  shouldShowGridPrioritySubline,
} from '../utils/localization'
import { printJobDetail } from '../pages/JobsPage'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'

interface AllDepartmentRequestsModalProps {
  onClose: () => void
}

function isAssignedInternalJob(job: JobSummary): boolean {
  if (isCitizenRequestJob(job) || job.sourceType === 'Routine') return false
  return Boolean(
    job.assignedUserDisplayName
    || job.departments?.some(department => department.role === 'Target')
    || job.taskCount > 0,
  )
}

function destinationName(job: JobSummary): string {
  if (job.requestType === 'InternalUnit') {
    return job.ownerDepartmentName?.trim() || ''
  }
  const targets = (job.departments ?? [])
    .filter(department => department.role === 'Target' && department.departmentName?.trim())
    .map(department => department.departmentName!.trim())
  return [...new Set(targets)].join(', ')
}

function getRowStatusLabel(t: TFunction, job: JobSummary): string {
  if (job.status === 'Completed') return t('jobs.statusLabel.completed', 'Tamamlanan')
  if (job.status === 'Cancelled') return t('jobs.statusLabel.cancelled', 'İptal')
  if (job.status === 'Rejected') return t('jobs.statusLabel.rejected', 'Reddedildi')
  if (job.status === 'RevisionRequested') return t('jobs.statusLabel.returned', 'İade Edildi')
  if (job.status === 'Active') {
    if (isJobDueDateOverdue({ status: job.status, dueDateUtc: job.dueDateUtc })) {
      return formatOverdueInProgressStatus(t)
    }
    return t('jobs.statusLabel.inProgress', 'Yapılmakta')
  }
  if (job.status === 'PendingOwnerApproval' || job.status === 'PendingExternalApproval') {
    return t('jobs.statusLabel.pendingApproval', 'Onay Bekleyen')
  }
  return t(`enum.jobStatus.${job.status}`, { defaultValue: job.status })
}

function getDetailStatusClass(status: string): string {
  if (status === 'Completed') return 'text-emerald-600'
  if (status === 'Cancelled' || status === 'Rejected' || status === 'RevisionRequested') return 'text-red-600'
  if (status === 'Active' || status === 'PendingOwnerApproval' || status === 'PendingExternalApproval') return 'text-[#f97316]'
  return 'text-slate-900'
}

function getDetailStatusLabel(t: TFunction, detail: JobDetail): string {
  if (isJobDueDateOverdue({ status: detail.status, dueDateUtc: detail.dueDateUtc })) {
    return formatOverdueInProgressStatus(t)
  }
  if (detail.status === 'Active') return t('jobs.statusLabel.inProgress', 'Yapılmakta')
  if (detail.status === 'Completed') return t('jobs.statusLabel.completed', 'Tamamlanan')
  if (detail.status === 'Cancelled') return t('jobs.statusLabel.cancelled', 'İptal')
  if (detail.status === 'Rejected') return t('jobs.statusLabel.rejected', 'Reddedildi')
  if (detail.status === 'RevisionRequested') return t('jobs.statusLabel.returned', 'İade Edildi')
  return t(`enum.jobStatus.${detail.status}`, { defaultValue: detail.status })
}

/** Anasayfa-Birimler → atanmış kurum içi talepler grid popup (#2645). */
export function AllDepartmentRequestsModal({ onClose }: AllDepartmentRequestsModalProps) {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const [jobs, setJobs] = useState<JobSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detail, setDetail] = useState<JobDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const { sortKey, sortDir, toggleSort, sortItems } = useSortable()
  const { filters, setFilter, matchesFilters } = useColumnFilters()

  useEffect(() => {
    let cancelled = false
    api.getJobs('all')
      .then(list => {
        if (cancelled) return
        const rows = list
          .filter(isAssignedInternalJob)
          .sort((left, right) => Date.parse(right.createdAtUtc) - Date.parse(left.createdAtUtc))
        setJobs(rows)
      })
      .catch(loadError => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : t('common.error'))
      })
    return () => { cancelled = true }
  }, [t])

  const visibleJobs = useMemo(() => {
    const source = jobs ?? []
    const filtered = source.filter(job => matchesFilters(job, (key, item) => {
      if (key === 'jobNumber') return formatJobDisplayNumberText(item, locale)
      if (key === 'createdAtUtc') {
        return new Date(item.createdAtUtc).toLocaleString(locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      }
      if (key === 'destinationText') return destinationName(item)
      if (key === 'statusSortText') return getRowStatusLabel(t, item)
      return String((item as unknown as Record<string, unknown>)[key] ?? '')
    }))
    const decorated = filtered.map(job => ({
      ...job,
      destinationText: destinationName(job),
      statusSortText: getRowStatusLabel(t, job),
    }))
    if (!sortKey) {
      return [...decorated].sort((left, right) => Date.parse(right.createdAtUtc) - Date.parse(left.createdAtUtc))
    }
    return sortItems(decorated)
  }, [jobs, locale, matchesFilters, sortItems, sortKey, t])

  const maxPage = Math.max(1, Math.ceil(visibleJobs.length / pageSize) || 1)
  const safePage = Math.min(page, maxPage)
  const paged = useMemo(
    () => visibleJobs.slice((safePage - 1) * pageSize, safePage * pageSize),
    [visibleJobs, pageSize, safePage],
  )

  function handleFilter(key: string, value: string) {
    setFilter(key, value)
    setPage(1)
  }

  function handleSort(key: string) {
    toggleSort(key)
    setPage(1)
  }

  const openJobDetail = async (jobId: string) => {
    setDetail(null)
    setDetailLoading(true)
    setDetailError(null)
    try {
      setDetail(await api.getJobById(jobId))
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : t('common.error'))
    } finally {
      setDetailLoading(false)
    }
  }

  const closeJobDetail = () => {
    setDetail(null)
    setDetailError(null)
    setDetailLoading(false)
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
        <div
          className="detail-modal-shell detail-modal-shell--my-request detail-modal-shell--all-requests flex flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
          onClick={event => event.stopPropagation()}
        >
          <div className="my-request-detail-header detail-modal-header-layout detail-modal-header-mobile detail-modal-header-mobile--actions-grid shrink-0 px-5 py-3.5">
            <div className="detail-modal-header-title min-w-0">
              <h2 className="flex min-w-0 items-start gap-2 text-sm font-bold text-emerald-700">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="block truncate">{t('dashboard.allDepartmentRequests', 'Birimlerin Tüm Talepleri')}</span>
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
              {error ? <div className="error">{error}</div> : null}
              {jobs === null && !error ? <div className="loading">{t('common.loading')}</div> : null}
              {jobs ? (
                <div className="dashboard-drilldown-grid-shell">
                  <div className="dashboard-drilldown-table-wrap">
                    <table className="data-table data-table--zebra dashboard-drilldown-table">
                      <thead>
                        <tr>
                          <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                          <FilterableTh filterKey="jobNumber" filterValue={filters.jobNumber ?? ''} onFilter={handleFilter} sortKey="jobNumber" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
                            {t('jobs.columns.requestNo', 'Talep No')}
                          </FilterableTh>
                          <FilterableTh className="text-center" filterKey="createdAtUtc" filterValue={filters.createdAtUtc ?? ''} onFilter={handleFilter} sortKey="createdAtUtc" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} allowLetters>
                            {t('jobs.columns.requestDate', 'Talep Tarihi')}
                          </FilterableTh>
                          <FilterableTh filterKey="ownerDepartmentName" filterValue={filters.ownerDepartmentName ?? ''} onFilter={handleFilter} sortKey="ownerDepartmentName" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
                            {t('jobs.detail.requestLocation', 'Talep Yeri')}
                          </FilterableTh>
                          <FilterableTh filterKey="destinationText" filterValue={filters.destinationText ?? ''} onFilter={handleFilter} sortKey="destinationText" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
                            {t('social.destination', 'Gittiği Yer')}
                          </FilterableTh>
                          <FilterableTh filterKey="title" filterValue={filters.title ?? ''} onFilter={handleFilter} sortKey="title" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
                            {t('jobs.columns.title', 'Başlık')}
                          </FilterableTh>
                          <FilterableTh className="grid-col-status text-center" filterKey="statusSortText" filterValue={filters.statusSortText ?? ''} onFilter={handleFilter} sortKey="statusSortText" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
                            {t('jobs.columns.status', 'Durum')}
                          </FilterableTh>
                          <th className="text-center">{t('common.actions', 'İşlemler')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paged.map((job, index) => {
                          const statusLabel = getRowStatusLabel(t, job)
                          const destination = destinationName(job)
                          const statusDate = job.status === 'Completed' ? job.completedAtUtc
                            : job.status === 'Cancelled' ? job.updatedAtUtc
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
                            <tr key={job.jobId}>
                              <td className="text-center text-xs font-bold text-slate-400 tabular-nums">
                                {(safePage - 1) * pageSize + index + 1}
                              </td>
                              <td className="table-number-cell font-mono text-xs text-slate-600">
                                <div className="table-number-cell__value whitespace-nowrap">
                                  {formatJobDisplayNumberText(job, locale)}
                                </div>
                                {shouldShowGridPrioritySubline(job.priority) ? (
                                  <div className={`table-number-cell__priority font-sans font-bold ${getPriorityColorClass(job.priority)}`}>
                                    Öncelik:{getPriorityLabel(t, job.priority)}
                                  </div>
                                ) : null}
                              </td>
                              <td className="text-center"><DateCell value={job.createdAtUtc} locale={locale} /></td>
                              <td className="max-w-[12rem]">
                                {job.ownerDepartmentName?.trim()
                                  ? <span className="block truncate">{job.ownerDepartmentName}</span>
                                  : '—'}
                              </td>
                              <td className="max-w-[12rem]">
                                {destination ? <span className="block truncate">{destination}</span> : '—'}
                              </td>
                              <td className="font-semibold">
                                <TruncatedText text={job.title?.trim() || '—'} className="cell-title" />
                              </td>
                              <td className="grid-col-status text-center">
                                <StatusPill className={getStatusPillClass(getJobStatusTone(job))}>
                                  <GridStatusLabel
                                    t={t}
                                    label={statusLabel}
                                    footer={statusDateText
                                      ? <span className={`text-[0.68rem] font-bold ${job.status === 'Completed' ? 'text-emerald-700' : 'text-red-700'}`}>{statusDateText}</span>
                                      : undefined}
                                  />
                                </StatusPill>
                              </td>
                              <td className="actions-cell">
                                <div className="request-actions justify-center">
                                  <Button type="button" size="sm" variant="secondary" onClick={() => { void openJobDetail(job.jobId) }}>
                                    {t('jobs.actions.details', 'Detaylar')}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {visibleJobs.length === 0 ? (
                          <TableEmptyStateRows columnCount={8} message={t('dashboard.chart.noData', 'Grafik verisi bulunamadı.')} />
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination
                    totalCount={visibleJobs.length}
                    pageSize={pageSize}
                    currentPage={safePage}
                    onPageSizeChange={size => { setPageSize(size); setPage(1) }}
                    onPageChange={setPage}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {(detail || detailLoading || detailError) ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={closeJobDetail}>
          {detail ? (
            <MyRequestDetailModal
              detail={detail}
              title={t('dashboard.pieJobDetailTitle', 'Birim Talebi')}
              locale={locale}
              detailLoading={detailLoading}
              citizenSourceMessage={null}
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
