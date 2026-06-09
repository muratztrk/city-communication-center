import { ArrowUpRight, ChartBarBig, ClipboardList, ListChecks, Loader, MessageSquareMore, SquareKanban } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { getActiveDepartmentId } from '../api/http'
import { StatusPill } from '../components/ui/status-pill'
import { PieChart } from '../components/ui/PieChart'
import { useAuth } from '../context/AuthContext'

interface MetricCard {
  label: string
  value: number | undefined
  icon: React.ElementType
  path: string
  iconBg: string
  iconColor: string
}

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const role = currentUser?.role ?? ''

  const [period, setPeriod] = useState<Period>('monthly')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
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
    queryKey: ['dashboard', activeFrom, activeTo, activeDeptId],
    queryFn: () => api.getDashboard(activeFrom || undefined, activeTo || undefined),
    refetchInterval: 60_000,
  })
  const chartQuery = useQuery({
    queryKey: ['dashboard-chart', activeFrom, activeTo, activeDeptId],
    queryFn: () => api.getDashboardChart(activeFrom || undefined, activeTo || undefined),
    refetchInterval: 60_000,
  })

  const canSeeCitizenChannels = role === 'SystemAdmin' || role === 'Manager' || role === 'Operator'
  const citizenChannelQuery = useQuery({
    queryKey: ['citizen-channel-chart', activeFrom, activeTo, activeDeptId],
    queryFn: () => api.getCitizenChannelChart(activeFrom || undefined, activeTo || undefined),
    enabled: canSeeCitizenChannels,
    refetchInterval: 60_000,
  })

  const isManagerOrAdmin = role === 'Manager' || role === 'SystemAdmin'

  const managerRow1: MetricCard[] = isManagerOrAdmin && dashboardQuery.data
    ? [
        {
          label: t('dashboard.cards.myPendingRequests', 'Bekleyen Taleplerim (Birim İçi/Dışı)'),
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
          label: t('dashboard.cards.myPendingTasks', 'Bekleyen Görevlerim (İçi/Dışı)'),
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
          label: t('dashboard.cards.myPendingRequests', 'Bekleyen Taleplerim (Birim İçi/Dışı)'),
          value: dashboardQuery.data.myPendingRequestCount,
          icon: ClipboardList,
          path: '/my-requests?view=pending',
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600',
        },
        {
          label: t('dashboard.cards.myPendingTasks', 'Bekleyen Görevlerim (İçi/Dışı)'),
          value: dashboardQuery.data.myPendingTaskCount,
          icon: ListChecks,
          path: '/my-tasks?view=pending',
          iconBg: 'bg-violet-100',
          iconColor: 'text-violet-600',
        },
      ]
    : []

  const summaryChart = dashboardQuery.data
    ? {
        titleKey: 'dashboard.chart.titleSummary',
        slices: [
          { label: 'dashboard.cards.openTasks', value: dashboardQuery.data.openTaskCount, colorHint: 'warning' },
          { label: 'dashboard.cards.pendingApprovals', value: dashboardQuery.data.pendingApprovalCount, colorHint: 'primary' },
          { label: 'dashboard.cards.activeMessages', value: dashboardQuery.data.activeSocialMessageCount, colorHint: 'danger' },
          { label: 'dashboard.cards.rejectedOrCancelled', value: dashboardQuery.data.rejectedOrCancelledRequestCount, colorHint: 'neutral' },
        ].filter(slice => slice.value > 0),
      }
    : null

  const chartCards = [
    ...(chartQuery.data ? [chartQuery.data] : []),
    ...(summaryChart ? [summaryChart] : []),
    ...(canSeeCitizenChannels && citizenChannelQuery.data ? [citizenChannelQuery.data] : []),
  ]

  function renderCard(metric: MetricCard) {
    const Icon = metric.icon
    return (
      <button
        key={metric.label}
        type="button"
        className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white px-3.5 py-3 shadow-[var(--shadow-edge)] text-left transition-colors hover:border-[color:var(--color-primary)]/30 hover:shadow-md cursor-pointer"
        onClick={() => navigate(metric.path)}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">
              {metric.label}
            </div>
            <div className="mt-1.5 text-3xl font-extrabold text-slate-950">{metric.value ?? '...'}</div>
          </div>
          <div className={`flex size-10 items-center justify-center rounded-xl ${metric.iconBg} ${metric.iconColor}`}>
            <Icon className="size-4.5" />
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="page-stack desktop-page-shell shrink-0 px-4 sm:px-6 lg:px-8">
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
              <input
                type="date"
                className="input text-xs px-2 py-1 h-auto"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
              />
              <span className="text-xs text-slate-400">–</span>
              <input
                type="date"
                className="input text-xs px-2 py-1 h-auto"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
              />
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
        {(chartQuery.isLoading || dashboardQuery.isLoading) && chartCards.length === 0
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
          : chartCards.map(card => (
              <section key={card.titleKey} className="section-card p-4 sm:p-5">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-slate-700">{t(card.titleKey)}</h2>
                </div>
                <PieChart slices={card.slices} noDataLabel={t('dashboard.chart.noData')} />
              </section>
            ))}
      </section>

      {dashboardQuery.isError ? (
        <div className="error">{dashboardQuery.error instanceof Error ? dashboardQuery.error.message : t('common.error')}</div>
      ) : null}
    </div>
  )
}
