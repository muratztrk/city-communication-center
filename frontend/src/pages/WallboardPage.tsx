import { AlertTriangle, ArrowLeft, ArrowUp, CalendarClock, Clock3, Monitor, RefreshCw, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import type { JobSummary, Task } from '../types/platform'
import { getLocale, getPriorityLabel, getTaskStatusLabel } from '../utils/localization'

type WallboardSource = 'internal' | 'external' | 'citizen'

interface WallboardItem {
  id: string
  title: string
  subtitle: string
  source: WallboardSource
  status: string
  priority: string | null
  assignee: string | null
  dueDateUtc: string | null
  createdAtUtc: string | null
}

const OPEN_TASK_STATUSES = new Set(['Waiting', 'Assigned', 'InProgress', 'RevisionRequested'])
const REFRESH_OPTIONS = [
  { value: 60_000, labelKey: 'wallboard.refreshOptions.oneMinute', fallback: '1 dakika' },
  { value: 600_000, labelKey: 'wallboard.refreshOptions.tenMinutes', fallback: '10 dakika' },
  { value: 1_800_000, labelKey: 'wallboard.refreshOptions.thirtyMinutes', fallback: '30 dakika' },
]

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
  if (!value) return locale.startsWith('tr') ? 'Belirsiz' : 'Unspecified'
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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

function buildWallboardItems(tasks: Task[], jobs: JobSummary[], t: ReturnType<typeof useTranslation>['t']): WallboardItem[] {
  const jobsById = new Map(jobs.map(job => [job.jobId, job]))

  return tasks
    .filter(task => OPEN_TASK_STATUSES.has(task.currentStatus))
    .map(task => {
      const job = jobsById.get(task.jobId)
      const source: WallboardSource = isCitizenSource(job?.sourceType)
        ? 'citizen'
        : job?.requestType === 'ExternalUnit'
          ? 'external'
          : 'internal'
      return {
        id: `task-${task.taskId}`,
        title: task.title,
        subtitle: task.jobTitle ?? t('wallboard.noJob', 'İş kaydı yok'),
        source,
        status: getTaskStatusLabel(t, task.currentStatus),
        priority: task.priority,
        assignee: task.assignedUserDisplayName ?? task.ownerDisplayName ?? null,
        dueDateUtc: task.dueDateUtc,
        createdAtUtc: task.createdAtUtc ?? null,
      }
    })
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
  const wallboardRef = useRef<HTMLElement>(null)
  const [items, setItems] = useState<WallboardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(60_000)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const loadBoard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)

    try {
      const [tasks, jobs] = await Promise.all([
        api.getTasks('all'),
        api.getJobs('active'),
      ])
      setItems(buildWallboardItems(tasks, jobs, t))
      setLastUpdatedAt(new Date())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('common.error'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadBoard()
    const intervalId = window.setInterval(() => void loadBoard(true), refreshIntervalMs)
    return () => window.clearInterval(intervalId)
  }, [loadBoard, refreshIntervalMs])

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement))
    syncFullscreenState()
    document.addEventListener('fullscreenchange', syncFullscreenState)
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      await (wallboardRef.current ?? document.documentElement).requestFullscreen()
    } catch {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
  }, [])

  const summary = useMemo(() => ({
    total: items.length,
    internal: items.filter(item => item.source === 'internal').length,
    external: items.filter(item => item.source === 'external').length,
  }), [items])

  const visibleItems = items.slice(0, 24)

  return (
    <main ref={wallboardRef} className="wallboard-page">
      <header className="wallboard-hero">
        <div className="wallboard-brand">
          <div>
            <div className="wallboard-kicker-row">
              <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')} className="wallboard-back-button gap-1.5">
                <ArrowLeft className="size-3.5" />
                {t('common.back', 'Geri')}
              </Button>
              <div className="wallboard-kicker">{t('wallboard.kicker', 'Canlı Ekran')}</div>
            </div>
            <h1>{t('wallboard.title', 'Bekleyen İşler')}</h1>
            <p>{t('wallboard.subtitle', 'Birim İçi ve Birim Dışı gelen yönetici onaylı tüm işler')}</p>
          </div>
          <button
            type="button"
            className="wallboard-icon wallboard-fullscreen-button"
            onClick={() => void toggleFullscreen()}
            aria-pressed={isFullscreen}
            aria-label={isFullscreen ? t('wallboard.exitFullscreen', 'Tam ekrandan çık') : t('wallboard.enterFullscreen', 'Tam ekran yap')}
            title={isFullscreen ? t('wallboard.exitFullscreen', 'Tam ekrandan çık') : t('wallboard.enterFullscreen', 'Tam ekran yap')}
          >
            <span className="wallboard-fullscreen-icon" aria-hidden="true">
              <Monitor className="size-7 wallboard-fullscreen-monitor" />
              <ArrowUp className={`size-3.5 wallboard-fullscreen-arrow ${isFullscreen ? 'is-fullscreen' : ''}`} />
            </span>
          </button>
        </div>
        <div className="wallboard-actions">
          <div className="wallboard-clock">
            <Clock3 className="size-5" />
            <span>{lastUpdatedAt ? formatTime(lastUpdatedAt, locale) : '—'}</span>
          </div>
          <label className="wallboard-refresh-control">
            <span>{t('wallboard.refreshInterval', 'Otomatik yenile')}</span>
            <select
              value={refreshIntervalMs}
              onChange={event => setRefreshIntervalMs(Number(event.target.value))}
            >
              {REFRESH_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey, option.fallback)}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" onClick={() => void loadBoard()} className="gap-2">
            <RefreshCw className="size-4" />
            {t('common.refresh', 'Yenile')}
          </Button>
        </div>
      </header>

      <section className="wallboard-stats" aria-label={t('wallboard.summary', 'Özet')}>
        <div><span>{summary.total}</span><p>{t('wallboard.totalWaiting', 'Toplam Bekleyen')}</p></div>
        <div><span>{summary.internal}</span><p>{t('wallboard.internal', 'Birim İçi')}</p></div>
        <div><span>{summary.external}</span><p>{t('wallboard.external', 'Birim Dışı')}</p></div>
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
        <section className="wallboard-table-shell" aria-label={t('wallboard.title', 'Bekleyen İşler')}>
          <table className="wallboard-table">
            <thead>
              <tr>
                <th className="wallboard-number-col">{t('wallboard.columns.number', 'Sıra')}</th>
                <th>{t('wallboard.columns.source', 'Kaynak')}</th>
                <th>{t('wallboard.columns.title', 'Başlık')}</th>
                <th>{t('wallboard.columns.status', 'Durum')}</th>
                <th>{t('wallboard.columns.priority', 'Öncelik')}</th>
                <th>{t('wallboard.columns.assignee', 'Atanan')}</th>
                <th>{t('wallboard.columns.dueDate', 'Son Tarih')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, index) => {
                const dueTone = getDueTone(item.dueDateUtc)
                return (
                  <tr key={item.id} className={`wallboard-row ${item.source}`}>
                    <td className="wallboard-number-cell">{index + 1}</td>
                    <td>
                      <span className="wallboard-source-pill">
                        {item.source === 'citizen'
                          ? t('wallboard.citizen', 'Vatandaş')
                          : item.source === 'external'
                            ? t('wallboard.external', 'Birim Dışı')
                            : t('wallboard.internal', 'Birim İçi')}
                      </span>
                    </td>
                    <td>
                      <div className="wallboard-row-title">{item.title}</div>
                      <div className="wallboard-row-subtitle">{item.subtitle}</div>
                    </td>
                    <td><span className="wallboard-status-pill">{item.status}</span></td>
                    <td>{item.priority ? getPriorityLabel(t, item.priority) : '—'}</td>
                    <td><span className="wallboard-cell-icon"><UserRound className="size-4" />{item.assignee ?? t('wallboard.unassignedUser', 'Kişi ataması yok')}</span></td>
                    <td>
                      <span className={`wallboard-cell-icon ${dueTone === 'danger' ? 'danger' : dueTone === 'warning' ? 'warning' : ''}`}>
                        <CalendarClock className="size-4" />
                        {formatDate(item.dueDateUtc, locale)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}
