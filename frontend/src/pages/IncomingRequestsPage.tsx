import { ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { StatusPill } from '../components/ui/status-pill'
import type { JobSummary, Task } from '../types/platform'
import { getLocale, getPriorityLabel, getTaskStatusLabel } from '../utils/localization'

type IncomingRequestRow = {
  id: string
  kind: 'internal' | 'external'
  title: string
  status: string
  priority: string
  departmentName: string | null
  createdBy: string | null
  dueDateUtc: string | null
  createdAtUtc: string | null
  detailsPath: string
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

function getJobStatusLabel(t: ReturnType<typeof useTranslation>['t'], status: string): string {
  return t(`enum.jobStatus.${status}`, { defaultValue: status })
}

function toInternalRow(task: Task): IncomingRequestRow {
  return {
    id: task.taskId,
    kind: 'internal',
    title: task.title,
    status: task.currentStatus,
    priority: task.priority,
    departmentName: task.assignedDepartmentName ?? null,
    createdBy: task.createdByDisplayName ?? null,
    dueDateUtc: task.dueDateUtc,
    createdAtUtc: task.createdAtUtc ?? null,
    detailsPath: `/tasks?scope=all&taskId=${task.taskId}`,
  }
}

function toExternalRow(job: JobSummary): IncomingRequestRow {
  return {
    id: job.jobId,
    kind: 'external',
    title: job.title,
    status: job.status,
    priority: job.priority,
    departmentName: job.ownerDepartmentName,
    createdBy: null,
    dueDateUtc: job.dueDateUtc,
    createdAtUtc: job.startDateUtc,
    detailsPath: `/jobs?jobId=${job.jobId}`,
  }
}

export function IncomingRequestsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const locale = getLocale(i18n.language)
  const [tasks, setTasks] = useState<Task[]>([])
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.getTasks('all'),
      api.getJobs('my-department'),
    ])
      .then(([taskList, jobList]) => {
        if (cancelled) return
        setTasks(taskList)
        setJobs(jobList)
        setError(null)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : t('common.error')) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [t])

  const rows = useMemo(() => {
    const internalRows = tasks
      .filter(task => task.jobRequestType === 'InternalUnit')
      .map(toInternalRow)
    const externalRows = jobs
      .filter(job => job.requestType === 'ExternalUnit')
      .map(toExternalRow)

    return [...internalRows, ...externalRows].sort((a, b) => {
      const aTime = a.createdAtUtc ? new Date(a.createdAtUtc).getTime() : 0
      const bTime = b.createdAtUtc ? new Date(b.createdAtUtc).getTime() : 0
      return bTime - aTime
    })
  }, [jobs, tasks])

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{t('nav.incomingRequests', 'Birime Gelen Talepler')}</div>
            <h1 className="page-title">{t('nav.incomingRequestsAll', 'Birime Gelen Tüm Talepler')}</h1>
            <p className="page-subtitle">{t('incomingRequests.subtitle', 'Birim içi ve birim dışı gelen talepleri tek listede takip edin.')}</p>
          </div>
        </div>
      </header>

      <nav className="scope-chips" aria-label={t('nav.incomingRequests', 'Birime Gelen Talepler')}>
        <button type="button" className="scope-chip" onClick={() => navigate('/tasks')}>
          {t('nav.incomingRequestsInternal', 'Birim İçi Gelen Talepler')}
        </button>
        <button type="button" className="scope-chip" onClick={() => navigate('/jobs')}>
          {t('nav.incomingRequestsExternal', 'Birim Dışı Gelen Talepler')}
        </button>
        <button type="button" className="scope-chip active">
          {t('nav.incomingRequestsAll', 'Birime Gelen Tüm Talepler')}
        </button>
      </nav>

      {error ? <div className="error">{error}</div> : null}

      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">{t('incomingRequests.empty', 'Birime gelen talep bulunmuyor.')}</div>
      ) : (
        <section className="section-card desktop-page-fill">
          <div className="table-wrap desktop-panel-scroll">
            <table className="data-table jobs-table">
              <thead>
                <tr>
                  <th>{t('incomingRequests.columns.type', 'Tip')}</th>
                  <th>{t('jobs.columns.title', 'Başlık')}</th>
                  <th>{t('jobs.columns.status', 'Durum')}</th>
                  <th>{t('jobs.columns.priority', 'Öncelik')}</th>
                  <th>{t('tasks.columns.assignedTo', 'Atanan')}</th>
                  <th>{t('tasks.columns.createdBy', 'Oluşturan')}</th>
                  <th>{t('jobs.columns.dueDate', 'Son Tarih')}</th>
                  <th>{t('jobs.columns.actions', 'İşlemler')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={`${row.kind}-${row.id}`}>
                    <td>
                      <StatusPill tone={row.kind === 'internal' ? 'info' : 'success'}>
                        {row.kind === 'internal'
                          ? t('nav.incomingRequestsInternal', 'Birim İçi Gelen Talepler')
                          : t('nav.incomingRequestsExternal', 'Birim Dışı Gelen Talepler')}
                      </StatusPill>
                    </td>
                    <td className="font-semibold">{row.title}</td>
                    <td><StatusPill>{row.kind === 'internal' ? getTaskStatusLabel(t, row.status) : getJobStatusLabel(t, row.status)}</StatusPill></td>
                    <td>{getPriorityLabel(t, row.priority)}</td>
                    <td>{row.departmentName ?? '—'}</td>
                    <td>{row.createdBy ?? '—'}</td>
                    <td>{formatDateTime(row.dueDateUtc, locale)}</td>
                    <td className="actions-cell">
                      <Button size="sm" variant="secondary" onClick={() => navigate(row.detailsPath)} className="gap-1.5">
                        {t('jobs.actions.details', 'Detaylar')}
                        <ArrowRight className="size-3.5" />
                      </Button>
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
