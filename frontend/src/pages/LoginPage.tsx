import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../api/config';
import './LoginPage.css';

interface Tenant {
  tenantId: string;
  municipalityName: string;
  displayName: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isTenantReady = tenants.length > 0 && !!selectedTenant;

  useEffect(() => {
    const abortController = new AbortController();

    const loadTenants = async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/tenants`, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error('Belediye listesi yüklenemedi');
        }

        const data = await response.json() as Tenant[];
        setTenants(data);
        setSelectedTenant(current => current || data[0]?.tenantId || '');
      } catch (err) {
        if (abortController.signal.aborted) {
          return;
        }

        console.error('Failed to fetch tenants:', err);
        setError(err instanceof Error ? err.message : 'Belediye listesi yüklenemedi');
      }
    };

    void loadTenants();

    return () => {
      abortController.abort();
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedTenant) {
      setError('Lütfen bir belediye seçin.');
      return;
    }

    setIsLoading(true);

    try {
      const tenant = tenants.find((item) => item.tenantId === selectedTenant);
      await login(username, password, selectedTenant, tenant?.displayName ?? tenant?.municipalityName ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">🏛️</div>
          <h1>Belediye İletişim Merkezi</h1>
          <p>City Communication Center</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="tenant">Belediye</label>
            <select
              id="tenant"
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              required
            >
              {tenants.map(t => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.municipalityName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="username">Kullanıcı Adı / E-posta</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="E-posta veya kullanıcı adı"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Şifre</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-button" disabled={isLoading || !isTenantReady}>
            {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <div className="login-footer">
          <p className="login-hint">
            <strong>Kurulum Notu:</strong><br />
            Ilk giris icin seed asamasinda tanimlanan super admin hesabini kullanin.<br />
            LDAP etkinse ayni formdan kurumsal hesabinizla da giris yapabilirsiniz.
          </p>
        </div>
      </div>
    </div>
  );
}
