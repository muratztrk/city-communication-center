import { ArrowRight } from 'lucide-react'

function getScopeChipColorClass(value: string): string {
  if (value === 'pending-approval') return 'scope-chip--pending'
  if (value === 'approved') return 'scope-chip--approved'
  if (value === 'completed') return 'scope-chip--completed'
  if (value === 'all') return 'scope-chip--all'
  return ''
}
import { useEffect, useMemo, useState } from 'react'
import { useSortable } from '../hooks/useSortable'
import { FilterableTh } from '../components/ui/FilterableTh'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { PromptDialog } from '../components/ui/prompt-dialog'
import type { PromptDialogState } from '../components/ui/prompt-dialog'
import { StatusPill } from '../components/ui/status-pill'
import { TablePagination } from '../components/ui/table-pagination'
import { useAuth } from '../context/AuthContext'
import type { JobSummary, Task } from '../types/platform'
import { getLocale, getPriorityLabel, getTaskStatusLabel } from '../utils/localization'

type IncomingStatusFilter = 'pending-approval' | 'approved' | 'completed' | 'all'
type IncomingKindFilter = 'internal' | 'external' | 'all'

const STATUS_FILTERS: { value: IncomingStatusFilter; labelKey: string; fallback: string }[] = [
  { value: 'pending-approval', labelKey: 'jobs.scopes.pendingApproval', fallback: 'Onay Bekleyen' },
  { value: 'approved', labelKey: 'jobs.scopes.departmentPool', fallback: 'Onaylanmış Talepler' },
  { value: 'completed', labelKey: 'jobs.scopes.completed', fallback: 'Tamamlanmış Talepler' },
  { value: 'all', labelKey: 'jobs.scopes.all', fallback: 'Tümü' },
]

const KIND_FILTERS: { value: IncomingKindFilter; labelKey: string; fallback: string }[] = [
  { value: 'internal', labelKey: 'nav.incomingRequestsInternal', fallback: 'Birim İçi Gelen Talepler' },
  { value: 'external', labelKey: 'nav.incomingRequestsExternal', fallback: 'Birim Dışı Gelen Talepler' },
  { value: 'all', labelKey: 'nav.incomingRequestsAll', fallback: 'Birime Gelen Tüm Talepler' },
]

type IncomingRequestRow = {
  id: string
  displayNumber: string
  kind: 'internal' | 'external'
  statusDomain: 'task' | 'job'
  title: string
  status: string
  priority: string
  departmentName: string | null
  createdBy: string | null
  dueDateUtc: string | null
  createdAtUtc: string | null
  detailsPath: string
  /** For PendingExternalApproval jobs: the first pending target department that needs approval */
  pendingTargetDepartmentId: string | null
}

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return locale.startsWith('tr') ? 'Belirsiz' : 'Unspecified'
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getJobStatusLabel(t: ReturnType<typeof useTranslation>['t'], status: string): string {
  return t(`enum.jobStatus.${status}`, { defaultValue: status })
}

function getIncomingStatusFilter(value: string | null): IncomingStatusFilter {
  return value === 'approved' || value === 'completed' || value === 'all' ? value : 'pending-approval'
}

function getIncomingKindFilter(value: string | null): IncomingKindFilter {
  return value === 'internal' || value === 'external' ? value : 'all'
}

function matchesStatusFilter(row: IncomingRequestRow, filter: IncomingStatusFilter): boolean {
  if (filter === 'all') return true

  if (filter === 'pending-approval') {
    return row.status === 'PendingOwnerApproval' || row.status === 'PendingExternalApproval' || row.status === 'PendingApproval'
  }

  if (filter === 'completed') {
    return row.status === 'Completed'
  }

  return row.status === 'Active'
    || row.status === 'Waiting'
    || row.status === 'Assigned'
    || row.status === 'InProgress'
    || row.status === 'PendingCloseApproval'
}

function matchesKindFilter(row: IncomingRequestRow, filter: IncomingKindFilter): boolean {
  return filter === 'all' || row.kind === filter
}

function formatJobDisplayNumber(job: JobSummary): string {
  const year = job.jobNumberYear ?? new Date().getFullYear()
  if (job.jobNumber != null && job.jobNumberYear != null) {
    return `T-${year}-${job.jobNumber}`
  }
  return `T-${year}-Onay Bekleyen`
}

function formatTaskDisplayNumber(task: Task): string {
  const year = task.taskNumberYear ?? new Date().getFullYear()
  if (task.taskNumber != null && task.taskNumberYear != null) {
    return `G-${year}-${task.taskNumber}`
  }
  return `G-${year}-Onay Bekleyen`
}

function toInternalRow(task: Task): IncomingRequestRow {
  return {
    id: task.taskId,
    displayNumber: formatTaskDisplayNumber(task),
    kind: 'internal',
    statusDomain: 'task',
    title: task.title,
    status: task.currentStatus,
    priority: task.priority,
    departmentName: task.assignedDepartmentName ?? null,
    createdBy: task.createdByDisplayName ?? null,
    dueDateUtc: task.dueDateUtc,
    createdAtUtc: task.createdAtUtc ?? null,
    detailsPath: `/tasks?scope=all&taskId=${task.taskId}`,
    pendingTargetDepartmentId: null,
  }
}

function toExternalRow(job: JobSummary): IncomingRequestRow {
  const pendingTarget = job.departments?.find(d => d.role === 'Target' && d.approvalStatus === 'Pending')
  return {
    id: job.jobId,
    displayNumber: formatJobDisplayNumber(job),
    kind: 'external',
    statusDomain: 'job',
    title: job.title,
    status: job.status,
    priority: job.priority,
    departmentName: job.ownerDepartmentName,
    createdBy: job.createdByDisplayName,
    dueDateUtc: job.dueDateUtc,
    createdAtUtc: job.createdAtUtc,
    detailsPath: `/jobs?jobId=${job.jobId}`,
    pendingTargetDepartmentId: pendingTarget?.departmentId ?? null,
  }
}

function toPendingInternalJobRow(job: JobSummary): IncomingRequestRow {
  return {
    id: job.jobId,
    displayNumber: formatJobDisplayNumber(job),
    kind: 'internal',
    statusDomain: 'job',
    title: job.title,
    status: job.status,
    priority: job.priority,
    departmentName: job.ownerDepartmentName,
    createdBy: job.createdByDisplayName,
    dueDateUtc: job.dueDateUtc,
    createdAtUtc: job.createdAtUtc,
    detailsPath: `/jobs?jobId=${job.jobId}`,
    pendingTargetDepartmentId: null,
  }
}

export function IncomingRequestsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const locale = getLocale(i18n.language)
  const { user } = useAuth()
  const isManagerLike = user?.role === 'Manager' || user?.role === 'SystemAdmin'
  const [tasks, setTasks] = useState<Task[]>([])
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [incomingPage, setIncomingPage] = useState(1)
  const [incomingPageSize, setIncomingPageSize] = useState(25)
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | null>(null)
  const currentStatusFilter = getIncomingStatusFilter(searchParams.get('status'))
  const currentKindFilter = getIncomingKindFilter(searchParams.get('kind'))

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.getTasks('all'),
      api.getJobs('my-department'),
    ])
      .then(([taskList, jobList]) => {
        if (cancelled) return
        setTasks(taskList)
        setJobs(jobList)
        setError(null)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : t('common.error')) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [t])

  const reload = async () => {
    try {
      const [taskList, jobList] = await Promise.all([
        api.getTasks('all'),
        api.getJobs('my-department'),
      ])
      setTasks(taskList)
      setJobs(jobList)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const handleApproveOwner = async (jobId: string) => {
    setError(null)
    try {
      await api.approveJobOwner(jobId)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const handleApproveTarget = async (jobId: string, departmentId: string) => {
    setError(null)
    try {
      await api.approveJobTarget(jobId, departmentId)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const handleCancel = (jobId: string) => {
    setPromptDialog({
      title: t('jobs.actions.cancelReason', 'İptal Nedeni'),
      onConfirm: async (reason) => {
        try {
          await api.cancelJob(jobId, reason)
          await reload()
        } catch (err) {
          setError(err instanceof Error ? err.message : t('common.error'))
        }
      },
    })
  }

  const rows = useMemo(() => {
    const internalRows = tasks
      .filter(task => task.jobRequestType === 'InternalUnit')
      .map(toInternalRow)
    const pendingInternalJobRows = jobs
      .filter(job => job.requestType === 'InternalUnit' && job.status === 'PendingOwnerApproval')
      .map(toPendingInternalJobRow)
    const externalRows = jobs
      .filter(job => job.requestType === 'ExternalUnit')
      .map(toExternalRow)

    return [...internalRows, ...pendingInternalJobRows, ...externalRows].sort((a, b) => {
      const aTime = a.createdAtUtc ? new Date(a.createdAtUtc).getTime() : 0
      const bTime = b.createdAtUtc ? new Date(b.createdAtUtc).getTime() : 0
      return bTime - aTime
    })
  }, [jobs, tasks])

  const visibleRows = useMemo(() => rows
    .filter(row => matchesStatusFilter(row, currentStatusFilter))
    .filter(row => matchesKindFilter(row, currentKindFilter)),
  [currentKindFilter, currentStatusFilter, rows])

  const { sortKey: incomingSortKey, sortDir: incomingSortDir, toggleSort: _toggleIncomingSort, sortItems: sortIncoming } = useSortable()
  const { filters: incomingFilters, setFilter: setIncomingFilter, matchesFilters: incomingMatchesFilters } = useColumnFilters()

  const columnFilteredRows = useMemo(
    () => visibleRows.filter(r => incomingMatchesFilters(r)),
    [visibleRows, incomingMatchesFilters],
  )

  useEffect(() => { setIncomingPage(1) }, [incomingFilters])

  const toggleIncomingSort = (key: string) => {
    _toggleIncomingSort(key)
    setIncomingPage(1)
  }

  const pagedRows = useMemo(
    () => sortIncoming(columnFilteredRows).slice((incomingPage - 1) * incomingPageSize, incomingPage * incomingPageSize),
    [columnFilteredRows, incomingPage, incomingPageSize, sortIncoming],
  )

  const setStatusFilter = (filter: IncomingStatusFilter) => {
    const nextParams = new URLSearchParams(searchParams)
    if (filter === 'pending-approval') nextParams.delete('status')
    else nextParams.set('status', filter)
    setSearchParams(nextParams)
    setIncomingPage(1)
  }

  const setKindFilter = (filter: IncomingKindFilter) => {
    const nextParams = new URLSearchParams(searchParams)
    if (filter === 'all') nextParams.delete('kind')
    else nextParams.set('kind', filter)
    setSearchParams(nextParams)
    setIncomingPage(1)
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{t('nav.incomingRequests', 'Birime Gelen Talepler')}</div>
            <h1 className="page-title">{t('nav.incomingRequestsAll', 'Birime Gelen Tüm Talepler')}</h1>
            <p className="page-subtitle">{t('incomingRequests.subtitle', 'Birim içi ve birim dışı gelen talepleri tek listede takip edin.')}</p>
          </div>
        </div>
      </header>

      <nav className="scope-chips" aria-label={t('nav.incomingRequests', 'Birime Gelen Talepler')}>
        {STATUS_FILTERS.map(filter => (
          <button
            key={filter.value}
            type="button"
            className={`scope-chip ${getScopeChipColorClass(filter.value)}${filter.value === currentStatusFilter ? ' active' : ''}`}
            onClick={() => setStatusFilter(filter.value)}
          >
            {t(filter.labelKey, filter.fallback)}
          </button>
        ))}
        <span className="scope-chip-divider" aria-hidden="true">|</span>
        {KIND_FILTERS.map(filter => (
          <button
            key={filter.value}
            type="button"
            className={`scope-chip scope-chip--${filter.value}${filter.value === currentKindFilter ? ' active' : ''}`}
            onClick={() => setKindFilter(filter.value)}
          >
            {t(filter.labelKey, filter.fallback)}
          </button>
        ))}
      </nav>

      {error ? <div className="error">{error}</div> : null}

      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : columnFilteredRows.length === 0 ? (
        <section className="section-card">
          <div className="empty-state">{t('incomingRequests.empty', 'Birime gelen talep bulunmuyor.')}</div>
        </section>
      ) : (
        <section className="section-card desktop-page-fill">
          <div className="table-wrap desktop-panel-scroll">
            <table className="data-table jobs-table">
              <thead>
                <tr>
                  <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                  <th>{t('incomingRequests.columns.requestNo', 'Talep No')}</th>
                  <FilterableTh filterKey="createdAtUtc" filterValue={incomingFilters['createdAtUtc'] ?? ''} onFilter={setIncomingFilter} sortKey="createdAtUtc" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('incomingRequests.columns.requestDate', 'Talep Tarihi')}</FilterableTh>
                  <FilterableTh filterKey="createdBy" filterValue={incomingFilters['createdBy'] ?? ''} onFilter={setIncomingFilter} sortKey="createdByDisplayName" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('tasks.columns.createdBy', 'Oluşturan')}</FilterableTh>
                  <FilterableTh filterKey="title" filterValue={incomingFilters['title'] ?? ''} onFilter={setIncomingFilter} sortKey="title" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('jobs.columns.title', 'Başlık')}</FilterableTh>
                  <FilterableTh filterKey="status" filterValue={incomingFilters['status'] ?? ''} onFilter={setIncomingFilter} sortKey="status" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('jobs.columns.status', 'Durum')}</FilterableTh>
                  <FilterableTh filterKey="priority" filterValue={incomingFilters['priority'] ?? ''} onFilter={setIncomingFilter} sortKey="priority" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('jobs.columns.priority', 'Öncelik')}</FilterableTh>
                  <FilterableTh filterKey="dueDateUtc" filterValue={incomingFilters['dueDateUtc'] ?? ''} onFilter={setIncomingFilter} sortKey="dueDateUtc" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('jobs.columns.dueDate', 'Son Tarih')}</FilterableTh>
                  <th>{t('jobs.columns.actions', 'İşlemler')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, index) => (
                  <tr key={`${row.kind}-${row.id}`}>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(incomingPage - 1) * incomingPageSize + index + 1}</td>
                    <td className="font-mono text-xs text-slate-500">{row.displayNumber}</td>
                    <td>{formatDateTime(row.createdAtUtc, locale)}</td>
                    <td>{row.createdBy ?? '—'}</td>
                    <td className="font-semibold">{row.title}</td>
                    <td><StatusPill>{row.statusDomain === 'task' ? getTaskStatusLabel(t, row.status) : getJobStatusLabel(t, row.status)}</StatusPill></td>
                    <td>{getPriorityLabel(t, row.priority)}</td>
                    <td>{formatDateTime(row.dueDateUtc, locale)}</td>
                    <td className="actions-cell">
                      <Button size="sm" variant="secondary" onClick={() => navigate(row.detailsPath)} className="gap-1.5">
                        {t('jobs.actions.details', 'Detaylar')}
                        <ArrowRight className="size-3.5" />
                      </Button>
                      {isManagerLike && row.statusDomain === 'job' && row.status === 'PendingOwnerApproval' && (
                        <Button size="sm" variant="success" onClick={() => handleApproveOwner(row.id)}>
                          {t('jobs.actions.approveOwner', 'Onayla')}
                        </Button>
                      )}
                      {isManagerLike && row.statusDomain === 'job' && row.status === 'PendingExternalApproval' && row.pendingTargetDepartmentId && (
                        <Button size="sm" variant="success" onClick={() => handleApproveTarget(row.id, row.pendingTargetDepartmentId!)}>
                          {t('jobs.actions.approveTarget', 'Onayla')}
                        </Button>
                      )}
                      {isManagerLike && row.statusDomain === 'job' && row.status === 'Active' && (
                        <Button size="sm" variant="destructive" onClick={() => handleCancel(row.id)}>
                          {t('jobs.actions.cancel', 'İptal')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            totalCount={columnFilteredRows.length}
            pageSize={incomingPageSize}
            currentPage={incomingPage}
            onPageSizeChange={setIncomingPageSize}
            onPageChange={setIncomingPage}
          />
        </section>
      )}
      <PromptDialog state={promptDialog} onClose={() => setPromptDialog(null)} />
    </div>
  )
}
