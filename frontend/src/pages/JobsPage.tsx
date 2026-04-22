import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { StatusPill } from '../components/ui/status-pill'
import { useAuth } from '../context/AuthContext'
import type { Department, JobDetail, JobListScope, JobSummary, User } from '../types/platform'
import { getPriorityLabel } from '../utils/localization'

const SCOPES: { value: JobListScope; labelKey: string }[] = [
  { value: 'mine', labelKey: 'jobs.scopes.mine' },
  { value: 'my-department', labelKey: 'jobs.scopes.myDepartment' },
  { value: 'active', labelKey: 'jobs.scopes.active' },
  { value: 'all', labelKey: 'jobs.scopes.all' },
]

function getJobStatusLabel(t: TFunction, status: string): string {
  return t(`enum.jobStatus.${status}`, { defaultValue: status })
}


interface CreateFormState {
  title: string
  description: string
  ownerDepartmentId: string
  priority: string
  startDateUtc: string
  dueDateUtc: string
  targetDepartmentIds: string[]
}

const EMPTY_FORM: CreateFormState = {
  title: '',
  description: '',
  ownerDepartmentId: '',
  priority: 'Normal',
  startDateUtc: '',
  dueDateUtc: '',
  targetDepartmentIds: [],
}

interface CreateTaskFormState {
  title: string
  description: string
  priority: string
  assignedDepartmentId: string
  dueDateUtc: string
}

const EMPTY_TASK_FORM: CreateTaskFormState = {
  title: '',
  description: '',
  priority: 'Normal',
  assignedDepartmentId: '',
  dueDateUtc: '',
}

export function JobsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [myDepartmentId, setMyDepartmentId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const [detail, setDetail] = useState<JobDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [supportDeptDraft, setSupportDeptDraft] = useState<string>('')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState<CreateTaskFormState>(EMPTY_TASK_FORM)
  const [taskSubmitting, setTaskSubmitting] = useState(false)

  const scope = useMemo<JobListScope>(() => {
    const raw = (searchParams.get('scope') as JobListScope | null) ?? 'my-department'
    return SCOPES.some(s => s.value === raw) ? raw : 'my-department'
  }, [searchParams])

  // auto-open detail drawer when ?jobId=... is in the URL (e.g. linked from social messages)
  const autoOpenJobId = searchParams.get('jobId')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([api.getJobs(scope), api.getDepartments(), api.getUsers().catch(() => [] as User[])])
      .then(([jobList, deptList, userList]) => {
        if (cancelled) return
        setJobs(jobList)
        setDepartments(deptList)
        const me = userList.find(u => u.userId === user?.userId)
        if (me?.departmentId) setMyDepartmentId(me.departmentId)
        if (autoOpenJobId) openDetail(autoOpenJobId)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : t('common.error')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [scope, t, user?.userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = async () => {
    try { setJobs(await api.getJobs(scope)) }
    catch (err) { setError(err instanceof Error ? err.message : t('common.error')) }
  }

  const isManagerLike = user?.role === 'Manager' || user?.role === 'SystemAdmin'
  const isStaff = user?.role === 'Staff'

  const ownerDeptOptions = useMemo(() => {
    if (isStaff && myDepartmentId) {
      return departments.filter(d => d.departmentId === myDepartmentId)
    }
    return departments
  }, [departments, isStaff, myDepartmentId])

  const openCreateForm = () => {
    setForm({
      ...EMPTY_FORM,
      ownerDepartmentId: myDepartmentId || ownerDeptOptions[0]?.departmentId || '',
    })
    setShowForm(true)
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.title.trim() || !form.description.trim() || !form.ownerDepartmentId) return
    setSubmitting(true)
    try {
      await api.createJob({
        title: form.title.trim(),
        description: form.description.trim(),
        ownerDepartmentId: form.ownerDepartmentId,
        priority: form.priority,
        startDateUtc: form.startDateUtc ? new Date(form.startDateUtc).toISOString() : null,
        dueDateUtc: form.dueDateUtc ? new Date(form.dueDateUtc).toISOString() : null,
        targetDepartmentIds: form.targetDepartmentIds.length > 0 ? form.targetDepartmentIds : undefined,
        sourceType: 'Manual',
      })
      setShowForm(false)
      setForm(EMPTY_FORM)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = async (jobId: string) => {
    setDetailLoading(true)
    setSupportDeptDraft('')
    setShowTaskForm(false)
    setTaskForm(EMPTY_TASK_FORM)
    try {
      const d = await api.getJobById(jobId)
      setDetail(d)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setDetailLoading(false)
    }
  }

  const refreshDetail = async () => {
    if (!detail) return
    try { setDetail(await api.getJobById(detail.jobId)) } catch { /* ignore */ }
    await reload()
  }

  const handleCancel = async (jobId: string) => {
    const reason = window.prompt(t('jobs.actions.cancelReason'))
    if (!reason) return
    await api.cancelJob(jobId, reason)
    await refreshDetail()
    await reload()
  }
  const handleDelete = async (jobId: string) => {
    if (!window.confirm(t('jobs.deleteConfirm', 'Bu iş kaydı kalıcı olarak silinecek. Emin misiniz?'))) return
    await api.deleteJob(jobId)
    if (detail?.jobId === jobId) setDetail(null)
    await reload()
  }
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detail) return
    setTaskSubmitting(true)
    try {
      await api.createTask({
        jobId: detail.jobId,
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        assignedDepartmentId: taskForm.assignedDepartmentId || null,
        dueDateUtc: taskForm.dueDateUtc || null,
      })
      setTaskForm(EMPTY_TASK_FORM)
      setShowTaskForm(false)
      await refreshDetail()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setTaskSubmitting(false)
    }
  }
  const handleAddSupport = async () => {
    if (!detail || !supportDeptDraft) return
    try {
      await api.addSupportDepartment(detail.jobId, supportDeptDraft)
      setSupportDeptDraft('')
      await refreshDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <h1 className="page-title">{t('nav.jobs', 'İşler')}</h1>
          </div>
          <Button type="button" onClick={() => (showForm ? setShowForm(false) : openCreateForm())}>
            {showForm ? t('common.cancel') : t('jobs.actions.new', 'Yeni İş')}
          </Button>
        </div>
      </header>

      <nav className="scope-chips">
        {SCOPES.map(s => (
          <button
            key={s.value}
            type="button"
            className={`scope-chip${s.value === scope ? ' active' : ''}`}
            onClick={() => setSearchParams({ scope: s.value })}
          >
            {t(s.labelKey, s.value)}
          </button>
        ))}
      </nav>

      {error && <div className="error">{error}</div>}

      {showForm && (
        <form className="section-card page-stack" onSubmit={handleCreate}>
          <div className="page-header-row">
            <h2 className="text-xl font-extrabold text-slate-950">{t('jobs.actions.new')}</h2>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
          </div>

          <hr className="border-slate-100" />

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="job-field sm:col-span-2">
              <label className="job-field-label" htmlFor="job-title">{t('jobs.form.title')} <span className="text-red-500">*</span></label>
              <input
                id="job-title"
                className="field-input"
                placeholder={t('jobs.form.titlePlaceholder')}
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>

            <div className="job-field sm:col-span-2">
              <label className="job-field-label" htmlFor="job-description">{t('jobs.form.description')} <span className="text-red-500">*</span></label>
              <textarea
                id="job-description"
                className="field-textarea"
                rows={3}
                placeholder={t('jobs.form.descriptionPlaceholder')}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                required
              />
            </div>

            <div className="job-field">
              <label className="job-field-label" htmlFor="job-owner-dept">{t('jobs.form.ownerDepartment')} <span className="text-red-500">*</span></label>
              <select
                id="job-owner-dept"
                className="field-select"
                value={form.ownerDepartmentId}
                onChange={e => setForm(f => ({ ...f, ownerDepartmentId: e.target.value }))}
                required
              >
                <option value="">—</option>
                {ownerDeptOptions.map(d => (
                  <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="job-field">
              <label className="job-field-label" htmlFor="job-priority">{t('jobs.form.priority')}</label>
              <select
                id="job-priority"
                className="field-select"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              >
                <option value="Low">{getPriorityLabel(t, 'Low')}</option>
                <option value="Normal">{getPriorityLabel(t, 'Normal')}</option>
                <option value="High">{getPriorityLabel(t, 'High')}</option>
              </select>
            </div>

            <div className="job-field">
              <label className="job-field-label" htmlFor="job-start-date">{t('jobs.form.startDate')}</label>
              <input
                id="job-start-date"
                className="field-input"
                type="date"
                value={form.startDateUtc}
                onChange={e => setForm(f => ({ ...f, startDateUtc: e.target.value }))}
              />
            </div>

            <div className="job-field">
              <label className="job-field-label" htmlFor="job-due-date">{t('jobs.form.dueDate')}</label>
              <input
                id="job-due-date"
                className="field-input"
                type="date"
                value={form.dueDateUtc}
                onChange={e => setForm(f => ({ ...f, dueDateUtc: e.target.value }))}
              />
            </div>

            <div className="job-field sm:col-span-2">
              <label className="job-field-label" htmlFor="job-target-depts">{t('jobs.form.targetDepartments')}</label>
              <select
                id="job-target-depts"
                className="field-select"
                multiple
                size={Math.min(6, Math.max(3, departments.length))}
                value={form.targetDepartmentIds}
                onChange={e => {
                  const selected = Array.from(e.target.selectedOptions).map(o => o.value)
                  setForm(f => ({ ...f, targetDepartmentIds: selected.filter(id => id !== f.ownerDepartmentId) }))
                }}
              >
                {departments
                  .filter(d => d.departmentId !== form.ownerDepartmentId)
                  .map(d => (
                    <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                  ))}
              </select>
              <p className="helper-copy mt-1">{t('jobs.form.targetDepartmentsHelp')}</p>
            </div>
          </div>

          <div className="inline-actions">
            <Button type="submit" disabled={submitting}>{submitting ? t('common.loading') : t('common.create')}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">{t('jobs.empty')}</div>
      ) : (
        <section className="section-card desktop-page-fill">
          <div className="table-wrap desktop-panel-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('jobs.columns.title')}</th>
                  <th>{t('jobs.columns.ownerDepartment')}</th>
                  <th>{t('jobs.columns.status')}</th>
                  <th>{t('jobs.columns.priority')}</th>
                  <th>{t('jobs.columns.progress')}</th>
                  <th>{t('jobs.columns.taskCount')}</th>
                  <th>{t('jobs.columns.dueDate')}</th>
                  <th>{t('jobs.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.jobId}>
                    <td className="font-semibold">{job.title}</td>
                    <td>{job.ownerDepartmentName ?? '—'}</td>
                    <td><StatusPill>{getJobStatusLabel(t, job.status)}</StatusPill></td>
                    <td>{getPriorityLabel(t, job.priority)}</td>
                    <td>{job.completionPercentage ?? 0}%</td>
                    <td>{job.taskCount}</td>
                    <td>{job.dueDateUtc ? new Date(job.dueDateUtc).toLocaleDateString() : '—'}</td>
                    <td>
                      <div className="inline-actions">
                        <Button size="sm" variant="secondary" onClick={() => openDetail(job.jobId)}>{t('jobs.actions.details')}</Button>
                        {isManagerLike && job.status === 'Active' && (
                          <Button size="sm" variant="destructive" onClick={() => handleCancel(job.jobId)}>{t('jobs.actions.cancel')}</Button>
                        )}
                        {user?.role === 'SystemAdmin' && (
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(job.jobId)}>{t('jobs.actions.delete')}</Button>
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

      {detail && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
          onClick={() => setDetail(null)}
          role="presentation"
        >
          <aside
            className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="page-header-row mb-4">
              <div className="space-y-1">
                <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">{t('jobs.detail.title')}</div>
                <h2 className="text-xl font-extrabold text-slate-950">{detail.title}</h2>
                <p className="text-sm text-slate-600">{detail.description}</p>
                <div className="inline-actions pt-1">
                  <StatusPill>{getJobStatusLabel(t, detail.status)}</StatusPill>
                  <StatusPill tone="info">{getPriorityLabel(t, detail.priority)}</StatusPill>
                  <StatusPill>{detail.completionPercentage ?? 0}%</StatusPill>
                </div>
                {detail.createdByDisplayName && (
                  <p className="text-xs text-[color:var(--color-muted-foreground)] pt-1">
                    {t('common.createdBy', 'Oluşturan')}: <span className="font-semibold text-slate-700">{detail.createdByDisplayName}</span>
                    {' · '}{new Date(detail.createdAtUtc).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="inline-actions ml-auto">
                {user?.role === 'SystemAdmin' && (
                  <Button type="button" variant="destructive" onClick={() => handleDelete(detail.jobId)}>{t('jobs.actions.delete')}</Button>
                )}
                <Button type="button" variant="secondary" onClick={() => setDetail(null)}>{t('jobs.actions.close')}</Button>
              </div>
            </div>

            {detailLoading && <div className="loading">{t('common.loading')}</div>}

            <section className="mb-5">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">{t('jobs.detail.departments')}</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('departments.name', 'Müdürlük')}</th>
                    <th>{t('jobs.detail.role')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.departments.map(d => (
                    <tr key={d.jobDepartmentId}>
                      <td>{d.departmentName ?? '—'}</td>
                      <td>{t(`jobs.roles.${d.role}`, d.role)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {isManagerLike && detail.status === 'Active' && (
                <div className="mt-3 inline-actions">
                  <select
                    className="field-select"
                    value={supportDeptDraft}
                    onChange={e => setSupportDeptDraft(e.target.value)}
                  >
                    <option value="">{t('jobs.actions.addSupportPrompt')}</option>
                    {departments
                      .filter(d => !detail.departments.some(jd => jd.departmentId === d.departmentId))
                      .map(d => (
                        <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                      ))}
                  </select>
                  <Button size="sm" onClick={handleAddSupport} disabled={!supportDeptDraft}>
                    {t('jobs.actions.addSupport')}
                  </Button>
                </div>
              )}
            </section>

            <section className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">{t('jobs.detail.tasks')}</h3>
                {isManagerLike && (
                  <Button size="sm" variant="secondary" onClick={() => setShowTaskForm(v => !v)}>
                    {showTaskForm ? t('jobs.actions.close') : t('tasks.actions.new', 'Yeni Görev')}
                  </Button>
                )}
              </div>
              {showTaskForm && (
                <form onSubmit={handleCreateTask} className="form-card mb-3">
                  <div className="form-row">
                    <label className="form-label">{t('tasks.form.title', 'Başlık')} *</label>
                    <input className="form-input" required value={taskForm.title}
                      onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="form-row">
                    <label className="form-label">{t('tasks.form.description', 'Açıklama')} *</label>
                    <textarea className="form-input" required rows={2} value={taskForm.description}
                      onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="form-row">
                    <label className="form-label">{t('tasks.form.priority', 'Öncelik')}</label>
                    <select className="form-input" value={taskForm.priority}
                      onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="Low">{t('enum.priority.Low', 'Düşük')}</option>
                      <option value="Normal">{t('enum.priority.Normal', 'Normal')}</option>
                      <option value="High">{t('enum.priority.High', 'Yüksek')}</option>
                      <option value="Critical">{t('enum.priority.Critical', 'Kritik')}</option>
                    </select>
                  </div>
                  <div className="form-row">
                    <label className="form-label">{t('tasks.form.assignedDepartment', 'Atanan Müdürlük')}</label>
                    <select className="form-input" value={taskForm.assignedDepartmentId}
                      onChange={e => setTaskForm(f => ({ ...f, assignedDepartmentId: e.target.value }))}>
                      <option value="">{t('common.optional', '— Seçin (opsiyonel)')}</option>
                      {detail.departments.map(d => (
                        <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label className="form-label">{t('tasks.form.dueDate', 'Son Tarih')}</label>
                    <input type="date" className="form-input" value={taskForm.dueDateUtc}
                      onChange={e => setTaskForm(f => ({ ...f, dueDateUtc: e.target.value }))} />
                  </div>
                  <div className="flex gap-2 justify-end mt-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => { setShowTaskForm(false); setTaskForm(EMPTY_TASK_FORM) }}>
                      {t('jobs.actions.close')}
                    </Button>
                    <Button type="submit" size="sm" disabled={taskSubmitting}>
                      {taskSubmitting ? t('common.saving', 'Kaydediliyor...') : t('jobs.actions.save')}
                    </Button>
                  </div>
                </form>
              )}
              {detail.tasks.length === 0 ? (
                <div className="empty-state">{t('jobs.detail.noTasks')}</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('tasks.columns.title', 'Başlık')}</th>
                      <th>{t('tasks.columns.status', 'Durum')}</th>
                      <th>{t('tasks.columns.assignedTo', 'Atanan')}</th>
                      <th>{t('tasks.columns.progress', 'İlerleme')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.tasks.map(tk => (
                      <tr key={tk.taskId}>
                        <td>{tk.title}</td>
                        <td><StatusPill>{t(`enum.taskStatus.${tk.currentStatus}`, tk.currentStatus)}</StatusPill></td>
                        <td>{tk.assignedUserDisplayName ?? tk.assignedDepartmentName ?? '—'}</td>
                        <td>{tk.completionPercentage ?? 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}
