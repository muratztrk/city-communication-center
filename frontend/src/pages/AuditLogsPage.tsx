import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { StatusPill } from '../components/ui/status-pill'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { formatAuditNotes, getAuditActionLabel, getLocale } from '../utils/localization'

type AuditLogScope = 'system' | 'job' | 'task'

function readScope(value: string | null): AuditLogScope {
  return value === 'job' || value === 'task' ? value : 'system'
}

function resolveLogScope(entityType: string): AuditLogScope {
  if (entityType === 'Job') return 'job'
  if (entityType === 'WorkTask' || entityType === 'Task') return 'task'
  return 'system'
}

function getActionTone(action: string) {
  if (action.includes('Created') || action.includes('Approved') || action.includes('Completed')) {
    return 'success' as const
  }

  if (action.includes('Rejected') || action.includes('Deleted') || action.includes('Cancelled')) {
    return 'danger' as const
  }

  if (action.includes('Submitted')) {
    return 'warning' as const
  }

  return 'info' as const
}

export function AuditLogsPage() {
  const { t, i18n } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeScope = readScope(searchParams.get('scope'))

  const auditLogsQuery = useQuery({
    queryKey: queryKeys.auditLogs.list(),
    queryFn: () => api.getAuditLogs(),
  })
  const error = auditLogsQuery.error
    ? auditLogsQuery.error instanceof Error ? auditLogsQuery.error.message : t('common.error')
    : ''

  const scopedLogs = useMemo(
    () => (auditLogsQuery.data ?? []).filter(log => resolveLogScope(log.entityType) === activeScope),
    [activeScope, auditLogsQuery.data],
  )

  const scopeLabel = t(`audit.scopes.${activeScope}`)

  const setScope = (scope: AuditLogScope) => {
    const next = new URLSearchParams(searchParams)
    next.set('scope', scope)
    setSearchParams(next, { replace: true })
  }

  if (auditLogsQuery.isLoading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className="page-stack desktop-page-shell">
      <section className="section-card p-0">
        <div className="sticky-page-header !rounded-b-none border-0 shadow-none">
          <div className="page-header-row">
            <div className="space-y-1">
              {/* Banner ilk satır = seçili log sekmesi (card #1710). */}
              <div className="page-kicker">{scopeLabel}</div>
              <h1 className="page-title">{t('audit.title')}</h1>
              <p className="page-subtitle">{t('audit.subtitle')}</p>
            </div>
            <StatusPill tone="info">{scopedLogs.length} {t('audit.recordCount')}</StatusPill>
          </div>
        </div>
        {/* scope-chip yerine Ayarlar ile aynı tab-bar — aktif sekmede tasarım bozulmasın (card #1712). */}
        <div className="sticky top-0 z-[12] border-t border-slate-100 bg-white">
          <div className="tab-bar settings-tab-bar audit-log-tab-bar" role="tablist" aria-label={t('audit.title')}>
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === 'system'}
              className={`tab-button ${activeScope === 'system' ? 'active' : ''}`}
              onClick={() => setScope('system')}
            >
              {t('audit.scopes.system')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === 'job'}
              className={`tab-button ${activeScope === 'job' ? 'active' : ''}`}
              onClick={() => setScope('job')}
            >
              {t('audit.scopes.job')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === 'task'}
              className={`tab-button ${activeScope === 'task' ? 'active' : ''}`}
              onClick={() => setScope('task')}
            >
              {t('audit.scopes.task')}
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      <section className="section-card desktop-page-fill">
        <div className="table-wrap desktop-panel-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('audit.date')}</th>
                <th>{t('audit.entity')}</th>
                <th>{t('audit.action')}</th>
                <th>{t('audit.detail')}</th>
              </tr>
            </thead>
            <tbody>
              {scopedLogs.map(log => (
                <tr key={log.auditLogId}>
                  <td>{new Date(log.eventTimeUtc).toLocaleString(getLocale(i18n.language))}</td>
                  <td>
                    <div className="space-y-2">
                      <StatusPill>{log.entityType}</StatusPill>
                      <div className="text-xs text-slate-500">{log.entityId.slice(0, 8)}...</div>
                    </div>
                  </td>
                  <td>
                    <StatusPill tone={getActionTone(log.action)}>{getAuditActionLabel(t, log.action)}</StatusPill>
                  </td>
                  <td>{log.details ? formatAuditNotes(t, log.details) : t('common.none')}</td>
                </tr>
              ))}
              {scopedLogs.length === 0 ? (
                <TableEmptyStateRows columnCount={4} message={t('audit.empty')} />
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
