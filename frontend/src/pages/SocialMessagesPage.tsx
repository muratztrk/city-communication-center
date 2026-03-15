import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { SocialMessage } from '../types';

export function SocialMessagesPage() {
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSocialMessages()
      .then(setMessages)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
              </tr>
            ))}
            {messages.length === 0 && (
              <tr><td colSpan={5} className="text-center">Henüz mesaj bulunmuyor</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
