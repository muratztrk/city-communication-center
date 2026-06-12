import { AlertTriangle, ArrowLeft, ArrowUp, CalendarClock, Clock3, LogOut, Monitor, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { FilterableTh } from '../components/ui/FilterableTh'
import { TablePagination } from '../components/ui/table-pagination'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useSortable } from '../hooks/useSortable'
import type { JobSummary, Task } from '../types/platform'
import { getLocale, getPriorityColorClass, getPriorityLabel } from '../utils/localization'

type WallboardSource = 'internal' | 'external' | 'citizen'

interface WallboardItem {
  id: string
  title: string
  source: WallboardSource
  priority: string | null
  dueDateUtc: string | null
  createdAtUtc: string | null
  jobNumber: string | null
  taskNumber: string | null
  requestLocation: string | null
  requestCreator: string | null
  taskOwner: string | null
  isReporterRequest: boolean
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

function formatNumber(num: number | null | undefined, year: number | null | undefined): string | null {
  if (!num) return null
  return year ? `${year}/${num}` : String(num)
}

function buildWallboardItems(tasks: Task[], jobs: JobSummary[]): WallboardItem[] {
  const jobsById = new Map(jobs.map(job => [job.jobId, job]))

  return tasks
    .filter(task => OPEN_TASK_STATUSES.has(task.currentStatus) && task.taskNumber != null)
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
        source,
        priority: task.priority,
        dueDateUtc: task.dueDateUtc,
        createdAtUtc: task.createdAtUtc ?? null,
        jobNumber: formatNumber(job?.jobNumber, job?.jobNumberYear),
        taskNumber: formatNumber(task.taskNumber, task.taskNumberYear),
        requestLocation: job?.ownerDepartmentName ?? null,
        requestCreator: job?.createdByDisplayName ?? null,
        taskOwner: task.assignedUserDisplayName ?? task.ownerDisplayName ?? null,
        isReporterRequest: job?.createdByRoleCode === 'Reporter',
      }
    })
    .sort((a, b) => {
      // En yeni görev en üstte: birincil sıralama oluşturulma tarihine göre azalan.
      const createdDelta = new Date(b.createdAtUtc ?? 0).getTime() - new Date(a.createdAtUtc ?? 0).getTime()
      if (createdDelta !== 0) return createdDelta
      const priorityDelta = getPriorityRank(a.priority) - getPriorityRank(b.priority)
      if (priorityDelta !== 0) return priorityDelta
      const aDue = a.dueDateUtc ? new Date(a.dueDateUtc).getTime() : Number.MAX_SAFE_INTEGER
      const bDue = b.dueDateUtc ? new Date(b.dueDateUtc).getTime() : Number.MAX_SAFE_INTEGER
      return aDue - bDue
    })
}

type WallboardStatFilter = 'total' | 'internal' | 'external' | 'overdue'

function isOverdueItem(item: WallboardItem): boolean {
  if (!item.dueDateUtc) return false
  return new Date(item.dueDateUtc).getTime() < Date.now()
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [statFilter, setStatFilter] = useState<WallboardStatFilter>('total')
  const { sortKey, sortDir, toggleSort, sortItems } = useSortable()
  const { filters, setFilter, matchesFilters } = useColumnFilters()

  const loadBoard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)

    try {
      const [tasks, jobs] = await Promise.all([
        api.getTasks('all'),
        api.getJobs('active'),
      ])
      setItems(buildWallboardItems(tasks, jobs))
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
    overdue: items.filter(isOverdueItem).length,
  }), [items])

  // Reset to first page whenever filters or the stat filter change
  useEffect(() => { setPage(1) }, [filters, statFilter])

  const filteredItems = useMemo(() => {
    const sorted = sortItems(items)
    const byStat = sorted.filter(item => {
      if (statFilter === 'internal') return item.source === 'internal'
      if (statFilter === 'external') return item.source === 'external'
      if (statFilter === 'overdue') return isOverdueItem(item)
      return true
    })
    return byStat.filter(item =>
      matchesFilters(item, (key, row) => {
        if (key === 'createdAtUtc') return formatDate(row.createdAtUtc, locale)
        if (key === 'dueDateUtc') return formatDate(row.dueDateUtc, locale)
        if (key === 'priority') return row.priority ? getPriorityLabel(t, row.priority) : ''
        return String((row as unknown as Record<string, unknown>)[key] ?? '')
      })
    )
  }, [items, sortItems, matchesFilters, locale, t, statFilter])

  const pagedItems = useMemo(
    () => filteredItems.slice((page - 1) * pageSize, page * pageSize),
    [filteredItems, page, pageSize],
  )

  return (
    <main ref={wallboardRef} className="wallboard-page">
      <header className="wallboard-hero">
        <div className="wallboard-brand">
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
          <div>
            <div className="wallboard-kicker-row">
              <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')} className="wallboard-back-button gap-1.5">
                <ArrowLeft className="size-3.5" />
                {t('common.back', 'Geri')}
              </Button>
              <div className="wallboard-kicker">{t('wallboard.kicker', 'Canlı Ekran')}</div>
            </div>
            <h1>{t('wallboard.title', 'Bekleyen Görevler')}</h1>
            <p>{t('wallboard.subtitle', 'Birim İçi ve Birim Dışı gelen yönetici onaylı tüm görevler')}</p>
          </div>
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
          <Button type="button" variant="destructive" onClick={() => navigate('/')} className="gap-2">
            <LogOut className="size-4" />
            {t('common.exit', 'Çıkış')}
          </Button>
        </div>
      </header>

      <section className="wallboard-stats" aria-label={t('wallboard.summary', 'Özet')}>
        <button type="button" className={`${summary.total === 0 ? 'is-zero' : ''}${statFilter === 'total' ? ' active' : ''}`} aria-pressed={statFilter === 'total'} onClick={() => setStatFilter('total')}>
          <span>{summary.total}</span><p>{t('wallboard.totalWaiting', 'Toplam Bekleyen (Birim İçi + Birim Dışı)')}</p>
        </button>
        <button type="button" className={`${summary.internal === 0 ? 'is-zero' : ''}${statFilter === 'internal' ? ' active' : ''}`} aria-pressed={statFilter === 'internal'} onClick={() => setStatFilter('internal')}>
          <span>{summary.internal}</span><p>{t('wallboard.internal', 'Birim İçi')}</p>
        </button>
        <button type="button" className={`${summary.external === 0 ? 'is-zero' : ''}${statFilter === 'external' ? ' active' : ''}`} aria-pressed={statFilter === 'external'} onClick={() => setStatFilter('external')}>
          <span>{summary.external}</span><p>{t('wallboard.external', 'Birim Dışı')}</p>
        </button>
        <button type="button" className={`stat-overdue${summary.overdue === 0 ? ' is-zero' : ''}${statFilter === 'overdue' ? ' active' : ''}`} aria-pressed={statFilter === 'overdue'} onClick={() => setStatFilter('overdue')}>
          <span>{summary.overdue}</span><p>{t('wallboard.overdue', 'Son Tarihi Geçmiş Görevler')}</p>
        </button>
      </section>

      {error ? (
        <div className="wallboard-error">
          <AlertTriangle className="size-5" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="wallboard-loading">{t('common.loading')}</div>
      ) : items.length === 0 ? (
        <div className="wallboard-empty">{t('wallboard.empty', 'Bekleyen iş bulunmuyor.')}</div>
      ) : (
        <section className="wallboard-table-shell" aria-label={t('wallboard.title', 'Bekleyen Görevler')}>
          <div className="wallboard-table-scroll">
            <table className="wallboard-table">
              <thead>
                <tr>
                  <th className="wallboard-number-col">{t('wallboard.columns.number', 'Sıra')}</th>
                  <FilterableTh filterKey="taskNumber" filterValue={filters['taskNumber']} onFilter={setFilter} sortKey="taskNumber" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t('wallboard.columns.taskNo', 'Görev No')}</FilterableTh>
                  <FilterableTh filterKey="createdAtUtc" filterValue={filters['createdAtUtc']} onFilter={setFilter} sortKey="createdAtUtc" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t('wallboard.columns.taskDate', 'Görev Tarihi')}</FilterableTh>
                  <FilterableTh filterKey="requestLocation" filterValue={filters['requestLocation']} onFilter={setFilter} sortKey="requestLocation" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t('wallboard.columns.requestLocationCreator', 'Görevin Talep Yeri/Oluşturan')}</FilterableTh>
                  <FilterableTh filterKey="title" filterValue={filters['title']} onFilter={setFilter} sortKey="title" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t('wallboard.columns.title', 'Başlık')}</FilterableTh>
                  <FilterableTh filterKey="taskOwner" filterValue={filters['taskOwner']} onFilter={setFilter} sortKey="taskOwner" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t('wallboard.columns.owner', 'Görev Sahibi')}</FilterableTh>
                  <FilterableTh filterKey="dueDateUtc" filterValue={filters['dueDateUtc']} onFilter={setFilter} sortKey="dueDateUtc" currentSortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t('wallboard.columns.dueDate', 'Son Tarih')}</FilterableTh>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((item, index) => {
                  const dueTone = getDueTone(item.dueDateUtc)
                  return (
                    <tr key={item.id} className={`wallboard-row ${item.source}${item.isReporterRequest ? ' reporter-row' : ''}`}>
                      <td className="wallboard-number-cell">{(page - 1) * pageSize + index + 1}</td>
                      <td>
                        <div>{item.taskNumber ?? '—'}</div>
                        {item.priority ? (
                          <div className={`wallboard-priority-text ${item.isReporterRequest && item.priority === 'Normal' ? 'text-white' : getPriorityColorClass(item.priority)}`}>(Öncelik:{getPriorityLabel(t, item.priority)})</div>
                        ) : null}
                      </td>
                      <td>
                        <span className="wallboard-cell-icon">
                          <CalendarClock className="size-4" />
                          {formatDate(item.createdAtUtc, locale)}
                        </span>
                      </td>
                      <td>
                        <div>{item.requestLocation ?? '—'}</div>
                        <div className="wallboard-secondary-text">{item.requestCreator ?? '—'}</div>
                      </td>
                      <td><div className="wallboard-row-title">{item.title}</div></td>
                      <td>{item.taskOwner ?? '—'}</td>
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
          </div>
          <TablePagination
            totalCount={filteredItems.length}
            pageSize={pageSize}
            currentPage={page}
            onPageSizeChange={size => { setPageSize(size); setPage(1) }}
            onPageChange={setPage}
          />
        </section>
      )}
    </main>
  )
}
