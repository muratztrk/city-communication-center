import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { AuditLog } from '../types';
import { getAuditActionLabel, getLocale } from '../utils/localization';

export function AuditLogsPage() {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAuditLogs()
      .then(setLogs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const getActionBadge = (action: string) => {
    if (action.includes('Created')) return 'badge success';
    if (action.includes('Approved')) return 'badge success';
    if (action.includes('Completed')) return 'badge success';
    if (action.includes('Rejected')) return 'badge danger';
    if (action.includes('Submitted')) return 'badge warning';
    return 'badge info';
  };

  if (loading) return <div className="loading">{t('common.loading')}</div>;
  if (error) return <div className="error">{t('common.error')}: {error}</div>;

  return (
    <div className="page">
      <h1>📜 {t('audit.title')}</h1>
      <div className="table-container">
        <table>
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
                  <span className="badge">{log.entityType}</span>
                  <div className="text-muted text-small">{log.entityId.substring(0, 8)}...</div>
                </td>
                <td><span className={getActionBadge(log.action)}>{getAuditActionLabel(t, log.action)}</span></td>
                <td>{log.details || '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="text-center">{t('audit.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
