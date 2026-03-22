import { ClipboardCheck, ClipboardList, CircleCheckBig, Hourglass } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { AutocompleteField } from '../components/forms/AutocompleteField'
import { Button } from '../components/ui/button'
import { StatusPill } from '../components/ui/status-pill'
import type { Department, Task, User } from '../types/platform'
import { getPriorityLabel, getRoleLabel, getTaskStatusLabel, getTaskTypeLabel, getUserSourceLabel } from '../utils/localization'

type TaskAction = 'submit' | 'approve' | 'reject' | 'complete' | 'close'

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

export function TasksPage() {
  const { t } = useTranslation()
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

  const loadData = () => {
    setLoading(true)
    setError('')

    void Promise.all([api.getTasks(), api.getDepartments(), api.getUsers()])
      .then(([taskList, departmentList, userList]) => {
        setTasks(taskList)
        setDepartments(departmentList)
        setUsers(userList)
      })
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : t('common.error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

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
      loadData()
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
      loadData()
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
      loadData()
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : t('common.error'))
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
    <div className="page-stack">
      <header className="page-header-row">
        <div className="space-y-2">
          <h1 className="page-title">{t('tasks.title')}</h1>
          <p className="page-subtitle">{t('tasks.subtitle')}</p>
        </div>
        <Button type="button" onClick={() => setShowForm(current => !current)}>
          {showForm ? t('tasks.newCancel') : t('tasks.new')}
        </Button>
      </header>

      <section className="metric-grid">
        {summaryCards.map(item => {
          const Icon = item.icon
          return (
            <div className="section-card" key={item.label}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-500">{item.label}</div>
                  <div className="mt-3 text-4xl font-extrabold text-slate-950">{item.value}</div>
                </div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
                  <Icon className="size-5" />
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      {showForm ? (
        <form className="form-card page-stack" onSubmit={handleCreate}>
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">{t('tasks.newFormTitle')}</h2>
            <p className="helper-copy">{t('tasks.newFormDescription')}</p>
          </div>

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
        </form>
      ) : null}

      <section className="section-card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('tasks.titleLabel')}</th>
                <th>{t('tasks.type')}</th>
                <th>{t('tasks.priority')}</th>
                <th>{t('common.status')}</th>
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
                  <td>{getDepartmentName(task.assignedDepartmentId ?? task.targetDepartmentId)}</td>
                  <td>{getUserName(task.assignedUserId)}</td>
                  <td>
                    <div className="table-stack">
                      {task.currentStatus === 'Draft' ? (
                        <Button size="sm" type="button" onClick={() => handleAction(task.taskId, 'submit')}>{t('tasks.submit')}</Button>
                      ) : null}

                      {task.currentStatus === 'PendingApproval' ? (
                        <div className="inline-actions">
                          <Button size="sm" type="button" variant="success" onClick={() => handleAction(task.taskId, 'approve')}>{t('tasks.approve')}</Button>
                          <Button size="sm" type="button" variant="danger" onClick={() => handleAction(task.taskId, 'reject')}>{t('tasks.reject')}</Button>
                        </div>
                      ) : null}

                      {task.currentStatus === 'Draft' || task.currentStatus === 'Assigned' ? (
                        <>
                          <select
                            aria-label={`Departman seÃ§ ${task.title}`}
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
                            ariaLabel={`KullanÄ±cÄ± seÃ§ ${task.title}`}
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
                                description: [user.email, getRoleLabel(t, user.roleCode)].filter(Boolean).join(' â€¢ '),
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
                            {task.currentStatus === 'Assigned' ? (
                              <Button size="sm" type="button" variant="success" onClick={() => handleAction(task.taskId, 'complete')}>{t('tasks.complete')}</Button>
                            ) : null}
                          </div>
                        </>
                      ) : null}

                      {task.currentStatus === 'Completed' || task.currentStatus === 'Rejected' ? (
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
                  <td colSpan={7}>
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
