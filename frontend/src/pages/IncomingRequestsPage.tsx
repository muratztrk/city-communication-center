import { ArrowRight, Search } from 'lucide-react'
import { DueDatePill } from '../components/ui/due-date-pill'
import { DateCell } from '../components/ui/date-cell'

function getScopeChipColorClass(value: string): string {
  if (value === 'pending-approval') return 'scope-chip--pending'
  if (value === 'approved') return 'scope-chip--approved'
  if (value === 'completed') return 'scope-chip--completed'
  if (value === 'cancelled') return 'scope-chip--rejected'
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
import { getActiveDepartmentId } from '../api/http'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import type { ConfirmDialogState } from '../components/ui/confirm-dialog'
import { PromptDialog } from '../components/ui/prompt-dialog'
import type { PromptDialogState } from '../components/ui/prompt-dialog'
import { TablePagination } from '../components/ui/table-pagination'
import { useAuth } from '../context/AuthContext'
import type { JobSummary, Task, User } from '../types/platform'
import { getLocale, getPriorityColorClass, getPriorityLabel, getTaskStatusLabel } from '../utils/localization'

type IncomingStatusFilter = 'pending-approval' | 'approved' | 'completed' | 'cancelled' | 'all'
type IncomingKindFilter = 'internal' | 'external' | 'all'

const STATUS_FILTERS: { value: IncomingStatusFilter; labelKey: string; fallback: string }[] = [
  { value: 'pending-approval', labelKey: 'jobs.scopes.pendingApprovalRequests', fallback: 'Onay Bekleyen Talepler' },
  { value: 'approved', labelKey: 'jobs.scopes.departmentPool', fallback: 'Onaylanmış Talepler' },
  { value: 'completed', labelKey: 'jobs.scopes.completed', fallback: 'Tamamlanmış Talepler' },
  { value: 'cancelled', labelKey: 'jobs.scopes.rejected', fallback: 'İptal/İade Talepler' },
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
  /** For Active external jobs where the active department is a target with no tasks yet: the target dept to assign staff for */
  assignTargetDepartmentId: string | null
  approvedAtUtc: string | null
  completedAtUtc: string | null
  updatedAtUtc: string | null
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
  return value === 'approved' || value === 'completed' || value === 'cancelled' || value === 'all' ? value : 'pending-approval'
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

  if (filter === 'cancelled') {
    return row.status === 'Cancelled' || row.status === 'Rejected' || row.status === 'RevisionRequested'
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
    assignTargetDepartmentId: null,
    approvedAtUtc: task.createdAtUtc ?? null,
    completedAtUtc: task.completedAtUtc ?? null,
    updatedAtUtc: task.updatedAtUtc ?? null,
  }
}

function toExternalRow(job: JobSummary, activeDeptId: string | null): IncomingRequestRow {
  const ownerDept = job.departments?.find(d => d.role === 'Owner')
  // Active external job that landed in this department's pool and still needs staff assigned
  const activeTarget = activeDeptId
    ? job.departments?.find(d => d.role === 'Target' && d.departmentId === activeDeptId)
    : undefined
  const assignTargetDepartmentId = activeTarget && job.status === 'Active' && job.taskCount === 0
    ? activeTarget.departmentId
    : null
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
    assignTargetDepartmentId,
    approvedAtUtc: ownerDept?.decidedAtUtc ?? null,
    completedAtUtc: job.completedAtUtc,
    updatedAtUtc: job.updatedAtUtc ?? null,
  }
}

/** An external job belongs in *this department's* incoming list only when the active
 *  department is one of its targets AND the owner department has already approved it.
 *  This keeps a department's own outgoing requests out of its incoming list, and hides
 *  external requests that are still waiting on owner approval. */
function isIncomingExternalForActiveDept(job: JobSummary, activeDeptId: string | null): boolean {
  const ownerApproved = job.departments?.some(d => d.role === 'Owner' && d.approvalStatus === 'Approved') ?? false
  if (!ownerApproved) return false
  if (!activeDeptId) return true // admins / no active department: show all owner-approved external requests
  return job.departments?.some(d => d.role === 'Target' && d.departmentId === activeDeptId) ?? false
}

function toPendingInternalJobRow(job: JobSummary): IncomingRequestRow {
  const ownerDept = job.departments?.find(d => d.role === 'Owner')
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
    assignTargetDepartmentId: null,
    approvedAtUtc: ownerDept?.decidedAtUtc ?? null,
    completedAtUtc: job.completedAtUtc,
    updatedAtUtc: job.updatedAtUtc ?? null,
  }
}

export function IncomingRequestsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const locale = getLocale(i18n.language)
  const { user } = useAuth()
  const isManagerLike = user?.role === 'Manager' || user?.role === 'SystemAdmin'
  const [activeDeptId, setActiveDeptIdState] = useState(() => getActiveDepartmentId())
  const [tasks, setTasks] = useState<Task[]>([])
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [incomingPage, setIncomingPage] = useState(1)
  const [incomingPageSize, setIncomingPageSize] = useState(10)
  const [filterYear, setFilterYear] = useState('')
  const [searchText, setSearchText] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | null>(null)
  const [cancelReturnModal, setCancelReturnModal] = useState<{ row: IncomingRequestRow } | null>(null)
  const [departmentUsers, setDepartmentUsers] = useState<User[]>([])
  const [staffAssignModal, setStaffAssignModal] = useState<{
    jobId: string
    approvalType: 'owner' | 'assign'
    selectedUserIds: string[]
  } | null>(null)
  const currentStatusFilter = getIncomingStatusFilter(searchParams.get('status'))
  const currentKindFilter = getIncomingKindFilter(searchParams.get('kind'))

  useEffect(() => {
    const handler = () => setActiveDeptIdState(getActiveDepartmentId())
    window.addEventListener('activeDepartmentChanged', handler)
    return () => window.removeEventListener('activeDepartmentChanged', handler)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.getTasks('all'),
      api.getJobs('my-department'),
      api.getUsers(),
    ])
      .then(([taskList, jobList, userList]) => {
        if (cancelled) return
        setTasks(taskList)
        setJobs(jobList)
        const currentDeptId = getActiveDepartmentId() ?? user?.departmentId
        setDepartmentUsers(userList.filter(u => u.isActive && (u.departmentId === currentDeptId || u.departments?.some(d => d.departmentId === currentDeptId)) && u.roleCode === 'Staff'))
        setError(null)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : t('common.error')) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [t, activeDeptId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleApproveOwner = (jobId: string) => {
    setStaffAssignModal({ jobId, approvalType: 'owner', selectedUserIds: [] })
  }

  // One-step external flow: the job is already Active in this department's pool —
  // just assign staff (create tasks), no approval call needed.
  const handleAssignStaff = (jobId: string) => {
    setStaffAssignModal({ jobId, approvalType: 'assign', selectedUserIds: [] })
  }

  const handleStaffAssignConfirm = async () => {
    if (!staffAssignModal) return
    const { jobId, approvalType, selectedUserIds } = staffAssignModal
    setStaffAssignModal(null)
    setError(null)
    try {
      if (approvalType === 'owner') {
        await api.approveJobOwner(jobId)
      }
      if (selectedUserIds.length > 0) {
        const jobDetail = await api.getJobById(jobId)
        const taskIds = jobDetail.tasks.map(t => t.taskId)
        if (taskIds.length === 0) {
          await Promise.all(
            selectedUserIds.map(userId =>
              api.createTask({
                jobId,
                title: jobDetail.title,
                description: jobDetail.description,
                priority: jobDetail.priority,
                startDateUtc: jobDetail.startDateUtc,
                dueDateUtc: null,
                assignedUserId: userId,
              })
            )
          )
        } else {
          await Promise.all(
            taskIds.map((taskId, i) =>
              api.assignTask(taskId, undefined, selectedUserIds[i % selectedUserIds.length])
            )
          )
        }
      }
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const handleApproveClose = (taskId: string) => {
    setConfirmDialog({
      message: t('tasks.approveCloseConfirm', 'Bu görevi tamamlandı olarak onaylamak istediğinizden emin misiniz?'),
      variant: 'primary',
      confirmLabel: t('common.approve', 'Onayla'),
      onConfirm: async () => {
        setError(null)
        try {
          await api.approveTaskClose(taskId)
          await reload()
        } catch (err) {
          setError(err instanceof Error ? err.message : t('common.error'))
        }
      },
    })
  }

  const openCancelReturn = (row: IncomingRequestRow) => {
    if (row.statusDomain === 'task') {
      setPromptDialog({
        title: t('jobs.actions.cancelReason', 'İptal Nedeni'),
        onConfirm: async (reason) => {
          setError(null)
          try {
            await api.cancelTask(row.id, reason)
            await reload()
          } catch (err) {
            setError(err instanceof Error ? err.message : t('common.error'))
          }
        },
      })
    } else if (row.status === 'Active' || row.status === 'Waiting' || row.status === 'Assigned' || row.status === 'InProgress' || row.status === 'PendingCloseApproval') {
      setCancelReturnModal({ row })
    } else {
      // Pending approval — reject with reason
      setPromptDialog({
        title: t('jobs.actions.rejectReason', 'Reddetme Nedeni'),
        onConfirm: async (reason) => {
          setError(null)
          try {
            if (row.status === 'PendingOwnerApproval') {
              await api.rejectJobOwner(row.id, reason)
            }
            await reload()
          } catch (err) {
            setError(err instanceof Error ? err.message : t('common.error'))
          }
        },
      })
    }
  }

  const rows = useMemo(() => {
    const internalTasks = tasks.filter(task => task.jobRequestType === 'InternalUnit')
    const internalRows = internalTasks.map(toInternalRow)
    // jobIds that already have task rows — skip the job-level row for these
    const jobIdsWithTasks = new Set(internalTasks.map(t => t.jobId))
    const pendingInternalJobRows = jobs
      .filter(job => job.requestType === 'InternalUnit' && !jobIdsWithTasks.has(job.jobId))
      .map(toPendingInternalJobRow)
    const externalRows = jobs
      .filter(job => job.requestType === 'ExternalUnit' && isIncomingExternalForActiveDept(job, activeDeptId))
      .map(job => toExternalRow(job, activeDeptId))

    return [...internalRows, ...pendingInternalJobRows, ...externalRows].sort((a, b) => {
      const aTime = a.createdAtUtc ? new Date(a.createdAtUtc).getTime() : 0
      const bTime = b.createdAtUtc ? new Date(b.createdAtUtc).getTime() : 0
      return bTime - aTime
    })
  }, [jobs, tasks, activeDeptId])

  const availableYears = useMemo(() => {
    const years = new Set<string>()
    for (const row of rows) {
      const y = row.createdAtUtc?.slice(0, 4)
      if (y) years.add(y)
    }
    return [...years].sort().reverse()
  }, [rows])

  const visibleRows = useMemo(() => {
    let result = rows
      .filter(row => matchesStatusFilter(row, currentStatusFilter))
      .filter(row => matchesKindFilter(row, currentKindFilter))
    if (filterYear) result = result.filter(row => row.createdAtUtc?.startsWith(filterYear))
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      result = result.filter(row => row.title.toLowerCase().includes(q))
    }
    return result
  }, [currentKindFilter, currentStatusFilter, rows, filterYear, searchText])

  useEffect(() => { setIncomingPage(1) }, [filterYear, searchText])

  const { sortKey: incomingSortKey, sortDir: incomingSortDir, toggleSort: _toggleIncomingSort, sortItems: sortIncoming } = useSortable()
  const { filters: incomingFilters, setFilter: setIncomingFilter, clearFilters: clearIncomingFilters, matchesFilters: incomingMatchesFilters } = useColumnFilters()

  const columnFilteredRows = useMemo(
    () => visibleRows.filter(row => incomingMatchesFilters(row, (key, r) => {
      if (key === 'status') return r.statusDomain === 'task' ? getTaskStatusLabel(t, r.status) : getJobStatusLabel(t, r.status)
      if (key === 'priority') return getPriorityLabel(t, r.priority)
      if (key === 'createdAtUtc') return formatDateTime(r.createdAtUtc, locale)
      if (key === 'dueDateUtc') return formatDateTime(r.dueDateUtc, locale)
      if (key === 'approvedAtUtc') return formatDateTime(r.approvedAtUtc, locale)
      if (key === 'completedAtUtc') return formatDateTime(r.completedAtUtc, locale)
      if (key === 'updatedAtUtc') return formatDateTime(r.updatedAtUtc, locale)
      return String((r as unknown as Record<string, unknown>)[key] ?? '')
    })),
    [visibleRows, incomingMatchesFilters, t, locale],
  )

  useEffect(() => { setIncomingPage(1) }, [incomingFilters])

  useEffect(() => {
    queueMicrotask(() => {
      setIncomingPage(1)
      clearIncomingFilters()
      setConfirmDialog(null)
      setPromptDialog(null)
      setCancelReturnModal(null)
      setStaffAssignModal(null)
      setError(null)
    })
  }, [activeDeptId, clearIncomingFilters])

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
        <div className="scope-chips-filters">
          <div className="scope-chip-search-wrap">
            <Search className="size-3 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              className="scope-chip-search-input"
              placeholder={t('common.search', 'Ara...')}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
          </div>
          <select
            className="scope-chip-year-select"
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
          >
            <option value="">{t('common.yearSelect', 'Yıl Seçimi')}</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
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
            <table className="data-table jobs-table data-table--zebra">
              <thead>
                <tr>
                  <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                  <th>{t('incomingRequests.columns.requestNo', 'Talep No')}</th>
                  <FilterableTh filterKey="createdAtUtc" filterValue={incomingFilters['createdAtUtc'] ?? ''} onFilter={setIncomingFilter} sortKey="createdAtUtc" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('incomingRequests.columns.requestDate', 'Talep Tarihi')}</FilterableTh>
                  <FilterableTh filterKey="createdBy" filterValue={incomingFilters['createdBy'] ?? ''} onFilter={setIncomingFilter} sortKey="createdBy" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('tasks.columns.createdBy', 'Oluşturan')}</FilterableTh>
                  <FilterableTh filterKey="title" filterValue={incomingFilters['title'] ?? ''} onFilter={setIncomingFilter} sortKey="title" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('jobs.columns.title', 'Başlık')}</FilterableTh>
                  <FilterableTh filterKey="dueDateUtc" filterValue={incomingFilters['dueDateUtc'] ?? ''} onFilter={setIncomingFilter} sortKey="dueDateUtc" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('jobs.columns.dueDate', 'Son Tarih')}</FilterableTh>
                  {currentStatusFilter === 'approved' && <FilterableTh filterKey="approvedAtUtc" filterValue={incomingFilters['approvedAtUtc'] ?? ''} onFilter={setIncomingFilter} sortKey="approvedAtUtc" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('incomingRequests.columns.approvedAt', 'Onay Tarihi')}</FilterableTh>}
                  {currentStatusFilter === 'completed' && <FilterableTh filterKey="completedAtUtc" filterValue={incomingFilters['completedAtUtc'] ?? ''} onFilter={setIncomingFilter} sortKey="completedAtUtc" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('incomingRequests.columns.completedAt', 'Tamamlanma Tarihi')}</FilterableTh>}
                  {currentStatusFilter === 'cancelled' && <FilterableTh filterKey="updatedAtUtc" filterValue={incomingFilters['updatedAtUtc'] ?? ''} onFilter={setIncomingFilter} sortKey="updatedAtUtc" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('incomingRequests.columns.cancelledAt', 'İptal/İade Tarihi')}</FilterableTh>}
                  <th>{t('jobs.columns.actions', 'İşlemler')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, index) => (
                  <tr key={`${row.kind}-${row.id}`}>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(incomingPage - 1) * incomingPageSize + index + 1}</td>
                    <td className="font-mono text-xs text-slate-500">
                      <div>{row.displayNumber}</div>
                      <div className={`font-sans text-[0.7rem] font-bold ${getPriorityColorClass(row.priority)}`}>({getPriorityLabel(t, row.priority)})</div>
                    </td>
                    <td><DateCell value={row.createdAtUtc} locale={locale} /></td>
                    <td>{row.createdBy ?? '—'}</td>
                    <td className="font-semibold">{row.title}</td>
                    <td><DueDatePill value={row.dueDateUtc} locale={locale} /></td>
                    {currentStatusFilter === 'approved' && <td><DateCell value={row.approvedAtUtc} locale={locale} /></td>}
                    {currentStatusFilter === 'completed' && <td><DateCell value={row.completedAtUtc} locale={locale} /></td>}
                    {currentStatusFilter === 'cancelled' && <td><DateCell value={row.updatedAtUtc} locale={locale} /></td>}
                    <td className="actions-cell">
                      <div className="flex gap-3">
                        {/* Detaylar — her zaman */}
                        <Button size="sm" variant="secondary" onClick={() => navigate(row.detailsPath)} className="gap-1.5">
                          {t('jobs.actions.details', 'Detaylar')}
                          <ArrowRight className="size-3.5" />
                        </Button>
                        {/* Onayla — onay bekleyen iş satırlarında */}
                        {isManagerLike && row.statusDomain === 'job' && row.status === 'PendingOwnerApproval' && (
                          <Button size="sm" variant="success" onClick={() => handleApproveOwner(row.id)}>
                            {t('jobs.actions.approveOwner', 'Onayla')}
                          </Button>
                        )}
                        {/* Personel Ata — birime düşen (Active) birim dışı taleplerde */}
                        {isManagerLike && row.statusDomain === 'job' && row.assignTargetDepartmentId && (
                          <Button size="sm" variant="success" onClick={() => handleAssignStaff(row.id)}>
                            {t('jobs.actions.assignStaff', 'Personel Ata')}
                          </Button>
                        )}
                        {/* Onayla — kapanış onayı bekleyen görevlerde */}
                        {isManagerLike && row.statusDomain === 'task' && row.status === 'PendingCloseApproval' && (
                          <Button size="sm" variant="success" onClick={() => handleApproveClose(row.id)}>
                            {t('tasks.actions.approveClose', 'Onayla')}
                          </Button>
                        )}
                        {/* İptal/İade — onay bekleyen, onaylanmış ve aktif iş/görev satırlarında */}
                        {isManagerLike && (
                          row.status === 'PendingOwnerApproval' ||
                          row.status === 'PendingExternalApproval' ||
                          row.status === 'Active' ||
                          row.status === 'Waiting' ||
                          row.status === 'Assigned' ||
                          row.status === 'InProgress' ||
                          row.status === 'PendingCloseApproval'
                        ) && (
                          <Button size="sm" variant="destructive" onClick={() => openCancelReturn(row)}>
                            {t('jobs.actions.cancelOrReturn', 'İptal/İade')}
                          </Button>
                        )}
                      </div>
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
      {cancelReturnModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCancelReturnModal(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-[var(--radius-2xl)] bg-white p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="mb-1 text-base font-bold text-slate-950">{t('jobs.actions.cancelOrReturn', 'İptal / İade')}</h3>
            <p className="mb-5 text-sm text-slate-600">{t('jobs.actions.cancelOrReturnHelp', 'Bu talep için ne yapmak istiyorsunuz?')}</p>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  const { row } = cancelReturnModal
                  setCancelReturnModal(null)
                  setPromptDialog({
                    title: t('jobs.actions.cancelReason', 'İptal Nedeni'),
                    onConfirm: async (reason) => {
                      setError(null)
                      try {
                        await api.cancelJob(row.id, reason)
                        await reload()
                      } catch (err) {
                        setError(err instanceof Error ? err.message : t('common.error'))
                      }
                    },
                  })
                }}
              >
                {t('jobs.actions.cancel', 'İptal Et')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const { row } = cancelReturnModal
                  setCancelReturnModal(null)
                  setPromptDialog({
                    title: t('jobs.actions.returnReason', 'İade Nedeni'),
                    onConfirm: async (reason) => {
                      setError(null)
                      try {
                        await api.returnJob(row.id, reason)
                        await reload()
                      } catch (err) {
                        setError(err instanceof Error ? err.message : t('common.error'))
                      }
                    },
                  })
                }}
              >
                {t('jobs.actions.return', 'İade Et')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCancelReturnModal(null)}>
                {t('common.cancel', 'Vazgeç')}
              </Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
      <PromptDialog state={promptDialog} onClose={() => setPromptDialog(null)} />
      {staffAssignModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setStaffAssignModal(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-[var(--radius-2xl)] bg-white p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="mb-1 text-base font-bold text-slate-950">
              {staffAssignModal.approvalType === 'assign'
                ? t('jobs.actions.assignStaff', 'Personel Ata')
                : t('jobs.actions.approveAndAssign', 'Onayla ve Personel Ata')}
            </h3>
            <p className="mb-4 text-sm text-slate-600">
              {staffAssignModal.approvalType === 'assign'
                ? t('jobs.actions.assignStaffHelp', 'Bu talebe görev atayacağınız personeli seçin. Seçim zorunlu değildir.')
                : t('jobs.actions.approveAndAssignHelp', 'Görevi atamak istediğiniz personeli seçin. Seçim zorunlu değildir.')}
            </p>
            {departmentUsers.length === 0 ? (
              <p className="mb-4 text-sm text-slate-400">{t('jobs.actions.noStaffFound', 'Birimde personel bulunamadı.')}</p>
            ) : (
              <div className="mb-4 flex max-h-48 flex-col gap-1 overflow-y-auto">
                {departmentUsers.map(u => (
                  <label key={u.userId} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="size-4 rounded"
                      checked={staffAssignModal.selectedUserIds.includes(u.userId)}
                      onChange={e => {
                        setStaffAssignModal(prev => {
                          if (!prev) return prev
                          const ids = e.target.checked
                            ? [...prev.selectedUserIds, u.userId]
                            : prev.selectedUserIds.filter(id => id !== u.userId)
                          return { ...prev, selectedUserIds: ids }
                        })
                      }}
                    />
                    <span className="text-sm text-slate-800">{u.displayName}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button type="button" variant="success" onClick={handleStaffAssignConfirm}>
                {staffAssignModal.approvalType === 'assign' ? t('jobs.actions.assign', 'Ata') : t('common.approve', 'Onayla')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setStaffAssignModal(null)}>
                {t('common.cancel', 'Vazgeç')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
