import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';

interface ChannelStatus {
  configured: boolean;
  [key: string]: boolean;
}

interface SocialSettings {
  x: ChannelStatus;
  facebook: ChannelStatus;
  instagram: ChannelStatus;
  whatsApp: ChannelStatus;
}

interface RoutingRule {
  ruleId: string;
  ruleName: string;
  keywords: string;
  targetDepartmentId: string;
  targetDepartmentName: string;
  priority: number;
  isActive: boolean;
}

interface RoutingConfig {
  autoRoutingEnabled: boolean;
  rules: RoutingRule[];
}

interface Department {
  departmentId: string;
  name: string;
}

type ChannelType = 'x' | 'facebook' | 'instagram' | 'whatsapp';
type SettingsTab = 'social' | 'routing';
const REQUEST_TIMEOUT_MS = 15000;

export function SettingsPage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('social');
  const [settings, setSettings] = useState<SocialSettings | null>(null);
  const [activeChannel, setActiveChannel] = useState<ChannelType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Routing state
  const [routingConfig, setRoutingConfig] = useState<RoutingConfig | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showNewRule, setShowNewRule] = useState(false);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState({ ruleName: '', keywords: '', targetDepartmentId: '', priority: 50 });
  const [testContent, setTestContent] = useState('');
  const [testResult, setTestResult] = useState<{ departmentId: string | null; departmentName: string | null } | null>(null);

  // Form states for each platform
  const [xForm, setXForm] = useState({ apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '', bearerToken: '' });
  const [fbForm, setFbForm] = useState({ appId: '', appSecret: '', pageAccessToken: '', pageId: '', webhookVerifyToken: '' });
  const [igForm, setIgForm] = useState({ accountId: '', accessToken: '', linkedPageId: '' });
  const [waForm, setWaForm] = useState({ businessAccountId: '', phoneNumberId: '', accessToken: '', webhookVerifyToken: '' });

  const headers = useMemo((): Record<string, string> => {
    const nextHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': user?.tenantId || '',
    };

    if (token) {
      nextHeaders.Authorization = `Bearer ${token}`;
    }

    return nextHeaders;
  }, [token, user?.tenantId]);

  const toErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  };

  const apiRequest = async <T,>(path: string, options: RequestInit = {}): Promise<T | null> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(getApiUrl(path), {
        ...options,
        headers: {
          ...headers,
          ...(options.headers ?? {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage = `İstek başarısız (${response.status})`;
        try {
          const payload = await response.json();
          if (payload?.error) {
            errorMessage = payload.error;
          } else if (payload?.message) {
            errorMessage = payload.message;
          }
        } catch {
          // keep generic message when backend does not return JSON
        }

        throw new Error(errorMessage);
      }

      if (response.status === 204) {
        return null;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        return null;
      }

      return (await response.json()) as T;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const fetchSettings = async () => {
    const data = await apiRequest<SocialSettings>('/admin/social-settings');
    if (data) {
      setSettings(data);
    }
  };

  const fetchRoutingConfig = async () => {
    const data = await apiRequest<RoutingConfig>('/admin/routing');
    if (data) {
      setRoutingConfig(data);
    }
  };

  const fetchDepartments = async () => {
    const data = await apiRequest<Department[]>('/organizations/departments');
    if (data) {
      setDepartments(data);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const loadPage = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchSettings(), fetchRoutingConfig(), fetchDepartments()]);
      } catch (error) {
        if (!isCancelled) {
          setMessage({ type: 'error', text: toErrorMessage(error, 'Ayarlar yüklenemedi') });
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void loadPage();

    return () => {
      isCancelled = true;
    };
  }, [headers]);

  const toggleAutoRouting = async () => {
    if (!routingConfig) return;
    try {
      await apiRequest('/admin/routing/toggle', {
        method: 'POST',
        body: JSON.stringify({ enabled: !routingConfig.autoRoutingEnabled })
      });
      setRoutingConfig({ ...routingConfig, autoRoutingEnabled: !routingConfig.autoRoutingEnabled });
      setMessage({ type: 'success', text: routingConfig.autoRoutingEnabled ? 'Otomatik yönlendirme kapatıldı' : 'Otomatik yönlendirme açıldı' });
    } catch (error) {
      setMessage({ type: 'error', text: toErrorMessage(error, 'Ayar değiştirilemedi') });
    }
  };

  const saveRule = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingRule
        ? `/admin/routing/rules/${editingRule}`
        : '/admin/routing/rules';
      const method = editingRule ? 'PUT' : 'POST';
      
      const body = editingRule 
        ? { ...ruleForm, isActive: true }
        : ruleForm;

      await apiRequest(url, { method, body: JSON.stringify(body) });
      setMessage({ type: 'success', text: editingRule ? 'Kural güncellendi' : 'Kural oluşturuldu' });
      await fetchRoutingConfig();
      setShowNewRule(false);
      setEditingRule(null);
      setRuleForm({ ruleName: '', keywords: '', targetDepartmentId: '', priority: 50 });
    } catch (error) {
      setMessage({ type: 'error', text: toErrorMessage(error, 'Kural kaydedilemedi') });
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Bu kuralı silmek istediğinize emin misiniz?')) return;
    try {
      await apiRequest(`/admin/routing/rules/${ruleId}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'Kural silindi' });
      await fetchRoutingConfig();
    } catch (error) {
      setMessage({ type: 'error', text: toErrorMessage(error, 'Kural silinemedi') });
    }
  };

  const testRouting = async () => {
    if (!testContent.trim()) return;
    try {
      const data = await apiRequest<{ targetDepartmentId: string | null; targetDepartmentName: string | null }>('/admin/routing/test', {
        method: 'POST',
        body: JSON.stringify({ messageContent: testContent })
      });
      setTestResult({ departmentId: data?.targetDepartmentId ?? null, departmentName: data?.targetDepartmentName ?? null });
    } catch (error) {
      setMessage({ type: 'error', text: toErrorMessage(error, 'Test başarısız') });
    }
  };

  const startEditRule = (rule: RoutingRule) => {
    setRuleForm({
      ruleName: rule.ruleName,
      keywords: rule.keywords,
      targetDepartmentId: rule.targetDepartmentId,
      priority: rule.priority
    });
    setEditingRule(rule.ruleId);
    setShowNewRule(true);
  };

  const handleSave = async (channel: ChannelType, e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    let body: object;
    switch (channel) {
      case 'x':
        body = xForm;
        break;
      case 'facebook':
        body = fbForm;
        break;
      case 'instagram':
        body = igForm;
        break;
      case 'whatsapp':
        body = waForm;
        break;
    }

    try {
      await apiRequest(`/admin/social-settings/${channel}`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      setMessage({ type: 'success', text: 'Ayarlar kaydedildi!' });
      await fetchSettings();
      setActiveChannel(null);
    } catch (error) {
      setMessage({ type: 'error', text: toErrorMessage(error, 'Kaydetme başarısız') });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (channel: ChannelType) => {
    setMessage(null);
    try {
      const data = await apiRequest<{ connected: boolean; message: string }>(`/admin/social-settings/${channel}/test`, {
        method: 'POST',
      });
      setMessage({
        type: data?.connected ? 'success' : 'error',
        text: data?.message ?? 'Test yanıtı alınamadı'
      });
    } catch (error) {
      setMessage({ type: 'error', text: toErrorMessage(error, 'Test başarısız') });
    }
  };

  const channels = [
    { id: 'x' as ChannelType, name: 'X (Twitter)', icon: '𝕏', color: '#000' },
    { id: 'facebook' as ChannelType, name: 'Facebook', icon: '📘', color: '#1877F2' },
    { id: 'instagram' as ChannelType, name: 'Instagram', icon: '📷', color: '#E4405F' },
    { id: 'whatsapp' as ChannelType, name: 'WhatsApp', icon: '💬', color: '#25D366' }
  ];

  if (loading) return <div className="page-loading">Yükleniyor...</div>;

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>⚙️ Ayarlar</h1>
        <p>Sistem yapılandırmasını buradan yönetebilirsiniz</p>
      </div>

      <div className="settings-tabs">
        <button 
          className={`tab-btn ${activeTab === 'social' ? 'active' : ''}`}
          onClick={() => setActiveTab('social')}
        >
          📱 Sosyal Medya
        </button>
        <button 
          className={`tab-btn ${activeTab === 'routing' ? 'active' : ''}`}
          onClick={() => setActiveTab('routing')}
        >
          🔀 Otomatik Yönlendirme
        </button>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {activeTab === 'routing' && (
        <div className="routing-section">
          <div className="routing-toggle">
            <div className="toggle-info">
              <h3>Otomatik Yönlendirme</h3>
              <p>Gelen mesajları anahtar kelimelere göre otomatik olarak departmanlara yönlendir</p>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={routingConfig?.autoRoutingEnabled || false}
                onChange={toggleAutoRouting}
              />
              <span className="slider"></span>
            </label>
          </div>

          {routingConfig?.autoRoutingEnabled && (
            <>
              <div className="rules-header">
                <h3>Yönlendirme Kuralları</h3>
                <button className="btn btn-primary" onClick={() => { setShowNewRule(true); setEditingRule(null); setRuleForm({ ruleName: '', keywords: '', targetDepartmentId: '', priority: 50 }); }}>
                  + Yeni Kural
                </button>
              </div>

              {showNewRule && (
                <form onSubmit={saveRule} className="rule-form">
                  <h4>{editingRule ? 'Kuralı Düzenle' : 'Yeni Kural'}</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Kural Adı</label>
                      <input 
                        type="text" 
                        value={ruleForm.ruleName}
                        onChange={e => setRuleForm({...ruleForm, ruleName: e.target.value})}
                        placeholder="Örn: Park Şikayetleri"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Hedef Departman</label>
                      <select 
                        value={ruleForm.targetDepartmentId}
                        onChange={e => setRuleForm({...ruleForm, targetDepartmentId: e.target.value})}
                        required
                      >
                        <option value="">Seçiniz...</option>
                        {departments.map(d => (
                          <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Öncelik</label>
                      <input 
                        type="number" 
                        value={ruleForm.priority}
                        onChange={e => setRuleForm({...ruleForm, priority: parseInt(e.target.value)})}
                        min="0" max="1000"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Anahtar Kelimeler (virgülle ayırın)</label>
                    <input 
                      type="text" 
                      value={ruleForm.keywords}
                      onChange={e => setRuleForm({...ruleForm, keywords: e.target.value})}
                      placeholder="park, bahçe, ağaç, yeşil alan"
                      required
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-success" disabled={saving}>
                      {saving ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setShowNewRule(false); setEditingRule(null); }}>
                      İptal
                    </button>
                  </div>
                </form>
              )}

              <div className="rules-list">
                {routingConfig?.rules.map(rule => (
                  <div key={rule.ruleId} className={`rule-card ${!rule.isActive ? 'inactive' : ''}`}>
                    <div className="rule-info">
                      <div className="rule-name">{rule.ruleName}</div>
                      <div className="rule-target">→ {rule.targetDepartmentName}</div>
                      <div className="rule-keywords">{rule.keywords}</div>
                    </div>
                    <div className="rule-priority">Öncelik: {rule.priority}</div>
                    <div className="rule-actions">
                      <button className="btn-icon" onClick={() => startEditRule(rule)} title="Düzenle">✏️</button>
                      <button className="btn-icon" onClick={() => deleteRule(rule.ruleId)} title="Sil">🗑️</button>
                    </div>
                  </div>
                ))}
                {routingConfig?.rules.length === 0 && (
                  <p className="no-rules">Henüz kural tanımlanmamış. Yukarıdaki "Yeni Kural" butonunu kullanarak ekleyin.</p>
                )}
              </div>

              <div className="test-section">
                <h4>🧪 Yönlendirme Testi</h4>
                <div className="test-input">
                  <input 
                    type="text" 
                    placeholder="Test mesajı yazın..."
                    value={testContent}
                    onChange={e => setTestContent(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={testRouting}>Test Et</button>
                </div>
                {testResult && (
                  <div className="test-result">
                    {testResult.departmentName 
                      ? `✅ Bu mesaj "${testResult.departmentName}" departmanına yönlendirilir.`
                      : '❌ Eşleşen kural bulunamadı. Mesaj manuel yönlendirme gerektirir.'}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'social' && (
        <>
          <div className="channels-grid">
            {channels.map(channel => (
              <div 
                key={channel.id} 
                className={`channel-card ${settings?.[channel.id === 'whatsapp' ? 'whatsApp' : channel.id]?.configured ? 'configured' : ''}`}
              >
                <div className="channel-header">
                  <span className="channel-icon" style={{ color: channel.color }}>{channel.icon}</span>
                  <h3>{channel.name}</h3>
                  <span className={`status-badge ${settings?.[channel.id === 'whatsapp' ? 'whatsApp' : channel.id]?.configured ? 'active' : 'inactive'}`}>
                    {settings?.[channel.id === 'whatsapp' ? 'whatsApp' : channel.id]?.configured ? '✓ Aktif' : 'Yapılandırılmamış'}
                  </span>
                </div>
            
            <div className="channel-actions">
              <button 
                className="btn btn-primary"
                onClick={() => setActiveChannel(activeChannel === channel.id ? null : channel.id)}
              >
                {activeChannel === channel.id ? 'İptal' : 'Yapılandır'}
              </button>
              {settings?.[channel.id === 'whatsapp' ? 'whatsApp' : channel.id]?.configured && (
                <button 
                  className="btn btn-secondary"
                  onClick={() => handleTest(channel.id)}
                >
                  Test Et
                </button>
              )}
            </div>

            {activeChannel === channel.id && (
              <form onSubmit={(e) => handleSave(channel.id, e)} className="channel-form">
                {channel.id === 'x' && (
                  <>
                    <div className="form-group">
                      <label>API Key (Consumer Key)</label>
                      <input type="text" value={xForm.apiKey} onChange={e => setXForm({...xForm, apiKey: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>API Secret (Consumer Secret)</label>
                      <input type="password" value={xForm.apiSecret} onChange={e => setXForm({...xForm, apiSecret: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Access Token</label>
                      <input type="text" value={xForm.accessToken} onChange={e => setXForm({...xForm, accessToken: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Access Token Secret</label>
                      <input type="password" value={xForm.accessTokenSecret} onChange={e => setXForm({...xForm, accessTokenSecret: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Bearer Token</label>
                      <input type="password" value={xForm.bearerToken} onChange={e => setXForm({...xForm, bearerToken: e.target.value})} />
                    </div>
                  </>
                )}

                {channel.id === 'facebook' && (
                  <>
                    <div className="form-group">
                      <label>App ID</label>
                      <input type="text" value={fbForm.appId} onChange={e => setFbForm({...fbForm, appId: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>App Secret</label>
                      <input type="password" value={fbForm.appSecret} onChange={e => setFbForm({...fbForm, appSecret: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Page ID</label>
                      <input type="text" value={fbForm.pageId} onChange={e => setFbForm({...fbForm, pageId: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Page Access Token</label>
                      <input type="password" value={fbForm.pageAccessToken} onChange={e => setFbForm({...fbForm, pageAccessToken: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Webhook Verify Token</label>
                      <input type="text" value={fbForm.webhookVerifyToken} onChange={e => setFbForm({...fbForm, webhookVerifyToken: e.target.value})} />
                    </div>
                  </>
                )}

                {channel.id === 'instagram' && (
                  <>
                    <div className="form-group">
                      <label>Business Account ID</label>
                      <input type="text" value={igForm.accountId} onChange={e => setIgForm({...igForm, accountId: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Access Token</label>
                      <input type="password" value={igForm.accessToken} onChange={e => setIgForm({...igForm, accessToken: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Linked Facebook Page ID</label>
                      <input type="text" value={igForm.linkedPageId} onChange={e => setIgForm({...igForm, linkedPageId: e.target.value})} />
                    </div>
                  </>
                )}

                {channel.id === 'whatsapp' && (
                  <>
                    <div className="form-group">
                      <label>Business Account ID</label>
                      <input type="text" value={waForm.businessAccountId} onChange={e => setWaForm({...waForm, businessAccountId: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Phone Number ID</label>
                      <input type="text" value={waForm.phoneNumberId} onChange={e => setWaForm({...waForm, phoneNumberId: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Access Token</label>
                      <input type="password" value={waForm.accessToken} onChange={e => setWaForm({...waForm, accessToken: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Webhook Verify Token</label>
                      <input type="text" value={waForm.webhookVerifyToken} onChange={e => setWaForm({...waForm, webhookVerifyToken: e.target.value})} />
                    </div>
                  </>
                )}

                <button type="submit" className="btn btn-success" disabled={saving}>
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      <div className="help-section">
        <h3>📖 Nasıl API Anahtarı Alınır?</h3>
        <div className="help-cards">
          <div className="help-card">
            <h4>𝕏 X (Twitter)</h4>
            <ol>
              <li><a href="https://developer.twitter.com/en/portal" target="_blank" rel="noopener">Developer Portal</a>'a gidin</li>
              <li>Yeni bir proje/uygulama oluşturun</li>
              <li>Keys & Tokens sekmesinden anahtarları alın</li>
              <li>Read and Write izinlerini etkinleştirin</li>
            </ol>
          </div>
          <div className="help-card">
            <h4>📘 Facebook</h4>
            <ol>
              <li><a href="https://developers.facebook.com/" target="_blank" rel="noopener">Meta for Developers</a>'a gidin</li>
              <li>Yeni bir uygulama oluşturun</li>
              <li>Messenger ve Pages API'yi ekleyin</li>
              <li>Sayfa erişim token'ı oluşturun</li>
            </ol>
          </div>
          <div className="help-card">
            <h4>📷 Instagram</h4>
            <ol>
              <li>Facebook Business hesabına bağlayın</li>
              <li>Instagram Basic Display API'yi ekleyin</li>
              <li>Business Account ID'yi alın</li>
              <li>Access Token oluşturun</li>
            </ol>
          </div>
          <div className="help-card">
            <h4>💬 WhatsApp</h4>
            <ol>
              <li><a href="https://business.whatsapp.com/" target="_blank" rel="noopener">WhatsApp Business</a>'a kaydolun</li>
              <li>Meta Business Suite'ten API erişimi alın</li>
              <li>Phone Number ID'yi not edin</li>
              <li>Kalıcı Access Token oluşturun</li>
            </ol>
          </div>
        </div>
      </div>
      </>
      )}

      <style>{`
        .settings-page { max-width: 1200px; }
        
        .page-header { margin-bottom: 1.5rem; }
        .page-header h1 { margin: 0; }
        .page-header p { color: var(--text-muted); margin-top: 0.5rem; }

        .settings-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; }
        .tab-btn { padding: 0.75rem 1.5rem; border: none; background: transparent; cursor: pointer; font-size: 1rem; font-weight: 500; color: var(--text-muted); border-radius: 6px 6px 0 0; }
        .tab-btn.active { color: var(--primary); background: var(--primary-light, #e0f2fe); }
        .tab-btn:hover { background: #f3f4f6; }
        
        .alert { padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
        .alert-success { background: #d1fae5; color: #065f46; }
        .alert-error { background: #fee2e2; color: #991b1b; }
        
        .channels-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
        
        .channel-card {
          background: white;
          border: 2px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          transition: all 0.2s;
        }
        .channel-card.configured { border-color: var(--success); }
        
        .channel-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .channel-icon { font-size: 1.5rem; }
        .channel-header h3 { margin: 0; flex: 1; }
        
        .status-badge {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-weight: 500;
        }
        .status-badge.active { background: #d1fae5; color: #065f46; }
        .status-badge.inactive { background: #f3f4f6; color: #6b7280; }
        
        .channel-actions { display: flex; gap: 0.5rem; }
        
        .btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
        }
        .btn-primary { background: var(--primary); color: white; }
        .btn-secondary { background: #f3f4f6; color: #374151; }
        .btn-success { background: var(--success); color: white; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        
        .channel-form {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border);
        }
        .form-group { margin-bottom: 1rem; }
        .form-group label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem; }
        .form-group input, .form-group select {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 0.875rem;
        }
        
        .help-section { margin-top: 3rem; }
        .help-section h3 { margin-bottom: 1rem; }
        .help-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
        .help-card {
          background: #f8fafc;
          border-radius: 8px;
          padding: 1rem;
        }
        .help-card h4 { margin: 0 0 0.75rem 0; }
        .help-card ol { margin: 0; padding-left: 1.25rem; font-size: 0.875rem; }
        .help-card li { margin-bottom: 0.5rem; }
        .help-card a { color: var(--primary); }

        /* Routing styles */
        .routing-section { background: white; border-radius: 12px; padding: 1.5rem; border: 1px solid var(--border); }
        
        .routing-toggle { display: flex; justify-content: space-between; align-items: center; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
        .toggle-info h3 { margin: 0 0 0.25rem 0; }
        .toggle-info p { margin: 0; color: var(--text-muted); font-size: 0.875rem; }
        
        .switch { position: relative; display: inline-block; width: 60px; height: 34px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 26px; width: 26px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--success); }
        input:checked + .slider:before { transform: translateX(26px); }
        
        .rules-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .rules-header h3 { margin: 0; }
        
        .rule-form { background: #f8fafc; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; }
        .rule-form h4 { margin: 0 0 1rem 0; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr 100px; gap: 1rem; }
        .form-actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
        
        .rules-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .rule-card { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: #f8fafc; border-radius: 8px; }
        .rule-card.inactive { opacity: 0.6; }
        .rule-info { flex: 1; }
        .rule-name { font-weight: 600; margin-bottom: 0.25rem; }
        .rule-target { color: var(--success); font-size: 0.875rem; }
        .rule-keywords { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; }
        .rule-priority { color: var(--text-muted); font-size: 0.875rem; min-width: 100px; }
        .rule-actions { display: flex; gap: 0.25rem; }
        .btn-icon { background: transparent; border: none; cursor: pointer; font-size: 1rem; padding: 0.25rem; }
        .btn-icon:hover { background: rgba(0,0,0,0.05); border-radius: 4px; }
        .no-rules { color: var(--text-muted); text-align: center; padding: 2rem; }
        
        .test-section { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }
        .test-section h4 { margin: 0 0 1rem 0; }
        .test-input { display: flex; gap: 0.5rem; }
        .test-input input { flex: 1; }
        .test-result { margin-top: 1rem; padding: 1rem; background: #f8fafc; border-radius: 8px; }
      `}</style>
    </div>
  );
}
