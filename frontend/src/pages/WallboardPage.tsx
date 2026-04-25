import { AlertTriangle, ArrowLeft, Building2, CalendarClock, Clock3, MonitorUp, RefreshCw, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import type { JobSummary, SocialMessage, Task } from '../types/platform'
import { getLocale, getPriorityLabel, getSocialStatusLabel, getTaskStatusLabel } from '../utils/localization'

type WallboardSource = 'internal' | 'citizen'

interface WallboardItem {
  id: string
  title: string
  subtitle: string
  source: WallboardSource
  status: string
  priority: string | null
  department: string | null
  assignee: string | null
  dueDateUtc: string | null
  createdAtUtc: string | null
}

const OPEN_TASK_STATUSES = new Set(['Waiting', 'Assigned', 'InProgress', 'PendingCloseApproval', 'RevisionRequested'])
const OPEN_SOCIAL_STATUSES = new Set(['New', 'Categorized', 'Routed'])
const REFRESH_INTERVAL_MS = 30000

function isCitizenSource(sourceType?: string | null) {
  return sourceType === 'SocialMessage' || sourceType === 'CitizenRequest'
}

function getDueTone(dueDateUtc: string | null) {
  if (!dueDateUtc) return 'normal'
  const dueTime = new Date(dueDateUtc).getTime()
  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000
  if (dueTime < now) return 'danger'
  if (dueTime - now <= oneDay) return 'warning'
  return 'normal'
}

function formatDate(value: string | null, locale: string) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(value: Date, locale: string) {
  return value.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

function getPriorityRank(priority: string | null) {
  if (priority === 'Critical') return 0
  if (priority === 'High') return 1
  if (priority === 'Normal') return 2
  return 3
}

function buildWallboardItems(tasks: Task[], jobs: JobSummary[], socialMessages: SocialMessage[], t: ReturnType<typeof useTranslation>['t']): WallboardItem[] {
  const jobsById = new Map(jobs.map(job => [job.jobId, job]))

  const taskItems: WallboardItem[] = tasks
    .filter(task => OPEN_TASK_STATUSES.has(task.currentStatus))
    .map(task => {
      const job = jobsById.get(task.jobId)
      return {
        id: `task-${task.taskId}`,
        title: task.title,
        subtitle: task.jobTitle ?? t('wallboard.noJob', 'İş kaydı yok'),
        source: isCitizenSource(job?.sourceType) ? 'citizen' : 'internal',
        status: getTaskStatusLabel(t, task.currentStatus),
        priority: task.priority,
        department: task.assignedDepartmentName ?? null,
        assignee: task.assignedUserDisplayName ?? task.ownerDisplayName ?? null,
        dueDateUtc: task.dueDateUtc,
        createdAtUtc: task.createdAtUtc ?? null,
      }
    })
  const openTaskJobIds = new Set(tasks.filter(task => OPEN_TASK_STATUSES.has(task.currentStatus)).map(task => task.jobId))

  const activeJobItems: WallboardItem[] = jobs
    .filter(job => !openTaskJobIds.has(job.jobId))
    .map(job => ({
      id: `job-${job.jobId}`,
      title: job.title,
      subtitle: t('wallboard.approvedJob', 'Müdür onaylı iş'),
      source: isCitizenSource(job.sourceType) ? 'citizen' : 'internal',
      status: t('enum.jobStatus.Active', 'Aktif'),
      priority: job.priority,
      department: job.ownerDepartmentName,
      assignee: null,
      dueDateUtc: job.dueDateUtc,
      createdAtUtc: job.startDateUtc,
    }))

  const socialItems: WallboardItem[] = socialMessages
    .filter(message => !message.jobId && OPEN_SOCIAL_STATUSES.has(message.status))
    .map(message => ({
      id: `social-${message.socialMessageId}`,
      title: `@${message.citizenHandle}`,
      subtitle: message.category ?? t('wallboard.citizenRequest', 'Vatandaş talebi'),
      source: 'citizen',
      status: getSocialStatusLabel(t, message.status),
      priority: null,
      department: null,
      assignee: null,
      dueDateUtc: null,
      createdAtUtc: message.receivedAtUtc,
    }))

  return [...taskItems, ...activeJobItems, ...socialItems]
    .sort((a, b) => {
      const priorityDelta = getPriorityRank(a.priority) - getPriorityRank(b.priority)
      if (priorityDelta !== 0) return priorityDelta
      const aDue = a.dueDateUtc ? new Date(a.dueDateUtc).getTime() : Number.MAX_SAFE_INTEGER
      const bDue = b.dueDateUtc ? new Date(b.dueDateUtc).getTime() : Number.MAX_SAFE_INTEGER
      if (aDue !== bDue) return aDue - bDue
      return new Date(b.createdAtUtc ?? 0).getTime() - new Date(a.createdAtUtc ?? 0).getTime()
    })
}

export function WallboardPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const locale = getLocale(i18n.language)
  const [items, setItems] = useState<WallboardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const loadBoard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)

    try {
      const [tasks, jobs, socialMessages] = await Promise.all([
        api.getTasks('all'),
        api.getJobs('active'),
        api.getSocialMessages(),
      ])
      setItems(buildWallboardItems(tasks, jobs, socialMessages, t))
      setLastUpdatedAt(new Date())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('common.error'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadBoard()
    const intervalId = window.setInterval(() => void loadBoard(true), REFRESH_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [loadBoard])

  const summary = useMemo(() => ({
    total: items.length,
    internal: items.filter(item => item.source === 'internal').length,
    citizen: items.filter(item => item.source === 'citizen').length,
    urgent: items.filter(item => item.priority === 'Critical' || item.priority === 'High' || getDueTone(item.dueDateUtc) !== 'normal').length,
  }), [items])

  const visibleItems = items.slice(0, 24)

  return (
    <main className="wallboard-page">
      <header className="wallboard-hero">
        <div className="wallboard-brand">
          <div className="wallboard-icon">
            <MonitorUp className="size-7" />
          </div>
          <div>
            <div className="wallboard-kicker">{t('wallboard.kicker', 'Canlı Ekran')}</div>
            <h1>{t('wallboard.title', 'Bekleyen İşler')}</h1>
            <p>{t('wallboard.subtitle', 'Kurum içi ve vatandaştan gelen müdür onaylı bekleyen işler')}</p>
          </div>
        </div>
        <div className="wallboard-actions">
          <div className="wallboard-clock">
            <Clock3 className="size-5" />
            <span>{lastUpdatedAt ? formatTime(lastUpdatedAt, locale) : '—'}</span>
          </div>
          <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')} className="gap-2">
            <ArrowLeft className="size-4" />
            {t('common.back', 'Geri')}
          </Button>
          <Button type="button" onClick={() => void loadBoard()} className="gap-2">
            <RefreshCw className="size-4" />
            {t('common.refresh', 'Yenile')}
          </Button>
        </div>
      </header>

      <section className="wallboard-stats" aria-label={t('wallboard.summary', 'Özet')}>
        <div><span>{summary.total}</span><p>{t('wallboard.totalWaiting', 'Toplam bekleyen')}</p></div>
        <div><span>{summary.internal}</span><p>{t('wallboard.internal', 'Kurum içi')}</p></div>
        <div><span>{summary.citizen}</span><p>{t('wallboard.citizen', 'Vatandaş')}</p></div>
        <div><span>{summary.urgent}</span><p>{t('wallboard.urgent', 'Öncelikli')}</p></div>
      </section>

      {error ? (
        <div className="wallboard-error">
          <AlertTriangle className="size-5" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="wallboard-loading">{t('common.loading')}</div>
      ) : visibleItems.length === 0 ? (
        <div className="wallboard-empty">{t('wallboard.empty', 'Bekleyen iş bulunmuyor.')}</div>
      ) : (
        <section className="wallboard-grid" aria-label={t('wallboard.title', 'Bekleyen İşler')}>
          {visibleItems.map(item => {
            const dueTone = getDueTone(item.dueDateUtc)
            return (
              <article key={item.id} className={`wallboard-item ${item.source}`}>
                <div className="wallboard-item-main">
                  <div className="wallboard-item-source">
                    {item.source === 'citizen' ? t('wallboard.citizen', 'Vatandaş') : t('wallboard.internal', 'Kurum içi')}
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.subtitle}</p>
                </div>
                <div className="wallboard-item-meta">
                  <span className="wallboard-status">{item.status}</span>
                  {item.priority ? <span>{getPriorityLabel(t, item.priority)}</span> : null}
                  <span className={dueTone === 'danger' ? 'danger' : dueTone === 'warning' ? 'warning' : undefined}>
                    <CalendarClock className="size-4" />
                    {formatDate(item.dueDateUtc, locale)}
                  </span>
                </div>
                <div className="wallboard-item-footer">
                  <span><Building2 className="size-4" />{item.department ?? t('wallboard.unassignedDepartment', 'Birim bekliyor')}</span>
                  <span><UserRound className="size-4" />{item.assignee ?? t('wallboard.unassignedUser', 'Kişi ataması yok')}</span>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}
