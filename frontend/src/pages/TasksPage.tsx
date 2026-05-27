import { ClipboardCheck, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { AttachmentSection } from '../components/ui/AttachmentSection'
import { Button } from '../components/ui/button'
import { PromptDialog } from '../components/ui/prompt-dialog'
import type { PromptDialogState } from '../components/ui/prompt-dialog'
import { RichTextContent } from '../components/ui/RichTextContent'
import { StatusPill } from '../components/ui/status-pill'
import { useAuth } from '../context/AuthContext'
import type { Department, Task, TaskDetail, TaskListScope, User } from '../types/platform'
import { formatAuditNotes, getAuditActionLabel, getAuditStatusLabel, getLocale, getPriorityLabel, getTaskStatusLabel } from '../utils/localization'
import { TablePagination } from '../components/ui/table-pagination'

interface TaskScopeFiltersProps {
  searchText: string
  filterYear: string
  availableYears: string[]
  onSearch: (v: string) => void
  onYearChange: (v: string) => void
}
function TaskScopeFilters({ searchText, filterYear, availableYears, onSearch, onYearChange }: TaskScopeFiltersProps) {
  return (
    <div className="scope-chips-filters">
      <div className="scope-chip-search-wrap">
        <Search className="size-3 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          className="scope-chip-search-input"
          placeholder="Ara..."
          value={searchText}
          onChange={e => onSearch(e.target.value)}
        />
      </div>
      <select
        className="scope-chip-year-select"
        value={filterYear}
        onChange={e => onYearChange(e.target.value)}
      >
        <option value="">Yıl Seçimi</option>
        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}

const SCOPES: { value: TaskListScope; labelKey: string }[] = [
  { value: 'pending-approval', labelKey: 'tasks.scopes.pendingApproval' },
  { value: 'department-pool', labelKey: 'tasks.scopes.departmentPool' },
  { value: 'all', labelKey: 'tasks.scopes.all' },
]

type MyTaskView = 'pending' | 'completed' | 'rejected' | 'all'
type RequestFlowFilter = 'internal' | 'external' | 'all'
type TasksPageMode = 'default' | 'departmentTasks' | 'staffTasks'

const MY_TASK_VIEWS: { value: MyTaskView; labelKey: string }[] = [
  { value: 'pending', labelKey: 'tasks.myViews.pending' },
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

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function printTaskDetail(taskDetail: TaskDetail, locale: string) {
  const win = window.open('', '_blank', 'width=820,height=900')
  if (!win) return
  const fd = (d: string | null | undefined) => d ? new Date(d).toLocaleString(locale, { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'
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
    <div class="desc">${taskDetail.description ?? '<em>Açıklama yok</em>'}</div>
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

function getMyTaskView(value: string | null): MyTaskView {
  if (value === 'returned') return 'rejected'
  return value === 'completed' || value === 'rejected' || value === 'all' ? value : 'pending'
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
  if (value === 'all') return 'scope-chip--all'
  return ''
}

function matchesRequestFlow(requestType: Task['jobRequestType'], filter: RequestFlowFilter): boolean {
  if (filter === 'internal') return requestType === 'InternalUnit'
  if (filter === 'external') return requestType === 'ExternalUnit'
  return requestType === 'InternalUnit' || requestType === 'ExternalUnit'
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

  return tasks.filter(task => !['Completed', 'Cancelled', 'Rejected', 'RevisionRequested'].includes(task.currentStatus))
}

export function TasksPage({ fixedScope, mode = 'default' }: TasksPageProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const locale = getLocale(i18n.language)
  const [searchParams, setSearchParams] = useSearchParams()
  const [tasks, setTasks] = useState<Task[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasksPage, setTasksPage] = useState(1)
  const [tasksPageSize, setTasksPageSize] = useState(25)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const taskAuditLogQuery = useQuery({
    queryKey: ['task-audit-log', taskDetail?.taskId],
    queryFn: () => api.getTaskAuditLog(taskDetail!.taskId),
    enabled: !!taskDetail?.taskId,
  })
  const [assignmentDraft, setAssignmentDraft] = useState({ departmentId: '', userId: '' })
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [returnModal, setReturnModal] = useState<{ taskId: string } | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const [returnSaving, setReturnSaving] = useState(false)
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | null>(null)
  const [filterYear, setFilterYear] = useState('')
  const [searchText, setSearchText] = useState('')

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
    return new Set(departments.filter(department => department.managerUserId === user?.userId).map(department => department.departmentId))
  }, [departments, user?.userId])
  const staffUsers = useMemo(() => {
    return activeUsers.filter(item =>
      userBelongsToAnyDepartment(item, managedDepartmentIds) &&
      item.userId !== user?.userId &&
      item.roleCode !== 'Manager' &&
      item.roleCode !== 'SystemAdmin')
  }, [activeUsers, managedDepartmentIds, user?.userId])
  const staffUserIds = useMemo(() => new Set(staffUsers.map(item => item.userId)), [staffUsers])
  const staffUserParam = searchParams.get('userId') ?? 'all'
  const currentStaffUserId = staffUserParam !== 'all' && staffUserIds.has(staffUserParam) ? staffUserParam : 'all'
  const currentStaffUserLabel = currentStaffUserId === 'all'
    ? t('tasks.staff.allStaff', 'Tüm Personel')
    : staffUsers.find(item => item.userId === currentStaffUserId)?.displayName ?? t('tasks.staff.allStaff', 'Tüm Personel')
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    for (const task of tasks) {
      const y = task.createdAtUtc?.slice(0, 4)
      if (y) years.add(y)
    }
    return [...years].sort().reverse()
  }, [tasks])

  const visibleTasks = useMemo(() => {
    let result: typeof tasks

    if (isStaffTasksView) {
      const staffTasks = tasks.filter(task => task.assignedUserId && staffUserIds.has(task.assignedUserId))
      result = currentStaffUserId === 'all' ? staffTasks : staffTasks.filter(task => task.assignedUserId === currentStaffUserId)
    } else if (isDepartmentTasksView) {
      result = filterMyTasks(tasks, currentMyTaskView).filter(task => matchesRequestFlow(task.jobRequestType, currentRequestFlowFilter))
    } else if (!isMyTasksView) {
      result = tasks
    } else {
      const myTasks = filterMyTasks(tasks, currentMyTaskView)
      result = showRequestFlowFilters ? myTasks.filter(task => matchesRequestFlow(task.jobRequestType, currentRequestFlowFilter)) : myTasks
    }

    if (filterYear) result = result.filter(task => task.createdAtUtc?.startsWith(filterYear))

    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      result = result.filter(task =>
        task.title.toLowerCase().includes(q) ||
        (task.jobTitle?.toLowerCase().includes(q) ?? false)
      )
    }

    return result
  }, [currentMyTaskView, currentRequestFlowFilter, currentStaffUserId, filterYear, isDepartmentTasksView, isMyTasksView, isStaffTasksView, searchText, showRequestFlowFilters, staffUserIds, tasks])

  const pagedTasks = useMemo(
    () => visibleTasks.slice((tasksPage - 1) * tasksPageSize, tasksPage * tasksPageSize),
    [visibleTasks, tasksPage, tasksPageSize],
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
  }

  const setRequestFlowFilter = (filter: RequestFlowFilter) => {
    const nextParams = new URLSearchParams(searchParams)
    if (filter === 'all') nextParams.delete('flow')
    else nextParams.set('flow', filter)
    setSearchParams(nextParams)
  }

  const setDepartmentTaskFlow = (filter: RequestFlowFilter) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('flow', filter)
    setSearchParams(nextParams)
  }

  const setStaffUserFilter = (userId: string) => {
    const nextParams = new URLSearchParams(searchParams)
    if (userId === 'all') nextParams.delete('userId')
    else nextParams.set('userId', userId)
    setSearchParams(nextParams)
  }

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
  }, [currentScope, t])

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
  }, [currentScope, t])

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
    setPromptDialog({
      title: t('tasks.actions.completePrompt', 'Tamamlama Notu'),
      required: false,
      onConfirm: async (note) => {
        await api.completeTask(taskId, note || undefined)
        await reload()
      },
    })
  }

  const handleClaim = async (taskId: string) => {
    await api.claimTask(taskId)
    await reload()
  }

  const openReturnModal = (taskId: string) => {
    setReturnModal({ taskId })
    setReturnReason('')
  }

  const handleReturn = async () => {
    if (!returnModal || !returnReason.trim()) return
    setReturnSaving(true)
    try {
      await api.requestTaskRevision(returnModal.taskId, returnReason.trim())
      setReturnModal(null)
      setReturnReason('')
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
    setDetailLoading(true)
    setAssignmentDraft({
      departmentId: task.assignedDepartmentId ?? '',
      userId: task.assignedUserId ?? '',
    })
    try {
      const detail = await api.getTaskById(task.taskId)
      setTaskDetail(detail)
      setAssignmentDraft({
        departmentId: detail.assignedDepartmentId ?? '',
        userId: detail.assignedUserId ?? '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (!autoOpenTaskId || selectedTask?.taskId === autoOpenTaskId) return
    const task = tasks.find(item => item.taskId === autoOpenTaskId)
    if (task) {
      void openTaskDetail(task)
    }
  }, [autoOpenTaskId, selectedTask?.taskId, tasks]) // eslint-disable-line react-hooks/exhaustive-deps

  const closeTaskDetail = () => {
    setSelectedTask(null)
    setTaskDetail(null)
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
          {isMyTasksView ? (
            <Button onClick={() => navigate('/routine-tasks/new')} className="shrink-0 gap-2">
              <ClipboardCheck className="size-4" />
              {t('nav.createRoutineTask', 'Rutin Görev Oluştur')}
            </Button>
          ) : null}
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
          <TaskScopeFilters
            searchText={searchText}
            filterYear={filterYear}
            availableYears={availableYears}
            onSearch={setSearchText}
            onYearChange={setFilterYear}
          />
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
          <TaskScopeFilters
            searchText={searchText}
            filterYear={filterYear}
            availableYears={availableYears}
            onSearch={setSearchText}
            onYearChange={setFilterYear}
          />
        </nav>
      ) : isStaffTasksView ? (
        <nav className="scope-chips">
          <label className="scope-chip-staff-label">
            <span className="scope-chip-staff-text">{t('tasks.staff.filterLabel', 'Personel')}</span>
            <select className="scope-chip-year-select" value={currentStaffUserId} onChange={event => setStaffUserFilter(event.target.value)}>
              <option value="all">{t('tasks.staff.allStaff', 'Tüm Personel')}</option>
              {staffUsers.map(item => (
                <option key={item.userId} value={item.userId}>{item.displayName}</option>
              ))}
            </select>
          </label>
          <TaskScopeFilters
            searchText={searchText}
            filterYear={filterYear}
            availableYears={availableYears}
            onSearch={setSearchText}
            onYearChange={setFilterYear}
          />
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
          <TaskScopeFilters
            searchText={searchText}
            filterYear={filterYear}
            availableYears={availableYears}
            onSearch={setSearchText}
            onYearChange={setFilterYear}
          />
        </nav>
      )}

      {selectedTask ? (
        <section className="section-card page-stack">
          <div className="page-header-row">
            <div>
              <div className="page-kicker">{t('tasks.detail.kicker', 'Görev Detayı')}</div>
              <h2 className="text-2xl font-extrabold text-slate-950">{taskDetail?.title ?? selectedTask.title}</h2>
              <p className="helper-copy">{taskDetail?.jobTitle ?? selectedTask.jobTitle ?? t('common.none')}</p>
            </div>
            <div className="inline-actions">
              <Button type="button" variant="secondary" onClick={() => navigate(`/jobs?jobId=${selectedTask.jobId}`)}>
                {t('tasks.actions.viewJob', 'İşi Görüntüle')}
              </Button>
              {taskDetail && (
                <Button type="button" variant="secondary" onClick={() => printTaskDetail(taskDetail, locale)}>
                  {t('common.print', 'Yazdır')}
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={closeTaskDetail}>
                {t('common.close', 'Kapat')}
              </Button>
            </div>
          </div>

          {detailLoading ? (
            <div className="loading">{t('common.loading')}</div>
          ) : taskDetail ? (
            <>
              <div className="info-grid">
                <div className="info-item"><label>{t('tasks.columns.status')}</label><strong>{getTaskStatusLabel(t, taskDetail.currentStatus)}</strong></div>
                <div className="info-item"><label>{t('tasks.columns.priority')}</label><strong>{getPriorityLabel(t, taskDetail.priority)}</strong></div>
                <div className="info-item"><label>{t('tasks.columns.dueDate')}</label><strong>{formatDateTime(taskDetail.dueDateUtc, locale)}</strong></div>
                <div className="info-item"><label>{t('tasks.columns.owner')}</label><strong>{taskDetail.ownerDisplayName ?? '—'}</strong></div>
                <div className="info-item"><label>{t('tasks.columns.createdBy')}</label><strong>{taskDetail.createdByDisplayName ?? '—'}</strong></div>
              </div>

              <div className="job-field">
                <span className="job-field-label">{t('tasks.description', 'Açıklama')}</span>
                <RichTextContent
                  value={taskDetail.description}
                  emptyText={t('common.none')}
                  className="rich-text-content rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="form-card page-stack">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-950">{t('tasks.detail.assignmentTitle', 'Atama')}</h3>
                    <p className="helper-copy">
                      {t('tasks.detail.currentAssignment', 'Mevcut atama')}: {taskDetail.assignedUserId ? getUserName(taskDetail.assignedUserId) : taskDetail.assignedDepartmentId ? getDepartmentName(taskDetail.assignedDepartmentId) : t('tasks.departmentPoolAssignee')}
                    </p>
                  </div>
                  {isManagerLike ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="job-field">
                          <span className="job-field-label">{t('tasks.department')}</span>
                          <select
                            className="field-select"
                            value={assignmentDraft.departmentId}
                            onChange={event => setAssignmentDraft({ departmentId: event.target.value, userId: '' })}
                          >
                            <option value="">{t('tasks.departmentPoolAssignee')}</option>
                            {departments.map(department => (
                              <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                            ))}
                          </select>
                        </label>
                        <label className="job-field">
                          <span className="job-field-label">{t('tasks.draftUser')}</span>
                          <select
                            className="field-select"
                            value={assignmentDraft.userId}
                            onChange={event => {
                              const nextUserId = event.target.value
                              const nextUser = users.find(item => item.userId === nextUserId)
                              setAssignmentDraft(current => ({
                                departmentId: nextUser?.departmentId ?? current.departmentId,
                                userId: nextUserId,
                              }))
                            }}
                          >
                            <option value="">{t('tasks.departmentPoolAssignee')}</option>
                            {assignmentUsers.map(item => (
                              <option key={item.userId} value={item.userId}>{item.displayName}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="inline-actions">
                        <Button type="button" size="sm" disabled={assignmentSaving || (!assignmentDraft.departmentId && !assignmentDraft.userId)} onClick={saveAssignment}>
                          {assignmentSaving ? t('common.loading') : t('tasks.actions.saveAssignment', 'Atamayı Kaydet')}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                      {taskDetail.assignedUserId ? getUserName(taskDetail.assignedUserId) : taskDetail.assignedDepartmentId ? getDepartmentName(taskDetail.assignedDepartmentId) : t('tasks.departmentPoolAssignee')}
                    </div>
                  )}
                </section>

                <section className="form-card page-stack">
                  <h3 className="text-lg font-extrabold text-slate-950">{t('tasks.detail.assignmentHistory', 'Atama Geçmişi')}</h3>
                  {taskDetail.assignmentHistory.length > 0 ? (
                    <div className="grid gap-2">
                      {taskDetail.assignmentHistory.map(item => (
                        <div key={item.assignmentId} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                          <div className="font-semibold text-slate-950">
                            {getDepartmentName(item.toDepartmentId)} · {getUserName(item.toUserId)}
                          </div>
                          <div className="text-xs text-slate-500">{new Date(item.actionDateUtc).toLocaleString(locale)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">{t('tasks.detail.noAssignmentHistory', 'Atama geçmişi yok')}</div>
                  )}
                </section>
              </div>

              <section className="mb-5">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                  {t('attachments.sectionTitle', 'Ekler / Fotoğraflar')}
                </h3>
                <AttachmentSection
                  attachments={taskDetail.attachments ?? []}
                  onUpload={async (file) => {
                    setAttachmentUploading(true)
                    try {
                      await api.uploadTaskAttachment(taskDetail.taskId, file)
                      const refreshed = await api.getTaskById(taskDetail.taskId)
                      setTaskDetail(refreshed)
                    } finally {
                      setAttachmentUploading(false)
                    }
                  }}
                  onDelete={async (id) => {
                    await api.deleteAttachment(id)
                    const refreshed = await api.getTaskById(taskDetail.taskId)
                    setTaskDetail(refreshed)
                  }}
                  disabled={attachmentUploading}
                />
              </section>

              <section className="mb-5">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                  {t('auditLog.title', 'Denetim İzi')}
                </h3>
                {taskAuditLogQuery.isLoading ? (
                  <div className="loading">{t('common.loading')}</div>
                ) : !taskAuditLogQuery.data || taskAuditLogQuery.data.length === 0 ? (
                  <div className="empty-state">{t('auditLog.empty', 'Henüz denetim kaydı bulunmuyor')}</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('auditLog.columns.date', 'Tarih')}</th>
                        <th>{t('auditLog.columns.action', 'İşlem')}</th>
                        <th>{t('auditLog.columns.actor', 'Kullanıcı')}</th>
                        <th>{t('auditLog.columns.status', 'Durum')}</th>
                        <th>{t('auditLog.columns.notes', 'Notlar')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taskAuditLogQuery.data.map(entry => (
                        <tr key={entry.auditLogId}>
                          <td className="text-xs text-slate-500">{new Date(entry.eventTimeUtc).toLocaleString(locale)}</td>
                          <td className="font-semibold">{getAuditActionLabel(t, entry.action)}</td>
                          <td>{entry.actorDisplayName}</td>
                          <td>{entry.statusAtEvent ? getAuditStatusLabel(t, entry.statusAtEvent) : '—'}</td>
                          <td className="text-xs text-slate-500">{entry.notes ? formatAuditNotes(t, entry.notes) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          ) : null}
        </section>
      ) : null}

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : visibleTasks.length === 0 ? (
        <section className="section-card">
          <div className="empty-state">
            {isMyTasksView
              ? t('tasks.myViews.empty', { view: currentMyTaskViewLabel, defaultValue: `${currentMyTaskViewLabel} bulunmuyor` })
              : isDepartmentTasksView
                ? t('tasks.departmentTasksEmpty', { view: currentDepartmentStatusViewLabel, defaultValue: `${currentDepartmentStatusViewLabel} bulunmuyor` })
                : isStaffTasksView
                  ? t('tasks.staff.empty', { staff: currentStaffUserLabel, defaultValue: `${currentStaffUserLabel} için görev bulunmuyor` })
                  : t('tasks.empty', 'No tasks')}
          </div>
        </section>
      ) : (
        <section className="section-card desktop-page-fill">
          <div className="table-wrap desktop-panel-scroll">
            <table className="data-table jobs-table data-table--zebra">
              <thead>
                <tr>
                  <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                  <th>{t('tasks.columns.taskNo', 'Görev No')}</th>
                  <th>{t('tasks.columns.taskDate', 'Görev Tarihi')}</th>
                  <th>{t('tasks.columns.ownerDepartment', 'Görevin Talep Yeri')}</th>
                  <th>{t('tasks.columns.createdBy', 'Oluşturan')}</th>
                  <th>{t('tasks.columns.title', 'Başlık')}</th>
                  <th>{t('tasks.columns.status', 'Durum')}</th>
                  <th>{t('tasks.columns.priority', 'Öncelik')}</th>
                  <th>{t('tasks.columns.dueDate', 'Son Tarih')}</th>
                  <th>{t('tasks.columns.actions', 'İşlemler')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedTasks.map((task, index) => (
                  <tr key={task.taskId}>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(tasksPage - 1) * tasksPageSize + index + 1}</td>
                    <td className="font-mono text-xs text-slate-500">{formatTaskDisplayNumber(task)}</td>
                    <td>{formatDateTime(task.createdAtUtc, locale)}</td>
                    <td className="font-semibold text-slate-700">{task.ownerDepartmentName ?? '—'}</td>
                    <td>{task.createdByDisplayName ?? '—'}</td>
                    <td>{task.title}</td>
                    <td><StatusPill>{getTaskStatusLabel(t, task.currentStatus)}</StatusPill></td>
                    <td>{getPriorityLabel(t, task.priority)}</td>
                    <td>{formatDateTime(task.dueDateUtc, locale)}</td>
                    <td className="actions-cell">
                      <div className="request-actions">
                        <Button size="sm" variant="secondary" onClick={() => void openTaskDetail(task)}>{t('tasks.actions.details', 'Detaylar')}</Button>
                        {currentScope === 'department-pool' && !task.assignedUserId && (
                          <Button size="sm" onClick={() => handleClaim(task.taskId)}>{t('tasks.actions.claim', 'Claim')}</Button>
                        )}
                        {isAssignee(task) && (task.currentStatus === 'Assigned' || task.currentStatus === 'InProgress') && (
                          <Button size="sm" onClick={() => handleComplete(task.taskId)}>{t('tasks.actions.complete', 'Complete')}</Button>
                        )}
                        {isMyTasksView && isAssignee(task) && (task.currentStatus === 'Assigned' || task.currentStatus === 'InProgress') && (
                          <Button size="sm" variant="destructive" onClick={() => openReturnModal(task.taskId)}>{t('tasks.actions.return', 'İade Et')}</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            totalCount={visibleTasks.length}
            pageSize={tasksPageSize}
            currentPage={tasksPage}
            onPageSizeChange={setTasksPageSize}
            onPageChange={setTasksPage}
          />
        </section>
      )}

      {returnModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setReturnModal(null)}
        >
          <div className="form-card page-stack w-full max-w-md" onClick={event => event.stopPropagation()}>
            <h2 className="text-xl font-extrabold text-slate-950">{t('tasks.actions.returnTitle', 'Görevi İade Et')}</h2>
            <p className="helper-copy">{t('tasks.actions.returnHelp', 'Görevi iade etmek için açıklama yazınız.')}</p>
            <label className="job-field">
              <span className="job-field-label">{t('tasks.actions.returnReason', 'İade Açıklaması')}</span>
              <textarea
                className="field-textarea"
                rows={4}
                value={returnReason}
                onChange={event => setReturnReason(event.target.value)}
                placeholder={t('tasks.actions.returnReasonPlaceholder', 'İade nedenini açıklayınız...')}
              />
            </label>
            <div className="inline-actions">
              <Button type="button" variant="secondary" onClick={() => setReturnModal(null)}>{t('common.cancel', 'İptal')}</Button>
              <Button type="button" variant="destructive" disabled={returnSaving || !returnReason.trim()} onClick={() => void handleReturn()}>
                {returnSaving ? t('common.loading') : t('tasks.actions.return', 'İade Et')}
              </Button>
            </div>
          </div>
        </div>
      )}
      <PromptDialog state={promptDialog} onClose={() => setPromptDialog(null)} />
    </div>
  )
}
