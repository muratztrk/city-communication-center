import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { StatusPill } from '../components/ui/status-pill'
import type { AuditLog } from '../types/platform'
import { getAuditActionLabel, getLocale } from '../utils/localization'

function getActionTone(action: string) {
  if (action.includes('Created') || action.includes('Approved') || action.includes('Completed')) {
    return 'success' as const
  }

  if (action.includes('Rejected')) {
    return 'danger' as const
  }

  if (action.includes('Submitted')) {
    return 'warning' as const
  }

  return 'info' as const
}

export function AuditLogsPage() {
  const { t, i18n } = useTranslation()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true

    void api.getAuditLogs()
      .then(response => {
        if (isActive) {
          setLogs(response)
        }
      })
      .catch(loadError => {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : t('common.error'))
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [t])

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className="page-stack">
      <header className="page-header-row">
        <div className="space-y-2">
          <h1 className="page-title">{t('audit.title')}</h1>
          <p className="page-subtitle">{t('audit.subtitle')}</p>
        </div>
        <StatusPill tone="info">{logs.length} {t('audit.recordCount')}</StatusPill>
      </header>

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      <section className="section-card">
        <div className="table-wrap">
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
              {logs.map(log => (
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
                  <td>{log.details || t('common.none')}</td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state">{t('audit.empty')}</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}