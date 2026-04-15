import { ClipboardCheck, ClipboardList, CircleCheckBig, Hourglass } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { AutocompleteField } from '../components/forms/AutocompleteField'
import { Button } from '../components/ui/button'
import { StatusPill } from '../components/ui/status-pill'
import { useAuth } from '../context/AuthContext'
import type { Department, Task, TaskListScope, User } from '../types/platform'
import { getPriorityLabel, getRoleLabel, getTaskStatusLabel, getTaskTypeLabel, getUserSourceLabel } from '../utils/localization'

type TaskAction = 'submit' | 'approve' | 'reject' | 'complete' | 'close'

interface TaskScopeOption {
  value: TaskListScope
  labelKey: string
  descriptionKey: string
}

const TASK_SCOPE_OPTIONS: TaskScopeOption[] = [
  { value: 'mine', labelKey: 'tasks.scopes.mine', descriptionKey: 'tasks.scopeDescriptions.mine' },
  { value: 'department-pool', labelKey: 'tasks.scopes.departmentPool', descriptionKey: 'tasks.scopeDescriptions.departmentPool' },
  { value: 'pending-approval', labelKey: 'tasks.scopes.pendingApproval', descriptionKey: 'tasks.scopeDescriptions.pendingApproval' },
  { value: 'all', labelKey: 'tasks.scopes.all', descriptionKey: 'tasks.scopeDescriptions.all' },
]

function getAvailableScopes(role: string | undefined): TaskListScope[] {
  if (role === 'SystemAdmin' || role === 'Manager') {
    return ['mine', 'department-pool', 'pending-approval', 'all']
  }

  if (role === 'Staff' || role === 'Operator') {
    return ['mine', 'department-pool']
  }

  return ['mine']
}

function getDefaultScope(role: string | undefined): TaskListScope {
  if (role === 'SystemAdmin') {
    return 'all'
  }

  if (role === 'Manager') {
    return 'pending-approval'
  }

  return 'mine'
}

function readScope(value: string | null, availableScopes: TaskListScope[], fallbackScope: TaskListScope): TaskListScope {
  if (value && availableScopes.includes(value as TaskListScope)) {
    return value as TaskListScope
  }

  return fallbackScope
}

function getStatusTone(status: string) {
  if (status === 'PendingApproval') return 'warning' as const
  if (status === 'Assigned' || status === 'InProgress') return 'info' as const
  if (status === 'Completed') return 'success' as const
  if (status === 'Rejected') return 'danger' as const
  return 'neutral' as const
}

function getPriorityTone(priority: string) {
  if (priority === 'High') return 'danger' as const
  if (priority === 'Low') return 'success' as const
  return 'neutral' as const
}

function fetchTaskPageData(scope: TaskListScope) {
  return Promise.all([api.getTasks(scope), api.getDepartments(), api.getUsers()])
}

export function TasksPage() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tasks, setTasks] = useState<Task[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, { departmentId: string; userId: string }>>({})
  const [assignmentQueries, setAssignmentQueries] = useState<Record<string, string>>({})
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    taskType: 'InternalRequest',
    sourceType: 'Manual',
    priority: 'Normal',
    targetDepartmentId: '',
  })

  const availableScopes = useMemo(() => getAvailableScopes(currentUser?.role), [currentUser?.role])
  const defaultScope = useMemo(() => {
    const preferredScope = getDefaultScope(currentUser?.role)
    return availableScopes.includes(preferredScope) ? preferredScope : availableScopes[0]
  }, [availableScopes, currentUser?.role])
  const activeScope = readScope(searchParams.get('scope'), availableScopes, defaultScope)

  const loadData = (scope: TaskListScope) => {
    setLoading(true)
    setError('')

    void Promise.all([api.getTasks(scope), api.getDepartments(), api.getUsers()])
      .then(([taskList, departmentList, userList]) => {
        setTasks(taskList)
        setDepartments(departmentList)
        setUsers(userList)
      })
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : t('common.error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (searchParams.get('scope') !== activeScope) {
      const nextSearchParams = new URLSearchParams(searchParams)
      nextSearchParams.set('scope', activeScope)
      setSearchParams(nextSearchParams, { replace: true })
      return
    }

    let isActive = true

    void fetchTaskPageData(activeScope)
      .then(([taskList, departmentList, userList]) => {
        if (!isActive) {
          return
        }

        setTasks(taskList)
        setDepartments(departmentList)
        setUsers(userList)
      })
      .catch(loadError => {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : t('common.error'))
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [activeScope, searchParams, setSearchParams, t])

  const currentUserRecord = useMemo(
    () => users.find(candidate => candidate.userId === currentUser?.userId) ?? null,
    [currentUser?.userId, users],
  )
  const currentDepartmentId = currentUserRecord?.departmentId ?? null
  const canManageWorkflow = currentUser?.role === 'SystemAdmin' || currentUser?.role === 'Manager'

  const updateScope = (scope: TaskListScope) => {
    setLoading(true)
    setError('')

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('scope', scope)
    setSearchParams(nextSearchParams, { replace: true })
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!newTask.title.trim()) {
      return
    }

    setError('')
    try {
      await api.createTask({
        ...newTask,
        targetDepartmentId: newTask.targetDepartmentId || undefined,
      })

      setNewTask({
        title: '',
        description: '',
        taskType: 'InternalRequest',
        sourceType: 'Manual',
        priority: 'Normal',
        targetDepartmentId: '',
      })
      setShowForm(false)
      loadData(activeScope)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('common.error'))
    }
  }

  const handleAction = async (taskId: string, action: TaskAction) => {
    setError('')

    try {
      if (action === 'submit') await api.submitTask(taskId)
      if (action === 'approve') await api.approveTask(taskId)
      if (action === 'reject') await api.rejectTask(taskId)
      if (action === 'complete') await api.completeTask(taskId)
      if (action === 'close') await api.closeTask(taskId)
      loadData(activeScope)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('common.error'))
    }
  }

  const handleAssign = async (taskId: string) => {
    const draft = assignmentDrafts[taskId]
    const task = tasks.find(candidate => candidate.taskId === taskId)
    const departmentId = draft
      ? draft.departmentId || undefined
      : task?.assignedDepartmentId ?? task?.targetDepartmentId ?? undefined
    const userId = draft
      ? draft.userId || undefined
      : task?.assignedUserId ?? undefined

    setError('')

    try {
      await api.assignTask(taskId, departmentId, userId)
      setAssignmentDrafts(current => ({ ...current, [taskId]: { departmentId: '', userId: '' } }))
      setAssignmentQueries(current => ({ ...current, [taskId]: '' }))
      loadData(activeScope)
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : t('common.error'))
    }
  }

  const handleClaim = async (taskId: string) => {
    setError('')

    try {
      await api.claimTask(taskId)
      loadData(activeScope)
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : t('common.error'))
    }
  }

  const updateAssignmentDraft = (taskId: string, field: 'departmentId' | 'userId', value: string) => {
    setAssignmentDrafts(current => ({
      ...current,
      [taskId]: {
        departmentId: current[taskId]?.departmentId ?? '',
        userId: current[taskId]?.userId ?? '',
        [field]: value,
      },
    }))
  }

  const updateAssignmentDepartment = (taskId: string, departmentId: string) => {
    setAssignmentDrafts(current => {
      const currentDraft = current[taskId] ?? { departmentId: '', userId: '' }
      const nextUserId = currentDraft.userId && users.find(user => user.userId === currentDraft.userId)?.departmentId === departmentId
        ? currentDraft.userId
        : ''

      return {
        ...current,
        [taskId]: {
          departmentId,
          userId: nextUserId,
        },
      }
    })
    setAssignmentQueries(current => ({ ...current, [taskId]: '' }))
  }

  const getAssignableUsers = (taskId: string, task: Task) => {
    const selectedDepartmentId = assignmentDrafts[taskId]?.departmentId ?? task.assignedDepartmentId ?? task.targetDepartmentId ?? ''

    return selectedDepartmentId
      ? users.filter(user => user.departmentId === selectedDepartmentId && user.isActive)
      : users.filter(user => user.isActive)
  }

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return t('common.none')
    return departments.find(department => department.departmentId === departmentId)?.name ?? t('common.none')
  }

  const getUserName = (userId: string | null) => {
    if (!userId) return t('common.none')
    return users.find(user => user.userId === userId)?.displayName ?? t('common.none')
  }

  const getSelectedUser = (taskId: string, task: Task) => {
    const draft = assignmentDrafts[taskId]
    const selectedUserId = draft ? draft.userId : task.assignedUserId
    return users.find(user => user.userId === selectedUserId) ?? null
  }

  const getUserSearchValue = (taskId: string, task: Task) => {
    if (Object.prototype.hasOwnProperty.call(assignmentQueries, taskId)) {
      return assignmentQueries[taskId] ?? ''
    }

    return getSelectedUser(taskId, task)?.displayName ?? ''
  }

  const getTargetDepartmentName = (task: Task) => task.targetDepartmentName ?? getDepartmentName(task.targetDepartmentId)
  const getWorkflowDepartmentName = (task: Task) => task.assignedDepartmentName ?? task.targetDepartmentName ?? getDepartmentName(task.assignedDepartmentId ?? task.targetDepartmentId)
  const getAssigneeLabel = (task: Task) => {
    if (task.assignedUserDisplayName) {
      return task.assignedUserDisplayName
    }

    if (task.assignedUserId) {
      return getUserName(task.assignedUserId)
    }

    if (task.assignedDepartmentId) {
      return t('tasks.departmentPoolAssignee')
    }

    return t('common.none')
  }

  const canClaimTask = (task: Task) => {
    return task.currentStatus === 'Assigned'
      && !!task.assignedDepartmentId
      && !task.assignedUserId
      && !!currentDepartmentId
      && task.assignedDepartmentId === currentDepartmentId
  }

  const canCompleteTask = (task: Task) => {
    if (task.currentStatus !== 'Assigned') {
      return false
    }

    if (canManageWorkflow) {
      return true
    }

    return !!currentUser?.userId && task.assignedUserId === currentUser.userId
  }

  const canCloseTask = (task: Task) => {
    return canManageWorkflow && (task.currentStatus === 'Completed' || task.currentStatus === 'Rejected')
  }

  const scopeOptions = useMemo(
    () => TASK_SCOPE_OPTIONS.filter(option => availableScopes.includes(option.value)),
    [availableScopes],
  )
  const activeScopeOption = scopeOptions.find(option => option.value === activeScope) ?? scopeOptions[0]

  const summaryCards = useMemo(() => [
    { label: t('tasks.summary.total'), value: tasks.length, icon: ClipboardList },
    { label: t('tasks.summary.pendingApproval'), value: tasks.filter(task => task.currentStatus === 'PendingApproval').length, icon: Hourglass },
    { label: t('tasks.summary.assigned'), value: tasks.filter(task => task.currentStatus === 'Assigned').length, icon: ClipboardCheck },
    { label: t('tasks.summary.completed'), value: tasks.filter(task => task.currentStatus === 'Completed').length, icon: CircleCheckBig },
  ], [tasks, t])

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className="page-stack desktop-page-shell min-h-[calc(100dvh-5rem)] lg:min-h-0">
      <section className="section-card overflow-hidden p-0">
        <div
          className="grid gap-4 border-b border-white/10 px-4 py-5 text-white sm:px-5 xl:grid-cols-[minmax(0,1fr)_auto]"
          style={{ background: 'linear-gradient(135deg, var(--color-header-from), var(--color-header-to))' }}
        >
          <div className="space-y-2">
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white/68">{t(activeScopeOption.labelKey)}</div>
            <h1 className="page-title !text-white">{t('tasks.title')}</h1>
            <p className="max-w-3xl text-sm leading-6 text-white/82">{t('tasks.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-start justify-start gap-2 xl:justify-end">
            <StatusPill tone="info" className="bg-white/12 text-white ring-white/15">
              {t('tasks.summary.total')}: {tasks.length}
            </StatusPill>
            <Button type="button" onClick={() => setShowForm(current => !current)}>
              {showForm ? t('tasks.newCancel') : t('tasks.new')}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 px-4 py-4 sm:px-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-bold text-slate-950">{t(activeScopeOption.labelKey)}</h2>
              <p className="helper-copy">{t(activeScopeOption.descriptionKey)}</p>
            </div>
            <div className="tab-bar" role="tablist" aria-label={t('tasks.scopeSelector')}>
              {scopeOptions.map(option => (
                <button
                  key={option.value}
                  aria-selected={activeScope === option.value}
                  className={`tab-button ${activeScope === option.value ? 'active' : ''}`}
                  role="tab"
                  type="button"
                  onClick={() => updateScope(option.value)}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[color:var(--color-muted)]/55 p-3">
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">{t('tasks.scopeSelector')}</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{t(activeScopeOption.labelKey)}</div>
              <div className="mt-2 text-xs leading-5 text-[color:var(--color-muted-foreground)]">{t(activeScopeOption.descriptionKey)}</div>
            </div>
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[color:var(--color-muted)]/55 p-3">
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">{t('tasks.summary.total')}</div>
              <div className="mt-1 text-3xl font-extrabold text-slate-950">{tasks.length}</div>
              <div className="mt-2 text-xs leading-5 text-[color:var(--color-muted-foreground)]">{getRoleLabel(t, currentUser?.role ?? '')}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {summaryCards.map(item => {
          const Icon = item.icon
          return (
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-edge)]" key={item.label}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{item.label}</div>
                  <div className="mt-2 text-3xl font-extrabold text-slate-950">{item.value}</div>
                </div>
                <div className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
                  <Icon className="size-4.5" />
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      {showForm ? (
        <form className="section-card overflow-hidden p-0" onSubmit={handleCreate}>
          <div className="border-b border-[var(--color-border)] bg-[color:var(--color-muted)]/45 px-4 py-4 sm:px-5">
            <h2 className="text-xl font-extrabold text-slate-950">{t('tasks.newFormTitle')}</h2>
            <p className="helper-copy mt-1">{t('tasks.newFormDescription')}</p>
          </div>

          <div className="grid gap-4 px-4 py-4 sm:px-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span>{t('tasks.titleLabel')}</span>
                <input
                  className="field-input"
                  id="task-title"
                  placeholder={t('tasks.titlePlaceholder')}
                  type="text"
                  value={newTask.title}
                  onChange={event => setNewTask(current => ({ ...current, title: event.target.value }))}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span>{t('tasks.priority')}</span>
                <select
                  className="field-select"
                  id="task-priority"
                  value={newTask.priority}
                  onChange={event => setNewTask(current => ({ ...current, priority: event.target.value }))}
                >
                  <option value="Low">{getPriorityLabel(t, 'Low')}</option>
                  <option value="Normal">{getPriorityLabel(t, 'Normal')}</option>
                  <option value="High">{getPriorityLabel(t, 'High')}</option>
                </select>
              </label>
            </div>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('tasks.description')}</span>
              <textarea
                className="field-textarea"
                id="task-description"
                placeholder={t('tasks.descriptionPlaceholder')}
                rows={3}
                value={newTask.description}
                onChange={event => setNewTask(current => ({ ...current, description: event.target.value }))}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span>{t('tasks.type')}</span>
                <select className="field-select" id="task-type" value={newTask.taskType} onChange={event => setNewTask(current => ({ ...current, taskType: event.target.value }))}>
                  <option value="InternalRequest">{getTaskTypeLabel(t, 'InternalRequest')}</option>
                  <option value="CitizenRequest">{getTaskTypeLabel(t, 'CitizenRequest')}</option>
                  <option value="ApprovalTask">{getTaskTypeLabel(t, 'ApprovalTask')}</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span>{t('tasks.targetDepartment')}</span>
                <select className="field-select" id="task-target-department" value={newTask.targetDepartmentId} onChange={event => setNewTask(current => ({ ...current, targetDepartmentId: event.target.value }))}>
                  <option value="">{t('tasks.selectDepartment')}</option>
                  {departments.map(department => (
                    <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="inline-actions">
              <Button type="submit">{t('common.create')}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        </form>
      ) : null}

      <section className="section-card overflow-hidden p-0 desktop-page-fill">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[color:var(--color-muted)]/45 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-base font-bold text-slate-950">{t(activeScopeOption.labelKey)}</h2>
            <p className="helper-copy">{t(activeScopeOption.descriptionKey)}</p>
          </div>
          <StatusPill tone="info">{t('tasks.summary.total')}: {tasks.length}</StatusPill>
        </div>

        <div className="table-wrap desktop-panel-scroll max-h-[min(68dvh,52rem)] rounded-none border-0 lg:max-h-none">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('tasks.titleLabel')}</th>
                <th>{t('tasks.type')}</th>
                <th>{t('tasks.priority')}</th>
                <th>{t('common.status')}</th>
                <th>{t('tasks.targetDepartment')}</th>
                <th>{t('tasks.department')}</th>
                <th>{t('tasks.assignedTo')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.taskId}>
                  <td>
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-950">{task.title}</div>
                      {task.description ? <div className="text-sm text-slate-500">{task.description}</div> : null}
                    </div>
                  </td>
                  <td>{getTaskTypeLabel(t, task.taskType)}</td>
                  <td><StatusPill tone={getPriorityTone(task.priority)}>{getPriorityLabel(t, task.priority)}</StatusPill></td>
                  <td><StatusPill tone={getStatusTone(task.currentStatus)}>{getTaskStatusLabel(t, task.currentStatus)}</StatusPill></td>
                  <td>{getTargetDepartmentName(task)}</td>
                  <td>{getWorkflowDepartmentName(task)}</td>
                  <td>{getAssigneeLabel(task)}</td>
                  <td className="w-[18rem] min-w-[18rem]">
                    <div className="table-stack">
                      {task.currentStatus === 'Draft' ? (
                        <Button size="sm" type="button" onClick={() => handleAction(task.taskId, 'submit')}>{t('tasks.submit')}</Button>
                      ) : null}

                      {canManageWorkflow && task.currentStatus === 'PendingApproval' ? (
                        <div className="inline-actions">
                          <Button size="sm" type="button" variant="success" onClick={() => handleAction(task.taskId, 'approve')}>{t('tasks.approve')}</Button>
                          <Button size="sm" type="button" variant="danger" onClick={() => handleAction(task.taskId, 'reject')}>{t('tasks.reject')}</Button>
                        </div>
                      ) : null}

                      {canManageWorkflow && (task.currentStatus === 'Draft' || task.currentStatus === 'Assigned') ? (
                        <details className="rounded-lg border border-[var(--color-border)] bg-slate-50/80 p-2">
                          <summary className="cursor-pointer list-none text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            {t('common.actions')}
                          </summary>
                          <div className="mt-2 table-stack">
                            <select
                              aria-label={`${t('tasks.departmentSelection')} ${task.title}`}
                              className="field-select"
                              value={assignmentDrafts[task.taskId]?.departmentId ?? task.assignedDepartmentId ?? task.targetDepartmentId ?? ''}
                              onChange={event => updateAssignmentDepartment(task.taskId, event.target.value)}
                            >
                              <option value="">{t('tasks.draftDepartment')}</option>
                              {departments.map(department => (
                                <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                              ))}
                            </select>
                            <AutocompleteField
                              ariaLabel={`${t('tasks.userSelection')} ${task.title}`}
                              emptyMessage={t('tasks.userSearchEmpty')}
                              loadingMessage={t('common.loading')}
                              options={getAssignableUsers(task.taskId, task)
                                .filter(user => {
                                  const currentQuery = getUserSearchValue(task.taskId, task).trim().toLowerCase()
                                  if (!currentQuery) {
                                    return true
                                  }

                                  return user.displayName.toLowerCase().includes(currentQuery) || (user.email?.toLowerCase().includes(currentQuery) ?? false)
                                })
                                .map(user => ({
                                  id: user.userId,
                                  label: user.displayName,
                                  description: [user.email, getRoleLabel(t, user.roleCode)].filter(Boolean).join(' | '),
                                  helperText: getUserSourceLabel(t, user.userSource),
                                }))}
                              placeholder={t('tasks.userSearchPlaceholder')}
                              value={getUserSearchValue(task.taskId, task)}
                              onOptionSelect={option => {
                                updateAssignmentDraft(task.taskId, 'userId', option.id)
                                setAssignmentQueries(current => ({ ...current, [task.taskId]: option.label }))
                              }}
                              onValueChange={value => {
                                setAssignmentQueries(current => ({ ...current, [task.taskId]: value }))
                                if (!value.trim()) {
                                  updateAssignmentDraft(task.taskId, 'userId', '')
                                }
                              }}
                            />
                            <div className="inline-actions">
                              <Button size="sm" type="button" onClick={() => handleAssign(task.taskId)}>{t('tasks.assign')}</Button>
                              {canCompleteTask(task) ? (
                                <Button size="sm" type="button" variant="success" onClick={() => handleAction(task.taskId, 'complete')}>{t('tasks.complete')}</Button>
                              ) : null}
                            </div>
                          </div>
                        </details>
                      ) : null}

                      {!canManageWorkflow && canClaimTask(task) ? (
                        <Button size="sm" type="button" onClick={() => handleClaim(task.taskId)}>{t('tasks.claim')}</Button>
                      ) : null}

                      {!canManageWorkflow && !canClaimTask(task) && canCompleteTask(task) ? (
                        <Button size="sm" type="button" variant="success" onClick={() => handleAction(task.taskId, 'complete')}>{t('tasks.complete')}</Button>
                      ) : null}

                      {canCloseTask(task) ? (
                        <Button size="sm" type="button" variant="secondary" onClick={() => handleAction(task.taskId, 'close')}>
                          {t('tasks.close')}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">{t('tasks.empty')}</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}