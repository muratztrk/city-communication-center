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
  if (role === 'Staff' || role === 'Operator') return ['mine']
  return ['mine']
}

const EMPTY_FORM = { title: '', description: '', priority: 'Normal', dueDateUtc: '' }

export function TasksPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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

  const handleSubmitForm = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user?.departmentId) {
      setFormError(t('tasks.newRequest.noDepartment', 'Departman bilgisi bulunamadı.'))
      return
    }
    setFormError(null)
    setFormSaving(true)
    try {
      const job = await api.createJob({
        title: form.title,
        description: form.description,
        ownerDepartmentId: user.departmentId,
        priority: form.priority,
        dueDateUtc: form.dueDateUtc || null,
        sourceType: 'InternalRequest',
      })
      await api.createTask({
        jobId: job.jobId,
        title: form.title,
        description: form.description,
        priority: form.priority,
        dueDateUtc: form.dueDateUtc || null,
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setFormSaving(false)
    }
  }

  const isAssignee = (task: Task) => task.assignedUserId === user?.userId
  const isManagerLike = user?.role === 'Manager' || user?.role === 'SystemAdmin'
  const openDatePicker = (event: React.MouseEvent<HTMLInputElement>) => {
    const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void }
    input.showPicker?.()
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{t('tasks.scopeSelector', 'İş görünümleri')}</div>
            <h1 className="page-title">{t('nav.tasks')}</h1>
            <p className="page-subtitle">{t('tasks.subtitle')}</p>
          </div>
          <Button onClick={() => setShowForm(v => !v)}>
            {t('tasks.newRequest.button', 'Yeni Talep')}
          </Button>
        </div>
      </header>

      {showForm && (
        <section className="section-card page-stack">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">{t('tasks.newRequest.sectionTitle', 'Yeni Kurum İçi Talep')}</h2>
            <p className="helper-copy">{t('tasks.newRequest.sectionDescription', 'Dahili iş akışı başlatmak için talep oluşturun.')}</p>
          </div>
          {formError && <div className="alert alert-error">{formError}</div>}
          <form className="page-stack" onSubmit={event => void handleSubmitForm(event)}>
            <div className="job-field">
              <span className="job-field-label">{t('tasks.newRequest.title', 'Talep Başlığı')}</span>
              <input
                className="field-input"
                placeholder={t('tasks.newRequest.titlePlaceholder', 'Talebin kısa başlığı')}
                required
                value={form.title}
                onChange={e => setForm(cur => ({ ...cur, title: e.target.value }))}
              />
            </div>
            <div className="job-field">
              <span className="job-field-label">{t('tasks.newRequest.description', 'Açıklama')}</span>
              <textarea
                className="field-textarea"
                placeholder={t('tasks.newRequest.descriptionPlaceholder', 'Talebin detaylı açıklaması...')}
                required
                rows={4}
                value={form.description}
                onChange={e => setForm(cur => ({ ...cur, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="job-field">
                <span className="job-field-label">{t('tasks.newRequest.priority', 'Öncelik')}</span>
                <select
                  className="field-select"
                  value={form.priority}
                  onChange={e => setForm(cur => ({ ...cur, priority: e.target.value }))}
                >
                  <option value="High">{t('jobs.priorities.High', 'Yüksek')}</option>
                  <option value="Normal">{t('jobs.priorities.Normal', 'Normal')}</option>
                </select>
              </div>
              <div className="job-field">
                <span className="job-field-label">{t('tasks.newRequest.dueDate', 'Bitiş Tarihi (isteğe bağlı)')}</span>
                <input
                  type="date"
                  className="field-input"
                  placeholder="gg.aa.yyyy"
                  value={form.dueDateUtc}
                  onClick={openDatePicker}
                  onChange={e => setForm(cur => ({ ...cur, dueDateUtc: e.target.value }))}
                />
              </div>
            </div>
            <div className="inline-actions">
              <Button type="submit" disabled={formSaving}>
                {t('tasks.newRequest.submit', 'Talep Oluştur')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(null) }}>
                {t('common.cancel', 'İptal')}
              </Button>
            </div>
          </form>
        </section>
      )}

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
              <th>{t('tasks.columns.owner', 'Sahip')}</th>
              <th>{t('tasks.columns.createdBy', 'Created By')}</th>
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
                <td>{task.ownerDisplayName ?? '—'}</td>
                <td>{task.createdByDisplayName ?? '—'}</td>
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
