import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { StatusPill } from '../components/ui/status-pill'
import { useAuth } from '../context/AuthContext'
import type { JobDepartmentInfo, JobDetail, JobListScope, JobSummary } from '../types/platform'
import { getLocale, getPriorityLabel } from '../utils/localization'

const EXTERNAL_SCOPES: { value: JobListScope; labelKey: string }[] = [
  { value: 'pending-approval', labelKey: 'jobs.scopes.pendingApproval' },
  { value: 'department-pool', labelKey: 'jobs.scopes.departmentPool' },
  { value: 'all', labelKey: 'jobs.scopes.all' },
]

function getJobStatusLabel(t: TFunction, status: string): string {
  return t(`enum.jobStatus.${status}`, { defaultValue: status })
}

function getJobDirectionLabel(t: TFunction, job: JobSummary): string {
  if (job.requestType === 'ExternalUnit') {
    return t('jobs.directions.externalOutgoing', 'Birim Dışı Giden')
  }

  if (job.requestType === 'Citizen') {
    return t('jobs.directions.citizenOutgoing', 'Vatandaş Talebi')
  }

  return t('jobs.directions.internalOutgoing', 'Birim İçi Giden')
}

function getDepartmentRoleTone(role: string) {
  if (role === 'Owner') return 'info' as const
  if (role === 'Target') return 'success' as const
  return 'neutral' as const
}

function sortJobDepartments(departments: JobDepartmentInfo[]) {
  const order: Record<string, number> = { Owner: 0, Target: 1, Coordinating: 2 }
  return [...departments].sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9))
}

function formatDateTime(value: string | null, locale: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface JobsPageProps {
  fixedScope?: JobListScope
  mode?: 'external' | 'myRequests'
}

export function JobsPage({ fixedScope, mode = 'external' }: JobsPageProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const locale = getLocale(i18n.language)
  const [searchParams, setSearchParams] = useSearchParams()
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [detail, setDetail] = useState<JobDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const isMyRequestsView = mode === 'myRequests'
  const scope = useMemo<JobListScope>(() => {
    if (fixedScope) return fixedScope
    const raw = (searchParams.get('scope') as JobListScope | null) ?? 'department-pool'
    return EXTERNAL_SCOPES.some(s => s.value === raw) || raw === 'rejected' ? raw : 'department-pool'
  }, [fixedScope, searchParams])

  // auto-open detail drawer when ?jobId=... is in the URL (e.g. linked from social messages)
  const autoOpenJobId = searchParams.get('jobId')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.getJobs(scope)
      .then(jobList => {
        if (cancelled) return
        setJobs(jobList)
        if (autoOpenJobId) void openDetail(autoOpenJobId)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : t('common.error')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [scope, t]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      api.getJobs(scope)
        .then(jobList => {
          setJobs(jobList)
          setError(null)
        })
        .catch(err => setError(err instanceof Error ? err.message : t('common.error')))

      if (detail?.jobId) {
        api.getJobById(detail.jobId)
          .then(setDetail)
          .catch(() => undefined)
      }
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [detail?.jobId, scope, t])

  const reload = async () => {
    try { setJobs(await api.getJobs(scope)) }
    catch (err) { setError(err instanceof Error ? err.message : t('common.error')) }
  }

  const isManagerLike = user?.role === 'Manager' || user?.role === 'SystemAdmin'
  const scopeLabel = scope === 'rejected'
    ? t('jobs.scopes.rejected', 'İptal/Red Edilen')
    : t(EXTERNAL_SCOPES.find(item => item.value === scope)?.labelKey ?? 'jobs.scopes.departmentPool', 'Birim Havuzu')
  const visibleJobs = useMemo(() => {
    if (isMyRequestsView) {
      return jobs
    }

    if (scope === 'rejected') {
      return jobs
    }

    return jobs.filter(job => job.requestType === 'ExternalUnit')
  }, [isMyRequestsView, jobs, scope])

  const openDetail = async (jobId: string) => {
    setDetailLoading(true)
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

  const renderJobDepartments = (job: JobSummary) => {
    const departmentsForJob = sortJobDepartments(job.departments ?? [])
    const owner = departmentsForJob.find(department => department.role === 'Owner')
    const related = departmentsForJob.filter(department => department.role !== 'Owner')
    const visibleRelated = related.slice(0, 3)
    const hiddenRelatedCount = related.length - visibleRelated.length
    const ownerName = owner?.departmentName ?? job.ownerDepartmentName ?? '—'

    return (
      <div className="min-w-[14rem] max-w-[24rem] space-y-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[0.68rem] font-bold uppercase tracking-wide text-slate-500">{t('jobs.roles.Owner')}</span>
          <span className="truncate font-semibold text-slate-950" title={ownerName}>{ownerName}</span>
        </div>
        {related.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {visibleRelated.map(department => {
              const roleLabel = t(`jobs.roles.${department.role}`, department.role)
              const departmentName = department.departmentName ?? '—'
              const label = `${roleLabel}: ${departmentName}`
              return (
                <StatusPill key={department.jobDepartmentId} tone={getDepartmentRoleTone(department.role)} title={label} className="max-w-[11rem]">
                  <span className="truncate">{label}</span>
                </StatusPill>
              )
            })}
            {hiddenRelatedCount > 0 ? (
              <StatusPill tone="neutral">{t('jobs.departmentsMore', { count: hiddenRelatedCount, defaultValue: '+{{count}} müdürlük' })}</StatusPill>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{isMyRequestsView ? t('jobs.myRequestsKicker', 'Talep Takibi') : scopeLabel}</div>
            <h1 className="page-title">{isMyRequestsView ? t('nav.myRequests', 'Benim Taleplerim') : t('nav.jobs', 'Birim Dışı Gelen Talep')}</h1>
            <p className="page-subtitle">
              {isMyRequestsView
                ? t('jobs.myRequestsSubtitle', 'Oluşturduğunuz talepleri ve hangi müdürlüğe gittiğini takip edin.')
                : t('jobs.subtitle', 'Birim dışı gelen talepleri izleyin, koordine müdürlükleri yönetin ve görevleri takip edin.')}
            </p>
          </div>
        </div>
      </header>

      {!fixedScope && <nav className="scope-chips">
        {EXTERNAL_SCOPES.map(s => (
          <button
            key={s.value}
            type="button"
            className={`scope-chip${s.value === scope ? ' active' : ''}`}
            onClick={() => setSearchParams({ scope: s.value })}
          >
            {t(s.labelKey, s.value)}
          </button>
        ))}
      </nav>}

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : visibleJobs.length === 0 ? (
        <div className="empty-state">{t('jobs.empty')}</div>
      ) : (
        <section className="section-card desktop-page-fill">
          <div className="table-wrap desktop-panel-scroll">
            <table className="data-table jobs-table">
              <thead>
                <tr>
                  <th>{t('jobs.columns.title')}</th>
                  <th>{isMyRequestsView ? t('jobs.columns.destination', 'Gidiş Yeri') : t('jobs.columns.departments')}</th>
                  <th>{t('jobs.columns.status')}</th>
                  <th>{t('jobs.columns.priority')}</th>
                  <th>{t('jobs.columns.project', 'Proje')}</th>
                  <th>{t('jobs.columns.taskCount')}</th>
                  <th>{t('jobs.columns.dueDate')}</th>
                  <th>{t('jobs.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleJobs.map(job => (
                  <tr key={job.jobId}>
                    <td className="font-semibold">{job.title}</td>
                    <td>
                      {isMyRequestsView ? (
                        <StatusPill tone="info">{getJobDirectionLabel(t, job)}</StatusPill>
                      ) : renderJobDepartments(job)}
                    </td>
                    <td><StatusPill>{getJobStatusLabel(t, job.status)}</StatusPill></td>
                    <td>{getPriorityLabel(t, job.priority)}</td>
                    <td>{job.isProject ? t('common.yes', 'Evet') : t('common.no', 'Hayır')}</td>
                    <td>{job.taskCount}</td>
                    <td>{formatDateTime(job.dueDateUtc, locale)}</td>
                    <td className="actions-cell">
                      <div className="request-actions">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setDetail(null)}
          role="presentation"
        >
          <section
            className="max-h-[88dvh] w-full max-w-5xl overflow-y-auto rounded-[var(--radius-2xl)] bg-white p-6 shadow-2xl"
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
                  {detail.isProject && <StatusPill tone="warning">{t('jobs.columns.project', 'Proje')}</StatusPill>}
                </div>
                {detail.createdByDisplayName && (
                  <p className="text-xs text-[color:var(--color-muted-foreground)] pt-1">
                    {t('common.createdBy', 'Oluşturan')}: <span className="font-semibold text-slate-700">{detail.createdByDisplayName}</span>
                    {' · '}{formatDateTime(detail.createdAtUtc, locale)}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill tone="info">{t('requests.create.typeLabel', 'Talep Tipi')}: {t(`jobs.requestTypes.${detail.requestType}`, detail.requestType)}</StatusPill>
                  <StatusPill tone="neutral">{t('jobs.columns.ownerDepartment', 'Sahip Müdürlük')}: {detail.ownerDepartmentName ?? '—'}</StatusPill>
                  <StatusPill tone="success">{t('jobs.columns.taskCount', 'Görevler')}: {detail.tasks.length}</StatusPill>
                </div>
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

            </section>

            <section className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">{t('jobs.detail.tasks')}</h3>
              </div>
              {detail.tasks.length === 0 ? (
                <div className="empty-state">{t('jobs.detail.noTasks')}</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('tasks.columns.title', 'Başlık')}</th>
                      <th>{t('tasks.columns.status', 'Durum')}</th>
                      <th>{t('tasks.columns.assignedTo', 'Atanan')}</th>
                      <th>{t('tasks.columns.owner', 'Sahip')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.tasks.map(tk => (
                      <tr key={tk.taskId}>
                        <td>{tk.title}</td>
                        <td><StatusPill>{t(`enum.taskStatus.${tk.currentStatus}`, tk.currentStatus)}</StatusPill></td>
                        <td>{tk.assignedUserDisplayName ?? tk.assignedDepartmentName ?? '—'}</td>
                        <td>{tk.ownerDisplayName ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </section>
        </div>
      )}
    </div>
  )
}
