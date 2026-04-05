import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { AutocompleteField } from '../components/AutocompleteField';
import type { Department, SocialMessage, User } from '../types';
import { getLocale, getSocialChannelLabel, getSocialStatusLabel, getUserSourceLabel } from '../utils/localization';

export function SocialMessagesPage() {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeDrafts, setRouteDrafts] = useState<Record<string, { departmentId: string; userId: string }>>({});
  const [routeQueries, setRouteQueries] = useState<Record<string, string>>({});
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([api.getSocialMessages(), api.getDepartments(), api.getUsers()])
      .then(([messages, departments, users]) => {
        setMessages(messages);
        setDepartments(departments);
        setUsers(users);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [messages, departments, users] = await Promise.all([api.getSocialMessages(), api.getDepartments(), api.getUsers()]);
      setMessages(messages);
      setDepartments(departments);
      setUsers(users);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoute = async (socialMessageId: string) => {
    const draft = routeDrafts[socialMessageId];
    const departmentId = draft?.departmentId || undefined;
    const userId = draft?.userId || undefined;

    if (!departmentId && !userId) {
      return;
    }

    try {
      await api.routeSocialMessage(socialMessageId, departmentId ?? '', userId);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const getAssignableUsers = (socialMessageId: string, assignedDepartmentId: string | null) => {
    const selectedDepartmentId = routeDrafts[socialMessageId]?.departmentId ?? assignedDepartmentId ?? '';
    if (!selectedDepartmentId) {
      return users.filter(user => user.isActive);
    }

    return users.filter(user => user.departmentId === selectedDepartmentId && user.isActive);
  };

  const handleConvert = async (socialMessageId: string, citizenHandle: string) => {
    const title = taskTitles[socialMessageId]?.trim() || t('social.defaultTaskTitle', { handle: citizenHandle });

    try {
      await api.convertSocialMessageToTask(socialMessageId, {
        title,
        description: t('social.defaultTaskDescription', { handle: citizenHandle }),
        priority: 'Normal',
        dueDateUtc: null,
      });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'Twitter': return '🐦';
      case 'Facebook': return '📘';
      case 'Instagram': return '📷';
      case 'WhatsApp': return '💬';
      default: return '📱';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'New': return 'badge info';
      case 'Categorized': return 'badge';
      case 'Routed': return 'badge warning';
      case 'ConvertedToTask': return 'badge success';
      case 'Closed': return 'badge';
      default: return 'badge';
    }
  };

  if (loading) return <div className="loading">{t('common.loading')}</div>;
  if (error) return <div className="error">{t('common.error')}: {error}</div>;

  return (
    <div className="page">
      <h1>📱 {t('social.title')}</h1>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('social.channel')}</th>
              <th>{t('social.sender')}</th>
              <th>{t('social.category')}</th>
              <th>{t('common.status')}</th>
              <th>{t('social.date')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {messages.map(msg => (
              <tr key={msg.socialMessageId}>
                <td>{getChannelIcon(msg.channel)} {getSocialChannelLabel(t, msg.channel)}</td>
                <td>@{msg.citizenHandle}</td>
                <td>{msg.category || '-'}</td>
                <td><span className={getStatusBadge(msg.status)}>{getSocialStatusLabel(t, msg.status)}</span></td>
                <td>{new Date(msg.receivedAtUtc).toLocaleString(getLocale(i18n.language))}</td>
                <td className="actions">
                  {!msg.taskId && (
                    <div className="table-actions">
                      <select
                        aria-label={`Mesaj departman seç ${msg.citizenHandle}`}
                        value={routeDrafts[msg.socialMessageId]?.departmentId ?? msg.assignedDepartmentId ?? ''}
                        onChange={e => {
                          const departmentId = e.target.value;
                          setRouteDrafts(current => ({
                            ...current,
                            [msg.socialMessageId]: {
                              departmentId,
                              userId: current[msg.socialMessageId]?.userId ?? '',
                            },
                          }));
                          setRouteQueries(current => ({ ...current, [msg.socialMessageId]: '' }));
                        }}
                      >
                        <option value="">{t('tasks.draftDepartment')}</option>
                        {departments.map(department => (
                          <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                        ))}
                      </select>
                      <AutocompleteField
                        ariaLabel={`Mesaj kullanıcı seç ${msg.citizenHandle}`}
                        emptyMessage={t('social.userSearchEmpty')}
                        loadingMessage={t('common.loading')}
                        options={getAssignableUsers(msg.socialMessageId, msg.assignedDepartmentId)
                          .filter(user => {
                            const currentQuery = (routeQueries[msg.socialMessageId] ?? '').trim().toLowerCase();
                            if (!currentQuery) {
                              return true;
                            }

                            return user.displayName.toLowerCase().includes(currentQuery) || (user.email?.toLowerCase().includes(currentQuery) ?? false);
                          })
                          .map(user => ({
                            id: user.userId,
                            label: user.displayName,
                            description: [user.email, getUserSourceLabel(t, user.userSource)].filter(Boolean).join(' • '),
                          }))}
                        placeholder={t('social.userSearchPlaceholder')}
                        value={routeQueries[msg.socialMessageId] ?? ''}
                        onOptionSelect={option => {
                          setRouteDrafts(current => ({
                            ...current,
                            [msg.socialMessageId]: {
                              departmentId: current[msg.socialMessageId]?.departmentId ?? msg.assignedDepartmentId ?? '',
                              userId: option.id,
                            },
                          }));
                          setRouteQueries(current => ({ ...current, [msg.socialMessageId]: option.label }));
                        }}
                        onValueChange={value => {
                          setRouteQueries(current => ({ ...current, [msg.socialMessageId]: value }));
                          if (!value.trim()) {
                            setRouteDrafts(current => ({
                              ...current,
                              [msg.socialMessageId]: {
                                departmentId: current[msg.socialMessageId]?.departmentId ?? msg.assignedDepartmentId ?? '',
                                userId: '',
                              },
                            }));
                          }
                        }}
                      />
                      <button className="btn small" onClick={() => handleRoute(msg.socialMessageId)}>{t('social.route')}</button>
                      <input
                        aria-label={`Görev başlığı ${msg.citizenHandle}`}
                        type="text"
                        placeholder={t('social.taskTitlePlaceholder')}
                        value={taskTitles[msg.socialMessageId] ?? ''}
                        onChange={e => setTaskTitles(current => ({ ...current, [msg.socialMessageId]: e.target.value }))}
                      />
                      <button className="btn small success" onClick={() => handleConvert(msg.socialMessageId, msg.citizenHandle)}>{t('social.convert')}</button>
                    </div>
                  )}
                  {msg.taskId && <span className="badge success">{t('social.converted')}</span>}
                </td>
              </tr>
            ))}
            {messages.length === 0 && (
              <tr><td colSpan={6} className="text-center">{t('social.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
