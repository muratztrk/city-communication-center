import { ChartBarBig, ClipboardList, MessageSquareMore, UserRound } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { StatusPill } from '../components/ui/status-pill'

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dashboardQuery = useQuery({ queryKey: ['dashboard'], queryFn: () => api.getDashboard() })

  const metrics = dashboardQuery.data
    ? [
        { label: t('dashboard.cards.openTasks'), value: dashboardQuery.data.openTaskCount, icon: ClipboardList, path: '/tasks' },
        { label: t('dashboard.cards.pendingApprovals'), value: dashboardQuery.data.pendingApprovalCount, icon: ChartBarBig, path: '/tasks' },
        { label: t('dashboard.cards.unassignedItems'), value: dashboardQuery.data.unassignedItemCount, icon: UserRound, path: '/tasks' },
        { label: t('dashboard.cards.activeMessages'), value: dashboardQuery.data.activeSocialMessageCount, icon: MessageSquareMore, path: '/social' },
      ]
    : []

  return (
    <div className="page-stack desktop-page-shell">
      <section className="section-card overflow-hidden p-0">
        <div className="grid gap-3 border-b border-white/10 px-4 py-3.5 text-white sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto]" style={{ background: 'linear-gradient(135deg, var(--color-header-from), var(--color-header-to))' }}>
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

        <div className="grid gap-3 p-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => {
            const metric = metrics[index]
            const Icon = metric?.icon ?? ClipboardList

            return (
              <button
                className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white px-3.5 py-3 shadow-[var(--shadow-edge)] text-left transition-colors hover:border-[color:var(--color-primary)]/30 hover:shadow-md cursor-pointer"
                key={metric?.label ?? index}
                type="button"
                onClick={() => metric?.path && navigate(metric.path)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">{metric?.label ?? t('common.loading')}</div>
                    <div className="mt-1.5 text-3xl font-extrabold text-slate-950">{metric?.value ?? '...'}</div>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
                    <Icon className="size-4.5" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {dashboardQuery.isError ? <div className="error">{dashboardQuery.error instanceof Error ? dashboardQuery.error.message : t('common.error')}</div> : null}
    </div>
  )
}
