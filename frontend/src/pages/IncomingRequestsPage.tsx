import { ArrowRight, Search, X } from 'lucide-react'
import { DueDatePill } from '../components/ui/due-date-pill'
import { DateCell } from '../components/ui/date-cell'
import { DateTimePicker } from '../components/ui/date-time-picker'

function getScopeChipColorClass(value: string): string {
  if (value === 'pending-approval') return 'scope-chip--pending'
  if (value === 'approved') return 'scope-chip--approved'
  if (value === 'overdue') return 'scope-chip--in-progress'
  if (value === 'completed') return 'scope-chip--completed'
  if (value === 'cancelled') return 'scope-chip--rejected'
  if (value === 'all') return 'scope-chip--all'
  return ''
}

// Talebin oluşturulma günü = bugün mü? (Onay Bekleyen "Yeni" rozeti, card 607 — Görevlerim ile aynı mantık)
function isCreatedToday(value: string | null | undefined): boolean {
  if (!value) return false
  const created = new Date(value)
  if (Number.isNaN(created.getTime())) return false
  const now = new Date()
  return created.getFullYear() === now.getFullYear()
    && created.getMonth() === now.getMonth()
    && created.getDate() === now.getDate()
}
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSortable } from '../hooks/useSortable'
import { FilterableTh } from '../components/ui/FilterableTh'
import { StatusPill } from '../components/ui/status-pill'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { getActiveDepartmentId } from '../api/http'
import { Button } from '../components/ui/button'
import { TablePagination } from '../components/ui/table-pagination'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { useAuth } from '../context/AuthContext'
import type { JobSummary, Task, SocialMessage } from '../types/platform'
import { getJobStatusTone, getLocale, getPriorityColorClass, getPriorityLabel, getStatusPillClass, getTaskDisplayStatus, getTaskStatusTone } from '../utils/localization'
import { formatCitizenRequestNumber, getCitizenRequestStatusLabel, isCitizenRequestJob } from '../utils/citizenRequests'
import { getExternalUnitTargetDisplayStatus } from '../utils/externalUnitRequests'
import { ChannelIcon } from '../components/ui/channel-icon'
import { ReporterDepartmentCell } from '../components/ui/ReporterDepartmentCell'
import { isReporterCreated, reporterGridValueClass, hasConcreteNumberDisplay } from '../utils/reporterHighlight'
import { JobsPage } from './JobsPage'
import { hasCitizenRequestManagerRole } from '../utils/roleAccess'
import { matchesBannerSearch } from '../utils/bannerSearch'

type IncomingStatusFilter = 'pending-approval' | 'overdue' | 'approved' | 'completed' | 'cancelled' | 'all'
type IncomingKindFilter = 'all'

const STATUS_FILTERS: { value: IncomingStatusFilter; labelKey: string; fallback: string }[] = [
  { value: 'pending-approval', labelKey: 'jobs.scopes.pendingApprovalRequests', fallback: 'Onay Bekleyen Talepler' },
  { value: 'overdue', labelKey: 'jobs.scopes.overdue', fallback: 'Son Tarihi Geçmiş Talepler' },
  { value: 'approved', labelKey: 'jobs.scopes.departmentPool', fallback: 'Onaylanmış Talepler' },
  { value: 'completed', labelKey: 'jobs.scopes.completed', fallback: 'Tamamlanmış Talepler' },
  { value: 'cancelled', labelKey: 'jobs.scopes.rejected', fallback: 'İptal Talepler' },
  { value: 'all', labelKey: 'jobs.scopes.all', fallback: 'Tümü' },
]

const KIND_FILTERS: { value: IncomingKindFilter; labelKey: string; fallback: string }[] = [
  { value: 'all', labelKey: 'nav.incomingRequestsAll', fallback: 'Birime Gelen Tüm Talepler' },
]

type IncomingRequestRow = {
  id: string
  jobId: string
  displayNumber: string
  kind: 'internal' | 'external'
  statusDomain: 'task' | 'job'
  title: string
  status: string
  priority: string
  departmentName: string | null
  createdBy: string | null
  taskOwnerDisplayName: string | null
  dueDateUtc: string | null
  createdAtUtc: string | null
  detailsPath: string
  /** For Active external jobs where the active department is a target with no tasks yet: the target dept to assign staff for */
  assignTargetDepartmentId: string | null
  /** For coordinated external jobs awaiting this target department's approval */
  pendingTargetApprovalDepartmentId: string | null
  approvedAtUtc: string | null
  completedAtUtc: string | null
  updatedAtUtc: string | null
  createdByRoleCode: string | null
  cancelReturnStatus?: string
  sourceChannel?: string | null
  isCitizenRequest?: boolean
  taskCount?: number
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

function getIncomingStatusLabel(t: ReturnType<typeof useTranslation>['t'], row: IncomingRequestRow): string {
  if (row.statusDomain === 'task') {
    return getTaskDisplayStatus(t, { currentStatus: row.status, dueDateUtc: row.dueDateUtc })
  }

  if (row.status === 'Completed') return t('jobs.statusLabel.completed', 'Tamamlanmış')
  if (row.status === 'Cancelled') return t('jobs.statusLabel.cancelled', 'İptal')
  if (row.status === 'Rejected') return t('jobs.statusLabel.rejected', 'Reddedildi')
  if (row.status === 'RevisionRequested') return t('jobs.statusLabel.returned', 'İade Edildi')
  if (row.dueDateUtc != null && new Date(row.dueDateUtc).getTime() < Date.now()) {
    return t('jobs.statusLabel.overdue', 'Son Tarihi Geçmiş')
  }
  if (row.isCitizenRequest) {
    const normalizedStatus = row.status === 'PendingExternalApproval' ? 'Active' : row.status
    return getCitizenRequestStatusLabel(t, {
      status: normalizedStatus,
      taskCount: row.taskCount ?? 0,
      dueDateUtc: row.dueDateUtc,
    })
  }
  if (row.kind === 'external') {
    const externalTargetStatus = getExternalUnitTargetDisplayStatus(t, {
      requestType: 'ExternalUnit',
      status: row.status,
      taskCount: row.taskCount,
    })
    if (externalTargetStatus) return externalTargetStatus
  }
  if (row.status === 'Active') return t('jobs.statusLabel.inProgress', 'Yapılmakta')
  return getJobStatusLabel(t, row.status)
}

function getIncomingStatusPillClass(row: IncomingRequestRow): string {
  const tone = row.statusDomain === 'task'
    ? getTaskStatusTone({ currentStatus: row.status, dueDateUtc: row.dueDateUtc })
    : getJobStatusTone({ status: row.status, dueDateUtc: row.dueDateUtc })
  return getStatusPillClass(tone)
}

function getIncomingStatusFilter(value: string | null): IncomingStatusFilter {
  return value === 'overdue' || value === 'approved' || value === 'completed' || value === 'cancelled' || value === 'all' ? value : 'pending-approval'
}

function getIncomingKindFilter(): IncomingKindFilter {
  return 'all'
}

function matchesStatusFilter(row: IncomingRequestRow, filter: IncomingStatusFilter): boolean {
  if (filter === 'all') return true
  const isOverdue = row.dueDateUtc != null && new Date(row.dueDateUtc).getTime() < Date.now()
  const isClosed = row.status === 'Completed' || row.status === 'Cancelled' || row.status === 'Rejected' || row.status === 'RevisionRequested'

  if (filter === 'pending-approval') {
    // Son tarihi geçmiş olsa bile onay bekleyen kayıtlar bu görünümde kalır (dashboard kartlarıyla uyum).
    return row.status === 'PendingOwnerApproval' || row.status === 'PendingExternalApproval' || row.status === 'PendingApproval'
      || row.assignTargetDepartmentId != null
  }

  if (filter === 'overdue') return !isClosed && isOverdue
  if (isOverdue && !isClosed) return false

  if (filter === 'completed') {
    return row.status === 'Completed'
  }

  if (filter === 'cancelled') {
    return row.status === 'Cancelled' || row.status === 'Rejected' || row.status === 'RevisionRequested'
  }

  // Personel ataması bekleyenler yukarıda "Onay Bekleyen" altında gösterildi; burada tekrar etmesin.
  return row.assignTargetDepartmentId == null && (
    row.status === 'Active'
    || row.status === 'Waiting'
    || row.status === 'Assigned'
    || row.status === 'InProgress'
    || row.status === 'PendingCloseApproval'
  )
}

function matchesKindFilter(filter: IncomingKindFilter): boolean {
  return filter === 'all'
}

function formatJobDisplayNumber(job: JobSummary): string {
  const year = job.jobNumberYear ?? new Date().getFullYear()
  if (job.jobNumber != null && job.jobNumberYear != null) {
    return `T-${year}-${job.jobNumber}`
  }
  return `T-${year}-Onay Bekleyen`
}

// Birime gelen iç talep satırında "Talep No" = bağlı olduğu talebin (job) numarası,
// görevin (task) numarası değil (card 536).
function formatInternalRequestNumber(task: Task): string {
  const year = task.jobNumberYear ?? new Date().getFullYear()
  if (task.jobNumber != null && task.jobNumberYear != null) {
    return `T-${task.jobNumberYear}-${task.jobNumber}`
  }
  return `T-${year}-Onay Bekleyen`
}

function toInternalRow(task: Task): IncomingRequestRow {
  return {
    id: task.taskId,
    jobId: task.jobId,
    displayNumber: formatInternalRequestNumber(task),
    kind: 'internal',
    statusDomain: 'task',
    title: task.title,
    status: task.currentStatus,
    priority: task.priority,
    departmentName: task.assignedDepartmentName ?? null,
    createdBy: task.createdByDisplayName ?? null,
    taskOwnerDisplayName: task.assignedUserDisplayName ?? task.ownerDisplayName ?? null,
    dueDateUtc: task.dueDateUtc,
    // "Talep Tarihi" = talebin oluşturulma tarihi. Birim içi talepler onaylanınca görev o an
    // oluşturulduğundan görevin createdAt'i onay tarihini gösterir; bunun yerine bağlı talebin
    // (job) oluşturulma tarihi kullanılır ki onay sonrası tarih değişmesin (card 629).
    createdAtUtc: task.jobCreatedAtUtc ?? task.createdAtUtc ?? null,
    detailsPath: `/request-details?context=incoming&jobId=${task.jobId}`,
    assignTargetDepartmentId: null,
    pendingTargetApprovalDepartmentId: null,
    approvedAtUtc: task.createdAtUtc ?? null,
    completedAtUtc: task.completedAtUtc ?? null,
    updatedAtUtc: task.updatedAtUtc ?? null,
    createdByRoleCode: task.createdByRoleCode ?? null,
  }
}

function toExternalRow(
  job: JobSummary,
  activeDeptId: string | null,
  socialByJobId: Map<string, SocialMessage>,
  locale: string,
): IncomingRequestRow {
  const ownerDept = job.departments?.find(d => d.role === 'Owner')
  const activeTarget = activeDeptId
    ? job.departments?.find(d => d.role === 'Target' && d.departmentId === activeDeptId)
    : undefined
  const targetPending = activeTarget?.approvalStatus === 'Pending'
  const targetApproved = activeTarget?.approvalStatus === 'Approved' || activeTarget?.approvalStatus === 'NotRequired'
  const isCitizen = isCitizenRequestJob(job)
  const assignTargetDepartmentId = activeTarget && job.status === 'Active' && job.taskCount === 0
    && (targetApproved || (isCitizen && targetPending))
    ? activeTarget.departmentId
    : null
  const pendingTargetApprovalDepartmentId = targetPending && activeTarget && !isCitizen
    ? activeTarget.departmentId
    : null
  const displayStatus = targetPending ? 'PendingExternalApproval' : job.status
  const displayNumber = isCitizenRequestJob(job)
    ? formatCitizenRequestNumber(socialByJobId.get(job.jobId) ?? { createdAtUtc: job.createdAtUtc }, locale)
    : formatJobDisplayNumber(job)
  const sourceChannel = isCitizenRequestJob(job) ? (socialByJobId.get(job.jobId)?.channel ?? 'WhatsApp') : null
  return {
    id: job.jobId,
    jobId: job.jobId,
    displayNumber,
    sourceChannel,
    kind: 'external',
    statusDomain: 'job',
    title: job.title,
    status: displayStatus,
    priority: job.priority,
    departmentName: job.ownerDepartmentName,
    createdBy: job.createdByDisplayName,
    taskOwnerDisplayName: job.assignedUserDisplayName ?? null,
    dueDateUtc: job.dueDateUtc,
    createdAtUtc: job.createdAtUtc,
    detailsPath: `/request-details?context=incoming&jobId=${job.jobId}`,
    assignTargetDepartmentId,
    pendingTargetApprovalDepartmentId,
    approvedAtUtc: activeTarget?.decidedAtUtc ?? ownerDept?.decidedAtUtc ?? null,
    completedAtUtc: job.completedAtUtc,
    updatedAtUtc: job.updatedAtUtc ?? null,
    createdByRoleCode: job.createdByRoleCode ?? null,
    isCitizenRequest: isCitizen,
    taskCount: job.taskCount,
  }
}

/** An external job belongs in *this department's* incoming list only when the active
 *  department is one of its targets and the owner-side workflow has made it visible.
 *  Current records use an Approved owner row; older/direct-manager records can already
 *  be Active while that row is incomplete, and must not disappear from the target pool. */
function isIncomingExternalForActiveDept(job: JobSummary, activeDeptId: string | null): boolean {
  if (job.status === 'PendingOwnerApproval') return false

  const ownerApproved = job.departments?.some(d => d.role === 'Owner' && d.approvalStatus === 'Approved') ?? false
  const isVisibleToTarget = ownerApproved
    || job.status === 'Active'
    || job.status === 'PendingExternalApproval'
  if (!isVisibleToTarget) return false
  if (!activeDeptId) return true
  return job.departments?.some(d => d.role === 'Target' && d.departmentId === activeDeptId) ?? false
}

function toPendingInternalJobRow(job: JobSummary): IncomingRequestRow {
  const ownerDept = job.departments?.find(d => d.role === 'Owner')
  return {
    id: job.jobId,
    jobId: job.jobId,
    displayNumber: formatJobDisplayNumber(job),
    kind: 'internal',
    statusDomain: 'job',
    title: job.title,
    status: job.status,
    priority: job.priority,
    departmentName: job.ownerDepartmentName,
    createdBy: job.createdByDisplayName,
    taskOwnerDisplayName: job.assignedUserDisplayName ?? null,
    dueDateUtc: job.dueDateUtc,
    createdAtUtc: job.createdAtUtc,
    detailsPath: `/request-details?context=incoming&jobId=${job.jobId}`,
    assignTargetDepartmentId: null,
    pendingTargetApprovalDepartmentId: null,
    approvedAtUtc: ownerDept?.decidedAtUtc ?? null,
    completedAtUtc: job.completedAtUtc,
    updatedAtUtc: job.updatedAtUtc ?? null,
    createdByRoleCode: job.createdByRoleCode ?? null,
  }
}

export function IncomingRequestsPage() {
  const { t, i18n } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const locale = getLocale(i18n.language)
  const { user } = useAuth()
  const isCitizenRequestManager = hasCitizenRequestManagerRole(user)
  const [activeDeptId, setActiveDeptIdState] = useState(() => getActiveDepartmentId())
  const [tasks, setTasks] = useState<Task[]>([])
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [socialMessages, setSocialMessages] = useState<SocialMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [incomingPage, setIncomingPage] = useState(1)
  const [incomingPageSize, setIncomingPageSize] = useState(10)
  const [filterFrom, setFilterFrom] = useState(() => searchParams.get('from') ?? '')
  const [filterTo, setFilterTo] = useState(() => searchParams.get('to') ?? '')
  const [searchText, setSearchText] = useState('')
  const [detailJobId, setDetailJobId] = useState<string | null>(null)
  const currentStatusFilter = getIncomingStatusFilter(searchParams.get('status'))
  const currentKindFilter = getIncomingKindFilter()
  const showTaskOwnerColumn = ['approved', 'completed', 'cancelled'].includes(currentStatusFilter)
  const incomingTableColumnCount = useMemo(() => {
    let count = 6
    if (showTaskOwnerColumn) count += 1
    if (currentStatusFilter !== 'cancelled') count += 1
    if (currentStatusFilter === 'approved') count += 1
    if (currentStatusFilter === 'completed') count += 1
    if (currentStatusFilter === 'cancelled') count += 1
    if (currentStatusFilter === 'all') count += 1
    return count
  }, [currentStatusFilter, showTaskOwnerColumn])

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
      api.getSocialMessages(),
    ])
      .then(([taskList, jobList, socialList]) => {
        if (cancelled) return
        setTasks(taskList)
        setJobs(jobList)
        setSocialMessages(socialList)
        setError(null)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : t('common.error')) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [t, activeDeptId])

  const reload = useCallback(async () => {
    try {
      const [taskList, jobList, socialList] = await Promise.all([
        api.getTasks('all'),
        api.getJobs('my-department'),
        api.getSocialMessages(),
      ])
      setTasks(taskList)
      setJobs(jobList)
      setSocialMessages(socialList)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }, [t])

  // Birime gelen havuz birden fazla yönetici tarafından değiştirilebildiği için
  // kullanıcı sayfayı yenilemeden diğer kullanıcıların onay/atama işlemlerini görür.
  useEffect(() => {
    const intervalId = window.setInterval(() => { void reload() }, 30_000)
    return () => window.clearInterval(intervalId)
  }, [reload])

  const socialByJobId = useMemo(() => {
    const map = new Map<string, SocialMessage>()
    for (const message of socialMessages) {
      if (message.jobId) map.set(message.jobId, message)
    }
    return map
  }, [socialMessages])

  const rows = useMemo(() => {
    const internalTasks = tasks.filter(task => task.jobRequestType === 'InternalUnit')
    const internalRows = internalTasks.map(toInternalRow)
    // jobIds that already have task rows — skip the job-level row for these
    const jobIdsWithTasks = new Set(internalTasks.map(t => t.jobId))
    const pendingInternalJobRows = jobs
      .filter(job => job.requestType === 'InternalUnit' && !jobIdsWithTasks.has(job.jobId))
      .map(toPendingInternalJobRow)
    const externalRows = jobs
      .filter(job => (job.requestType === 'ExternalUnit' || job.requestType === 'Citizen') && isIncomingExternalForActiveDept(job, activeDeptId))
      .map(job => toExternalRow(job, activeDeptId, socialByJobId, locale))

    return [...internalRows, ...pendingInternalJobRows, ...externalRows].sort((a, b) => {
      const aTime = a.createdAtUtc ? new Date(a.createdAtUtc).getTime() : 0
      const bTime = b.createdAtUtc ? new Date(b.createdAtUtc).getTime() : 0
      return bTime - aTime
    })
  }, [jobs, tasks, activeDeptId, socialByJobId, locale])

  // Bir satırın bir sütunundaki görünen metni döndürür; hem kolon filtreleri hem banner araması kullanır.
  const getColumnValue = useCallback((key: string, r: IncomingRequestRow): string => {
    if (key === 'status') return getIncomingStatusLabel(t, r)
    if (key === 'cancelReturnStatus') return 'İptal'
    if (key === 'displayNumber') return r.displayNumber
    if (key === 'priority') return getPriorityLabel(t, r.priority)
    if (key === 'createdAtUtc') return formatDateTime(r.createdAtUtc, locale)
    if (key === 'dueDateUtc') return formatDateTime(r.dueDateUtc, locale)
    if (key === 'approvedAtUtc') return formatDateTime(r.approvedAtUtc, locale)
    if (key === 'completedAtUtc') return formatDateTime(r.completedAtUtc, locale)
    if (key === 'updatedAtUtc') return formatDateTime(r.updatedAtUtc, locale)
    return String((r as unknown as Record<string, unknown>)[key] ?? '')
  }, [t, locale])

  // Banner aramasının tarayacağı tüm sütunlar (sadece Başlık değil).
  const SEARCH_COLUMN_KEYS = ['displayNumber', 'priority', 'createdAtUtc', 'departmentName', 'createdBy', 'title', 'taskOwnerDisplayName', 'dueDateUtc', 'approvedAtUtc', 'completedAtUtc', 'updatedAtUtc', 'status']

  const visibleRows = useMemo(() => {
    let result = rows
      .filter(row => matchesStatusFilter(row, currentStatusFilter))
      .filter(() => matchesKindFilter(currentKindFilter))
    if (isCitizenRequestManager) {
      result = result.filter(row => row.isCitizenRequest)
    }
    if (filterFrom || filterTo) {
      const useDueDatePeriod = currentStatusFilter === 'overdue'
      result = result.filter(row => {
        const d = (useDueDatePeriod ? row.dueDateUtc : row.createdAtUtc)?.slice(0, 10)
        if (!d) return false
        if (filterFrom && d < filterFrom.slice(0, 10)) return false
        if (filterTo && d > filterTo.slice(0, 10)) return false
        return true
      })
    }
    if (searchText.trim()) {
      result = result.filter(row => matchesBannerSearch(
        searchText,
        SEARCH_COLUMN_KEYS.map(key => getColumnValue(key, row)),
      ))
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKindFilter, currentStatusFilter, isCitizenRequestManager, rows, filterFrom, filterTo, searchText, getColumnValue])

  useEffect(() => { setIncomingPage(1) }, [filterFrom, filterTo, searchText])

  const { sortKey: incomingSortKey, sortDir: incomingSortDir, toggleSort: _toggleIncomingSort, sortItems: sortIncoming } = useSortable()
  const { filters: incomingFilters, setFilter: setIncomingFilter, clearFilters: clearIncomingFilters, matchesFilters: incomingMatchesFilters } = useColumnFilters()

  const columnFilteredRows = useMemo(
    // cancelReturnStatus'u satıra ekle ki sıralama (obj[sortKey]) çalışsın; filtre getColumnValue ile.
    () => visibleRows
      .map(row => ({ ...row, cancelReturnStatus: 'İptal' }))
      .filter(row => incomingMatchesFilters(row, getColumnValue)),
    [visibleRows, incomingMatchesFilters, getColumnValue],
  )

  useEffect(() => { setIncomingPage(1) }, [incomingFilters])

  useEffect(() => {
    queueMicrotask(() => {
      setIncomingPage(1)
      clearIncomingFilters()
      setError(null)
    })
  }, [activeDeptId, clearIncomingFilters])

  const toggleIncomingSort = (key: string) => {
    _toggleIncomingSort(key)
    setIncomingPage(1)
  }

  const pagedRows = useMemo(
    () => {
      // Tamamlanmış/İptal görünümlerinde en yeni tamamlanma/iptal tarihli en üstte varsayılan sırala (card #722).
      const isCompleted = currentStatusFilter === 'completed'
      const isCancelled = currentStatusFilter === 'cancelled'
      const base = (isCompleted || isCancelled)
        ? [...columnFilteredRows].sort((a, b) => {
            const av = isCompleted ? a.completedAtUtc : a.updatedAtUtc
            const bv = isCompleted ? b.completedAtUtc : b.updatedAtUtc
            return new Date(bv ?? 0).getTime() - new Date(av ?? 0).getTime()
          })
        : columnFilteredRows
      return sortIncoming(base).slice((incomingPage - 1) * incomingPageSize, incomingPage * incomingPageSize)
    },
    [columnFilteredRows, incomingPage, incomingPageSize, sortIncoming, currentStatusFilter],
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
            <h1 className="page-title">{t('nav.incomingRequests', 'Birime Gelen Talepler')}</h1>
            <p className="page-subtitle">{t('incomingRequests.subtitle', 'Birim içi ve birim dışı gelen talepleri tek listede takip edin.')}</p>
          </div>
          <div className="ml-auto mt-auto shrink-0">
            <div className="scope-chips-filters">
              <div className="scope-chip-search-wrap">
                <Search className="scope-chip-search-icon size-3 shrink-0 text-slate-400" aria-hidden="true" />
                <input
                  type="text"
                  className="scope-chip-search-input"
                  placeholder={t('common.search', 'Ara...')}
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                />
                {searchText && (
                  <button type="button" onClick={() => setSearchText('')} className="scope-chip-search-clear shrink-0 font-extrabold transition-colors" aria-label="Temizle">
                    <X className="size-3.5" strokeWidth={3} />
                  </button>
                )}
              </div>
              {/* Talep Oluştur'daki ile aynı takvim tasarımı (DateTimePicker), tarih aralığı için iki seçici. */}
              <DateTimePicker value={filterFrom} onChange={setFilterFrom} placeholder="Başlangıç tarihi" className="scope-chip-date" forceDown />
              <span className="text-xs text-white/60">–</span>
              <DateTimePicker value={filterTo} onChange={setFilterTo} placeholder="Bitiş tarihi" className="scope-chip-date" forceDown />
            </div>
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
        {KIND_FILTERS.length > 1 ? (
          <>
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
          </>
        ) : null}
      </nav>

      {error ? <div className="error">{error}</div> : null}

      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : (
        <section className="section-card desktop-page-fill">
          <div className="table-wrap desktop-panel-scroll">
            <table className="data-table jobs-table data-table--zebra my-requests-table incoming-requests-table">
              <colgroup>
                <col className="grid-col-row-no" />
                <col className="grid-col-request-no" />
                <col className="grid-col-date" />
                <col className="grid-col-location-creator" />
                <col className="grid-col-title" />
                {showTaskOwnerColumn && <col className="grid-col-task-owner" />}
                {currentStatusFilter !== 'cancelled' && <col className="grid-col-due" />}
                {currentStatusFilter === 'approved' && <col className="grid-col-status-date" />}
                {currentStatusFilter === 'completed' && <col className="grid-col-status-date" />}
                {currentStatusFilter === 'cancelled' && <col className="grid-col-status-date" />}
                {currentStatusFilter === 'all' && <col className="grid-col-status" />}
                <col className="grid-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                  <FilterableTh filterKey="displayNumber" filterValue={incomingFilters['displayNumber'] ?? ''} onFilter={setIncomingFilter} sortKey="displayNumber" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('incomingRequests.columns.requestNo', 'Talep No')}</FilterableTh>
                  <FilterableTh filterKey="createdAtUtc" filterValue={incomingFilters['createdAtUtc'] ?? ''} onFilter={setIncomingFilter} sortKey="createdAtUtc" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('incomingRequests.columns.requestDate', 'Talep Tarihi')}</FilterableTh>
                  <FilterableTh filterKey="createdBy" filterValue={incomingFilters['createdBy'] ?? ''} onFilter={setIncomingFilter} sortKey="createdBy" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}><span className="leading-tight">{t('incomingRequests.columns.requestLocation', 'Talep Yeri')}<br />{t('incomingRequests.columns.creator', 'Oluşturan')}</span></FilterableTh>
                  <FilterableTh filterKey="title" filterValue={incomingFilters['title'] ?? ''} onFilter={setIncomingFilter} sortKey="title" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('jobs.columns.title', 'Başlık')}</FilterableTh>
                  {showTaskOwnerColumn && <FilterableTh filterKey="taskOwnerDisplayName" filterValue={incomingFilters['taskOwnerDisplayName'] ?? ''} onFilter={setIncomingFilter} sortKey="taskOwnerDisplayName" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('tasks.columns.owner', 'Görev Sahibi')}</FilterableTh>}
                  {currentStatusFilter !== 'cancelled' && <FilterableTh filterKey="dueDateUtc" filterValue={incomingFilters['dueDateUtc'] ?? ''} onFilter={setIncomingFilter} sortKey="dueDateUtc" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('jobs.columns.dueDate', 'Son Tarih')}</FilterableTh>}
                  {currentStatusFilter === 'approved' && <FilterableTh filterKey="approvedAtUtc" filterValue={incomingFilters['approvedAtUtc'] ?? ''} onFilter={setIncomingFilter} sortKey="approvedAtUtc" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('incomingRequests.columns.approvedAt', 'Onay Tarihi')}</FilterableTh>}
                  {currentStatusFilter === 'completed' && <FilterableTh filterKey="completedAtUtc" filterValue={incomingFilters['completedAtUtc'] ?? ''} onFilter={setIncomingFilter} sortKey="completedAtUtc" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('incomingRequests.columns.completedAt', 'Tamamlanma Tarihi')}</FilterableTh>}
                  {currentStatusFilter === 'cancelled' && <FilterableTh filterKey="updatedAtUtc" filterValue={incomingFilters['updatedAtUtc'] ?? ''} onFilter={setIncomingFilter} sortKey="updatedAtUtc" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('incomingRequests.columns.cancelledAt', 'İptal Tarihi')}</FilterableTh>}
                  {currentStatusFilter === 'all' && <FilterableTh filterKey="status" filterValue={incomingFilters['status'] ?? ''} onFilter={setIncomingFilter} sortKey="status" currentSortKey={incomingSortKey} sortDir={incomingSortDir} onSort={toggleIncomingSort}>{t('jobs.columns.status', 'Durum')}</FilterableTh>}
                  <th>{t('jobs.columns.actions', 'İşlemler')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.length === 0 && (
                  <TableEmptyStateRows
                    columnCount={incomingTableColumnCount}
                    message={t('incomingRequests.empty', 'Birime gelen talep bulunmuyor.')}
                  />
                )}
                {pagedRows.map((row, index) => {
                  const isReporterRow = isReporterCreated(row.createdByRoleCode)
                  const reporterNumberClass = isReporterRow && hasConcreteNumberDisplay(row.displayNumber)
                    ? reporterGridValueClass(true)
                    : ''
                  return (
                  <tr key={`${row.kind}-${row.id}`}>

                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(incomingPage - 1) * incomingPageSize + index + 1}</td>
                    <td className="table-number-cell font-mono text-xs text-slate-500">
                      <div className="table-number-cell__value inline-flex items-center gap-1.5">
                        {row.sourceChannel ? <ChannelIcon channel={row.sourceChannel} className="size-4 shrink-0" /> : null}
                        <span className={reporterNumberClass}>{row.displayNumber}</span>
                      </div>
                      <div className={`table-number-cell__priority font-sans font-bold ${getPriorityColorClass(row.priority)}`}>(Öncelik:{getPriorityLabel(t, row.priority)})</div>
                    </td>
                    <td>
                      <DateCell value={row.createdAtUtc} locale={locale} highlight={isReporterRow && Boolean(row.createdAtUtc)} />
                      {/* Onay Bekleyen filtresinde bugün gelen talepler için yanıp sönen yeşil "Yeni" rozeti (card 607). */}
                      {currentStatusFilter === 'pending-approval' && isCreatedToday(row.createdAtUtc) && (
                        <div className="task-new-badge">{t('tasks.badges.new', 'Yeni')}</div>
                      )}
                    </td>
                    <td>
                      <ReporterDepartmentCell
                        departmentName={row.departmentName}
                        creatorName={row.createdBy}
                        isReporter={isReporterCreated(row.createdByRoleCode)}
                      />
                    </td>
                    <td className="font-semibold"><span className={`cell-title ${isReporterRow ? 'text-[#f97316]' : ''}`}>{row.title}</span></td>
                    {showTaskOwnerColumn && <td>{row.taskOwnerDisplayName ?? '—'}</td>}
                    {currentStatusFilter !== 'cancelled' && <td><DueDatePill value={row.dueDateUtc} completedAtUtc={row.completedAtUtc} locale={locale} highlightReporter={isReporterRow} /></td>}
                    {currentStatusFilter === 'approved' && <td><DateCell value={row.approvedAtUtc} locale={locale} /></td>}
                    {currentStatusFilter === 'completed' && <td><DateCell value={row.completedAtUtc} locale={locale} tone="success" /></td>}
                    {currentStatusFilter === 'cancelled' && <td><DateCell value={row.updatedAtUtc} locale={locale} tone="danger" /></td>}
                    {currentStatusFilter === 'all' && (() => {
                      // Tarih durum pill'inin İÇİNDE alt satırda gösterilir (card #714).
                      const statusDate = row.status === 'Completed' ? row.completedAtUtc
                        : row.status === 'Cancelled' ? row.updatedAtUtc
                        : null
                      return (
                        <td>
                          <StatusPill className={getIncomingStatusPillClass(row)}>
                            {statusDate
                              ? <span className="flex flex-col items-center leading-tight">
                                  <span>{getIncomingStatusLabel(t, row)}</span>
                                  <span className={`text-[0.68rem] font-bold ${row.status === 'Completed' ? 'text-emerald-700' : 'text-red-700'}`}>{formatDateTime(statusDate, locale)}</span>
                                </span>
                              : getIncomingStatusLabel(t, row)}
                          </StatusPill>
                        </td>
                      )
                    })()}
                    <td className="actions-cell">
                      <div className="flex justify-center gap-3">
                        <Button size="sm" variant="secondary" onClick={() => setDetailJobId(row.jobId)} className="gap-1.5">
                          {t('jobs.actions.details', 'Detaylar')}
                          <ArrowRight className="size-3.5" />
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
            totalCount={columnFilteredRows.length}
            pageSize={incomingPageSize}
            currentPage={incomingPage}
            onPageSizeChange={setIncomingPageSize}
            onPageChange={setIncomingPage}
          />
        </section>
      )}
      {detailJobId && (
        <JobsPage
          detailOnly
          notificationJobId={detailJobId}
          detailContextOverride="incoming"
          onNotificationDetailClose={() => setDetailJobId(null)}
        />
      )}
    </div>
  )
}
