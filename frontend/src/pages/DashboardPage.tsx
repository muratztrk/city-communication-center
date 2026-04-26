import { ChartBarBig, ClipboardList, MessageSquareMore, XCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
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

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const role = currentUser?.role ?? ''

  const dashboardQuery = useQuery({ queryKey: ['dashboard'], queryFn: () => api.getDashboard() })
  const chartQuery = useQuery({ queryKey: ['dashboard-chart'], queryFn: () => api.getDashboardChart() })

  const isManagerOrAdmin = role === 'Manager' || role === 'SystemAdmin'

  const metrics: MetricCard[] = dashboardQuery.data
    ? [
        {
          label: t('dashboard.cards.openTasks'),
          value: dashboardQuery.data.openTaskCount,
          icon: ClipboardList,
          path: '/tasks',
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600',
        },
        ...(isManagerOrAdmin
          ? [
              {
                label: t('dashboard.cards.pendingApprovals'),
                value: dashboardQuery.data.pendingApprovalCount,
                icon: ChartBarBig,
                path: '/jobs?scope=pending-approval',
                iconBg: 'bg-orange-100',
                iconColor: 'text-orange-600',
              },
              {
                label: t('dashboard.cards.rejectedOrCancelled'),
                value: dashboardQuery.data.rejectedOrCancelledRequestCount,
                icon: XCircle,
                path: '/jobs?scope=rejected',
                iconBg: 'bg-red-100',
                iconColor: 'text-red-600',
              },
            ]
          : []),
        {
          label: t('dashboard.cards.activeMessages'),
          value: dashboardQuery.data.activeSocialMessageCount,
          icon: MessageSquareMore,
          path: '/social',
          iconBg: 'bg-rose-100',
          iconColor: 'text-rose-600',
        },
      ]
    : []

  const skeletonCount = isManagerOrAdmin ? 4 : 2
  const colClass = isManagerOrAdmin ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2'

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
  ]

  return (
    <div className="page-stack desktop-page-shell">
      <section className="section-card overflow-hidden p-0">
        <div
          className="grid gap-3 border-b border-white/10 px-4 py-3.5 text-white sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto]"
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

        <div className={`grid gap-3 p-3.5 ${colClass}`}>
          {dashboardQuery.isLoading
            ? Array.from({ length: skeletonCount }).map((_, i) => (
                <div
                  key={i}
                  className="h-[72px] animate-pulse rounded-[var(--radius-xl)] bg-slate-100"
                />
              ))
            : metrics.map(metric => {
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
              })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
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
