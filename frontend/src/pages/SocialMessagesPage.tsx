import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { SocialMessage, Department } from '../types';

export function SocialMessagesPage() {
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeDrafts, setRouteDrafts] = useState<Record<string, string>>({});
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([api.getSocialMessages(), api.getDepartments()])
      .then(([messages, departments]) => {
        setMessages(messages);
        setDepartments(departments);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [messages, departments] = await Promise.all([api.getSocialMessages(), api.getDepartments()]);
      setMessages(messages);
      setDepartments(departments);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoute = async (socialMessageId: string) => {
    const departmentId = routeDrafts[socialMessageId];
    if (!departmentId) return;

    try {
      await api.routeSocialMessage(socialMessageId, departmentId);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleConvert = async (socialMessageId: string, citizenHandle: string) => {
    const title = taskTitles[socialMessageId]?.trim() || `${citizenHandle} talebi`;

    try {
      await api.convertSocialMessageToTask(socialMessageId, {
        title,
        description: `${citizenHandle} tarafından iletilen sosyal medya mesajı`,
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

  if (loading) return <div className="loading">Yükleniyor...</div>;
  if (error) return <div className="error">Hata: {error}</div>;

  return (
    <div className="page">
      <h1>📱 Sosyal Medya Mesajları</h1>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Kanal</th>
              <th>Gönderen</th>
              <th>Kategori</th>
              <th>Durum</th>
              <th>Tarih</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {messages.map(msg => (
              <tr key={msg.socialMessageId}>
                <td>{getChannelIcon(msg.channel)} {msg.channel}</td>
                <td>@{msg.citizenHandle}</td>
                <td>{msg.category || '-'}</td>
                <td><span className={getStatusBadge(msg.status)}>{msg.status}</span></td>
                <td>{new Date(msg.receivedAtUtc).toLocaleString('tr-TR')}</td>
                <td className="actions">
                  {!msg.taskId && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <select
                        aria-label={`Mesaj departman seç ${msg.citizenHandle}`}
                        value={routeDrafts[msg.socialMessageId] ?? msg.assignedDepartmentId ?? ''}
                        onChange={e => setRouteDrafts(current => ({ ...current, [msg.socialMessageId]: e.target.value }))}
                      >
                        <option value="">Departman</option>
                        {departments.map(department => (
                          <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                        ))}
                      </select>
                      <button className="btn small" onClick={() => handleRoute(msg.socialMessageId)}>Yönlendir</button>
                      <input
                        aria-label={`Görev başlığı ${msg.citizenHandle}`}
                        type="text"
                        placeholder="Görev başlığı"
                        value={taskTitles[msg.socialMessageId] ?? ''}
                        onChange={e => setTaskTitles(current => ({ ...current, [msg.socialMessageId]: e.target.value }))}
                      />
                      <button className="btn small success" onClick={() => handleConvert(msg.socialMessageId, msg.citizenHandle)}>Göreve Çevir</button>
                    </div>
                  )}
                  {msg.taskId && <span className="badge success">Göreve dönüştürüldü</span>}
                </td>
              </tr>
            ))}
            {messages.length === 0 && (
              <tr><td colSpan={6} className="text-center">Henüz mesaj bulunmuyor</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
