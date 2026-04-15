import { ArrowRight, Building2, ChartBarBig, ClipboardList, MessageSquareMore, UserRound } from 'lucide-react'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { StatusPill } from '../components/ui/status-pill'
import { getLocale, getSocialStatusLabel, getTaskStatusLabel } from '../utils/localization'

function getTaskTone(status: string) {
  if (status === 'PendingApproval') return 'warning' as const
  if (status === 'Assigned' || status === 'InProgress') return 'info' as const
  if (status === 'Completed') return 'success' as const
  if (status === 'Rejected') return 'danger' as const
  return 'neutral' as const
}

function getSocialTone(status: string) {
  if (status === 'Routed') return 'info' as const
  if (status === 'ConvertedToTask') return 'success' as const
  if (status === 'Closed') return 'neutral' as const
  return 'warning' as const
}

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const dashboardQuery = useQuery({ queryKey: ['dashboard'], queryFn: () => api.getDashboard() })
  const tasksQuery = useQuery({ queryKey: ['dashboard-tasks'], queryFn: () => api.getTasks() })
  const socialQuery = useQuery({ queryKey: ['dashboard-social'], queryFn: () => api.getSocialMessages() })

  const metrics = dashboardQuery.data
    ? [
        { label: t('dashboard.cards.openTasks'), value: dashboardQuery.data.openTaskCount, icon: ClipboardList },
        { label: t('dashboard.cards.pendingApprovals'), value: dashboardQuery.data.pendingApprovalCount, icon: ChartBarBig },
        { label: t('dashboard.cards.activeMessages'), value: dashboardQuery.data.activeSocialMessageCount, icon: MessageSquareMore },
        { label: t('dashboard.cards.failedNotifications'), value: dashboardQuery.data.failedNotificationCount, icon: UserRound },
      ]
    : []

  const recentTasks = useMemo(() => {
    return [...(tasksQuery.data ?? [])].slice(0, 6)
  }, [tasksQuery.data])

  const recentMessages = useMemo(() => {
    return [...(socialQuery.data ?? [])]
      .sort((left, right) => new Date(right.receivedAtUtc).getTime() - new Date(left.receivedAtUtc).getTime())
      .slice(0, 6)
  }, [socialQuery.data])

  const quickLinks = [
    {
      title: t('dashboard.quickLinks.tasksTitle'),
      body: t('dashboard.quickLinks.tasksBody'),
      icon: ClipboardList,
      onClick: () => navigate('/tasks'),
    },
    {
      title: t('dashboard.quickLinks.socialTitle'),
      body: t('dashboard.quickLinks.socialBody'),
      icon: MessageSquareMore,
      onClick: () => navigate('/social'),
    },
    {
      title: t('dashboard.quickLinks.departmentsTitle'),
      body: t('dashboard.quickLinks.departmentsBody'),
      icon: Building2,
      onClick: () => navigate('/departments'),
    },
  ]

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
              {dashboardQuery.isFetching || tasksQuery.isFetching || socialQuery.isFetching ? t('common.refreshing') : t('dashboard.liveSummary')}
            </StatusPill>
          </div>
        </div>

        <div className="grid gap-3 p-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => {
            const metric = metrics[index]
            const Icon = metric?.icon ?? ClipboardList

            return (
              <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white px-3.5 py-3 shadow-[var(--shadow-edge)]" key={metric?.label ?? index}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">{metric?.label ?? t('common.loading')}</div>
                    <div className="mt-1.5 text-3xl font-extrabold text-slate-950">{metric?.value ?? '...'}</div>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
                    <Icon className="size-4.5" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {dashboardQuery.isError ? <div className="error">{dashboardQuery.error instanceof Error ? dashboardQuery.error.message : t('common.error')}</div> : null}

      <section className="grid gap-3.5 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <div className="section-card page-stack">
          <div className="page-header-row">
            <div>
              <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.recentTasksTitle')}</h2>
              <p className="helper-copy">{t('dashboard.recentTasksBody')}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate('/tasks')}>
              {t('dashboard.openModule')}
            </Button>
          </div>
          <div className="stack-list">
            {recentTasks.length === 0 ? <div className="empty-state">{t('dashboard.recentTasksEmpty')}</div> : null}
            {recentTasks.map(task => (
              <button
                className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[color:var(--color-muted)]/45 px-3.5 py-3 text-left transition-colors hover:bg-white"
                key={task.taskId}
                type="button"
                onClick={() => navigate('/tasks')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-950">{task.title}</div>
                    <div className="mt-0.5 text-xs text-[color:var(--color-muted-foreground)]">{task.description || t('dashboard.noTaskDescription')}</div>
                  </div>
                  <StatusPill tone={getTaskTone(task.currentStatus)}>{getTaskStatusLabel(t, task.currentStatus)}</StatusPill>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="section-card page-stack">
          <div className="page-header-row">
            <div>
              <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.recentMessagesTitle')}</h2>
              <p className="helper-copy">{t('dashboard.recentMessagesBody')}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate('/social')}>
              {t('dashboard.openModule')}
            </Button>
          </div>
          <div className="stack-list">
            {recentMessages.length === 0 ? <div className="empty-state">{t('dashboard.recentMessagesEmpty')}</div> : null}
            {recentMessages.map(message => (
              <button
                className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[color:var(--color-muted)]/45 px-3.5 py-3 text-left transition-colors hover:bg-white"
                key={message.socialMessageId}
                type="button"
                onClick={() => navigate('/social')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-950">@{message.citizenHandle}</div>
                    <div className="mt-0.5 text-xs text-[color:var(--color-muted-foreground)]">
                      {new Date(message.receivedAtUtc).toLocaleString(getLocale(i18n.language))}
                    </div>
                  </div>
                  <StatusPill tone={getSocialTone(message.status)}>{getSocialStatusLabel(t, message.status)}</StatusPill>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="page-stack">
        <div>
          <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.quickAreasTitle')}</h2>
          <p className="helper-copy">{t('dashboard.quickAreasBody')}</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {quickLinks.map(link => {
            const Icon = link.icon

            return (
              <button
                className="section-card flex items-center justify-between gap-3 text-left transition-colors hover:bg-white"
                key={link.title}
                type="button"
                onClick={link.onClick}
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
                    <Icon className="size-4.5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-950">{link.title}</div>
                    <div className="mt-0.5 text-xs text-[color:var(--color-muted-foreground)]">{link.body}</div>
                  </div>
                </div>
                <ArrowRight className="size-4 text-[color:var(--color-muted-foreground)]" />
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
