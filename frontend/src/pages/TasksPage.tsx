import { Search, X } from 'lucide-react'
import { DueDatePill } from '../components/ui/due-date-pill'
import { DateCell } from '../components/ui/date-cell'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { SingleSelectDropdown } from '../components/ui/single-select-dropdown'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '../hooks/useSortable'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { FilterableTh } from '../components/ui/FilterableTh'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { getActiveDepartmentId } from '../api/http'
import { AttachmentSection } from '../components/ui/AttachmentSection'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import type { ConfirmDialogState } from '../components/ui/confirm-dialog'
import { DisabledActionButton } from '../components/ui/DisabledActionButton'
import { Toast } from '../components/ui/toast'
import { StatusPill } from '../components/ui/status-pill'
import { useAuth } from '../context/AuthContext'
import type { Department, JobDetail, Task, TaskDetail, TaskListScope, User } from '../types/platform'
import { getLocale, getPriorityColorClass, getPriorityLabel, getTaskStatusLabel, getTaskDisplayStatus } from '../utils/localization'
import { TablePagination } from '../components/ui/table-pagination'

interface TaskScopeFiltersProps {
  searchText: string
  filterFrom: string
  filterTo: string
  onSearch: (v: string) => void
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
}
function TaskScopeFilters({ searchText, filterFrom, filterTo, onSearch, onFromChange, onToChange }: TaskScopeFiltersProps) {
  return (
    <div className="scope-chips-filters">
      <div className="scope-chip-search-wrap">
        <Search className="scope-chip-search-icon size-3 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          type="text"
          className="scope-chip-search-input"
          placeholder="Ara..."
          value={searchText}
          onChange={e => onSearch(e.target.value)}
        />
        {searchText && (
          <button type="button" onClick={() => onSearch('')} className="scope-chip-search-clear shrink-0 font-extrabold transition-colors" aria-label="Temizle">
            <X className="size-3.5" strokeWidth={3} />
          </button>
        )}
      </div>
      {/* Talep Oluştur'daki ile aynı takvim tasarımı (DateTimePicker), tarih aralığı için iki seçici. */}
      <DateTimePicker value={filterFrom} onChange={onFromChange} placeholder="Başlangıç tarihi" className="scope-chip-date" forceDown />
      <span className="text-xs text-slate-400">–</span>
      <DateTimePicker value={filterTo} onChange={onToChange} placeholder="Bitiş tarihi" className="scope-chip-date" forceDown />
    </div>
  )
}

const SCOPES: { value: TaskListScope; labelKey: string }[] = [
  { value: 'pending-approval', labelKey: 'tasks.scopes.pendingApproval' },
  { value: 'department-pool', labelKey: 'tasks.scopes.departmentPool' },
  { value: 'all', labelKey: 'tasks.scopes.all' },
]

type MyTaskView = 'pending' | 'completed' | 'rejected' | 'overdue' | 'all'
type RequestFlowFilter = 'internal' | 'external' | 'all'
type TasksPageMode = 'default' | 'departmentTasks' | 'staffTasks'

const MY_TASK_VIEWS: { value: MyTaskView; labelKey: string }[] = [
  { value: 'pending', labelKey: 'tasks.myViews.pending' },
  { value: 'overdue', labelKey: 'tasks.myViews.overdue' },
  { value: 'completed', labelKey: 'tasks.myViews.completed' },
  { value: 'rejected', labelKey: 'tasks.myViews.rejected' },
  { value: 'all', labelKey: 'tasks.myViews.all' },
]

const REQUEST_FLOW_FILTERS: { value: RequestFlowFilter; labelKey: string }[] = [
  { value: 'internal', labelKey: 'filters.requestFlow.internal' },
  { value: 'external', labelKey: 'filters.requestFlow.external' },
  { value: 'all', labelKey: 'filters.requestFlow.all' },
]

const DEPARTMENT_TASK_FLOWS: { value: RequestFlowFilter; labelKey: string }[] = [
  { value: 'internal', labelKey: 'nav.departmentTasksInternal' },
  { value: 'external', labelKey: 'nav.departmentTasksExternal' },
  { value: 'all', labelKey: 'nav.departmentTasksAll' },
]

const DEPARTMENT_STATUS_VIEWS: { value: MyTaskView; labelKey: string }[] = [
  { value: 'pending', labelKey: 'tasks.departmentViews.pending' },
  { value: 'overdue', labelKey: 'tasks.departmentViews.overdue' },
  { value: 'completed', labelKey: 'tasks.departmentViews.completed' },
  { value: 'rejected', labelKey: 'tasks.departmentViews.rejected' },
  { value: 'all', labelKey: 'tasks.departmentViews.all' },
]

function availableScopes(role?: string): TaskListScope[] {
  if (role === 'SystemAdmin' || role === 'Manager') return ['pending-approval', 'department-pool', 'all']
  return ['department-pool', 'all']
}

interface TasksPageProps {
  fixedScope?: TaskListScope
  mode?: TasksPageMode
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

function stripHtmlTags(value: string | null | undefined) {
  if (!value) return ''
  const parser = new DOMParser()
  const parsed = parser.parseFromString(value, 'text/html')
  return (parsed.body.innerText || parsed.body.textContent || '').trim()
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function printTaskDetail(taskDetail: TaskDetail, locale: string) {
  const win = window.open('', '_blank', 'width=820,height=900')
  if (!win) return
  const fd = (d: string | null | undefined) => d ? new Date(d).toLocaleString(locale, { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'
  const description = stripHtmlTags(taskDetail.description)
  const historyItems = taskDetail.assignmentHistory.map(h =>
    `<li>${escHtml(h.toDepartmentId ?? '—')} · ${escHtml(h.toUserId ?? '—')} — ${fd(h.actionDateUtc)}</li>`
  ).join('')
  const attachItems = (taskDetail.attachments ?? []).map(a => `<li>${escHtml(a.fileName)} (${(a.fileSizeBytes / 1024).toFixed(1)} KB)</li>`).join('')
  win.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${escHtml(taskDetail.title)}</title><style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:2rem;margin:0}
    h1{font-size:18px;margin:4px 0 8px}
    .kicker{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#666}
    .meta{font-size:11px;color:#444;margin-bottom:1rem;line-height:1.7}
    .section{margin-top:1.5rem}
    .section-title{font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #ccc;padding-bottom:3px;margin-bottom:8px;color:#333}
    .desc{border:1px solid #ccc;padding:8px;border-radius:3px;background:#fafafa;font-size:11px;line-height:1.6}
    .footer{margin-top:2rem;font-size:10px;color:#aaa}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="kicker">Görev Detayı</div>
  <h1>${escHtml(taskDetail.title)}</h1>
  ${taskDetail.jobTitle ? `<p style="font-size:12px;color:#555;margin:0 0 8px">İlgili Talep: <strong>${escHtml(taskDetail.jobTitle)}</strong></p>` : ''}
  <div class="meta">
    <strong>Durum:</strong> ${escHtml(taskDetail.currentStatus)} &nbsp;|&nbsp;
    <strong>Öncelik:</strong> ${escHtml(taskDetail.priority)} &nbsp;|&nbsp;
    <strong>Termin:</strong> ${fd(taskDetail.dueDateUtc)}<br/>
    <strong>Sahip:</strong> ${escHtml(taskDetail.ownerDisplayName ?? '—')} &nbsp;|&nbsp;
    <strong>Oluşturan:</strong> ${escHtml(taskDetail.createdByDisplayName ?? '—')}<br/>
    <strong>Atanan:</strong> ${escHtml(taskDetail.assignedUserId ?? taskDetail.assignedDepartmentId ?? 'Havuz')}
  </div>
  <div class="section">
    <div class="section-title">Açıklama</div>
    <div class="desc">${description ? escHtml(description).replace(/\n/g, '<br/>') : '<em>Açıklama yok</em>'}</div>
  </div>
  ${historyItems ? `<div class="section"><div class="section-title">Atama Geçmişi</div><ul style="font-size:11px;margin:4px 0;padding-left:1.2rem">${historyItems}</ul></div>` : ''}
  ${attachItems ? `<div class="section"><div class="section-title">Ekler (${(taskDetail.attachments ?? []).length})</div><ul style="font-size:11px;margin:4px 0;padding-left:1.2rem">${attachItems}</ul></div>` : ''}
  <div class="footer">Yazdırma tarihi: ${new Date().toLocaleString(locale)}</div>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`)
  win.document.close()
}


function formatTaskDisplayNumber(task: Task): string {
  if (task.taskNumber != null && task.taskNumberYear != null) {
    return `G-${task.taskNumberYear}-${task.taskNumber}`
  }
  const year = task.taskNumberYear ?? new Date().getFullYear()
  return `G-${year}-Onay Bekleyen`
}

function formatTaskJobDisplayNumber(task: Task): string {
  if (task.jobSourceType === 'Routine') return '—'
  if (task.jobNumber != null && task.jobNumberYear != null) {
    return `T-${task.jobNumberYear}-${task.jobNumber}`
  }
  const year = task.jobNumberYear ?? new Date().getFullYear()
  return `T-${year}-Onay Bekleyen`
}

function getMyTaskView(value: string | null): MyTaskView {
  if (value === 'returned') return 'rejected'
  return value === 'completed' || value === 'rejected' || value === 'overdue' || value === 'all' ? value : 'pending'
}

function getRequestFlowFilter(value: string | null): RequestFlowFilter {
  return value === 'internal' || value === 'external' ? value : 'all'
}

function getScopeChipColorClass(value: string): string {
  if (value === 'pending') return 'scope-chip--pending'
  if (value === 'approved') return 'scope-chip--approved'
  if (value === 'in-progress') return 'scope-chip--in-progress'
  if (value === 'completed') return 'scope-chip--completed'
  if (value === 'rejected') return 'scope-chip--rejected'
  // Son Tarihi Geçmiş: Yapılmakta Olan ile aynı turuncu renk.
  if (value === 'overdue') return 'scope-chip--in-progress'
  if (value === 'all') return 'scope-chip--all'
  return ''
}

function matchesRequestFlow(requestType: Task['jobRequestType'], filter: RequestFlowFilter): boolean {
  if (filter === 'internal') return requestType === 'InternalUnit'
  if (filter === 'external') return requestType === 'ExternalUnit'
  return true
}

function userBelongsToDepartment(item: User, departmentId: string) {
  return item.departmentId === departmentId || Boolean(item.departments?.some(department => department.departmentId === departmentId))
}

function userBelongsToAnyDepartment(item: User, departmentIds: Set<string>) {
  return departmentIds.has(item.departmentId) || Boolean(item.departments?.some(department => departmentIds.has(department.departmentId)))
}

function filterMyTasks(tasks: Task[], view: MyTaskView): Task[] {
  if (view === 'all') return tasks

  if (view === 'completed') {
    return tasks.filter(task => task.currentStatus === 'Completed')
  }

  if (view === 'rejected') {
    return tasks.filter(task => task.currentStatus === 'Cancelled' || task.currentStatus === 'Rejected' || task.currentStatus === 'RevisionRequested')
  }

  const isClosedStatus = (status: string) =>
    ['Completed', 'Cancelled', 'Rejected', 'RevisionRequested'].includes(status)
  const isOverdue = (task: Task) =>
    task.dueDateUtc != null && new Date(task.dueDateUtc).getTime() < Date.now()

  if (view === 'overdue') {
    return tasks.filter(task => !isClosedStatus(task.currentStatus) && isOverdue(task))
  }

  // "Bekleyen" görünümü: aktif görevler — son tarihi geçmiş görevler hariç (onlar
  // "Son Tarihi Geçmiş" görünümünde gösterilir, card 393/394).
  return tasks.filter(task => !isClosedStatus(task.currentStatus) && !isOverdue(task))
}

export function TasksPage({ fixedScope, mode = 'default' }: TasksPageProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()

  const locale = getLocale(i18n.language)
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeDeptId, setActiveDeptId] = useState(() => getActiveDepartmentId())
  const [tasks, setTasks] = useState<Task[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasksPage, setTasksPage] = useState(1)
  const [tasksPageSize, setTasksPageSize] = useState(10)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null)
  const [parentJobDetail, setParentJobDetail] = useState<JobDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [assignmentDraft, setAssignmentDraft] = useState({ departmentId: '', userId: '' })
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [returnModal, setReturnModal] = useState<{ taskId: string; step: 'cancel' | 'return'; assignedDepartmentId: string | null; isReporterTask: boolean; useManagerReporterRedirectLabel: boolean; directRoute: boolean } | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [returnDeptId, setReturnDeptId] = useState('')
  const [returnUserId, setReturnUserId] = useState('')
  const [returnSaving, setReturnSaving] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [completionNote, setCompletionNote] = useState('')
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [searchText, setSearchText] = useState('')
  const dismissedAutoOpenTaskIdRef = useRef<string | null>(null)
  const canCompleteTask = !!taskDetail && (taskDetail.currentStatus === 'Assigned' || taskDetail.currentStatus === 'InProgress') && taskDetail.assignedUserId === user?.userId

  const scopes = useMemo(() => fixedScope ? [fixedScope] : availableScopes(user?.role), [fixedScope, user?.role])
  const scopeParam = (searchParams.get('scope') as TaskListScope | null) ?? scopes[0]
  const currentScope: TaskListScope = scopes.includes(scopeParam) ? scopeParam : scopes[0]
  const isMyTasksView = fixedScope === 'mine'
  const isDepartmentTasksView = mode === 'departmentTasks'
  const isStaffTasksView = mode === 'staffTasks'
  const currentMyTaskView = getMyTaskView(searchParams.get('view'))
  const currentRequestFlowFilter = getRequestFlowFilter(searchParams.get('flow'))
  const autoOpenTaskId = searchParams.get('taskId')
  const isManagerLike = user?.role === 'Manager' || user?.role === 'SystemAdmin'
  const showRequestFlowFilters = isMyTasksView && user?.role !== 'SystemAdmin'
  const activeUsers = useMemo(() => users.filter(item => item.isActive), [users])
  const managedDepartmentIds = useMemo(() => {
    const ids = departments
      .filter(department => department.managerUserId === user?.userId)
      .map(department => department.departmentId)

    return activeDeptId && ids.includes(activeDeptId)
      ? new Set([activeDeptId])
      : new Set(ids)
  }, [activeDeptId, departments, user?.userId])
  const staffUsers = useMemo(() => {
    return activeUsers.filter(item =>
      userBelongsToAnyDepartment(item, managedDepartmentIds) &&
      item.userId !== user?.userId &&
      item.roleCode !== 'Manager' &&
      item.roleCode !== 'SystemAdmin')
  }, [activeUsers, managedDepartmentIds, user?.userId])
  const staffUserIds = useMemo(() => new Set(staffUsers.map(item => item.userId)), [staffUsers])
  const returnDeptUsers = useMemo(() => {
    if (!returnDeptId) return []
    // Görevi Yönlendir: hedef listede mevcut görev sahibi personel gösterilmez.
    const currentAssigneeId = returnModal?.directRoute
      ? tasks.find(item => item.taskId === returnModal.taskId)?.assignedUserId ?? null
      : null
    return activeUsers
      .filter(item => userBelongsToAnyDepartment(item, new Set([returnDeptId])))
      .filter(item => item.userId !== currentAssigneeId)
  }, [activeUsers, returnDeptId, returnModal, tasks])
  const staffUserParam = searchParams.get('userId') ?? 'all'
  const currentStaffUserId = staffUserParam !== 'all' && staffUserIds.has(staffUserParam) ? staffUserParam : 'all'
  const currentStaffUserLabel = currentStaffUserId === 'all'
    ? t('tasks.staff.allStaff', 'Tüm Personel')
    : staffUsers.find(item => item.userId === currentStaffUserId)?.displayName ?? t('tasks.staff.allStaff', 'Tüm Personel')
  const staffTaskTypeParam = searchParams.get('taskType') ?? 'all'
  const currentStaffTaskType: 'all' | 'assigned' | 'routine' =
    staffTaskTypeParam === 'assigned' || staffTaskTypeParam === 'routine' ? staffTaskTypeParam : 'all'
  const detailScopeLabel = isMyTasksView
    ? t('nav.myTasks', 'Görevlerim')
    : isDepartmentTasksView
      ? t('nav.departmentTasks', 'Birimdeki Görevler')
      : isStaffTasksView
        ? t('nav.staffTasks', 'Personelimin Görevleri')
        : t('tasks.detail.title', 'Görev Detayları')

  const visibleTasks = useMemo(() => {
    let result: typeof tasks

    if (isStaffTasksView) {
      const staffTasks = tasks.filter(task => task.assignedUserId && staffUserIds.has(task.assignedUserId))
      let byUser = currentStaffUserId === 'all' ? staffTasks : staffTasks.filter(task => task.assignedUserId === currentStaffUserId)
      if (currentStaffTaskType === 'routine') byUser = byUser.filter(task => task.jobSourceType === 'Routine')
      else if (currentStaffTaskType === 'assigned') byUser = byUser.filter(task => task.jobSourceType !== 'Routine')
      result = byUser
    } else if (isDepartmentTasksView) {
      result = filterMyTasks(tasks, currentMyTaskView).filter(task => matchesRequestFlow(task.jobRequestType, currentRequestFlowFilter))
    } else if (!isMyTasksView) {
      result = tasks
    } else {
      const myTasks = filterMyTasks(tasks, currentMyTaskView)
      result = showRequestFlowFilters ? myTasks.filter(task => matchesRequestFlow(task.jobRequestType, currentRequestFlowFilter)) : myTasks
    }

    if (filterFrom || filterTo) {
      result = result.filter(task => {
        const d = task.createdAtUtc?.slice(0, 10)
        if (!d) return false
        if (filterFrom && d < filterFrom.slice(0, 10)) return false
        if (filterTo && d > filterTo.slice(0, 10)) return false
        return true
      })
    }

    if (searchText.trim()) {
      // Türkçe "İ" eşleşmesi için tr-locale lowercase (birim/oluşturan adları için kritik).
      const q = searchText.toLocaleLowerCase('tr')
      // Banner araması tüm sütunlarda arar (sadece Başlık değil).
      result = result.filter(task => {
        const haystack = [
          formatTaskDisplayNumber(task),
          task.title,
          task.jobTitle ?? '',
          getTaskStatusLabel(t, task.currentStatus),
          getPriorityLabel(t, task.priority),
          formatDateTime(task.createdAtUtc, locale),
          formatDateTime(task.dueDateUtc, locale),
          formatDateTime(task.completedAtUtc ?? null, locale),
          formatDateTime(task.updatedAtUtc ?? null, locale),
          task.ownerDepartmentName ?? '',
          task.createdByDisplayName ?? '',
          task.assignedUserDisplayName ?? task.ownerDisplayName ?? '',
          task.jobSourceType === 'Routine' ? t('tasks.type.routine', 'Rutin') : t('tasks.type.assigned', 'Atanmış'),
        ].join(' ').toLocaleLowerCase('tr')
        return haystack.includes(q)
      })
    }

    return result
  }, [currentMyTaskView, currentRequestFlowFilter, currentStaffTaskType, currentStaffUserId, filterFrom, filterTo, isDepartmentTasksView, isMyTasksView, isStaffTasksView, searchText, showRequestFlowFilters, staffUserIds, tasks, t, locale])

  const { sortKey: tasksSortKey, sortDir: tasksSortDir, toggleSort: _toggleTasksSort, sortItems: sortTasks } = useSortable()
  const { filters: taskFilters, setFilter: setTaskFilter, clearFilters: clearTaskFilters, matchesFilters: taskMatchesFilters } = useColumnFilters()

  const toggleTasksSort = (key: string) => {
    _toggleTasksSort(key)
    setTasksPage(1)
  }

  useEffect(() => { setTasksPage(1) }, [taskFilters])

  useEffect(() => {
    queueMicrotask(() => {
      setTasksPage(1)
      setFilterFrom('')
      setFilterTo('')
      setSearchText('')
      clearTaskFilters()
      setSelectedTask(null)
      setTaskDetail(null)
      setParentJobDetail(null)
      setAssignmentDraft({ departmentId: '', userId: '' })
      setReturnModal(null)
      setConfirmDialog(null)
      setSuccessToast(null)
      setError(null)
    })
  }, [activeDeptId, clearTaskFilters])

  const columnFilteredTasks = useMemo(
    () => visibleTasks
      .map(task => ({
        ...task,
        taskOwnerDisplayName: task.assignedUserDisplayName ?? task.ownerDisplayName ?? '',
        cancelReturnStatus: 'İptal',
      }))
      .filter(task => taskMatchesFilters(task, (key, row) => {
        if (key === 'currentStatus') return getTaskDisplayStatus(t, row)
        if (key === 'cancelReturnStatus') return row.currentStatus === 'Cancelled' ? 'İptal' : 'İade'
        if (key === 'priority') return getPriorityLabel(t, row.priority)
        if (key === 'jobNumber') return row.jobSourceType === 'Routine'
          ? t('tasks.columns.routineNoParentRequest', "Rutin görevin Talep No'su olmaz")
          : formatTaskJobDisplayNumber(row)
        if (key === 'taskNumber') return formatTaskDisplayNumber(row)
        if (key === 'createdAtUtc') return formatDateTime(row.createdAtUtc, locale)
        if (key === 'dueDateUtc') return formatDateTime(row.dueDateUtc, locale)
        if (key === 'completedAtUtc') return formatDateTime(row.completedAtUtc ?? null, locale)
        if (key === 'updatedAtUtc') return formatDateTime(row.updatedAtUtc ?? null, locale)
        if (key === 'assignedDepartmentName') return row.assignedDepartmentName ?? row.assignedUserDisplayName ?? ''
        if (key === 'jobSourceType') return row.jobSourceType === 'Routine' ? t('tasks.type.routine', 'Rutin') : t('tasks.type.assigned', 'Atanmış')
        return String((row as unknown as Record<string, unknown>)[key] ?? '')
      })),
    [visibleTasks, taskMatchesFilters, t, locale],
  )

  const pagedTasks = useMemo(
    () => sortTasks(columnFilteredTasks).slice((tasksPage - 1) * tasksPageSize, tasksPage * tasksPageSize),
    [columnFilteredTasks, tasksPage, tasksPageSize, sortTasks],
  )

  const currentMyTaskViewLabel = t(MY_TASK_VIEWS.find(view => view.value === currentMyTaskView)?.labelKey ?? 'tasks.myViews.pending', 'Bekleyen Görevlerim')
  const currentDepartmentStatusViewLabel = t(
    DEPARTMENT_STATUS_VIEWS.find(view => view.value === currentMyTaskView)?.labelKey ?? 'tasks.departmentViews.pending',
    'Bekleyen Görevler',
  )
  const assignmentUsers = useMemo(() => {
    if (!assignmentDraft.departmentId) return activeUsers
    return activeUsers.filter(item => userBelongsToDepartment(item, assignmentDraft.departmentId))
  }, [activeUsers, assignmentDraft.departmentId])

  const setMyTaskView = (view: MyTaskView) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', view)
    setSearchParams(nextParams)
    setTasksPage(1)
    clearTaskFilters()
  }

  const setRequestFlowFilter = (filter: RequestFlowFilter) => {
    const nextParams = new URLSearchParams(searchParams)
    if (filter === 'all') nextParams.delete('flow')
    else nextParams.set('flow', filter)
    setSearchParams(nextParams)
    setTasksPage(1)
    clearTaskFilters()
  }

  const setDepartmentTaskFlow = (filter: RequestFlowFilter) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('flow', filter)
    setSearchParams(nextParams)
    setTasksPage(1)
    clearTaskFilters()
  }

  const setStaffUserFilter = (userId: string) => {
    const nextParams = new URLSearchParams(searchParams)
    if (userId === 'all') nextParams.delete('userId')
    else nextParams.set('userId', userId)
    setSearchParams(nextParams)
    setTasksPage(1)
    clearTaskFilters()
  }

  const setStaffTaskTypeFilter = (type: 'all' | 'assigned' | 'routine') => {
    const nextParams = new URLSearchParams(searchParams)
    if (type === 'all') nextParams.delete('taskType')
    else nextParams.set('taskType', type)
    setSearchParams(nextParams)
    setTasksPage(1)
    clearTaskFilters()
  }

  useEffect(() => {
    const handler = () => setActiveDeptId(getActiveDepartmentId())
    window.addEventListener('activeDepartmentChanged', handler)
    return () => window.removeEventListener('activeDepartmentChanged', handler)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.getTasks(currentScope),
      api.getDepartments(),
      api.getUsers().catch(() => [] as User[]),
    ])
      .then(([taskList, departmentList, userList]) => {
        if (cancelled) return
        setTasks(taskList)
        setDepartments(departmentList)
        setUsers(userList)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : t('common.error')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [currentScope, t, activeDeptId])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      api.getTasks(currentScope)
        .then(list => {
          setTasks(list)
          setError(null)
        })
        .catch(err => setError(err instanceof Error ? err.message : t('common.error')))
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [currentScope, t, activeDeptId])

  const reload = async () => {
    try {
      setLoading(true)
      setTasks(await api.getTasks(currentScope))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = (taskId: string) => {
    setConfirmDialog({
      message: t('tasks.actions.completeConfirm', 'Görevi tamamladığınızı onaylıyor musunuz?'),
      confirmLabel: t('common.yes', 'Evet'),
      cancelLabel: t('common.no', 'Hayır'),
      variant: 'primary',
      onConfirm: async () => {
        try {
          await api.completeTask(taskId, completionNote.trim() || undefined)
          setCompletionNote('')
          closeTaskDetail()
          await reload()
          setSuccessToast(t('tasks.actions.completeSuccess', 'Görev başarıyla tamamlandı!'))
        } catch (err) {
          setError(err instanceof Error ? err.message : t('common.error'))
        }
      },
    })
  }

  const handleClaim = async (taskId: string) => {
    setError(null)
    try {
      await api.claimTask(taskId)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const openReturnModal = (taskId: string) => {
    const task = tasks.find(t => t.taskId === taskId)
    const isReporterTask = task?.createdByRoleCode === 'Reporter' && !isManagerLike
    const useManagerReporterRedirectLabel =
      task?.createdByRoleCode === 'Reporter' && isManagerLike && task.assignedUserId === user?.userId
    setReturnModal({ taskId, step: 'cancel', assignedDepartmentId: task?.assignedDepartmentId ?? null, isReporterTask, useManagerReporterRedirectLabel, directRoute: false })
    setCancelReason('')
    setReturnDeptId('')
    setReturnUserId('')
  }

  const openDepartmentRouteModal = (task: Task) => {
    setReturnModal({
      taskId: task.taskId,
      step: 'return',
      assignedDepartmentId: task.assignedDepartmentId,
      isReporterTask: false,
      useManagerReporterRedirectLabel: true,
      directRoute: true,
    })
    setReturnDeptId(task.assignedDepartmentId ?? '')
    setReturnUserId('')
  }

  const closeReturnModal = () => {
    setReturnModal(null)
    setCancelReason('')
    setReturnDeptId('')
    setReturnUserId('')
  }

  const handleCancelTask = async () => {
    if (!returnModal || !cancelReason.trim()) return
    setReturnSaving(true)
    try {
      await api.cancelTask(returnModal.taskId, cancelReason.trim())
      closeReturnModal()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setReturnSaving(false)
    }
  }

  const handleReturn = async () => {
    if (!returnModal) return
    setReturnSaving(true)
    try {
      await api.assignTask(returnModal.taskId, returnDeptId || undefined, returnUserId || undefined)
      closeReturnModal()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setReturnSaving(false)
    }
  }

  const isAssignee = (task: Task) => task.assignedUserId === user?.userId
  const getDepartmentName = (departmentId?: string | null) => departments.find(department => department.departmentId === departmentId)?.name ?? '—'
  const getUserName = (userId?: string | null) => users.find(item => item.userId === userId)?.displayName ?? '—'
const pageKicker = isMyTasksView
    ? currentMyTaskViewLabel
    : isDepartmentTasksView
      ? currentDepartmentStatusViewLabel
      : isStaffTasksView
        ? currentStaffUserLabel
        : t('tasks.scopeSelector', 'İş görünümleri')
  const pageTitle = isMyTasksView
    ? t('nav.myTasks', 'Görevlerim')
    : isDepartmentTasksView
      ? t('nav.departmentTasks', 'Birimdeki Görevler')
      : isStaffTasksView
        ? t('nav.staffTasks', 'Personelimin Görevleri')
        : t('nav.tasks')
  const pageSubtitle = isMyTasksView
    ? t('tasks.myTasksSubtitle', 'Size atanmış görevleri durumuna göre takip edin.')
    : isDepartmentTasksView
      ? t('tasks.departmentTasksSubtitle', 'Müdürlüğünüzde oluşan görevleri kaynak tipine göre takip edin.')
      : isStaffTasksView
        ? t('tasks.staffTasksSubtitle', 'Personelinizin üzerindeki görevleri ve aşamalarını izleyin.')
        : t('tasks.subtitle')

  const openTaskDetail = async (task: Task) => {
    setSelectedTask(task)
    setTaskDetail(null)
    setParentJobDetail(null)
    setDetailLoading(true)
    setAssignmentDraft({
      departmentId: task.assignedDepartmentId ?? '',
      userId: '',
    })
    try {
      const [detail, jobDetail] = await Promise.all([
        api.getTaskById(task.taskId),
        task.jobId ? api.getJobById(task.jobId).catch(() => null) : Promise.resolve(null),
      ])
      setTaskDetail(detail)
      setParentJobDetail(jobDetail)
      setAssignmentDraft({
        departmentId: detail.assignedDepartmentId ?? '',
        userId: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (!autoOpenTaskId) {
      dismissedAutoOpenTaskIdRef.current = null
      return
    }
    if (
      selectedTask?.taskId === autoOpenTaskId ||
      dismissedAutoOpenTaskIdRef.current === autoOpenTaskId
    ) return
    const task = tasks.find(item => item.taskId === autoOpenTaskId)
    if (task) {
      void openTaskDetail(task)
    }
  }, [autoOpenTaskId, selectedTask?.taskId, tasks]) // eslint-disable-line react-hooks/exhaustive-deps

  const closeTaskDetail = () => {
    dismissedAutoOpenTaskIdRef.current = autoOpenTaskId
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('taskId')
    setSearchParams(nextParams, { replace: true })
    setSelectedTask(null)
    setTaskDetail(null)
    setParentJobDetail(null)
    setAssignmentDraft({ departmentId: '', userId: '' })
  }

  const saveAssignment = async () => {
    if (!selectedTask) return
    setAssignmentSaving(true)
    try {
      await api.assignTask(selectedTask.taskId, assignmentDraft.departmentId || null, assignmentDraft.userId || null)
      await reload()
      await openTaskDetail(selectedTask)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setAssignmentSaving(false)
    }
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{pageKicker}</div>
            <h1 className="page-title">{pageTitle}</h1>
            <p className="page-subtitle">{pageSubtitle}</p>
          </div>
          <div className="ml-auto mt-auto shrink-0">
            <TaskScopeFilters
              searchText={searchText}
              filterFrom={filterFrom}
              filterTo={filterTo}
              onSearch={setSearchText}
              onFromChange={setFilterFrom}
              onToChange={setFilterTo}
            />
          </div>
        </div>
      </header>

      {isMyTasksView ? (
        <nav className="scope-chips" aria-label={t('nav.myTasks', 'Görevlerim')}>
          {MY_TASK_VIEWS.map(view => (
            <button
              key={view.value}
              type="button"
              className={`scope-chip ${getScopeChipColorClass(view.value)}${view.value === currentMyTaskView ? ' active' : ''}`}
              onClick={() => setMyTaskView(view.value)}
            >
              {t(view.labelKey)}
            </button>
          ))}
          {showRequestFlowFilters ? (
            <>
              <span className="scope-chip-divider" aria-hidden="true">|</span>
              {REQUEST_FLOW_FILTERS.map(filter => (
                <button
                  key={filter.value}
                  type="button"
                  className={`scope-chip scope-chip--${filter.value}${filter.value === currentRequestFlowFilter ? ' active' : ''}`}
                  onClick={() => setRequestFlowFilter(filter.value)}
                >
                  {t(filter.labelKey)}
                </button>
              ))}
            </>
          ) : null}
        </nav>
      ) : isDepartmentTasksView ? (
        <nav className="scope-chips" aria-label={t('nav.departmentTasks', 'Birimdeki Görevler')}>
          {DEPARTMENT_STATUS_VIEWS.map(view => (
            <button
              key={view.value}
              type="button"
              className={`scope-chip ${getScopeChipColorClass(view.value)}${view.value === currentMyTaskView ? ' active' : ''}`}
              onClick={() => setMyTaskView(view.value)}
            >
              {t(view.labelKey)}
            </button>
          ))}
          <span className="scope-chip-divider" aria-hidden="true">|</span>
          {DEPARTMENT_TASK_FLOWS.map(flow => (
            <button
              key={flow.value}
              type="button"
              className={`scope-chip scope-chip--${flow.value}${flow.value === currentRequestFlowFilter ? ' active' : ''}`}
              onClick={() => setDepartmentTaskFlow(flow.value)}
            >
              {t(flow.labelKey)}
            </button>
          ))}
        </nav>
      ) : isStaffTasksView ? (
        <nav className="scope-chips">
          {staffUsers.map(item => (
            <button
              key={item.userId}
              type="button"
              className={`scope-chip scope-chip--pending${currentStaffUserId === item.userId ? ' active' : ''}`}
              onClick={() => setStaffUserFilter(item.userId)}
            >
              {item.displayName}
            </button>
          ))}
          <button
            type="button"
            className={`scope-chip scope-chip--pending${currentStaffUserId === 'all' ? ' active' : ''}`}
            onClick={() => setStaffUserFilter('all')}
          >
            {t('tasks.staff.allStaff', 'Tüm Personel')}
          </button>
          <span className="scope-chip-divider" aria-hidden="true">|</span>
          <button
            type="button"
            className={`scope-chip scope-chip--pending${currentStaffTaskType === 'assigned' ? ' active' : ''}`}
            onClick={() => setStaffTaskTypeFilter('assigned')}
          >
            {t('tasks.staff.assignedTasks', 'Atanmış Görevleri')}
          </button>
          <button
            type="button"
            className={`scope-chip scope-chip--pending${currentStaffTaskType === 'routine' ? ' active' : ''}`}
            onClick={() => setStaffTaskTypeFilter('routine')}
          >
            {t('tasks.staff.routineTasks', 'Rutin Görevleri')}
          </button>
          <button
            type="button"
            className={`scope-chip scope-chip--pending${currentStaffTaskType === 'all' ? ' active' : ''}`}
            onClick={() => setStaffTaskTypeFilter('all')}
          >
            {t('tasks.staff.allTasks', 'Tüm Görevleri')}
          </button>
        </nav>
      ) : (
        <nav className="scope-chips">
          {scopes.map(scope => (
            <button
              key={scope}
              type="button"
              className={`scope-chip${scope === currentScope ? ' active' : ''}`}
              onClick={() => setSearchParams({ scope })}
            >
              {t(SCOPES.find(s => s.value === scope)!.labelKey)}
            </button>
          ))}
        </nav>
      )}

      {selectedTask && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
          onClick={closeTaskDetail}
          role="presentation"
        >
          <section
            className="detail-modal-shell flex max-h-[min(85dvh,52rem)] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Sabit başlık — scroll edilse bile yerinde kalır (card 1) */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
              <div className="min-w-0">
                <div className="text-[0.75rem] font-extrabold uppercase tracking-[0.18em] text-slate-600 leading-tight">
                  {detailScopeLabel}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isMyTasksView && canCompleteTask && (
                  <Button type="button" variant="success" onClick={() => handleComplete(taskDetail.taskId)}>
                    {t('tasks.actions.complete', 'Tamamla')}
                  </Button>
                )}
                {isMyTasksView && canCompleteTask && (
                  <Button type="button" variant="destructive" onClick={() => openReturnModal(taskDetail.taskId)}>
                    {t('tasks.actions.cancelTask', 'Görevi İptal Et')}
                  </Button>
                )}
                {taskDetail
                  && (isDepartmentTasksView || isStaffTasksView)
                  && isManagerLike
                  && (taskDetail.currentStatus === 'Assigned' || taskDetail.currentStatus === 'InProgress') && (
                    <Button type="button" variant="destructive" onClick={() => openReturnModal(taskDetail.taskId)}>
                      {t('tasks.actions.cancelTask', 'Görevi İptal Et')}
                    </Button>
                )}
                {taskDetail && (
                  <Button type="button" variant="secondary" onClick={() => printTaskDetail(taskDetail, locale)}>
                    {t('common.print', 'Yazdır')}
                  </Button>
                )}
                <button
                  type="button"
                  onClick={closeTaskDetail}
                  className="flex size-8 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
                  aria-label={t('common.close', 'Kapat')}
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Kaydırılabilir içerik alanı */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading ? (
                <div className="loading">{t('common.loading')}</div>
              ) : taskDetail ? (
                <>
                  {/* Görev bilgi kutusu — birleşik detay alanı ve sağda tamamla kartı */}
                  <section className="mb-5">
                    <div className={`grid gap-4 ${canCompleteTask ? 'lg:grid-cols-[minmax(0,1.7fr)_minmax(14rem,0.75fr)]' : ''} lg:items-stretch`}>
                      <div className="form-card page-stack min-w-0">
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <div className="text-sm font-semibold text-emerald-600">
                              {t('tasks.detail.title', 'Görev Detayları')}
                            </div>
                            <div className="grid gap-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,1fr)]">
                              <div className="min-w-0 divide-y divide-slate-100">
                                {[
                                  { label: 'Görev No', value: formatTaskDisplayNumber(selectedTask) },
                                  { label: 'Görev Başlığı', value: taskDetail.title },
                                  {
                                    label: 'Talep Yeri / Oluşturan',
                                    value: [selectedTask.ownerDepartmentName, selectedTask.createdByDisplayName].filter(Boolean).join(' / ') || '—',
                                  },
                                  { label: 'Görev Sahibi', value: taskDetail.ownerDisplayName || '—' },
                                  {
                                    label: 'Görev Tipi',
                                    value: `${taskDetail.jobSourceType === 'Routine'
                                      ? t('tasks.type.routine', 'Rutin')
                                      : t('tasks.type.assigned', 'Atanmış')}${taskDetail.assigningManagerDisplayName ? ` (${taskDetail.assigningManagerDisplayName})` : ''}`,
                                  },
                                  ...(taskDetail.jobSourceType !== 'Routine'
                                    ? [{
                                        label: 'Proje mi',
                                        value: parentJobDetail?.isProject
                                          ? t('common.yes', 'Evet')
                                          : t('common.no', 'Hayır'),
                                      }]
                                    : []),
                                ].map(({ label, value }) => (
                                  <div key={label} className="flex items-start gap-2 px-3 py-2">
                                    <span className="w-36 shrink-0 pt-0.5 text-xs font-semibold text-slate-500">{label}</span>
                                    <span className="min-w-0 break-words text-sm text-slate-900">{value}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
                                <div className="divide-y divide-slate-100">
                                  {[
                                    { label: 'Öncelik', value: getPriorityLabel(t, taskDetail.priority) },
                                    { label: 'Durum', value: getTaskDisplayStatus(t, taskDetail) },
                                    { label: 'Görev Tarihi', value: formatDateTime(taskDetail.createdAtUtc, locale) },
                                    { label: 'Son Tarih', value: formatDateTime(taskDetail.dueDateUtc, locale) },
                                  ].map(({ label, value }) => (
                                    <div key={label} className="flex flex-col gap-0.5 px-4 py-2">
                                      <span className="text-xs font-semibold text-slate-500">{label}</span>
                                      <span className="text-sm text-slate-900">{value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
                                <div className="border-b border-slate-200 px-4 py-2">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {t('tasks.detail.description', 'Açıklama')}
                                  </span>
                                </div>
                                <div className="px-4 py-3">
                                  <div className="whitespace-pre-wrap text-sm leading-6 text-slate-900">
                                    {stripHtmlTags(taskDetail.description) || t('tasks.detail.noDescription', 'Açıklama yok')}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {canCompleteTask && (
                        <section className="form-card flex h-full min-w-0 flex-col gap-2.5 self-stretch">
                          <div>
                            <h3 className="text-lg font-extrabold text-slate-950">
                              {t('tasks.actions.completeTitle', 'Görevi Tamamla')}
                            </h3>
                            <p className="helper-copy">
                              {t('tasks.actions.completeHelp', 'İsteğe bağlı tamamlama notu ekleyebilirsiniz.')}
                            </p>
                          </div>
                          <label className="job-field mt-3">
                            <span className="job-field-label">
                              {t('tasks.actions.completionNote', 'Tamamlama Notu')}
                            </span>
                            <textarea
                              className="field-textarea min-h-24"
                              rows={2}
                              value={completionNote}
                              onChange={e => setCompletionNote(e.target.value)}
                              placeholder={t('tasks.actions.completionNotePlaceholder', 'Tamamlama hakkında not ekleyin...')}
                            />
                          </label>
                          <div className="inline-actions justify-end pt-2">
                            <Button type="button" variant="primary" onClick={() => handleComplete(taskDetail.taskId)}>
                              {t('tasks.actions.complete', 'Tamamla')}
                            </Button>
                          </div>
                        </section>
                      )}
                    </div>
                  </section>

                  {/* İlgili Talep Detayları — Görev Detayları kutusunun hemen altında etiketli özet (card 388).
                      Rutin görevlerde talep olmadığı için bu bölüm gösterilmez (card 395). */}
                  {parentJobDetail && taskDetail.jobSourceType !== 'Routine' && (() => {
                    const ownerJobDepartment = parentJobDetail.departments.find(
                      dept => dept.departmentId === parentJobDetail.ownerDepartmentId,
                    )
                    const isCrossDepartmentRequest =
                      taskDetail.assignedDepartmentId != null &&
                      taskDetail.assignedDepartmentId !== parentJobDetail.ownerDepartmentId
                    const coordinatingDepartmentNames = parentJobDetail.departments
                      .filter(department =>
                        (department.role === 'Target' || department.role === 'Coordinating')
                        && department.departmentId !== taskDetail.assignedDepartmentId)
                      .map(department => department.departmentName)
                      .filter((name): name is string => Boolean(name))
                    const leftFields = [
                      {
                        label: 'Talep No',
                        value: parentJobDetail.jobNumber
                          ? `T-${parentJobDetail.jobNumberYear}-${parentJobDetail.jobNumber}`
                          : '—',
                      },
                      { label: 'Talep Başlığı', value: parentJobDetail.title },
                      {
                        label: 'Talep Sahibi / Onaylayan',
                        value: [parentJobDetail.createdByDisplayName, ownerJobDepartment?.approvedByDisplayName]
                          .filter(Boolean)
                          .join(' / ') || '—',
                      },
                      {
                        label: 'Proje mi',
                        value: parentJobDetail.isProject
                          ? t('common.yes', 'Evet')
                          : t('common.no', 'Hayır'),
                      },
                      ...(coordinatingDepartmentNames.length > 0
                        ? [{
                            label: 'Koordine Departmanlar',
                            value: coordinatingDepartmentNames.join(', '),
                          }]
                        : []),
                    ]
                    const rightFields = [
                      { label: 'Öncelik', value: getPriorityLabel(t, parentJobDetail.priority) },
                      { label: 'Talep Tarihi', value: formatDateTime(parentJobDetail.createdAtUtc, locale) },
                      {
                        label: isCrossDepartmentRequest
                          ? "Talebi Oluşturan Departman'ın Onay Tarihi"
                          : 'Talep Onay Tarihi',
                        value: formatDateTime(ownerJobDepartment?.decidedAtUtc ?? null, locale),
                      },
                      { label: 'Son Tarih Bilgisi', value: formatDateTime(parentJobDetail.dueDateUtc, locale) },
                    ]
                    return (
                      <section className="form-card page-stack mb-5">
                        <div className="text-sm font-semibold text-emerald-600">
                          {t('tasks.detail.parentJobTitle', 'İlgili Talep Detayları')}
                        </div>
                        <div className="grid gap-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 lg:grid-cols-2">
                          <div className="min-w-0 divide-y divide-slate-100">
                            {leftFields.map(({ label, value }) => (
                              <div key={label} className="flex items-start gap-2 px-3 py-2">
                                <span className="w-40 shrink-0 pt-0.5 text-xs font-semibold text-slate-500">{label}</span>
                                <span className="min-w-0 break-words text-sm text-slate-900">{value}</span>
                              </div>
                            ))}
                          </div>
                          <div className="border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
                            <div className="divide-y divide-slate-100">
                              {rightFields.map(({ label, value }) => (
                                <div key={label} className="flex items-start gap-2 px-3 py-2">
                                  <span className="w-40 shrink-0 pt-0.5 text-xs font-semibold text-slate-500">{label}</span>
                                  <span className="min-w-0 break-words text-sm text-slate-900">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </section>
                    )
                  })()}

                  <div className={`grid gap-4 ${isManagerLike ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>

                    {/* Sütun 1: Görevi Yönlendir */}
                    {isManagerLike && (
                      <section className="form-card page-stack">
                        <>
                          <div>
                            <h3 className="text-base font-extrabold text-slate-950">Görevi Yönlendir</h3>
                            <p className="helper-copy">
                              Mevcut:{' '}
                              {taskDetail.assignedUserId
                                ? getUserName(taskDetail.assignedUserId)
                                : taskDetail.assignedDepartmentId
                                  ? getDepartmentName(taskDetail.assignedDepartmentId)
                                : t('tasks.unassigned', 'Atanmamış')}
                            </p>
                          </div>
                          <div className="grid gap-3">
                            <label className="job-field">
                              <span className="job-field-label">{t('tasks.draftUser')}</span>
                              {/* Personel seçiniz dropdown yukarı doğru açılır (card 464) */}
                              <SingleSelectDropdown
                                options={assignmentUsers.map(u => ({ value: u.userId, label: u.displayName }))}
                                value={assignmentDraft.userId}
                                onChange={uid => {
                                  const u = users.find(item => item.userId === uid)
                                  setAssignmentDraft(cur => ({
                                    departmentId: u?.departmentId ?? cur.departmentId,
                                    userId: uid,
                                  }))
                                }}
                                placeholder={t('tasks.userSelection', 'Personel seçiniz')}
                                emptyText={t('jobs.actions.noStaffFound', 'Birimde personel bulunamadı.')}
                                triggerClassName="h-8 min-h-8 py-1 text-xs"
                                openUp
                                disabled={assignmentSaving}
                              />
                            </label>
                          </div>
                          <div className="inline-actions justify-end pt-2">
                            <Button
                              type="button"
                              size="default"
                              className="h-9 px-4 text-sm"
                              disabled={assignmentSaving || (!assignmentDraft.departmentId && !assignmentDraft.userId)}
                              onClick={saveAssignment}
                            >
                              {assignmentSaving ? t('common.loading') : t('tasks.actions.route', 'Yönlendir')}
                            </Button>
                          </div>
                        </>
                      </section>
                    )}

                    {/* Sütun 2: Atama Geçmişi */}
                    <section className="form-card page-stack">
                      <h3 className="text-lg font-extrabold text-slate-950">
                        {t('tasks.detail.assignmentHistory', 'Atama Geçmişi')}
                      </h3>
                      {taskDetail.assignmentHistory.length > 0 ? (
                        <div className="grid gap-2">
                          {taskDetail.assignmentHistory.map(item => (
                            <div
                              key={item.assignmentId}
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                            >
                              <div className="font-semibold text-slate-950">
                                {getDepartmentName(item.toDepartmentId)} · {getUserName(item.toUserId)}
                              </div>
                              <div className="text-xs text-slate-500">
                                {new Date(item.actionDateUtc).toLocaleString(locale)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state">
                          {t('tasks.detail.noAssignmentHistory', 'Atama geçmişi yok')}
                        </div>
                      )}
                    </section>
                    {/* Sütun 3: Yönetici Notu — Atama Geçmişi'nin sağında, ilgili talebin notu, salt-okunur (card 468) */}
                    <section className="form-card page-stack">
                      <h3 className="text-lg font-extrabold text-slate-950">
                        {t('jobs.managerNote.title', 'Yönetici Notu')}
                      </h3>
                      {parentJobDetail?.managerNote ? (
                        <p className="whitespace-pre-wrap text-sm text-slate-800">{parentJobDetail.managerNote}</p>
                      ) : (
                        <div className="empty-state">{t('jobs.managerNote.empty', 'Yönetici Notu girilmemiş')}</div>
                      )}
                    </section>
                    {/* Sütun 4: Ekler / Fotoğraflar */}
                    <section className="form-card page-stack">
                      <h3 className="text-lg font-extrabold text-slate-950">
                        {t('attachments.sectionTitle', 'Ekler / Fotoğraflar')}
                      </h3>
                      <AttachmentSection
                        attachments={taskDetail.attachments ?? []}
                        onUpload={async file => {
                          setAttachmentUploading(true)
                          try {
                            await api.uploadTaskAttachment(taskDetail.taskId, file)
                            setTaskDetail(await api.getTaskById(taskDetail.taskId))
                          } finally {
                            setAttachmentUploading(false)
                          }
                        }}
                        onDelete={async id => {
                          await api.deleteAttachment(id)
                          setTaskDetail(await api.getTaskById(taskDetail.taskId))
                        }}
                        disabled={attachmentUploading}
                      />
                    </section>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        </div>,
        document.body
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : (
        <section className="section-card desktop-page-fill">
          <div className="table-wrap desktop-panel-scroll">
            <table className={`data-table jobs-table data-table--zebra${isDepartmentTasksView ? ' department-tasks-table' : ''}`}>
              <thead>
                <tr>
                  <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                  <FilterableTh filterKey="jobNumber" filterValue={taskFilters['jobNumber'] ?? ''} onFilter={setTaskFilter} sortKey="jobNumber" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.parentRequestNo', 'Bağlı Olduğu Talep No')}</FilterableTh>
                  <FilterableTh filterKey="taskNumber" filterValue={taskFilters['taskNumber'] ?? ''} onFilter={setTaskFilter} sortKey="taskNumber" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.taskNo', 'Görev No')}</FilterableTh>
                  <FilterableTh filterKey="createdAtUtc" filterValue={taskFilters['createdAtUtc']} onFilter={setTaskFilter} sortKey="createdAtUtc" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.taskDate', 'Görev Tarihi')}</FilterableTh>
                  <FilterableTh filterKey="ownerDepartmentName" filterValue={taskFilters['ownerDepartmentName']} onFilter={setTaskFilter} sortKey="ownerDepartmentName" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.ownerDepartmentCreator', 'Görevin Talep Yeri/Oluşturan')}</FilterableTh>
                  <FilterableTh filterKey="title" filterValue={taskFilters['title']} onFilter={setTaskFilter} sortKey="title" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.title', 'Başlık')}</FilterableTh>
                  {isDepartmentTasksView && (
                    <FilterableTh filterKey="taskOwnerDisplayName" filterValue={taskFilters['taskOwnerDisplayName'] ?? ''} onFilter={setTaskFilter} sortKey="taskOwnerDisplayName" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.owner', 'Görev Sahibi')}</FilterableTh>
                  )}
                  {(isStaffTasksView || isMyTasksView || isDepartmentTasksView) && (
                    <FilterableTh filterKey="jobSourceType" filterValue={taskFilters['jobSourceType'] ?? ''} onFilter={setTaskFilter} sortKey="jobSourceType" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.taskType', 'Görev Tipi')}</FilterableTh>
                  )}
                  {!((isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'rejected') && <FilterableTh filterKey="dueDateUtc" filterValue={taskFilters['dueDateUtc']} onFilter={setTaskFilter} sortKey="dueDateUtc" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.dueDate', 'Son Tarih')}</FilterableTh>}
                  {(isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'completed' && <FilterableTh filterKey="completedAtUtc" filterValue={taskFilters['completedAtUtc'] ?? ''} onFilter={setTaskFilter} sortKey="completedAtUtc" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.completedAt', 'Tamamlanma Tarihi')}</FilterableTh>}
                  {(isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'rejected' && <FilterableTh filterKey="updatedAtUtc" filterValue={taskFilters['updatedAtUtc'] ?? ''} onFilter={setTaskFilter} sortKey="updatedAtUtc" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.cancelledAt', 'İptal Tarihi')}</FilterableTh>}
                  {isMyTasksView && currentMyTaskView === 'all' && <FilterableTh filterKey="currentStatus" filterValue={taskFilters['currentStatus'] ?? ''} onFilter={setTaskFilter} sortKey="currentStatus" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.status', 'Durum')}</FilterableTh>}
                  <th>{t('tasks.columns.actions', 'İşlemler')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedTasks.length === 0 && (
                  <tr>
                    <td colSpan={99} className="empty-state text-center">
                      {isMyTasksView
                        ? t('tasks.myViews.empty', { view: currentMyTaskViewLabel, defaultValue: `${currentMyTaskViewLabel} bulunmuyor` })
                        : isDepartmentTasksView
                          ? t('tasks.departmentTasksEmpty', { view: currentDepartmentStatusViewLabel, defaultValue: `${currentDepartmentStatusViewLabel} bulunmuyor` })
                          : isStaffTasksView
                            ? t('tasks.staff.empty', { staff: currentStaffUserLabel, defaultValue: `${currentStaffUserLabel} için görev bulunmuyor` })
                            : t('tasks.empty', 'No tasks')}
                    </td>
                  </tr>
                )}
                {pagedTasks.map((task, index) => (
                  // Üst Düzey Yönetici'den gelen talebin görevi: satır sarı (dikkat).
                  <tr key={task.taskId} className={task.createdByRoleCode === 'Reporter' ? 'row-attention' : undefined}>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(tasksPage - 1) * tasksPageSize + index + 1}</td>
                    <td className="table-number-cell text-xs text-slate-500">
                      {task.jobSourceType === 'Routine'
                        ? <div className="table-number-cell__value font-sans italic text-slate-400">{t('tasks.columns.routineNoParentRequest', "Rutin görevin Talep No'su olmaz")}</div>
                        : <div className="table-number-cell__value font-mono">{formatTaskJobDisplayNumber(task)}</div>}
                    </td>
                    <td className="table-number-cell font-mono text-xs text-slate-500">
                      <div className="table-number-cell__value">{formatTaskDisplayNumber(task)}</div>
                      <div className={`table-number-cell__priority font-sans font-bold ${task.createdByRoleCode === 'Reporter' && task.priority === 'Normal' ? 'text-white' : getPriorityColorClass(task.priority)}`}>(Öncelik:{getPriorityLabel(t, task.priority)})</div>
                    </td>
                    <td><DateCell value={task.createdAtUtc} locale={locale} /></td>
                    {/* Talep eden müdürlük (üst) ve talebi oluşturan kullanıcı (alt), dar ve ortalı. */}
                    <td>
                      <div className="mx-auto max-w-[11rem] text-center">
                        <div className="truncate font-semibold text-slate-700">{task.ownerDepartmentName ?? '—'}</div>
                        <div className="truncate text-xs text-slate-500">{task.createdByDisplayName ?? '—'}</div>
                      </div>
                    </td>
                    <td>{task.title}</td>
                    {isDepartmentTasksView && (
                      <td>{task.assignedUserDisplayName ?? task.ownerDisplayName ?? '—'}</td>
                    )}
                    {(isStaffTasksView || isMyTasksView || isDepartmentTasksView) && (
                      <td>
                        <StatusPill tone={task.jobSourceType === 'Routine' ? 'neutral' : 'success'}>
                          {task.jobSourceType === 'Routine' ? t('tasks.type.routine', 'Rutin') : t('tasks.type.assigned', 'Atanmış')}
                        </StatusPill>
                      </td>
                    )}
                    {!((isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'rejected') && <td><DueDatePill value={task.dueDateUtc} completedAtUtc={task.completedAtUtc} locale={locale} /></td>}
                    {(isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'completed' && <td><DateCell value={task.completedAtUtc ?? null} locale={locale} /></td>}
                    {(isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'rejected' && <td><DateCell value={task.updatedAtUtc ?? null} locale={locale} /></td>}
                    {isMyTasksView && currentMyTaskView === 'all' && <td><StatusPill tone="neutral">{getTaskDisplayStatus(t, task)}</StatusPill></td>}
                    <td className="actions-cell">
                      <div className="request-actions">
                        <Button size="sm" variant="secondary" onClick={() => void openTaskDetail(task)}>{t('tasks.actions.details', 'Detaylar')}</Button>
                        {isDepartmentTasksView && isManagerLike && task.assignedDepartmentId && (
                          task.currentStatus === 'Waiting' ||
                          task.currentStatus === 'Assigned' ||
                          task.currentStatus === 'InProgress' ||
                          task.currentStatus === 'PendingCloseApproval'
                        ) && (
                          <Button size="sm" className="task-route-button" onClick={() => openDepartmentRouteModal(task)}>
                            {t('tasks.actions.routeTask', 'Görevi Yönlendir')}
                          </Button>
                        )}
                        {currentScope === 'department-pool' && !task.assignedUserId && (
                          <Button size="sm" onClick={() => handleClaim(task.taskId)}>{t('tasks.actions.claim', 'Claim')}</Button>
                        )}
                        {(() => {
                          const canComplete = isMyTasksView && isAssignee(task) && (task.currentStatus === 'Assigned' || task.currentStatus === 'InProgress')
                          if (canComplete) {
                            return <Button size="sm" variant="success" onClick={() => handleComplete(task.taskId)}>{t('tasks.actions.complete', 'Tamamla')}</Button>
                          }
                          if (isMyTasksView && currentMyTaskView === 'all') {
                            return <DisabledActionButton size="sm" variant="success" hoverTitle={t('tasks.actions.completeUnavailable', 'Bu görev şu an tamamlanamaz')}>{t('tasks.actions.complete', 'Tamamla')}</DisabledActionButton>
                          }
                          return null
                        })()}
                        {(() => {
                          const canCancel = (isDepartmentTasksView || (isMyTasksView && isAssignee(task))) && (task.currentStatus === 'Assigned' || task.currentStatus === 'InProgress')
                          if (canCancel) {
                            return (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (task.createdByRoleCode === 'Reporter' && !isManagerLike) {
                                    setConfirmDialog({
                                      title: t('tasks.actions.cancelNotAllowed', 'İptal Yetkiniz Yok'),
                                      message: t('tasks.actions.cancelManagerTaskNotAllowed', 'Üst Düzey Yönetici\'den gelen talebin görevini iptal etme yetkiniz bulunmamaktadır. Görev iadesi için yöneticinizle iletişime geçiniz.'),
                                      onConfirm: () => setConfirmDialog(null),
                                      confirmLabel: t('common.ok', 'Tamam'),
                                      hideCancel: true
                                    })
                                  } else {
                                    openReturnModal(task.taskId)
                                  }
                                }}
                              >
                                {t('jobs.actions.cancel', 'İptal Et')}
                              </Button>
                            )
                          }
                          if (isMyTasksView && currentMyTaskView === 'all') {
                            return <DisabledActionButton size="sm" variant="destructive" hoverTitle={t('tasks.actions.cancelUnavailable', 'Bu görev şu an iptal edilemez')}>{t('jobs.actions.cancel', 'İptal Et')}</DisabledActionButton>
                          }
                          return null
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            totalCount={columnFilteredTasks.length}
            pageSize={tasksPageSize}
            currentPage={tasksPage}
            onPageSizeChange={setTasksPageSize}
            onPageChange={setTasksPage}
          />
        </section>
      )}

      {returnModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeReturnModal}
        >
          <div className="form-card page-stack relative w-full max-w-md" onClick={e => e.stopPropagation()}>
            {/* Sağ üstte kapatma (X) ikonu. */}
            <button
              type="button"
              onClick={closeReturnModal}
              aria-label={t('common.close', 'Kapat')}
              className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <X className="size-4" />
            </button>

            {returnModal.step === 'cancel' && (
              <>
                <h2 className="text-xl font-extrabold text-slate-950">{t('tasks.actions.cancelTask', 'Görevi İptal Et')}</h2>
                <p className="helper-copy">{t('tasks.actions.cancelHelp', 'Görevi iptal etmek için neden belirtiniz.')}</p>
                <label className="job-field">
                  <span className="job-field-label">{t('tasks.actions.cancelReason', 'İptal Nedeni')}</span>
                  <textarea
                    className="field-textarea"
                    rows={3}
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    placeholder={t('tasks.actions.cancelReasonPlaceholder', 'İptal nedenini açıklayınız...')}
                    autoFocus
                  />
                </label>
                <div className="inline-actions">
                  <Button type="button" variant="secondary" onClick={closeReturnModal}>
                    {t('common.dismiss', 'Vazgeç')}
                  </Button>
                  <Button type="button" variant="destructive" disabled={returnSaving || !cancelReason.trim()} onClick={() => void handleCancelTask()}>
                    {returnSaving ? t('common.loading') : t('tasks.actions.cancelTask', 'Görevi İptal Et')}
                  </Button>
                </div>
              </>
            )}

            {/* ── Görev Yönlendir (Manager) ── */}
            {returnModal.step === 'return' && (
              <>
                <h2 className="text-xl font-extrabold text-slate-950">
                  {t('tasks.actions.redirectReporterTaskWithinUnit', 'Görevi Birim İçi Yönlendir')}
                </h2>
                <p className="helper-copy">{t('tasks.actions.returnUnitHelp', 'Görev sadece aynı birim içinde yönlendirilebilir.')}</p>
                <div className="job-field">
                  <span className="job-field-label">{t('tasks.department', 'Birim')}</span>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    {departments.find(d => d.departmentId === returnModal.assignedDepartmentId)?.name ?? '—'}
                  </div>
                </div>
                <label className="job-field">
                  <span className="job-field-label">{t('tasks.draftUser', 'Kullanıcı (isteğe bağlı)')}</span>
                  <select className="field-select" value={returnUserId} onChange={e => setReturnUserId(e.target.value)}>
                    <option value="" disabled hidden>
                      {t('tasks.userSelection', 'Personel seçiniz')}
                    </option>
                    {returnDeptUsers.map(u => (
                      <option key={u.userId} value={u.userId}>{u.displayName}</option>
                    ))}
                  </select>
                </label>
                <div className="inline-actions">
                  <Button type="button" variant="secondary" onClick={closeReturnModal}>
                    {t('common.exit', 'Çıkış')}
                  </Button>
                  <Button
                    type="button"
                    variant="success"
                    disabled={returnSaving || !returnDeptId}
                    onClick={() => void handleReturn()}
                  >
                    {returnSaving ? t('common.loading') : t('tasks.actions.route', 'Yönlendir')}
                  </Button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
      {successToast && (
        <Toast message={successToast} onClose={() => setSuccessToast(null)} />
      )}
    </div>
  )
}
