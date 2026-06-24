import { ArrowUpRight, ChartBarBig, ClipboardList, ListChecks, Loader, MessageSquareMore, SquareKanban } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { getActiveDepartmentId } from '../api/http'
import { StatusPill } from '../components/ui/status-pill'
import { PieChart } from '../components/ui/PieChart'
import { useAuth } from '../context/AuthContext'
import { DateTimePicker } from '../components/ui/date-time-picker'

interface MetricCard {
  label: string
  sublabel?: string
  value: number | undefined
  icon: React.ElementType
  path: string
  iconBg: string
  iconColor: string
}

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
type TaskChartFilter = 'all' | 'assigned' | 'routine'
type TaskChartKey = 'dashboard.charts.staffTasks' | 'dashboard.charts.departmentTasks' | 'dashboard.charts.myTasks'

const TASK_CHART_KEYS = new Set<TaskChartKey>([
  'dashboard.charts.staffTasks',
  'dashboard.charts.departmentTasks',
  'dashboard.charts.myTasks',
])

// Pie chart başlığı + lejant metinleri tıklanınca gidilecek ilgili sayfa (card 759).
const CHART_ROUTES: Record<string, string> = {
  'dashboard.charts.staffTasks': '/staff-tasks',
  'dashboard.charts.departmentTasks': '/department-tasks?flow=all',
  'dashboard.charts.myTasks': '/my-tasks',
  'dashboard.charts.myRequests': '/my-requests',
  'dashboard.charts.incomingRequests': '/incoming-requests',
  'dashboard.charts.outgoingRequests': '/outgoing-requests',
  'dashboard.citizenChannels.title': '/social',
}

// Lejant dilim etiketi → hedef sayfadaki ilgili "banner altı buton" (scope chip) view parametresi (card 759).
const SLICE_VIEW: Record<string, string> = {
  'dashboard.chart.pending': 'pending',
  'dashboard.chart.pendingApproval': 'pending',
  'dashboard.chart.externalPendingApproval': 'external-pending',
  'dashboard.chart.overdue': 'overdue',
  'dashboard.chart.completed': 'completed',
  'dashboard.chart.cancelled': 'rejected',
  'dashboard.chart.approved': 'approved',
  'dashboard.chart.inProgress': 'in-progress',
}

// Bir dilime tıklanınca gidilecek, ilgili scope-chip ile filtrelenmiş gridview rotası (card 759).
function getSliceRoute(titleKey: string, sliceLabel: string): string | undefined {
  // Vatandaş kanalları: kanal dilimi → /social?channel=X
  if (titleKey === 'dashboard.citizenChannels.title') {
    return sliceLabel.startsWith('channel.')
      ? `/social?channel=${encodeURIComponent(sliceLabel.slice('channel.'.length))}`
      : '/social'
  }
  // Personel grafiği dilimleri kişi adlarıdır; tekil filtre yok → genel sayfa.
  if (titleKey === 'dashboard.charts.staffTasks') return '/staff-tasks'
  // Standart kullanıcı "Birimdeki Görevler" 2 dilimli grafiği.
  if (sliceLabel === 'dashboard.chart.assignedToMe') return '/my-tasks'
  if (sliceLabel === 'dashboard.chart.departmentTotal') return '/department-tasks?flow=all'
  const base = CHART_ROUTES[titleKey]
  if (!base) return undefined
  const view = SLICE_VIEW[sliceLabel]
  if (!view) return base
  return `${base}${base.includes('?') ? '&' : '?'}view=${view}`
}

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const role = currentUser?.role ?? ''

  const [period, setPeriod] = useState<Period>('monthly')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [taskChartFilters, setTaskChartFilters] = useState<Record<TaskChartKey, TaskChartFilter>>({
    'dashboard.charts.staffTasks': 'all',
    'dashboard.charts.departmentTasks': 'all',
    'dashboard.charts.myTasks': 'all',
  })
  const activeDeptId = getActiveDepartmentId()

  function getPeriodRange(p: Period): { from: string; to: string } {
    const now = new Date()
    const toStr = now.toISOString()
    if (p === 'daily') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      return { from: start.toISOString(), to: toStr }
    }
    if (p === 'weekly') {
      const dayOfWeek = now.getDay()
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 0, 0, 0, 0)
      return { from: start.toISOString(), to: toStr }
    }
    if (p === 'monthly') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      return { from: start.toISOString(), to: toStr }
    }
    if (p === 'yearly') {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
      return { from: start.toISOString(), to: toStr }
    }
    return {
      from: customFrom ? new Date(customFrom).toISOString() : '',
      to: customTo ? new Date(customTo).toISOString() : '',
    }
  }

  const { from: activeFrom, to: activeTo } = useMemo(
    () => getPeriodRange(period),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, customFrom, customTo],
  )

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard.snapshot({ from: activeFrom, to: activeTo, departmentId: activeDeptId }),
    queryFn: () => api.getDashboard(activeFrom || undefined, activeTo || undefined),
    refetchInterval: 60_000,
  })
  const canSeeCitizenChannels = role === 'SystemAdmin' || role === 'Manager' || role === 'Operator'
  const citizenChannelQuery = useQuery({
    queryKey: queryKeys.dashboard.citizenChannels({ from: activeFrom, to: activeTo, departmentId: activeDeptId }),
    queryFn: () => api.getCitizenChannelChart(activeFrom || undefined, activeTo || undefined),
    enabled: canSeeCitizenChannels,
    refetchInterval: 60_000,
  })

  const isManagerOrAdmin = role === 'Manager' || role === 'SystemAdmin'
  const statusChartsQuery = useQuery({
    queryKey: queryKeys.dashboard.statusCharts({
      from: activeFrom,
      to: activeTo,
      departmentId: activeDeptId,
      staffTaskType: taskChartFilters['dashboard.charts.staffTasks'],
      departmentTaskType: taskChartFilters['dashboard.charts.departmentTasks'],
      myTaskType: taskChartFilters['dashboard.charts.myTasks'],
    }),
    queryFn: () => api.getDashboardStatusCharts(activeFrom || undefined, activeTo || undefined, {
      staff: taskChartFilters['dashboard.charts.staffTasks'],
      department: taskChartFilters['dashboard.charts.departmentTasks'],
      mine: taskChartFilters['dashboard.charts.myTasks'],
    }),
    enabled: !!currentUser,
    refetchInterval: 60_000,
  })
  // Üst Düzey Yönetici (Reporter) yalnızca talep oluşturur; "Bekleyen Görevlerim" gösterilmez.
  const isReporter = role === 'Reporter'

  const managerRow1: MetricCard[] = isManagerOrAdmin && dashboardQuery.data
    ? [
        {
          label: t('dashboard.cards.myPendingRequests', 'Bekleyen Taleplerim'),
          sublabel: t('dashboard.cards.internalExternalSub', '(Birim İçi/Birim Dışı)'),
          value: dashboardQuery.data.myPendingRequestCount,
          icon: ClipboardList,
          path: '/my-requests?view=pending',
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600',
        },
        {
          label: t('dashboard.cards.incomingPendingApproval', 'Birime Gelen Onay Bekleyen Talepler'),
          value: dashboardQuery.data.pendingApprovalCount,
          icon: ChartBarBig,
          path: '/incoming-requests',
          iconBg: 'bg-orange-100',
          iconColor: 'text-orange-600',
        },
        {
          label: t('dashboard.cards.outgoingPending', 'Birimden Giden Bekleyen Talepler'),
          value: dashboardQuery.data.outgoingPendingCount,
          icon: ArrowUpRight,
          path: '/outgoing-requests?view=pending',
          iconBg: 'bg-sky-100',
          iconColor: 'text-sky-600',
        },
        {
          label: t('dashboard.cards.outgoingInProgress', 'Birimden Giden Yapılmakta Olan Talepler'),
          value: dashboardQuery.data.outgoingInProgressCount,
          icon: Loader,
          path: '/outgoing-requests?view=in-progress',
          iconBg: 'bg-cyan-100',
          iconColor: 'text-cyan-600',
        },
        {
          label: t('dashboard.cards.myPendingTasks', 'Bekleyen Görevlerim'),
          sublabel: t('dashboard.cards.internalExternalSub', '(Birim İçi/Birim Dışı)'),
          value: dashboardQuery.data.myPendingTaskCount,
          icon: ListChecks,
          path: '/my-tasks?view=pending',
          iconBg: 'bg-violet-100',
          iconColor: 'text-violet-600',
        },
        {
          label: t('dashboard.cards.deptPendingTasks', 'Birimde Bekleyen Görevler'),
          value: dashboardQuery.data.deptPendingTaskCount,
          icon: SquareKanban,
          path: '/department-tasks?flow=all',
          iconBg: 'bg-emerald-100',
          iconColor: 'text-emerald-600',
        },
      ]
    : []

  const managerRow2: MetricCard[] = isManagerOrAdmin && dashboardQuery.data
    ? [
        {
          label: t('dashboard.cards.activeMessages', 'Vatandaş Talepleri'),
          value: dashboardQuery.data.activeSocialMessageCount,
          icon: MessageSquareMore,
          path: '/social',
          iconBg: 'bg-rose-100',
          iconColor: 'text-rose-600',
        },
      ]
    : []

  const staffMetrics: MetricCard[] = !isManagerOrAdmin && dashboardQuery.data
    ? [
        {
          label: t('dashboard.cards.myPendingRequests', 'Bekleyen Taleplerim'),
          sublabel: t('dashboard.cards.internalExternalSub', '(Birim İçi/Birim Dışı)'),
          value: dashboardQuery.data.myPendingRequestCount,
          icon: ClipboardList,
          path: '/my-requests?view=pending',
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600',
        },
        ...(isReporter ? [] : [{
          label: t('dashboard.cards.myPendingTasks', 'Bekleyen Görevlerim'),
          sublabel: t('dashboard.cards.internalExternalSub', '(Birim İçi/Birim Dışı)'),
          value: dashboardQuery.data.myPendingTaskCount,
          icon: ListChecks,
          path: '/my-tasks?view=pending',
          iconBg: 'bg-violet-100',
          iconColor: 'text-violet-600',
        }]),
      ]
    : []

  // Yönetici dashboard'unda her grafik, üst bölümdeki ilgili hızlı erişim
  // kartlarının aynı dönem verisini kullanır. Böylece sayı ve görsel özet
  // birbirinden kopmaz.
  const chartCards = [
    ...(statusChartsQuery.data?.charts ?? []),
    ...(canSeeCitizenChannels && citizenChannelQuery.data ? [citizenChannelQuery.data] : []),
  ]

  function renderCard(metric: MetricCard) {
    const Icon = metric.icon
    return (
      <button
        key={metric.label}
        type="button"
        className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white px-3.5 py-2 shadow-[var(--shadow-edge)] text-left transition-colors hover:border-[color:var(--color-primary)]/30 hover:shadow-md cursor-pointer"
        onClick={() => navigate(metric.path)}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">
              {metric.label}
              {metric.sublabel ? <span className="block normal-case tracking-normal">{metric.sublabel}</span> : null}
            </div>
            <div className="mt-0.5 text-2xl font-extrabold text-slate-950">{metric.value ?? '...'}</div>
          </div>
          <div className={`flex size-9 items-center justify-center rounded-xl ${metric.iconBg} ${metric.iconColor}`}>
            <Icon className="size-4" />
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="page-stack desktop-page-shell shrink-0">
      <section className="section-card p-0">
        <div
          className="grid gap-3 border-b border-white/10 px-4 py-3.5 text-white sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] rounded-t-[var(--radius-xl)] lg:rounded-t-[0.85rem]"
          style={{ background: 'linear-gradient(135deg, var(--color-header-from), var(--color-header-to))' }}
        >
          <div className="space-y-1">
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white/70">{t('dashboard.liveSummary')}</div>
            <h1 className="page-title !text-white">{t('dashboard.title')}</h1>
            <p className="max-w-3xl text-sm leading-6 text-white/82">{t('dashboard.subtitle')}</p>
          </div>
          <div className="flex items-start justify-start lg:justify-end">
            <StatusPill tone="info" className="bg-white/12 text-white ring-white/15">
              {dashboardQuery.isFetching ? t('common.refreshing') : t('dashboard.liveSummary')}
            </StatusPill>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5 border-b border-[var(--color-border)] bg-[var(--color-background)]">
          <span className="text-xs font-semibold text-[color:var(--color-muted-foreground)] uppercase tracking-wide mr-1">
            {t('dashboard.period.label', 'Dönem')}:
          </span>
          {(['daily', 'weekly', 'monthly'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                period === p
                  ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white'
                  : 'border-[var(--color-border)] bg-white text-slate-600 hover:border-[color:var(--color-primary)]/50'
              }`}
            >
              {t(`dashboard.period.${p}`, { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık', yearly: 'Yıllık' }[p])}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPeriod('custom')}
            className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
              period === 'custom'
                ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white'
                : 'border-[var(--color-border)] bg-white text-slate-600 hover:border-[color:var(--color-primary)]/50'
            }`}
          >
            {t('dashboard.period.custom', 'Özel')}
          </button>
          {period === 'custom' && (
            <>
              <DateTimePicker value={customFrom} onChange={setCustomFrom} placeholder="Başlangıç tarihi" className="scope-chip-date" forceDown />
              <span className="text-xs text-slate-400">–</span>
              <DateTimePicker value={customTo} onChange={setCustomTo} placeholder="Bitiş tarihi" className="scope-chip-date" forceDown />
            </>
          )}
        </div>

        {isManagerOrAdmin ? (
          <div className="space-y-3 p-3.5">
            {dashboardQuery.isLoading
              ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-[72px] animate-pulse rounded-[var(--radius-xl)] bg-slate-100" />
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-[72px] animate-pulse rounded-[var(--radius-xl)] bg-slate-100" />
                    ))}
                  </div>
                </>
              )
              : (
                // Tek grid: Vatandaş Talepleri ayrı satıra taşmadan Birimde Bekleyen
                // Görevler'in yanında akar.
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  {[...managerRow1, ...managerRow2].map(renderCard)}
                </div>
              )}
          </div>
        ) : (
          <div className="grid gap-3 p-3.5 sm:grid-cols-2">
            {dashboardQuery.isLoading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-[72px] animate-pulse rounded-[var(--radius-xl)] bg-slate-100" />
                ))
              : staffMetrics.map(renderCard)}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(statusChartsQuery.isLoading || dashboardQuery.isLoading) && chartCards.length === 0
          ? Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="section-card p-4 sm:p-5">
                <div className="mb-4 h-4 w-40 animate-pulse rounded bg-slate-100" />
                <div className="flex items-center gap-4">
                  <div className="size-40 animate-pulse rounded-full bg-slate-100" />
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                    ))}
                  </div>
                </div>
              </div>
            ))
          : chartCards.map(card => {
            // Standart kullanıcıların erişemediği "Birimdeki Görevler" listesine
            // dashboard'dan yönlendirme yapılmaz; grafik yalnızca bilgilendirme amaçlıdır.
            const isReadOnlyDepartmentChart = !isManagerOrAdmin && card.titleKey === 'dashboard.charts.departmentTasks'
            const chartRoute = isReadOnlyDepartmentChart ? undefined : CHART_ROUTES[card.titleKey]
            return (
            <section key={card.titleKey} className="section-card p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                {chartRoute ? (
                  <button
                    type="button"
                    onClick={() => navigate(chartRoute)}
                    className="cursor-pointer border-b border-current pb-0.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:text-[color:var(--color-primary)]"
                  >
                    {t(card.titleKey)}
                  </button>
                ) : (
                  <h2 className="border-b border-current pb-0.5 text-sm font-semibold text-slate-700">{t(card.titleKey)}</h2>
                )}
                {/* Görev tipi filtre butonları standart kullanıcılarda da görünür (Görevlerim + Birimdeki Görevler) (card 762). */}
                {TASK_CHART_KEYS.has(card.titleKey as TaskChartKey) && (
                  <div className="flex shrink-0 items-center gap-1" role="group" aria-label={t('tasks.filters.taskType', 'Görev tipi')}>
                    {(['assigned', 'routine', 'all'] as const).map(filter => {
                      const chartKey = card.titleKey as TaskChartKey
                      const active = taskChartFilters[chartKey] === filter
                      return (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setTaskChartFilters(current => ({ ...current, [chartKey]: filter }))}
                          className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${active ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          {t(`dashboard.taskFilter.${filter}`, { assigned: 'Atanmış', routine: 'Rutin', all: 'Tümü' }[filter])}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <PieChart slices={card.slices} noDataLabel={t('dashboard.chart.noData')} showZeroSlices onSelect={isReadOnlyDepartmentChart ? undefined : slice => {
                const route = getSliceRoute(card.titleKey, slice.label)
                if (route) navigate(route)
              }} />
              </section>
            )
          })}
      </section>

      {dashboardQuery.isError ? (
        <div className="error">{dashboardQuery.error instanceof Error ? dashboardQuery.error.message : t('common.error')}</div>
      ) : null}
    </div>
  )
}
