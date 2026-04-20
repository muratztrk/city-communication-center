import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { StatusPill } from '../components/ui/status-pill'
import { useAuth } from '../context/AuthContext'
import type { Task, TaskListScope } from '../types/platform'
import { getPriorityLabel, getTaskStatusLabel } from '../utils/localization'

const SCOPES: { value: TaskListScope; labelKey: string }[] = [
  { value: 'mine', labelKey: 'tasks.scopes.mine' },
  { value: 'department-pool', labelKey: 'tasks.scopes.departmentPool' },
  { value: 'pending-close-approval', labelKey: 'tasks.scopes.pendingCloseApproval' },
  { value: 'all', labelKey: 'tasks.scopes.all' },
]

function availableScopes(role?: string): TaskListScope[] {
  if (role === 'SystemAdmin' || role === 'Manager') return ['mine', 'department-pool', 'pending-close-approval', 'all']
  if (role === 'Staff' || role === 'Operator') return ['mine', 'department-pool']
  return ['mine']
}

export function TasksPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const scopes = useMemo(() => availableScopes(user?.role), [user?.role])
  const scopeParam = (searchParams.get('scope') as TaskListScope | null) ?? scopes[0]
  const currentScope: TaskListScope = scopes.includes(scopeParam) ? scopeParam : scopes[0]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.getTasks(currentScope)
      .then(list => { if (!cancelled) setTasks(list) })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : t('common.error')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
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

  const handleApproveClose = async (taskId: string) => {
    await api.approveTaskClose(taskId)
    await reload()
  }

  const handleRejectClose = async (taskId: string) => {
    const comment = window.prompt(t('tasks.actions.rejectReason', 'Reason:')) ?? ''
    await api.rejectTaskClose(taskId, comment)
    await reload()
  }

  const handleClaim = async (taskId: string) => {
    await api.claimTask(taskId)
    await reload()
  }

  const handleRevision = async (taskId: string) => {
    const reason = window.prompt(t('tasks.actions.revisionReason', 'Revision reason:')) ?? ''
    if (!reason) return
    await api.requestTaskRevision(taskId, reason)
    await reload()
  }

  const handleProgress = async (taskId: string) => {
    const pctStr = window.prompt(t('tasks.actions.progressPrompt', 'Completion %:'))
    if (!pctStr) return
    const pct = Number(pctStr)
    if (Number.isNaN(pct)) return
    await api.updateTaskProgress(taskId, { completionPercentage: pct })
    await reload()
  }

  const isAssignee = (task: Task) => task.assignedUserId === user?.userId
  const isManagerLike = user?.role === 'Manager' || user?.role === 'SystemAdmin'

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('nav.tasks')}</h1>
      </header>

      <nav className="tab-row">
        {scopes.map(scope => (
          <Button
            key={scope}
            variant={scope === currentScope ? 'primary' : 'secondary'}
            onClick={() => setSearchParams({ scope })}
          >
            {t(SCOPES.find(s => s.value === scope)!.labelKey)}
          </Button>
        ))}
      </nav>

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : tasks.length === 0 ? (
        <div className="empty">{t('tasks.empty', 'No tasks')}</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('tasks.columns.title', 'Title')}</th>
              <th>{t('tasks.columns.job', 'Job')}</th>
              <th>{t('tasks.columns.status', 'Status')}</th>
              <th>{t('tasks.columns.priority', 'Priority')}</th>
              <th>{t('tasks.columns.assignedTo', 'Assigned')}</th>
              <th>{t('tasks.columns.progress', 'Progress')}</th>
              <th>{t('tasks.columns.dueDate', 'Due')}</th>
              <th>{t('tasks.columns.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <tr key={task.taskId}>
                <td>{task.title}</td>
                <td>{task.jobTitle ?? '—'}</td>
                <td><StatusPill>{getTaskStatusLabel(t, task.currentStatus)}</StatusPill></td>
                <td>{getPriorityLabel(t, task.priority)}</td>
                <td>{task.assignedUserDisplayName ?? task.assignedDepartmentName ?? '—'}</td>
                <td>{task.completionPercentage ?? 0}%</td>
                <td>{task.dueDateUtc ? new Date(task.dueDateUtc).toLocaleDateString() : '—'}</td>
                <td className="actions-cell">
                  {currentScope === 'department-pool' && !task.assignedUserId && (
                    <Button size="sm" onClick={() => handleClaim(task.taskId)}>{t('tasks.actions.claim', 'Claim')}</Button>
                  )}
                  {isAssignee(task) && (task.currentStatus === 'Assigned' || task.currentStatus === 'InProgress') && (
                    <>
                      <Button size="sm" onClick={() => handleProgress(task.taskId)}>{t('tasks.actions.progress', 'Progress')}</Button>
                      <Button size="sm" onClick={() => handleComplete(task.taskId)}>{t('tasks.actions.complete', 'Complete')}</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleRevision(task.taskId)}>{t('tasks.actions.revision', 'Revision')}</Button>
                    </>
                  )}
                  {isManagerLike && task.currentStatus === 'PendingCloseApproval' && (
                    <>
                      <Button size="sm" onClick={() => handleApproveClose(task.taskId)}>{t('tasks.actions.approveClose', 'Approve Close')}</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleRejectClose(task.taskId)}>{t('tasks.actions.rejectClose', 'Reject Close')}</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
