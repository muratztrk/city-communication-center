import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { StatusPill } from '../components/ui/status-pill'
import { useAuth } from '../context/AuthContext'
import type { Department, Task, TaskDetail, TaskListScope, User } from '../types/platform'
import { getLocale, getPriorityLabel, getTaskStatusLabel } from '../utils/localization'

const SCOPES: { value: TaskListScope; labelKey: string }[] = [
  { value: 'pending-approval', labelKey: 'tasks.scopes.pendingApproval' },
  { value: 'department-pool', labelKey: 'tasks.scopes.departmentPool' },
  { value: 'all', labelKey: 'tasks.scopes.all' },
]

function availableScopes(role?: string): TaskListScope[] {
  if (role === 'SystemAdmin' || role === 'Manager') return ['pending-approval', 'department-pool', 'all']
  return ['department-pool', 'all']
}

interface TasksPageProps {
  fixedScope?: TaskListScope
}

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTaskSourceLabel(t: ReturnType<typeof useTranslation>['t'], task: Task): string {
  if (task.jobRequestType === 'Citizen' || task.jobSourceType === 'SocialMessage' || task.jobSourceType === 'CitizenRequest') {
    return t('tasks.sourceLabels.citizenIncoming', 'Vatandaştan Gelen')
  }

  if (task.jobRequestType === 'ExternalUnit') {
    return t('tasks.sourceLabels.externalIncoming', 'Birim Dışı Gelen')
  }

  return t('tasks.sourceLabels.internalIncoming', 'Birim İçi Gelen')
}

export function TasksPage({ fixedScope }: TasksPageProps) {
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
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [assignmentDraft, setAssignmentDraft] = useState({ departmentId: '', userId: '' })
  const [assignmentSaving, setAssignmentSaving] = useState(false)

  const scopes = useMemo(() => fixedScope ? [fixedScope] : availableScopes(user?.role), [fixedScope, user?.role])
  const scopeParam = (searchParams.get('scope') as TaskListScope | null) ?? scopes[0]
  const currentScope: TaskListScope = scopes.includes(scopeParam) ? scopeParam : scopes[0]
  const isMyTasksView = fixedScope === 'mine'
  const isManagerLike = user?.role === 'Manager' || user?.role === 'SystemAdmin'
  const activeUsers = useMemo(() => users.filter(item => item.isActive), [users])
  const assignmentUsers = useMemo(() => {
    if (!assignmentDraft.departmentId) return activeUsers
    return activeUsers.filter(item => item.departmentId === assignmentDraft.departmentId)
  }, [activeUsers, assignmentDraft.departmentId])

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

  const handleComplete = async (taskId: string) => {
    const note = window.prompt(t('tasks.actions.completePrompt', 'Result note (optional):')) ?? undefined
    await api.completeTask(taskId, note)
    await reload()
  }

  const handleClaim = async (taskId: string) => {
    await api.claimTask(taskId)
    await reload()
  }

  const isAssignee = (task: Task) => task.assignedUserId === user?.userId
  const getDepartmentName = (departmentId?: string | null) => departments.find(department => department.departmentId === departmentId)?.name ?? '—'
  const getUserName = (userId?: string | null) => users.find(item => item.userId === userId)?.displayName ?? '—'

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
            <div className="page-kicker">{t('tasks.scopeSelector', 'İş görünümleri')}</div>
            <h1 className="page-title">{isMyTasksView ? t('nav.myTasks', 'Benim Görevlerim') : t('nav.tasks')}</h1>
            <p className="page-subtitle">
              {isMyTasksView
                ? t('tasks.myTasksSubtitle', 'Size atanmış işleri ve tamamlanması beklenen görevleri takip edin.')
                : t('tasks.subtitle')}
            </p>
          </div>
        </div>
      </header>

      {!isMyTasksView && <nav className="scope-chips">
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
      </nav>}

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
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                  {taskDetail.description || t('common.none')}
                </div>
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
            </>
          ) : null}
        </section>
      ) : null}

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : tasks.length === 0 ? (
        <div className="empty">{t('tasks.empty', 'No tasks')}</div>
      ) : (
        <section className="section-card desktop-page-fill">
          <div className="table-wrap desktop-panel-scroll">
            <table className="data-table jobs-table">
              <thead>
                <tr>
                  <th>{t('tasks.columns.title', 'Title')}</th>
                  <th>{t('tasks.columns.job', 'Job')}</th>
                  {isMyTasksView ? <th>{t('tasks.columns.source', 'Kaynak')}</th> : null}
                  <th>{t('tasks.columns.status', 'Status')}</th>
                  <th>{t('tasks.columns.priority', 'Priority')}</th>
                  <th>{t('tasks.columns.assignedTo', 'Assigned')}</th>
                  <th>{t('tasks.columns.owner', 'Sahip')}</th>
                  <th>{t('tasks.columns.createdBy', 'Created By')}</th>
                  <th>{t('tasks.columns.dueDate', 'Due')}</th>
                  <th>{t('tasks.columns.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.taskId}>
                    <td>{task.title}</td>
                    <td>{task.jobTitle ?? '—'}</td>
                    {isMyTasksView ? <td><StatusPill tone="info">{getTaskSourceLabel(t, task)}</StatusPill></td> : null}
                    <td><StatusPill>{getTaskStatusLabel(t, task.currentStatus)}</StatusPill></td>
                    <td>{getPriorityLabel(t, task.priority)}</td>
                    <td>{task.assignedUserDisplayName ?? task.assignedDepartmentName ?? '—'}</td>
                    <td>{task.ownerDisplayName ?? '—'}</td>
                    <td>{task.createdByDisplayName ?? '—'}</td>
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
