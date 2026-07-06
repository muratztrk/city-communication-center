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
import { DashboardChartDrilldownModal } from '../components/DashboardChartDrilldownModal'
import { useAuth } from '../context/AuthContext'
import { canAnyRoleAccessPage, getEffectiveUserRoles } from '../lib/rolePageAccess'
import { ScopeChipDateRange } from '../components/ui/scope-chip-date-range'

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
  'dashboard.charts.citizenRequests': '/social',
}

// Üst Düzey Yönetici panosunda dilim tıklaması detay popup'ı açan grafikler (Taleplerim hariç, card #1343).
const DRILLDOWN_CHART_KEYS = new Set([
  'dashboard.charts.citizenRequests',
  'dashboard.charts.externalRequestCreators',
  'dashboard.charts.externalRequestPending',
  'dashboard.charts.externalRequestFulfillers',
  'dashboard.charts.neighborhoodCompletedRequests',
  'dashboard.charts.neighborhoodInProgressRequests',
])

// Lejant dilim etiketi → hedef sayfadaki ilgili scope chip (card 797).
const SLICE_VIEW: Record<string, string> = {
  'dashboard.chart.pending': 'pending',
  'dashboard.chart.pendingApproval': 'pending-approval',
  'dashboard.chart.externalPendingApproval': 'external-pending',
  'dashboard.chart.overdue': 'overdue',
  'dashboard.chart.completed': 'completed',
  'dashboard.chart.cancelled': 'rejected',
  'dashboard.chart.approved': 'approved',
  'dashboard.chart.inProgress': 'approved',
}

const INCOMING_SLICE_STATUS: Record<string, string> = {
  'dashboard.chart.pendingApproval': 'pending-approval',
  'dashboard.chart.pending': 'pending-approval',
  'dashboard.chart.overdue': 'overdue',
  'dashboard.chart.approved': 'approved',
  'dashboard.chart.inProgress': 'approved',
  'dashboard.chart.completed': 'completed',
  'dashboard.chart.cancelled': 'cancelled',
}

const CITIZEN_SLICE_STATUS: Record<string, string> = {
  'dashboard.chart.citizenProcessingReceived': 'processing-received',
  'dashboard.chart.overdue': 'overdue',
  'dashboard.chart.inProgress': 'in-progress',
  'dashboard.chart.completed': 'completed',
  'dashboard.chart.cancelled': 'cancelled',
}

const STAFF_SLICE_USER_ID = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\|/i

function parseStaffSliceUserId(sliceLabel: string): string | undefined {
  const match = sliceLabel.match(STAFF_SLICE_USER_ID)
  return match?.[1]
}

function withQueryParams(basePath: string, params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))
  if (entries.length === 0) return basePath
  const search = new URLSearchParams(entries).toString()
  const [path, existingQuery] = basePath.split('?')
  if (!existingQuery) return `${path}?${search}`
  return `${path}?${existingQuery}&${search}`
}

function periodQueryParams(from: string, to: string): Record<string, string | undefined> {
  if (!from && !to) return {}
  return { from: from || undefined, to: to || undefined }
}

// Bir dilime tıklanınca gidilecek, ilgili filtrelerle gridview rotası (card 797).
function getSliceRoute(
  titleKey: string,
  sliceLabel: string,
  taskChartFilter?: TaskChartFilter,
  period?: { from: string; to: string },
): string | undefined {
  // Vatandaş kanalları: kanal dilimi → /social?channel=X
  if (titleKey === 'dashboard.citizenChannels.title') {
    return sliceLabel.startsWith('channel.')
      ? `/social?channel=${encodeURIComponent(sliceLabel.slice('channel.'.length))}`
      : '/social'
  }

  if (titleKey === 'dashboard.charts.citizenRequests') {
    const requestStatus = CITIZEN_SLICE_STATUS[sliceLabel]
    const dateParams = period ? periodQueryParams(period.from, period.to) : {}
    return withQueryParams('/social', {
      channel: 'all',
      requestStatus,
      ...dateParams,
    })
  }

  const taskTypeParam = taskChartFilter && taskChartFilter !== 'all' ? taskChartFilter : undefined
  const dateParams = period ? periodQueryParams(period.from, period.to) : {}

  if (titleKey === 'dashboard.charts.staffTasks') {
    return withQueryParams('/staff-tasks', {
      userId: parseStaffSliceUserId(sliceLabel),
      taskType: taskTypeParam,
      ...dateParams,
    })
  }

  if (titleKey === 'dashboard.charts.incomingRequests') {
    const status = INCOMING_SLICE_STATUS[sliceLabel]
    return withQueryParams('/incoming-requests', {
      status: status === 'pending-approval' ? undefined : status,
      ...dateParams,
    })
  }

  // Standart kullanıcı "Birimdeki Görevler" 2 dilimli grafiği; "Benim Görevlerim" → Tüm Görevlerim (card #1345).
  if (sliceLabel === 'dashboard.chart.assignedToMe') {
    return withQueryParams('/my-tasks', { view: 'all', taskType: taskTypeParam, ...dateParams })
  }
  // "Birimdeki Görevler" dilimi/legend metni tıklanabilir değildir (card #1337).
  if (sliceLabel === 'dashboard.chart.departmentTotal') {
    return undefined
  }

  const base = CHART_ROUTES[titleKey]
  if (!base) return undefined

  const view = SLICE_VIEW[sliceLabel]

  if (titleKey === 'dashboard.charts.departmentTasks') {
    return withQueryParams('/department-tasks', {
      flow: 'all',
      view,
      taskType: taskTypeParam,
      ...dateParams,
    })
  }

  if (titleKey === 'dashboard.charts.myTasks') {
    return withQueryParams('/my-tasks', {
      view,
      taskType: taskTypeParam,
      ...dateParams,
    })
  }

  if (!view) return withQueryParams(base.split('?')[0], dateParams)
  return withQueryParams(base.split('?')[0], { view, ...dateParams })
}

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const role = currentUser?.role ?? ''

  const [period, setPeriod] = useState<Period>('yearly')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [taskChartFilters, setTaskChartFilters] = useState<Record<TaskChartKey, TaskChartFilter>>({
    'dashboard.charts.staffTasks': 'all',
    'dashboard.charts.departmentTasks': 'all',
    'dashboard.charts.myTasks': 'all',
  })
  const [chartDrilldown, setChartDrilldown] = useState<{ chartKey: string; sliceKey: string } | null>(null)
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
  const canSeeCitizenChannels = role === 'SystemAdmin' || role === 'Manager' || role === 'Operator' || role === 'Reporter'
  const citizenChannelQuery = useQuery({
    queryKey: queryKeys.dashboard.citizenChannels({ from: activeFrom, to: activeTo, departmentId: activeDeptId }),
    queryFn: () => api.getCitizenChannelChart(activeFrom || undefined, activeTo || undefined),
    enabled: canSeeCitizenChannels,
    refetchInterval: 60_000,
  })

  const isManagerOrAdmin = role === 'Manager' || role === 'SystemAdmin'
  const canAccessDepartmentTasks = canAnyRoleAccessPage(getEffectiveUserRoles(currentUser), 'departmentTasks')
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
    enabled: true,
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
  ].filter(card => !isReporter || (
    card.titleKey !== 'dashboard.charts.myTasks'
    && card.titleKey !== 'dashboard.charts.departmentTasks'
  ))

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
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
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
              <ScopeChipDateRange from={customFrom} to={customTo} onFromChange={setCustomFrom} onToChange={setCustomTo} forceDown />
            </>
          )}
        </div>

        {isManagerOrAdmin ? (
          <div className="space-y-3 p-3.5">
            {dashboardQuery.isLoading
              ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-[72px] animate-pulse rounded-[var(--radius-xl)] bg-slate-100" />
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-[72px] animate-pulse rounded-[var(--radius-xl)] bg-slate-100" />
                    ))}
                  </div>
                </>
              )
              : (
                // Tek grid: Vatandaş Talepleri ayrı satıra taşmadan Birimde Bekleyen
                // Görevler'in yanında akar.
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          : chartCards.length === 0 && !statusChartsQuery.isLoading && !dashboardQuery.isLoading
            ? (
              <div className="section-card col-span-full p-4 text-sm text-slate-600 sm:p-5">
                {statusChartsQuery.isError
                  ? (statusChartsQuery.error instanceof Error ? statusChartsQuery.error.message : t('common.error'))
                  : t('dashboard.chart.noData', 'Grafik verisi bulunamadı.')}
              </div>
            )
          : chartCards.map(card => {
            // Standart kullanıcıların erişemediği "Birimdeki Görevler" ile Üst Düzey Yönetici'ye
            // özel birim-dışı dağılım grafikleri (card #835/#763) yalnızca bilgilendirme amaçlıdır;
            // dashboard'dan yönlendirme yapılmaz.
            const isExternalDrilldownOnlyChart =
              card.titleKey === 'dashboard.charts.externalRequestCreators'
              || card.titleKey === 'dashboard.charts.externalRequestPending'
              || card.titleKey === 'dashboard.charts.externalRequestFulfillers'
              || card.titleKey === 'dashboard.charts.neighborhoodCompletedRequests'
              || card.titleKey === 'dashboard.charts.neighborhoodInProgressRequests'
            const isDepartmentTitleReadOnly = !canAccessDepartmentTasks && card.titleKey === 'dashboard.charts.departmentTasks'
            // Üst Düzey Yönetici'de Taleplerim hariç tüm grafik dilimleri detay popup'ı açar (card #1343).
            const isDrilldownChart = isReporter && DRILLDOWN_CHART_KEYS.has(card.titleKey)
            const chartRoute = isDepartmentTitleReadOnly || isExternalDrilldownOnlyChart ? undefined : CHART_ROUTES[card.titleKey]
            const chartKey = card.titleKey as TaskChartKey
            const taskFilter = TASK_CHART_KEYS.has(chartKey) ? taskChartFilters[chartKey] : undefined
            const periodRange = { from: activeFrom, to: activeTo }
            return (
            <section key={card.titleKey} className="section-card relative overflow-hidden p-4 sm:p-5">
              <div className="relative z-10 mb-4 flex items-center justify-between gap-3">
                {chartRoute ? (
                  <button
                    type="button"
                    onClick={() => navigate(withQueryParams(chartRoute, {
                      taskType: taskFilter && taskFilter !== 'all' ? taskFilter : undefined,
                      ...periodQueryParams(activeFrom, activeTo),
                    }))}
                    className="cursor-pointer border-b border-slate-200 pb-0.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:text-[color:var(--color-primary)]"
                  >
                    {t(card.titleKey)}
                  </button>
                ) : (
                  <h2 className="border-b border-slate-200 pb-0.5 text-sm font-semibold text-slate-700">{t(card.titleKey)}</h2>
                )}
                {/* Görev tipi filtre butonları standart kullanıcılarda da görünür (Görevlerim + Birimdeki Görevler) (card 762). */}
                {TASK_CHART_KEYS.has(card.titleKey as TaskChartKey) && (
                  <div className="flex shrink-0 items-center gap-1" role="group" aria-label={t('tasks.filters.taskType', 'Görev tipi')}>
                    {(['assigned', 'routine', 'all'] as const).map(filter => {
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
              <PieChart slices={card.slices} noDataLabel={t('dashboard.chart.noData')} showZeroSlices onSelect={isDrilldownChart ? slice => {
                setChartDrilldown({ chartKey: card.titleKey, sliceKey: slice.label })
              } : isExternalDrilldownOnlyChart ? undefined : slice => {
                const route = getSliceRoute(card.titleKey, slice.label, taskFilter, periodRange)
                if (route) navigate(route)
              }} isSliceSelectable={isDrilldownChart || isExternalDrilldownOnlyChart
                ? undefined
                // Rotası olmayan dilim (örn. Birimdeki Görevler) tıklanabilir görünmesin (card #1337).
                : slice => Boolean(getSliceRoute(card.titleKey, slice.label, taskFilter, periodRange))} />
              </section>
            )
          })}
      </section>

      {dashboardQuery.isError ? (
        <div className="error">{dashboardQuery.error instanceof Error ? dashboardQuery.error.message : t('common.error')}</div>
      ) : null}
      {statusChartsQuery.isError ? (
        <div className="error">{statusChartsQuery.error instanceof Error ? statusChartsQuery.error.message : t('common.error')}</div>
      ) : null}

      {chartDrilldown ? (
        <DashboardChartDrilldownModal
          key={`${chartDrilldown.chartKey}|${chartDrilldown.sliceKey}`}
          chartKey={chartDrilldown.chartKey}
          sliceKey={chartDrilldown.sliceKey}
          from={activeFrom || undefined}
          to={activeTo || undefined}
          onClose={() => setChartDrilldown(null)}
        />
      ) : null}
    </div>
  )
}
