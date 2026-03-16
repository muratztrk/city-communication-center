import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { AuditLog, Task, User } from '../types';

interface AuditLogGroup {
  groupKey: string;
  entityType: string;
  entityId: string;
  latestEventTimeUtc: string;
  logs: AuditLog[];
}

const ENTITY_LABELS: Record<string, string> = {
  WorkTask: 'Görev',
  Department: 'Departman',
  DirectorySync: 'Dizin Eşitleme',
};

const ACTION_LABELS: Record<string, string> = {
  TaskCreated: 'Görev Oluşturuldu',
  TaskSubmitted: 'Görev Onaya Gönderildi',
  TaskApproved: 'Görev Onaylandı',
  TaskRejected: 'Görev Reddedildi',
  TaskAssigned: 'Görev Atandı',
  TaskCompleted: 'Görev Tamamlandı',
  TaskClosed: 'Görev Kapatıldı',
  DepartmentCreated: 'Departman Oluşturuldu',
  DirectorySyncRequested: 'Dizin Eşitleme İsteği Oluşturuldu',
};

const ACTION_WORD_LABELS: Record<string, string> = {
  Task: 'Görev',
  Department: 'Departman',
  Directory: 'Dizin',
  Sync: 'Eşitleme',
  Requested: 'İstendi',
  Created: 'Oluşturuldu',
  Submitted: 'Gönderildi',
  Approved: 'Onaylandı',
  Rejected: 'Reddedildi',
  Assigned: 'Atandı',
  Completed: 'Tamamlandı',
  Closed: 'Kapatıldı',
};

const normalizeId = (id: string) => id.toLowerCase();

const translateEntityType = (entityType: string) => ENTITY_LABELS[entityType] ?? entityType;

const translateAction = (action: string) => {
  if (ACTION_LABELS[action]) {
    return ACTION_LABELS[action];
  }

  return action
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map((word) => ACTION_WORD_LABELS[word] ?? word)
    .join(' ');
};

const translateDetails = (details: string | null) => {
  if (!details) {
    return '-';
  }

  if (details === 'AD/LDAP synchronization request queued.') {
    return 'AD/LDAP eşitleme isteği kuyruğa alındı.';
  }

  if (details.startsWith('Auto-assigned to manager:')) {
    return details.replace('Auto-assigned to manager:', 'Yöneticiye otomatik atandı:');
  }

  const departmentCreatedMatch = details.match(/^Department '(.+)' created\.$/);
  if (departmentCreatedMatch) {
    return `Departman '${departmentCreatedMatch[1]}' oluşturuldu.`;
  }

  return details;
};

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [taskNamesById, setTaskNamesById] = useState<Record<string, string>>({});
  const [userNamesById, setUserNamesById] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      const [auditResult, tasksResult, usersResult] = await Promise.allSettled([
        api.getAuditLogs(),
        api.getTasks(),
        api.getUsers(),
      ]);

      if (isCancelled) {
        return;
      }

      if (auditResult.status === 'rejected') {
        const message = auditResult.reason instanceof Error
          ? auditResult.reason.message
          : 'Denetim kayıtları alınamadı';
        setError(message);
        setLoading(false);
        return;
      }

      setLogs(auditResult.value);

      if (tasksResult.status === 'fulfilled') {
        const nextTaskNames: Record<string, string> = {};
        tasksResult.value.forEach((task: Task) => {
          if (task.title.trim()) {
            nextTaskNames[normalizeId(task.taskId)] = task.title;
          }
        });
        setTaskNamesById(nextTaskNames);
      }

      if (usersResult.status === 'fulfilled') {
        const nextUserNames: Record<string, string> = {};
        usersResult.value.forEach((user: User) => {
          if (user.displayName.trim()) {
            nextUserNames[normalizeId(user.userId)] = user.displayName;
          }
        });
        setUserNamesById(nextUserNames);
      }

      setLoading(false);
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, []);

  const groupedLogs = useMemo<AuditLogGroup[]>(() => {
    const groups = new Map<string, AuditLogGroup>();

    logs.forEach((log) => {
      const groupKey = `${log.entityType}:${log.entityId}`;
      const existing = groups.get(groupKey);

      if (!existing) {
        groups.set(groupKey, {
          groupKey,
          entityType: log.entityType,
          entityId: log.entityId,
          latestEventTimeUtc: log.eventTimeUtc,
          logs: [log],
        });
        return;
      }

      existing.logs.push(log);
      if (new Date(log.eventTimeUtc).getTime() > new Date(existing.latestEventTimeUtc).getTime()) {
        existing.latestEventTimeUtc = log.eventTimeUtc;
      }
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        logs: [...group.logs].sort(
          (a, b) => new Date(b.eventTimeUtc).getTime() - new Date(a.eventTimeUtc).getTime(),
        ),
      }))
      .sort((a, b) => new Date(b.latestEventTimeUtc).getTime() - new Date(a.latestEventTimeUtc).getTime());
  }, [logs]);

  useEffect(() => {
    setExpandedGroups((previous) => {
      const next: Record<string, boolean> = {};
      groupedLogs.forEach((group) => {
        next[group.groupKey] = previous[group.groupKey] ?? false;
      });
      return next;
    });
  }, [groupedLogs]);

  const getGroupName = (group: AuditLogGroup, index: number) => {
    if (group.entityType === 'WorkTask') {
      return taskNamesById[normalizeId(group.entityId)] ?? `Görev #${index + 1}`;
    }

    return `${translateEntityType(group.entityType)} #${index + 1}`;
  };

  const getActorName = (actorUserId: string | null) => {
    if (!actorUserId) {
      return 'Sistem';
    }

    return userNamesById[normalizeId(actorUserId)] ?? 'Bilinmeyen Kullanıcı';
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((previous) => ({
      ...previous,
      [groupKey]: !(previous[groupKey] ?? true),
    }));
  };

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
      {groupedLogs.length === 0 && (
        <div className="table-container audit-empty">Henüz kayıt bulunmuyor</div>
      )}
      <div className="audit-groups">
        {groupedLogs.map((group, index) => {
          const isExpanded = expandedGroups[group.groupKey] ?? false;

          return (
            <div key={group.groupKey} className="audit-group-card">
              <div className="audit-group-header">
                <div className="audit-group-meta">
                  <span className="badge info">{translateEntityType(group.entityType)}</span>
                  <span className="audit-group-title">{getGroupName(group, index)}</span>
                  <span className="text-muted text-small"> • {group.logs.length} kayıt</span>
                </div>
                <button
                  type="button"
                  className="audit-toggle-btn"
                  onClick={() => toggleGroup(group.groupKey)}
                >
                  {isExpanded ? 'Detayı Gizle' : 'Detayı Göster'}
                </button>
              </div>
              {isExpanded && (
                <div className="audit-group-details">
                  <table className="audit-details-table">
                    <thead>
                      <tr>
                        <th>Tarih</th>
                        <th>İşlem</th>
                        <th>Detay</th>
                        <th>Güncelleyen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.logs.map((log) => (
                        <tr key={log.auditLogId}>
                          <td>{new Date(log.eventTimeUtc).toLocaleString('tr-TR')}</td>
                          <td><span className={getActionBadge(log.action)}>{translateAction(log.action)}</span></td>
                          <td>{translateDetails(log.details)}</td>
                          <td>{getActorName(log.actorUserId)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
