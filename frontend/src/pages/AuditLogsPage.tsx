import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AuditLog } from '../types';

export function AuditLogsPage() {
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

  if (loading) return <div className="loading">Yükleniyor...</div>;
  if (error) return <div className="error">Hata: {error}</div>;

  return (
    <div className="page">
      <h1>📜 Denetim Kayıtları</h1>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Varlık</th>
              <th>İşlem</th>
              <th>Detay</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.auditLogId}>
                <td>{new Date(log.eventTimeUtc).toLocaleString('tr-TR')}</td>
                <td>
                  <span className="badge">{log.entityType}</span>
                  <div className="text-muted text-small">{log.entityId.substring(0, 8)}...</div>
                </td>
                <td><span className={getActionBadge(log.action)}>{log.action}</span></td>
                <td>{log.details || '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="text-center">Henüz kayıt bulunmuyor</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
